/**
 * Result screen detector — HSV-based W/L screen classifier.
 *
 * The post-match screen always shows the PLAYER on the LEFT and the
 * OPPONENT on the RIGHT. The side that won gets a red/gold victory
 * BANNER behind golden "WON!" text; the side that lost gets silver
 * "LOST…" text floating over the floor. Because the split is fixed,
 * the player's result is whatever is on the left — gold text = win,
 * silver text = loss.
 *
 * Signals (all measured as HSV pixel fractions, percent):
 *
 *   centerDark  — Dark vertical divider between the two characters.
 *                 Structural gate; filters out every non-split-screen
 *                 layout (menus, cinematics, lineup screens, etc.).
 *
 *   goldLeft    — Gold WON! text on the player's side     → win signal
 *   silverLeft  — Silver LOST… text on the player's side  → loss signal
 *   goldRight   — Gold WON! text on the opponent's side   → loss signal
 *   silverRight — Silver LOST… text on the opponent side  → win signal
 *
 *   badgeRedLeft  — Red victory-banner pixels on the left  → win signal
 *   badgeRedRight — Red victory-banner pixels on the right → loss signal
 *
 * Gate:
 *
 *   isResult = centerDark > threshold        (structural, ALWAYS required)
 *              AND (winPattern OR lossPattern)
 *
 *     winPattern  = (goldLeft ≥ goldT  AND silverRight ≥ silverT)
 *                   AND badgeRedLeft  ≥ badgeT         (banner on your side)
 *     lossPattern = (silverLeft ≥ silverT AND goldRight  ≥ goldT)
 *                   AND badgeRedRight ≥ badgeT         (banner on opp side)
 *
 * Requiring the badge AND the text on the expected sides rejects
 * false positives where a single gold Pokéball blob or a dark
 * bracket graphic might trigger one colour channel on its own.
 *
 * Outcome:
 *
 *   WIN  if winPattern  AND NOT lossPattern
 *   LOSS if lossPattern AND NOT winPattern
 *   Ambiguous-double-pattern → higher (goldX + silverY) wins
 *
 * Historical note: up to 2026-04 the gate read ONLY the
 * win-side variants of badgeRed/silverText, which meant an actual
 * loss frame would be rejected here and never classified at all.
 * The symmetric gate below makes the left-side-is-you contract
 * work for both outcomes.
 *
 * Input: RGBA PixelView (HTMLCanvasElement ImageData or the Node
 * canvas package's ImageData).
 */

import type { HsvView, PixelView } from './image.ts';
import { toHsv } from './image.ts';

export interface ResultDetectorConfig {
  badgeRedThreshold?: number;
  silverTextThreshold?: number;
  centerDarkThreshold?: number;
  goldWinThreshold?: number;
}

export interface ResultSignals {
  /** @deprecated alias for `badgeRedLeft`, kept for audit-log compat. */
  badgeRed: number;
  centerDark: number;
  /** Red banner pixels in the left-lower quadrant (win-side badge). */
  badgeRedLeft: number;
  /** Red banner pixels in the right-lower quadrant (loss-side badge). */
  badgeRedRight: number;
  /** Gold WON! text in left-center region. */
  goldLeft: number;
  /** Silver LOST… text in left-center region. */
  silverLeft: number;
  /** Gold WON! text in right-center region. */
  goldRight: number;
  /** Silver LOST… text in right-center region. */
  silverRight: number;
  /** Reason the detector rejected (or accepted) the frame. Aids
   *  auditing via the Detection Trail metadata. */
  decision?: string;
}

export interface ResultDetection {
  isResultScreen: boolean;
  confidence: number;
  outcome: 'win' | 'loss' | null;
  signals: ResultSignals;
}

const DEFAULTS = {
  // Raised from 8% → 12%. The recruit screen's red Pokeball/capture
  // effect was saturating this signal on its own.
  badgeRedThreshold: 12.0,
  silverTextThreshold: 8.0,
  // Raised from 45% → 50%. The vertical divider column is ~4% of
  // frame width, and a genuine W/L gap between characters nearly
  // fills it (>60%), so 50 leaves comfortable headroom while
  // rejecting shadows/UI elements.
  centerDarkThreshold: 50.0,
  // Raised from 6% → 10%. The actual WON/LOST typography fills ~15%
  // of its bounding region, so 10 keeps real wins flagged while
  // blocking Pokeballs.
  goldWinThreshold: 10.0,
} as const;

/**
 * Fraction of pixels inside `[xLo, xHi) × [yLo, yHi)` whose HSV tuple
 * satisfies `predicate`. Returned as a percentage in `[0, 100]` to
 * match the Python implementation's `.mean() * 100`.
 */
function regionPercent(
  hsv: HsvView,
  xLo: number,
  xHi: number,
  yLo: number,
  yHi: number,
  predicate: (h: number, s: number, v: number) => boolean,
): number {
  const { h, s, v, width } = hsv;
  const x0 = Math.max(0, Math.min(width, Math.floor(xLo)));
  const x1 = Math.max(x0, Math.min(width, Math.floor(xHi)));
  const y0 = Math.max(0, Math.min(hsv.height, Math.floor(yLo)));
  const y1 = Math.max(y0, Math.min(hsv.height, Math.floor(yHi)));
  const total = (x1 - x0) * (y1 - y0);
  if (total <= 0) return 0;
  let hits = 0;
  for (let y = y0; y < y1; y++) {
    const row = y * width;
    for (let x = x0; x < x1; x++) {
      const i = row + x;
      if (predicate(h[i], s[i], v[i])) hits++;
    }
  }
  return (hits / total) * 100;
}

/**
 * Run the result-screen detector on a single frame.
 *
 * Mirrors `ResultDetector.detect` in `result_detector.py`: three
 * structural signals decide whether this is a result screen, then
 * gold vs silver in the left-center region decides win vs loss.
 */
export function detectResult(
  frame: PixelView,
  config: ResultDetectorConfig = {},
): ResultDetection {
  const badgeRedThreshold = config.badgeRedThreshold ?? DEFAULTS.badgeRedThreshold;
  const silverTextThreshold = config.silverTextThreshold ?? DEFAULTS.silverTextThreshold;
  const centerDarkThreshold = config.centerDarkThreshold ?? DEFAULTS.centerDarkThreshold;
  const goldWinThreshold = config.goldWinThreshold ?? DEFAULTS.goldWinThreshold;

  const hsv = toHsv(frame);
  const hImg = frame.height;
  const wImg = frame.width;

  // Structural signal — vertical dark gap between the two characters.
  // The single most unique feature of the post-match screen. Works
  // identically for wins and losses because the split geometry is
  // fixed regardless of outcome.
  const centerDark = regionPercent(
    hsv,
    wImg * 0.48, wImg * 0.52,
    hImg * 0.30, hImg * 0.80,
    (_h, _s, v) => v < 50,
  );

  // Red/gold victory banner — present on the WINNING side, lower
  // quadrant. Measured on BOTH sides so we can tell player-win
  // (banner left) from player-loss (banner right) purely by which
  // side lit up.
  const isRedBanner = (h: number, s: number, v: number) =>
    (h < 10 || h > 170) && s > 120 && v > 100;
  const badgeRedLeft = regionPercent(
    hsv,
    wImg * 0.15, wImg * 0.40,
    hImg * 0.65, hImg * 0.82,
    isRedBanner,
  );
  const badgeRedRight = regionPercent(
    hsv,
    wImg * 0.60, wImg * 0.85,
    hImg * 0.65, hImg * 0.82,
    isRedBanner,
  );

  // Gold WON! / silver LOST… typography signals, measured in the
  // center-vertical band on each side.
  const isGoldText = (h: number, s: number, v: number) =>
    h >= 15 && h <= 40 && s > 140 && v > 170;
  const isSilverText = (_h: number, s: number, v: number) =>
    s < 40 && v > 140 && v < 230;

  const goldLeft = regionPercent(
    hsv,
    wImg * 0.05, wImg * 0.45,
    hImg * 0.45, hImg * 0.75,
    isGoldText,
  );
  const silverLeft = regionPercent(
    hsv,
    wImg * 0.05, wImg * 0.45,
    hImg * 0.45, hImg * 0.75,
    isSilverText,
  );
  const goldRight = regionPercent(
    hsv,
    wImg * 0.55, wImg * 0.95,
    hImg * 0.45, hImg * 0.75,
    isGoldText,
  );
  const silverRight = regionPercent(
    hsv,
    wImg * 0.55, wImg * 0.90,
    hImg * 0.50, hImg * 0.70,
    isSilverText,
  );

  const signals: ResultSignals = {
    centerDark,
    badgeRed: badgeRedLeft, // legacy audit-log alias
    badgeRedLeft,
    badgeRedRight,
    goldLeft,
    silverLeft,
    goldRight,
    silverRight,
  };

  // Structural gate (always required). Lineup-selection screens also
  // produce a dark vertical middle strip (~77%!) which is why we
  // can't rely on this alone — the typography+banner gate below
  // catches those because they have no WON/LOST text anywhere.
  const structuralPass = centerDark > centerDarkThreshold;

  // Symmetric outcome gate. Either a win layout (gold WON! on the
  // player's left, red banner on the left, silver LOST on the right)
  // or a loss layout (silver LOST on the left, gold WON + red banner
  // on the right) must be fully present. Requiring the text AND the
  // banner on the expected side rejects the recruit screen (which
  // has a lone Pokéball that can trigger isolated gold or red) and
  // single-color cinematic spikes.
  const winPattern =
    goldLeft > goldWinThreshold &&
    silverRight > silverTextThreshold &&
    badgeRedLeft > badgeRedThreshold;
  const lossPattern =
    silverLeft > silverTextThreshold &&
    goldRight > goldWinThreshold &&
    badgeRedRight > badgeRedThreshold;

  if (!structuralPass || (!winPattern && !lossPattern)) {
    const reasons: string[] = [];
    if (!structuralPass) {
      reasons.push(`centerDark ${centerDark.toFixed(1)} ≤ ${centerDarkThreshold}`);
    }
    if (!winPattern && !lossPattern) {
      reasons.push(
        `no win/loss pattern: ` +
          `goldL=${goldLeft.toFixed(1)} silverL=${silverLeft.toFixed(1)} ` +
          `goldR=${goldRight.toFixed(1)} silverR=${silverRight.toFixed(1)} ` +
          `badgeL=${badgeRedLeft.toFixed(1)} badgeR=${badgeRedRight.toFixed(1)}`,
      );
    }
    signals.decision = `rejected: ${reasons.join(', ')}`;
    return {
      isResultScreen: false,
      confidence: 0,
      outcome: null,
      signals,
    };
  }

  // Decide WIN vs LOSS. Both patterns can't legitimately fire at the
  // same time (mutually exclusive banner sides) but fall back to
  // whichever layout has the stronger combined signal when the
  // frame is ambiguous (partial transitions, capture-effect
  // overlays, etc.).
  let outcome: 'win' | 'loss';
  if (winPattern && !lossPattern) {
    outcome = 'win';
  } else if (lossPattern && !winPattern) {
    outcome = 'loss';
  } else {
    const winStrength = goldLeft + silverRight + badgeRedLeft;
    const lossStrength = silverLeft + goldRight + badgeRedRight;
    outcome = winStrength >= lossStrength ? 'win' : 'loss';
  }

  signals.decision = `accepted ${outcome}`;

  const outcomeSignal =
    outcome === 'win'
      ? (Math.min(goldLeft, 20) / 20 + Math.min(silverRight, 20) / 20) / 2
      : (Math.min(silverLeft, 20) / 20 + Math.min(goldRight, 20) / 20) / 2;
  const badgeSignal =
    outcome === 'win'
      ? Math.min(badgeRedLeft, 20) / 20
      : Math.min(badgeRedRight, 20) / 20;
  const confidence = Math.min(
    1,
    badgeSignal * 0.3 +
      (Math.min(centerDark, 60) / 60) * 0.3 +
      outcomeSignal * 0.4,
  );

  return {
    isResultScreen: true,
    confidence,
    outcome,
    signals,
  };
}
