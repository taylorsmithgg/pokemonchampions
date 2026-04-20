/**
 * Multi-signal matcher — port of `pokemon_detector/core/matcher.py`.
 *
 * The query sprite is scored against every DB entry using FOUR
 * weighted signals:
 *   - color    (40%) — Bhattacharyya distance between HS histograms
 *   - template (20%) — normalized cross-correlation of grayscale crops
 *   - shape    (15%) — I2 distance between Hu moments
 *   - pHash    (25%) — perceptual-hash similarity (1 − d/64)
 *
 * pHash started life as just a cheap pre-filter (drop candidates whose
 * 64-bit perceptual hash is too far from the query). Empirical work on
 * `gameplay.mp4` showed it is actually the most discriminating signal
 * between genuine look-alikes: for the session 646s opponent slot 3
 * chibi, Houndoom (correct) had Hamming distance 5–6 while
 * Samurott-Hisui (the mistake) sat at 9–10, but the grayscale NCC
 * template favored Samurott-Hisui and the Python-era color-heavy
 * weights couldn't overrule it. Including pHash in the weighted sum
 * recovers that margin without giving up the full-DB pre-filter.
 *
 * The query runs through `buildQuerySignature` once per card to avoid
 * recomputing features for every DB entry.
 */

import type { PixelView, Mask } from './image.ts';
import { resizePixelView } from './image.ts';
import {
  HIST_H_BINS,
  HIST_S_BINS,
  bhattacharyyaDistance,
  computeHsHistogram,
  computeHuMoments,
  computePhash,
  hammingDistance,
  normalizedCrossCorrelation,
  type SpriteSignature,
} from './features.ts';
import type { SpriteDatabase } from './spriteDb.ts';
import { createMask } from './image.ts';

export interface MatcherConfig {
  /** Feature weights (must sum to 1.0). */
  weightColor?: number;
  weightTemplate?: number;
  weightShape?: number;
  /**
   * Weight on the pHash-derived similarity score in the combined sum.
   * Similarity is `max(0, 1 − hammingDistance / 64)`, so a perfect
   * match is 1.0 and a random 32-bit-differ match is 0.5.
   *
   * This was 0 (pHash used only as a pre-filter) up to 2026-04; raising
   * it to 0.25 lets low Hamming distances actually influence the
   * ranking. That's the signal that distinguishes Houndoom (d≈5) from
   * Samurott-Hisui (d≈9) on the gameplay.mp4 opponent slot 3 chibi,
   * which no other feature discriminates reliably.
   */
  weightPhash?: number;
  /** Max Hamming distance for pHash pre-filter (64-bit hashes). */
  phashThreshold?: number;
  /** Fixed template dimensions for cross-correlation — query is resized here. */
  templateDim?: number;
  /**
   * Optional whitelist of species names — when set, only DB entries
   * matching one of these species are scored. Used by the lock pipeline
   * to constrain matches to species already locked in by the selection
   * consensus, dramatically improving accuracy on visually-degraded
   * lock-screen chibis (which would otherwise match noise from across
   * the full 250+ species DB).
   *
   * When undefined, matching runs against the full DB (default).
   */
  candidateSpecies?: ReadonlySet<string>;
  /**
   * Coalesce every `*-Mega` (and `-Mega-X` / `-Mega-Y`) entry into its
   * base species BEFORE consolidation, so the matcher's output never
   * names a Mega form. Champions hides Mega chibis on the lineup /
   * selection / lock screens because a Mega only activates MID-BATTLE
   * — the card always shows the base-form sprite up until the moment
   * the player clicks "Mega Evolve" during turn selection.
   *
   * We intentionally keep scoring BOTH the base and the Mega entries
   * instead of dropping Megas entirely: for some species our DB's
   * Mega-form menu icon happens to line up more tightly with the
   * rendered base chibi than the base-form icon does. (See the
   * Gardevoir-Mega / Gardevoir case in `gameplay.mp4` session 646s —
   * filtering Megas outright made the consensus fall through to
   * Alcremie rather than Gardevoir.) Scoring the Mega entry and
   * relabelling its result as the base species gives us the best
   * signature match while still never displaying `-Mega` in UI.
   *
   * The later consolidation step picks the best-scoring variant per
   * (post-normalization) species, so a winning Mega signature just
   * replaces the weaker base entry's score.
   */
  coalesceMegas?: boolean;
}

export interface MatchResult {
  species: string;
  name: string;
  dex: number;
  form: string;
  panelType: 'opponent' | 'player' | '';
  /** True when the winning DB entry was a shiny variant of this species. */
  isShiny: boolean;
  combined: number;
  colorScore: number;
  templateScore: number;
  shapeScore: number;
  /** `max(0, 1 − phashDistance / 64)` — same thing as what feeds the sum. */
  phashScore: number;
  phashDistance: number;
  /** Runner-up info for confidence gating. The runner-up is the next
   *  *different species* (so the normal/shiny pair of the same species
   *  doesn't artificially shrink the margin). */
  runnerUp: { species: string; combined: number } | null;
}

/** Pre-computed query features. */
export interface QuerySignature {
  hsHist: Float32Array;
  phash: Uint8Array;
  huMoments: Float64Array;
  templateGray: Uint8Array;
  templateWidth: number;
  templateHeight: number;
  maskBytes: Uint8Array;
}

const DEFAULTS = {
  // Weights tuned against gameplay.mp4's known lineup for session 646s.
  // The matcher lives in an awkward regime: our DB references are
  // Bulbapedia pixel-art menu icons, but the game renders 3D chibis.
  // That stylistic gap crushes grayscale-NCC template scores —
  // Dragapult's authentic chibi hits templateScore≈0.04 vs its own
  // menu-icon reference, while bulky pixel silhouettes like
  // Crabominable hit ≈0.15 against anything. Template stops being
  // useful as a primary ranker, so we down-weight it and rely on
  // color (hue histogram) + pHash (downsampled perceptual fingerprint)
  // as the dominant signals. Shape (Hu moments) is left with enough
  // weight to break color-ties for strongly-different silhouettes.
  weightColor: 0.55,
  weightTemplate: 0.10,
  weightShape: 0.15,
  weightPhash: 0.20,
  phashThreshold: 40,
  templateDim: 48,
};

/**
 * Compute all query-time features once for a single card.
 *
 * The reference DB was built by centre-fitting each sprite into a
 * `templateDim² ` square with transparent padding preserving aspect
 * ratio. We mirror that here so the query's template aligns pixel-wise
 * with every DB entry.
 */
export function buildQuerySignature(
  cardImg: PixelView,
  mask: Mask,
  config: MatcherConfig = {},
): QuerySignature {
  const templateDim = config.templateDim ?? DEFAULTS.templateDim;

  // Histogram uses the full-resolution crop + mask — more hue precision.
  const hsHist = computeHsHistogram(cardImg, mask);

  // Letterbox-fit the sprite (and its mask) into a templateDim² square,
  // preserving aspect ratio. This matches the offline build.
  const scale = Math.min(templateDim / cardImg.width, templateDim / cardImg.height);
  const innerW = Math.max(1, Math.round(cardImg.width * scale));
  const innerH = Math.max(1, Math.round(cardImg.height * scale));
  const offX = Math.floor((templateDim - innerW) / 2);
  const offY = Math.floor((templateDim - innerH) / 2);

  const resizedCrop = resizePixelView(cardImg, innerW, innerH);
  const resizedMaskInner = createMask(innerW, innerH);
  for (let y = 0; y < innerH; y++) {
    const srcY = Math.min(mask.height - 1, Math.floor(((y + 0.5) * mask.height) / innerH));
    for (let x = 0; x < innerW; x++) {
      const srcX = Math.min(mask.width - 1, Math.floor(((x + 0.5) * mask.width) / innerW));
      resizedMaskInner.data[y * innerW + x] = mask.data[srcY * mask.width + srcX];
    }
  }

  const templateGray = new Uint8Array(templateDim * templateDim);
  const paddedMask = createMask(templateDim, templateDim);
  for (let y = 0; y < innerH; y++) {
    for (let x = 0; x < innerW; x++) {
      const i = y * innerW + x;
      const r = resizedCrop.data[i * 4];
      const g = resizedCrop.data[i * 4 + 1];
      const b = resizedCrop.data[i * 4 + 2];
      const di = (y + offY) * templateDim + (x + offX);
      paddedMask.data[di] = resizedMaskInner.data[i];
      if (resizedMaskInner.data[i]) {
        templateGray[di] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }
    }
  }

  const phash = computePhash(templateGray, templateDim, templateDim);
  const huMoments = computeHuMoments(paddedMask);

  return {
    hsHist,
    phash,
    huMoments,
    templateGray,
    templateWidth: templateDim,
    templateHeight: templateDim,
    maskBytes: paddedMask.data,
  };
}

function scoreAgainstEntry(
  query: QuerySignature,
  sig: SpriteSignature,
): { color: number; template: number; shape: number } {
  // Color — Bhattacharyya → similarity (1 - distance).
  const color = Math.max(0, 1 - bhattacharyyaDistance(query.hsHist, sig.hsHist));

  // Template — NCC at the shared scale. Assumes both are templateDim ×
  // templateDim. If the DB template is a different size, resample on
  // the fly.
  let refTemplate = sig.template;
  if (
    sig.templateWidth !== query.templateWidth ||
    sig.templateHeight !== query.templateHeight
  ) {
    refTemplate = resizeGray(
      sig.template,
      sig.templateWidth,
      sig.templateHeight,
      query.templateWidth,
      query.templateHeight,
    );
  }
  const template = Math.max(0, normalizedCrossCorrelation(query.templateGray, refTemplate));

  // Shape — Hu moments via I2 metric → similarity via 1 / (1 + d).
  let shape = 0;
  let dist = 0;
  for (let i = 0; i < 7; i++) {
    const qi = Math.abs(query.huMoments[i]) < 1e-12 ? 0 : Math.sign(query.huMoments[i]) * Math.log(Math.abs(query.huMoments[i]));
    const si = Math.abs(sig.huMoments[i]) < 1e-12 ? 0 : Math.sign(sig.huMoments[i]) * Math.log(Math.abs(sig.huMoments[i]));
    dist += Math.abs(qi - si);
  }
  shape = 1 / (1 + dist);

  return { color, template, shape };
}

function resizeGray(
  src: Uint8Array,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Uint8Array {
  const out = new Uint8Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const srcY = Math.min(sh - 1, Math.floor(((y + 0.5) * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const srcX = Math.min(sw - 1, Math.floor(((x + 0.5) * sw) / dw));
      out[y * dw + x] = src[srcY * sw + srcX];
    }
  }
  return out;
}

/**
 * Score a query signature against every entry in the DB. Applies a
 * pHash Hamming-distance pre-filter to skip obviously wrong candidates
 * before running the heavier NCC + shape signals.
 */
export function matchQuery(
  query: QuerySignature,
  db: SpriteDatabase,
  config: MatcherConfig = {},
  topK = 3,
): MatchResult[] {
  const wColor = config.weightColor ?? DEFAULTS.weightColor;
  const wTemplate = config.weightTemplate ?? DEFAULTS.weightTemplate;
  const wShape = config.weightShape ?? DEFAULTS.weightShape;
  const wPhash = config.weightPhash ?? DEFAULTS.weightPhash;
  const phashThreshold = config.phashThreshold ?? DEFAULTS.phashThreshold;
  const candidateSpecies = config.candidateSpecies;
  const coalesceMegas = config.coalesceMegas === true;

  const scored: Array<MatchResult & { _rank: number }> = [];

  for (const entry of db.entries) {
    // Normalize species name for this scoring pass. When coalescing,
    // `Houndoom-Mega` is scored using its own signature but reported
    // (and candidate-filtered) as `Houndoom`. Same for form labels.
    const scoredSpecies = coalesceMegas
      ? entry.species.replace(/-Mega(-[XY])?$/, '')
      : entry.species;
    const scoredForm = coalesceMegas && entry.form
      ? entry.form.replace(/^Mega(-[XY])?$/, '')
      : entry.form;
    if (candidateSpecies && !candidateSpecies.has(scoredSpecies)) continue;
    const sig = entry.signature;
    const phashDistance = hammingDistance(query.phash, sig.phash);
    // Skip the pHash pre-filter when we're already restricted to a
    // small candidate pool. Lock-screen 3D chibis can have a Hamming
    // distance of 35-50 from their menu-icon reference even though
    // they're the correct species; against the full DB the pHash
    // filter saves ~95% of work, but against 6 candidates it just
    // throws away the right answer.
    if (!candidateSpecies && phashDistance > phashThreshold) continue;

    const { color, template, shape } = scoreAgainstEntry(query, sig);
    // pHash similarity on a 0–1 scale. 64-bit hash: identical→1.0,
    // half-mismatching (d=32)→0.5, completely-different (d=64)→0.0.
    const phashSim = Math.max(0, 1 - phashDistance / 64);
    const combined =
      color * wColor + template * wTemplate + shape * wShape + phashSim * wPhash;

    scored.push({
      species: scoredSpecies,
      name: entry.name,
      dex: entry.dex,
      form: scoredForm,
      panelType: entry.panelType,
      isShiny: entry.isShiny,
      combined,
      colorScore: color,
      templateScore: template,
      shapeScore: shape,
      phashScore: phashSim,
      phashDistance,
      runnerUp: null,
      _rank: 0,
    });
  }

  scored.sort((a, b) => b.combined - a.combined);

  // Consolidate by species: keep only the best-scoring variant per species
  // (so the shiny-vs-normal pair of one species can't both occupy slots
  // 1 and 2 — the loser's shiny indicator just means "we considered it").
  // With coalesceMegas, `Houndoom` and `Houndoom-Mega` have both already
  // been renamed to `Houndoom`, so this dedupe keeps whichever signature
  // matched the live chibi better.
  const bestPerSpecies = new Map<string, typeof scored[number]>();
  for (const candidate of scored) {
    const existing = bestPerSpecies.get(candidate.species);
    if (!existing || candidate.combined > existing.combined) {
      bestPerSpecies.set(candidate.species, candidate);
    }
  }
  const consolidated = Array.from(bestPerSpecies.values()).sort((a, b) => b.combined - a.combined);

  const top = consolidated.slice(0, topK);
  for (let i = 0; i < top.length; i++) {
    top[i]._rank = i;
    if (i === 0 && consolidated.length > 1) {
      // Runner-up is now guaranteed to be a different species.
      top[i].runnerUp = { species: consolidated[1].species, combined: consolidated[1].combined };
    }
  }
  return top.map(({ _rank: _, ...rest }) => rest);
}

/**
 * Decide whether the top match is trustworthy. Mirrors the Python
 * `MatchResult.is_confident` — requires both an absolute floor and a
 * non-trivial margin over the runner up.
 *
 * Defaults are calibrated for live 3D-rendered card sprites scored
 * against 2D menu reference sprites, where "correct" top scores
 * typically land in the 0.22–0.30 band. The original Python default
 * (0.35) was tuned against a richer training set and rejected every
 * real match at those input conditions.
 */
export function isConfident(result: MatchResult, minConfidence = 0.22, minMargin = 0.05): boolean {
  if (result.combined < minConfidence) return false;
  if (!result.runnerUp) return true;
  return result.combined - result.runnerUp.combined > minMargin;
}

export const FEATURE_DIMS = {
  histogramBins: HIST_H_BINS * HIST_S_BINS,
};
