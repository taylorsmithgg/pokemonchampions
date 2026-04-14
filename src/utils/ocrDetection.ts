// ─── OCR-based Pokemon Detection ────────────────────────────────
//
// Uses Tesseract.js to read text from captured frames, then matches
// against our known Pokemon species list. Runs multiple preprocessing
// passes to handle different text styles (white on dark, colored text,
// etc.) and uses strict matching to minimize false positives.

import { createWorker, type Worker, PSM } from 'tesseract.js';
import { getAvailablePokemon } from '../data/champions';
import { loadSpriteProfiles, scanFrame as spritesScanFrame } from './screenCapture';

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
    _worker = await createWorker('eng', 1, {
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

    // Also preload sprite profiles for icon matching (non-blocking)
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

  // Sprite detection may return base forms — add reverse lookups
  // so "ninetalesalola" matches "Ninetales-Alola" etc.
  // These are already covered by the normalize above, but add
  // common OCR-friendly aliases for multi-word forms.
  const aliases: Record<string, string> = {
    'rotomwash': 'Rotom-Wash', 'rotomheat': 'Rotom-Heat',
    'rotomfrost': 'Rotom-Frost', 'rotommow': 'Rotom-Mow',
    'rotomfan': 'Rotom-Fan',
  };
  for (const [key, val] of Object.entries(aliases)) {
    if (!map.has(key)) map.set(key, val);
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

  // 3. Levenshtein distance 2, but only for longer names (7+ chars)
  if (clean.length >= 7) {
    let bestMatch: string | null = null;
    let bestDist = 3;
    for (const [key, species] of normMap) {
      if (Math.abs(key.length - clean.length) > 2) continue;
      if (key.length < 5) continue;
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

  // Pattern: "Opposing X used/sent/fainted" — opponent Pokemon
  for (const species of allSpecies) {
    const escaped = species.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // "Opposing X" or "opposing X" or "the opposing X"
    const oppRegex = new RegExp(`(?:opposing|the opposing)\\s+${escaped}`, 'i');
    if (oppRegex.test(text) && !seen.has(species)) {
      seen.add(species);
      results.push({ species, pattern: `opposing ${species}`, isOpponent: true });
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
  /** How the match was found */
  method: 'token' | 'battlelog';
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
}

export type ScreenContext = 'battle' | 'menu' | 'unknown';

export interface OcrDetectionResult {
  rawText: string;
  tokens: string[];
  matched: OcrMatch[];
  spriteMatched: SpriteMatch[];
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

/**
 * Run TARGETED OCR on HP bar panel regions + full-frame fallback.
 * Panel OCR is fast (small crops) and reliable (fixed positions).
 */
export async function detectPokemonFromFrame(
  canvas: HTMLCanvasElement,
): Promise<OcrDetectionResult> {
  const t0 = performance.now();

  const emptySide: SideDetection = { hasOpposingLabel: false, opposingSide: 'unknown', debug: '' };
  if (!_worker || !_workerReady) {
    return { rawText: '', tokens: [], matched: [], spriteMatched: [], rejected: [], species: [], durationMs: 0, bestPass: 'none', matchResult: null, matchResultDebug: '', screenContext: 'unknown', screenContextDebug: '', sideDetection: emptySide, battleLogMatches: [] };
  }

  // ── FAST PANEL OCR ──
  // HP bar panels are at fixed positions. OCR just those regions first.
  // Bottom-left panel (YOUR mon): x 2-40%, y 60-85%
  // Top-right panel (OPP mon): x 55-98%, y 10-40%
  // Much faster than full-frame OCR and gives exact side assignment.
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
      const { data } = await _worker!.recognize(processed);
      const tokens = tokenize(data.text);
      for (const token of tokens) {
        const result = matchToken(token);
        if (result && result.confidence >= 0.6) {
          panelMatches.push({ ...result, token, side, method: 'token' });
        }
      }
    } catch { /* panel OCR failed, continue with full-frame */ }
  };

  // ── BATTLE SCREEN panels (HP bars at corners)
  await Promise.all([
    ocrPanel(w * 0.00, h * 0.82, w * 0.25, h * 1.00, 'left'),
    ocrPanel(w * 0.68, h * 0.00, w * 1.00, h * 0.18, 'right'),
  ]);

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
      const { data } = await _worker!.recognize(pc);
      const tokens = tokenize(data.text);
      for (const token of tokens) {
        const result = matchToken(token);
        if (result && result.confidence >= 0.6) {
          panelMatches.push({ ...result, token, side: 'left', method: 'token' });
        }
      }
    } catch { /* selection OCR failed */ }
  };
  await ocrSelectionColumn();

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
  let bestPassCount = 0;

  // Match result detection: look for "Won"/"Lost" with position info
  let matchResult: MatchResult = null;
  let matchResultDebug = '';
  let sideDetection: SideDetection = { ...emptySide };

  for (const pass of passes) {
    const { data } = await _worker.recognize(pass.canvas);
    const rawText = data.text;
    const tokens = tokenize(rawText);

    // Build word position map for this pass
    const wordPositions = new Map<string, { x: number; side: 'left' | 'right' }>();
    const frameWidth = scaled.width;
    const midX = frameWidth / 2;

    const words = (data as unknown as { words?: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }).words;
    if (words) {
      for (const word of words) {
        const centerX = (word.bbox.x0 + word.bbox.x1) / 2;
        wordPositions.set(word.text.toLowerCase(), {
          x: centerX,
          side: centerX < midX ? 'left' : 'right',
        });
      }

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

    let passMatchCount = 0;
    for (const token of tokens) {
      const result = matchToken(token);
      if (result && !allMatched.has(result.species)) {
        // Determine which side this token is on
        const pos = wordPositions.get(token.toLowerCase());
        const side = pos?.side ?? 'unknown';
        allMatched.set(result.species, { ...result, token, side, method: 'token' });
        passMatchCount++;
      } else if (!result && token.length >= 4 && /^[A-Za-z]+$/.test(token)) {
        const clean = token.toLowerCase().replace(/[^a-z]/g, '');
        if (clean.length >= 4 && !allRejected.some(r => r.token === token)) {
          allRejected.push({ token, reason: `No species match (pass: ${pass.name})` });
        }
      }
    }

    // Detect match result from word-level bounding boxes.
    // The game shows "Won"/"Lost" — left is player's result, right is opponent's.
    // Use scaled frame width for correct midpoint (OCR ran on scaled canvas).
    const words2 = (data as unknown as { words?: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }).words;
    if (words2) {
      const scaledMidX = scaled.width / 2;

      for (const word of words2) {
        const raw = word.text.trim();
        const text = raw.toLowerCase().replace(/[^a-z]/g, '');

        // Fuzzy match: OCR may misread game fonts
        const isWon = text === 'won' || text === 'win' || text === 'victory'
          || text === 'woni' || text === 'wonl' || text === 'w0n'
          || (text.length >= 3 && text.length <= 5 && levenshtein(text, 'won') <= 1)
          || (text.length >= 5 && text.length <= 8 && levenshtein(text, 'victory') <= 2);

        const isLost = text === 'lost' || text === 'loss' || text === 'defeat'
          || text === 'lose' || text === 'lostl' || text === 'l0st'
          || (text.length >= 4 && text.length <= 5 && levenshtein(text, 'lost') <= 1)
          || (text.length >= 5 && text.length <= 7 && levenshtein(text, 'defeat') <= 2);

        if (isWon || isLost) {
          const bbox = word.bbox;
          const wordCenterX = (bbox.x0 + bbox.x1) / 2;
          const isLeftSide = wordCenterX < scaledMidX;

          const newDebug = `"${raw}" at x=${Math.round(wordCenterX)} (${isLeftSide ? 'LEFT' : 'RIGHT'} of midpoint ${Math.round(scaledMidX)}), pass: ${pass.name}`;

          // Take the result — later passes can override with higher confidence
          const newResult = isLeftSide
            ? (isWon ? 'win' : 'loss')     // left = player's result
            : (isWon ? 'loss' : 'win');     // right = opponent's result (inverse)

          matchResult = newResult as MatchResult;
          matchResultDebug = newDebug;
          break;
        }
      }
    }

    if (passMatchCount > bestPassCount) {
      bestPassCount = passMatchCount;
      bestPassName = pass.name;
      allRawText = rawText;
      allTokens = tokens;
    }

    if (!allRawText && rawText.trim()) {
      allRawText = rawText;
      allTokens = tokens;
    }
  }

  // Fallback: if word-level detection missed it, scan raw text for result keywords.
  // Without position info we can't determine side, but if the text contains
  // ONLY "won" or ONLY "lost" (not both), it's likely the results screen.
  if (!matchResult && allRawText) {
    const lower = allRawText.toLowerCase();
    const hasWon = /\bwon\b|\bvictory\b|\bwin\b/.test(lower);
    const hasLost = /\blost\b|\bdefeat\b|\blose\b/.test(lower);
    if (hasWon && !hasLost) {
      matchResult = 'win';
      matchResultDebug = `Fallback text match: found "won/victory" in raw OCR (no position data)`;
    } else if (hasLost && !hasWon) {
      matchResult = 'loss';
      matchResultDebug = `Fallback text match: found "lost/defeat" in raw OCR (no position data)`;
    }
  }

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

  // ── TARGETED sprite matching at known UI positions ──
  // Much more accurate than full-frame grid scan.
  const spriteMatched: SpriteMatch[] = [];
  const cw = cropped.width, ch = cropped.height;
  try {
    const ctx = cropped.getContext('2d');
    if (ctx) {
      // Helper: extract a region and match against sprite profiles
      const matchRegion = async (rx: number, ry: number, rw: number, rh: number, _side?: 'left' | 'right') => {
        const regionData = ctx.getImageData(Math.round(rx), Math.round(ry), Math.round(rw), Math.round(rh));
        const regionScan = await spritesScanFrame(regionData, Math.round(rw), Math.round(rh), 2);
        for (const det of regionScan.detections) {
          if (det.confidence >= 0.15) {
            spriteMatched.push({
              species: det.species,
              confidence: det.confidence,
              // Map coordinates back to cropped frame space
              x: rx + det.x,
              y: ry + det.y,
            });
          }
        }
      };

      // Selection screen: 6 opponent slots in right column (x 78-96%)
      for (let i = 0; i < 6; i++) {
        const slotY = ch * (0.08 + i * 0.135);
        const slotH = ch * 0.12;
        await matchRegion(cw * 0.78, slotY, cw * 0.18, slotH, 'right');
      }

      // Selection screen: 6 YOUR team icon sprites in left column
      // Small icons at x 1-7%, same vertical slots as the names.
      // Catches nicknamed Pokemon that OCR can't identify by text.
      for (let i = 0; i < 6; i++) {
        const slotY = ch * (0.08 + i * 0.145);
        const slotH = ch * 0.11;
        await matchRegion(cw * 0.01, slotY, cw * 0.07, slotH, 'left');
      }

      // Battle screen: small icon sprites in HP bar panels
      // BL icon: x 0-8%, y 85-95%
      await matchRegion(0, ch * 0.85, cw * 0.08, ch * 0.10, 'left');
      // TR icon: x 88-98%, y 0-10%
      await matchRegion(cw * 0.88, 0, cw * 0.10, ch * 0.10, 'right');

      // Also do a lighter full-frame scan as fallback (fewer sizes, wider step)
      const imageData = ctx.getImageData(0, 0, cw, ch);
      const fullScan = await spritesScanFrame(imageData, cw, ch, 8);
      for (const det of fullScan.detections) {
        if (det.confidence >= 0.25 && !spriteMatched.some(s => s.species === det.species)) {
          spriteMatched.push({
            species: det.species,
            confidence: det.confidence,
            x: det.x,
            y: det.y,
          });
        }
      }
    }
  } catch { /* sprite detection is best-effort */ }

  // Detect battle UI panels at bottom-left + top-right
  // (standard HP/Pokemon panels in every battle screen, arena-independent)
  const panels = detectBattlePanels(cropped);

  const allSeenTokens = [...new Set([...allTokens, ...allRejected.map(r => r.token)])];
  const { context: screenContext, debug: screenContextDebug } = classifyScreen(
    allSeenTokens,
    spriteMatched.length,
    panels,
  );

  if (screenContext === 'menu') {
    return {
      rawText: allRawText,
      tokens: allTokens,
      matched: [],
      spriteMatched: [],
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
  const ocrSpecies = new Set(matched.map(m => m.species));
  const spriteOnly = spriteMatched.filter(s => !ocrSpecies.has(s.species));
  const allSpecies = [
    ...matched.map(m => m.species),
    ...spriteOnly.map(s => s.species),
  ];
  // Deduplicate
  const uniqueSpecies = [...new Set(allSpecies)];

  return {
    rawText: allRawText,
    tokens: allTokens,
    matched,
    spriteMatched,
    rejected: allRejected.slice(0, 10),
    species: uniqueSpecies,
    durationMs: Math.round(performance.now() - t0),
    bestPass: bestPassName,
    matchResult,
    matchResultDebug,
    screenContext,
    screenContextDebug,
    sideDetection,
    battleLogMatches,
  };
}

/** Tokenize OCR text into potential Pokemon name candidates. */
function tokenize(text: string): string[] {
  return text
    .split(/[\s,;:|/\\()\[\]{}<>_@#$%^&*!?~`"+=]+/)
    .map(t => t.trim().replace(/^[.\-]+|[.\-]+$/g, ''))
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
    video: { frameRate: 2 },
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
