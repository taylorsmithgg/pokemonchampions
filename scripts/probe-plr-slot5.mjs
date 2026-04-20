#!/usr/bin/env node --experimental-strip-types
import { readFileSync } from 'node:fs';
import { loadImage, createCanvas } from 'canvas';
import path from 'node:path';
import { detectFrame } from '../src/utils/spriteDetector/frameDetector.ts';
import { extractSpriteMask, findSpriteBounds } from '../src/utils/spriteDetector/spriteMask.ts';
import { buildQuerySignature, matchQuery } from '../src/utils/spriteDetector/matcher.ts';
import { loadSpriteDatabase } from '../src/utils/spriteDetector/spriteDb.ts';

const rawDb = JSON.parse(readFileSync('public/sprite-detector-db.json', 'utf8'));
const db = loadSpriteDatabase(rawDb.entries ?? rawDb);

const frames = ['f_00254.jpg', 'f_00262.jpg', 'f_00270.jpg', 'f_00278.jpg', 'f_00660.jpg', 'f_00676.jpg'];
const SLOT = 5;
const SPECIES_OF_INTEREST = ['Dragapult', 'Crabominable', 'Azumarill', 'Sableye', 'Florges'];

function viewFromImage(img) {
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  const id = c.getContext('2d').getImageData(0, 0, img.width, img.height);
  return { data: id.data, width: id.width, height: id.height };
}

function cropCardSprite(view, card, mode) {
  const sb = card.spriteBbox;
  const sx = Math.max(0, card.xStart + sb.x1);
  const sy = Math.max(0, card.yStart + sb.y1);
  const sw = Math.min(view.width - sx, sb.x2 - sb.x1);
  const sh = Math.min(view.height - sy, sb.y2 - sb.y1);
  if (sw < 4 || sh < 4) return null;
  const cropPix = new Uint8ClampedArray(sw * sh * 4);
  for (let y = 0; y < sh; y++) {
    const srcRow = ((sy + y) * view.width + sx) * 4;
    const dstRow = y * sw * 4;
    for (let x = 0; x < sw * 4; x++) cropPix[dstRow + x] = view.data[srcRow + x];
  }
  const cardImg = { data: cropPix, width: sw, height: sh };
  const mask = extractSpriteMask(cardImg, 'player', { mode });
  const bounds = findSpriteBounds(mask);
  if (!bounds) return null;
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
  return { card: { data: bCard, width: bw, height: bh }, mask: { data: bMask, width: bw, height: bh }, bw, bh };
}

for (const frameName of frames) {
  const img = await loadImage(path.join('.video-review/team-select', frameName));
  const view = viewFromImage(img);
  const frame = detectFrame(view);
  if (!frame.isLineupScreen) continue;
  const card = frame.playerCards[SLOT];
  if (!card) continue;
  const crops = cropCardSprite(view, card, 'selection');
  if (!crops) continue;
  const query = buildQuerySignature(crops.card, crops.mask, {});
  const results = matchQuery(query, db, { coalesceMegas: true }, 15);
  console.log(`\n━━ ${frameName} player slot 5  bb=${crops.bw}x${crops.bh} ━━`);
  for (let i = 0; i < 7; i++) {
    const r = results[i];
    const mark = SPECIES_OF_INTEREST.includes(r.species) ? ' ★' : '';
    console.log(
      `  ${i + 1}  ${r.species.padEnd(18)} combined=${r.combined.toFixed(3)}  color=${r.colorScore.toFixed(3)} templ=${r.templateScore.toFixed(3)} shape=${r.shapeScore.toFixed(3)} phash=${r.phashDistance} (sim=${r.phashScore.toFixed(3)})${mark}`,
    );
  }
  for (const species of SPECIES_OF_INTEREST) {
    const idx = results.findIndex(r => r.species === species);
    if (idx >= 7 && idx !== -1) {
      const r = results[idx];
      console.log(
        `  [${idx + 1}] ${species.padEnd(18)} combined=${r.combined.toFixed(3)}  color=${r.colorScore.toFixed(3)} templ=${r.templateScore.toFixed(3)} shape=${r.shapeScore.toFixed(3)} phash=${r.phashDistance}`,
      );
    }
  }
}
