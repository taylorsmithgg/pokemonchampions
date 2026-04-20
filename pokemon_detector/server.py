#!/usr/bin/env python3
"""
WebSocket server for the Pokemon detection pipeline.

Receives frames from the browser, detects both player and opponent teams,
logs match history automatically, and sends results for overlay rendering.

Protocol (JSON over WebSocket):

    Client -> Server:
        {"type": "frame", "data": "<base64 JPEG>"}
        {"type": "calibrate", "slot": 0, "side": "opponent", "dex": 71, "name": "Victreebel", "types": ["grass","poison"]}
        {"type": "ping"}
        {"type": "get_history", "n": 10}
        {"type": "get_lineups"}

    Server -> Client:
        {"type": "detection", "data": {...}}
        {"type": "pong", ...}
        {"type": "history", "matches": [...]}
        {"type": "lineups", "player": [...], "opponent_frequency": {...}}
"""

import asyncio
import base64
import cv2
import json
import numpy as np
import os
import sys
import time
import argparse

try:
    import websockets
except ImportError:
    print("websockets not installed. Run: pip install websockets")
    sys.exit(1)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core.frame_detector import FrameDetector
from core.matcher import SpriteMatcher, extract_sprite_mask
from core.sprite_db import SpriteDatabase, SpriteSignature
from core.match_history import MatchHistory
from core.result_detector import ResultDetector


def _match_side(frame, cards, db, matcher, panel_type):
    """Match all cards on one side and return results list."""
    results = []
    for i, card in enumerate(cards):
        card_img = card.crop_card(frame)
        mask = extract_sprite_mask(card_img, panel_type)
        entry = {"slot": i, "pokemon": None, "dex": 0, "confidence": 0, "is_confident": False}

        if len(db) > 0:
            matches = matcher.match(card_img, mask, top_k=3)
            if matches:
                m = matches[0]
                entry = {
                    "slot": i,
                    "pokemon": m.display_name,
                    "dex": m.dex_number,
                    "confidence": round(m.confidence, 4),
                    "is_confident": m.is_confident,
                    "scores": {
                        "color": round(m.color_score, 4),
                        "template": round(m.template_score, 4),
                        "shape": round(m.shape_score, 4),
                    },
                    "runner_up": m.runner_up,
                }
        results.append(entry)
    return results


class DetectionServer:
    def __init__(self, db_path="sprite_db.pkl", history_file="match_history.jsonl"):
        self.db = SpriteDatabase(db_path)
        self.db_path = db_path
        if self.db.load():
            print(f"[OK] Sprite database: {len(self.db)} entries")
        else:
            print(f"[WARN] No database at {db_path}")

        self.frame_detector = FrameDetector()
        self.result_detector = ResultDetector()
        self.matcher = SpriteMatcher(self.db, config={"phash_threshold": 64})
        self.history = MatchHistory(history_file)
        print(f"[OK] Match history: {len(self.history)} entries")

        self.min_frame_interval = 0.3
        self.last_frame_time = 0
        self.last_detection = None
        self.last_frame = None
        self.total_frames = 0
        self.total_detections = 0

    async def handle_client(self, websocket):
        addr = websocket.remote_address
        print(f"[CONN] {addr}")
        try:
            async for message in websocket:
                try:
                    msg = json.loads(message)
                    t = msg.get("type", "")

                    if t == "frame":
                        resp = self.process_frame(msg)
                        await websocket.send(json.dumps(resp))

                    elif t == "calibrate":
                        resp = self.handle_calibrate(msg)
                        await websocket.send(json.dumps(resp))

                    elif t == "ping":
                        await websocket.send(json.dumps({
                            "type": "pong",
                            "db_size": len(self.db),
                            "history_size": len(self.history),
                            "total_frames": self.total_frames,
                        }))

                    elif t == "get_history":
                        n = msg.get("n", 10)
                        recent = self.history.get_recent(n)
                        await websocket.send(json.dumps({
                            "type": "history",
                            "matches": [e.to_dict() for e in recent],
                        }))

                    elif t == "get_lineups":
                        await websocket.send(json.dumps({
                            "type": "lineups",
                            "player": self.history.get_player_lineups(),
                            "opponent_frequency": self.history.get_opponent_pokemon_frequency(),
                        }))

                    elif t == "get_summary":
                        await websocket.send(json.dumps({
                            "type": "summary",
                            **self.history.summary(),
                        }))

                    else:
                        await websocket.send(json.dumps({
                            "type": "error", "message": f"Unknown type: {t}"
                        }))

                except json.JSONDecodeError:
                    await websocket.send(json.dumps({"type": "error", "message": "Invalid JSON"}))
                except Exception as e:
                    print(f"[ERR] {e}")
                    await websocket.send(json.dumps({"type": "error", "message": str(e)}))

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            print(f"[DISC] {addr}")

    def process_frame(self, msg):
        now = time.time()
        if (now - self.last_frame_time) < self.min_frame_interval and self.last_detection:
            return self.last_detection

        self.last_frame_time = now
        self.total_frames += 1

        try:
            img_data = base64.b64decode(msg["data"])
            np_arr = np.frombuffer(img_data, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        except Exception as e:
            return {"type": "error", "message": f"Frame decode failed: {e}"}

        if frame is None:
            return {"type": "error", "message": "Frame decode returned None"}

        self.last_frame = frame
        
        # Check for result screen first (WIN/LOSS)
        result_det = self.result_detector.detect(frame)
        if result_det.is_result_screen and result_det.outcome:
            recorded = self.history.record_outcome(result_det.outcome)
            result = {
                "type": "detection",
                "data": {
                    "is_team_select": False,
                    "is_result_screen": True,
                    "outcome": result_det.outcome,
                    "outcome_confidence": result_det.confidence,
                    "outcome_recorded": recorded,
                    "record": self.history.get_record(),
                },
            }
            self.last_detection = result
            return result

        detection = self.frame_detector.detect(frame)

        if not detection.is_team_select:
            result = {"type": "detection", "data": {"is_team_select": False}}
            self.last_detection = result
            return result

        self.total_detections += 1

        opponents = _match_side(frame, detection.opponent_cards, self.db, self.matcher, "opponent")
        players = _match_side(frame, detection.player_cards, self.db, self.matcher, "player")

        # Auto-record to match history
        self.history.record(players, opponents)

        result = {
            "type": "detection",
            "data": {
                "is_team_select": True,
                "confidence": detection.confidence,
                "opponents": opponents,
                "players": players,
                "opponent_identified": sum(1 for o in opponents if o.get("is_confident")),
                "player_identified": sum(1 for p in players if p.get("is_confident")),
                "db_size": len(self.db),
                "history_size": len(self.history),
            },
        }
        self.last_detection = result
        return result

    def handle_calibrate(self, msg):
        """Label a sprite from the last captured frame and save to DB."""
        if self.last_frame is None:
            return {"type": "error", "message": "No frame captured yet. Send a frame first."}

        slot = msg.get("slot", -1)
        side = msg.get("side", "opponent")
        dex = msg.get("dex", 0)
        name = msg.get("name", "")
        form = msg.get("form", "default")
        types = msg.get("types", [])

        if not name or dex <= 0:
            return {"type": "error", "message": "Need dex and name"}

        detection = self.frame_detector.detect(self.last_frame)
        if not detection.is_team_select:
            return {"type": "error", "message": "Last frame is not a team select screen"}

        cards = detection.opponent_cards if side == "opponent" else detection.player_cards
        panel_type = "opponent" if side == "opponent" else "player"

        if slot < 0 or slot >= len(cards):
            return {"type": "error", "message": f"Slot {slot} out of range (0-{len(cards)-1})"}

        card = cards[slot]
        card_img = card.crop_card(self.last_frame)
        mask = extract_sprite_mask(card_img, panel_type)

        sig = SpriteSignature(dex, name, form, types, panel_type=panel_type)
        sig.compute_from_image(card_img, mask)
        self.db.add(sig)
        self.db.save()

        # Rebuild matcher with new entry
        self.matcher = SpriteMatcher(self.db, config={"phash_threshold": 64})

        return {
            "type": "calibrated",
            "slot": slot,
            "side": side,
            "name": name,
            "dex": dex,
            "db_size": len(self.db),
        }


async def main(host="0.0.0.0", port=8765, db_path="sprite_db.pkl", history_file="match_history.jsonl"):
    server = DetectionServer(db_path, history_file)

    print(f"\n{'=' * 50}")
    print(f"PokeDetect Server")
    print(f"{'=' * 50}")
    print(f"  WebSocket:  ws://{host}:{port}")
    print(f"  Database:   {db_path} ({len(server.db)} sprites)")
    print(f"  History:    {history_file} ({len(server.history)} matches)")
    print(f"{'=' * 50}\n")

    async with websockets.serve(server.handle_client, host, port):
        await asyncio.Future()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PokeDetect Server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--db", default="sprite_db.pkl")
    parser.add_argument("--history", default="match_history.jsonl")
    args = parser.parse_args()
    asyncio.run(main(args.host, args.port, args.db, args.history))
