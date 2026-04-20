#!/usr/bin/env node --experimental-strip-types
import { readFileSync, writeFileSync } from 'node:fs';
import { loadImage, createCanvas } from 'canvas';
import path from 'node:path';
import { detectFrame } from '../src/utils/spriteDetector/frameDetector.ts';
import { extractSpriteMask, findSpriteBounds } from '../src/utils/spriteDetector/spriteMask.ts';

function viewFromImage(img) {
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  const id = c.getContext('2d').getImageData(0, 0, img.width, img.height);
  return { data: id.data, width: id.width, height: id.height };
}

const frames = ['f_00262.jpg', 'f_00660.jpg'];
const COLS = frames.length;
const CELL_W = 200;
const CELL_H = 200;
const PAD = 10;
const ROWS = 3; // raw, mask, masked
const W = COLS * (CELL_W + PAD) + PAD;
const H = ROWS * (CELL_H + PAD) + 40 + 30 * ROWS;
const composite = createCanvas(W, H);
const ctx = composite.getContext('2d');
ctx.fillStyle = '#0f172a';
ctx.fillRect(0, 0, W, H);
ctx.font = 'bold 14px monospace';
ctx.fillStyle = '#e2e8f0';
ctx.fillText('Player slot 5 — raw crop vs mask', 10, 22);

const labels = ['raw crop', 'mask (white=fg)', 'masked overlay'];

for (let c = 0; c < COLS; c++) {
  const frameName = frames[c];
  const img = await loadImage(path.join('.video-review/team-select', frameName));
  const view = viewFromImage(img);
  const frame = detectFrame(view);
  if (!frame.isLineupScreen) continue;
  const card = frame.playerCards[5];
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
  const cardImg = { data: cropPix, width: sw, height: sh };
  const mask = extractSpriteMask(cardImg, 'player', { mode: 'selection' });
  const bounds = findSpriteBounds(mask);

  let ox = PAD + c * (CELL_W + PAD);

  // Row 0: raw
  const raw = createCanvas(sw, sh);
  const rawId = raw.getContext('2d').createImageData(sw, sh);
  for (let i = 0; i < sw * sh * 4; i++) rawId.data[i] = cropPix[i];
  raw.getContext('2d').putImageData(rawId, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const scale = Math.min(CELL_W / sw, CELL_H / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  let oy = 40;
  ctx.drawImage(raw, ox, oy, dw, dh);
  if (bounds) {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      ox + bounds.minX * scale,
      oy + bounds.minY * scale,
      (bounds.maxX - bounds.minX + 1) * scale,
      (bounds.maxY - bounds.minY + 1) * scale,
    );
  }
  ctx.fillStyle = '#fbbf24';
  ctx.font = '11px monospace';
  ctx.fillText(`${frameName}   ${sw}x${sh}`, ox, 40 + CELL_H + 16);
  if (bounds) {
    ctx.fillText(
      `bbox ${bounds.maxX - bounds.minX + 1}x${bounds.maxY - bounds.minY + 1}`,
      ox,
      40 + CELL_H + 28,
    );
  }

  // Row 1: mask
  const m = createCanvas(sw, sh);
  const mId = m.getContext('2d').createImageData(sw, sh);
  for (let i = 0; i < sw * sh; i++) {
    const v = mask.data[i] ? 255 : 20;
    mId.data[i * 4] = v;
    mId.data[i * 4 + 1] = v;
    mId.data[i * 4 + 2] = v;
    mId.data[i * 4 + 3] = 255;
  }
  m.getContext('2d').putImageData(mId, 0, 0);
  oy = 40 + CELL_H + 30 + PAD;
  ctx.drawImage(m, ox, oy, dw, dh);
  ctx.fillText(labels[1], ox, oy + CELL_H + 14);

  // Row 2: masked overlay
  const ovr = createCanvas(sw, sh);
  const oId = ovr.getContext('2d').createImageData(sw, sh);
  for (let i = 0; i < sw * sh; i++) {
    const di = i * 4;
    if (mask.data[i]) {
      oId.data[di] = cropPix[di];
      oId.data[di + 1] = cropPix[di + 1];
      oId.data[di + 2] = cropPix[di + 2];
      oId.data[di + 3] = 255;
    } else {
      const x = i % sw, y = Math.floor(i / sw);
      const check = ((x >> 3) ^ (y >> 3)) & 1;
      oId.data[di] = check ? 40 : 20;
      oId.data[di + 1] = check ? 40 : 20;
      oId.data[di + 2] = check ? 40 : 20;
      oId.data[di + 3] = 255;
    }
  }
  ovr.getContext('2d').putImageData(oId, 0, 0);
  oy = 40 + (CELL_H + 30 + PAD) * 2;
  ctx.drawImage(ovr, ox, oy, dw, dh);
  ctx.fillText(labels[2], ox, oy + CELL_H + 14);
}

writeFileSync('.video-review/slot5-mask.png', composite.toBuffer('image/png'));
console.log('Wrote .video-review/slot5-mask.png');
