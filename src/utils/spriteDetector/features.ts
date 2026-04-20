/**
 * Feature extraction for sprite signatures — the TypeScript analog of
 * the OpenCV helpers used in `pokemon_detector/core/matcher.py` and
 * `sprite_db.py`.
 *
 * A signature bundles:
 *   - hsHist      — 30×32 hue/saturation histogram, row-major, min-max
 *                    normalized to [0, 1]
 *   - phash       — 64-bit perceptual hash (8×8 average-threshold)
 *   - huMoments   — 7 Hu shape moments
 *   - template    — grayscale buffer of the (optionally cropped) sprite
 *   - width/height of the stored template
 *
 * The matcher runs these exact features against the query sprite at
 * detection time.
 */

import type { Mask, PixelView } from './image.ts';

export interface SpriteSignature {
  hsHist: Float32Array;
  phash: Uint8Array; // 64 values, each 0 or 1
  huMoments: Float64Array; // length 7
  template: Uint8Array; // grayscale
  templateWidth: number;
  templateHeight: number;
  maskBytes: Uint8Array; // binary 0/255 — same dimensions as template
}

// ─── HSV histogram (30 × 32 H × S) ────────────────────────────────────
// Mirrors `cv2.calcHist([hsv], [0,1], mask, [30,32], [0,180,0,256])`
// with `cv2.normalize(..., NORM_MINMAX, 0, 1)`.

export const HIST_H_BINS = 30;
export const HIST_S_BINS = 32;
const HIST_TOTAL = HIST_H_BINS * HIST_S_BINS;

export function computeHsHistogram(src: PixelView, mask: Mask): Float32Array {
  const { data, width, height } = src;
  const m = mask.data;
  const hist = new Float32Array(HIST_TOTAL);
  const n = width * height;

  // Inline HSV conversion for speed — avoids an allocation of 3× Uint8Array.
  for (let i = 0; i < n; i++) {
    if (!m[i]) continue;
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const max = r > g ? (r > b ? r : b) : g > b ? g : b;
    const min = r < g ? (r < b ? r : b) : g < b ? g : b;
    const diff = max - min;
    const V = max;
    const S = V === 0 ? 0 : Math.round((diff * 255) / V);
    let H: number;
    if (diff === 0) H = 0;
    else if (max === r) H = (60 * (g - b)) / diff;
    else if (max === g) H = 60 * ((b - r) / diff + 2);
    else H = 60 * ((r - g) / diff + 4);
    if (H < 0) H += 360;
    const Hbin = Math.min(HIST_H_BINS - 1, Math.floor((H / 2) / (180 / HIST_H_BINS)));
    const Sbin = Math.min(HIST_S_BINS - 1, Math.floor(S / (256 / HIST_S_BINS)));
    hist[Hbin * HIST_S_BINS + Sbin]++;
  }

  // Min-max normalize to [0, 1]
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < HIST_TOTAL; i++) {
    if (hist[i] < lo) lo = hist[i];
    if (hist[i] > hi) hi = hist[i];
  }
  const range = hi - lo;
  if (range > 0) {
    for (let i = 0; i < HIST_TOTAL; i++) hist[i] = (hist[i] - lo) / range;
  }
  return hist;
}

/**
 * Bhattacharyya distance between two normalized histograms, mirrored
 * from `cv2.compareHist(..., HISTCMP_BHATTACHARYYA)`.
 *
 *   d = sqrt(1 - 1/sqrt(h1.mean * h2.mean * N^2) · sum(sqrt(h1 * h2)))
 *
 * Returns a value in [0, 1]; 0 = identical, 1 = orthogonal.
 */
export function bhattacharyyaDistance(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error('histogram length mismatch');
  let sumA = 0, sumB = 0, inner = 0;
  for (let i = 0; i < a.length; i++) {
    sumA += a[i];
    sumB += b[i];
    inner += Math.sqrt(a[i] * b[i]);
  }
  const denom = Math.sqrt((sumA * sumB) / (a.length * a.length));
  if (denom <= 0) return 1;
  const inside = 1 - inner / (denom * a.length);
  if (inside < 0) return 0;
  return Math.sqrt(inside);
}

// ─── Perceptual hash (8 × 8 average-threshold) ────────────────────────

export const PHASH_SIZE = 8;

export function computePhash(grayTemplate: Uint8Array, width: number, height: number): Uint8Array {
  const N = PHASH_SIZE * PHASH_SIZE;
  const down = new Uint8Array(N);
  // Area-average downsample to 8×8
  for (let dy = 0; dy < PHASH_SIZE; dy++) {
    const y0 = Math.floor((dy * height) / PHASH_SIZE);
    const y1 = Math.floor(((dy + 1) * height) / PHASH_SIZE);
    for (let dx = 0; dx < PHASH_SIZE; dx++) {
      const x0 = Math.floor((dx * width) / PHASH_SIZE);
      const x1 = Math.floor(((dx + 1) * width) / PHASH_SIZE);
      let sum = 0;
      let count = 0;
      for (let y = y0; y < Math.max(y0 + 1, y1); y++) {
        for (let x = x0; x < Math.max(x0 + 1, x1); x++) {
          sum += grayTemplate[y * width + x];
          count++;
        }
      }
      down[dy * PHASH_SIZE + dx] = count > 0 ? sum / count : 0;
    }
  }
  let mean = 0;
  for (let i = 0; i < N; i++) mean += down[i];
  mean /= N;
  const bits = new Uint8Array(N);
  for (let i = 0; i < N; i++) bits[i] = down[i] > mean ? 1 : 0;
  return bits;
}

export function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) throw new Error('phash length mismatch');
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

// ─── Hu moments ───────────────────────────────────────────────────────
// Port of `cv2.moments` + `cv2.HuMoments`. Operates on a binary mask.

export interface RawMoments {
  m00: number; m10: number; m01: number;
  m20: number; m11: number; m02: number;
  m30: number; m21: number; m12: number; m03: number;
}

export function computeMoments(mask: Mask): RawMoments {
  const { data, width, height } = mask;
  let m00 = 0, m10 = 0, m01 = 0;
  let m20 = 0, m11 = 0, m02 = 0;
  let m30 = 0, m21 = 0, m12 = 0, m03 = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!data[y * width + x]) continue;
      const x2 = x * x, x3 = x2 * x;
      const y2 = y * y, y3 = y2 * y;
      m00 += 1;
      m10 += x;
      m01 += y;
      m20 += x2;
      m11 += x * y;
      m02 += y2;
      m30 += x3;
      m21 += x2 * y;
      m12 += x * y2;
      m03 += y3;
    }
  }
  return { m00, m10, m01, m20, m11, m02, m30, m21, m12, m03 };
}

export function computeHuMoments(mask: Mask): Float64Array {
  const r = computeMoments(mask);
  const out = new Float64Array(7);
  if (r.m00 === 0) return out;

  // Central moments
  const xBar = r.m10 / r.m00;
  const yBar = r.m01 / r.m00;
  const mu20 = r.m20 - xBar * r.m10;
  const mu11 = r.m11 - yBar * r.m10;
  const mu02 = r.m02 - yBar * r.m01;
  const mu30 = r.m30 - 3 * xBar * r.m20 + 2 * xBar * xBar * r.m10;
  const mu21 = r.m21 - 2 * xBar * r.m11 - yBar * r.m20 + 2 * xBar * xBar * r.m01;
  const mu12 = r.m12 - 2 * yBar * r.m11 - xBar * r.m02 + 2 * yBar * yBar * r.m10;
  const mu03 = r.m03 - 3 * yBar * r.m02 + 2 * yBar * yBar * r.m01;

  // Normalized central moments
  const nu = (mu: number, p: number, q: number) =>
    mu / Math.pow(r.m00, 1 + (p + q) / 2);
  const n20 = nu(mu20, 2, 0);
  const n11 = nu(mu11, 1, 1);
  const n02 = nu(mu02, 0, 2);
  const n30 = nu(mu30, 3, 0);
  const n21 = nu(mu21, 2, 1);
  const n12 = nu(mu12, 1, 2);
  const n03 = nu(mu03, 0, 3);

  out[0] = n20 + n02;
  out[1] = (n20 - n02) ** 2 + 4 * n11 * n11;
  out[2] = (n30 - 3 * n12) ** 2 + (3 * n21 - n03) ** 2;
  out[3] = (n30 + n12) ** 2 + (n21 + n03) ** 2;
  out[4] =
    (n30 - 3 * n12) * (n30 + n12) * ((n30 + n12) ** 2 - 3 * (n21 + n03) ** 2) +
    (3 * n21 - n03) * (n21 + n03) * (3 * (n30 + n12) ** 2 - (n21 + n03) ** 2);
  out[5] =
    (n20 - n02) * ((n30 + n12) ** 2 - (n21 + n03) ** 2) +
    4 * n11 * (n30 + n12) * (n21 + n03);
  out[6] =
    (3 * n21 - n03) * (n30 + n12) * ((n30 + n12) ** 2 - 3 * (n21 + n03) ** 2) -
    (n30 - 3 * n12) * (n21 + n03) * (3 * (n30 + n12) ** 2 - (n21 + n03) ** 2);

  return out;
}

/**
 * Match shapes via Hu moments — equivalent to `cv2.matchShapes` with
 * method `CONTOURS_MATCH_I2`:
 *
 *   I2 = sum_i |m_i^A - m_i^B|,     where m_i = sign(h_i) · log(|h_i|)
 *
 * Lower = more similar.
 */
export function shapeDistanceI2(a: Float64Array, b: Float64Array): number {
  let dist = 0;
  for (let i = 0; i < 7; i++) {
    const ai = Math.abs(a[i]) < 1e-12 ? 0 : Math.sign(a[i]) * Math.log(Math.abs(a[i]));
    const bi = Math.abs(b[i]) < 1e-12 ? 0 : Math.sign(b[i]) * Math.log(Math.abs(b[i]));
    dist += Math.abs(ai - bi);
  }
  return dist;
}

// ─── Template (normalized cross-correlation) ──────────────────────────
// OpenCV's TM_CCOEFF_NORMED, but computed once at a single aligned
// scale rather than sweeping 0.3-3.5 like the Python pipeline. The
// card / sprite dimensions are consistent at run-time, so one scale
// is sufficient and ~16× cheaper.

export function normalizedCrossCorrelation(
  queryGray: Uint8Array,
  refGray: Uint8Array,
): number {
  const n = queryGray.length;
  if (n === 0 || refGray.length !== n) return 0;
  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) { sumA += queryGray[i]; sumB += refGray[i]; }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = queryGray[i] - meanA;
    const db = refGray[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  if (den <= 0) return 0;
  return num / den;
}

/** Extract a grayscale Uint8Array from an RGBA crop using Rec. 601 luma. */
export function toGrayscaleBuffer(src: PixelView): Uint8Array {
  const { data, width, height } = src;
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    out[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return out;
}
