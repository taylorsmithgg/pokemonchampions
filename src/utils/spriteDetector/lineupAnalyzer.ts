/**
 * Lineup consensus analyzer.
 *
 * Single-frame matcher scores for live 3D-rendered card sprites sit in
 * the 0.14–0.30 band with runner-up margins often below 0.02, which
 * makes per-frame "is it species X?" decisions unreliable. But across
 * several frames, the *correct* species tends to win the top slot more
 * often than any single imposter — so multi-frame voting is dramatically
 * more robust than tightening a single-frame threshold.
 *
 * This module accepts successive snapshots of slot evaluations (shape
 * compatible with `SelectionSlotDebug`) and emits a consensus snapshot
 * where `assignedSpecies` / `assignedConfidence` reflect cross-frame
 * agreement. The consumer can then treat the consensus slot exactly like
 * a per-frame slot — the existing downstream gates (e.g.
 * `SELECTION_SLOT_LOCK_CONFIDENCE`) just operate on voting share instead
 * of raw matcher score.
 *
 * Voting rules (per slot, keyed on slotIndex+side):
 *   • Every snapshot, the top candidate with confidence ≥ `MIN_VOTE_CONFIDENCE`
 *     casts a vote for its species.
 *   • Consensus = species with the most votes.
 *   • A consensus is "confident" when:
 *       - ≥ MIN_CONSENSUS_VOTES total votes for the winner, AND
 *       - winner/runnerUp vote ratio ≥ MIN_CONSENSUS_MARGIN, AND
 *       - winner/totalFrames ≥ MIN_CONSENSUS_SHARE.
 *   • `assignedConfidence` is normalized to [0, 1] as `winnerVotes /
 *     framesObserved`, so a 3-of-3 sweep = 1.0 and a 2-of-4 = 0.5.
 */

import type { SelectionSlotDebug } from '../ocrDetection';

/** Minimum single-frame matcher confidence required to cast a vote. */
const MIN_VOTE_CONFIDENCE = 0.15;
/** Winner must have at least this many votes for confident consensus. */
const MIN_CONSENSUS_VOTES = 2;
/** Winner must outrank runner-up by at least this multiplier.
 *  Lowered from 1.5 → 1.25 because live 3D-rendered cards routinely
 *  produce near-tie runner-ups (e.g. Gengar vs Gengar-Mega, Gourgeist
 *  vs Gourgeist-Large) where we'd rather commit to the marginal winner
 *  than refuse to lock. With MIN_CONSENSUS_VOTES=2 still enforced,
 *  1-vote differences can't satisfy the margin. */
const MIN_CONSENSUS_MARGIN = 1.25;
/** Winner must appear in at least this fraction of observed frames.
 *  Lowered from 0.45 → 0.35 to tolerate two near-equal forms of the
 *  same Pokémon splitting votes (e.g. Gourgeist / Gourgeist-Small /
 *  Gourgeist-Large each taking ~33%). */
const MIN_CONSENSUS_SHARE = 0.35;
/** Frames older than this are forgotten. */
const SLOT_STALE_MS = 15_000;

export interface ConsensusCandidate {
  species: string;
  votes: number;
  meanConfidence: number;
  lastSeenConfidence: number;
  /** Number of votes cast specifically for the shiny variant of this
   *  species (subset of `votes`). When >= half of votes are shiny we
   *  flag the consensus as shiny. */
  shinyVotes: number;
}

export interface ConsensusSlot extends SelectionSlotDebug {
  /** Number of frames that have included this slot since reset. */
  framesObserved: number;
  /** Number of votes the winning species received. */
  winnerVotes: number;
  /** Candidate ranking from the voting accumulator (top 5). */
  voteCandidates: ConsensusCandidate[];
  /** True when the consensus passed the confidence gates above. */
  isConfident: boolean;
  /** True when the winning consensus is the shiny colour variant. */
  isShinyConsensus: boolean;
}

export interface Consensus {
  /** Per-slot consensus rows, keyed in insertion order. */
  slots: ConsensusSlot[];
  /** Wall-clock ms when the first snapshot arrived. */
  startedAt: number;
  /** Wall-clock ms of the last snapshot. */
  lastUpdatedAt: number;
  /** Count of non-empty snapshots fed. */
  snapshotsFed: number;
}

interface SlotVoteState {
  /** Most recent slot geometry + candidates (used when projecting back to
   *  the SelectionSlotDebug shape). */
  lastSlot: SelectionSlotDebug;
  framesObserved: number;
  votes: Map<
    string,
    { votes: number; shinyVotes: number; confidenceSum: number; lastConfidence: number }
  >;
  lastUpdatedAt: number;
}

type Listener = (consensus: Consensus) => void;

/**
 * A single, isolated voting accumulator.
 *
 * Two instances exist by default — `defaultAnalyzer` (selection screen,
 * 6 slots per side) and `lockAnalyzer` (lock screen, 4 slots per side
 * with type-tinted backgrounds). They share the same algorithm but
 * track votes independently so a noisy lock-screen frame can never
 * pollute selection consensus and vice-versa.
 */
export interface LineupAnalyzer {
  feedSnapshot(slots: SelectionSlotDebug[], timestamp?: number): void;
  getConsensus(): Consensus;
  getConsensusSlots(): SelectionSlotDebug[];
  reset(): void;
  subscribe(listener: Listener): () => void;
}

function slotKey(slotIndex: number, side: 'left' | 'right'): string {
  return `${side}:${slotIndex}`;
}

export function createLineupAnalyzer(): LineupAnalyzer {
  const slotState = new Map<string, SlotVoteState>();
  let startedAt = 0;
  let lastUpdatedAt = 0;
  let snapshotsFed = 0;
  const listeners = new Set<Listener>();

  function pruneStale(now: number): void {
    for (const [key, state] of slotState) {
      if (now - state.lastUpdatedAt > SLOT_STALE_MS) {
        slotState.delete(key);
      }
    }
  }

  function getConsensus(): Consensus {
    const slots: ConsensusSlot[] = [];
    const ordered = [...slotState.values()].sort((a, b) => {
      if (a.lastSlot.side !== b.lastSlot.side) {
        return a.lastSlot.side === 'left' ? -1 : 1;
      }
      return a.lastSlot.slotIndex - b.lastSlot.slotIndex;
    });
    for (const state of ordered) {
      slots.push(buildConsensusSlot(state));
    }
    return { slots, startedAt, lastUpdatedAt, snapshotsFed };
  }

  function getConsensusSlots(): SelectionSlotDebug[] {
    return getConsensus().slots.map(slot => ({
      slotIndex: slot.slotIndex,
      side: slot.side,
      cardX: slot.cardX,
      cardY: slot.cardY,
      cardW: slot.cardW,
      cardH: slot.cardH,
      x: slot.x,
      y: slot.y,
      w: slot.w,
      h: slot.h,
      assignedSpecies: slot.assignedSpecies,
      assignedConfidence: slot.assignedConfidence,
      candidates: slot.candidates,
    }));
  }

  function emit(): void {
    if (listeners.size === 0) return;
    const c = getConsensus();
    for (const listener of listeners) listener(c);
  }

  function feedSnapshot(slots: SelectionSlotDebug[], timestamp = Date.now()): void {
    if (slots.length === 0) return;

    pruneStale(timestamp);

    if (startedAt === 0) startedAt = timestamp;
    lastUpdatedAt = timestamp;
    snapshotsFed += 1;

    for (const slot of slots) {
      const key = slotKey(slot.slotIndex, slot.side);
      let state = slotState.get(key);
      if (!state) {
        state = {
          lastSlot: slot,
          framesObserved: 0,
          votes: new Map(),
          lastUpdatedAt: timestamp,
        };
        slotState.set(key, state);
      }
      state.lastSlot = slot;
      state.framesObserved += 1;
      state.lastUpdatedAt = timestamp;

      const topCandidate = slot.candidates[0];
      if (topCandidate && topCandidate.confidence >= MIN_VOTE_CONFIDENCE) {
        const prev = state.votes.get(topCandidate.species);
        const shinyDelta = topCandidate.isShiny ? 1 : 0;
        if (prev) {
          prev.votes += 1;
          prev.shinyVotes += shinyDelta;
          prev.confidenceSum += topCandidate.confidence;
          prev.lastConfidence = topCandidate.confidence;
        } else {
          state.votes.set(topCandidate.species, {
            votes: 1,
            shinyVotes: shinyDelta,
            confidenceSum: topCandidate.confidence,
            lastConfidence: topCandidate.confidence,
          });
        }
      }
    }

    emit();
  }

  function reset(): void {
    slotState.clear();
    startedAt = 0;
    lastUpdatedAt = 0;
    snapshotsFed = 0;
    emit();
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { feedSnapshot, getConsensus, getConsensusSlots, reset, subscribe };
}

/** Default analyzer for the SELECTION screen (legacy single-instance API). */
const defaultAnalyzer = createLineupAnalyzer();
/** Independent analyzer for LOCK screen votes — does not share state
 *  with the selection-screen analyzer. */
const lockAnalyzerInstance = createLineupAnalyzer();

export function subscribe(listener: Listener): () => void {
  return defaultAnalyzer.subscribe(listener);
}

export function reset(): void {
  defaultAnalyzer.reset();
}

/**
 * Feed a single frame's worth of slot evaluations into the analyzer.
 *
 * The caller is responsible for deciding *whether* a given frame counts
 * as a team-select frame (e.g. the HSV frame detector said so); if
 * `slotEvaluations` is empty, this is a no-op.
 */
export function feedSnapshot(slots: SelectionSlotDebug[], timestamp = Date.now()): void {
  defaultAnalyzer.feedSnapshot(slots, timestamp);
}

function rankVotes(state: SlotVoteState): ConsensusCandidate[] {
  const ranked: ConsensusCandidate[] = [];
  for (const [species, v] of state.votes) {
    ranked.push({
      species,
      votes: v.votes,
      shinyVotes: v.shinyVotes,
      meanConfidence: v.confidenceSum / Math.max(1, v.votes),
      lastSeenConfidence: v.lastConfidence,
    });
  }
  ranked.sort((a, b) => b.votes - a.votes || b.meanConfidence - a.meanConfidence);
  return ranked;
}

function buildConsensusSlot(state: SlotVoteState): ConsensusSlot {
  const ranked = rankVotes(state);
  const winner = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;

  const shareOfFrames =
    winner && state.framesObserved > 0 ? winner.votes / state.framesObserved : 0;
  const marginOverRunnerUp =
    winner && runnerUp ? winner.votes / Math.max(1, runnerUp.votes) : Infinity;

  const isConfident =
    !!winner &&
    winner.votes >= MIN_CONSENSUS_VOTES &&
    shareOfFrames >= MIN_CONSENSUS_SHARE &&
    marginOverRunnerUp >= MIN_CONSENSUS_MARGIN;

  // Shiny consensus: at least half of the winner's votes were for the
  // shiny variant. Below 50% we treat as a noisy match and fall back to
  // the standard variant — the shiny render only differs in palette so
  // colour drift can flip a single frame either way.
  const isShinyConsensus =
    !!winner && winner.votes > 0 && winner.shinyVotes / winner.votes >= 0.5;

  return {
    ...state.lastSlot,
    // Override assignment with the consensus verdict — downstream code
    // then reads vote share as "confidence" and gates accordingly.
    assignedSpecies: isConfident && winner ? winner.species : null,
    assignedConfidence: isConfident && winner ? shareOfFrames : null,
    framesObserved: state.framesObserved,
    winnerVotes: winner?.votes ?? 0,
    voteCandidates: ranked.slice(0, 5),
    isConfident,
    isShinyConsensus,
  };
}

export function getConsensus(): Consensus {
  return defaultAnalyzer.getConsensus();
}

/**
 * Convenience helper: project consensus slots back into the
 * `SelectionSlotDebug` shape used throughout `StreamCompanionPage`.
 *
 * Slots that aren't yet confident have `assignedSpecies: null` so the
 * existing `assignedConfidence >= SELECTION_SLOT_LOCK_CONFIDENCE` gate
 * still acts as the final commitment point.
 */
export function getConsensusSlots(): SelectionSlotDebug[] {
  return defaultAnalyzer.getConsensusSlots();
}

// ─── Lock-screen analyzer (separate instance) ──────────────────────
// Same algorithm, separate state. Lock and selection consensuses are
// surfaced side-by-side so the UI can flag mismatches (e.g. lock screen
// shows a Pokémon that wasn't in the player's selection pool).

export function feedLockSnapshot(
  slots: SelectionSlotDebug[],
  timestamp = Date.now(),
): void {
  lockAnalyzerInstance.feedSnapshot(slots, timestamp);
}

export function getLockConsensus(): Consensus {
  return lockAnalyzerInstance.getConsensus();
}

export function getLockConsensusSlots(): SelectionSlotDebug[] {
  return lockAnalyzerInstance.getConsensusSlots();
}

export function resetLockAnalyzer(): void {
  lockAnalyzerInstance.reset();
}

export function subscribeLock(listener: Listener): () => void {
  return lockAnalyzerInstance.subscribe(listener);
}

export const LINEUP_ANALYZER_CONFIG = {
  MIN_VOTE_CONFIDENCE,
  MIN_CONSENSUS_VOTES,
  MIN_CONSENSUS_MARGIN,
  MIN_CONSENSUS_SHARE,
  SLOT_STALE_MS,
} as const;
