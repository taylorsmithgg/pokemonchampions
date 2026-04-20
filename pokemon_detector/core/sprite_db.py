"""
Sprite database: stores pre-computed feature signatures for all Pokemon.

Supports two modes:
  1. External sprites (PokeAPI official-artwork) - good starting point
  2. Calibrated sprites (captured from actual game) - best accuracy

Each entry stores:
  - Pokdex number and name
  - Types (for filtering)
  - Color histogram (HSV hue-sat, 30x32 bins)
  - Template image at multiple scales
  - Hu moments for shape matching
  - pHash for fast pre-filtering
"""

import cv2
import numpy as np
import json
import os
import pickle
from pathlib import Path
from typing import Optional


class SpriteSignature:
    """Pre-computed matching signature for a single Pokemon sprite."""

    __slots__ = [
        "dex_number", "name", "form", "types", "panel_type",
        "hist_hs", "hist_v", "hu_moments",
        "template_gray", "template_color",
        "phash_bits", "sprite_mask",
    ]

    def __init__(self, dex_number: int, name: str, form: str = "default", types: list = None, panel_type: str = ""):
        self.dex_number = dex_number
        self.name = name
        self.form = form
        self.types = types or []
        self.panel_type = panel_type  # "opponent" or "player" or ""
        self.hist_hs = None
        self.hist_v = None
        self.hu_moments = None
        self.template_gray = None
        self.template_color = None
        self.phash_bits = None
        self.sprite_mask = None

    def compute_from_image(self, bgr_img: np.ndarray, mask: Optional[np.ndarray] = None):
        """Compute all feature signatures from a sprite image."""
        if mask is None:
            gray = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2GRAY)
            mask = np.uint8(gray > 15) * 255

        self.sprite_mask = mask
        self.template_gray = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2GRAY)
        self.template_color = bgr_img.copy()

        # Color histogram in HSV
        hsv = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2HSV)
        self.hist_hs = cv2.calcHist([hsv], [0, 1], mask, [30, 32], [0, 180, 0, 256])
        cv2.normalize(self.hist_hs, self.hist_hs, 0, 1, cv2.NORM_MINMAX)
        self.hist_v = cv2.calcHist([hsv], [2], mask, [32], [0, 256])
        cv2.normalize(self.hist_v, self.hist_v, 0, 1, cv2.NORM_MINMAX)

        # Hu moments from largest contour
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            biggest = max(contours, key=cv2.contourArea)
            moments = cv2.moments(biggest)
            self.hu_moments = cv2.HuMoments(moments).flatten()
        else:
            self.hu_moments = np.zeros(7)

        # Simple perceptual hash (64-bit)
        resized = cv2.resize(self.template_gray, (8, 8), interpolation=cv2.INTER_AREA)
        mean_val = resized.mean()
        self.phash_bits = (resized > mean_val).flatten().astype(np.uint8)

    @property
    def display_name(self) -> str:
        if self.form and self.form != "default":
            return f"{self.name} ({self.form})"
        return self.name


class SpriteDatabase:
    """Manages the collection of Pokemon sprite signatures."""

    def __init__(self, db_path: str = "sprite_db.pkl"):
        self.db_path = db_path
        self.entries: dict[str, SpriteSignature] = {}  # key: "dex_form"
        self._type_index: dict[str, set] = {}  # type -> set of keys

    def add(self, sig: SpriteSignature):
        suffix = f"_{sig.panel_type}" if sig.panel_type else ""
        key = f"{sig.dex_number}_{sig.form}{suffix}"
        self.entries[key] = sig
        for t in sig.types:
            if t not in self._type_index:
                self._type_index[t] = set()
            self._type_index[t].add(key)

    def get_by_types(self, types: list[str]) -> list[SpriteSignature]:
        """Filter candidates by type combination."""
        if not types:
            return list(self.entries.values())

        candidates = None
        for t in types:
            keys = self._type_index.get(t.lower(), set())
            if candidates is None:
                candidates = keys.copy()
            else:
                candidates &= keys

        if candidates is None:
            return list(self.entries.values())
        return [self.entries[k] for k in candidates]

    def get_all(self) -> list[SpriteSignature]:
        return list(self.entries.values())

    def save(self):
        with open(self.db_path, "wb") as f:
            pickle.dump(self.entries, f)

    def load(self) -> bool:
        if os.path.exists(self.db_path):
            with open(self.db_path, "rb") as f:
                self.entries = pickle.load(f)
            self._rebuild_type_index()
            return True
        return False

    def _rebuild_type_index(self):
        self._type_index.clear()
        for key, sig in self.entries.items():
            for t in sig.types:
                if t not in self._type_index:
                    self._type_index[t] = set()
                self._type_index[t].add(key)

    def __len__(self):
        return len(self.entries)

    @staticmethod
    def build_from_directory(sprites_dir: str, pokemon_data: dict, db_path: str = "sprite_db.pkl") -> "SpriteDatabase":
        """
        Build database from a directory of sprite images.

        sprites_dir: directory containing PNG files named like "001.png" or "001_mega.png"
        pokemon_data: dict mapping dex number to {"name": str, "types": [str], "forms": {form: filename}}
        """
        db = SpriteDatabase(db_path)

        for dex_str, info in pokemon_data.items():
            dex = int(dex_str)
            name = info["name"]
            types = info.get("types", [])

            # Default form
            default_file = os.path.join(sprites_dir, f"{dex:04d}.png")
            if os.path.exists(default_file):
                img = cv2.imread(default_file, cv2.IMREAD_UNCHANGED)
                if img is not None:
                    bgr, mask = _split_alpha(img)
                    sig = SpriteSignature(dex, name, "default", types)
                    sig.compute_from_image(bgr, mask)
                    db.add(sig)

            # Alternate forms
            for form_name, form_file in info.get("forms", {}).items():
                form_path = os.path.join(sprites_dir, form_file)
                if os.path.exists(form_path):
                    img = cv2.imread(form_path, cv2.IMREAD_UNCHANGED)
                    if img is not None:
                        bgr, mask = _split_alpha(img)
                        form_types = info.get("form_types", {}).get(form_name, types)
                        sig = SpriteSignature(dex, name, form_name, form_types)
                        sig.compute_from_image(bgr, mask)
                        db.add(sig)

        db.save()
        return db


def _split_alpha(img: np.ndarray):
    """Split BGRA image into BGR + mask, handling both 3 and 4 channel images."""
    if img.shape[2] == 4:
        bgr = img[:, :, :3]
        mask = img[:, :, 3]
        # Threshold alpha to binary mask
        _, mask = cv2.threshold(mask, 10, 255, cv2.THRESH_BINARY)
        return bgr, mask
    else:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        mask = np.uint8(gray > 15) * 255
        return img, mask
