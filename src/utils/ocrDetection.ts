// ─── OCR-based Pokemon Detection ────────────────────────────────
//
// Uses Tesseract.js to read text from captured frames, then matches
// against our known Pokemon species list. Runs multiple preprocessing
// passes to handle different text styles (white on dark, colored text,
// etc.) and uses strict matching to minimize false positives.

import { createWorker, type Worker, PSM } from 'tesseract.js';
import { getAvailablePokemon } from '../data/champions';
import { loadSpriteProfiles, rankRegionWithSpriteProfiles } from './screenCapture';
import { loadTemplates, isTemplateReady, rankRegionWithTemplates, scanRegionsWithTemplates } from './templateMatcher';
import { loadModel, isModelReady as isOnnxModelReady, matchCanvasWithOnnx } from './onnxMatcher';
import { isHashDBReady, loadHashDB, matchRegionByHash } from './perceptualHash';

// ─── Worker management ──────────────────────────────────────────

let _worker: Worker | null = null;
let _workerReady = false;
let _workerLoading = false;
let _loadProgress = 0;

export function getOcrLoadProgress(): number { return _loadProgress; }
export function isOcrReady(): boolean { return _workerReady; }

export async function initOcrWorker(): Promise<void> {
  if (_workerReady || _workerLoading) return;
  _workerLoading = true;
  _loadProgress = 0;

  try {
    // English + Japanese — Japanese opponents use JP species names/nicknames
    _worker = await createWorker('eng+jpn', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          _loadProgress = Math.round((m.progress ?? 0) * 100);
        }
      },
    });
    // Sparse text mode — game screens have text scattered across UI.
    // Don't use char whitelist — it can break Tesseract's internal model.
    await _worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    });
    _workerReady = true;
    _loadProgress = 100;

    // Preload sprite matchers + legacy sprite profiles (non-blocking)
    loadTemplates();
    loadModel().catch(() => {});
    loadSpriteProfiles(250).catch(() => {});
  } catch (err) {
    console.warn('[ocrDetection] Failed to init worker:', err);
    _workerReady = false;
  } finally {
    _workerLoading = false;
  }
}

export async function terminateOcrWorker(): Promise<void> {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
    _workerReady = false;
  }
}

// ─── Species matching ───────────────────────────────────────────

let _speciesNormMap: Map<string, string> | null = null;

function getSpeciesNormMap(): Map<string, string> {
  if (_speciesNormMap) return _speciesNormMap;
  const map = new Map<string, string>();
  for (const species of getAvailablePokemon()) {
    // Normalized: lowercase, no punctuation
    const norm = species.toLowerCase().replace(/[\s.\-']/g, '');
    map.set(norm, species);
    // Also add the raw lowercase form
    map.set(species.toLowerCase(), species);
  }

  // Add aliases for forms that OCR/game might show differently
  const aliases: Record<string, string> = {
    'rotomwash': 'Rotom-Wash', 'rotomheat': 'Rotom-Heat',
    'rotomfrost': 'Rotom-Frost', 'rotommow': 'Rotom-Mow',
    'rotomfan': 'Rotom-Fan',
    // Aegislash shows as base name, we store as Shield form
    'aegislash': 'Aegislash-Shield',
    'aegislashshield': 'Aegislash-Shield',
    'aegislashblade': 'Aegislash-Shield',
    // Floette-Eternal shows as just Floette sometimes
    'floette': 'Floette-Eternal',
    'floetteeternal': 'Floette-Eternal',
  };
  for (const [key, val] of Object.entries(aliases)) {
    if (!map.has(key)) map.set(key, val);
  }

  // Common Japanese Pokemon names → English species
  // Covers most-used competitive Pokemon in Champions
  const jpAliases: Record<string, string> = {
    'ガブリアス': 'Garchomp', 'サーナイト': 'Gardevoir', 'ガオガエン': 'Incineroar',
    'ゴリランダー': 'Rillaboom', 'マリルリ': 'Azumarill', 'ドラパルト': 'Dragapult',
    'バンギラス': 'Tyranitar', 'ドリュウズ': 'Excadrill', 'トゲキッス': 'Togekiss',
    'エルフーン': 'Whimsicott', 'ハッサム': 'Scizor', 'カイリュー': 'Dragonite',
    'ミミッキュ': 'Mimikyu', 'キングドラ': 'Kingambit', 'ヌメルゴン': 'Goodra',
    'エルレイド': 'Gallade', 'エレザード': 'Heliolisk', 'アップリュー': 'Flapple',
    'タルップル': 'Appletun', 'ヤドキング': 'Slowking', 'プクリン': 'Clefable',
    'ペリッパー': 'Pelipper', 'コータス': 'Torkoal', 'カバルドン': 'Hippowdon',
    'ルカリオ': 'Lucario', 'ゲンガー': 'Gengar', 'メガニウム': 'Meganium',
    'バクフーン': 'Typhlosion', 'オーダイル': 'Feraligatr', 'リザードン': 'Charizard',
    'カメックス': 'Blastoise', 'フシギバナ': 'Venusaur', 'ギルガルド': 'Aegislash-Shield',
    'キョジオーン': 'Garganacl', 'コノヨザル': 'Annihilape', 'サザンドラ': 'Hydreigon',
    'アーマーガア': 'Corviknight', 'ドクロッグ': 'Toxicroak', 'グライオン': 'Gliscor',
    'マンムー': 'Mamoswine', 'ウーラオス': 'Urshifu', 'ドヒドイデ': 'Toxapex',
    'ジバコイル': 'Magnezone', 'ウインディ': 'Arcanine', 'キュウコン': 'Ninetales',
    'ラプラス': 'Lapras', 'カビゴン': 'Snorlax', 'ボーマンダ': 'Salamence',
  };
  for (const [jp, en] of Object.entries(jpAliases)) {
    map.set(jp, en);
  }

  _speciesNormMap = map;
  return map;
}

/**
 * Match a cleaned token against known species. Returns { species, confidence }
 * or null. Uses strict matching — exact or near-exact only.
 */
function matchToken(raw: string): { species: string; confidence: number } | null {
  const clean = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (clean.length < 4) return null; // Too short — high false positive risk

  const normMap = getSpeciesNormMap();

  // 1. Exact match (highest confidence)
  const exact = normMap.get(clean);
  if (exact) return { species: exact, confidence: 1.0 };

  // 2. Levenshtein distance 1 (OCR misread one character)
  for (const [key, species] of normMap) {
    if (Math.abs(key.length - clean.length) > 1) continue;
    if (key.length < 4) continue;
    const dist = levenshtein(clean, key);
    if (dist === 1) {
      return { species, confidence: 0.85 };
    }
  }

  // 3. Levenshtein distance 2, but only for longer names (9+ chars)
  // and the matched key must share the same first 2 chars to avoid
  // false positives like "shocking" → "slowking"
  if (clean.length >= 9) {
    let bestMatch: string | null = null;
    let bestDist = 3;
    for (const [key, species] of normMap) {
      if (Math.abs(key.length - clean.length) > 2) continue;
      if (key.length < 7) continue;
      if (clean.slice(0, 2) !== key.slice(0, 2)) continue; // must share prefix
      const dist = levenshtein(clean, key);
      if (dist === 2 && dist < bestDist) {
        bestDist = dist;
        bestMatch = species;
      }
    }
    if (bestMatch) return { species: bestMatch, confidence: 0.6 };
  }

  return null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ─── Battle log pattern extraction ──────────────────────────────
// Game messages ALWAYS use species names (never nicknames):
//   "Opposing Garchomp used Earthquake!"
//   "Go! Incineroar!"
//   "Garchomp fainted!"
//   "The opposing Pelipper used Drizzle!"
//   "Trainer sent out Tyranitar!"
// These patterns are the most reliable detection signal.

interface BattleLogMatch {
  species: string;
  pattern: string;
  isOpponent: boolean;
}

function extractBattleLogSpecies(rawText: string): BattleLogMatch[] {
  const results: BattleLogMatch[] = [];
  const seen = new Set<string>();
  const allSpecies = getAvailablePokemon();

  // Normalize text: fix common OCR artifacts
  const text = rawText
    .replace(/\|/g, 'l')  // pipe → l
    .replace(/0(?=[a-zA-Z])/g, 'O')  // leading 0 before letter → O
    .replace(/1(?=[a-zA-Z])/g, 'l');  // leading 1 before letter → l

  // Pattern: "Opposing X used/sent/fainted" — opponent Pokemon (English names)
  for (const species of allSpecies) {
    const escaped = species.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const oppRegex = new RegExp(`(?:opposing|the opposing)\\s+${escaped}`, 'i');
    if (oppRegex.test(text) && !seen.has(species)) {
      seen.add(species);
      results.push({ species, pattern: `opposing ${species}`, isOpponent: true });
    }
  }

  // JP species names anywhere in text → try to match via normMap
  const normMap = getSpeciesNormMap();
  for (const [key, species] of normMap) {
    // Only check JP keys (contains non-ASCII)
    if (![...key].some(char => char.charCodeAt(0) > 127)) continue;
    if (seen.has(species)) continue;
    if (text.includes(key)) {
      seen.add(species);
      // If "opposing" appears nearby, mark as opponent
      const isOpp = /opposing/i.test(text);
      results.push({ species, pattern: `JP: ${key}`, isOpponent: isOpp });
    }
  }

  // Pattern: "Go! X!" or "sent out X" — your Pokemon
  for (const species of allSpecies) {
    const escaped = species.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const goRegex = new RegExp(`(?:Go!\\s*${escaped}|sent out ${escaped})`, 'i');
    if (goRegex.test(text) && !seen.has(species)) {
      seen.add(species);
      results.push({ species, pattern: `Go! ${species}`, isOpponent: false });
    }
  }

  // Pattern: "X used Y" — could be either side (but we already got opposing above)
  for (const species of allSpecies) {
    if (seen.has(species)) continue;
    const escaped = species.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const usedRegex = new RegExp(`${escaped}\\s+used\\s+`, 'i');
    if (usedRegex.test(text)) {
      seen.add(species);
      // If not already identified as opposing, it's likely yours
      results.push({ species, pattern: `${species} used...`, isOpponent: false });
    }
  }

  // Pattern: "X fainted" — either side
  for (const species of allSpecies) {
    if (seen.has(species)) continue;
    const escaped = species.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const faintRegex = new RegExp(`${escaped}\\s+fainted`, 'i');
    if (faintRegex.test(text)) {
      seen.add(species);
      results.push({ species, pattern: `${species} fainted`, isOpponent: false });
    }
  }

  return results;
}

// ─── Frame detection ────────────────────────────────────────────

export interface OcrMatch {
  species: string;
  token: string;
  confidence: number;
  side: 'left' | 'right' | 'unknown';
  /** How the match was found: panel = HP bar region OCR, token = full-frame OCR */
  method: 'panel' | 'token' | 'battlelog';
}

/** Whether OCR detected "opposing" / "opponent" text and where */
export interface SideDetection {
  hasOpposingLabel: boolean;
  opposingSide: 'left' | 'right' | 'unknown';
  debug: string;
}

export type MatchResult = 'win' | 'loss' | null;

export interface SpriteMatch {
  species: string;
  confidence: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
  /** Side from scan region — authoritative, no recalculation needed */
  side: 'left' | 'right';
}

export type ScreenContext = 'battle' | 'menu' | 'unknown';

export interface OcrDetectionResult {
  rawText: string;
  tokens: string[];
  matched: OcrMatch[];
  spriteMatched: SpriteMatch[];
  selectedRowIndices: number[];
  hoveredRowIndex: number | null;
  selectionCount: number | null;
  selectionTarget: number | null;
  rejected: { token: string; reason: string }[];
  species: string[];
  durationMs: number;
  bestPass: string;
  matchResult: MatchResult;
  matchResultDebug: string;
  screenContext: ScreenContext;
  screenContextDebug: string;
  sideDetection: SideDetection;
  /** Pokemon found via battle log patterns — highest confidence */
  battleLogMatches: BattleLogMatch[];
}

type OcrWordBox = {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

function classifyResultText(raw: string): MatchResult {
  const text = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (!text) return null;
  if (text === 'won' || text === 'win' || text === 'victory') return 'win';
  if (text === 'lost' || text === 'loss' || text === 'lose' || text === 'defeat') return 'loss';
  return null;
}

function findLargeResultWord(
  words: OcrWordBox[] | undefined,
  frameWidth: number,
  frameHeight: number,
  options?: {
    requireLeftSide?: boolean;
    minWidthRatio?: number;
    minHeightRatio?: number;
  },
): { result: MatchResult; raw: string; centerX: number } | null {
  if (!words?.length) return null;
  const requireLeftSide = options?.requireLeftSide ?? false;
  const minWidthRatio = options?.minWidthRatio ?? 0.08;
  const minHeightRatio = options?.minHeightRatio ?? 0.05;
  const midX = frameWidth / 2;

  for (const word of words) {
    const result = classifyResultText(word.text);
    if (!result) continue;
    const bboxWidth = word.bbox.x1 - word.bbox.x0;
    const bboxHeight = word.bbox.y1 - word.bbox.y0;
    const centerX = (word.bbox.x0 + word.bbox.x1) / 2;
    if (bboxWidth < frameWidth * minWidthRatio) continue;
    if (bboxHeight < frameHeight * minHeightRatio) continue;
    if (requireLeftSide && centerX >= midX) continue;
    return { result, raw: word.text.trim(), centerX };
  }

  return null;
}

// ─── Screen context detection ───────────────────────────────────
// Uses BOTH text keywords AND visual characteristics (brightness,
// sprite count) to classify screens. Box/menu screens have light
// backgrounds, many small sprites, and management words. Battle
// screens are dark with few large sprites and battle-specific text.

const MENU_KEYWORDS = new Set([
  'shop', 'store', 'purchase', 'buy', 'gems', 'coins', 'gold',
  'box', 'boxes', 'deposit', 'withdraw', 'release', 'storage',
  'organize', 'summary', 'markings', 'judge',
  'collection', 'deck', 'decks',
  'lobby', 'lounge', 'queue', 'searching', 'matchmaking',
  'settings', 'options', 'config', 'audio', 'graphics', 'controls',
  'profile', 'account', 'achievements', 'missions', 'quests', 'daily',
  'friends', 'social', 'invite',
  'rewards', 'claim', 'prize', 'loot', 'gacha', 'summon',
  'ladder', 'leaderboard', 'ranking',
  'tutorial', 'guide',
  'wonder', 'trade', 'exchange', 'gts',
  'customize', 'cosmetic', 'outfit', 'avatar', 'wardrobe',
  'event', 'news', 'update', 'patch', 'maintenance',
  'loading', 'connecting',
  'pokedex', 'habitat', 'ribbons', 'memories',
  'map', 'fly', 'town', 'city', 'route', 'cave', 'forest',
  'save', 'saving', 'saved',
  // Box / Pokemon management
  'held', 'level', 'type', 'stats', 'status',
  'category', 'power', 'accuracy',
  'close', 'back', 'cancel', 'confirm', 'yes',
  // Recruit / draft / pick screen
  'recruit', 'draft', 'pick', 'scout', 'hire',
  'available', 'roster', 'bench', 'slot', 'slots',
  'cost', 'price', 'salary', 'budget', 'cap',
  'stamina', 'energy', 'cooldown',
  'atk', 'def', 'spa', 'spd', 'spe',
  'attack', 'defense', 'speed', 'special',
  'hp', 'iv', 'ivs', 'ev', 'evs',
  'base', 'total', 'bst',
]);

const BATTLE_KEYWORDS = new Set([
  'won', 'lost', 'victory', 'defeat',
  'opposing', 'opponent', 'foe',
  'fainted', 'faint',
  'supereffective', 'critical',
  'tailwind', 'trickroom',
  // Selection screen
  'select', 'ranked', 'single', 'double', 'send',
]);

/**
 * Detect standard battle UI panels in bottom-left and top-right corners.
 * Battle screens always show HP bar panels there regardless of arena.
 * Panels = low-variance rounded regions with sharp edges.
 * Arena backgrounds = high variance (trees, water, sand textures).
 */
function detectBattlePanels(canvas: HTMLCanvasElement): { hasLeftPanel: boolean; hasRightPanel: boolean; debug: string } {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { hasLeftPanel: false, hasRightPanel: false, debug: 'no ctx' };
  const w = canvas.width, h = canvas.height;

  const sample = (x0: number, y0: number, x1: number, y1: number) => {
    const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let sum = 0, sumSq = 0, count = 0;
    for (let i = 0; i < data.length; i += 16) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += lum;
      sumSq += lum * lum;
      count++;
    }
    const mean = sum / count;
    const variance = (sumSq / count) - mean * mean;
    return { mean, stddev: Math.sqrt(variance), count };
  };

  // Actual panel positions from Pokemon Champions battle UI:
  // Bottom-left panel: x 0-20%, y 84-100% (name + HP bar strip)
  const bl = sample(Math.round(w * 0.00), Math.round(h * 0.84), Math.round(w * 0.22), Math.round(h * 1.00));
  // Top-right panel: x 70-100%, y 0-15% (name + HP bar strip)
  const tr = sample(Math.round(w * 0.70), Math.round(h * 0.00), Math.round(w * 1.00), Math.round(h * 0.16));

  // Panel = dark-ish region (mean < 140) with moderate variance (10-70).
  // Arena backgrounds without panels: very bright (mean > 180) or very
  // noisy (stddev > 80) or totally flat (stddev < 5).
  const isPanel = (s: { mean: number; stddev: number }) =>
    s.mean < 140 && s.stddev >= 10 && s.stddev <= 70;
  const hasLeftPanel = isPanel(bl);
  const hasRightPanel = isPanel(tr);

  return {
    hasLeftPanel, hasRightPanel,
    debug: `BL μ=${bl.mean.toFixed(0)} σ=${bl.stddev.toFixed(0)} TR μ=${tr.mean.toFixed(0)} σ=${tr.stddev.toFixed(0)}`,
  };
}

function classifyScreen(
  tokens: string[],
  spriteCount: number,
  panels: { hasLeftPanel: boolean; hasRightPanel: boolean; debug: string },
): { context: ScreenContext; debug: string } {
  const lower = tokens.map(t => t.toLowerCase().replace(/[^a-z]/g, ''));
  let menuHits = 0;
  let battleHits = 0;
  const menuFound: string[] = [];
  const battleFound: string[] = [];

  for (const t of lower) {
    if (t.length < 2) continue;
    if (MENU_KEYWORDS.has(t)) { menuHits++; menuFound.push(t); }
    if (BATTLE_KEYWORDS.has(t)) { battleHits++; battleFound.push(t); }
  }

  // Box screens have 15+ sprites dense-scattered. Team preview is ~6-12
  // sprites in a clean 2-column grid — should NOT be classified as menu.
  const boxLikeSpriteCount = spriteCount > 14;
  const bothPanels = panels.hasLeftPanel && panels.hasRightPanel;

  // STRONG BATTLE: battle keywords OR both corner panels detected
  if (battleHits >= 1) {
    return { context: 'battle', debug: `Battle: ${battleFound.join(', ')} [${panels.debug}]` };
  }
  if (bothPanels) {
    return { context: 'battle', debug: `Battle UI panels [${panels.debug}]` };
  }

  // MENU: menu keywords with no battle signal
  if (menuHits >= 1) {
    return { context: 'menu', debug: `Menu: ${menuFound.join(', ')} [${panels.debug}]` };
  }

  // MENU: sprite grid (box screen) — lots of sprites, no panels
  if (boxLikeSpriteCount) {
    return { context: 'menu', debug: `Menu (${spriteCount} sprites, box grid) [${panels.debug}]` };
  }

  return { context: 'unknown', debug: `Ambiguous (menu:${menuHits} battle:${battleHits} sprites:${spriteCount}) [${panels.debug}]` };
}

interface SelectionSpriteRegion {
  slotIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  side: 'left' | 'right';
}

interface RankedSelectionCandidate {
  species: string;
  confidence: number;
  score: number;
  supportCount: number;
}

interface SelectionSlotEvaluation {
  region: SelectionSpriteRegion;
  candidates: RankedSelectionCandidate[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export const SELECTION_SLOT_CONFIGS: Array<{ side: 'left' | 'right'; x: number; y: number; w: number; h: number }> = [
  { side: 'left', x: 0.232, y: 0.09, w: 0.065, h: 0.09 },
  { side: 'left', x: 0.232, y: 0.205, w: 0.065, h: 0.09 },
  { side: 'left', x: 0.232, y: 0.322, w: 0.065, h: 0.09 },
  { side: 'left', x: 0.232, y: 0.439, w: 0.065, h: 0.09 },
  { side: 'left', x: 0.232, y: 0.556, w: 0.065, h: 0.09 },
  { side: 'left', x: 0.232, y: 0.673, w: 0.065, h: 0.09 },
  { side: 'right', x: 0.836, y: 0.095, w: 0.06, h: 0.085 },
  { side: 'right', x: 0.836, y: 0.212, w: 0.06, h: 0.085 },
  { side: 'right', x: 0.836, y: 0.329, w: 0.06, h: 0.085 },
  { side: 'right', x: 0.836, y: 0.446, w: 0.06, h: 0.085 },
  { side: 'right', x: 0.836, y: 0.563, w: 0.06, h: 0.085 },
  { side: 'right', x: 0.836, y: 0.68, w: 0.06, h: 0.085 },
];

function buildSelectionSpriteRegions(
  width: number,
  height: number,
): SelectionSpriteRegion[] {
  return SELECTION_SLOT_CONFIGS.map((config, slotIndex) => ({
    slotIndex,
    x: width * config.x,
    y: height * config.y,
    w: width * config.w,
    h: height * config.h,
    side: config.side,
  }));
}

function cropRegionToCanvas(
  canvas: HTMLCanvasElement,
  region: { x: number; y: number; w: number; h: number },
): HTMLCanvasElement {
  const crop = document.createElement('canvas');
  crop.width = Math.max(1, Math.round(region.w));
  crop.height = Math.max(1, Math.round(region.h));
  crop.getContext('2d')!.drawImage(
    canvas,
    Math.round(region.x),
    Math.round(region.y),
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );
  return crop;
}

async function evaluateSelectionSlot(
  canvas: HTMLCanvasElement,
  region: SelectionSpriteRegion,
): Promise<SelectionSlotEvaluation> {
  const crop = cropRegionToCanvas(canvas, region);
  const combined = new Map<string, { score: number; confidence: number; support: Set<string> }>();

  const addCandidate = (
    species: string,
    matcher: 'onnx' | 'template' | 'hash' | 'profile',
    contribution: number,
    confidence: number,
  ) => {
    const existing = combined.get(species) ?? { score: 0, confidence: 0, support: new Set<string>() };
    existing.score += contribution;
    existing.confidence = Math.max(existing.confidence, confidence);
    existing.support.add(matcher);
    combined.set(species, existing);
  };

  if (isOnnxModelReady()) {
    const onnxMatches = await matchCanvasWithOnnx(crop, 4, 0.5);
    onnxMatches.forEach((match, index) => {
      const rankPenalty = 1 - index * 0.12;
      addCandidate(
        match.species,
        'onnx',
        0.62 * match.confidence * rankPenalty,
        clamp01((match.similarity - 0.5) / 0.32),
      );
    });
  }

  const profileMatches = await rankRegionWithSpriteProfiles(canvas, region, 5);
  profileMatches.forEach((match, index) => {
    const rankPenalty = 1 - index * 0.08;
    addCandidate(match.species, 'profile', 0.9 * match.confidence * rankPenalty, match.confidence);
  });

  if (isTemplateReady()) {
    const templateMatches = rankRegionWithTemplates(canvas, region, 5);
    templateMatches.forEach((match, index) => {
      const confidence = clamp01((match.score - 0.2) / 0.45);
      const rankPenalty = 1 - index * 0.1;
      addCandidate(match.species, 'template', 0.34 * confidence * rankPenalty, confidence);
    });
  }

  if (isHashDBReady()) {
    const hashMatches = matchRegionByHash(canvas, region, 5, 18);
    hashMatches.forEach((match, index) => {
      const rankPenalty = 1 - index * 0.1;
      addCandidate(match.species, 'hash', 0.2 * clamp01(match.confidence) * rankPenalty, clamp01(match.confidence));
    });
  }

  const candidates = [...combined.entries()]
    .map(([species, entry]) => {
      const supportBonus = entry.support.size >= 2 ? 0.12 * (entry.support.size - 1) : 0;
      const score = entry.score + supportBonus;
      return {
        species,
        score,
        confidence: clamp01(Math.max(entry.confidence, score)),
        supportCount: entry.support.size,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return { region, candidates };
}

function resolveSelectionSlotMatchesForSide(slotEvaluations: SelectionSlotEvaluation[]): SpriteMatch[] {
  const assignments = new Map<number, RankedSelectionCandidate>();
  const usedSpecies = new Set<string>();
  const slotOrder = slotEvaluations
    .map((slot, index) => ({ index, score: slot.candidates[0]?.score ?? -1 }))
    .sort((a, b) => b.score - a.score);

  const tryAssign = (minScore: number, allowSingleMatcher: boolean) => {
    for (const { index } of slotOrder) {
      if (assignments.has(index)) continue;
      const candidate = slotEvaluations[index].candidates.find(entry => {
        if (usedSpecies.has(entry.species)) return false;
        if (entry.score < minScore) return false;
        if (!allowSingleMatcher && entry.supportCount < 2 && entry.confidence < 0.8) return false;
        return true;
      });
      if (!candidate) continue;
      assignments.set(index, candidate);
      usedSpecies.add(candidate.species);
    }
  };

  tryAssign(0.58, false);
  tryAssign(0.5, true);

  const matches: SpriteMatch[] = [];
  slotEvaluations.forEach((slot, index) => {
    const candidate = assignments.get(index);
    if (!candidate) return;
    matches.push({
      species: candidate.species,
      confidence: candidate.confidence,
      x: slot.region.x,
      y: slot.region.y,
      w: slot.region.w,
      h: slot.region.h,
      side: slot.region.side,
    });
  });
  return matches;
}

function resolveSelectionSlotMatches(slotEvaluations: SelectionSlotEvaluation[]): SpriteMatch[] {
  const leftSlots = slotEvaluations.filter(slot => slot.region.side === 'left');
  const rightSlots = slotEvaluations.filter(slot => slot.region.side === 'right');
  return [
    ...resolveSelectionSlotMatchesForSide(leftSlots),
    ...resolveSelectionSlotMatchesForSide(rightSlots),
  ];
}

async function detectSelectionLineupBySprites(canvas: HTMLCanvasElement): Promise<SpriteMatch[]> {
  const evaluations = await Promise.all(
    buildSelectionSpriteRegions(canvas.width, canvas.height).map(region => evaluateSelectionSlot(canvas, region))
  );
  return resolveSelectionSlotMatches(evaluations);
}

function extractSelectionProgress(rawText: string): {
  selectionCount: number | null;
  selectionTarget: number | null;
} {
  const normalized = rawText
    .replace(/[|\\]/g, '/')
    .replace(/[Oo]/g, '0')
    .replace(/[Il]/g, '1');

  const counterMatch = normalized.match(/([0-6])\s*\/\s*([34])/);
  const headerMatch = normalized.match(/select\s*([34])\s*pok(?:e|é)mon/i);

  const selectionCount = counterMatch ? Number(counterMatch[1]) : null;
  const selectionTarget = counterMatch
    ? Number(counterMatch[2])
    : headerMatch
      ? Number(headerMatch[1])
      : null;

  return { selectionCount, selectionTarget };
}

function detectHoveredPreviewRow(canvas: HTMLCanvasElement): number | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const { width, height } = canvas;
  const x = 0;
  const w = Math.round(width * 0.06);
  const bandHeight = Math.round(height * 0.10);
  const rowCenters = Array.from({ length: 6 }, (_, i) => height * (0.184 + i * 0.118));

  let bestIndex: number | null = null;
  let bestScore = 0;
  let bestArea = 1;

  for (let i = 0; i < rowCenters.length; i++) {
    const y = Math.max(0, Math.round(rowCenters[i] - bandHeight / 2));
    const h = Math.min(height - y, bandHeight);
    if (w < 8 || h < 8 || x + w > width) continue;

    const data = ctx.getImageData(x, y, w, h).data;
    let score = 0;

    for (let p = 0; p < w * h; p++) {
      const r = data[p * 4];
      const g = data[p * 4 + 1];
      const b = data[p * 4 + 2];
      if (r > 160 && g > 140 && b < 120) {
        score += Math.max(0, Math.min(r, g) - b);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestArea = w * h;
      bestIndex = i;
    }
  }

  return bestScore / bestArea > 10 ? bestIndex : null;
}

/**
 * Run TARGETED OCR on HP bar panel regions + full-frame fallback.
 * Panel OCR is fast (small crops) and reliable (fixed positions).
 */
export async function detectPokemonFromFrame(
  canvas: HTMLCanvasElement,
): Promise<OcrDetectionResult> {
  const t0 = performance.now();

  const emptySide: SideDetection = { hasOpposingLabel: false, opposingSide: 'unknown', debug: '' };
  if (!isTemplateReady()) void loadTemplates();
  if (!isOnnxModelReady()) void loadModel().catch(() => {});
  if (!isHashDBReady()) loadHashDB();

  // ── FAST PANEL OCR ──
  // HP bar panels are at fixed positions. OCR just those regions first.
  // Bottom-left panel (YOUR mon): x 2-40%, y 60-85%
  // Top-right panel (OPP mon): x 55-98%, y 10-40%
  // Much faster than full-frame OCR and gives exact side assignment.
  const canUseOcr = Boolean(_worker && _workerReady);
  const panelMatches: OcrMatch[] = [];
  const w = canvas.width, h = canvas.height;

  const ocrPanel = async (x0: number, y0: number, x1: number, y1: number, side: 'left' | 'right') => {
    const pw = Math.round(x1 - x0), ph = Math.round(y1 - y0);
    if (pw < 20 || ph < 10) return;
    const crop = document.createElement('canvas');
    crop.width = pw; crop.height = ph;
    crop.getContext('2d')!.drawImage(canvas, Math.round(x0), Math.round(y0), pw, ph, 0, 0, pw, ph);
    // Panel-specific preprocess: game name text is bright/colored on dark
    // semi-transparent panel. Use lower threshold (100) to catch colored text.
    const processed = preprocessPanelText(crop);
    try {
      if (!_worker) return;
      const { data } = await _worker.recognize(processed);
      const tokens = tokenize(data.text);
      for (const token of tokens) {
        const result = matchToken(token);
        if (result && result.confidence >= 0.6) {
          panelMatches.push({ ...result, token, side, method: 'panel' });
        }
      }
    } catch { /* panel OCR failed, continue with full-frame */ }
  };

  // ── BATTLE SCREEN panels (HP bars at corners)
  if (canUseOcr) {
    await Promise.all([
      ocrPanel(w * 0.00, h * 0.82, w * 0.25, h * 1.00, 'left'),
      ocrPanel(w * 0.55, h * 0.00, w * 1.00, h * 0.18, 'right'),
    ]);
  }

  // ── SELECTION SCREEN: left column has YOUR team names as white text
  // on colored panels. Run OCR on the full left column with a HIGH
  // threshold (200) to isolate only bright white name text.
  const ocrSelectionColumn = async () => {
    const colW = Math.round(w * 0.23), colH = Math.round(h * 0.88);
    const colY = Math.round(h * 0.07);
    if (colW < 30 || colH < 30) return;
    const crop = document.createElement('canvas');
    crop.width = colW; crop.height = colH;
    crop.getContext('2d')!.drawImage(canvas, 0, colY, colW, colH, 0, 0, colW, colH);
    // High threshold — only bright white/yellow name text survives
    const pc = document.createElement('canvas');
    pc.width = colW; pc.height = colH;
    const pctx = pc.getContext('2d')!;
    pctx.drawImage(crop, 0, 0);
    const id = pctx.getImageData(0, 0, colW, colH);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const brightness = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      // Keep bright text (white/yellow names on colored panels)
      d[i] = d[i + 1] = d[i + 2] = brightness > 150 ? 0 : 255;
    }
    pctx.putImageData(id, 0, 0);
    try {
      if (!_worker) return;
      const { data } = await _worker.recognize(pc);
      const tokens = tokenize(data.text);
      for (const token of tokens) {
        const result = matchToken(token);
        if (result && result.confidence >= 0.6) {
          panelMatches.push({ ...result, token, side: 'left', method: 'panel' });
        }
      }
    } catch { /* selection OCR failed */ }
  };
  if (canUseOcr) {
    await ocrSelectionColumn();
  }

  // ── TARGETED W/L DETECTION ──
  // Results screen shows "WON!" / "LOST" in large decorative gold text.
  // Left half = player result. Run dedicated OCR with multiple preprocessing
  // passes on the left-center region to catch stylized game fonts.
  let earlyMatchResult: MatchResult = null;
  let earlyMatchDebug = '';
  const ocrWinLoss = async () => {
    // Scan left 48% of frame, middle vertical band (y 25-80%)
    const lx = Math.round(w * 0.02), ly = Math.round(h * 0.25);
    const lw2 = Math.round(w * 0.46), lh2 = Math.round(h * 0.55);
    if (lw2 < 30 || lh2 < 30) return;
    const crop = document.createElement('canvas');
    crop.width = lw2; crop.height = lh2;
    crop.getContext('2d')!.drawImage(canvas, lx, ly, lw2, lh2, 0, 0, lw2, lh2);

    // Multiple preprocessing passes — decorative gold font needs different thresholds
    const passes = [
      preprocessHighContrast(crop),
      preprocessGoldText(crop),  // Gold/yellow text isolation
      preprocessGrayscale(crop),
    ];

    for (const processed of passes) {
      if (earlyMatchResult) break;
      try {
        if (!_worker) return;
        const { data } = await _worker.recognize(processed);
        const words = (data as unknown as { words?: OcrWordBox[] }).words;
        const match = findLargeResultWord(words, processed.width, processed.height, {
          minWidthRatio: 0.16,
          minHeightRatio: 0.12,
        });
        if (match) {
          earlyMatchResult = match.result;
          earlyMatchDebug = `W/L panel: "${match.raw}" large-word`;
        }
      } catch { /* W/L OCR failed */ }
    }
  };
  if (canUseOcr) {
    await ocrWinLoss();
  }

  // Crop out the right 25% of the frame — this is where Twitch chat
  // typically sits. Chat text generates massive OCR noise (usernames,
  // emotes, random words that fuzzy-match to Pokemon names).
  // Also crop the bottom 10% (stream alerts/donation tickers).
  const cropped = cropFrame(canvas, 0, 0, 0.75, 0.9);

  // Scale down for OCR quality + speed
  const scaled = scaleDown(cropped, 960);

  // OCR passes — sprite detection is primary for Pokemon ID but OCR
  // still contributes text matches, win/loss, and screen context.
  // 2 OCR passes max — sprite detection is primary, OCR is supplementary.
  // Raw pass dropped — high-contrast catches same text with better noise rejection.
  const passes: { name: string; canvas: HTMLCanvasElement }[] = [
    { name: 'high-contrast', canvas: preprocessHighContrast(scaled) },
    { name: 'grayscale', canvas: preprocessGrayscale(scaled) },
  ];

  const allMatched = new Map<string, OcrMatch>();
  // Seed with panel OCR results — highest confidence, exact side assignment
  for (const pm of panelMatches) {
    allMatched.set(pm.species, { ...pm, confidence: Math.max(pm.confidence, 0.9) });
  }
  const allRejected: { token: string; reason: string }[] = [];
  let allRawText = '';
  let allTokens: string[] = [];
  let bestPassName = 'raw';

  // Match result detection: look for "Won"/"Lost" with position info
  let matchResult: MatchResult = null;
  let matchResultDebug = '';
  let sideDetection: SideDetection = { ...emptySide };

  if (canUseOcr && _worker) {
    for (const pass of passes) {
      const { data } = await _worker.recognize(pass.canvas);
      const rawText = data.text;
      const tokens = tokenize(rawText);
      const frameWidth = scaled.width;
      const midX = frameWidth / 2;

      const words = (data as unknown as { words?: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }).words;
      if (words) {
      // Detect "opposing" / "opponent" label
        if (!sideDetection.hasOpposingLabel) {
          for (const word of words) {
            const t = word.text.toLowerCase().replace(/[^a-z]/g, '');
            if (t === 'opposing' || t === 'opponent' || t === 'opponents' || t === 'foe' || t === 'enemy') {
              const centerX = (word.bbox.x0 + word.bbox.x1) / 2;
              const side = centerX < midX ? 'left' : 'right';
              sideDetection = {
                hasOpposingLabel: true,
                opposingSide: side,
                debug: `"${word.text}" at x=${Math.round(centerX)} → opponent is on ${side} side (pass: ${pass.name})`,
              };
              break;
            }
          }
        }
      }

      // Full-frame OCR is NOT used for species matching — chat overlays,
      // stream text, and usernames produce too many false positives.
      // Species detection comes from: panel OCR (HP bars) + battle log only.
      // Full-frame OCR is used for: W/L, screen context, battle log, side labels.

      // Detect match result from word-level bounding boxes.
      // The game shows "Won"/"Lost" — left is player's result, right is opponent's.
      // Use scaled frame width for correct midpoint (OCR ran on scaled canvas).
      const words2 = (data as unknown as { words?: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }).words;
      if (words2) {
        const match = findLargeResultWord(words2 as OcrWordBox[], scaled.width, scaled.height, {
          requireLeftSide: true,
          minWidthRatio: 0.08,
          minHeightRatio: 0.05,
        });
        if (match) {
          matchResult = match.result;
          matchResultDebug = `"${match.raw}" at x=${Math.round(match.centerX)} LEFT, pass: ${pass.name}`;
          break;
        }
      }

      if (!allRawText && rawText.trim()) {
        allRawText = rawText;
        allTokens = tokens;
        bestPassName = pass.name;
      }
    }
  }

  // No raw text fallback — requires word-level bbox to verify left-half position.

  // Extract species from battle log patterns — highest reliability
  const battleLogMatches = extractBattleLogSpecies(allRawText);
  // Battle log matches are near-certain — add them as high-confidence OCR matches
  for (const blm of battleLogMatches) {
    if (!allMatched.has(blm.species)) {
      allMatched.set(blm.species, {
        species: blm.species,
        token: blm.pattern,
        confidence: 0.95, // battle log = near certain
        side: blm.isOpponent ? 'right' : 'left',
        method: 'battlelog',
      });
    }
  }

  const matched = [...allMatched.values()].sort((a, b) => b.confidence - a.confidence);

  // ── SPRITE MATCHING ──
  // Preview lineup detection is visual-only and ignores nickname text.
  const battleSpriteRegions = [
    { x: w * 0.00, y: h * 0.52, w: w * 0.20, h: h * 0.40, side: 'left' as const },
    { x: w * 0.26, y: h * 0.45, w: w * 0.42, h: h * 0.50, side: 'left' as const },
    { x: w * 0.22, y: h * 0.16, w: w * 0.28, h: h * 0.42, side: 'right' as const },
    { x: w * 0.72, y: h * 0.15, w: w * 0.25, h: h * 0.46, side: 'right' as const },
  ];
  const selectionTokenSet = new Set(
    allTokens.map(t => t.toLowerCase().replace(/[^a-z]/g, ''))
  );
  const selectionProgress = extractSelectionProgress(allRawText);
  const looksLikeSelectionScreen =
    selectionTokenSet.has('select') ||
    selectionTokenSet.has('send') ||
    selectionTokenSet.has('seleziona') ||
    selectionTokenSet.has('ranked') ||
    selectionTokenSet.has('single') ||
    selectionTokenSet.has('double') ||
    (selectionTokenSet.has('pokemon') && selectionTokenSet.has('lotta')) ||
    (selectionTokenSet.has('standing') && selectionTokenSet.has('by')) ||
    selectionProgress.selectionTarget !== null;
  const selectionSpriteMatches = await detectSelectionLineupBySprites(canvas);
  const hasVisualSelectionLineup = selectionSpriteMatches.length >= 4;
  const hoveredRowIndex = (looksLikeSelectionScreen || hasVisualSelectionLineup)
    ? detectHoveredPreviewRow(canvas)
    : null;
  const selectedRowIndices: number[] = [];
  const selectionCount = looksLikeSelectionScreen ? selectionProgress.selectionCount : null;
  const selectionTarget = looksLikeSelectionScreen ? selectionProgress.selectionTarget : null;

  const spriteByKey = new Map<string, SpriteMatch>();
  const addSpriteMatch = (match: SpriteMatch) => {
    const key = `${match.side}:${match.species}`;
    const existing = spriteByKey.get(key);
    if (!existing || match.confidence > existing.confidence) {
      spriteByKey.set(key, match);
    }
  };

  if (hasVisualSelectionLineup) {
    for (const match of selectionSpriteMatches) {
      addSpriteMatch(match);
    }
  }

  if (isTemplateReady()) {
    const templateMatches = await scanRegionsWithTemplates(
      canvas,
      hasVisualSelectionLineup || looksLikeSelectionScreen ? [] : battleSpriteRegions,
    );
    for (const match of templateMatches) {
      addSpriteMatch({
        species: match.species,
        confidence: match.confidence,
        x: match.x,
        y: match.y,
        side: match.side,
      });
    }
  }

  const spriteMatched = [...spriteByKey.values()];
  const effectiveMatched = (looksLikeSelectionScreen || hasVisualSelectionLineup)
    ? matched.filter(m => m.method !== 'panel')
    : matched;

  // Detect battle UI panels at bottom-left + top-right
  // (standard HP/Pokemon panels in every battle screen, arena-independent)
  const panels = detectBattlePanels(cropped);

  const allSeenTokens = [...new Set([...allTokens, ...allRejected.map(r => r.token)])];
  const screenContextInfo = (hasVisualSelectionLineup || looksLikeSelectionScreen)
    ? {
        context: 'battle' as const,
        debug: `Selection screen (${selectionSpriteMatches.length}/6 sprite slots, target:${selectionProgress.selectionTarget ?? '-'})`,
      }
    : classifyScreen(
        allSeenTokens,
        spriteMatched.length,
        panels,
      );
  const { context: screenContext, debug: screenContextDebug } = screenContextInfo;

  if (screenContext === 'menu') {
    return {
      rawText: allRawText,
      tokens: allTokens,
      matched: [],
      spriteMatched: [],
      selectedRowIndices,
      hoveredRowIndex,
      selectionCount,
      selectionTarget,
      rejected: allRejected.slice(0, 10),
      species: [],
      durationMs: Math.round(performance.now() - t0),
      bestPass: bestPassName,
      matchResult: null,
      matchResultDebug: '',
      screenContext,
      screenContextDebug: `${screenContextDebug} · sprites:${spriteMatched.length}`,
      sideDetection,
      battleLogMatches: [],
    };
  }

  // Merge OCR + sprite detections — deduplicate, prefer higher confidence
  const ocrSpecies = new Set(effectiveMatched.map(m => m.species));
  const spriteOnly = spriteMatched.filter(s => !ocrSpecies.has(s.species));
  const allSpecies = [
    ...effectiveMatched.map(m => m.species),
    ...spriteOnly.map(s => s.species),
  ];
  // Deduplicate
  const uniqueSpecies = [...new Set(allSpecies)];

  return {
    rawText: allRawText,
    tokens: allTokens,
    matched: effectiveMatched,
    spriteMatched,
    selectedRowIndices,
    hoveredRowIndex,
    selectionCount,
    selectionTarget,
    rejected: allRejected.slice(0, 10),
    species: uniqueSpecies,
    durationMs: Math.round(performance.now() - t0),
    bestPass: bestPassName,
    matchResult: matchResult ?? earlyMatchResult,
    matchResultDebug: matchResultDebug || earlyMatchDebug,
    screenContext,
    screenContextDebug,
    sideDetection,
    battleLogMatches,
  };
}

/** Tokenize OCR text into potential Pokemon name candidates. */
function tokenize(text: string): string[] {
  return text
    .split(/[\s,;:|/\\(){}<>_@#$%^&*!?~`"+=[\]]+/)
    .map(t => t.trim().replace(/^[.-]+|[.-]+$/g, ''))
    .filter(t => {
      if (t.length < 3) return false;
      if (!/[a-zA-Z]{3,}/.test(t)) return false;
      // Filter out chat noise patterns:
      // - Tokens with too many numbers mixed in (usernames like "Player123")
      if (/\d{2,}/.test(t)) return false;
      // - ALL CAPS short tokens (chat emotes like "LOL", "GG", "KEKW")
      if (t.length <= 4 && t === t.toUpperCase() && /^[A-Z]+$/.test(t)) return false;
      // - Tokens starting with @ or containing : (chat mentions, emotes)
      if (t.startsWith('@') || t.includes(':')) return false;
      return true;
    });
}

// ─── Preprocessing strategies ───────────────────────────────────

function detectLetterboxedGameWindow(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const fw = canvas.width, fh = canvas.height;

  const sampleXStep = Math.max(6, Math.round(fw / 240));
  const sampleYStep = Math.max(6, Math.round(fh / 135));
  const isActivePixel = (r: number, g: number, b: number) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum > 22 || (max - min) > 18;
  };

  const rowActivity = (y: number) => {
    const yy = Math.max(0, Math.min(fh - 1, y));
    const data = ctx.getImageData(0, yy, fw, 1).data;
    let active = 0;
    let total = 0;
    for (let x = 0; x < fw; x += sampleXStep) {
      const i = x * 4;
      if (isActivePixel(data[i], data[i + 1], data[i + 2])) active++;
      total++;
    }
    return active / Math.max(1, total);
  };

  const colActivity = (x: number) => {
    const xx = Math.max(0, Math.min(fw - 1, x));
    const data = ctx.getImageData(xx, 0, 1, fh).data;
    let active = 0;
    let total = 0;
    for (let y = 0; y < fh; y += sampleYStep) {
      const i = y * 4;
      if (isActivePixel(data[i], data[i + 1], data[i + 2])) active++;
      total++;
    }
    return active / Math.max(1, total);
  };

  const edgeThreshold = 0.12;
  let top = 0;
  while (top < fh * 0.25 && rowActivity(top) < edgeThreshold) top += sampleYStep;
  let bottom = fh - 1;
  while (bottom > fh * 0.75 && rowActivity(bottom) < edgeThreshold) bottom -= sampleYStep;
  let left = 0;
  while (left < fw * 0.25 && colActivity(left) < edgeThreshold) left += sampleXStep;
  let right = fw - 1;
  while (right > fw * 0.75 && colActivity(right) < edgeThreshold) right -= sampleXStep;

  if (right <= left || bottom <= top) return null;

  const x = left / fw;
  const y = top / fh;
  const w = (right - left + 1) / fw;
  const h = (bottom - top + 1) / fh;
  const trimmedEnough = x > 0.015 || y > 0.015 || (1 - (x + w)) > 0.015 || (1 - (y + h)) > 0.015;
  const aspect = w / Math.max(h, 0.001);
  if (!trimmedEnough || w < 0.45 || h < 0.45 || aspect < 1.45 || aspect > 2.1) return null;

  return { x, y, w, h };
}

/**
 * Auto-detect game window inside a stream overlay.
 * First trims obvious black bars / letterboxing, then falls back to a
 * variance-based search for stream layouts with extra overlays.
 */
export function autoDetectGameWindow(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const letterboxed = detectLetterboxedGameWindow(canvas);
  if (letterboxed) return letterboxed;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const fw = canvas.width, fh = canvas.height;

  const cols = 24, rows = 14;
  const cellW = Math.floor(fw / cols), cellH = Math.floor(fh / rows);

  // Compute color variance per cell
  const varGrid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    varGrid[r] = [];
    for (let c = 0; c < cols; c++) {
      const data = ctx.getImageData(c * cellW, r * cellH, cellW, cellH).data;
      let sum = 0, sumSq = 0, count = 0;
      for (let i = 0; i < data.length; i += 24) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sum += lum;
        sumSq += lum * lum;
        count++;
      }
      const mean = sum / (count || 1);
      varGrid[r][c] = (sumSq / (count || 1)) - mean * mean;
    }
  }

  // Threshold: cells with variance > median are "active" (game content)
  const allVars = varGrid.flat().sort((a, b) => a - b);
  const varMedian = allVars[Math.floor(allVars.length / 2)];
  const activeThresh = Math.max(varMedian * 1.2, 200); // game cells are notably noisier

  // Find bounding box of active cells
  let left = cols, right = 0, top = rows, bottom = 0;
  let activeCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (varGrid[r][c] >= activeThresh) {
        if (c < left) left = c;
        if (c > right) right = c;
        if (r < top) top = r;
        if (r > bottom) bottom = r;
        activeCount++;
      }
    }
  }

  // Need enough active cells to form a rectangle
  if (activeCount < 6) return null;

  // Add 1-cell padding
  left = Math.max(0, left - 1);
  top = Math.max(0, top - 1);
  right = Math.min(cols - 1, right + 1);
  bottom = Math.min(rows - 1, bottom + 1);

  const x = left / cols;
  const y = top / rows;
  const w = (right - left + 1) / cols;
  const h = (bottom - top + 1) / rows;

  // Skip if too small or basically full-frame
  if (w < 0.2 || h < 0.2 || (w > 0.92 && h > 0.92)) return null;
  return { x, y, w, h };
}

/**
 * Crop a canvas to a percentage region. Used to exclude Twitch chat (right side)
 * and stream overlay bars (bottom) before running OCR.
 */
function cropFrame(
  source: HTMLCanvasElement,
  xPct: number, yPct: number,
  wPct: number, hPct: number,
): HTMLCanvasElement {
  const sx = Math.round(source.width * xPct);
  const sy = Math.round(source.height * yPct);
  const sw = Math.round(source.width * wPct) - sx;
  const sh = Math.round(source.height * hPct) - sy;
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

/** Scale canvas down to maxWidth, preserving aspect ratio. Reduces noise. */
function scaleDown(source: HTMLCanvasElement, maxWidth: number): HTMLCanvasElement {
  if (source.width <= maxWidth) return source;
  const scale = maxWidth / source.width;
  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * High contrast: isolate light text on dark backgrounds.
 * Less aggressive than before — uses adaptive thresholding.
 */
function preprocessHighContrast(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    // Use perceived brightness (weighted)
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

    if (brightness > 140) {
      // Light text → black (Tesseract prefers dark text on white bg)
      d[i] = d[i + 1] = d[i + 2] = 0;
    } else {
      // Dark background → white
      d[i] = d[i + 1] = d[i + 2] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Grayscale with Otsu-like adaptive threshold.
 * Computes mean brightness and uses it as threshold.
 */
function preprocessGrayscale(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;

  // Compute mean brightness
  let totalBrightness = 0;
  let count = 0;
  for (let i = 0; i < d.length; i += 16) { // sample every 4th pixel
    totalBrightness += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    count++;
  }
  const meanBrightness = totalBrightness / count;
  // Threshold slightly above mean to separate text from background
  const threshold = meanBrightness + 20;

  for (let i = 0; i < d.length; i += 4) {
    const brightness = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (brightness > threshold) {
      d[i] = d[i + 1] = d[i + 2] = 0; // light → black (text)
    } else {
      d[i] = d[i + 1] = d[i + 2] = 255; // dark → white (bg)
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Gold/yellow text isolation — for "WON!" / "LOST" decorative game fonts.
 * Gold text has high R, high G, low B. Isolate pixels where R+G >> B
 * and overall brightness is moderate-to-high.
 */
function preprocessGoldText(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    // Gold/yellow: R > 150, G > 120, B < 100, and bright enough
    // Also catch white text (all channels > 180)
    const isGold = r > 150 && g > 120 && b < 100 && brightness > 100;
    const isWhite = r > 180 && g > 180 && b > 180;
    if (isGold || isWhite) {
      d[i] = d[i + 1] = d[i + 2] = 0; // text → black
    } else {
      d[i] = d[i + 1] = d[i + 2] = 255; // bg → white
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Panel-specific preprocess: game UI name text is bright/colored on
 * dark semi-transparent bg. Lower threshold (100) + saturation boost
 * to catch colored text (blue Kingambit label, green Victreebel, etc).
 */
function preprocessPanelText(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    const maxC = Math.max(r, g, b);
    // Bright text OR saturated colored text → black (for OCR)
    if (brightness > 100 || maxC > 150) {
      d[i] = d[i + 1] = d[i + 2] = 0;
    } else {
      d[i] = d[i + 1] = d[i + 2] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// ─── Screen capture helpers ─────────────────────────────────────

let _captureStream: MediaStream | null = null;
let _videoEl: HTMLVideoElement | null = null;

export async function startCapture(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 60 },
    audio: false,
  });
  _captureStream = stream;
  _videoEl = document.createElement('video');
  _videoEl.srcObject = stream;
  _videoEl.muted = true;
  await _videoEl.play();

  stream.getVideoTracks()[0].addEventListener('ended', () => stopCapture());
  return stream;
}

export function stopCapture() {
  if (_captureStream) {
    _captureStream.getTracks().forEach(t => t.stop());
    _captureStream = null;
  }
  if (_videoEl) {
    _videoEl.pause();
    _videoEl.srcObject = null;
    _videoEl = null;
  }
}

export function isCaptureActive(): boolean {
  return _captureStream !== null && _captureStream.active;
}
export function getCaptureStream(): MediaStream | null {
  return _captureStream;
}

export function grabFrame(): HTMLCanvasElement | null {
  if (!_videoEl || !_captureStream?.active) return null;
  const canvas = document.createElement('canvas');
  canvas.width = _videoEl.videoWidth;
  canvas.height = _videoEl.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(_videoEl, 0, 0);
  return canvas;
}

export function grabFrameAsUrl(): string | null {
  const canvas = grabFrame();
  return canvas?.toDataURL('image/jpeg', 0.7) ?? null;
}
