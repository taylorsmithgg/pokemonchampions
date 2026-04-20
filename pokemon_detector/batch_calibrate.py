#!/usr/bin/env python3
"""
Batch calibration tool: rapidly build the sprite database from game screenshots.

Processes a folder of team selection screenshots, extracts opponent sprites,
and lets you label each one. Supports:
  - Auto-suggest if database already has similar sprites
  - Fuzzy name search against pokemon_data.json
  - Skip already-calibrated Pokemon
  - Resume from where you left off

Usage:
    python batch_calibrate.py ./screenshots
    python batch_calibrate.py ./screenshots --db calibrated.pkl
    python batch_calibrate.py --single screenshot.png
"""

import argparse
import cv2
import json
import numpy as np
import os
import sys
from pathlib import Path
from difflib import get_close_matches

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core.frame_detector import FrameDetector
from core.matcher import SpriteMatcher, extract_sprite_mask
from core.sprite_db import SpriteDatabase, SpriteSignature


def load_pokemon_lookup(data_file: str = "pokemon_data.json") -> dict:
    """Load Pokemon data and build lookup indices."""
    if not os.path.exists(data_file):
        print(f"[WARN] {data_file} not found. Name search disabled.")
        return {"by_name": {}, "by_dex": {}, "names": []}

    with open(data_file) as f:
        data = json.load(f)

    by_name = {}
    by_dex = {}
    names = []

    for dex_str, info in data.items():
        dex = int(dex_str)
        name = info["name"].lower()
        by_name[name] = {"dex": dex, **info}
        by_dex[dex] = info
        names.append(info["name"])

    return {"by_name": by_name, "by_dex": by_dex, "names": names, "raw": data}


def fuzzy_search(query: str, lookup: dict, max_results: int = 5) -> list:
    """Fuzzy search for Pokemon by name."""
    query = query.lower().strip()

    # Exact match
    if query in lookup["by_name"]:
        info = lookup["by_name"][query]
        return [{"dex": info["dex"], "name": info["name"], "types": info["types"]}]

    # Prefix match
    prefix_matches = [
        {"dex": lookup["by_name"][n.lower()]["dex"], "name": n, "types": lookup["by_name"][n.lower()]["types"]}
        for n in lookup["names"]
        if n.lower().startswith(query)
    ]
    if prefix_matches:
        return prefix_matches[:max_results]

    # Fuzzy match
    close = get_close_matches(query, [n.lower() for n in lookup["names"]], n=max_results, cutoff=0.4)
    return [
        {"dex": lookup["by_name"][n]["dex"], "name": lookup["by_name"][n]["name"], "types": lookup["by_name"][n]["types"]}
        for n in close
    ]


def display_sprite_ascii(card_img: np.ndarray, width: int = 40):
    """Rough ASCII preview of a sprite for terminal display."""
    h, w_orig = card_img.shape[:2]
    aspect = w_orig / h
    new_h = int(width / aspect / 2)

    small = cv2.resize(card_img, (width, new_h))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

    chars = " .:-=+*#%@"
    lines = []
    for row in gray:
        line = ""
        for pixel in row:
            idx = int(pixel / 256 * len(chars))
            idx = min(idx, len(chars) - 1)
            line += chars[idx]
        lines.append(line)

    return "\n".join(lines)


def process_screenshot(
    screenshot_path: str,
    db: SpriteDatabase,
    matcher: SpriteMatcher,
    detector: FrameDetector,
    lookup: dict,
    auto_confirm: bool = False,
) -> int:
    """Process a single screenshot and calibrate sprites. Returns count of new entries."""
    frame = cv2.imread(screenshot_path)
    if frame is None:
        print(f"  [ERR] Cannot read {screenshot_path}")
        return 0

    detection = detector.detect(frame)
    if not detection.is_team_select:
        print(f"  [SKIP] No team selection screen detected")
        return 0

    print(f"  Detected {len(detection.opponent_cards)} opponent cards")
    calibrated = 0

    for i, card in enumerate(detection.opponent_cards):
        card_img = card.crop_card(frame)
        mask = extract_sprite_mask(card_img)

        # Try existing database first
        suggestion = None
        if len(db) > 0:
            matches = matcher.match(card_img, mask, top_k=3)
            if matches and matches[0].confidence > 0.6:
                suggestion = matches[0]

        print(f"\n  --- Slot {i} ---")
        if suggestion and suggestion.is_confident:
            print(f"  Auto-detected: {suggestion.display_name} (confidence: {suggestion.confidence:.2%})")
            if auto_confirm:
                print(f"  [AUTO] Confirmed")
                continue
            confirm = input(f"  Correct? (y/n/name): ").strip()
            if confirm.lower() in ("y", "yes", ""):
                # Already in DB with good confidence, skip
                continue
            elif confirm.lower() in ("n", "no"):
                pass  # Fall through to manual input
            else:
                # User typed a different name
                results = fuzzy_search(confirm, lookup)
                if results:
                    suggestion = None  # Override
                    result_strs = [f"{r['name']} (#{r['dex']})" for r in results]
                    print(f"  Matches: {', '.join(result_strs)}")
                    pick = input(f"  Pick number (1-{len(results)}) or name: ").strip()
                    try:
                        idx = int(pick) - 1
                        chosen = results[idx]
                    except (ValueError, IndexError):
                        chosen = results[0]

                    sig = SpriteSignature(chosen["dex"], chosen["name"], "default", chosen["types"], panel_type="opponent")
                    sig.compute_from_image(card_img, mask)
                    db.add(sig)
                    calibrated += 1
                    print(f"  Saved: #{chosen['dex']} {chosen['name']}")
                    continue

        # No suggestion or rejected, manual input
        print(display_sprite_ascii(card_img))
        name_input = input(f"  Pokemon name (or 'skip'): ").strip()

        if name_input.lower() in ("skip", "s", ""):
            continue

        # Search for the Pokemon
        results = fuzzy_search(name_input, lookup)
        if not results:
            print(f"  [WARN] No matches for '{name_input}'")
            # Allow manual entry
            dex_input = input(f"  Enter dex number manually (or skip): ").strip()
            if not dex_input or dex_input.lower() == "skip":
                continue
            try:
                dex = int(dex_input)
                types_input = input(f"  Types (comma-separated): ").strip()
                types = [t.strip().lower() for t in types_input.split(",") if t.strip()]
                sig = SpriteSignature(dex, name_input, "default", types)
                sig.compute_from_image(card_img, mask)
                db.add(sig)
                calibrated += 1
                print(f"  Saved: #{dex} {name_input}")
            except ValueError:
                print(f"  [SKIP] Invalid dex number")
            continue

        if len(results) == 1:
            chosen = results[0]
        else:
            for j, r in enumerate(results):
                print(f"    {j+1}. {r['name']} (#{r['dex']}) [{'/'.join(r['types'])}]")
            pick = input(f"  Pick (1-{len(results)}): ").strip()
            try:
                idx = int(pick) - 1
                chosen = results[idx]
            except (ValueError, IndexError):
                chosen = results[0]

        sig = SpriteSignature(chosen["dex"], chosen["name"], "default", chosen["types"])
        sig.compute_from_image(card_img, mask)
        db.add(sig)
        calibrated += 1
        print(f"  Saved: #{chosen['dex']} {chosen['name']} [{'/'.join(chosen['types'])}]")

    return calibrated


def main():
    parser = argparse.ArgumentParser(description="Batch calibrate Pokemon sprites from screenshots")
    parser.add_argument("path", help="Screenshot file or directory of screenshots")
    parser.add_argument("--db", default="sprite_db.pkl", help="Database path")
    parser.add_argument("--data", default="pokemon_data.json", help="Pokemon data file")
    parser.add_argument("--auto", action="store_true", help="Auto-confirm high-confidence matches")
    parser.add_argument("--single", action="store_true", help="Process single file")
    args = parser.parse_args()

    # Load resources
    db = SpriteDatabase(args.db)
    if db.load():
        print(f"Loaded database: {len(db)} entries")
    else:
        print(f"Starting fresh database: {args.db}")

    lookup = load_pokemon_lookup(args.data)
    print(f"Pokemon data: {len(lookup.get('names', []))} entries")

    detector = FrameDetector()
    matcher = SpriteMatcher(db, config={"phash_threshold": 64})

    # Find screenshots
    path = Path(args.path)
    if path.is_file():
        files = [path]
    elif path.is_dir():
        files = sorted(path.glob("*.png")) + sorted(path.glob("*.jpg")) + sorted(path.glob("*.jpeg"))
    else:
        print(f"Error: {args.path} not found")
        sys.exit(1)

    print(f"\nProcessing {len(files)} screenshot(s)...\n")

    total_calibrated = 0
    for f_idx, filepath in enumerate(files):
        print(f"[{f_idx+1}/{len(files)}] {filepath.name}")
        count = process_screenshot(
            str(filepath), db, matcher, detector, lookup, auto_confirm=args.auto
        )
        total_calibrated += count

        # Save after each screenshot
        if count > 0:
            db.save()
            # Rebuild matcher to include new entries
            matcher = SpriteMatcher(db, config={"phash_threshold": 64})

    print(f"\n{'=' * 50}")
    print(f"Calibration complete!")
    print(f"  New entries: {total_calibrated}")
    print(f"  Total database: {len(db)} entries")
    print(f"  Saved to: {args.db}")


if __name__ == "__main__":
    main()
