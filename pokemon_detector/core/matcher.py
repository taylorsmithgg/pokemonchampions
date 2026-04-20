"""
Multi-signal matcher: identifies Pokemon from extracted card sprites
by combining color histogram, template matching, and shape analysis.

The matcher supports:
  - Type-based pre-filtering (if type icons are detected)
  - Fast pHash pre-filter to skip obviously wrong candidates
  - Weighted multi-signal scoring
  - Confidence thresholds for accepting matches
"""

import cv2
import numpy as np
from dataclasses import dataclass
from typing import Optional

from .sprite_db import SpriteDatabase, SpriteSignature


@dataclass
class MatchResult:
    """Result of matching a single sprite."""
    dex_number: int
    name: str
    form: str
    confidence: float
    color_score: float
    template_score: float
    shape_score: float
    runner_up: Optional[str] = None
    runner_up_confidence: float = 0.0

    @property
    def display_name(self) -> str:
        if self.form and self.form != "default":
            return f"{self.name} ({self.form})"
        return self.name

    @property
    def is_confident(self) -> bool:
        """True if the match is confident enough to trust."""
        return (
            self.confidence > 0.35
            and (self.confidence - self.runner_up_confidence) > 0.05
        )


class SpriteMatcher:
    """Matches extracted sprites against the database using multi-signal scoring."""

    def __init__(self, db: SpriteDatabase, config: dict = None):
        self.db = db
        self.config = config or {}

        # Scoring weights
        self.w_color = self.config.get("weight_color", 0.45)
        self.w_template = self.config.get("weight_template", 0.35)
        self.w_shape = self.config.get("weight_shape", 0.20)

        # Template matching scale range
        self.scale_min = self.config.get("scale_min", 0.3)
        self.scale_max = self.config.get("scale_max", 3.5)
        self.scale_step = self.config.get("scale_step", 0.2)

        # pHash pre-filter threshold (Hamming distance, max 64)
        self.phash_threshold = self.config.get("phash_threshold", 40)

    def match(
        self,
        sprite_bgr: np.ndarray,
        sprite_mask: np.ndarray,
        type_filter: Optional[list[str]] = None,
        top_k: int = 5,
    ) -> list[MatchResult]:
        """
        Match a sprite against the database.

        Args:
            sprite_bgr: BGR image of the extracted sprite region
            sprite_mask: Binary mask isolating the sprite from background
            type_filter: Optional list of types to narrow candidates
            top_k: Number of top matches to return
        """
        # Get candidates (optionally filtered by type)
        if type_filter:
            candidates = self.db.get_by_types(type_filter)
        else:
            candidates = self.db.get_all()

        if not candidates:
            return []

        # Pre-compute query features
        query_hist_hs = self._compute_hist_hs(sprite_bgr, sprite_mask)
        query_gray = cv2.cvtColor(sprite_bgr, cv2.COLOR_BGR2GRAY)
        query_contour = self._get_largest_contour(sprite_mask)
        query_phash = self._compute_phash(query_gray)

        # Score each candidate
        scored = []
        for sig in candidates:
            if sig.hist_hs is None:
                continue

            # Fast pre-filter with pHash
            if query_phash is not None and sig.phash_bits is not None:
                hamming = np.sum(query_phash != sig.phash_bits)
                if hamming > self.phash_threshold:
                    continue

            # Color histogram score
            color_score = self._score_color(query_hist_hs, sig.hist_hs)

            # Template matching score
            template_score = self._score_template(query_gray, sig.template_gray, sprite_bgr.shape[:2])

            # Shape score
            shape_score = self._score_shape(query_contour, sig)

            # Weighted combination
            combined = (
                color_score * self.w_color
                + template_score * self.w_template
                + shape_score * self.w_shape
            )

            scored.append((sig, combined, color_score, template_score, shape_score))

        # Sort by combined score descending
        scored.sort(key=lambda x: x[1], reverse=True)

        # Build results
        results = []
        for rank, (sig, combined, color, template, shape) in enumerate(scored[:top_k]):
            runner_up_name = None
            runner_up_conf = 0.0
            if rank == 0 and len(scored) > 1:
                runner_up_name = scored[1][0].display_name
                runner_up_conf = scored[1][1]

            results.append(
                MatchResult(
                    dex_number=sig.dex_number,
                    name=sig.name,
                    form=sig.form,
                    confidence=combined,
                    color_score=color,
                    template_score=template,
                    shape_score=shape,
                    runner_up=runner_up_name,
                    runner_up_confidence=runner_up_conf,
                )
            )

        return results

    def _compute_hist_hs(self, bgr: np.ndarray, mask: np.ndarray) -> np.ndarray:
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0, 1], mask, [30, 32], [0, 180, 0, 256])
        cv2.normalize(hist, hist, 0, 1, cv2.NORM_MINMAX)
        return hist

    def _compute_phash(self, gray: np.ndarray) -> Optional[np.ndarray]:
        resized = cv2.resize(gray, (8, 8), interpolation=cv2.INTER_AREA)
        mean_val = resized.mean()
        return (resized > mean_val).flatten().astype(np.uint8)

    def _get_largest_contour(self, mask: np.ndarray):
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            return max(contours, key=cv2.contourArea)
        return None

    def _score_color(self, query_hist: np.ndarray, ref_hist: np.ndarray) -> float:
        """Color histogram similarity. Returns 0-1, higher is better."""
        bhatt = cv2.compareHist(query_hist, ref_hist, cv2.HISTCMP_BHATTACHARYYA)
        return max(0.0, 1.0 - bhatt)

    def _score_template(
        self, query_gray: np.ndarray, ref_gray: np.ndarray, query_shape: tuple
    ) -> float:
        """Multi-scale template matching. Returns 0-1, higher is better."""
        if ref_gray is None:
            return 0.0

        best = -1.0
        qh, qw = query_shape[:2]

        for scale in np.arange(self.scale_min, self.scale_max, self.scale_step):
            nw = int(ref_gray.shape[1] * scale)
            nh = int(ref_gray.shape[0] * scale)

            if nw >= qw or nh >= qh or nw < 8 or nh < 8:
                continue

            resized = cv2.resize(ref_gray, (nw, nh))
            result = cv2.matchTemplate(query_gray, resized, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, _ = cv2.minMaxLoc(result)
            best = max(best, max_val)

        return max(0.0, best)

    def _score_shape(self, query_contour, sig: SpriteSignature) -> float:
        """Shape similarity via Hu moments. Returns 0-1, higher is better."""
        if query_contour is None or sig.hu_moments is None:
            return 0.0

        if sig.sprite_mask is not None:
            ref_contours, _ = cv2.findContours(
                sig.sprite_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            if ref_contours:
                ref_contour = max(ref_contours, key=cv2.contourArea)
                hu_dist = cv2.matchShapes(query_contour, ref_contour, cv2.CONTOURS_MATCH_I2, 0)
                return 1.0 / (1.0 + hu_dist)

        return 0.0


def extract_sprite_mask(card_bgr: np.ndarray, panel_type: str = "opponent") -> np.ndarray:
    """
    Create a binary mask isolating the sprite from the card background.

    panel_type:
        "opponent" - crimson/magenta cards (right panel)
        "player"   - blue or green/highlighted cards (left panel)
    """
    hsv = cv2.cvtColor(card_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]

    if panel_type == "opponent":
        # Crimson background: H wraps around 0/180, dark magenta
        bg_card = ((h > 140) | (h < 12)) & (s > 35) & (v > 15) & (v < 155)
    else:
        # Blue background: H~115-135, medium-high S
        bg_blue = (h >= 110) & (h <= 140) & (s >= 40) & (v >= 40)
        # Green highlighted: H~25-50, high S, bright
        bg_green = (h >= 20) & (h <= 55) & (s >= 60) & (v >= 120)
        bg_card = bg_blue | bg_green

    # Very dark pixels (borders, shadows)
    bg_dark = v < 20

    # Combine backgrounds
    bg_mask = bg_card | bg_dark

    # Sprite is everything NOT background
    sprite_mask = (~bg_mask).astype(np.uint8) * 255

    # Morphological cleanup
    kernel = np.ones((3, 3), np.uint8)
    sprite_mask = cv2.morphologyEx(sprite_mask, cv2.MORPH_OPEN, kernel)
    sprite_mask = cv2.morphologyEx(sprite_mask, cv2.MORPH_CLOSE, kernel)

    # Remove small noise blobs
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(sprite_mask, connectivity=8)
    min_area = sprite_mask.shape[0] * sprite_mask.shape[1] * 0.005
    for label in range(1, num_labels):
        if stats[label, cv2.CC_STAT_AREA] < min_area:
            sprite_mask[labels == label] = 0

    return sprite_mask
