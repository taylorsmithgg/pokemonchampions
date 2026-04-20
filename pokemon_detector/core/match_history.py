"""
Match history persistence: automatically logs both lineups (player + opponent)
with timestamps, deduplicates consecutive detections of the same matchup,
and provides query/analysis functions.

Storage format: JSONL (one JSON object per line) for append-friendly writes.

Each entry:
{
    "match_id": "20240115_143022",
    "timestamp": 1705312222.5,
    "player_team": [
        {"slot": 0, "dex": 445, "name": "Garchomp", "confidence": 0.92},
        ...
    ],
    "opponent_team": [
        {"slot": 0, "dex": 71, "name": "Victreebel", "confidence": 0.94},
        ...
    ],
    "player_identified": 6,
    "opponent_identified": 5,
    "notes": ""
}
"""

import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from collections import Counter


@dataclass
class TeamSnapshot:
    """A single team snapshot from detection."""
    pokemon: list[dict] = field(default_factory=list)  # [{dex, name, confidence, slot}, ...]

    @property
    def identified_count(self) -> int:
        return sum(1 for p in self.pokemon if p.get("dex", 0) > 0)

    @property
    def names(self) -> list[str]:
        return [p.get("name", "???") for p in self.pokemon]

    @property
    def dex_set(self) -> frozenset:
        return frozenset(p.get("dex", 0) for p in self.pokemon if p.get("dex", 0) > 0)

    def matches(self, other: "TeamSnapshot", threshold: int = 4) -> bool:
        """Check if two snapshots represent the same team (at least N shared Pokemon)."""
        return len(self.dex_set & other.dex_set) >= threshold


@dataclass
class MatchEntry:
    """A single match (one team preview detection)."""
    match_id: str
    timestamp: float
    player_team: TeamSnapshot
    opponent_team: TeamSnapshot
    outcome: Optional[str] = None  # "win", "loss", or None (pending)
    notes: str = ""

    def to_dict(self) -> dict:
        return {
            "match_id": self.match_id,
            "timestamp": self.timestamp,
            "datetime": datetime.fromtimestamp(self.timestamp).isoformat(),
            "player_team": self.player_team.pokemon,
            "opponent_team": self.opponent_team.pokemon,
            "player_identified": self.player_team.identified_count,
            "opponent_identified": self.opponent_team.identified_count,
            "outcome": self.outcome,
            "notes": self.notes,
        }


class MatchHistory:
    """Persistent match history with deduplication and analysis."""

    def __init__(self, history_file: str = "match_history.jsonl"):
        self.history_file = history_file
        self.entries: list[MatchEntry] = []
        self._last_opponent: Optional[TeamSnapshot] = None
        self._last_player: Optional[TeamSnapshot] = None
        self._last_record_time: float = 0
        self._min_interval = 30.0  # Don't record same matchup within 30s

        self._load()

    def _load(self):
        """Load existing history from disk."""
        if not os.path.exists(self.history_file):
            return

        self.entries = []
        with open(self.history_file) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    entry = MatchEntry(
                        match_id=data["match_id"],
                        timestamp=data["timestamp"],
                        player_team=TeamSnapshot(pokemon=data.get("player_team", [])),
                        opponent_team=TeamSnapshot(pokemon=data.get("opponent_team", [])),
                        outcome=data.get("outcome"),
                        notes=data.get("notes", ""),
                    )
                    self.entries.append(entry)
                except (json.JSONDecodeError, KeyError):
                    continue

    def record(self, player_team: list[dict], opponent_team: list[dict]) -> Optional[MatchEntry]:
        """
        Record a match if it's not a duplicate of the previous one.

        Args:
            player_team: list of {slot, dex, name, confidence} dicts
            opponent_team: list of {slot, dex, name, confidence} dicts

        Returns:
            MatchEntry if recorded, None if deduplicated
        """
        now = time.time()
        player_snap = TeamSnapshot(pokemon=player_team)
        opponent_snap = TeamSnapshot(pokemon=opponent_team)

        # Dedup: skip if same teams detected within the interval
        if (
            self._last_opponent
            and self._last_player
            and (now - self._last_record_time) < self._min_interval
            and opponent_snap.matches(self._last_opponent)
            and player_snap.matches(self._last_player)
        ):
            return None

        match_id = datetime.fromtimestamp(now).strftime("%Y%m%d_%H%M%S")
        entry = MatchEntry(
            match_id=match_id,
            timestamp=now,
            player_team=player_snap,
            opponent_team=opponent_snap,
        )

        self.entries.append(entry)
        self._last_opponent = opponent_snap
        self._last_player = player_snap
        self._last_record_time = now

        # Append to disk
        with open(self.history_file, "a") as f:
            f.write(json.dumps(entry.to_dict()) + "\n")

        return entry

    def record_outcome(self, outcome: str) -> bool:
        """
        Attach a win/loss outcome to the most recent match.

        Args:
            outcome: "win" or "loss"

        Returns:
            True if recorded, False if no pending match
        """
        if not self.entries:
            return False

        latest = self.entries[-1]
        if latest.outcome is not None:
            return False  # Already has an outcome

        latest.outcome = outcome

        # Rewrite the file to update the entry
        self._rewrite()
        return True

    def _rewrite(self):
        """Rewrite the entire history file (used after in-place edits)."""
        with open(self.history_file, "w") as f:
            for entry in self.entries:
                f.write(json.dumps(entry.to_dict()) + "\n")

    def get_recent(self, n: int = 10) -> list[MatchEntry]:
        """Get the N most recent matches."""
        return self.entries[-n:]

    def get_lineup_usage(self, side: str = "player") -> dict:
        """Get usage frequency for each Pokemon on the specified side."""
        counter = Counter()
        for entry in self.entries:
            team = entry.player_team if side == "player" else entry.opponent_team
            for p in team.pokemon:
                name = p.get("name", "???")
                if name != "???":
                    counter[name] += 1
        return dict(counter.most_common())

    def get_player_lineups(self) -> list[dict]:
        """Get unique player lineups with usage counts and win rates."""
        lineup_counts = Counter()
        lineup_wins = Counter()
        lineup_losses = Counter()
        lineup_details = {}

        for entry in self.entries:
            key = tuple(sorted(entry.player_team.dex_set))
            if not key:
                continue
            lineup_counts[key] += 1
            if entry.outcome == "win":
                lineup_wins[key] += 1
            elif entry.outcome == "loss":
                lineup_losses[key] += 1
            if key not in lineup_details:
                lineup_details[key] = entry.player_team.names

        result = []
        for key, count in lineup_counts.most_common():
            wins = lineup_wins[key]
            losses = lineup_losses[key]
            result.append({
                "pokemon": lineup_details.get(key, list(key)),
                "dex_numbers": list(key),
                "times_used": count,
                "wins": wins,
                "losses": losses,
                "win_rate": round(wins / (wins + losses) * 100, 1) if (wins + losses) > 0 else None,
            })
        return result

    def get_opponent_pokemon_frequency(self) -> dict:
        """Get how often each opponent Pokemon appears."""
        return self.get_lineup_usage("opponent")

    def get_record(self) -> dict:
        """Get overall win/loss record."""
        wins = sum(1 for e in self.entries if e.outcome == "win")
        losses = sum(1 for e in self.entries if e.outcome == "loss")
        pending = sum(1 for e in self.entries if e.outcome is None)
        total = wins + losses
        return {
            "wins": wins,
            "losses": losses,
            "pending": pending,
            "win_rate": round(wins / total * 100, 1) if total > 0 else None,
            "total_decided": total,
        }

    def summary(self) -> dict:
        """Get a high-level summary of match history."""
        return {
            "total_matches": len(self.entries),
            "record": self.get_record(),
            "unique_player_lineups": len(self.get_player_lineups()),
            "player_pokemon_usage": self.get_lineup_usage("player"),
            "opponent_pokemon_frequency": self.get_opponent_pokemon_frequency(),
            "most_recent": self.entries[-1].to_dict() if self.entries else None,
        }

    def __len__(self):
        return len(self.entries)
