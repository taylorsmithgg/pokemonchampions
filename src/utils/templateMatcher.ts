// ─── Sprite Template Matcher (Alpha-Masked Grayscale NCC) ────────
//
// Browser-based sprite matching using Normalized Cross-Correlation
// with alpha masks from reference sprites. Each template stores
// grayscale values for opaque pixels and -1 for transparent pixels.
// At runtime, only non-transparent template pixels are compared
// against the captured region, ignoring colored panel backgrounds.
//
// Multi-frame vote accumulation: the correct species appears at a
// consistent y-position frame after frame; false positives vary
// randomly. Species that win their band across ≥3 frames are
// reported as confident detections.

// ─── Types ───────────────────────────────────────────────────────

interface SpriteTemplate {
  species: string;
  template: number[]; // 48×48, -1 = masked (transparent), 0-255 = grayscale
  color: [number, number, number];
}

interface ScaledTemplate {
  species: string;
  pixels: Float32Array; // non-masked pixel values, mean-centered
  indices: Uint16Array; // positions of non-masked pixels in scaled grid
  size: number;         // scaled template dimension (square)
  norm: number;         // L2 norm of centered values
  count: number;        // number of non-masked pixels
}

interface TemplateDB {
  templates: SpriteTemplate[];
  scaled: Map<number, ScaledTemplate[]>; // size → scaled templates
  ready: boolean;
}

interface VoteEntry {
  species: string;
  votes: number;
  totalScore: number;
  lastSeen: number;
}

// ─── Constants ───────────────────────────────────────────────────

const TEMPLATE_SIZE = 48;
const TARGET_SIZES = [55, 75];
const SLIDE_STEP = 6;
const HIGH_CONFIDENCE_THRESHOLD = 0.75; // immediate detection, no votes needed
const VOTE_THRESHOLD = 3;              // frames needed for confident detection
const VOTE_DECAY_MS = 30_000;          // votes older than this lose weight
const N_BANDS = 6;

// ─── State ───────────────────────────────────────────────────────

const _db: TemplateDB = { templates: [], scaled: new Map(), ready: false };
let _loading = false;

// Per-side vote accumulators: side → band index → candidates
const _voteMap = new Map<string, Map<number, VoteEntry[]>>();

export function isTemplateReady(): boolean { return _db.ready; }

// ─── Loading ─────────────────────────────────────────────────────

export async function loadTemplates(): Promise<void> {
  if (_db.ready || _loading) return;
  _loading = true;
  try {
    const data = (await import('../data/spriteTemplates.json')).default as SpriteTemplate[];
    _db.templates = data;

    // Pre-scale templates for each target size
    for (const size of TARGET_SIZES) {
      _db.scaled.set(size, data.map(t => rescaleTemplate(t, size)));
    }

    _db.ready = true;
    console.log(`[TemplateMatcher] Loaded ${data.length} masked NCC templates, pre-scaled to [${TARGET_SIZES.join(', ')}]px.`);
  } catch (e) {
    console.warn('[TemplateMatcher] Failed to load templates:', e);
  } finally {
    _loading = false;
  }
}

// ─── Template Rescaling ──────────────────────────────────────────

/**
 * Rescale a 48×48 template to targetSize×targetSize using nearest-neighbor.
 * Pre-compute: list of non-masked pixel indices, mean-centered values, L2 norm.
 */
function rescaleTemplate(tmpl: SpriteTemplate, targetSize: number): ScaledTemplate {
  const scale = TEMPLATE_SIZE / targetSize;
  const nonMaskedIdx: number[] = [];
  const nonMaskedVal: number[] = [];

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const srcX = Math.min(Math.floor(x * scale), TEMPLATE_SIZE - 1);
      const srcY = Math.min(Math.floor(y * scale), TEMPLATE_SIZE - 1);
      const val = tmpl.template[srcY * TEMPLATE_SIZE + srcX];
      if (val >= 0) {
        nonMaskedIdx.push(y * targetSize + x);
        nonMaskedVal.push(val);
      }
    }
  }

  const count = nonMaskedVal.length;
  if (count === 0) {
    return {
      species: tmpl.species,
      pixels: new Float32Array(0),
      indices: new Uint16Array(0),
      size: targetSize,
      norm: 0,
      count: 0,
    };
  }

  // Compute mean of non-masked pixels
  let sum = 0;
  for (let i = 0; i < count; i++) sum += nonMaskedVal[i];
  const mean = sum / count;

  // Mean-center and compute norm
  const centered = new Float32Array(count);
  let normSq = 0;
  for (let i = 0; i < count; i++) {
    centered[i] = nonMaskedVal[i] - mean;
    normSq += centered[i] * centered[i];
  }

  return {
    species: tmpl.species,
    pixels: centered,
    indices: new Uint16Array(nonMaskedIdx),
    size: targetSize,
    norm: Math.sqrt(normSq) + 1e-6,
    count,
  };
}

// ─── Grayscale Conversion ────────────────────────────────────────

function toGrayscale(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return gray;
}

// ─── Masked NCC ──────────────────────────────────────────────────

/**
 * Compute NCC between a scaled template and a region of the grayscale image
 * at position (ox, oy). Only uses non-masked template pixels.
 */
function maskedNccAtPosition(
  regionGray: Float32Array,
  regionW: number,
  regionH: number,
  scaled: ScaledTemplate,
  ox: number,
  oy: number,
): number {
  if (scaled.count < 50) return -1; // too few pixels for reliable match
  const { pixels, indices, size, norm, count } = scaled;

  // Bounds check
  if (ox + size > regionW || oy + size > regionH) return -1;

  // Gather region values at template's non-masked positions
  let regionSum = 0;
  for (let i = 0; i < count; i++) {
    const ty = Math.floor(indices[i] / size);
    const tx = indices[i] % size;
    regionSum += regionGray[(oy + ty) * regionW + (ox + tx)];
  }
  const regionMean = regionSum / count;

  // Compute NCC
  let cross = 0;
  let regionNormSq = 0;
  for (let i = 0; i < count; i++) {
    const ty = Math.floor(indices[i] / size);
    const tx = indices[i] % size;
    const rv = regionGray[(oy + ty) * regionW + (ox + tx)] - regionMean;
    cross += pixels[i] * rv;
    regionNormSq += rv * rv;
  }

  const regionNorm = Math.sqrt(regionNormSq) + 1e-6;
  return cross / (norm * regionNorm);
}

// ─── Band Scanning ───────────────────────────────────────────────

interface BandResult {
  bandIndex: number;
  species: string;
  score: number;
}

/**
 * Scan a vertical band of the region across all templates at all scales.
 * Returns the best-scoring template for this band (if above threshold).
 */
function scanBand(
  regionGray: Float32Array,
  regionW: number,
  regionH: number,
  bandY: number,
  bandH: number,
  bandIndex: number,
): BandResult | null {
  let bestScore = -1;
  let bestSpecies = '';

  for (const size of TARGET_SIZES) {
    const scaledTemplates = _db.scaled.get(size);
    if (!scaledTemplates) continue;
    if (size > bandH || size > regionW) continue;

    const maxOy = Math.min(bandY + bandH - size, regionH - size);
    const maxOx = Math.max(0, regionW - size);

    for (const scaled of scaledTemplates) {
      if (scaled.count < 50) continue;

      // Slide vertically within this band
      for (let oy = bandY; oy <= maxOy; oy += SLIDE_STEP) {
        // Slide horizontally (sprites may not be perfectly centered)
        for (let ox = 0; ox <= maxOx; ox += SLIDE_STEP) {
          const score = maskedNccAtPosition(regionGray, regionW, regionH, scaled, ox, oy);
          if (score > bestScore) {
            bestScore = score;
            bestSpecies = scaled.species;
          }
        }
      }
    }
  }

  if (bestScore < 0.4) return null;
  return { bandIndex, species: bestSpecies, score: bestScore };
}

// ─── Vote Accumulation ───────────────────────────────────────────

function accumulateVotes(
  bandResults: (BandResult | null)[],
  sideKey: string,
): void {
  const now = Date.now();

  if (!_voteMap.has(sideKey)) {
    _voteMap.set(sideKey, new Map());
  }
  const sideVotes = _voteMap.get(sideKey)!;

  for (const result of bandResults) {
    if (!result) continue;

    if (!sideVotes.has(result.bandIndex)) {
      sideVotes.set(result.bandIndex, []);
    }
    const entries = sideVotes.get(result.bandIndex)!;

    const existing = entries.find(e => e.species === result.species);
    if (existing) {
      existing.votes++;
      existing.totalScore += result.score;
      existing.lastSeen = now;
    } else {
      entries.push({
        species: result.species,
        votes: 1,
        totalScore: result.score,
        lastSeen: now,
      });
    }
  }
}

function getConfidentDetections(sideKey: string, side: 'left' | 'right', regionX: number, regionY: number, bandH: number): TemplateSpriteMatch[] {
  const now = Date.now();
  const results: TemplateSpriteMatch[] = [];
  const sideVotes = _voteMap.get(sideKey);
  if (!sideVotes) return results;

  const seen = new Set<string>();

  for (const [bandIndex, entries] of sideVotes.entries()) {
    // Decay old entries
    for (let i = entries.length - 1; i >= 0; i--) {
      if (now - entries[i].lastSeen > VOTE_DECAY_MS) {
        entries.splice(i, 1);
      }
    }

    // Sort by votes descending, then by average score
    entries.sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return (b.totalScore / b.votes) - (a.totalScore / a.votes);
    });

    if (entries.length === 0) continue;
    const best = entries[0];
    if (best.votes < VOTE_THRESHOLD) continue;
    if (seen.has(best.species)) continue;
    seen.add(best.species);

    const avgScore = best.totalScore / best.votes;
    const confidence = Math.max(0, Math.min(1, avgScore));

    results.push({
      species: best.species,
      confidence,
      x: regionX,
      y: regionY + bandIndex * bandH,
      side,
    });
  }

  return results;
}

// ─── Single-frame high-confidence detection ──────────────────────

function getImmediateDetections(
  bandResults: (BandResult | null)[],
  side: 'left' | 'right',
  regionX: number,
  regionY: number,
  bandH: number,
): TemplateSpriteMatch[] {
  const results: TemplateSpriteMatch[] = [];
  const seen = new Set<string>();

  for (const result of bandResults) {
    if (!result) continue;
    if (result.score < HIGH_CONFIDENCE_THRESHOLD) continue;
    if (seen.has(result.species)) continue;
    seen.add(result.species);

    results.push({
      species: result.species,
      confidence: Math.max(0, Math.min(1, result.score)),
      x: regionX,
      y: regionY + result.bandIndex * bandH,
      side,
    });
  }

  return results;
}

// ─── Cropped Region Matching (left icons) ────────────────────────

/**
 * Match a well-cropped single-sprite region (e.g., left column icon slot).
 * Uses masked NCC at center position only — no sliding needed.
 */
function matchCroppedRegion(
  regionGray: Float32Array,
  width: number,
  height: number,
): { species: string; score: number } | null {
  if (!_db.ready) return null;

  let bestScore = -1;
  let bestSpecies = '';

  for (const size of TARGET_SIZES) {
    if (size > width || size > height) continue;
    const scaledTemplates = _db.scaled.get(size);
    if (!scaledTemplates) continue;

    const ox = Math.max(0, Math.floor((width - size) / 2));
    const oy = Math.max(0, Math.floor((height - size) / 2));

    for (const scaled of scaledTemplates) {
      if (scaled.count < 50) continue;
      const score = maskedNccAtPosition(regionGray, width, height, scaled, ox, oy);
      if (score > bestScore) {
        bestScore = score;
        bestSpecies = scaled.species;
      }
    }
  }

  if (bestScore < 0.4) return null;
  return { species: bestSpecies, score: bestScore };
}

// ─── Public API ──────────────────────────────────────────────────

export interface TemplateSpriteMatch {
  species: string;
  confidence: number;
  x: number;
  y: number;
  side: 'left' | 'right';
}

export interface TemplateCandidateMatch {
  species: string;
  score: number;
}

export function rankRegionWithTemplates(
  canvas: HTMLCanvasElement,
  region: { x: number; y: number; w: number; h: number },
  topN = 5,
): TemplateCandidateMatch[] {
  if (!_db.ready) return [];

  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const rw = Math.max(1, Math.round(region.w));
  const rh = Math.max(1, Math.round(region.h));
  if (rw < 16 || rh < 16) return [];

  const rx = Math.round(region.x);
  const ry = Math.round(region.y);
  const regionData = ctx.getImageData(rx, ry, rw, rh);
  const regionGray = toGrayscale(regionData.data, rw, rh);
  const bestBySpecies = new Map<string, number>();

  for (const size of TARGET_SIZES) {
    if (size > rw || size > rh) continue;
    const scaledTemplates = _db.scaled.get(size);
    if (!scaledTemplates) continue;

    const centeredOx = Math.max(0, Math.floor((rw - size) / 2));
    const centeredOy = Math.max(0, Math.floor((rh - size) / 2));
    const xSlack = Math.max(0, rw - size);
    const ySlack = Math.max(0, rh - size);
    const xOffsets = Array.from(new Set([
      centeredOx,
      Math.max(0, centeredOx - Math.min(4, centeredOx)),
      Math.min(xSlack, centeredOx + Math.min(4, xSlack - centeredOx)),
    ]));
    const yOffsets = Array.from(new Set([
      centeredOy,
      Math.max(0, centeredOy - Math.min(4, centeredOy)),
      Math.min(ySlack, centeredOy + Math.min(4, ySlack - centeredOy)),
    ]));

    for (const scaled of scaledTemplates) {
      if (scaled.count < 50) continue;

      let bestScore = -1;
      for (const ox of xOffsets) {
        for (const oy of yOffsets) {
          const score = maskedNccAtPosition(regionGray, rw, rh, scaled, ox, oy);
          if (score > bestScore) bestScore = score;
        }
      }

      const existing = bestBySpecies.get(scaled.species) ?? -1;
      if (bestScore > existing) {
        bestBySpecies.set(scaled.species, bestScore);
      }
    }
  }

  return [...bestBySpecies.entries()]
    .filter(([, score]) => score >= 0.2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([species, score]) => ({ species, score }));
}

/**
 * Scan multiple regions of a canvas for sprite matches using masked NCC
 * with multi-frame vote accumulation.
 *
 * - Strip regions (height > 3x width): divide into bands, slide templates,
 *   accumulate votes across frames. Report after ≥3 consistent frames.
 * - Cropped regions: direct NCC comparison.
 * - High-confidence single-frame matches (NCC > 0.75) reported immediately.
 */
export async function scanRegionsWithTemplates(
  canvas: HTMLCanvasElement,
  regions: { x: number; y: number; w: number; h: number; side: 'left' | 'right' }[],
): Promise<TemplateSpriteMatch[]> {
  if (!_db.ready) return [];

  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const results: TemplateSpriteMatch[] = [];
  const seen = new Set<string>();

  const addResult = (match: TemplateSpriteMatch) => {
    if (!seen.has(match.species)) {
      seen.add(match.species);
      results.push(match);
    }
  };

  for (const region of regions) {
    const rx = Math.round(region.x);
    const ry = Math.round(region.y);
    const rw = Math.round(region.w);
    const rh = Math.round(region.h);
    if (rw < 16 || rh < 16) continue;

    const regionData = ctx.getImageData(rx, ry, rw, rh);
    const regionGray = toGrayscale(regionData.data, rw, rh);

    // Strip region: divide into bands with sliding-window NCC + vote accumulation
    if (rh > rw * 3) {
      const bandH = Math.floor(rh / N_BANDS);
      const sideKey = `${region.side}-${rx}`;

      const bandResults: (BandResult | null)[] = [];
      for (let b = 0; b < N_BANDS; b++) {
        const bandY = b * bandH;
        const bH = (b === N_BANDS - 1) ? rh - bandY : bandH;
        bandResults.push(scanBand(regionGray, rw, rh, bandY, bH, b));
      }

      // Immediate high-confidence detections
      for (const m of getImmediateDetections(bandResults, region.side, region.x, region.y, bandH)) {
        addResult(m);
      }

      // Accumulate votes for multi-frame confirmation
      accumulateVotes(bandResults, sideKey);

      // Report species with enough accumulated votes
      for (const m of getConfidentDetections(sideKey, region.side, region.x, region.y, bandH)) {
        addResult(m);
      }
    } else {
      // Cropped single-sprite region
      const match = matchCroppedRegion(regionGray, rw, rh);
      if (match) {
        const confidence = match.score >= HIGH_CONFIDENCE_THRESHOLD
          ? match.score
          : Math.max(0, Math.min(1, match.score));
        addResult({
          species: match.species,
          confidence,
          x: region.x,
          y: region.y,
          side: region.side,
        });
      }
    }
  }

  return results;
}
