"""
Frame detector: identifies team selection screen and extracts card regions
for BOTH the player's team (left panel, blue/green cards) and the opponent's
team (right panel, crimson cards).

Detection strategy:
  1. Detect crimson panel on right -> opponent cards
  2. Detect blue/green panel on left -> player cards
  3. Validate card count (6 per side)
  4. Extract sprite sub-regions (right side for player, left side for opponent)
"""

import cv2
import numpy as np
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CardRegion:
    """A single card with its sub-regions."""
    y_start: int
    y_end: int
    x_start: int
    x_end: int
    sprite_bbox: tuple[int, int, int, int] = (0, 0, 0, 0)  # x1, y1, x2, y2 in card coords
    is_highlighted: bool = False

    @property
    def height(self) -> int:
        return self.y_end - self.y_start

    @property
    def width(self) -> int:
        return self.x_end - self.x_start

    def crop_sprite(self, frame: np.ndarray) -> np.ndarray:
        x1, y1, x2, y2 = self.sprite_bbox
        return frame[
            self.y_start + y1 : self.y_start + y2,
            self.x_start + x1 : self.x_start + x2,
        ]

    def crop_card(self, frame: np.ndarray) -> np.ndarray:
        return frame[self.y_start:self.y_end, self.x_start:self.x_end]


@dataclass
class FrameDetection:
    """Result of analyzing a single frame."""
    is_team_select: bool = False
    confidence: float = 0.0
    opponent_cards: list[CardRegion] = field(default_factory=list)
    player_cards: list[CardRegion] = field(default_factory=list)
    opponent_panel_bounds: Optional[tuple[int, int, int, int]] = None
    player_panel_bounds: Optional[tuple[int, int, int, int]] = None


class FrameDetector:
    """Detects team selection screen and extracts card regions for both teams."""

    def __init__(self, config: dict = None):
        self.config = config or {}
        self.min_card_height_ratio = self.config.get("min_card_height_ratio", 0.05)
        self.expected_cards = 6

    def detect(self, frame: np.ndarray) -> FrameDetection:
        h, w = frame.shape[:2]
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        result = FrameDetection()

        # Detect opponent panel (right side, crimson)
        opp_cards, opp_bounds = self._detect_panel(
            hsv, frame, w, h,
            scan_x_start=0.65, scan_x_end=1.0,
            color_fn=self._crimson_mask,
            sprite_side="left",
        )

        # Detect player panel (left side, blue + green)
        player_cards, player_bounds = self._detect_panel(
            hsv, frame, w, h,
            scan_x_start=0.0, scan_x_end=0.40,
            color_fn=self._blue_green_mask,
            sprite_side="right",
        )

        # Need at least the opponent panel to confirm team select
        if len(opp_cards) < 5:
            return result

        result.is_team_select = True
        result.opponent_cards = opp_cards
        result.opponent_panel_bounds = opp_bounds
        result.player_cards = player_cards
        result.player_panel_bounds = player_bounds
        result.confidence = self._compute_confidence(opp_cards, player_cards, w, h)

        return result

    def _detect_panel(
        self,
        hsv: np.ndarray,
        frame: np.ndarray,
        w: int,
        h: int,
        scan_x_start: float,
        scan_x_end: float,
        color_fn,
        sprite_side: str,
    ) -> tuple[list[CardRegion], Optional[tuple]]:
        """Detect a card panel in a horizontal region of the frame."""

        x_lo = int(w * scan_x_start)
        x_hi = int(w * scan_x_end)

        # Create color mask for the scan region
        region_hsv = hsv[:, x_lo:x_hi]
        mask = color_fn(region_hsv)

        # Clean up
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

        # Find card row boundaries
        row_density = mask.mean(axis=1) / 255.0
        raw_cards = self._find_card_boundaries(row_density, h)

        if not raw_cards:
            return [], None

        # Filter to actual Pokemon cards (drop header/footer by height consistency)
        raw_cards = self._filter_to_pokemon_cards(raw_cards, h)

        if len(raw_cards) < 5 or len(raw_cards) > 7:
            return [], None

        # Find x boundaries from column density across card rows
        col_density = np.zeros(x_hi - x_lo)
        for y1, y2 in raw_cards:
            region_mask_slice = mask[y1:y2, :]
            col_density += region_mask_slice.mean(axis=0) / 255.0

        bright_cols = np.where(col_density > 0.5)[0]
        if len(bright_cols) < 10:
            return [], None

        panel_x_start = x_lo + int(bright_cols[0])
        panel_x_end = x_lo + int(bright_cols[-1])
        card_width = panel_x_end - panel_x_start

        # Build card regions with sprite sub-regions
        cards = []
        for y_start, y_end in raw_cards:
            card_h = y_end - y_start
            pad_x = int(card_width * 0.02)
            pad_y = int(card_h * 0.05)

            if sprite_side == "left":
                # Opponent: sprite on the left ~55% of card
                sprite_bbox = (pad_x, pad_y, int(card_width * 0.55), card_h - pad_y)
            else:
                # Player: sprite on the right ~35% of card
                sprite_x_start = int(card_width * 0.65)
                sprite_bbox = (sprite_x_start, pad_y, card_width - pad_x, card_h - pad_y)

            # Check if this card is highlighted (green on player side)
            is_highlighted = False
            if sprite_side == "right":
                card_hsv = hsv[y_start:y_end, panel_x_start:panel_x_end]
                h_ch = card_hsv[:, :, 0]
                s_ch = card_hsv[:, :, 1]
                green_pct = ((h_ch > 25) & (h_ch < 50) & (s_ch > 80)).mean()
                is_highlighted = green_pct > 0.15

            cards.append(CardRegion(
                y_start=y_start,
                y_end=y_end,
                x_start=panel_x_start,
                x_end=panel_x_end,
                sprite_bbox=sprite_bbox,
                is_highlighted=is_highlighted,
            ))

        bounds = (panel_x_start, raw_cards[0][0], panel_x_end, raw_cards[-1][1])
        return cards, bounds

    def _crimson_mask(self, hsv_region: np.ndarray) -> np.ndarray:
        """Mask for opponent crimson/magenta cards. H~155-179, high S."""
        h, s, v = hsv_region[:, :, 0], hsv_region[:, :, 1], hsv_region[:, :, 2]
        mask = (h >= 155) & (h <= 179) & (s >= 80) & (v >= 25) & (v <= 160)
        return mask.astype(np.uint8) * 255

    def _blue_green_mask(self, hsv_region: np.ndarray) -> np.ndarray:
        """Mask for player cards: blue (H~115-135) OR green highlighted (H~25-50)."""
        h, s, v = hsv_region[:, :, 0], hsv_region[:, :, 1], hsv_region[:, :, 2]
        blue = (h >= 115) & (h <= 135) & (s >= 50) & (v >= 55)
        green = (h >= 25) & (h <= 50) & (s >= 80) & (v >= 150)
        mask = blue | green
        return mask.astype(np.uint8) * 255

    def _find_card_boundaries(self, row_density: np.ndarray, frame_height: int) -> list[tuple[int, int]]:
        """Find card boundaries using valley detection in the density signal.
        
        The left panel cards (blue) have very thin gaps that don't always drop
        below a fixed threshold, so we detect local minima (valleys) instead.
        """
        min_card_h = int(frame_height * self.min_card_height_ratio)

        # Smooth the density curve
        window = 7
        smoothed = np.convolve(row_density, np.ones(window) / window, mode="same")

        # Find valleys: local minima where density drops significantly from neighbors
        valleys = []
        search_radius = 15
        for y in range(search_radius, len(smoothed) - search_radius):
            local_slice = smoothed[y - search_radius : y + search_radius + 1]
            if smoothed[y] > local_slice.min() + 0.01:
                continue
            # Measure drop from surrounding peaks
            left_peak = smoothed[max(0, y - 50) : y].max() if y > 0 else 0
            right_peak = smoothed[y : min(len(smoothed), y + 50)].max()
            drop = min(left_peak, right_peak) - smoothed[y]
            if drop > 0.12:
                valleys.append((y, drop))

        # Deduplicate nearby valleys (keep the deeper one)
        deduped = []
        min_gap = max(40, min_card_h)
        for y, drop in valleys:
            if not deduped or y - deduped[-1][0] > min_gap:
                deduped.append((y, drop))
            elif drop > deduped[-1][1]:
                deduped[-1] = (y, drop)

        # Build cards from valleys
        edges = [0] + [y for y, _ in deduped] + [len(smoothed)]
        cards = []
        for i in range(len(edges) - 1):
            s, e = edges[i], edges[i + 1]
            if (e - s) > min_card_h:
                cards.append((s, e))

        # Fallback: if valley detection found too few, try threshold crossing
        if len(cards) < 4:
            cards = self._find_cards_threshold(row_density, frame_height)

        return cards

    def _find_cards_threshold(self, row_density: np.ndarray, frame_height: int) -> list[tuple[int, int]]:
        """Fallback: find cards using fixed threshold crossing."""
        min_card_h = int(frame_height * self.min_card_height_ratio)
        threshold = 0.12
        in_card = False
        raw_cards = []
        start = 0

        for y in range(len(row_density)):
            if not in_card and row_density[y] > threshold:
                start = y
                in_card = True
            elif in_card and row_density[y] < threshold:
                if (y - start) > min_card_h:
                    raw_cards.append((start, y))
                in_card = False

        if in_card and (len(row_density) - start) > min_card_h:
            raw_cards.append((start, len(row_density)))

        if not raw_cards:
            return raw_cards

        # Split oversized merged cards
        heights = [e - s for s, e in raw_cards]
        median_h = np.median(heights)
        cards = []
        for s, e in raw_cards:
            card_h = e - s
            if card_h > median_h * 1.6:
                n = round(card_h / median_h)
                sub_h = card_h / n
                for j in range(n):
                    cards.append((int(s + j * sub_h), int(s + (j + 1) * sub_h)))
            else:
                cards.append((s, e))

        return cards

    def _filter_to_pokemon_cards(self, cards: list[tuple], frame_height: int) -> list[tuple]:
        """Remove header/footer cards, keeping the 6 Pokemon cards.
        
        Strategy: the header is at the top and the footer at the bottom.
        Pokemon cards cluster together in the middle with consistent heights.
        When we have more than 6, drop from the edges first.
        """
        if len(cards) <= 6:
            return cards

        # Score each card: prefer middle-of-frame cards with consistent heights
        heights = [e - s for s, e in cards]
        median_h = np.median(heights)

        scored = []
        for i, (s, e) in enumerate(cards):
            h = e - s
            # Penalize height deviation from median
            height_penalty = abs(h - median_h) / median_h

            # Penalize cards at the very top or bottom of frame
            center_y = (s + e) / 2 / frame_height
            edge_penalty = 0.0
            if center_y < 0.10 or center_y > 0.92:
                edge_penalty = 0.5
            elif center_y < 0.15 or center_y > 0.88:
                edge_penalty = 0.2

            score = height_penalty + edge_penalty
            scored.append((score, i))

        # Sort by score (lowest = most likely a Pokemon card)
        scored.sort()

        # Keep the best 6
        keep_indices = set(idx for _, idx in scored[:6])
        return [cards[i] for i in range(len(cards)) if i in keep_indices]

    def _compute_confidence(
        self,
        opp_cards: list[CardRegion],
        player_cards: list[CardRegion],
        w: int,
        h: int,
    ) -> float:
        score = 0.0

        if len(opp_cards) == 6:
            score += 0.3
        elif len(opp_cards) >= 5:
            score += 0.2

        if len(player_cards) == 6:
            score += 0.3
        elif len(player_cards) >= 5:
            score += 0.2

        if opp_cards:
            heights = [c.height for c in opp_cards]
            cv_h = np.std(heights) / np.mean(heights) if np.mean(heights) > 0 else 1.0
            if cv_h < 0.15:
                score += 0.2

        if len(opp_cards) >= 5 and len(player_cards) >= 5:
            score += 0.2

        return min(score, 1.0)
