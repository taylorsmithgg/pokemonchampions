#!/usr/bin/env node --experimental-strip-types
// Render DB reference templates side-by-side with observed chibi crops
// for the species the matcher is confusing on session 646s slots 1 & 3.
import { readFileSync, writeFileSync } from 'node:fs';
import { createCanvas, loadImage } from 'canvas';
import path from 'node:path';
import { detectFrame } from '../src/utils/spriteDetector/frameDetector.ts';
import { extractSpriteMask, findSpriteBounds } from '../src/utils/spriteDetector/spriteMask.ts';
import { buildQuerySignature } from '../src/utils/spriteDetector/matcher.ts';
import { loadSpriteDatabase } from '../src/utils/spriteDetector/spriteDb.ts';

const rawDb = JSON.parse(readFileSync('public/sprite-detector-db.json', 'utf8'));
const db = loadSpriteDatabase(rawDb.entries ?? rawDb);
console.log(`DB entries: ${db.entries.length}`);

const TARGET_SPECIES = ['Alcremie', 'Gardevoir', 'Houndoom', 'Samurott-Hisui', 'Basculegion', 'Hydrapple', 'Armarouge'];

function viewFromImage(img) {
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  const id = c.getContext('2d').getImageData(0, 0, img.width, img.height);
  return { data: id.data, width: id.width, height: id.height };
}

function grayCanvas(gray, w, h, scale = 4) {
  const c = createCanvas(w * scale, h * scale);
  const ctx = c.getContext('2d');
  const id = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = gray[i] ?? 0;
    id.data[i * 4] = v;
    id.data[i * 4 + 1] = v;
    id.data[i * 4 + 2] = v;
    id.data[i * 4 + 3] = 255;
  }
  // upscale
  const tmp = createCanvas(w, h);
  tmp.getContext('2d').putImageData(id, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, w * scale, h * scale);
  return c;
}

function rgbaCanvas(data, w, h, scale = 1) {
  const c = createCanvas(w * scale, h * scale);
  const ctx = c.getContext('2d');
  const id = ctx.createImageData(w, h);
  for (let i = 0; i < w * h * 4; i++) id.data[i] = data[i];
  const tmp = createCanvas(w, h);
  tmp.getContext('2d').putImageData(id, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, w * scale, h * scale);
  return c;
}

// Grab observed chibis from f_00676 (mid-session 646s).
const img = await loadImage('.video-review/team-select/f_00676.jpg');
const view = viewFromImage(img);
const frame = detectFrame(view);
if (!frame.isLineupScreen) { console.error('Not a lineup screen'); process.exit(1); }

function cropCard(card) {
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
  const mask = extractSpriteMask(cardImg, 'opponent', { mode: 'selection' });
  const bounds = findSpriteBounds(mask);
  if (!bounds) return { card: cardImg, mask, bounds: null };
  const bw = bounds.maxX - bounds.minX + 1;
  const bh = bounds.maxY - bounds.minY + 1;
  const bCard = new Uint8ClampedArray(bw * bh * 4);
  const bMask = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const srcIdx = ((bounds.minY + y) * sw + (bounds.minX + x)) * 4;
      const dstIdx = (y * bw + x) * 4;
      bCard[dstIdx] = cropPix[srcIdx];
      bCard[dstIdx + 1] = cropPix[srcIdx + 1];
      bCard[dstIdx + 2] = cropPix[srcIdx + 2];
      bCard[dstIdx + 3] = 255;
      bMask[y * bw + x] = mask.data[(bounds.minY + y) * sw + (bounds.minX + x)];
    }
  }
  return { card: { data: bCard, width: bw, height: bh }, mask: { data: bMask, width: bw, height: bh }, bounds };
}

const obsSlot1 = cropCard(frame.opponentCards[1]);
const obsSlot3 = cropCard(frame.opponentCards[3]);
const querySlot1 = buildQuerySignature(obsSlot1.card, obsSlot1.mask, {});
const querySlot3 = buildQuerySignature(obsSlot3.card, obsSlot3.mask, {});

// Build a giant sheet: for each target species, show the DB ref
// template (normal + shiny if available) + the query templates for
// both slots.
const CELL_W = 48 * 4;
const CELL_H = 48 * 4;
const PAD = 8;
const COLS = 4; // normal template, shiny template, slot-1 query, slot-3 query
const LABEL_H = 20;
const ROW_H = CELL_H + LABEL_H + PAD;
const WIDTH = CELL_W * COLS + PAD * (COLS + 1) + 140; // extra for species label
const HEIGHT = ROW_H * TARGET_SPECIES.length + 40;

const composite = createCanvas(WIDTH, HEIGHT);
const ctx = composite.getContext('2d');
ctx.fillStyle = '#0f172a';
ctx.fillRect(0, 0, WIDTH, HEIGHT);
ctx.fillStyle = '#e2e8f0';
ctx.font = 'bold 14px monospace';
ctx.fillText('DB reference templates vs observed chibis (slot 1 and 3, f_00676)', 10, 20);

ctx.font = 'bold 11px monospace';
const headerY = 36;
ctx.fillStyle = '#94a3b8';
ctx.fillText('species', 10, headerY);
ctx.fillText('ref (normal)', 140 + PAD, headerY);
ctx.fillText('ref (shiny)', 140 + PAD + CELL_W + PAD, headerY);
ctx.fillText('obs slot1', 140 + PAD + (CELL_W + PAD) * 2, headerY);
ctx.fillText('obs slot3', 140 + PAD + (CELL_W + PAD) * 3, headerY);

for (let r = 0; r < TARGET_SPECIES.length; r++) {
  const species = TARGET_SPECIES[r];
  const rowY = 40 + r * ROW_H;
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(species, 10, rowY + 20);

  const normal = db.entries.find(e => e.species === species && !e.isShiny);
  const shiny = db.entries.find(e => e.species === species && e.isShiny);

  let col = 0;
  for (const entry of [normal, shiny]) {
    const x = 140 + PAD + col * (CELL_W + PAD);
    if (entry) {
      const sig = entry.signature;
      const canvas = grayCanvas(sig.template, sig.templateWidth, sig.templateHeight, 4);
      ctx.drawImage(canvas, x, rowY);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x, rowY, CELL_W, CELL_H);
    }
    col++;
  }
  // observed slot1 (query template)
  const canvas1 = grayCanvas(querySlot1.templateGray, querySlot1.templateWidth, querySlot1.templateHeight, 4);
  ctx.drawImage(canvas1, 140 + PAD + col * (CELL_W + PAD), rowY);
  col++;
  const canvas3 = grayCanvas(querySlot3.templateGray, querySlot3.templateWidth, querySlot3.templateHeight, 4);
  ctx.drawImage(canvas3, 140 + PAD + col * (CELL_W + PAD), rowY);
}

writeFileSync('.video-review/ref-templates.png', composite.toBuffer('image/png'));
console.log('Wrote .video-review/ref-templates.png');

// Also dump the raw observed RGBA crops for slots 1 and 3
const raw1 = rgbaCanvas(obsSlot1.card.data, obsSlot1.card.width, obsSlot1.card.height, 4);
const raw3 = rgbaCanvas(obsSlot3.card.data, obsSlot3.card.width, obsSlot3.card.height, 4);
const sheetW = Math.max(raw1.width, raw3.width) * 2 + 20;
const sheetH = Math.max(raw1.height, raw3.height) + 40;
const sheet = createCanvas(sheetW, sheetH);
const sctx = sheet.getContext('2d');
sctx.fillStyle = '#0f172a';
sctx.fillRect(0, 0, sheetW, sheetH);
sctx.fillStyle = '#e2e8f0';
sctx.font = 'bold 12px monospace';
sctx.fillText(`slot 1  ${obsSlot1.card.width}x${obsSlot1.card.height}`, 10, 16);
sctx.fillText(`slot 3  ${obsSlot3.card.width}x${obsSlot3.card.height}`, raw1.width + 20, 16);
sctx.drawImage(raw1, 10, 25);
sctx.drawImage(raw3, raw1.width + 20, 25);
writeFileSync('.video-review/obs-slots-raw.png', sheet.toBuffer('image/png'));
console.log('Wrote .video-review/obs-slots-raw.png');
