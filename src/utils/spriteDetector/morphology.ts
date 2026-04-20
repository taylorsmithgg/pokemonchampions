/**
 * Binary morphology primitives — erode / dilate / open / close, plus
 * connected-component labeling. Mirrors the `cv2.morphologyEx` and
 * `cv2.connectedComponentsWithStats` calls used by the Python detector.
 *
 * Mask convention: Uint8Array with values 0 or 255.
 */

import type { Mask, MutableMask } from './image.ts';
import { createMask } from './image.ts';

/**
 * Dilate with a rectangular kernel (all-ones). Matches the default
 * `cv2.getStructuringElement(MORPH_RECT, ...)` used in the Python
 * detector's frame detector and sprite mask cleanup.
 */
export function dilate(mask: Mask, kernel: number): MutableMask {
  const half = Math.floor(kernel / 2);
  const { width, height, data } = mask;
  const out = createMask(width, height);
  const dst = out.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hit = 0;
      const y0 = Math.max(0, y - half);
      const y1 = Math.min(height - 1, y + half);
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width - 1, x + half);
      outer: for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          if (data[yy * width + xx]) {
            hit = 255;
            break outer;
          }
        }
      }
      dst[y * width + x] = hit;
    }
  }
  return out;
}

/**
 * Erode with a rectangular kernel. Every pixel of the kernel must be
 * set in the input for the output to be set.
 */
export function erode(mask: Mask, kernel: number): MutableMask {
  const half = Math.floor(kernel / 2);
  const { width, height, data } = mask;
  const out = createMask(width, height);
  const dst = out.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let keep = 255;
      const y0 = Math.max(0, y - half);
      const y1 = Math.min(height - 1, y + half);
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width - 1, x + half);
      outer: for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          if (!data[yy * width + xx]) {
            keep = 0;
            break outer;
          }
        }
      }
      dst[y * width + x] = keep;
    }
  }
  return out;
}

/** Morphological opening: erode → dilate. */
export function morphOpen(mask: Mask, kernel: number): MutableMask {
  return dilate(erode(mask, kernel), kernel);
}

/** Morphological closing: dilate → erode. */
export function morphClose(mask: Mask, kernel: number): MutableMask {
  return erode(dilate(mask, kernel), kernel);
}

export interface ConnectedComponent {
  label: number;
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * 4-connected connected-component labeling, returning per-label stats.
 * Label 0 is reserved for background. Output labels Uint32Array contains
 * component id per pixel (0 for background).
 */
export function connectedComponents(mask: Mask): {
  labels: Uint32Array;
  components: ConnectedComponent[];
} {
  const { width, height, data } = mask;
  const labels = new Uint32Array(width * height);
  const components: ConnectedComponent[] = [{ label: 0, area: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 }];
  const stack: number[] = [];

  let nextLabel = 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const seedIdx = y * width + x;
      if (!data[seedIdx] || labels[seedIdx]) continue;

      const label = nextLabel++;
      const comp: ConnectedComponent = {
        label,
        area: 0,
        minX: x,
        minY: y,
        maxX: x,
        maxY: y,
      };
      components.push(comp);

      stack.length = 0;
      stack.push(seedIdx);
      labels[seedIdx] = label;

      while (stack.length > 0) {
        const idx = stack.pop()!;
        const py = Math.floor(idx / width);
        const px = idx - py * width;

        comp.area++;
        if (px < comp.minX) comp.minX = px;
        else if (px > comp.maxX) comp.maxX = px;
        if (py < comp.minY) comp.minY = py;
        else if (py > comp.maxY) comp.maxY = py;

        if (px > 0) {
          const n = idx - 1;
          if (data[n] && !labels[n]) { labels[n] = label; stack.push(n); }
        }
        if (px < width - 1) {
          const n = idx + 1;
          if (data[n] && !labels[n]) { labels[n] = label; stack.push(n); }
        }
        if (py > 0) {
          const n = idx - width;
          if (data[n] && !labels[n]) { labels[n] = label; stack.push(n); }
        }
        if (py < height - 1) {
          const n = idx + width;
          if (data[n] && !labels[n]) { labels[n] = label; stack.push(n); }
        }
      }
    }
  }

  return { labels, components };
}
