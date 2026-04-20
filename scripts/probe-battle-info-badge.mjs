#!/usr/bin/env node --experimental-strip-types
/**
 * Probe the "X close" badge + "Battle Info" label in the top-right
 * corner — a very stable discriminator for the battle-info overlay.
 *
 * The badge is a small white/light-gray circle with a dark X glyph,
 * sitting at approximately (x=82-88%, y=2-8%) of the frame.  The
 * "Battle Info" text sits just to the right.
 *
 * What we actually test: measure the fraction of near-white pixels
 * (low saturation, high value) in a small ROI at top-right. Real
 * team-select has a dark top-right (tournament logo or timer). Battle
 * info has a bright white glyph.
 */
import { createCanvas, loadImage } from 'canvas';
import path from 'path';

import { toHsv } from '../src/utils/spriteDetector/image.ts';

const SAMPLES = [
  ['f_00143.jpg', 'team-select'],
  ['f_00251.jpg', 'team-select'],
  ['f_00650.jpg', 'team-select'],
  ['f_00344.jpg', 'battle-info'],
  ['f_00768.jpg', 'battle-info'],
  ['f_00142.jpg', 'battle-info'],
  // A few frames classified as 'none' to rule out false positives
  // against the broader background:
  ['f_00050.jpg', 'none?'],
  ['f_00400.jpg', 'none?'],
  ['f_00900.jpg', 'none?'],
];

function viewFromImage(img) {
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  const id = c.getContext('2d').getImageData(0, 0, img.width, img.height);
  return { data: id.data, width: id.width, height: id.height };
}

function whiteFractionInRoi(hsv, x0, y0, x1, y1) {
  const { h, s, v, width } = hsv;
  let hits = 0, total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * width + x;
      total++;
      // "Near white" — low sat + high value.
      if (s[i] < 40 && v[i] > 200) hits++;
    }
  }
  return total > 0 ? hits / total : 0;
}

for (const [file, label] of SAMPLES) {
  const img = await loadImage(path.join('.video-frames', file));
  const view = viewFromImage(img);
  const hsv = toHsv(view);
  const W = view.width, H = view.height;

  // Three candidate ROIs — we want the one that fires on battle-info
  // frames and stays quiet on team-select:
  //   A. Upper-right corner badge area (where the "X" sits).
  //   B. The "Battle Info" strap immediately to the right.
  //   C. The full top band for sanity.
  const badge = whiteFractionInRoi(
    hsv,
    Math.floor(W * 0.80),
    Math.floor(H * 0.005),
    Math.floor(W * 0.90),
    Math.floor(H * 0.055),
  );
  const label2 = whiteFractionInRoi(
    hsv,
    Math.floor(W * 0.85),
    Math.floor(H * 0.005),
    Math.floor(W * 0.99),
    Math.floor(H * 0.055),
  );
  const topBand = whiteFractionInRoi(
    hsv,
    Math.floor(W * 0.00),
    Math.floor(H * 0.00),
    Math.floor(W * 1.00),
    Math.floor(H * 0.06),
  );
  console.log(
    `${file}  [${label}]  badge=${(badge * 100).toFixed(1)}%  label=${(label2 * 100).toFixed(1)}%  topBand=${(topBand * 100).toFixed(1)}%`,
  );
}
