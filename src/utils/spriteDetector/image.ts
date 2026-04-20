/**
 * Lightweight image primitives used by the sprite detector.
 *
 * We deliberately avoid depending on any DOM-specific types so the
 * modules can run in both the browser (real HTMLCanvasElement backed
 * ImageData) and in Node via the `canvas` package (during the offline
 * DB build / test harness).
 *
 * Everything the detector needs lives on the `PixelView` interface,
 * which mirrors the shape of a standard `ImageData`:
 *
 *     { data: Uint8ClampedArray; width: number; height: number }
 *
 * ─────────────────────────────────────────────────────────────────
 * Channel layout is always RGBA packed (`data[i*4 + {0,1,2,3}]`).
 * ─────────────────────────────────────────────────────────────────
 */

export interface PixelView {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

export interface MutablePixelView {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Allocate a blank RGBA PixelView. Mirrors `new ImageData(w, h)` but
 * works in pure JS (no DOM).
 */
export function createPixelView(width: number, height: number): MutablePixelView {
  return {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  };
}

/**
 * Crop a PixelView into a new RGBA buffer. Clamps bounds to the
 * source extents.
 */
export function cropPixelView(
  src: PixelView,
  x: number,
  y: number,
  w: number,
  h: number,
): MutablePixelView {
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.max(0, Math.min(src.width - sx, Math.floor(w)));
  const sh = Math.max(0, Math.min(src.height - sy, Math.floor(h)));
  const dst = createPixelView(sw, sh);
  for (let row = 0; row < sh; row++) {
    const srcIdx = ((sy + row) * src.width + sx) * 4;
    const dstIdx = row * sw * 4;
    dst.data.set(src.data.subarray(srcIdx, srcIdx + sw * 4), dstIdx);
  }
  return dst;
}

/**
 * Nearest-neighbor resize. Used when scaling the reference sprite
 * for template matching (matches Python's `cv2.resize` at default
 * INTER_LINEAR quality closely enough — the matcher is dominated by
 * structural agreement, not interpolation fidelity).
 */
export function resizePixelView(src: PixelView, dstW: number, dstH: number): MutablePixelView {
  const dst = createPixelView(dstW, dstH);
  const { data: sData, width: sW, height: sH } = src;
  const dData = dst.data;
  for (let y = 0; y < dstH; y++) {
    const srcY = Math.min(sH - 1, Math.floor(((y + 0.5) * sH) / dstH));
    for (let x = 0; x < dstW; x++) {
      const srcX = Math.min(sW - 1, Math.floor(((x + 0.5) * sW) / dstW));
      const si = (srcY * sW + srcX) * 4;
      const di = (y * dstW + x) * 4;
      dData[di] = sData[si];
      dData[di + 1] = sData[si + 1];
      dData[di + 2] = sData[si + 2];
      dData[di + 3] = sData[si + 3];
    }
  }
  return dst;
}

/**
 * Binary mask = Uint8Array with values 0 or 255.
 * Keeping it separate from RGBA PixelView avoids confusion when an
 * algorithm wants a single-channel mask.
 */
export interface Mask {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export interface MutableMask {
  data: Uint8Array;
  width: number;
  height: number;
}

export function createMask(width: number, height: number): MutableMask {
  return { data: new Uint8Array(width * height), width, height };
}

/** Crop a mask to a sub-region. */
export function cropMask(src: Mask, x: number, y: number, w: number, h: number): MutableMask {
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.max(0, Math.min(src.width - sx, Math.floor(w)));
  const sh = Math.max(0, Math.min(src.height - sy, Math.floor(h)));
  const dst = createMask(sw, sh);
  for (let row = 0; row < sh; row++) {
    const srcIdx = (sy + row) * src.width + sx;
    dst.data.set(src.data.subarray(srcIdx, srcIdx + sw), row * sw);
  }
  return dst;
}

/**
 * Convert RGB → HSV into three separate Uint8Array channels, matching
 * the layout OpenCV produces (`cv2.cvtColor(BGR, HSV)`): H in [0, 180),
 * S/V in [0, 255]. This is the workhorse color transform for both the
 * frame detector and the matcher.
 *
 * The frame detector and background mask both operate on this range.
 */
export interface HsvView {
  readonly h: Uint8Array;
  readonly s: Uint8Array;
  readonly v: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export function toHsv(src: PixelView): HsvView {
  const { data, width, height } = src;
  const n = width * height;
  const hOut = new Uint8Array(n);
  const sOut = new Uint8Array(n);
  const vOut = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];

    const max = r > g ? (r > b ? r : b) : g > b ? g : b;
    const min = r < g ? (r < b ? r : b) : g < b ? g : b;
    const diff = max - min;

    vOut[i] = max;
    sOut[i] = max === 0 ? 0 : Math.round((diff * 255) / max);

    if (diff === 0) {
      hOut[i] = 0;
    } else {
      // OpenCV convention: H ∈ [0, 180) → half the traditional 360° cycle.
      let h: number;
      if (max === r) h = (60 * (g - b)) / diff;
      else if (max === g) h = 60 * ((b - r) / diff + 2);
      else h = 60 * ((r - g) / diff + 4);
      if (h < 0) h += 360;
      hOut[i] = Math.round(h / 2) % 180;
    }
  }

  return { h: hOut, s: sOut, v: vOut, width, height };
}

/** Convert an RGBA PixelView → grayscale Uint8Array (BT.601 luma). */
export function toGrayscale(src: PixelView): Uint8Array {
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
