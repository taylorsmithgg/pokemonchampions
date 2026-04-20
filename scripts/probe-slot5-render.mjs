#!/usr/bin/env node --experimental-strip-types
import { readFileSync, writeFileSync } from 'node:fs';
import { loadImage, createCanvas } from 'canvas';
import path from 'node:path';
import { detectFrame } from '../src/utils/spriteDetector/frameDetector.ts';
import { extractSpriteMask, findSpriteBounds } from '../src/utils/spriteDetector/spriteMask.ts';
import { loadSpriteDatabase } from '../src/utils/spriteDetector/spriteDb.ts';

const rawDb = JSON.parse(readFileSync('public/sprite-detector-db.json', 'utf8'));
const db = loadSpriteDatabase(rawDb.entries ?? rawDb);

function viewFromImage(img) {
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  const id = c.getContext('2d').getImageData(0, 0, img.width, img.height);
  return { data: id.data, width: id.width, height: id.height };
}

const frames = ['f_00254.jpg', 'f_00262.jpg', 'f_00270.jpg', 'f_00278.jpg', 'f_00660.jpg', 'f_00676.jpg'];
const observed = [];
for (const frameName of frames) {
  const img = await loadImage(path.join('.video-review/team-select', frameName));
  const view = viewFromImage(img);
  const frame = detectFrame(view);
  if (!frame.isLineupScreen) continue;
  const card = frame.playerCards[5];
  if (!card) continue;
  const sb = card.spriteBbox;
  const sx = Math.max(0, card.xStart + sb.x1);
  const sy = Math.max(0, card.yStart + sb.y1);
  const sw = Math.min(view.width - sx, sb.x2 - sb.x1);
  const sh = Math.min(view.height - sy, sb.y2 - sb.y1);
  const cropPix = new Uint8ClampedArray(sw * sh * 4);
  for (let y = 0; y < sh; y++) {
    const srcRow = ((sy + y) * view.width + sx) * 4;
    const dstRow = y * sw * 4;
    for (let x = 0; x < sw * 4; x++) cropPix[dstRow + x] = view.data[srcRow + x];
  }
  observed.push({ frameName, w: sw, h: sh, data: cropPix });
}

const refEntries = db.entries.filter(e => ['Dragapult', 'Crabominable', 'Heracross', 'Hawlucha'].includes(e.species) && !e.isShiny);

// Build a side-by-side sheet:
// row 1: each observed crop
// row 2: each reference template
const obsH = 160;
const obsW = 100;
const refSize = 100;
const PAD = 10;
const CELL = obsW + PAD;
const width = Math.max(observed.length, refEntries.length) * CELL + PAD;
const height = 40 + obsH + 30 + refSize + 30;

const composite = createCanvas(width, height);
const ctx = composite.getContext('2d');
ctx.fillStyle = '#0f172a';
ctx.fillRect(0, 0, width, height);
ctx.fillStyle = '#e2e8f0';
ctx.font = 'bold 14px monospace';
ctx.fillText('Player slot 5 — observed vs DB reference templates', 10, 20);

ctx.font = 'bold 11px monospace';
ctx.fillStyle = '#94a3b8';
ctx.fillText('OBSERVED:', 10, 36);

for (let i = 0; i < observed.length; i++) {
  const o = observed[i];
  const tmp = createCanvas(o.w, o.h);
  const id = tmp.getContext('2d').createImageData(o.w, o.h);
  for (let j = 0; j < o.w * o.h * 4; j++) id.data[j] = o.data[j];
  tmp.getContext('2d').putImageData(id, 0, 0);
  const x = PAD + i * CELL;
  const y = 42;
  ctx.imageSmoothingEnabled = false;
  // Scale to fit obsW x obsH while preserving aspect
  const scale = Math.min(obsW / o.w, obsH / o.h);
  const dw = o.w * scale;
  const dh = o.h * scale;
  ctx.drawImage(tmp, x, y, dw, dh);
  ctx.fillStyle = '#fbbf24';
  ctx.font = '10px monospace';
  ctx.fillText(o.frameName, x, y + obsH + 12);
  ctx.fillText(`${o.w}x${o.h}`, x, y + obsH + 24);
}

ctx.fillStyle = '#94a3b8';
ctx.font = 'bold 11px monospace';
const refY = 42 + obsH + 30 + 14;
ctx.fillText('DB REFERENCE (templateGray):', 10, refY);

for (let i = 0; i < refEntries.length; i++) {
  const e = refEntries[i];
  const sig = e.signature;
  const tmp = createCanvas(sig.templateWidth, sig.templateHeight);
  const id = tmp.getContext('2d').createImageData(sig.templateWidth, sig.templateHeight);
  for (let j = 0; j < sig.templateWidth * sig.templateHeight; j++) {
    const v = sig.template[j];
    id.data[j * 4] = v;
    id.data[j * 4 + 1] = v;
    id.data[j * 4 + 2] = v;
    id.data[j * 4 + 3] = 255;
  }
  tmp.getContext('2d').putImageData(id, 0, 0);
  const x = PAD + i * CELL;
  const y = refY + 14;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, x, y, refSize, refSize);
  ctx.fillStyle = '#fbbf24';
  ctx.font = '10px monospace';
  ctx.fillText(e.species, x, y + refSize + 12);
}

writeFileSync('.video-review/slot5-render.png', composite.toBuffer('image/png'));
console.log('Wrote .video-review/slot5-render.png');
