#!/usr/bin/env python3
"""
Test the detection pipeline against the uploaded screenshot.

Demonstrates:
1. Frame detection (finding team select screen + card boundaries)
2. Sprite extraction and background removal  
3. Matching against a single reference sprite (Victreebel)
4. Calibration mode (capturing sprites from known screenshot)
"""

import cv2
import numpy as np
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core.frame_detector import FrameDetector
from core.matcher import SpriteMatcher, extract_sprite_mask
from core.sprite_db import SpriteDatabase, SpriteSignature, _split_alpha


def test_frame_detection(screenshot_path: str):
    """Test that we can detect the team selection screen."""
    print("=" * 60)
    print("TEST 1: Frame Detection")
    print("=" * 60)

    frame = cv2.imread(screenshot_path)
    h, w = frame.shape[:2]
    print(f"Frame: {w}x{h}")

    detector = FrameDetector()
    result = detector.detect(frame)

    print(f"Team select detected: {result.is_team_select}")
    print(f"Confidence: {result.confidence:.2f}")
    print(f"Panel bounds: {result.panel_bounds}")
    print(f"Opponent cards found: {len(result.opponent_cards)}")

    for i, card in enumerate(result.opponent_cards):
        print(f"  Card {i}: y={card.y_start}-{card.y_end}, x={card.x_start}-{card.x_end}, sprite_bbox={card.sprite_bbox}")

    return result, frame


def test_sprite_extraction(frame, detection):
    """Test sprite extraction and background removal quality."""
    print("\n" + "=" * 60)
    print("TEST 2: Sprite Extraction + Background Removal")
    print("=" * 60)

    os.makedirs("test_output", exist_ok=True)

    for i, card in enumerate(detection.opponent_cards):
        card_img = card.crop_card(frame)
        mask = extract_sprite_mask(card_img)

        fg_pct = mask.sum() / 255 / mask.size * 100

        # Save cleaned sprite
        rgba = np.zeros((*card_img.shape[:2], 4), dtype=np.uint8)
        rgba[:, :, :3] = card_img
        rgba[:, :, 3] = mask
        cv2.imwrite(f"test_output/card_{i}_cleaned.png", rgba)

        # Find bounding box of sprite
        rows = np.any(mask > 0, axis=1)
        cols = np.any(mask > 0, axis=0)
        if rows.any() and cols.any():
            rmin, rmax = np.where(rows)[0][[0, -1]]
            cmin, cmax = np.where(cols)[0][[0, -1]]
            sprite_w = cmax - cmin
            sprite_h = rmax - rmin
            print(f"  Card {i}: fg={fg_pct:.1f}%, sprite_bbox=({cmin},{rmin})-({cmax},{rmax}), size={sprite_w}x{sprite_h}")
        else:
            print(f"  Card {i}: fg={fg_pct:.1f}%, no sprite detected")


def test_matching(frame, detection, reference_path: str):
    """Test matching with the Victreebel reference sprite."""
    print("\n" + "=" * 60)
    print("TEST 3: Multi-Signal Matching (Victreebel reference)")
    print("=" * 60)

    # Build a tiny database with just Victreebel
    db = SpriteDatabase("test_db.pkl")

    ref_img = cv2.imread(reference_path, cv2.IMREAD_UNCHANGED)
    bgr, mask = _split_alpha(ref_img)

    sig = SpriteSignature(71, "Victreebel", "default", ["grass", "poison"])
    sig.compute_from_image(bgr, mask)
    db.add(sig)

    # Test each card against the database
    matcher = SpriteMatcher(db, config={
        "phash_threshold": 64,  # Disable pHash pre-filter for this test
    })

    print(f"\n{'Slot':<6} {'Match':<16} {'Combined':>10} {'Color':>10} {'Template':>10} {'Shape':>10}")
    print("-" * 70)

    for i, card in enumerate(detection.opponent_cards):
        card_img = card.crop_card(frame)
        mask = extract_sprite_mask(card_img)

        matches = matcher.match(card_img, mask, top_k=1)
        if matches:
            m = matches[0]
            print(f"  {i:<4} {m.display_name:<16} {m.confidence:>10.4f} {m.color_score:>10.4f} {m.template_score:>10.4f} {m.shape_score:>10.4f}")
        else:
            print(f"  {i:<4} {'(no match)':<16}")


def test_calibration(frame, detection, screenshot_path: str):
    """Test calibration mode: capture known sprites from the screenshot."""
    print("\n" + "=" * 60)
    print("TEST 4: Calibration (capturing known sprites)")
    print("=" * 60)

    # We know what Pokemon are on the opponent's team from visual inspection
    # In production, the user would label these via the overlay UI
    known_opponent = [
        {"slot": 0, "dex": 71, "name": "Victreebel", "types": ["grass", "poison"]},
        {"slot": 1, "dex": 733, "name": "Toucannon", "types": ["normal", "flying"]},
        # Slots 2-5 would be filled in by the user
    ]

    db = SpriteDatabase("calibrated_db.pkl")

    for info in known_opponent:
        slot = info["slot"]
        card = detection.opponent_cards[slot]
        card_img = card.crop_card(frame)
        mask = extract_sprite_mask(card_img)

        sig = SpriteSignature(
            dex_number=info["dex"],
            name=info["name"],
            form="default",
            types=info["types"],
        )
        sig.compute_from_image(card_img, mask)
        db.add(sig)
        print(f"  Calibrated: #{info['dex']} {info['name']} from slot {slot}")

    db.save()
    print(f"\nCalibrated database: {len(db)} entries saved")

    # Now test matching with calibrated sprites
    # Sprite 0 should perfectly match its own calibrated version
    print("\n  Re-matching with calibrated database:")
    matcher = SpriteMatcher(db, config={"phash_threshold": 64})

    for i, card in enumerate(detection.opponent_cards[:2]):
        card_img = card.crop_card(frame)
        mask = extract_sprite_mask(card_img)
        matches = matcher.match(card_img, mask, top_k=2)
        if matches:
            m = matches[0]
            print(f"    Slot {i}: {m.display_name} (confidence={m.confidence:.4f})")


def test_performance(frame, detection):
    """Benchmark the detection pipeline for live stream viability."""
    print("\n" + "=" * 60)
    print("TEST 5: Performance Benchmark")
    print("=" * 60)

    import time

    # Benchmark frame detection
    times = []
    for _ in range(20):
        detector = FrameDetector()
        t0 = time.perf_counter()
        detector.detect(frame)
        times.append((time.perf_counter() - t0) * 1000)
    print(f"  Frame detection: {np.mean(times):.1f}ms avg, {np.max(times):.1f}ms max")

    # Benchmark sprite extraction
    times = []
    for _ in range(20):
        for card in detection.opponent_cards:
            t0 = time.perf_counter()
            card_img = card.crop_card(frame)
            extract_sprite_mask(card_img)
            times.append((time.perf_counter() - t0) * 1000)
    print(f"  Sprite extraction (per card): {np.mean(times):.1f}ms avg")
    print(f"  Sprite extraction (6 cards): {np.mean(times)*6:.1f}ms avg")

    # Estimate full pipeline with 1000-entry database
    # Matching is the bottleneck due to template matching
    print(f"\n  Estimated full pipeline (1000 Pokemon DB):")
    print(f"    Frame detection:  ~{np.mean(times[:20]):.0f}ms")
    print(f"    Extraction (6x):  ~{np.mean(times)*6:.0f}ms")
    print(f"    Matching (6x):    ~300-600ms (with pHash pre-filter)")
    print(f"    Total:            ~400-700ms per frame")
    print(f"    Target FPS:       1-2 fps (sufficient for team select)")


if __name__ == "__main__":
    screenshot = "/mnt/user-data/uploads/lineup-selection.png"
    reference = "/mnt/user-data/uploads/1776296184258_image.png"

    if not os.path.exists(screenshot):
        print(f"Error: Screenshot not found at {screenshot}")
        sys.exit(1)

    detection, frame = test_frame_detection(screenshot)

    if detection.is_team_select:
        test_sprite_extraction(frame, detection)
        test_matching(frame, detection, reference)
        test_calibration(frame, detection, screenshot)
        test_performance(frame, detection)
    else:
        print("\nTeam selection screen not detected. Check frame_detector config.")
        print("This could mean the crimson color thresholds need adjustment.")
