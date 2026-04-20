/**
 * Browser-side adapter between the new sprite detector and the existing
 * `ocrDetection.ts` data shapes.
 *
 * Handles:
 *   • Lazy loading of the serialized sprite database JSON.
 *   • Conversion of HTMLCanvasElement → PixelView.
 *   • Adapting `DetectionResult` → the `SpriteMatch` + slot-evaluation
 *     structures the existing UI expects.
 *
 * Node-side scripts talk to the detector directly — this module is
 * browser-only.
 */

import type { LineupFrameMode } from './frameDetector.ts';
import { detectPokemon, type DetectedPokemon, type DetectionResult } from './pokemonDetector.ts';
import { detectResult, type ResultDetection } from './resultDetector.ts';
import { loadSpriteDatabase, type SpriteDatabase } from './spriteDb.ts';

export type { LineupFrameMode };

export interface SpriteDetectorLoadState {
  loading: boolean;
  ready: boolean;
  error: string | null;
  entryCount: number;
}

let dbPromise: Promise<SpriteDatabase> | null = null;
let dbInstance: SpriteDatabase | null = null;
let dbError: string | null = null;

/**
 * Resolve the sprite DB URL against Vite's configured base path.
 * Using `import.meta.env.BASE_URL` means the same code works under
 * `/`, `/pokemonchampions/`, or any other base without hard-coding.
 */
const DEFAULT_DB_URL = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/sprite-detector-db.json`;

/**
 * Kick off a one-shot database load. Subsequent calls return the same
 * promise, so the JSON is only parsed once per session.
 */
export function loadSpriteDetectorDatabase(
  url = DEFAULT_DB_URL,
): Promise<SpriteDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = fetch(url)
    .then(async resp => {
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
      const payload = await resp.json();
      if (!payload || !Array.isArray(payload.entries)) {
        throw new Error('sprite DB payload missing `entries`');
      }
      dbInstance = loadSpriteDatabase(payload.entries);
      return dbInstance;
    })
    .catch(err => {
      dbError = err instanceof Error ? err.message : String(err);
      dbPromise = null;
      throw err;
    });
  return dbPromise;
}

export function getLoadState(): SpriteDetectorLoadState {
  return {
    loading: dbPromise !== null && !dbInstance,
    ready: dbInstance !== null,
    error: dbError,
    entryCount: dbInstance?.entries.length ?? 0,
  };
}

export function isSpriteDetectorReady(): boolean {
  return dbInstance !== null;
}

function canvasToPixelView(canvas: HTMLCanvasElement): {
  data: Uint8ClampedArray; width: number; height: number;
} {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas has no 2D context');
  const { width, height } = canvas;
  const id = ctx.getImageData(0, 0, width, height);
  return { data: id.data, width, height };
}

// ─── Adapted data shapes ─────────────────────────────────────────────

export interface AdaptedSpriteMatch {
  species: string;
  confidence: number;
  isShiny: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  side: 'left' | 'right';
}

export interface AdaptedSlotEvaluation {
  slotIndex: number;
  side: 'left' | 'right';
  /** Full card bounds in frame pixel coords. */
  cardX: number;
  cardY: number;
  cardW: number;
  cardH: number;
  /** Sprite sub-region bounds in frame pixel coords (for the matcher crop). */
  x: number;
  y: number;
  w: number;
  h: number;
  assignedSpecies: string | null;
  assignedConfidence: number | null;
  candidates: Array<{
    species: string;
    confidence: number;
    score: number;
    supportCount: number;
    isShiny: boolean;
  }>;
  /** True when the slot was first matched against a constrained candidate
   *  pool (lock pipeline) and we then re-ran the matcher unconstrained. */
  reprocessed: boolean;
  /** Best unconstrained pick when the constrained pass was inconclusive.
   *  Used to flag lock-vs-selection mismatches in the Detection Trail. */
  fallbackTop: { species: string; confidence: number; isShiny: boolean } | null;
}

export interface AdaptedPanelBounds {
  side: 'left' | 'right';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AdaptedResult {
  /** True for the SELECTION screen only. Kept separate from `mode` so
   *  legacy callers that expected the strict selection-screen check
   *  don't need to change. */
  isTeamSelect: boolean;
  /** True for either selection OR lock screen — the superset. New callers
   *  that just want to know "is this a lineup screen at all" should use
   *  this flag. */
  isLineupScreen: boolean;
  /** Discriminator: `selection`, `lock`, or `none`. */
  mode: LineupFrameMode;
  frameConfidence: number;
  /** Raw card counts from the HSV frame detector, even when `isTeamSelect` is false. */
  opponentCardCount: number;
  playerCardCount: number;
  matches: AdaptedSpriteMatch[];
  slotEvaluations: AdaptedSlotEvaluation[];
  /** Panel rectangles detected by the HSV scan (debug visualization). */
  panels: AdaptedPanelBounds[];
  /**
   * Lock-screen only: indices (0-based, top-to-bottom) of the player
   * cards that carry a visible selection-order badge (1/2/3). These
   * identify which of the player's 6 Pokémon were sent into battle.
   * Empty on non-lock frames or when badges aren't segmentable.
   */
  playerLockBadgeSlots: number[];
  totalMs: number;
}

function adaptCard(
  det: DetectedPokemon,
  slotIndex: number,
  side: 'left' | 'right',
): { match: AdaptedSpriteMatch | null; slot: AdaptedSlotEvaluation } {
  const { card } = det;
  const cardX = card.xStart;
  const cardY = card.yStart;
  const cardW = card.xEnd - card.xStart;
  const cardH = card.yEnd - card.yStart;
  const spriteX = card.xStart + card.spriteBbox.x1;
  const spriteY = card.yStart + card.spriteBbox.y1;
  const spriteW = card.spriteBbox.x2 - card.spriteBbox.x1;
  const spriteH = card.spriteBbox.y2 - card.spriteBbox.y1;

  const candidates = det.candidates.map(c => ({
    species: c.species,
    confidence: c.combined,
    score: c.combined,
    supportCount: 1, // Single-pipeline scoring; legacy field for UI compat.
    isShiny: c.isShiny,
  }));

  const slot: AdaptedSlotEvaluation = {
    slotIndex,
    side,
    cardX, cardY, cardW, cardH,
    x: spriteX, y: spriteY, w: spriteW, h: spriteH,
    assignedSpecies: det.isConfident && det.top ? det.top.species : null,
    assignedConfidence: det.isConfident && det.top ? det.top.combined : null,
    candidates,
    reprocessed: det.reprocessed,
    fallbackTop: det.fallbackTop
      ? {
          species: det.fallbackTop.species,
          confidence: det.fallbackTop.combined,
          isShiny: det.fallbackTop.isShiny,
        }
      : null,
  };

  const match: AdaptedSpriteMatch | null = det.isConfident && det.top
    ? {
        species: det.top.species,
        confidence: det.top.combined,
        isShiny: det.top.isShiny,
        x: spriteX, y: spriteY, w: spriteW, h: spriteH,
        side,
      }
    : null;

  return { match, slot };
}

/**
 * Optional hints fed to the matcher when processing a lock-screen
 * frame. Populated from the selection-screen consensus snapshot. The
 * matcher uses these as a candidate whitelist; if the constrained pass
 * doesn't land a confident match, it auto-reprocesses against the full
 * DB and surfaces both picks for downstream comparison.
 */
export interface LineupMatchHints {
  /** Player-panel candidate species (e.g. the 6 from selection consensus). */
  playerSpecies?: ReadonlySet<string>;
  /** Opponent-panel candidate species. */
  opponentSpecies?: ReadonlySet<string>;
}

/**
 * Run the full pipeline on a canvas and return lineup matches plus
 * debug slot evaluations shaped like the legacy detector.
 *
 * `hints` lets the lock pipeline restrict matching to a small candidate
 * pool (typically the 6 players + 6 opponents resolved by the selection
 * consensus). The selection pipeline always passes `undefined` so its
 * matches stay independent — that's the canonical source of truth.
 */
export async function detectLineupOnCanvas(
  canvas: HTMLCanvasElement,
  hints?: LineupMatchHints,
): Promise<AdaptedResult> {
  const db = await loadSpriteDetectorDatabase();
  const view = canvasToPixelView(canvas);
  const restrictMatching = hints
    ? {
        player: hints.playerSpecies,
        opponent: hints.opponentSpecies,
      }
    : undefined;
  const result: DetectionResult = detectPokemon(view, db, { restrictMatching });

  const matches: AdaptedSpriteMatch[] = [];
  const slotEvaluations: AdaptedSlotEvaluation[] = [];

  result.players.forEach((det, i) => {
    const { match, slot } = adaptCard(det, i, 'left');
    slotEvaluations.push(slot);
    if (match) matches.push(match);
  });
  result.opponents.forEach((det, i) => {
    const { match, slot } = adaptCard(det, i + result.players.length, 'right');
    slotEvaluations.push(slot);
    if (match) matches.push(match);
  });

  const panels: AdaptedPanelBounds[] = [];
  if (result.frame.playerPanelBounds) {
    const p = result.frame.playerPanelBounds;
    panels.push({ side: 'left', x: p.x1, y: p.y1, w: p.x2 - p.x1, h: p.y2 - p.y1 });
  }
  if (result.frame.opponentPanelBounds) {
    const p = result.frame.opponentPanelBounds;
    panels.push({ side: 'right', x: p.x1, y: p.y1, w: p.x2 - p.x1, h: p.y2 - p.y1 });
  }

  return {
    isTeamSelect: result.frame.isTeamSelect,
    isLineupScreen: result.frame.isLineupScreen,
    mode: result.frame.mode,
    frameConfidence: result.frame.confidence,
    opponentCardCount: result.frame.opponentCards.length,
    playerCardCount: result.frame.playerCards.length,
    matches,
    slotEvaluations,
    panels,
    playerLockBadgeSlots: result.frame.playerLockBadgeSlots,
    totalMs: result.totalMs,
  };
}

/**
 * Detect the post-match WIN/LOSS result screen from a canvas frame.
 *
 * Thin wrapper around `detectResult` that handles the canvas →
 * PixelView conversion. No DB load required — pure HSV color signals.
 */
export function detectResultOnCanvas(canvas: HTMLCanvasElement): ResultDetection {
  const view = canvasToPixelView(canvas);
  return detectResult(view);
}

