#!/usr/bin/env node --experimental-strip-types
/**
 * Dump per-card crops + spriteBbox sub-crops + sprite masks for a
 * single frame, so we can visually inspect what the matcher is
 * operating on.
 *
 * Usage:
 *   node --experimental-strip-types scripts/debug-card-crops.mjs .video-frames/f_00270.jpg
 */
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

import { detectFrame, cropCard } from '../src/utils/spriteDetector/frameDetector.ts';
import { extractSpriteMask, findSpriteBounds } from '../src/utils/spriteDetector/spriteMask.ts';

const framePath = process.argv[2] ?? '.video-frames/f_00270.jpg';
const OUT = '.video-review/card-debug';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

function viewFromImage(img) {
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  const id = c.getContext('2d').getImageData(0, 0, img.width, img.height);
  return { data: id.data, width: id.width, height: id.height };
}

function pixelViewToPng(view, filename) {
  const c = createCanvas(view.width, view.height);
  const ctx = c.getContext('2d');
  const id = ctx.createImageData(view.width, view.height);
  id.data.set(view.data);
  ctx.putImageData(id, 0, 0);
  writeFileSync(filename, c.toBuffer('image/png'));
}

function maskToPng(mask, filename) {
  const c = createCanvas(mask.width, mask.height);
  const ctx = c.getContext('2d');
  const id = ctx.createImageData(mask.width, mask.height);
  for (let i = 0; i < mask.width * mask.height; i++) {
    const v = mask.data[i];
    id.data[i * 4] = v;
    id.data[i * 4 + 1] = v;
    id.data[i * 4 + 2] = v;
    id.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  writeFileSync(filename, c.toBuffer('image/png'));
}

const img = await loadImage(framePath);
const view = viewFromImage(img);
const frame = detectFrame(view);
console.log(`isTeamSelect=${frame.isTeamSelect}  opp=${frame.opponentCards.length}  plr=${frame.playerCards.length}`);
if (!frame.isTeamSelect) process.exit(0);

const base = path.basename(framePath, '.jpg');

for (const [panelName, cards] of [['opp', frame.opponentCards], ['plr', frame.playerCards]]) {
  cards.forEach((card, i) => {
    const cardView = cropCard(view, card);
    pixelViewToPng(cardView, path.join(OUT, `${base}_${panelName}_${i}_card.png`));

    // Extract spriteBbox sub-region.
    const sb = card.spriteBbox;
    const sx = Math.max(0, sb.x1);
    const sy = Math.max(0, sb.y1);
    const sw = Math.min(cardView.width - sx, sb.x2 - sb.x1);
    const sh = Math.min(cardView.height - sy, sb.y2 - sb.y1);
    const bboxData = new Uint8ClampedArray(sw * sh * 4);
    for (let y = 0; y < sh; y++) {
      const srcI = ((sy + y) * cardView.width + sx) * 4;
      bboxData.set(cardView.data.subarray(srcI, srcI + sw * 4), y * sw * 4);
    }
    const bboxView = { data: bboxData, width: sw, height: sh };
    pixelViewToPng(bboxView, path.join(OUT, `${base}_${panelName}_${i}_bbox.png`));

    // Run sprite mask extraction on that bbox region.
    const mask = extractSpriteMask(bboxView, card.panel);
    maskToPng(mask, path.join(OUT, `${base}_${panelName}_${i}_mask.png`));

    const bounds = findSpriteBounds(mask);
    console.log(`${panelName}${i}  card=${cardView.width}x${cardView.height}  bbox=${sw}x${sh}  bounds=${bounds ? `${bounds.minX},${bounds.minY}-${bounds.maxX},${bounds.maxY}` : 'NONE'}`);
  });
}

console.log(`Crops saved to ${OUT}/`);
