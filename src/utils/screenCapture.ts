// ─── Screen Capture + Sprite Detection ─────────────────────────────
//
// Uses the browser's Screen Capture API (getDisplayMedia) to capture
// the game window, then attempts to identify Pokemon sprites in the
// captured frame by comparing against our known sprite library.
//
// The Twitch iframe is cross-origin locked — we CANNOT read its
// pixels directly. Instead, we capture the user's entire screen or
// window via getDisplayMedia(), which requires explicit user
// permission but gives us full pixel access.

import { getAvailablePokemon } from '../data/champions';
import { getSpriteUrl } from './sprites';

// ─── Screen capture stream management ──────────────────────────────

let _captureStream: MediaStream | null = null;
let _videoEl: HTMLVideoElement | null = null;

export async function startScreenCapture(): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 5 }, // Low framerate — we only need snapshots
      audio: false,
    });
    _captureStream = stream;

    // Create hidden video element to render the stream
    _videoEl = document.createElement('video');
    _videoEl.srcObject = stream;
    _videoEl.muted = true;
    await _videoEl.play();

    // Auto-cleanup when the user stops sharing
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

/** Capture a single frame from the active screen share as an ImageData. */
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

/** Get a data URL of the current frame (for display). */
export function captureFrameAsUrl(): string | null {
  const result = captureFrame();
  if (!result) return null;
  return result.canvas.toDataURL('image/jpeg', 0.8);
}

// ─── Sprite detection ──────────────────────────────────────────────
//
// Basic color histogram matching. We:
// 1. Load each Pokemon's sprite image
// 2. Compute a color histogram for each sprite
// 3. Scan the captured frame for regions that match a sprite histogram
//
// This is NOT ML-based — it's a simple heuristic. It works best when
// sprites are displayed prominently (team preview screen) and poorly
// when sprites are small, obscured, or animated.

interface SpriteProfile {
  species: string;
  dominantColors: [number, number, number][];
}

let _spriteProfiles: SpriteProfile[] | null = null;
let _profilesLoading = false;

/** Compute dominant colors from an image (simple k-means-lite). */
function computeDominantColors(imageData: ImageData, k: number = 4): [number, number, number][] {
  const pixels: [number, number, number][] = [];
  const d = imageData.data;
  // Sample every 4th pixel for speed
  for (let i = 0; i < d.length; i += 16) {
    const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
    if (a < 128) continue; // Skip transparent
    if (r < 20 && g < 20 && b < 20) continue; // Skip near-black (background)
    pixels.push([r, g, b]);
  }
  if (pixels.length === 0) return [];

  // Simple quantization into color buckets (faster than k-means)
  const buckets = new Map<string, { sum: [number, number, number]; count: number }>();
  for (const [r, g, b] of pixels) {
    const key = `${Math.floor(r / 32)},${Math.floor(g / 32)},${Math.floor(b / 32)}`;
    const bucket = buckets.get(key) || { sum: [0, 0, 0] as [number, number, number], count: 0 };
    bucket.sum[0] += r;
    bucket.sum[1] += g;
    bucket.sum[2] += b;
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

/** Load a sprite image and compute its color profile. */
function loadSpriteProfile(species: string): Promise<SpriteProfile | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0);
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const dominantColors = computeDominantColors(imgData);
        resolve({ species, dominantColors });
      } catch {
        resolve(null); // CORS or other error
      }
    };
    img.onerror = () => resolve(null);
    img.src = getSpriteUrl(species);
  });
}

/** Pre-load sprite profiles for the top N species (by tier). */
export async function loadSpriteProfiles(maxSpecies: number = 80): Promise<SpriteProfile[]> {
  if (_spriteProfiles) return _spriteProfiles;
  if (_profilesLoading) {
    // Wait for existing load
    while (_profilesLoading) await new Promise(r => setTimeout(r, 100));
    return _spriteProfiles || [];
  }
  _profilesLoading = true;

  const species = getAvailablePokemon().slice(0, maxSpecies);
  const profiles: SpriteProfile[] = [];

  // Load in batches to avoid overwhelming the browser
  const batchSize = 10;
  for (let i = 0; i < species.length; i += batchSize) {
    const batch = species.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(s => loadSpriteProfile(s)));
    for (const r of results) if (r && r.dominantColors.length > 0) profiles.push(r);
  }

  _spriteProfiles = profiles;
  _profilesLoading = false;
  return profiles;
}

/** Color distance (Euclidean in RGB space). */
function colorDist(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/** Score how well a region's colors match a sprite profile. Lower = better match. */
function matchScore(regionColors: [number, number, number][], spriteColors: [number, number, number][]): number {
  if (regionColors.length === 0 || spriteColors.length === 0) return Infinity;
  let totalDist = 0;
  for (const sc of spriteColors) {
    let bestDist = Infinity;
    for (const rc of regionColors) {
      const d = colorDist(sc, rc);
      if (d < bestDist) bestDist = d;
    }
    totalDist += bestDist;
  }
  return totalDist / spriteColors.length;
}

export interface DetectedPokemon {
  species: string;
  confidence: number; // 0-1, higher = better
  x: number;
  y: number;
}

/** Scan a captured frame for Pokemon sprites. Returns top N matches. */
export async function detectPokemonInFrame(
  imageData: ImageData,
  width: number,
  height: number,
  maxResults: number = 6,
): Promise<DetectedPokemon[]> {
  const profiles = await loadSpriteProfiles();
  if (profiles.length === 0) return [];

  // Scan the frame in a grid of regions (team preview typically shows
  // sprites in specific positions — we sample broadly)
  const regionSize = Math.min(width, height) / 8;
  const regions: { x: number; y: number; colors: [number, number, number][] }[] = [];

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.putImageData(imageData, 0, 0);

  // Sample regions across the frame (focus on middle rows where team preview appears)
  for (let y = height * 0.2; y < height * 0.8; y += regionSize * 0.5) {
    for (let x = width * 0.1; x < width * 0.9; x += regionSize * 0.5) {
      const rw = Math.min(regionSize, width - x);
      const rh = Math.min(regionSize, height - y);
      if (rw < 20 || rh < 20) continue;
      const regionData = ctx.getImageData(x, y, rw, rh);
      const colors = computeDominantColors(regionData);
      if (colors.length > 0) {
        regions.push({ x, y, colors });
      }
    }
  }

  // Match each region against all sprite profiles
  const matches: DetectedPokemon[] = [];
  const seen = new Set<string>();

  for (const region of regions) {
    let bestMatch: { species: string; score: number } | null = null;
    for (const profile of profiles) {
      const score = matchScore(region.colors, profile.dominantColors);
      if (!bestMatch || score < bestMatch.score) {
        bestMatch = { species: profile.species, score };
      }
    }
    if (bestMatch && bestMatch.score < 80 && !seen.has(bestMatch.species)) {
      seen.add(bestMatch.species);
      matches.push({
        species: bestMatch.species,
        confidence: Math.max(0, Math.min(1, 1 - bestMatch.score / 100)),
        x: region.x,
        y: region.y,
      });
    }
  }

  matches.sort((a, b) => b.confidence - a.confidence);
  return matches.slice(0, maxResults);
}
