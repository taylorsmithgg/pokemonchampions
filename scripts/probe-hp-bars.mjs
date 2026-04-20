#!/usr/bin/env node --experimental-strip-types
/**
 * Probe whether an HP-bar signal cleanly separates the in-battle
 * "Battle Info" overlay from the real team-select screen.
 *
 * For each frame we:
 *   1. Run detectFrame to get per-panel card regions.
 *   2. For each player-panel card, compute the fraction of pixels
 *      matching HP-bar colors (bright green / yellow / orange / red).
 *   3. Report max-card HP-bar fraction per frame.
 *
 * Reference frames:
 *   • Known team-select:    f_00143, f_00650, f_00251
 *   • Known battle-info FPs: f_00142, f_00768
 */
import { createCanvas, loadImage } from 'canvas';
import path from 'path';

import { detectFrame } from '../src/utils/spriteDetector/frameDetector.ts';
import { toHsv } from '../src/utils/spriteDetector/image.ts';

const SAMPLES = [
  ['f_00143.jpg', 'team-select'],
  ['f_00251.jpg', 'team-select'],
  ['f_00650.jpg', 'team-select'],
  ['f_00142.jpg', 'battle-info'],
  ['f_00768.jpg', 'battle-info'],
];

function viewFromImage(img) {
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  const id = c.getContext('2d').getImageData(0, 0, img.width, img.height);
  return { data: id.data, width: id.width, height: id.height };
}

// HP bar colors in HSV (OpenCV-style H 0-179, S/V 0-255):
//   healthy green : H 75-95,   S >120, V >140
//   yellow        : H 25-40,   S >140, V >170
//   red           : H 0-10 or H 165-179, S >140, V >130
function isHpBarPixel(H, S, V) {
  if (S < 120 || V < 130) return false;
  if (H >= 65 && H <= 95 && V >= 140) return true;        // green
  if (H >= 20 && H <= 40 && V >= 170) return true;        // yellow
  if ((H <= 10 || H >= 165) && V >= 130) return true;     // red
  return false;
}

function hpBarFractionInCard(hsv, card) {
  const { h, s, v, width } = hsv;
  const w = card.xEnd - card.xStart;
  const hH = card.yEnd - card.yStart;
  // HP bars sit in the lower ~40% of a card row. Sample that band.
  const y0 = card.yStart + Math.floor(hH * 0.45);
  const y1 = card.yStart + Math.floor(hH * 0.95);
  // HP bars span roughly the left-center of the card (name side).
  const x0 = card.xStart + Math.floor(w * 0.05);
  const x1 = card.xStart + Math.floor(w * 0.60);
  let hits = 0;
  let total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * width + x;
      total++;
      if (isHpBarPixel(h[i], s[i], v[i])) hits++;
    }
  }
  return total > 0 ? hits / total : 0;
}

/** Row-ness test: HP bars are WIDE and THIN. For a card we also want
 *  to check that within the sampled band there's a horizontal run of
 *  HP-pixels filling most of a row (indicating a bar, not scatter). */
function maxRowHpRun(hsv, card) {
  const { h, s, v, width } = hsv;
  const w = card.xEnd - card.xStart;
  const hH = card.yEnd - card.yStart;
  const y0 = card.yStart + Math.floor(hH * 0.45);
  const y1 = card.yStart + Math.floor(hH * 0.95);
  const x0 = card.xStart + Math.floor(w * 0.05);
  const x1 = card.xStart + Math.floor(w * 0.60);
  let best = 0;
  for (let y = y0; y < y1; y++) {
    let run = 0;
    let runBest = 0;
    for (let x = x0; x < x1; x++) {
      const i = y * width + x;
      if (isHpBarPixel(h[i], s[i], v[i])) {
        run++;
        if (run > runBest) runBest = run;
      } else {
        run = 0;
      }
    }
    if (runBest > best) best = runBest;
  }
  // Report as fraction of the sampled x-extent.
  return best / Math.max(1, x1 - x0);
}

for (const [file, label] of SAMPLES) {
  const img = await loadImage(path.join('.video-frames', file));
  const view = viewFromImage(img);
  const hsv = toHsv(view);
  const frame = detectFrame(view);
  if (!frame.isTeamSelect) {
    console.log(`${file}  [${label}]  rejected (oppCards=${frame.opponentCards.length}, plrCards=${frame.playerCards.length})`);
    continue;
  }
  const plrFracs = frame.playerCards.map(c => hpBarFractionInCard(hsv, c));
  const plrRuns  = frame.playerCards.map(c => maxRowHpRun(hsv, c));
  const maxFrac  = Math.max(...plrFracs, 0);
  const maxRun   = Math.max(...plrRuns, 0);
  const cardsWithBar = plrRuns.filter(r => r > 0.6).length;
  console.log(`${file}  [${label}]`);
  console.log(`  plrCards=${frame.playerCards.length}  maxFrac=${maxFrac.toFixed(3)}  maxRun=${maxRun.toFixed(3)}  cardsWithBar(run>0.6)=${cardsWithBar}`);
  console.log(`  perCardRun=[${plrRuns.map(r => r.toFixed(2)).join(', ')}]`);
  console.log(`  perCardFrac=[${plrFracs.map(f => f.toFixed(2)).join(', ')}]`);
}
