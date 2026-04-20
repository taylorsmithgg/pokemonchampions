#!/usr/bin/env python3
"""
Build the sprite database from PokeAPI official artwork.

Downloads official artwork sprites for all Pokemon (including forms)
and pre-computes matching signatures.

Usage:
    python build_db.py                    # Build from PokeAPI (requires internet)
    python build_db.py --from-dir ./sprites  # Build from local directory
    python build_db.py --calibrate screenshot.png  # Add calibrated sprites from game capture

The PokeAPI sprites use the same official artwork rendered in Scarlet/Violet's
team selection screen, making them good reference images.
"""

import argparse
import cv2
import json
import numpy as np
import os
import sys
import time
import urllib.request
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core.sprite_db import SpriteDatabase, SpriteSignature, _split_alpha


POKEAPI_SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork"
POKEAPI_DATA_URL = "https://pokeapi.co/api/v2/pokemon"

# Scarlet/Violet Pokedex (National Dex numbers available in the game)
# This covers all Pokemon that can appear in Ranked Battles
# Updated for Regulation H / current meta
SV_POKEMON = None  # Will be loaded from pokemon_data.json if available


def download_sprite(dex_number: int, output_dir: str, form: str = "default") -> str | None:
    """Download a single sprite from PokeAPI."""
    if form == "default":
        url = f"{POKEAPI_SPRITE_BASE}/{dex_number}.png"
        filename = f"{dex_number:04d}.png"
    else:
        url = f"{POKEAPI_SPRITE_BASE}/{dex_number}.png"  # Forms need special handling
        filename = f"{dex_number:04d}_{form}.png"

    output_path = os.path.join(output_dir, filename)
    if os.path.exists(output_path):
        return output_path

    try:
        urllib.request.urlretrieve(url, output_path)
        return output_path
    except Exception as e:
        print(f"  [SKIP] #{dex_number} {form}: {e}")
        return None


def load_pokemon_data(data_file: str = "pokemon_data.json") -> dict:
    """
    Load Pokemon metadata (names, types, forms).

    Expected format:
    {
        "1": {"name": "Bulbasaur", "types": ["grass", "poison"]},
        "6": {
            "name": "Charizard",
            "types": ["fire", "flying"],
            "forms": {"mega-x": "0006_mega-x.png", "mega-y": "0006_mega-y.png"},
            "form_types": {"mega-x": ["fire", "dragon"]}
        },
        ...
    }
    """
    if os.path.exists(data_file):
        with open(data_file) as f:
            return json.load(f)

    # Generate minimal data for Gen 1-9 (just names and dex numbers)
    # In production, this should be a complete data file
    print(f"[INFO] No {data_file} found. Generating minimal metadata...")
    print(f"       For best results, create {data_file} with full type data.")
    return {}


def build_from_pokeapi(output_dir: str, db_path: str, dex_range: tuple = (1, 1025)):
    """Download sprites from PokeAPI and build database."""
    os.makedirs(output_dir, exist_ok=True)

    pokemon_data = load_pokemon_data()
    db = SpriteDatabase(db_path)

    start, end = dex_range
    total = end - start + 1
    success = 0
    errors = 0

    print(f"Building sprite database for #{start}-#{end} ({total} Pokemon)")
    print(f"Downloading to: {output_dir}")
    print(f"Database path: {db_path}\n")

    for dex in range(start, end + 1):
        sprite_path = download_sprite(dex, output_dir)
        if sprite_path is None:
            errors += 1
            continue

        img = cv2.imread(sprite_path, cv2.IMREAD_UNCHANGED)
        if img is None:
            errors += 1
            continue

        bgr, mask = _split_alpha(img)

        info = pokemon_data.get(str(dex), {})
        name = info.get("name", f"Pokemon_{dex}")
        types = info.get("types", [])

        sig = SpriteSignature(dex, name, "default", types)
        sig.compute_from_image(bgr, mask)
        db.add(sig)

        success += 1
        if success % 50 == 0:
            print(f"  Processed {success}/{total}...")

        # Rate limit to be nice to the API
        time.sleep(0.1)

    db.save()
    print(f"\nDone! {success} sprites indexed, {errors} errors.")
    print(f"Database saved to {db_path} ({len(db)} entries)")


def build_from_directory(sprites_dir: str, db_path: str):
    """Build database from a local directory of sprite PNGs."""
    pokemon_data = load_pokemon_data()

    if not pokemon_data:
        # Auto-detect from filenames
        print(f"[INFO] Auto-detecting Pokemon from filenames in {sprites_dir}")
        for f in sorted(Path(sprites_dir).glob("*.png")):
            stem = f.stem
            try:
                dex = int(stem.split("_")[0])
                form = "_".join(stem.split("_")[1:]) or "default"
                if str(dex) not in pokemon_data:
                    pokemon_data[str(dex)] = {
                        "name": f"Pokemon_{dex}",
                        "types": [],
                        "forms": {},
                    }
                if form != "default":
                    pokemon_data[str(dex)]["forms"][form] = f.name
            except ValueError:
                continue

    db = SpriteDatabase.build_from_directory(sprites_dir, pokemon_data, db_path)
    print(f"Database built: {len(db)} entries saved to {db_path}")


def calibrate_from_screenshot(screenshot_path: str, db_path: str, known_pokemon: list[dict]):
    """
    Add calibrated sprites from an actual game screenshot.

    known_pokemon is a list like:
    [
        {"slot": 0, "dex": 71, "name": "Victreebel", "types": ["grass", "poison"]},
        {"slot": 1, "dex": 733, "name": "Toucannon", "types": ["normal", "flying"]},
        ...
    ]

    This captures sprites exactly as they appear in-game, providing the best
    possible reference for matching.
    """
    from core.frame_detector import FrameDetector
    from core.matcher import extract_sprite_mask

    db = SpriteDatabase(db_path)
    db.load()

    frame = cv2.imread(screenshot_path)
    if frame is None:
        print(f"Error: Cannot read {screenshot_path}")
        return

    detector = FrameDetector()
    detection = detector.detect(frame)

    if not detection.is_team_select:
        print("Error: No team selection screen detected in screenshot")
        return

    for info in known_pokemon:
        slot = info["slot"]
        if slot >= len(detection.opponent_cards):
            print(f"  [SKIP] Slot {slot} out of range")
            continue

        card = detection.opponent_cards[slot]
        card_img = card.crop_card(frame)
        mask = extract_sprite_mask(card_img)

        sig = SpriteSignature(
            dex_number=info["dex"],
            name=info["name"],
            form=info.get("form", "default"),
            types=info.get("types", []),
        )
        sig.compute_from_image(card_img, mask)
        db.add(sig)
        print(f"  Added calibrated sprite: #{info['dex']} {info['name']} (slot {slot})")

    db.save()
    print(f"\nDatabase updated: {len(db)} total entries")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build Pokemon sprite database")
    parser.add_argument("--from-dir", help="Build from local sprite directory")
    parser.add_argument("--calibrate", help="Calibrate from game screenshot")
    parser.add_argument("--db", default="sprite_db.pkl", help="Database output path")
    parser.add_argument("--sprites-dir", default="sprites", help="Sprite download directory")
    parser.add_argument("--range", default="1-1025", help="Dex range (e.g., 1-151)")

    args = parser.parse_args()

    if args.from_dir:
        build_from_directory(args.from_dir, args.db)
    elif args.calibrate:
        # Example: calibrate with known Pokemon
        print("Calibration mode: provide known Pokemon data as JSON")
        print('Example: [{"slot": 0, "dex": 71, "name": "Victreebel", "types": ["grass", "poison"]}]')
        data_input = input("Enter JSON (or path to JSON file): ").strip()
        if os.path.exists(data_input):
            with open(data_input) as f:
                known = json.load(f)
        else:
            known = json.loads(data_input)
        calibrate_from_screenshot(args.calibrate, args.db, known)
    else:
        start, end = map(int, args.range.split("-"))
        build_from_pokeapi(args.sprites_dir, args.db, (start, end))
