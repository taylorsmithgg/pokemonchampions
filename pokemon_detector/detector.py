"""
Pokemon Detector: main orchestrator for the live stream detection pipeline.

Usage:
    detector = PokemonDetector("sprite_db.pkl")
    
    # Process a single frame
    results = detector.process_frame(frame_bgr)
    
    # Results include identified Pokemon, confidence scores, and match metadata
"""

import cv2
import numpy as np
import json
import time
import os
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path

from .core.frame_detector import FrameDetector, FrameDetection
from .core.matcher import SpriteMatcher, MatchResult, extract_sprite_mask
from .core.sprite_db import SpriteDatabase


@dataclass
class OpponentSlot:
    """Detection result for a single opponent slot."""
    slot_index: int
    match: Optional[MatchResult] = None
    raw_sprite: Optional[np.ndarray] = None
    sprite_mask: Optional[np.ndarray] = None


@dataclass
class DetectionResult:
    """Full detection result for a frame."""
    timestamp: float
    is_team_select: bool
    screen_confidence: float
    opponents: list[OpponentSlot] = field(default_factory=list)
    processing_ms: float = 0.0

    @property
    def identified_count(self) -> int:
        return sum(1 for o in self.opponents if o.match and o.match.is_confident)

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "is_team_select": self.is_team_select,
            "screen_confidence": self.screen_confidence,
            "processing_ms": self.processing_ms,
            "opponents": [
                {
                    "slot": o.slot_index,
                    "pokemon": o.match.display_name if o.match else None,
                    "dex": o.match.dex_number if o.match else None,
                    "confidence": round(o.match.confidence, 4) if o.match else 0,
                    "is_confident": o.match.is_confident if o.match else False,
                    "scores": {
                        "color": round(o.match.color_score, 4),
                        "template": round(o.match.template_score, 4),
                        "shape": round(o.match.shape_score, 4),
                    } if o.match else None,
                    "runner_up": o.match.runner_up if o.match else None,
                }
                for o in self.opponents
            ],
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)


class PokemonDetector:
    """Main detection pipeline orchestrator."""

    def __init__(
        self,
        db_path: str = "sprite_db.pkl",
        config: dict = None,
        log_dir: str = "detection_logs",
    ):
        self.config = config or {}
        self.log_dir = log_dir

        # Initialize sprite database
        self.db = SpriteDatabase(db_path)
        if not self.db.load():
            print(f"[WARN] No sprite database found at {db_path}")
            print(f"       Run build_db.py first to create the database.")

        # Initialize sub-systems
        self.frame_detector = FrameDetector(self.config.get("frame_detector", {}))
        self.matcher = SpriteMatcher(self.db, self.config.get("matcher", {}))

        # Detection state
        self._last_result: Optional[DetectionResult] = None
        self._match_cache: dict[int, MatchResult] = {}  # slot -> cached match
        self._cache_stable_frames = 0
        self._frame_count = 0

        # Logging
        os.makedirs(log_dir, exist_ok=True)

    def process_frame(self, frame: np.ndarray) -> DetectionResult:
        """Process a single frame and return detection results."""
        t_start = time.perf_counter()
        self._frame_count += 1

        result = DetectionResult(
            timestamp=time.time(),
            is_team_select=False,
            screen_confidence=0.0,
        )

        # Step 1: Detect team selection screen
        frame_det = self.frame_detector.detect(frame)
        result.is_team_select = frame_det.is_team_select
        result.screen_confidence = frame_det.confidence

        if not frame_det.is_team_select:
            self._invalidate_cache()
            result.processing_ms = (time.perf_counter() - t_start) * 1000
            return result

        # Step 2: Extract and match each opponent sprite
        for i, card in enumerate(frame_det.opponent_cards):
            slot = OpponentSlot(slot_index=i)

            # Extract sprite region
            card_img = card.crop_card(frame)
            sprite_img = card.crop_sprite(frame)
            mask = extract_sprite_mask(card_img)

            slot.raw_sprite = sprite_img
            slot.sprite_mask = mask

            # Check cache: if this slot's sprite hasn't changed much, reuse result
            if self._should_use_cache(i, sprite_img):
                slot.match = self._match_cache.get(i)
            else:
                # Run matcher
                matches = self.matcher.match(card_img, mask, top_k=3)
                if matches:
                    slot.match = matches[0]
                    self._match_cache[i] = matches[0]

            result.opponents.append(slot)

        result.processing_ms = (time.perf_counter() - t_start) * 1000
        self._last_result = result

        return result

    def _should_use_cache(self, slot_index: int, sprite_img: np.ndarray) -> bool:
        """Check if we can reuse cached match for this slot."""
        if slot_index not in self._match_cache:
            return False

        # Simple frame-level stability check
        # In a real implementation, compare pixel similarity to last frame's sprite
        if self._cache_stable_frames > 3:
            return True

        return False

    def _invalidate_cache(self):
        """Clear match cache when leaving team select screen."""
        self._match_cache.clear()
        self._cache_stable_frames = 0

    def log_result(self, result: DetectionResult, frame: Optional[np.ndarray] = None):
        """Log a detection result to disk."""
        ts = int(result.timestamp)
        log_file = os.path.join(self.log_dir, f"detection_{ts}.json")
        with open(log_file, "w") as f:
            f.write(result.to_json())

        if frame is not None and result.is_team_select:
            frame_file = os.path.join(self.log_dir, f"frame_{ts}.png")
            cv2.imwrite(frame_file, frame)

    def get_overlay_data(self, result: DetectionResult) -> dict:
        """
        Generate overlay data for the stream.

        Returns a dict suitable for sending to a browser overlay via WebSocket.
        """
        if not result.is_team_select:
            return {"visible": False}

        pokemon_list = []
        for opp in result.opponents:
            if opp.match and opp.match.is_confident:
                pokemon_list.append({
                    "name": opp.match.display_name,
                    "dex": opp.match.dex_number,
                    "confidence": round(opp.match.confidence * 100, 1),
                    "types": [],  # Can be populated from db
                })
            else:
                pokemon_list.append({
                    "name": "???",
                    "dex": 0,
                    "confidence": 0,
                    "types": [],
                })

        return {
            "visible": True,
            "opponent_team": pokemon_list,
            "identified": result.identified_count,
            "total": len(result.opponents),
        }
