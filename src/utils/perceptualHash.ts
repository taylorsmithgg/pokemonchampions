// ─── Perceptual Hashing for Sprite Classification ──────────────
//
// dHash (difference hash): resize to 9×8, compute horizontal gradient
// differences → 64-bit hash. Compare via Hamming distance.
// Extremely fast, handles minor compression/scaling well.
// Perfect for matching game sprites against reference database.

import { getAvailablePokemon } from '../data/champions';
import { getSpriteUrl } from './sprites';

// ─── Hash computation ───────────────────────────────────────────

/**
 * Compute a 64-bit dHash from an image/canvas.
 * Returns a BigInt representation of the hash.
 */
export function computeDHash(source: HTMLCanvasElement | HTMLImageElement): bigint {
  // Resize to 9×8 grayscale
  const canvas = document.createElement('canvas');
  canvas.width = 9;
  canvas.height = 8;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, 0, 0, 9, 8);
  const data = ctx.getImageData(0, 0, 9, 8).data;

  // Convert to grayscale values
  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  // Compute difference hash: compare adjacent horizontal pixels
  // 8 columns × 8 rows = 64 bits
  let hash = 0n;
  let bit = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const idx = y * 9 + x;
      if (gray[idx] < gray[idx + 1]) {
        hash |= 1n << BigInt(bit);
      }
      bit++;
    }
  }
  return hash;
}

/**
 * Hamming distance between two 64-bit hashes.
 * Lower = more similar. 0 = identical. ≤10 = likely same sprite.
 */
export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let dist = 0;
  while (xor > 0n) {
    dist += Number(xor & 1n);
    xor >>= 1n;
  }
  return dist;
}

// ─── Hash database ──────────────────────────────────────────────

export interface SpriteHash {
  species: string;
  hash: bigint;
}

let _hashDB: SpriteHash[] | null = null;
let _hashLoading = false;
let _hashProgress = 0;

export function getHashLoadProgress(): number { return _hashProgress; }
export function isHashDBReady(): boolean { return _hashDB !== null; }

/**
 * Load sprite images and compute dHash for each.
 * Builds the reference database for matching.
 */
export async function loadHashDB(maxSpecies = 250): Promise<SpriteHash[]> {
  if (_hashDB) return _hashDB;
  if (_hashLoading) {
    while (_hashLoading) await new Promise(r => setTimeout(r, 100));
    return _hashDB || [];
  }
  _hashLoading = true;
  _hashProgress = 0;

  const species = getAvailablePokemon().slice(0, maxSpecies);
  const db: SpriteHash[] = [];
  const batchSize = 20;

  for (let i = 0; i < species.length; i += batchSize) {
    const batch = species.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(s => loadSpriteHash(s)));
    for (const r of results) if (r) db.push(r);
    _hashProgress = Math.round(((i + batch.length) / species.length) * 100);
  }

  _hashDB = db;
  _hashLoading = false;
  _hashProgress = 100;
  return db;
}

function loadSpriteHash(species: string): Promise<SpriteHash | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const hash = computeDHash(img);
        resolve({ species, hash });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = getSpriteUrl(species);
  });
}

// ─── Matching ───────────────────────────────────────────────────

export interface HashMatch {
  species: string;
  distance: number;
  confidence: number;
}

/**
 * Match a captured region against the hash database.
 * Returns top N matches sorted by distance.
 */
export function matchRegionByHash(
  canvas: HTMLCanvasElement,
  region: { x: number; y: number; w: number; h: number },
  maxResults = 3,
  maxDistance = 18,
): HashMatch[] {
  if (!_hashDB || _hashDB.length === 0) return [];

  // Crop region
  const crop = document.createElement('canvas');
  crop.width = Math.max(1, Math.round(region.w));
  crop.height = Math.max(1, Math.round(region.h));
  const ctx = crop.getContext('2d');
  if (!ctx) return [];
  ctx.drawImage(canvas, Math.round(region.x), Math.round(region.y),
    crop.width, crop.height, 0, 0, crop.width, crop.height);

  // Skip if region is too small or mostly transparent/black
  if (crop.width < 8 || crop.height < 8) return [];

  const regionHash = computeDHash(crop);

  // Compare against all reference hashes
  const matches: HashMatch[] = [];
  for (const ref of _hashDB) {
    const dist = hammingDistance(regionHash, ref.hash);
    if (dist <= maxDistance) {
      matches.push({
        species: ref.species,
        distance: dist,
        confidence: Math.max(0, 1 - dist / 32), // 0 dist = 1.0 conf, 32 dist = 0
      });
    }
  }

  matches.sort((a, b) => a.distance - b.distance);
  return matches.slice(0, maxResults);
}

/**
 * Scan multiple preset regions of a frame for Pokemon sprites.
 * Returns all matches with positions.
 */
export function scanFrameWithHash(
  canvas: HTMLCanvasElement,
  regions: { x: number; y: number; w: number; h: number; side: 'left' | 'right' }[],
): { species: string; confidence: number; x: number; y: number; side: 'left' | 'right' }[] {
  const results: { species: string; confidence: number; x: number; y: number; side: 'left' | 'right' }[] = [];
  const seen = new Set<string>();

  for (const region of regions) {
    const matches = matchRegionByHash(canvas, region, 1, 15);
    if (matches.length > 0 && !seen.has(matches[0].species)) {
      seen.add(matches[0].species);
      results.push({
        species: matches[0].species,
        confidence: matches[0].confidence,
        x: region.x,
        y: region.y,
        side: region.side,
      });
    }
  }

  return results;
}
