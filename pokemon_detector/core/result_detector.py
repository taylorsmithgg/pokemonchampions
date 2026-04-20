"""
Result screen detector: identifies the post-match WIN/LOSS screen
and determines the player's outcome.

Detection signals (all validated against real screenshots):
  - Red/gold badge in left-lower area (>8% = result screen)
  - Silver text on right half (>8% = result screen)
  - Center dark divider (>45% = result screen)
  - Gold text in left center: >8% = WIN
  - Silver text in left center + no gold: LOSS
"""

import cv2
import numpy as np
from dataclasses import dataclass
from typing import Optional


@dataclass
class ResultDetection:
    """Result of analyzing a frame for match outcome."""
    is_result_screen: bool = False
    confidence: float = 0.0
    outcome: Optional[str] = None  # "win", "loss", or None
    signals: dict = None

    def __post_init__(self):
        if self.signals is None:
            self.signals = {}


class ResultDetector:
    """Detects the post-match result screen and determines WIN/LOSS."""

    def __init__(self, config: dict = None):
        self.config = config or {}

        # Thresholds (calibrated from real screenshots)
        self.badge_red_threshold = self.config.get("badge_red_threshold", 8.0)
        self.silver_text_threshold = self.config.get("silver_text_threshold", 6.0)
        self.center_dark_threshold = self.config.get("center_dark_threshold", 45.0)
        self.gold_win_threshold = self.config.get("gold_win_threshold", 6.0)

    def detect(self, frame: np.ndarray) -> ResultDetection:
        """Analyze a frame for the result screen."""
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        h_img, w_img = frame.shape[:2]

        signals = {}

        # Signal 1: Red/gold badge in the left-lower area
        badge_region = hsv[
            int(h_img * 0.65):int(h_img * 0.82),
            int(w_img * 0.15):int(w_img * 0.40),
        ]
        br_h, br_s, br_v = badge_region[:, :, 0], badge_region[:, :, 1], badge_region[:, :, 2]
        signals["badge_red"] = (
            ((br_h < 10) | (br_h > 170)) & (br_s > 120) & (br_v > 100)
        ).mean() * 100

        # Signal 2: Silver "LOST..." text on the right half
        right_text = hsv[
            int(h_img * 0.50):int(h_img * 0.70),
            int(w_img * 0.55):int(w_img * 0.90),
        ]
        rt_s, rt_v = right_text[:, :, 1], right_text[:, :, 2]
        signals["silver_right"] = (
            (rt_s < 40) & (rt_v > 140) & (rt_v < 230)
        ).mean() * 100

        # Signal 3: Dark center divider
        center = hsv[
            int(h_img * 0.3):int(h_img * 0.8),
            int(w_img * 0.48):int(w_img * 0.52),
        ]
        signals["center_dark"] = (center[:, :, 2] < 50).mean() * 100

        # Is this a result screen?
        is_result = (
            (signals["badge_red"] > self.badge_red_threshold)
            or (
                signals["silver_right"] > self.silver_text_threshold
                and signals["center_dark"] > self.center_dark_threshold
            )
        )

        if not is_result:
            return ResultDetection(is_result_screen=False, signals=signals)

        # Determine WIN vs LOSS from the left half
        left_text = hsv[
            int(h_img * 0.45):int(h_img * 0.75),
            int(w_img * 0.05):int(w_img * 0.45),
        ]
        lt_h, lt_s, lt_v = left_text[:, :, 0], left_text[:, :, 1], left_text[:, :, 2]

        signals["gold_left"] = (
            (lt_h >= 15) & (lt_h <= 40) & (lt_s > 140) & (lt_v > 170)
        ).mean() * 100

        signals["silver_left"] = (
            (lt_s < 40) & (lt_v > 140) & (lt_v < 230)
        ).mean() * 100

        if signals["gold_left"] > self.gold_win_threshold:
            outcome = "win"
        elif signals["silver_left"] > self.silver_text_threshold:
            outcome = "loss"
        else:
            outcome = None  # Uncertain

        # Confidence based on signal strength
        confidence = min(1.0, (
            min(signals["badge_red"], 20) / 20 * 0.4
            + min(signals["center_dark"], 60) / 60 * 0.3
            + (min(signals["gold_left"], 20) / 20 if outcome == "win"
               else min(signals["silver_left"], 20) / 20 if outcome == "loss"
               else 0) * 0.3
        ))

        return ResultDetection(
            is_result_screen=True,
            confidence=confidence,
            outcome=outcome,
            signals=signals,
        )
