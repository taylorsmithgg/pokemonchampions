#!/usr/bin/env node
/** Dump the per-card sprite mask for visual inspection. */

import { createCanvas, loadImage, ImageData } from 'canvas';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

const OUT_DIR = '.detector-debug/masks';

async function load(p) {
  return import(pathToFileURL(join(process.cwd(), p)).href);
}

const { detectFrame, cropCard } = await load('src/utils/spriteDetector/frameDetector.ts');
const { extractSpriteMask, findSpriteBounds } = await load('src/utils/spriteDetector/spriteMask.ts');

const path = process.argv[2] || 'images/lineup-selection-no-overlay.png';
const img = await loadImage(path);
const canvas = createCanvas(img.width, img.height);
canvas.getContext('2d').drawImage(img, 0, 0);
const id = canvas.getContext('2d').getImageData(0, 0, img.width, img.height);
const view = { data: id.data, width: id.width, height: id.height };

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const det = detectFrame(view);

async function dumpCard(card, label) {
  const fullCard = cropCard(view, card);
  const sb = card.spriteBbox;
  const sx = Math.max(0, sb.x1);
  const sy = Math.max(0, sb.y1);
  const sw = Math.min(fullCard.width - sx, sb.x2 - sb.x1);
  const sh = Math.min(fullCard.height - sy, sb.y2 - sb.y1);
  const cardData = new Uint8ClampedArray(sw * sh * 4);
  for (let y = 0; y < sh; y++) {
    const srcI = ((sy + y) * fullCard.width + sx) * 4;
    cardData.set(fullCard.data.subarray(srcI, srcI + sw * 4), y * sw * 4);
  }
  const cardImg = { data: cardData, width: sw, height: sh };
  const mask = extractSpriteMask(cardImg, card.panel);
  const bounds = findSpriteBounds(mask);
  const cellW = cardImg.width;
  const cellH = cardImg.height;
  const bw = bounds ? bounds.maxX - bounds.minX + 1 : cellW;
  const bh = bounds ? bounds.maxY - bounds.minY + 1 : cellH;

  const outW = cellW * 2 + (bounds ? bw + 20 : 0);
  const outH = Math.max(cellH, bh);
  const out = createCanvas(outW, outH);
  const ctx = out.getContext('2d');

  const cardCanvas = createCanvas(cellW, cellH);
  cardCanvas.getContext('2d').putImageData(
    new ImageData(new Uint8ClampedArray(cardImg.data), cellW, cellH), 0, 0);
  ctx.drawImage(cardCanvas, 0, 0);

  const overlayData = new Uint8ClampedArray(cellW * cellH * 4);
  for (let p = 0; p < cellW * cellH; p++) {
    const m = mask.data[p];
    overlayData[p * 4] = m ? 255 : 30;
    overlayData[p * 4 + 1] = m ? 64 : 30;
    overlayData[p * 4 + 2] = m ? 64 : 30;
    overlayData[p * 4 + 3] = 255;
  }
  const maskCanvas = createCanvas(cellW, cellH);
  maskCanvas.getContext('2d').putImageData(new ImageData(overlayData, cellW, cellH), 0, 0);
  ctx.drawImage(maskCanvas, cellW + 10, 0);

  if (bounds) {
    const { minX: bx, minY: by } = bounds;
    const spriteRgba = new Uint8ClampedArray(bw * bh * 4);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const si = ((by + y) * cellW + (bx + x));
        const di = y * bw + x;
        const alpha = mask.data[si] ? 255 : 0;
        spriteRgba[di * 4] = cardImg.data[si * 4];
        spriteRgba[di * 4 + 1] = cardImg.data[si * 4 + 1];
        spriteRgba[di * 4 + 2] = cardImg.data[si * 4 + 2];
        spriteRgba[di * 4 + 3] = alpha;
      }
    }
    const spriteCanvas = createCanvas(bw, bh);
    spriteCanvas.getContext('2d').putImageData(new ImageData(spriteRgba, bw, bh), 0, 0);
    ctx.drawImage(spriteCanvas, cellW * 2 + 20, 0);
  }

  const outPath = join(OUT_DIR, `${label}.png`);
  writeFileSync(outPath, out.toBuffer('image/png'));
  console.log(`wrote ${outPath} sprite=${bounds ? `${bw}×${bh}` : 'none'}`);
}

for (let i = 0; i < det.opponentCards.length; i++) {
  await dumpCard(det.opponentCards[i], `opp-${i}`);
}
for (let i = 0; i < det.playerCards.length; i++) {
  await dumpCard(det.playerCards[i], `plr-${i}`);
}
