# PokeDetect: Live Stream Pokemon Sprite Detection Engine

Real-time opponent team identification for Pokemon Scarlet/Violet ranked battles, designed for stream overlays.

## Architecture

```
Browser (React UI)              Python Backend
+------------------+           +------------------+
| getDisplayMedia   |  frame   | Frame Detector   |
| captures screen   | -------> | (crimson panel   |
| at ~3 FPS         |  (WS)   |  detection)      |
|                   |           |        |         |
| Overlay renders   | <------- | Sprite Matcher   |
| opponent team     |  results | (multi-signal:   |
| with confidence   |          |  color + template |
|                   |          |  + shape)        |
| Calibration UI    | -------> | Sprite Database  |
| labels unknowns   |  label   | (pickle, cached) |
+------------------+           +------------------+
```

## How Matching Works

Three signals are combined with configurable weights:

| Signal | Weight | What it does |
|--------|--------|-------------|
| Color histogram (HSV) | 45% | Compares the Pokemon's color palette after removing the card background |
| Template matching | 35% | Multi-scale grayscale template match against reference sprites |
| Shape (Hu moments) | 20% | Compares the sprite silhouette shape |

### Why calibration matters

With external sprites (PokeAPI pixel art): ~0.50 confidence, thin margins.
With calibrated sprites (from actual game): ~0.93 confidence, clear separation.

The in-game sprites are deterministic per Pokemon, so a calibrated reference is nearly a perfect match. Build your database by playing matches and labeling opponents.

## Setup

### Requirements

```bash
pip install opencv-python-headless numpy Pillow websockets imagehash
```

### Quick Start

1. Start the detection server:
```bash
cd pokemon_detector
python server.py --port 8765
```

2. Open the React overlay UI (served as an artifact, or host separately)

3. Connect the UI to `ws://localhost:8765`

4. Click "Start Capture" and select your game window/tab

5. When a team selection screen is detected, opponents appear in the overlay

### Building the Sprite Database

**Option A: PokeAPI download (decent starting point)**
```bash
python build_db.py --range 1-1025
```
This downloads official artwork from PokeAPI. These are reasonable references but
not identical to the in-game renders.

**Option B: Calibrate from screenshots (best accuracy)**
```bash
python build_db.py --calibrate screenshot.png
```
Then provide JSON labeling which Pokemon are in each slot. The UI also supports
click-to-calibrate during live detection.

**Option C: From local sprite directory**
```bash
python build_db.py --from-dir ./my_sprites --db calibrated.pkl
```

### Pokemon Data File

For type-based filtering, create `pokemon_data.json`:
```json
{
    "71": {"name": "Victreebel", "types": ["grass", "poison"]},
    "733": {"name": "Toucannon", "types": ["normal", "flying"]},
    "730": {"name": "Primarina", "types": ["water", "fairy"]}
}
```

## File Structure

```
pokemon_detector/
  core/
    frame_detector.py   - Detects team select screen, finds card boundaries
    matcher.py          - Multi-signal sprite matching engine
    sprite_db.py        - Sprite database with pre-computed signatures
  server.py             - WebSocket server (browser <-> detection pipeline)
  detector.py           - Main orchestrator with caching and logging
  build_db.py           - Database builder (PokeAPI / local / calibration)
  test_pipeline.py      - Validation test suite
  pokemon_detector_ui.jsx - React overlay and calibration UI
```

## WebSocket Protocol

### Client -> Server

```json
{"type": "frame", "data": "<base64 JPEG>", "timestamp": 1234567890}
{"type": "calibrate", "slot": 0, "dex": 71, "name": "Victreebel", "types": ["grass","poison"]}
{"type": "ping"}
```

### Server -> Client

```json
{
    "type": "detection",
    "data": {
        "is_team_select": true,
        "confidence": 0.95,
        "opponents": [
            {
                "slot": 0,
                "pokemon": "Victreebel",
                "dex": 71,
                "confidence": 0.9357,
                "is_confident": true,
                "scores": {"color": 0.88, "template": 0.98, "shape": 0.91}
            }
        ],
        "identified": 4,
        "db_size": 200
    }
}
```

## OBS Integration

The overlay mode (click "Overlay Mode" in the UI) renders with a transparent
background, suitable for use as an OBS browser source:

1. In OBS, add a Browser Source
2. Point it at the hosted overlay URL
3. Set width/height to match your canvas
4. Enable "Shutdown source when not visible"

## Performance

Tested on the provided 1723x954 screenshot:

| Stage | Time |
|-------|------|
| Frame detection | ~35ms |
| Sprite extraction (6 cards) | ~15ms |
| Matching (6 cards, 1000 DB) | ~300-600ms |
| **Total per frame** | **~400-700ms** |

At 2-3 FPS processing, this is well within live stream requirements.
The team selection screen persists for 15+ seconds, giving plenty of
time for confident detection.

## Known Limitations

- Type icon recognition is not yet implemented (color-based classification
  proved unreliable; template matching against captured reference icons
  would work but needs bootstrap data)
- The crimson card background detection is tuned for SV ranked battles;
  other battle formats may have different UI colors
- The calibration workflow currently requires the server to store the
  last processed frame; in-browser calibration is an alternative path
