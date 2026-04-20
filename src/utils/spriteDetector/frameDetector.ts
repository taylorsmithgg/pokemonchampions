/**
 * Frame detector — faithful TypeScript port of
 * `pokemon_detector/core/frame_detector.py`.
 *
 * Identifies the team-select screen by finding two colored panels:
 *
 *   • Crimson (H 155-179)   →  opponent cards on the right
 *   • Blue / green highlight →  player cards on the left
 *
 * Each panel is split into 6 card rows via valley detection in the
 * mask's row-density signal.
 *
 * Input: RGBA PixelView (HTMLCanvasElement ImageData or the Node canvas
 * package's ImageData).
 */

import type { HsvView, PixelView, MutableMask } from './image.ts';
import { toHsv, createMask } from './image.ts';
import { morphClose, morphOpen } from './morphology.ts';

export interface CardRegion {
  /** Row in the source frame where the card starts (inclusive). */
  yStart: number;
  /** Row in the source frame where the card ends (exclusive). */
  yEnd: number;
  xStart: number;
  xEnd: number;
  /**
   * Bounding box of the sprite sub-region within the card, in card-local
   * coordinates. `(x1, y1, x2, y2)` with (0,0) at the card's top-left.
   */
  spriteBbox: { x1: number; y1: number; x2: number; y2: number };
  /** Green highlight ring (player side only) — indicates an active pick. */
  isHighlighted: boolean;
  /** 'opponent' or 'player' — useful downstream for panel-aware masking. */
  panel: 'opponent' | 'player';
}

/** Which on-screen UI mode this frame represents.
 *  - `selection`: the SELECTION grid (blue/green player panel, picking 4 of 6).
 *  - `lock`: the LOCK / "Standing By" screen showing the chosen team with
 *            type-coloured player cards + numbered pick order.
 *  - `none`: neither — frame is gameplay/animation/menu.
 */
export type LineupFrameMode = 'selection' | 'lock' | 'none';

export interface FrameDetection {
  isTeamSelect: boolean;
  /** True for either selection OR lock screens; superset of `isTeamSelect`. */
  isLineupScreen: boolean;
  /** Discriminator between selection/lock so downstream picks the right
   *  sprite extraction pipeline. `none` when nothing matches. */
  mode: LineupFrameMode;
  confidence: number;
  opponentCards: CardRegion[];
  playerCards: CardRegion[];
  opponentPanelBounds: { x1: number; y1: number; x2: number; y2: number } | null;
  playerPanelBounds: { x1: number; y1: number; x2: number; y2: number } | null;
  /**
   * For lock screens only: indices (0-based, top-to-bottom) of player
   * cards carrying a visible selection-order number badge (1/2/3). A
   * true lock screen typically returns 2–3 slot indices corresponding
   * to the Pokémon the player sent into battle. Empty for non-lock
   * frames and for lock frames where the badges couldn't be segmented.
   */
  playerLockBadgeSlots: number[];
}

export interface FrameDetectorConfig {
  /** Minimum card height as a fraction of frame height (Python default 0.05). */
  minCardHeightRatio?: number;
  /** Expected card count per panel (Python hard-codes 6). */
  expectedCards?: number;
}

type ColorFn = (hsv: HsvView, xLo: number, xHi: number) => MutableMask;

/** Crimson / magenta opponent card mask — matches Python's `_crimson_mask`. */
function crimsonMask(hsv: HsvView, xLo: number, xHi: number): MutableMask {
  const { h, s, v, width } = hsv;
  const rw = xHi - xLo;
  const out = createMask(rw, hsv.height);
  const dst = out.data;
  for (let y = 0; y < hsv.height; y++) {
    for (let x = 0; x < rw; x++) {
      const si = y * width + xLo + x;
      const H = h[si], S = s[si], V = v[si];
      if (H >= 155 && H <= 179 && S >= 80 && V >= 25 && V <= 160) {
        dst[y * rw + x] = 255;
      }
    }
  }
  return out;
}

/**
 * "Any saturated card" mask used for the LOCK screen's player panel.
 *
 * Selection-screen player cards are uniform blue/green so the original
 * `blueGreenMask` works. The lock screen tints each card by the chosen
 * Pokémon's primary type (yellow electric, red fire, purple psychic,
 * green grass, blue water, etc.) — `blueGreenMask` only catches a
 * subset and the panel never reaches the 5-card threshold.
 *
 * Strategy: accept any pixel that is well-saturated AND in the mid-tone
 * value range (excludes both the pure-white "Standing By" button and the
 * very dark stadium background). This collapses every type tint to a
 * single `255` so row-density valley detection segments the cards
 * exactly the same way as the selection panel.
 *
 * Excluded:
 *   • crimson (H 155-179) — reserved for the opponent panel; if it
 *     leaks into the player half the column scan will move the panel
 *     boundary right and split the screen.
 *   • near-white (S < 50) — the "Standing By" pill + the trainer-name
 *     header banner.
 *   • very dark (V < 60) — stadium background, gender symbols.
 *   • near-black (V > 235) — overbright UI flourishes.
 */
function anyTypeColorCardMask(hsv: HsvView, xLo: number, xHi: number): MutableMask {
  const { h, s, v, width } = hsv;
  const rw = xHi - xLo;
  const out = createMask(rw, hsv.height);
  const dst = out.data;
  for (let y = 0; y < hsv.height; y++) {
    for (let x = 0; x < rw; x++) {
      const si = y * width + xLo + x;
      const H = h[si], S = s[si], V = v[si];
      // Filter out crimson — that's the opponent panel.
      if (H >= 150 && H <= 179) continue;
      if (S < 60) continue;
      if (V < 60 || V > 235) continue;
      dst[y * rw + x] = 255;
    }
  }
  return out;
}

/** Blue + green-highlight player card mask — matches `_blue_green_mask`. */
function blueGreenMask(hsv: HsvView, xLo: number, xHi: number): MutableMask {
  const { h, s, v, width } = hsv;
  const rw = xHi - xLo;
  const out = createMask(rw, hsv.height);
  const dst = out.data;
  for (let y = 0; y < hsv.height; y++) {
    for (let x = 0; x < rw; x++) {
      const si = y * width + xLo + x;
      const H = h[si], S = s[si], V = v[si];
      const blue = H >= 115 && H <= 135 && S >= 50 && V >= 55;
      const green = H >= 25 && H <= 50 && S >= 80 && V >= 150;
      if (blue || green) dst[y * rw + x] = 255;
    }
  }
  return out;
}

/** Average density of set pixels across each row of the mask (0-1). */
function rowDensity(mask: MutableMask): Float32Array {
  const { data, width, height } = mask;
  const out = new Float32Array(height);
  const invW = 1 / Math.max(1, width);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    const base = y * width;
    for (let x = 0; x < width; x++) {
      if (data[base + x]) sum++;
    }
    out[y] = sum * invW;
  }
  return out;
}

/** Box-filter smoothing (equivalent to `np.convolve(..., ones/N, mode='same')`). */
function smooth1d(signal: Float32Array, window: number): Float32Array {
  const n = signal.length;
  const out = new Float32Array(n);
  const half = Math.floor(window / 2);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    for (let k = lo; k <= hi; k++) sum += signal[k];
    count = hi - lo + 1;
    out[i] = sum / Math.max(1, count);
  }
  return out;
}

/**
 * Valley detection on the row-density signal — an evolution of the
 * Python `_find_card_boundaries` algorithm.
 *
 * Changes vs the Python original:
 *   1. We constrain the search to rows inside the panel's vertical
 *      extent (first/last rows with notable density). This kills false
 *      "valleys" at y=0 and y=frameHeight-1 that confuse the filter.
 *   2. After dedup we keep the top (expectedCards-1) valleys ranked by
 *      prominence rather than keeping every valley above a fixed drop
 *      threshold. This makes detection robust to mild in-card density
 *      fluctuations (lighting, ability icons) that would otherwise
 *      split a real card in two.
 *   3. Panel edges (top / bottom) act as implicit boundaries.
 */
function findCardBoundariesViaValleys(
  density: Float32Array,
  frameHeight: number,
  minCardHeightRatio: number,
  expectedCards: number,
): Array<[number, number]> {
  const minCardH = Math.floor(frameHeight * minCardHeightRatio);
  const smoothed = smooth1d(density, 7);

  // Determine panel vertical extent: first/last rows with density ≥ 0.15.
  // Valleys outside this range are almost always panel-edge artifacts.
  const PANEL_DENSITY_THRESHOLD = 0.15;
  let panelStart = -1;
  let panelEnd = -1;
  for (let y = 0; y < smoothed.length; y++) {
    if (smoothed[y] >= PANEL_DENSITY_THRESHOLD) {
      if (panelStart === -1) panelStart = y;
      panelEnd = y;
    }
  }
  if (panelStart === -1) return [];

  const searchRadius = 15;
  const valleys: Array<[number, number]> = [];
  const lo = Math.max(panelStart + searchRadius, searchRadius);
  const hi = Math.min(panelEnd - searchRadius, smoothed.length - searchRadius);
  for (let y = lo; y < hi; y++) {
    let localMin = Infinity;
    for (let k = y - searchRadius; k <= y + searchRadius; k++) {
      if (smoothed[k] < localMin) localMin = smoothed[k];
    }
    if (smoothed[y] > localMin + 0.01) continue;

    let leftPeak = 0;
    const leftStart = Math.max(panelStart, y - 50);
    for (let k = leftStart; k < y; k++) if (smoothed[k] > leftPeak) leftPeak = smoothed[k];

    let rightPeak = 0;
    const rightEnd = Math.min(panelEnd + 1, y + 50);
    for (let k = y; k < rightEnd; k++) if (smoothed[k] > rightPeak) rightPeak = smoothed[k];

    const drop = Math.min(leftPeak, rightPeak) - smoothed[y];
    if (drop > 0.12) valleys.push([y, drop]);
  }

  // Dedupe nearby valleys, keeping the deepest one per cluster
  const minGap = Math.max(40, minCardH);
  const deduped: Array<[number, number]> = [];
  for (const [y, drop] of valleys) {
    const last = deduped[deduped.length - 1];
    if (!last || y - last[0] > minGap) {
      deduped.push([y, drop]);
    } else if (drop > last[1]) {
      deduped[deduped.length - 1] = [y, drop];
    }
  }

  // Keep only the most prominent (expectedCards-1) valleys.
  const targetValleys = expectedCards - 1;
  let chosen: Array<[number, number]>;
  if (deduped.length <= targetValleys) {
    chosen = deduped;
  } else {
    chosen = [...deduped]
      .sort((a, b) => b[1] - a[1])
      .slice(0, targetValleys)
      .sort((a, b) => a[0] - b[0]);
  }

  const edges = [panelStart, ...chosen.map(([y]) => y), panelEnd + 1];
  const cards: Array<[number, number]> = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const s = edges[i], e = edges[i + 1];
    if (e - s > minCardH) cards.push([s, e]);
  }
  return cards;
}

/** Fallback threshold-crossing detection — used when valley finding underflows. */
function findCardBoundariesViaThreshold(
  density: Float32Array,
  frameHeight: number,
  minCardHeightRatio: number,
): Array<[number, number]> {
  const minCardH = Math.floor(frameHeight * minCardHeightRatio);
  const threshold = 0.12;
  const raw: Array<[number, number]> = [];
  let inCard = false;
  let start = 0;
  for (let y = 0; y < density.length; y++) {
    if (!inCard && density[y] > threshold) {
      start = y;
      inCard = true;
    } else if (inCard && density[y] < threshold) {
      if (y - start > minCardH) raw.push([start, y]);
      inCard = false;
    }
  }
  if (inCard && density.length - start > minCardH) raw.push([start, density.length]);

  if (raw.length === 0) return raw;

  const heights = raw.map(([s, e]) => e - s).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)];
  const cards: Array<[number, number]> = [];
  for (const [s, e] of raw) {
    const cardH = e - s;
    if (cardH > medianH * 1.6) {
      const n = Math.round(cardH / medianH);
      const subH = cardH / n;
      for (let j = 0; j < n; j++) {
        cards.push([Math.round(s + j * subH), Math.round(s + (j + 1) * subH)]);
      }
    } else {
      cards.push([s, e]);
    }
  }
  return cards;
}

/**
 * Re-split any card whose height exceeds 1.5x the median height.
 *
 * Used after either valley or threshold detection. Compute the median
 * height across all cards (using either the middle subset if we have
 * enough samples, or all of them), then for every card whose height
 * is significantly above median, divide it into round(cardH / median)
 * equal sub-cards. This recovers boundaries the row-density signal
 * collapsed because an animated chibi extended through the gap.
 *
 * If the median itself is suspect (fewer than 3 normal cards), don't
 * split — we'd create more chaos than we fix.
 */
function splitOversizedCards(
  cardsIn: Array<[number, number]>,
  expectedCards: number,
): Array<[number, number]> {
  let cards = cardsIn;
  if (cards.length === 0) return cards;

  // Use TRUE median across all cards. With one merged card (200px)
  // among 5 healthy ones (~100px), the sorted heights are
  // [100,100,100,100,100,200] and median = idx 3 = 100. Threshold
  // 1.6x catches the 200 cleanly while leaving normal variation
  // (95-110px) untouched.
  const heightsSorted = cards.map(([s, e]) => e - s).sort((a, b) => a - b);
  const medianH = heightsSorted[Math.floor(heightsSorted.length / 2)];
  if (medianH < 30) return cards;

  // Failure modes this function fixes (in order of resolution):
  //   1. Runts: panel header / "Done" button bleed into a tiny
  //      "card" (height < 55% of median). Drop them BEFORE
  //      splitting, otherwise the split-pruner mistakes a real
  //      slightly-undersized card (e.g. 123px vs median 130) for
  //      a runt and drops it instead.
  //   2. Gaps: cards.length === expected but a card was skipped
  //      (because its chibi color volume dropped below the panel
  //      threshold for that frame). Insert synthetic cards in any
  //      gap > 0.6x median between adjacent surviving cards.
  //   3. Merges: a single card is > 1.6x median because the row-
  //      density valley detector failed between two adjacent
  //      cards (e.g. an animated chibi extended through the gap).
  //      Split into round(cardH / median) equal sub-cards.
  const minH = heightsSorted[0];
  const maxH = heightsSorted[heightsSorted.length - 1];
  const hasRunt = minH < medianH * 0.55;
  const hasMerge = maxH > medianH * 1.6;
  let hasGap = false;
  for (let i = 1; i < cards.length; i++) {
    const gap = cards[i][0] - cards[i - 1][1];
    if (gap > medianH * 0.6) { hasGap = true; break; }
  }
  const shouldIntervene =
    cards.length < expectedCards || hasRunt || hasMerge || hasGap;
  if (!shouldIntervene) return cards;

  // Step 1: drop runts. Use a tighter threshold for first/last
  // cards (0.7x) since they catch panel-edge UI bleed (Done bar,
  // small trailing button strip) that the middle never sees. Use
  // a looser threshold for middle cards (0.55x) since middle
  // valley-detection artifacts are rarely THAT small unless they
  // really aren't a card.
  cards = cards.filter(([s, e], i) => {
    const h = e - s;
    const isEdge = i === 0 || i === cards.length - 1;
    const threshold = isEdge ? medianH * 0.7 : medianH * 0.55;
    return h >= threshold;
  });
  if (cards.length === 0) return [];

  // Step 2: fill gaps with synthetic cards.
  if (hasGap && cards.length > 1) {
    const gapFilled: Array<[number, number]> = [cards[0]];
    for (let i = 1; i < cards.length; i++) {
      const prev = gapFilled[gapFilled.length - 1];
      const gapStart = prev[1];
      const gapEnd = cards[i][0];
      const gapH = gapEnd - gapStart;
      if (gapH > medianH * 0.6) {
        const n = Math.max(1, Math.round(gapH / medianH));
        const subH = gapH / n;
        for (let j = 0; j < n; j++) {
          gapFilled.push([Math.round(gapStart + j * subH), Math.round(gapStart + (j + 1) * subH)]);
        }
      }
      gapFilled.push(cards[i]);
    }
    cards = gapFilled;
  }

  // Step 3: split merged cards greedily, prioritizing the MOST
  // merged ones, and stop as soon as we reach expectedCards. This
  // avoids over-splitting in cases like:
  //   • Top card = trainer banner + Azumarill (one merge)
  //   • Bottom card = Dragapult + Done button (header bleed, NOT a
  //     true merge — but still > 1.6x median)
  // Naive "split everything > 1.6x" produces 7 cards which then
  // forces the pruner to drop a real card. Greedy stop-at-expected
  // splits ONLY the topmost merge and leaves the bottom edge-bleed
  // for the dedicated edge-trim pass downstream.
  //
  // When cards.length is already >= expected, never split first/
  // last cards (treat as edge-bleed, will be trimmed).
  const onlyMiddle = cards.length >= expectedCards;
  type Cand = { idx: number; cardH: number; ratio: number };
  const candidates: Cand[] = [];
  for (let i = 0; i < cards.length; i++) {
    const cardH = cards[i][1] - cards[i][0];
    const isEdge = onlyMiddle && (i === 0 || i === cards.length - 1);
    if (!isEdge && cardH > medianH * 1.6) {
      candidates.push({ idx: i, cardH, ratio: cardH / medianH });
    }
  }
  candidates.sort((a, b) => b.ratio - a.ratio);

  // Decide which candidates to actually split: greedy fill until
  // total card count meets expected.
  const splitInto = new Map<number, number>();
  let runningCount = cards.length;
  for (const c of candidates) {
    const n = Math.max(2, Math.round(c.cardH / medianH));
    const added = n - 1;
    // If we're under-target, always split. Once we hit target,
    // only split if the card is REALLY merged (>2x median) AND
    // we're willing to absorb the prune cost.
    if (runningCount < expectedCards) {
      const cap = Math.min(n, n - (runningCount + added - expectedCards));
      const safeN = Math.max(2, cap);
      splitInto.set(c.idx, safeN);
      runningCount += safeN - 1;
    } else if (c.ratio >= 2.0) {
      splitInto.set(c.idx, n);
      runningCount += added;
    }
  }

  // When emitting sub-cards, use ANCHORED splits instead of even
  // geometric thirds. The merged region usually contains UI chrome
  // (trainer banner / Done bar) at one edge plus N real sprites.
  // Even split puts the boundary mid-sprite when the chrome is
  // ~50px and a sprite is ~130px (e.g. 332px region = 78 chrome +
  // 127 + 127). Anchoring guarantees each REAL sub-card is exactly
  // medianH pixels and the leftover slack collects in the chrome
  // sub-card (which the downstream first/last trim then shaves
  // down to medianH from the chrome side).
  let out: Array<[number, number]> = [];
  for (let i = 0; i < cards.length; i++) {
    const [s, e] = cards[i];
    const n = splitInto.get(i);
    if (!n) { out.push([s, e]); continue; }
    if (i === 0) {
      // First card → chrome at TOP. Anchor sub-cards to the BOTTOM
      // edge so the lowest sub-card lines up with the next real
      // card's top (preserving inter-card alignment), and the slack
      // accumulates in the topmost sub-card which downstream trim
      // shaves from above.
      const tops: Array<[number, number]> = [];
      for (let j = n - 1; j >= 0; j--) {
        const subEnd = j === n - 1 ? e : Math.round(e - (n - 1 - j) * medianH);
        const subStart = j === 0 ? s : Math.round(e - (n - j) * medianH);
        tops.unshift([subStart, subEnd]);
      }
      out.push(...tops);
    } else if (i === cards.length - 1) {
      // Last card → chrome at BOTTOM. Anchor to the TOP edge.
      for (let j = 0; j < n; j++) {
        const subStart = j === 0 ? s : Math.round(s + j * medianH);
        const subEnd = j === n - 1 ? e : Math.round(s + (j + 1) * medianH);
        out.push([subStart, subEnd]);
      }
    } else {
      // Middle card — no chrome bleed expected, geometric even split is fine.
      const subH = (e - s) / n;
      for (let j = 0; j < n; j++) {
        out.push([Math.round(s + j * subH), Math.round(s + (j + 1) * subH)]);
      }
    }
  }

  // Final safety net — if we somehow ended up with > expectedCards
  // (only when an excess merge had ratio >= 2.0), prune via height
  // + edge scoring.
  if (out.length > expectedCards) {
    out = filterToPokemonCardsByHeight(out, medianH, expectedCards);
  }
  return out;
}

/** Pick the `expectedCards` cards whose heights are closest to the
 *  estimated median, breaking ties by distance from the panel edge. */
function filterToPokemonCardsByHeight(
  cards: Array<[number, number]>,
  medianH: number,
  expectedCards: number,
): Array<[number, number]> {
  if (cards.length <= expectedCards) return cards;
  const panelStart = cards[0][0];
  const panelEnd = cards[cards.length - 1][1];
  const panelH = Math.max(1, panelEnd - panelStart);
  const scored = cards.map((c, i) => {
    const cardH = c[1] - c[0];
    const heightPenalty = Math.abs(cardH - medianH) / medianH;
    const centerY = (c[0] + c[1]) / 2;
    const relY = (centerY - panelStart) / panelH;
    let edgePenalty = 0;
    if (relY < 0.05 || relY > 0.95) edgePenalty = 0.5;
    return { score: heightPenalty + edgePenalty, index: i };
  });
  scored.sort((a, b) => a.score - b.score);
  const keep = new Set(scored.slice(0, expectedCards).map(s => s.index));
  return cards.filter((_, i) => keep.has(i));
}

/** Prune header / footer regions to leave the 6 Pokemon rows. */
function filterToPokemonCards(
  cards: Array<[number, number]>,
  frameHeight: number,
): Array<[number, number]> {
  if (cards.length <= 6) return cards;

  const heights = cards.map(([s, e]) => e - s).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 1;

  const scored = cards.map(([s, e], i) => {
    const cardH = e - s;
    const heightPenalty = Math.abs(cardH - medianH) / medianH;
    const centerY = (s + e) / 2 / frameHeight;
    let edgePenalty = 0;
    if (centerY < 0.1 || centerY > 0.92) edgePenalty = 0.5;
    else if (centerY < 0.15 || centerY > 0.88) edgePenalty = 0.2;
    return { score: heightPenalty + edgePenalty, index: i };
  });

  scored.sort((a, b) => a.score - b.score);
  const keep = new Set(scored.slice(0, 6).map(s => s.index));
  return cards.filter((_, i) => keep.has(i));
}

/** Average mask column density across all card rows — used to find x-bounds. */
function columnDensityAcrossCards(
  mask: MutableMask,
  cards: Array<[number, number]>,
): Float32Array {
  const { data, width } = mask;
  const out = new Float32Array(width);
  for (const [y1, y2] of cards) {
    for (let y = y1; y < y2; y++) {
      const base = y * width;
      for (let x = 0; x < width; x++) {
        if (data[base + x]) out[x] += 1;
      }
    }
  }
  // Normalize by total rows
  const totalRows = cards.reduce((acc, [s, e]) => acc + (e - s), 0) || 1;
  for (let x = 0; x < width; x++) out[x] = out[x] / totalRows;
  return out;
}

interface PanelResult {
  cards: CardRegion[];
  bounds: { x1: number; y1: number; x2: number; y2: number } | null;
}

function detectPanel(
  hsv: HsvView,
  frameW: number,
  frameH: number,
  scanXStart: number,
  scanXEnd: number,
  colorFn: ColorFn,
  spriteSide: 'left' | 'right',
  panelType: 'opponent' | 'player',
  minCardHeightRatio: number,
  expectedCards: number,
): PanelResult {
  const xLo = Math.floor(frameW * scanXStart);
  const xHi = Math.floor(frameW * scanXEnd);
  if (xHi <= xLo + 10) return { cards: [], bounds: null };

  let mask = colorFn(hsv, xLo, xHi);
  mask = morphClose(mask, 5);
  mask = morphOpen(mask, 5);

  const density = rowDensity(mask);
  let rawCards = findCardBoundariesViaValleys(density, frameH, minCardHeightRatio, expectedCards);
  if (rawCards.length < expectedCards - 2) {
    rawCards = findCardBoundariesViaThreshold(density, frameH, minCardHeightRatio);
    rawCards = filterToPokemonCards(rawCards, frameH);
  }

  // Post-process: split any card whose height is > 1.5x the median.
  // The valley detector intermittently misses the boundary between two
  // adjacent cards when an in-card chibi animation pushes density
  // through the gap (e.g. Azumarill's ear into the Umbreon card above
  // it). The result is one ~200px "card" containing two sprites
  // stacked vertically, with the matcher seeing a frankenchimera and
  // returning garbage. Re-splitting the oversized card into N evenly
  // sized pieces (where N = round(cardH / median)) recovers the lost
  // boundary geometrically — not as accurate as a true valley but far
  // better than a merged card.
  rawCards = splitOversizedCards(rawCards, expectedCards);

  if (rawCards.length < 5 || rawCards.length > 7) return { cards: [], bounds: null };

  const colDensity = columnDensityAcrossCards(mask, rawCards);
  const brightCols: number[] = [];
  for (let x = 0; x < colDensity.length; x++) if (colDensity[x] > 0.5) brightCols.push(x);
  if (brightCols.length < 10) return { cards: [], bounds: null };

  const panelXStart = xLo + brightCols[0];
  const panelXEnd = xLo + brightCols[brightCols.length - 1];
  const cardWidth = panelXEnd - panelXStart;

  // Card-height normalization: the row-density valley detector cleanly
  // segments middle cards but the FIRST and LAST cards in a panel often
  // have no valley above/below them, so their bounds extend to the
  // panel edge. This drags the panel header (e.g. "Jadarina" trainer
  // banner) into the first card and the "Done" button bar into the
  // last card. The headers/footers then leak into the spriteBbox and
  // poison the matcher.
  //
  // Fix: compute the median card height from the middle cards (which
  // ARE bounded by valleys on both sides) and trim outliers down to
  // that height. First card trims from the TOP (its body sits at the
  // BOTTOM of the inflated region); last card trims from the BOTTOM
  // (its body sits at the TOP).
  const middleHeights = rawCards.slice(1, -1).map(([s, e]) => e - s);
  const medianH = middleHeights.length > 0
    ? [...middleHeights].sort((a, b) => a - b)[Math.floor(middleHeights.length / 2)]
    : 0;
  // Lowered threshold from 1.3 → 1.2 so cards that are just barely
  // oversized (e.g. opponent last card 165px vs 127 median = 1.30
  // exactly) get the Done-bar slack trimmed instead of squeaking
  // under the threshold. Middle cards still allowed to grow up to
  // 1.5× without trim (natural valley-detector slop).
  const EDGE_TRIM_RATIO = 1.2;
  const MIDDLE_TRIM_RATIO = 1.5;
  const trimmedCards: [number, number][] = rawCards.map(([yStart, yEnd], i) => {
    if (medianH === 0) return [yStart, yEnd];
    const h = yEnd - yStart;
    const isEdge = i === 0 || i === rawCards.length - 1;
    const ratio = isEdge ? EDGE_TRIM_RATIO : MIDDLE_TRIM_RATIO;
    if (h <= medianH * ratio) return [yStart, yEnd];
    if (i === 0) return [yEnd - medianH, yEnd];
    if (i === rawCards.length - 1) return [yStart, yStart + medianH];
    // Middle card oversized — center the trim around the existing
    // midpoint to bias the chibi to the crop center.
    const mid = (yStart + yEnd) / 2;
    return [Math.round(mid - medianH / 2), Math.round(mid + medianH / 2)];
  });

  // Neighbor-rebalance pass: when the valley detector places a
  // boundary INSIDE what should be a card (e.g. between card 4's
  // bottom and card 5's badge glow on f_00697), two adjacent cards
  // end up with skewed heights but summing to ~2*medianH. The
  // row-level splitOversizedCards only intervenes at ratio > 1.6, so
  // a 1.24×-median tall-card paired with a 0.73×-median short-card
  // sneaks through and the matcher sees two half-sprites instead.
  //
  // Detection: pair (i, i+1) where one side is >= 1.15*median AND the
  // other is <= 0.9*median AND their summed height is within 15% of
  // 2*median (so this is genuinely a misplaced boundary, not two
  // cards of genuinely different sizes).
  //
  // Fix: move the boundary between them so both cards equal medianH
  // exactly, centered within the pair's span.
  if (medianH > 0 && trimmedCards.length >= 2) {
    for (let i = 0; i < trimmedCards.length - 1; i++) {
      const a = trimmedCards[i];
      const b = trimmedCards[i + 1];
      const hA = a[1] - a[0];
      const hB = b[1] - b[0];
      const sum = hA + hB;
      const expectedSum = 2 * medianH;
      const sumOk = Math.abs(sum - expectedSum) / expectedSum < 0.15;
      const aTallBShort = hA >= medianH * 1.15 && hB <= medianH * 0.9;
      const aShortBTall = hB >= medianH * 1.15 && hA <= medianH * 0.9;
      if (!sumOk || (!aTallBShort && !aShortBTall)) continue;
      const spanStart = a[0];
      const spanEnd = b[1];
      const spanMid = Math.round((spanStart + spanEnd) / 2);
      trimmedCards[i] = [a[0], spanMid];
      trimmedCards[i + 1] = [spanMid, b[1]];
    }
  }

  const cards: CardRegion[] = [];
  for (const [yStart, yEnd] of trimmedCards) {
    const cardH = yEnd - yStart;
    const padX = Math.floor(cardWidth * 0.02);
    const padY = Math.floor(cardH * 0.05);

    // Opponent sprites live on the LEFT of their card; player sprites on the right.
    // Player panel needs a tighter left crop (x ≥ 78%) because x=65-78% of each
    // card contains the gender symbol (♂/♀) — a high-saturation pink/blue blob
    // that survives the background mask and pollutes the signature. Validated
    // against the gameplay.mp4 regression: Umbreon / Houndoom / Dragapult match
    // dramatically better when the icon is fully excluded.
    //
    // Vertical crop: 6-94% (was 12-92%). The original tighter window
    // clipped tall chibis (Tyranitar's head spikes were sliced off in
    // f257s player slot 3). Loosening too aggressively (4-96%) pulled
    // bright cyan/violet border pixels into the histogram and flipped
    // Azumarill→Ampharos-Mega. 6-94% is the safe middle: enough head
    // room for spikes / horns without dragging border colors into the
    // signature.
    const spriteBbox = spriteSide === 'left'
      ? { x1: padX, y1: padY, x2: Math.floor(cardWidth * 0.55), y2: cardH - padY }
      : {
          x1: Math.floor(cardWidth * 0.78),
          y1: Math.floor(cardH * 0.06),
          x2: cardWidth - padX,
          y2: Math.floor(cardH * 0.94),
        };

    // Green-highlight detection for the active player card.
    let isHighlighted = false;
    if (panelType === 'player') {
      let greenHits = 0;
      let samples = 0;
      for (let y = yStart; y < yEnd; y += 2) {
        for (let x = panelXStart; x < panelXEnd; x += 2) {
          const si = y * hsv.width + x;
          samples++;
          if (hsv.h[si] > 25 && hsv.h[si] < 50 && hsv.s[si] > 80) greenHits++;
        }
      }
      isHighlighted = samples > 0 && greenHits / samples > 0.15;
    }

    cards.push({
      yStart,
      yEnd,
      xStart: panelXStart,
      xEnd: panelXEnd,
      spriteBbox,
      isHighlighted,
      panel: panelType,
    });
  }

  const bounds = {
    x1: panelXStart,
    y1: trimmedCards[0][0],
    x2: panelXEnd,
    y2: trimmedCards[trimmedCards.length - 1][1],
  };

  return { cards, bounds };
}

/**
 * Detects the telltale "X close" badge + "Battle Info" label in the
 * very top-right of the frame. Returns true if the ROI contains
 * enough near-white (low-sat, high-value) pixels to indicate the
 * battle-info overlay is active. The threshold is deliberately loose
 * (2%) because the real badge consistently registers 3-4% while
 * real team-select registers <1%.
 */
function detectBattleInfoBadge(hsv: HsvView, width: number, height: number): boolean {
  const { s, v, width: hsvW } = hsv;
  const x0 = Math.floor(width * 0.80);
  const y0 = Math.floor(height * 0.005);
  const x1 = Math.floor(width * 0.90);
  const y1 = Math.floor(height * 0.055);
  let hits = 0;
  let total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * hsvW + x;
      total++;
      if (s[i] < 40 && v[i] > 200) hits++;
    }
  }
  if (total === 0) return false;
  const frac = hits / total;
  return frac > 0.02;
}

/**
 * Score the detection based on expected card counts + consistency
 * (matches the Python `_compute_confidence`).
 */
function computeConfidence(opp: CardRegion[], player: CardRegion[]): number {
  let score = 0;

  if (opp.length === 6) score += 0.3;
  else if (opp.length >= 5) score += 0.2;

  if (player.length === 6) score += 0.3;
  else if (player.length >= 5) score += 0.2;

  if (opp.length > 0) {
    const heights = opp.map(c => c.yEnd - c.yStart);
    const mean = heights.reduce((a, b) => a + b, 0) / heights.length;
    const variance = heights.reduce((acc, h) => acc + (h - mean) ** 2, 0) / heights.length;
    const stddev = Math.sqrt(variance);
    const cv = mean > 0 ? stddev / mean : 1;
    if (cv < 0.15) score += 0.2;
  }

  if (opp.length >= 5 && player.length >= 5) score += 0.2;
  return Math.min(1, score);
}

export function detectFrame(
  source: PixelView,
  config: FrameDetectorConfig = {},
): FrameDetection {
  const minCardHeightRatio = config.minCardHeightRatio ?? 0.05;
  const expectedCards = config.expectedCards ?? 6;

  const result: FrameDetection = {
    isTeamSelect: false,
    isLineupScreen: false,
    mode: 'none',
    confidence: 0,
    opponentCards: [],
    playerCards: [],
    opponentPanelBounds: null,
    playerPanelBounds: null,
    playerLockBadgeSlots: [],
  };

  const hsv = toHsv(source);

  // Opponent panel: right side, crimson
  const opp = detectPanel(
    hsv, source.width, source.height,
    0.65, 1.0,
    crimsonMask, 'left', 'opponent',
    minCardHeightRatio, expectedCards,
  );

  // Player panel: left side, blue + green
  const player = detectPanel(
    hsv, source.width, source.height,
    0.0, 0.4,
    blueGreenMask, 'right', 'player',
    minCardHeightRatio, expectedCards,
  );

  // Both panels must segment cleanly. Requiring only the opponent strip
  // (the Python original) allows false positives from:
  //   • move-animation crimson floods (e.g. Dark Pulse) → opp mask
  //     detects 5-6 phantom rows while player panel is 0.
  //   • the in-battle "Battle Info" overlay (Y button), which reuses the
  //     opponent card strip but has no selectable player panel.
  // Real team-select reliably produces 5+ cards on BOTH sides.
  const haveSelectionPanels = opp.cards.length >= 5 && player.cards.length >= 5;

  // ── Lock-screen fallback ───────────────────────────────────────
  // The selection-screen blue/green mask returns 0 player cards on the
  // LOCK screen because each card is tinted by its Pokémon's primary
  // type (yellow/red/purple/...). Run a second pass on the player half
  // with `anyTypeColorCardMask` and treat *that* as a lock detection.
  // The opponent crimson mask works the same on both screens, so we
  // only retry the player side.
  let lockPlayer: PanelResult = { cards: [], bounds: null };
  let usingLockPlayer = false;
  if (!haveSelectionPanels && opp.cards.length >= 5) {
    lockPlayer = detectPanel(
      hsv, source.width, source.height,
      0.0, 0.4,
      anyTypeColorCardMask, 'right', 'player',
      minCardHeightRatio, expectedCards,
    );
    if (lockPlayer.cards.length >= 5) {
      if (looksLikeTrueLockScreen(hsv, lockPlayer.cards)) {
        usingLockPlayer = true;
      }
    }
  }

  // The "Battle Info" overlay from the Y-button menu during combat has
  // both panels populated (left: active-battle Pokemon w/ HP bars,
  // right: opponent card stack) AND the same crimson/blue mask signals
  // as a real team-select. Its distinguishing feature is the small
  // white "X close" badge + "Battle Info" label in the very top-right
  // of the frame. Real team-select has a dark/colored top-right
  // (tournament signage) with near-zero white content.
  // Threshold calibrated from the gameplay.mp4 regression: real
  // team-select frames score <1% white pixels in this ROI while
  // battle-info overlays consistently score 3-4%.
  if (detectBattleInfoBadge(hsv, source.width, source.height)) return result;

  if (haveSelectionPanels) {
    // Both selection AND lock screens can satisfy `haveSelectionPanels`
    // because the lock-screen player panel mixes type tints — blue
    // (water/flying), green (grass/bug), etc. — that the blue/green
    // mask happens to catch. Hue-based disambiguation is unreliable
    // here: chibi/badge color leakage scatters Layout-A (selection-in-
    // progress) cards across hue buckets just as much as true lock
    // cards. We instead require evidence of an actual lock-screen
    // affordance — a number badge (white roundel on the left edge of
    // selected cards) — via `looksLikeTrueLockScreen`.
    if (looksLikeTrueLockScreen(hsv, player.cards)) {
      // Player-side card detection on lock screens is unreliable:
      // `anyTypeColorCardMask` matches stadium lighting/audience, and
      // even `blueGreenMask` only catches a subset of type tints. The
      // opponent panel however is rock-solid (uniform crimson). Since
      // both panels' cards are y-aligned on the lock screen we mirror
      // the opponent's row boundaries onto the player panel and only
      // need to discover the player x-extent.
      const playerXBounds = lockPlayerXBounds(hsv, source.width);
      const playerCardsFromOpp = mirrorRowsToPanel(opp.cards, playerXBounds, 'player');
      // Compute badges FIRST — the per-slot sprite crop geometry
      // depends on whether a given card has a badge (locked cards
      // shift the chibi right to make room for the number roundel).
      const badgeSlots = badgeSlotsFrom(hsv, playerCardsFromOpp);
      const badgeSet = new Set(badgeSlots);
      result.isTeamSelect = false;
      result.isLineupScreen = true;
      result.mode = 'lock';
      result.opponentCards = opp.cards.map(c => relayoutLockOpponentCard(c));
      result.opponentPanelBounds = opp.bounds;
      result.playerCards = playerCardsFromOpp.map((c, i) =>
        relayoutLockPlayerCard(c, badgeSet.has(i)),
      );
      result.playerPanelBounds = {
        x1: playerXBounds.x1,
        y1: opp.bounds?.y1 ?? 0,
        x2: playerXBounds.x2,
        y2: opp.bounds?.y2 ?? source.height,
      };
      result.confidence = computeConfidence(opp.cards, playerCardsFromOpp);
      result.playerLockBadgeSlots = badgeSlots;
      return result;
    }

    result.isTeamSelect = true;
    result.isLineupScreen = true;
    result.mode = 'selection';
    result.opponentCards = opp.cards;
    result.opponentPanelBounds = opp.bounds;
    result.playerCards = player.cards;
    result.playerPanelBounds = player.bounds;
    result.confidence = computeConfidence(opp.cards, player.cards);
    return result;
  }

  if (usingLockPlayer) {
    // Same fix as the haveSelectionPanels branch: the opponent's row
    // boundaries are reliable, the player retry's are not. Use the
    // opponent's y-bounds for both panels' cards and only adopt the
    // player retry's x-extent.
    const playerXBounds = lockPlayerXBounds(hsv, source.width);
    const mirroredPlayerCards = mirrorRowsToPanel(opp.cards, playerXBounds, 'player');
    // Compute badges on the UN-relayout mirrored cards (full card
    // width; badges sit on the left edge, same region regardless of
    // chibi crop geometry). Then build per-slot relayout using the
    // badge info so locked cards skip the number roundel.
    const badgeSlots = badgeSlotsFrom(hsv, mirroredPlayerCards);
    const badgeSet = new Set(badgeSlots);
    const lockPlayerCards = mirroredPlayerCards.map((c, i) =>
      relayoutLockPlayerCard(c, badgeSet.has(i)),
    );
    const lockOppCards = opp.cards.map(c => relayoutLockOpponentCard(c));
    result.isTeamSelect = false;
    result.isLineupScreen = true;
    result.mode = 'lock';
    result.opponentCards = lockOppCards;
    result.opponentPanelBounds = opp.bounds;
    result.playerCards = lockPlayerCards;
    result.playerPanelBounds = {
      x1: playerXBounds.x1,
      y1: opp.bounds?.y1 ?? 0,
      x2: playerXBounds.x2,
      y2: opp.bounds?.y2 ?? source.height,
    };
    result.confidence = computeConfidence(opp.cards, lockPlayerCards);
    result.playerLockBadgeSlots = badgeSlots;
    return result;
  }

  return result;
}

/**
 * Identify which player-card slots carry a visible selection-order
 * number badge. A badge renders as a solid-white roundel (~0.12–0.30
 * of the left-40 % × middle-60 % ROI). Slots are returned in card
 * order (top-to-bottom), which corresponds to the player's team
 * roster order as surfaced by the selection consensus.
 */
function badgeSlotsFrom(hsv: HsvView, cards: CardRegion[]): number[] {
  if (cards.length === 0) return [];
  const ratios = cardWhiteBadgeRatios(hsv, cards);
  const out: number[] = [];
  for (let i = 0; i < ratios.length; i++) {
    if (ratios[i] >= 0.12) out.push(i);
  }
  return out;
}

// ─── Lock-screen helpers ────────────────────────────────────────────

/**
 * Per-card "presence of selection-order number badge" probe. Returns
 * the count of cards in `cards` that show a clear white badge in the
 * left ~40 % × middle 60 % region. The number badges (1/2/3) on a true
 * lock screen render as solid-white roundels with a dark numeral and
 * cover ≥15 % of that ROI when present.
 *
 * Used as the dominant signal for `looksLikeTrueLockScreen` because
 * hue-based heuristics (per-card type tints) cannot distinguish
 * selection-in-progress (uniform blue cards with name+item text) from
 * true lock screens (type-tinted cards with number badges) — both
 * scatter across hue buckets due to chibi/badge color leakage.
 */
function cardWhiteBadgeRatios(
  hsv: HsvView,
  cards: CardRegion[],
): number[] {
  const out: number[] = [];
  for (const card of cards) {
    const cardW = card.xEnd - card.xStart;
    const cardH = card.yEnd - card.yStart;
    const xLo = Math.max(0, card.xStart + Math.floor(cardW * 0.05));
    const xHi = Math.min(hsv.width, card.xStart + Math.floor(cardW * 0.40));
    const yLo = Math.max(0, card.yStart + Math.floor(cardH * 0.20));
    const yHi = Math.min(hsv.height, card.yStart + Math.floor(cardH * 0.80));
    let white = 0;
    let sampled = 0;
    for (let y = yLo; y < yHi; y++) {
      for (let x = xLo; x < xHi; x++) {
        const i = y * hsv.width + x;
        sampled++;
        if (hsv.v[i] > 200 && hsv.s[i] < 70) white++;
      }
    }
    out.push(sampled > 0 ? white / sampled : 0);
  }
  return out;
}

/**
 * Decide whether a player-card stack belongs to a *true* lock screen
 * ("Standing By" / "Preparing for Battle") rather than a selection-in-
 * progress screen that happens to share the colourful card aesthetic.
 *
 * The reliable discriminator is the **minimum** per-card white-pixel
 * ratio (in the badge/name region):
 *
 *   • Selection-in-progress (Layout A): every card carries the
 *     Pokémon-name text in white, so EVERY card produces a non-trivial
 *     white ratio (≥0.08). Even cards without a number badge still
 *     show the name.
 *   • True lock screen (Layout B): only the 2–3 cards sent into battle
 *     carry a white number badge (1/2/3); the remaining cards show
 *     just chibi + type icons with NO white text at all (ratio ≤0.03).
 *
 * We additionally require ≥1 card with a strong badge (ratio ≥ 0.12)
 * to guard against rare edge cases where a near-empty card from a
 * non-team-select screen leaks through with very low whites everywhere.
 *
 * Calibration data (gameplay.mp4 sampled frames):
 *   Layout A min ratio range: 0.08 – 0.17  (n=6 frames)
 *   Layout B min ratio range: 0.00 – 0.02  (n=6 frames)
 */
function looksLikeTrueLockScreen(
  hsv: HsvView,
  cards: CardRegion[],
): boolean {
  if (cards.length < 5) return false;
  const ratios = cardWhiteBadgeRatios(hsv, cards);
  // True lock: typically 3 cards "selected" (white badge → high ratio)
  // and 3 cards "not selected" (no badge AND no name text → ~0 ratio).
  // Layout-A misalignment may produce a single near-zero card from a
  // mis-segmented row; require ≥2 near-zero cards to filter that out.
  const nearZero = ratios.filter(r => r < 0.05).length;
  const strongBadges = ratios.filter(r => r >= 0.12).length;
  return nearZero >= 2 && strongBadges >= 1;
}

/**
 * Find the horizontal extent of the lock-screen player panel by
 * scanning column-density of well-saturated, mid-tone pixels in the
 * left half of the frame. The cards have a consistent ~0.55 width
 * fraction relative to the player panel column band.
 *
 * Why a dedicated helper: `detectPanel` for the player side returns
 * unreliable y-bounds on lock screens because every saturated stadium
 * pixel passes the type-color filter. But the *x*-extent is stable —
 * the player panel always sits in the leftmost ~40% of the frame, and
 * we just need to find the densest contiguous column band there.
 */
function lockPlayerXBounds(hsv: HsvView, frameWidth: number): { x1: number; x2: number } {
  // Search across the leftmost 45% of the frame — the player panel
  // never extends past the centre clock/divider.
  const xMax = Math.floor(frameWidth * 0.45);
  // Restrict the y-band to the middle 80% of the frame so we sample
  // the card stack and not the dark stadium ceiling/floor.
  const { h, s, v, height, width } = hsv;
  const yLo = Math.floor(height * 0.10);
  const yHi = Math.floor(height * 0.90);
  const ySpan = yHi - yLo;
  const colDensity = new Float32Array(xMax);
  let maxDensity = 0;
  for (let x = 0; x < xMax; x++) {
    let count = 0;
    for (let y = yLo; y < yHi; y++) {
      const i = y * width + x;
      const H = h[i], S = s[i], V = v[i];
      if (H >= 150 && H <= 179) continue;     // crimson is opponent
      if (S < 60 || V < 60 || V > 235) continue;
      count++;
    }
    const d = count / Math.max(1, ySpan);
    colDensity[x] = d;
    if (d > maxDensity) maxDensity = d;
  }
  // Adaptive threshold: 60% of the max column density. The player
  // card band has density ≥0.7, while stadium fill rarely exceeds 0.4
  // — so a relative threshold cleanly separates them across lighting
  // conditions.
  const thresh = Math.max(0.40, maxDensity * 0.60);
  let bestStart = -1, bestEnd = -1, bestLen = 0;
  let runStart = -1;
  for (let x = 0; x < xMax; x++) {
    if (colDensity[x] >= thresh) {
      if (runStart === -1) runStart = x;
    } else if (runStart !== -1) {
      const runLen = x - runStart;
      if (runLen > bestLen) { bestLen = runLen; bestStart = runStart; bestEnd = x; }
      runStart = -1;
    }
  }
  if (runStart !== -1 && xMax - runStart > bestLen) {
    bestStart = runStart;
    bestEnd = xMax;
  }
  // Fallback to a generous default band if we couldn't find a stable run.
  if (bestStart === -1 || bestEnd - bestStart < frameWidth * 0.15) {
    return { x1: Math.floor(frameWidth * 0.10), x2: Math.floor(frameWidth * 0.38) };
  }
  return { x1: bestStart, x2: bestEnd };
}

/**
 * Mirror the y-row boundaries of one panel's cards onto another panel.
 * Used on the lock screen where the opponent's row detection is
 * reliable but the player's isn't — we just clone y-bounds and swap in
 * the player x-extent + panel label.
 */
function mirrorRowsToPanel(
  sourceCards: CardRegion[],
  xBounds: { x1: number; x2: number },
  panel: 'player' | 'opponent',
): CardRegion[] {
  return sourceCards.map((c, i) => ({
    yStart: c.yStart,
    yEnd: c.yEnd,
    xStart: xBounds.x1,
    xEnd: xBounds.x2,
    panel,
    index: i,
    spriteBbox: { x1: 0, y1: 0, x2: xBounds.x2 - xBounds.x1, y2: c.yEnd - c.yStart },
    // Mirrored rows inherit only geometry — we don't know the
    // highlight state on the mirrored side, so we conservatively
    // treat it as not highlighted. The lock-screen flow picks the
    // highlighted slot from badge detection instead of this flag.
    isHighlighted: false,
  }));
}

/**
 * Lock-screen player card layout, measured by rendering slot 0 (locked) and
 * slot 1 (unlocked) from gameplay.mp4 f_00285 with a 10%-grid overlay
 * (see .video-review/slot0-grid.png / slot1-grid.png).
 *
 *   LOCKED (badge present):
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ gutter │ card bg │ badge  │  chibi   │ type icons │ gender      │
 *   │ [0-12] │ [12-54] │[17-28] │ [28-52]  │  [52-78]   │  [78-82]    │
 *   └────────────────────────────────────────────────────────────────┘
 *
 *   UNLOCKED (no badge):
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ gutter │ card bg │  chibi   │ type icons │ gender               │
 *   │ [0-8]  │ [8-58]  │ [22-42]  │  [58-72]   │  [48-55]             │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Note that the CHIBI SHIFTS RIGHT by ~6% on locked cards to make room
 * for the order-number badge. A single fixed crop cannot accommodate
 * both states. Per-slot geometry driven by the badge signal is the fix.
 *
 * The chibis themselves are the SAME 2D menu icons as the selection
 * screen; with a tight crop the matcher resolves all 6 player picks
 * end-to-end.
 */
function relayoutLockPlayerCard(card: CardRegion, hasBadge: boolean): CardRegion {
  const cardW = card.xEnd - card.xStart;
  const cardH = card.yEnd - card.yStart;
  const xFracLo = hasBadge ? 0.26 : 0.16;
  const xFracHi = hasBadge ? 0.54 : 0.46;
  return {
    ...card,
    spriteBbox: {
      x1: Math.floor(cardW * xFracLo),
      y1: Math.floor(cardH * 0.06),
      x2: Math.floor(cardW * xFracHi),
      y2: Math.floor(cardH * 0.94),
    },
  };
}

/**
 * Lock-screen opponent card layout (left → right):
 *   [chibi ~55%] [type icons ~30%] [gender ~15%]
 * Chibi takes the LEFT half. Same as player, minus the number badge,
 * so we shift the crop slightly to the left.
 */
function relayoutLockOpponentCard(card: CardRegion): CardRegion {
  const cardW = card.xEnd - card.xStart;
  const cardH = card.yEnd - card.yStart;
  return {
    ...card,
    spriteBbox: {
      x1: Math.floor(cardW * 0.04),
      y1: Math.floor(cardH * 0.06),
      x2: Math.floor(cardW * 0.55),
      y2: Math.floor(cardH * 0.94),
    },
  };
}

// ─── Small helpers exposed to tests / downstream ────────────────────

/**
 * Extract the full card RGBA sub-image for a given CardRegion. Useful
 * for both mask extraction and matcher input.
 */
export function cropCard(src: PixelView, card: CardRegion): PixelView {
  const w = card.xEnd - card.xStart;
  const h = card.yEnd - card.yStart;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const si = ((card.yStart + row) * src.width + card.xStart) * 4;
    out.set(src.data.subarray(si, si + w * 4), row * w * 4);
  }
  return { data: out, width: w, height: h };
}
