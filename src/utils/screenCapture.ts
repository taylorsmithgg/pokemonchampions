// ─── Screen Capture + Sprite Detection ─────────────────────────────
//
// Uses the browser's Screen Capture API (getDisplayMedia) to capture
// the game window, then identifies Pokemon sprites via multi-pass
// template matching with visual scan feedback.

import { getAvailablePokemon } from '../data/champions';
import { SELECTION_REFERENCE_SEEDS } from '../data/selectionReferenceCatalog';
import { getSpriteUrl } from './sprites';

// ─── Screen capture stream management ──────────────────────────────

let _captureStream: MediaStream | null = null;
let _videoEl: HTMLVideoElement | null = null;

export async function startScreenCapture(): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 5 },
      audio: false,
    });
    _captureStream = stream;

    _videoEl = document.createElement('video');
    _videoEl.srcObject = stream;
    _videoEl.muted = true;
    await _videoEl.play();

    stream.getVideoTracks()[0].addEventListener('ended', () => {
      stopScreenCapture();
    });

    return stream;
  } catch (err) {
    console.warn('[screenCapture] User denied or error:', err);
    throw err;
  }
}

export function stopScreenCapture() {
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

export function isCapturing(): boolean {
  return _captureStream !== null && _captureStream.active;
}

export function captureFrame(): { canvas: HTMLCanvasElement; imageData: ImageData } | null {
  if (!_videoEl || !_captureStream?.active) return null;

  const canvas = document.createElement('canvas');
  canvas.width = _videoEl.videoWidth;
  canvas.height = _videoEl.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(_videoEl, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { canvas, imageData };
}

export function captureFrameAsUrl(): string | null {
  const result = captureFrame();
  if (!result) return null;
  return result.canvas.toDataURL('image/jpeg', 0.8);
}

// ─── Sprite Profiles (improved) ────────────────────────────────────

interface SpriteProfile {
  species: string;
  /** 8 dominant colors in HSV-ish space */
  colors: [number, number, number][];
  /** Color histogram (16 hue bins × 4 sat bins × 4 val bins = 256 bins) */
  histogram: Float32Array;
  /** Original sprite dimensions for aspect ratio */
  width: number;
  height: number;
  /** Sprite pixel data for template matching (downscaled) */
  templateData: Uint8ClampedArray;
  templateW: number;
  templateH: number;
}

export interface SpriteProfileCandidate {
  species: string;
  score: number;
  confidence: number;
}

let _spriteProfiles: SpriteProfile[] | null = null;
let _profilesLoading = false;
let _profilesProgress = 0;
let _selectionSeedsLoaded = false;

export function getProfileLoadProgress(): number { return _profilesProgress; }

/** Convert RGB to HSV. Returns [h:0-360, s:0-1, v:0-1]. */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return [h, s, v];
}

/** Build a normalized HSV histogram (16 hue × 4 sat × 4 val = 256 bins). */
function buildHsvHistogram(data: Uint8ClampedArray, stride: number = 4): Float32Array {
  const hist = new Float32Array(256);
  let count = 0;
  for (let i = 0; i < data.length; i += stride * 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    if (r < 15 && g < 15 && b < 15) continue; // near-black bg
    if (r > 240 && g > 240 && b > 240) continue; // near-white bg
    const [h, s, v] = rgbToHsv(r, g, b);
    const hBin = Math.min(15, Math.floor(h / 22.5));
    const sBin = Math.min(3, Math.floor(s * 4));
    const vBin = Math.min(3, Math.floor(v * 4));
    hist[hBin * 16 + sBin * 4 + vBin]++;
    count++;
  }
  if (count > 0) for (let i = 0; i < 256; i++) hist[i] /= count;
  return hist;
}

/** Histogram intersection similarity (higher = more similar, range 0-1). */
function histogramSimilarity(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.min(a[i], b[i]);
  return sum;
}

/** Compute dominant colors from pixel data using HSV clustering. */
function computeDominantColors(data: Uint8ClampedArray, k: number = 8): [number, number, number][] {
  const buckets = new Map<string, { sum: [number, number, number]; count: number }>();
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    if (r < 15 && g < 15 && b < 15) continue;
    if (r > 240 && g > 240 && b > 240) continue;
    const key = `${Math.floor(r / 24)},${Math.floor(g / 24)},${Math.floor(b / 24)}`;
    const bucket = buckets.get(key) || { sum: [0, 0, 0] as [number, number, number], count: 0 };
    bucket.sum[0] += r; bucket.sum[1] += g; bucket.sum[2] += b;
    bucket.count++;
    buckets.set(key, bucket);
  }
  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, k)
    .map(b => [
      Math.round(b.sum[0] / b.count),
      Math.round(b.sum[1] / b.count),
      Math.round(b.sum[2] / b.count),
    ] as [number, number, number]);
}

function buildProfileFromImageData(
  species: string,
  imageData: ImageData,
  width: number,
  height: number,
): SpriteProfile | null {
  const colors = computeDominantColors(imageData.data);
  if (colors.length === 0) return null;
  const histogram = buildHsvHistogram(imageData.data, 2);

  const tw = 32, th = 32;
  const c2 = document.createElement('canvas');
  c2.width = tw; c2.height = th;
  const ctx2 = c2.getContext('2d');
  if (!ctx2) return null;
  const tmp = document.createElement('canvas');
  tmp.width = width;
  tmp.height = height;
  tmp.getContext('2d')!.putImageData(imageData, 0, 0);
  ctx2.drawImage(tmp, 0, 0, tw, th);
  const templateImg = ctx2.getImageData(0, 0, tw, th);

  return {
    species,
    colors,
    histogram,
    width,
    height,
    templateData: templateImg.data,
    templateW: tw,
    templateH: th,
  };
}

/** Load and profile a single sprite. */
function loadSpriteProfile(species: string): Promise<SpriteProfile | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Full-size for color profiling
      const c1 = document.createElement('canvas');
      c1.width = img.width; c1.height = img.height;
      const ctx1 = c1.getContext('2d');
      if (!ctx1) { resolve(null); return; }
      ctx1.drawImage(img, 0, 0);
      try {
        const fullData = ctx1.getImageData(0, 0, img.width, img.height);
        resolve(buildProfileFromImageData(species, fullData, img.width, img.height));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = getSpriteUrl(species);
  });
}

async function seedSelectionReferenceProfiles(profiles: SpriteProfile[]): Promise<void> {
  if (_selectionSeedsLoaded || profiles.length === 0) return;

  for (const seed of SELECTION_REFERENCE_SEEDS) {
    await new Promise<void>(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve();
            return;
          }
          ctx.drawImage(img, 0, 0);
          const sx = Math.max(0, Math.round(img.width * seed.region.x));
          const sy = Math.max(0, Math.round(img.height * seed.region.y));
          const sw = Math.max(16, Math.round(img.width * seed.region.w));
          const sh = Math.max(16, Math.round(img.height * seed.region.h));
          const sample = ctx.getImageData(
            sx,
            sy,
            Math.min(sw, img.width - sx),
            Math.min(sh, img.height - sy),
          );
          const profile = buildProfileFromImageData(seed.species, sample, sample.width, sample.height);
          if (profile) {
            profiles.push(profile);
          }
        } catch {
          // Ignore bad seed crops and keep loading the rest.
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = seed.imageUrl;
    });
  }

  _selectionSeedsLoaded = true;
}

export async function loadSpriteProfiles(maxSpecies: number = 250): Promise<SpriteProfile[]> {
  if (_spriteProfiles) return _spriteProfiles;
  if (_profilesLoading) {
    while (_profilesLoading) await new Promise(r => setTimeout(r, 100));
    return _spriteProfiles || [];
  }
  _profilesLoading = true;
  _profilesProgress = 0;

  const species = getAvailablePokemon().slice(0, maxSpecies);
  const profiles: SpriteProfile[] = [];
  const batchSize = 15;

  for (let i = 0; i < species.length; i += batchSize) {
    const batch = species.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(s => loadSpriteProfile(s)));
    for (const r of results) if (r && r.colors.length > 0) profiles.push(r);
    _profilesProgress = Math.round(((i + batch.length) / species.length) * 100);
  }

  await seedSelectionReferenceProfiles(profiles);

  _spriteProfiles = profiles;
  _profilesLoading = false;
  _profilesProgress = 100;
  return profiles;
}

// ─── Training: add real in-game sprite as additional profile ─────
//
// Showdown's 2D sprites differ visually from in-game 3D models on
// a compressed Twitch stream. Once a Pokemon is correctly identified
// (e.g. via OCR battle log), we can capture its actual on-screen
// region and add it as a SECOND profile for the same species.
// Subsequent matching sees both Showdown sprite + real game sprite
// in candidate pool — much higher chance of a hit.

const _trainedRegions = new Map<string, number>(); // species → count of trained samples

/**
 * Add a captured frame region as a trained profile for a known species.
 * Called when we KNOW (via OCR or user confirmation) what Pokemon is in
 * the region — locks in the in-game appearance for future matching.
 */
export async function addTrainedProfile(
  species: string,
  canvas: HTMLCanvasElement,
  region: { x: number; y: number; w: number; h: number },
): Promise<void> {
  if (!_spriteProfiles) await loadSpriteProfiles();
  if (!_spriteProfiles) return;

  // Cap samples per species to avoid bloat
  const existing = _trainedRegions.get(species) ?? 0;
  if (existing >= 5) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const sw = Math.max(1, Math.round(region.w));
  const sh = Math.max(1, Math.round(region.h));
  const sample = ctx.getImageData(Math.round(region.x), Math.round(region.y), sw, sh);
  if (sample.width < 16 || sample.height < 16) return;

  const profile = buildProfileFromImageData(species, sample, sw, sh);
  if (profile) {
    _spriteProfiles.push(profile);
    _trainedRegions.set(species, existing + 1);
  }
}

export async function rankRegionWithSpriteProfiles(
  canvas: HTMLCanvasElement,
  region: { x: number; y: number; w: number; h: number },
  topN: number = 5,
): Promise<SpriteProfileCandidate[]> {
  const profiles = await loadSpriteProfiles();
  if (profiles.length === 0) return [];

  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const rw = Math.max(1, Math.round(region.w));
  const rh = Math.max(1, Math.round(region.h));
  if (rw < 16 || rh < 16) return [];

  const regionImgData = ctx.getImageData(Math.round(region.x), Math.round(region.y), rw, rh);
  const regionHist = buildHsvHistogram(regionImgData.data, 2);

  const miniCanvas = document.createElement('canvas');
  miniCanvas.width = 32;
  miniCanvas.height = 32;
  const miniCtx = miniCanvas.getContext('2d');
  if (!miniCtx) return [];

  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = rw;
  tmpCanvas.height = rh;
  tmpCanvas.getContext('2d')!.putImageData(regionImgData, 0, 0);
  miniCtx.drawImage(tmpCanvas, 0, 0, 32, 32);
  const miniData = miniCtx.getImageData(0, 0, 32, 32);

  const bestBySpecies = new Map<string, number>();
  for (const profile of profiles) {
    const histScore = histogramSimilarity(regionHist, profile.histogram);
    const templateScore = templateMatchScore(miniData.data, profile.templateData);
    const finalScore = histScore * 0.15 + templateScore * 0.85;
    const existing = bestBySpecies.get(profile.species) ?? -1;
    if (finalScore > existing) {
      bestBySpecies.set(profile.species, finalScore);
    }
  }

  return [...bestBySpecies.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([species, score]) => ({
      species,
      score,
      confidence: Math.max(0, Math.min(1, score * 2.5)),
    }));
}

export function getTrainedSampleCount(): Record<string, number> {
  return Object.fromEntries(_trainedRegions);
}

export function clearTrainedSamples(): void {
  if (!_spriteProfiles) return;
  // Rebuild profiles list — keep only the first occurrence of each species
  // (the original Showdown one)
  const seen = new Set<string>();
  _spriteProfiles = _spriteProfiles.filter(p => {
    if (seen.has(p.species)) return false;
    seen.add(p.species);
    return true;
  });
  _trainedRegions.clear();
}

// ─── Detection ─────────────────────────────────────────────────────

export interface ScanRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Best matching species for this region (may be null) */
  match: string | null;
  /** Match confidence 0-1 */
  confidence: number;
  /** Was this region accepted as a detection? */
  accepted: boolean;
}

export interface DetectedPokemon {
  species: string;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ScanResult {
  /** All regions that were scanned */
  regions: ScanRegion[];
  /** Accepted detections (high-confidence, deduplicated) */
  detections: DetectedPokemon[];
  /** Frame dimensions */
  frameWidth: number;
  frameHeight: number;
  /** Scan duration in ms */
  durationMs: number;
}

/** Compute NCC-like similarity between a downscaled region and a template. */
function templateMatchScore(regionData: Uint8ClampedArray, template: Uint8ClampedArray): number {
  // Both should be same size (32×32×4)
  const len = Math.min(regionData.length, template.length);
  let dotProduct = 0, normA = 0, normB = 0;
  let validPixels = 0;

  for (let i = 0; i < len; i += 4) {
    const ta = template[i + 3]; // template alpha
    if (ta < 128) continue; // skip transparent template pixels

    const rr = regionData[i], rg = regionData[i + 1], rb = regionData[i + 2];
    const tr = template[i], tg = template[i + 1], tb = template[i + 2];

    // Skip near-black/white in both
    if (rr < 15 && rg < 15 && rb < 15) continue;

    dotProduct += rr * tr + rg * tg + rb * tb;
    normA += rr * rr + rg * rg + rb * rb;
    normB += tr * tr + tg * tg + tb * tb;
    validPixels++;
  }

  if (validPixels < 20 || normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Scan a captured frame for Pokemon sprites.
 * Returns detailed scan results including ALL scanned regions for visualization.
 */
export async function scanFrame(
  imageData: ImageData,
  width: number,
  height: number,
  maxResults: number = 6,
): Promise<ScanResult> {
  const t0 = performance.now();
  const profiles = await loadSpriteProfiles();
  if (profiles.length === 0) {
    return { regions: [], detections: [], frameWidth: width, frameHeight: height, durationMs: 0 };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);

  // Aggressive multi-scale scan — catch everything from tiny selection
  // screen icons to large battle models.
  const baseSize = Math.round(Math.min(width, height) / 8);
  const sizes = [
    Math.round(baseSize * 0.35), // tiny selection icons
    Math.round(baseSize * 0.5),  // small icons
    Math.round(baseSize * 0.7),  // medium icons
    baseSize,                     // standard
    Math.round(baseSize * 1.3),  // large sprites
    Math.round(baseSize * 1.8),  // full battle models
  ];
  const stepFactor = 0.3; // more overlap — fewer missed sprites

  const allRegions: ScanRegion[] = [];
  const candidateMap = new Map<string, { score: number; region: ScanRegion }>();

  for (const regionSize of sizes) {
    const step = Math.round(regionSize * stepFactor);
    // Scan vertically from 10% to 90%, horizontally 5% to 95%
    for (let y = Math.round(height * 0.1); y + regionSize <= Math.round(height * 0.9); y += step) {
      for (let x = Math.round(width * 0.05); x + regionSize <= Math.round(width * 0.95); x += step) {
        const rw = regionSize, rh = regionSize;
        const regionImgData = ctx.getImageData(x, y, rw, rh);

        // Stage 1: Quick histogram comparison to filter candidates
        const regionHist = buildHsvHistogram(regionImgData.data, 4);
        let bestSpecies: string | null = null;
        let bestHistScore = 0;

        for (const profile of profiles) {
          const sim = histogramSimilarity(regionHist, profile.histogram);
          if (sim > bestHistScore) {
            bestHistScore = sim;
            bestSpecies = profile.species;
          }
        }

        // Stage 2: Template matching for top histogram matches
        let finalScore = bestHistScore;
        if (bestHistScore > 0.05 && bestSpecies) {
          // Downscale region to 32×32 for template comparison
          const miniCanvas = document.createElement('canvas');
          miniCanvas.width = 32; miniCanvas.height = 32;
          const miniCtx = miniCanvas.getContext('2d')!;
          // Put region data on temp canvas, then draw scaled
          const tmpCanvas = document.createElement('canvas');
          tmpCanvas.width = rw; tmpCanvas.height = rh;
          tmpCanvas.getContext('2d')!.putImageData(regionImgData, 0, 0);
          miniCtx.drawImage(tmpCanvas, 0, 0, 32, 32);
          const miniData = miniCtx.getImageData(0, 0, 32, 32);

          // Check top histogram matches for template score.
          // Use top 8 (not 5) to ensure regional forms get compared
          // when the base form is a top candidate.
          const histScores: { species: string; histSim: number }[] = [];
          for (const profile of profiles) {
            const sim = histogramSimilarity(regionHist, profile.histogram);
            histScores.push({ species: profile.species, histSim: sim });
          }
          histScores.sort((a, b) => b.histSim - a.histSim);

          // Also add regional variants of top candidates if not already present
          const topSet = new Set(histScores.slice(0, 8).map(h => h.species));
          for (const { species } of histScores.slice(0, 5)) {
            const baseName = species.split('-')[0];
            for (const profile of profiles) {
              if (profile.species.startsWith(baseName + '-') && !topSet.has(profile.species)) {
                topSet.add(profile.species);
              }
            }
          }

          let bestTemplate = 0;
          for (const species of topSet) {
            const profile = profiles.find(p => p.species === species)!;
            if (!profile) continue;
            const tScore = templateMatchScore(miniData.data, profile.templateData);
            if (tScore > bestTemplate) {
              bestTemplate = tScore;
              bestSpecies = species;
            }
          }

          // Combined score: 40% histogram + 60% template
          finalScore = bestHistScore * 0.4 + bestTemplate * 0.6;
        }

        const accepted = finalScore > 0.14 && bestSpecies !== null;
        const region: ScanRegion = {
          x, y, w: rw, h: rh,
          match: bestSpecies,
          confidence: Math.min(1, finalScore * 2.5), // normalize to 0-1 range
          accepted,
        };
        allRegions.push(region);

        // Track best region per species
        if (accepted && bestSpecies) {
          const existing = candidateMap.get(bestSpecies);
          if (!existing || finalScore > existing.score) {
            candidateMap.set(bestSpecies, { score: finalScore, region });
          }
        }
      }
    }
  }

  // Build final detections from best region per species
  const detections: DetectedPokemon[] = [];
  for (const [species, { region }] of candidateMap) {
    detections.push({
      species,
      confidence: region.confidence,
      x: region.x,
      y: region.y,
      w: region.w,
      h: region.h,
    });
  }
  detections.sort((a, b) => b.confidence - a.confidence);

  const durationMs = Math.round(performance.now() - t0);
  return {
    regions: allRegions,
    detections: detections.slice(0, maxResults),
    frameWidth: width,
    frameHeight: height,
    durationMs,
  };
}

// Keep old API for backwards compat
export async function detectPokemonInFrame(
  imageData: ImageData,
  width: number,
  height: number,
  maxResults: number = 6,
): Promise<DetectedPokemon[]> {
  const result = await scanFrame(imageData, width, height, maxResults);
  return result.detections;
}

/**
 * Draw scan visualization overlay on a canvas.
 * Shows: scan grid, detection bounding boxes with labels, confidence bars.
 */
export function drawScanOverlay(
  ctx: CanvasRenderingContext2D,
  scanResult: ScanResult,
  options: {
    showGrid?: boolean;
    showRejected?: boolean;
    showLabels?: boolean;
  } = {},
) {
  const { showGrid = false, showRejected = false, showLabels = true } = options;

  // Draw scanned regions (faint grid)
  if (showGrid) {
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.08)'; // violet tint
    ctx.lineWidth = 0.5;
    for (const region of scanResult.regions) {
      if (!region.accepted && !showRejected) continue;
      ctx.strokeRect(region.x, region.y, region.w, region.h);
    }
  }

  // Draw rejected regions with low match (faint red)
  if (showRejected) {
    for (const region of scanResult.regions) {
      if (region.accepted || region.confidence < 0.05) continue;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(region.x, region.y, region.w, region.h);
    }
  }

  // Draw accepted detections with bounding boxes
  for (const det of scanResult.detections) {
    const conf = det.confidence;
    const color = conf >= 0.6 ? '#22c55e' : conf >= 0.35 ? '#eab308' : '#f97316';
    const bgAlpha = conf >= 0.6 ? 0.15 : conf >= 0.35 ? 0.1 : 0.08;

    // Fill
    ctx.fillStyle = `${color}${Math.round(bgAlpha * 255).toString(16).padStart(2, '0')}`;
    ctx.fillRect(det.x, det.y, det.w, det.h);

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(det.x, det.y, det.w, det.h);

    // Corner brackets for emphasis
    const bracketLen = Math.min(det.w, det.h) * 0.2;
    ctx.lineWidth = 3;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(det.x, det.y + bracketLen);
    ctx.lineTo(det.x, det.y);
    ctx.lineTo(det.x + bracketLen, det.y);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(det.x + det.w - bracketLen, det.y);
    ctx.lineTo(det.x + det.w, det.y);
    ctx.lineTo(det.x + det.w, det.y + bracketLen);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(det.x, det.y + det.h - bracketLen);
    ctx.lineTo(det.x, det.y + det.h);
    ctx.lineTo(det.x + bracketLen, det.y + det.h);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(det.x + det.w - bracketLen, det.y + det.h);
    ctx.lineTo(det.x + det.w, det.y + det.h);
    ctx.lineTo(det.x + det.w, det.y + det.h - bracketLen);
    ctx.stroke();

    // Label
    if (showLabels) {
      const label = `${det.species} ${Math.round(conf * 100)}%`;
      const fontSize = Math.max(12, Math.min(16, det.w / 8));
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
      const metrics = ctx.measureText(label);
      const labelW = metrics.width + 8;
      const labelH = fontSize + 6;
      const labelX = det.x;
      const labelY = det.y - labelH - 2;

      // Label background
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(labelX, Math.max(0, labelY), labelW, labelH);

      // Confidence bar
      const barY = Math.max(0, labelY) + labelH - 3;
      ctx.fillStyle = color;
      ctx.fillRect(labelX, barY, labelW * conf, 2);

      // Label text
      ctx.fillStyle = color;
      ctx.fillText(label, labelX + 4, Math.max(0, labelY) + fontSize);
    }
  }

  // Scan info badge
  const infoText = `${scanResult.detections.length} found · ${scanResult.regions.length} regions · ${scanResult.durationMs}ms`;
  ctx.font = 'bold 11px system-ui, sans-serif';
  const infoW = ctx.measureText(infoText).width + 12;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(scanResult.frameWidth - infoW - 8, 8, infoW, 20);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(infoText, scanResult.frameWidth - infoW - 2, 22);
}
