/**
 * End-to-end detector — port of `pokemon_detector/detector.py`.
 *
 * Pipeline per frame:
 *   1. `detectFrame` → locate opponent + player panels, split into 6 cards.
 *   2. For each card: crop → `extractSpriteMask` → `buildQuerySignature`.
 *   3. `matchQuery` against the reference sprite DB.
 *   4. Gate on `isConfident` and return the species + score.
 *
 * The module stays DOM-free: callers pass `PixelView` objects (ImageData
 * shape). The React component wraps a canvas around it.
 */

import type { CardRegion, FrameDetection, LineupFrameMode } from './frameDetector.ts';
import { cropCard, detectFrame } from './frameDetector.ts';
import type { PixelView } from './image.ts';
import { extractSpriteMask, findSpriteBounds, type LineupMode } from './spriteMask.ts';
import {
  buildQuerySignature,
  isConfident,
  matchQuery,
  type MatchResult,
  type MatcherConfig,
} from './matcher.ts';
import type { SpriteDatabase } from './spriteDb.ts';

export interface DetectedPokemon {
  card: CardRegion;
  index: number;
  panel: 'opponent' | 'player';
  /** Best match (may be low confidence). */
  top: MatchResult | null;
  /** Top-3 matches for debugging / UI. */
  candidates: MatchResult[];
  /** Result of the confidence gate. */
  isConfident: boolean;
  /** Timing data for profiling. */
  timingMs: { mask: number; features: number; match: number };
  /** True when the constrained matcher pass produced no confident
   *  result and we re-ran against the full DB. */
  reprocessed: boolean;
  /** Reprocess fallback: the unconstrained pick when constrained
   *  matching fails (or null when constrained matching wasn't applied
   *  or already produced a confident answer). */
  fallbackTop: MatchResult | null;
  /** Top-3 candidates from the unconstrained reprocess pass. Empty
   *  when we didn't reprocess. */
  fallbackCandidates: MatchResult[];
}

export interface DetectionResult {
  frame: FrameDetection;
  opponents: DetectedPokemon[];
  players: DetectedPokemon[];
  totalMs: number;
}

export interface PokemonDetectorOptions extends MatcherConfig {
  /** Confidence floor and margin for the top-pick gate. */
  minConfidence?: number;
  minMargin?: number;
  /** Also match player cards (defaults to true). */
  matchPlayers?: boolean;
  /**
   * Optional per-panel species whitelist used to constrain matching
   * (typically populated from the selection-screen consensus when
   * processing a lock-screen frame). When a panel has a non-empty
   * candidate set we run the matcher against ONLY those species,
   * dramatically reducing noise from visually-degraded crops.
   *
   * If the constrained pass produces no confident match for a card,
   * `detectPokemon` automatically RE-PROCESSES that card against the
   * full DB and surfaces both results — the constrained pick lives at
   * `card.top` / `card.candidates`, and the unconstrained reprocess
   * lives at `card.fallbackTop`. The two are compared downstream:
   * agreement is treated as a confident lock; disagreement raises a
   * "lock vs selection mismatch" warning in the Detection Trail.
   */
  restrictMatching?: {
    player?: ReadonlySet<string>;
    opponent?: ReadonlySet<string>;
  };
}

function processCard(
  source: PixelView,
  card: CardRegion,
  index: number,
  db: SpriteDatabase,
  options: PokemonDetectorOptions,
  mode: LineupMode,
  candidateSpecies?: ReadonlySet<string>,
): DetectedPokemon {
  const fullCard = cropCard(source, card);

  // Narrow to the sprite half of the card (the other half holds
  // gender / type / item icons, which would pollute the mask).
  const sb = card.spriteBbox;
  const sx = Math.max(0, sb.x1);
  const sy = Math.max(0, sb.y1);
  const sw = Math.min(fullCard.width - sx, sb.x2 - sb.x1);
  const sh = Math.min(fullCard.height - sy, sb.y2 - sb.y1);
  const cardImg = (() => {
    const data = new Uint8ClampedArray(sw * sh * 4);
    for (let y = 0; y < sh; y++) {
      const srcI = ((sy + y) * fullCard.width + sx) * 4;
      data.set(fullCard.data.subarray(srcI, srcI + sw * 4), y * sw * 4);
    }
    return { data, width: sw, height: sh };
  })();

  const maskStart = performance.now();
  const mask = extractSpriteMask(cardImg, card.panel, { mode });
  const bounds = findSpriteBounds(mask);
  const maskMs = performance.now() - maskStart;

  if (!bounds) {
    return {
      card,
      index,
      panel: card.panel,
      top: null,
      candidates: [],
      isConfident: false,
      timingMs: { mask: maskMs, features: 0, match: 0 },
      reprocessed: false,
      fallbackTop: null,
      fallbackCandidates: [],
    };
  }

  // Crop down to the sprite bbox + a few pixels padding so features
  // aren't dominated by background pixels.
  const pad = 2;
  const bx = Math.max(0, bounds.minX - pad);
  const by = Math.max(0, bounds.minY - pad);
  const bw = Math.min(cardImg.width - bx, bounds.maxX - bounds.minX + 1 + pad * 2);
  const bh = Math.min(cardImg.height - by, bounds.maxY - bounds.minY + 1 + pad * 2);

  const cardData = new Uint8ClampedArray(bw * bh * 4);
  const maskSub = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    const srcRow = (by + y) * cardImg.width;
    for (let x = 0; x < bw; x++) {
      const si = srcRow + (bx + x);
      const di = y * bw + x;
      cardData[di * 4] = cardImg.data[si * 4];
      cardData[di * 4 + 1] = cardImg.data[si * 4 + 1];
      cardData[di * 4 + 2] = cardImg.data[si * 4 + 2];
      cardData[di * 4 + 3] = cardImg.data[si * 4 + 3];
      maskSub[di] = mask.data[si];
    }
  }

  const featuresStart = performance.now();
  const query = buildQuerySignature(
    { data: cardData, width: bw, height: bh },
    { data: maskSub, width: bw, height: bh },
    options,
  );
  const featuresMs = performance.now() - featuresStart;

  // PASS 1 — constrained matching when a candidate set was supplied
  // (typically the 6 species from the selection consensus). Otherwise
  // a normal full-DB matcher pass.
  const matchStart = performance.now();
  const useConstrained = !!candidateSpecies && candidateSpecies.size > 0;
  // Lineup screens always show base-form sprites — Megas only activate
  // mid-battle. Coalesce every `*-Mega` DB entry into its base species
  // so the selection consensus, the constrained per-card match, and
  // the reprocess fallback never RETURN a `-Mega` name. The Mega
  // signature is still scored (and often matches the live chibi more
  // closely than the base entry does — see comment on
  // `coalesceMegas`), but the result is labelled with the base species.
  // Callers can opt-out by passing `coalesceMegas: false` in the
  // top-level options (currently only tests need this).
  const baseConfig: MatcherConfig = {
    ...options,
    coalesceMegas: options.coalesceMegas !== false,
  };
  const constrainedConfig: MatcherConfig = useConstrained
    ? { ...baseConfig, candidateSpecies }
    : baseConfig;
  // When the matcher is restricted, pull the FULL pool-size result
  // list (not just top-3) so the downstream unique-assignment pass can
  // reach past the obvious first-place conflicts. Without this, warm-
  // palette species like Hydrapple fall off the top-3 (dominated by
  // Basculegion / Samurott-Hisui / Alcremie lookalikes) and unique
  // assignment has no alternative to assign them to.
  // Unconstrained pass: keep top-5 (not just top-3) so the species-clause
  // enforcer downstream has real alternatives when two slots' top pick
  // collide. Constrained pass stays at `pool-size` for the bipartite
  // matching that already runs below.
  const topK = useConstrained ? Math.max(3, candidateSpecies!.size) : 5;
  let candidates = matchQuery(query, db, constrainedConfig, topK);
  let matchMs = performance.now() - matchStart;

  let top = candidates[0] ?? null;
  let confident = top ? isConfident(top, options.minConfidence, options.minMargin) : false;

  // PASS 2 — reprocess fallback. If we restricted to a small species
  // pool and got nothing confident back, the live render likely doesn't
  // match any of the constrained references closely enough. Re-run
  // unconstrained so the user still sees a best-effort guess AND so the
  // mismatch (lock pick that's not in the selection consensus) is
  // observable downstream.
  let reprocessed = false;
  let fallbackTop: MatchResult | null = null;
  let fallbackCandidates: MatchResult[] = [];

  if (useConstrained && !confident) {
    const reStart = performance.now();
    fallbackCandidates = matchQuery(query, db, baseConfig, 3);
    matchMs += performance.now() - reStart;
    fallbackTop = fallbackCandidates[0] ?? null;
    reprocessed = true;

    // If the unconstrained pass produces a confident pick, prefer it.
    // Two scenarios converge here:
    //   • Selection consensus was wrong/incomplete; the unconstrained
    //     pick is the actual locked species (we'll surface a mismatch).
    //   • Both passes are noisy; the unconstrained pick is also weak,
    //     in which case `isConfident` stays false and the slot remains
    //     unassigned — the consensus voter will ignore it.
    const fallbackConfident =
      fallbackTop ? isConfident(fallbackTop, options.minConfidence, options.minMargin) : false;
    if (fallbackConfident && fallbackTop) {
      candidates = fallbackCandidates;
      top = fallbackTop;
      confident = true;
    }
  }

  return {
    card,
    index,
    panel: card.panel,
    top,
    candidates,
    isConfident: confident,
    timingMs: { mask: maskMs, features: featuresMs, match: matchMs },
    reprocessed,
    fallbackTop,
    fallbackCandidates,
  };
}

/**
 * Main detection entry point. Given a raw frame (RGBA `PixelView`) and
 * a loaded sprite database, returns per-card match results for both
 * panels.
 */
export function detectPokemon(
  source: PixelView,
  db: SpriteDatabase,
  options: PokemonDetectorOptions = {},
): DetectionResult {
  const t0 = performance.now();
  const frame = detectFrame(source);
  // Accept BOTH selection and lock screens — downstream callers
  // disambiguate via `frame.mode`. Returning early for non-selection
  // frames here would force `runLockDetection` paths to redo all the
  // panel-finding work, and the per-card matcher already adapts to
  // either mode via the `mode` argument plumbed through `processCard`.
  if (!frame.isLineupScreen) {
    return { frame, opponents: [], players: [], totalMs: performance.now() - t0 };
  }

  const matchPlayers = options.matchPlayers !== false;
  const maskMode: LineupMode = frame.mode === 'lock' ? 'lock' : 'selection';

  // Per-panel candidate restrictions (lock pipeline only — see
  // `restrictMatching` doc on PokemonDetectorOptions).
  //
  // Lineup sprites always show the base form (Megas activate mid-battle
  // only). A caller may still hand us a pool that contains
  // `Houndoom-Mega` — either from a stale cache or from a selection
  // consensus built before Mega-filtering was enabled. Normalize those
  // names to their base species so the constrained matcher can actually
  // find a DB entry.
  const playerCandidates = normalizeMegaPool(options.restrictMatching?.player);
  const opponentCandidates = normalizeMegaPool(options.restrictMatching?.opponent);

  const opponents = frame.opponentCards.map((card, i) =>
    processCard(source, card, i, db, options, maskMode, opponentCandidates),
  );
  const players = matchPlayers
    ? frame.playerCards.map((card, i) =>
        processCard(source, card, i, db, options, maskMode, playerCandidates),
      )
    : [];

  // Unique assignment: when the candidate pool equals the slot count
  // (6 fully-known opponents on a lock frame), enforce that each
  // species can be picked by AT MOST one slot. Without this, warm-
  // palette lookalikes like Hydrapple (which shares crimson with the
  // card background and reads weakly as ~5% Hydrapple, ~5%
  // Basculegion) get stolen by whichever slot has the strongest
  // Basculegion response — even when that slot should already be
  // Basculegion with 35%+ confidence. Greedy-by-confidence assignment
  // resolves this: the high-confidence slot claims Basculegion, and
  // the Hydrapple slot inherits its next-best candidate from the pool
  // (which IS Hydrapple).
  if (opponentCandidates && opponentCandidates.size === opponents.length) {
    resolveUniqueAssignment(opponents, opponentCandidates);
  } else {
    enforceSpeciesClause(opponents);
  }
  if (playerCandidates && playerCandidates.size === players.length) {
    resolveUniqueAssignment(players, playerCandidates);
  } else {
    enforceSpeciesClause(players);
  }

  return { frame, opponents, players, totalMs: performance.now() - t0 };
}

/**
 * Strip `-Mega`, `-Mega-X`, `-Mega-Y` suffixes from every name in a
 * species restriction pool and return the Set of base-form names. If
 * the caller explicitly passed an empty or nullish pool we pass it
 * through unchanged (caller semantics: "no restriction").
 */
function normalizeMegaPool(
  pool: ReadonlySet<string> | undefined,
): ReadonlySet<string> | undefined {
  if (!pool || pool.size === 0) return pool;
  const out = new Set<string>();
  for (const species of pool) {
    const base = species.replace(/-Mega(-[XY])?$/, '');
    out.add(base);
  }
  return out;
}

/**
 * Enforce 1-to-1 slot ↔ species assignment from a closed pool using
 * OPTIMAL max-total-score bipartite matching (brute force over all
 * permutations; N ≤ 6 makes this trivially fast).
 *
 * Greedy-by-score was locally optimal but globally wrong. Real example
 * from f_00697:
 *   slot 3 (Samurott-H visual) ranks Samurott-Hisui=0.161, Hydrapple=0.035
 *   slot 4 (Hydrapple visual) ranks Samurott-Hisui=0.170, Hydrapple=0.130
 * Greedy picks slot 4 → Samurott first (0.170 is the highest score in
 * the pool among unassigned pairs), orphaning slot 3 onto Hydrapple
 * 0.035 → swapped identities. Total = 0.170 + 0.035 = 0.205.
 * Optimal picks slot 3 → Samurott (0.161), slot 4 → Hydrapple (0.130).
 * Total = 0.161 + 0.130 = 0.291 → higher, and matches the visual truth.
 *
 * Implementation: build a full N×N slot/species score matrix, then
 * enumerate all permutations. Species not found in a slot's candidate
 * list score 0 (we still permit the assignment so the pool fills).
 *
 * The reprocess-fallback fields (`fallbackTop`, `reprocessed`) are left
 * UNTOUCHED: they document the unconstrained pass, which is a separate
 * signal meant to surface lock-vs-selection mismatches.
 */
function resolveUniqueAssignment(
  slots: DetectedPokemon[],
  pool: ReadonlySet<string>,
): void {
  const N = slots.length;
  const speciesList = Array.from(pool);
  if (speciesList.length !== N) return;
  // Build N×N score matrix + per-(slot,species) MatchResult lookup so
  // we can restore the chosen match object afterwards.
  const score = new Float64Array(N * N);
  const match = new Array<MatchResult | null>(N * N).fill(null);
  for (let i = 0; i < N; i++) {
    for (const cand of slots[i].candidates) {
      const j = speciesList.indexOf(cand.species);
      if (j < 0) continue;
      const idx = i * N + j;
      if (match[idx] === null || cand.combined > score[idx]) {
        score[idx] = cand.combined;
        match[idx] = cand;
      }
    }
  }

  // Brute-force all permutations of species → slot index.
  const perm = Array.from({ length: N }, (_, i) => i);
  let bestTotal = -Infinity;
  let bestPerm: number[] | null = null;
  const permute = (k: number): void => {
    if (k === N) {
      let total = 0;
      for (let i = 0; i < N; i++) total += score[i * N + perm[i]];
      if (total > bestTotal) {
        bestTotal = total;
        bestPerm = perm.slice();
      }
      return;
    }
    for (let i = k; i < N; i++) {
      [perm[k], perm[i]] = [perm[i], perm[k]];
      permute(k + 1);
      [perm[k], perm[i]] = [perm[i], perm[k]];
    }
  };
  permute(0);
  if (!bestPerm) return;

  for (let i = 0; i < N; i++) {
    const chosen = match[i * N + bestPerm[i]];
    if (!chosen) continue;
    const slot = slots[i];
    if (slot.candidates[0]?.species !== chosen.species) {
      const rest = slot.candidates.filter(c => c.species !== chosen.species);
      slot.candidates = [chosen, ...rest];
    }
    slot.top = chosen;
  }
}

/**
 * Enforce species-clause uniqueness across a panel's slots when the
 * caller has NOT supplied a closed candidate pool (selection-screen
 * pass, lock-screen pass without hints, etc.).
 *
 * Pokémon Champions teams can't contain duplicate species — a team is
 * always 6 distinct Pokémon — but the unconstrained matcher happily
 * assigns the same species to two slots when their chibis share a
 * palette (e.g. two dark/purple cards both matching "Weavile" because
 * the true second species' signature is weaker than Weavile's). Without
 * a cross-slot constraint the consensus accumulator then votes Weavile
 * at both slots forever and the UI surfaces "Weavile × 2".
 *
 * Algorithm: DFS over per-slot top-K candidate lists, picking one
 * species per slot such that no species is reused AND total `combined`
 * score is maximised. When every candidate for a slot is already
 * claimed by another slot with a higher score, we NULL the slot's top
 * (leaving its `candidates` intact for debugging) — a blank is better
 * than a confident duplicate.
 *
 * N ≤ 6 slots × K=5 candidates → 5^6 = 15 625 leaves worst-case, with
 * admissible-heuristic pruning. Runs in well under a millisecond.
 */
function enforceSpeciesClause(slots: DetectedPokemon[]): void {
  const N = slots.length;
  if (N <= 1) return;

  const cands: MatchResult[][] = slots.map(s => s.candidates);
  // Suffix upper bound: if every remaining slot could take its top pick
  // we'd add up their top scores. Used to prune branches that can't
  // beat `bestTotal`.
  const suffix = new Float64Array(N + 1);
  for (let i = N - 1; i >= 0; i--) {
    suffix[i] = suffix[i + 1] + (cands[i][0]?.combined ?? 0);
  }

  const choice = new Array<MatchResult | null>(N).fill(null);
  let bestTotal = -Infinity;
  let bestChoice: (MatchResult | null)[] | null = null;
  const used = new Set<string>();

  const dfs = (i: number, total: number): void => {
    if (total + suffix[i] <= bestTotal) return;
    if (i === N) {
      if (total > bestTotal) {
        bestTotal = total;
        bestChoice = choice.slice();
      }
      return;
    }
    const options = cands[i];
    let tried = false;
    for (const cand of options) {
      if (used.has(cand.species)) continue;
      tried = true;
      choice[i] = cand;
      used.add(cand.species);
      dfs(i + 1, total + cand.combined);
      used.delete(cand.species);
    }
    if (!tried) {
      // All of this slot's candidates are taken — leave it unassigned
      // and continue so the rest of the panel still gets resolved. The
      // zero-score contribution is fine: we'd rather have 5 unique
      // confident slots + 1 blank than 6 slots where one is a
      // duplicate.
      choice[i] = null;
      dfs(i + 1, total);
    }
  };
  dfs(0, 0);
  if (!bestChoice) return;

  for (let i = 0; i < N; i++) {
    const chosen = (bestChoice as (MatchResult | null)[])[i];
    const slot = slots[i];
    if (!chosen) {
      slot.top = null;
      slot.isConfident = false;
      continue;
    }
    if (slot.candidates[0]?.species !== chosen.species) {
      const rest = slot.candidates.filter(c => c.species !== chosen.species);
      slot.candidates = [chosen, ...rest];
    }
    slot.top = chosen;
  }
}

// Re-export mode types so downstream consumers don't need to import
// from frameDetector + spriteMask separately.
export type { LineupFrameMode };
