#!/usr/bin/env node --experimental-strip-types
// Probe opponent slots 1 and 3 across selection frames in session 646s.
// Show top-10 candidates + explicit scores for Alcremie / Gardevoir
// and Houndoom / Samurott-Hisui so we can see where the matcher is
// getting confused.
import { readFileSync } from 'node:fs';
import { loadImage, createCanvas } from 'canvas';
import path from 'node:path';
import { detectFrame } from '../src/utils/spriteDetector/frameDetector.ts';
import { extractSpriteMask, findSpriteBounds } from '../src/utils/spriteDetector/spriteMask.ts';
import { buildQuerySignature, matchQuery } from '../src/utils/spriteDetector/matcher.ts';
import { loadSpriteDatabase } from '../src/utils/spriteDetector/spriteDb.ts';

const rawDb = JSON.parse(readFileSync('public/sprite-detector-db.json', 'utf8'));
const db = loadSpriteDatabase(rawDb.entries ?? rawDb);
console.log(`DB entries: ${db.entries.length}`);

const frames = ['f_00660.jpg', 'f_00668.jpg', 'f_00676.jpg', 'f_00684.jpg', 'f_00692.jpg'];
const SLOTS_OF_INTEREST = [1, 3];
const SPECIES_OF_INTEREST = ['Alcremie', 'Gardevoir', 'Houndoom', 'Samurott-Hisui'];

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
  const mask = extractSpriteMask(cardImg, 'opponent', { mode });
  const bounds = findSpriteBounds(mask);
  if (!bounds) return null;
  const bx = bounds.minX;
  const by = bounds.minY;
  const bw = bounds.maxX - bounds.minX + 1;
  const bh = bounds.maxY - bounds.minY + 1;
  const bCard = new Uint8ClampedArray(bw * bh * 4);
  const bMask = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const srcIdx = ((by + y) * sw + (bx + x)) * 4;
      const dstIdx = (y * bw + x) * 4;
      bCard[dstIdx] = cropPix[srcIdx];
      bCard[dstIdx + 1] = cropPix[srcIdx + 1];
      bCard[dstIdx + 2] = cropPix[srcIdx + 2];
      bCard[dstIdx + 3] = cropPix[srcIdx + 3];
      bMask[y * bw + x] = mask.data[(by + y) * sw + (bx + x)];
    }
  }
  return { card: { data: bCard, width: bw, height: bh }, mask: { data: bMask, width: bw, height: bh }, bw, bh };
}

for (const frameName of frames) {
  const img = await loadImage(path.join('.video-review/team-select', frameName));
  const view = viewFromImage(img);
  const frame = detectFrame(view);
  if (!frame.isLineupScreen) {
    console.log(`\n${frameName}: not a lineup screen`);
    continue;
  }
  console.log(`\n━━━ ${frameName}  (mode=${frame.mode}) ━━━`);

  for (const slot of SLOTS_OF_INTEREST) {
    const card = frame.opponentCards[slot];
    if (!card) { console.log(`  opp slot ${slot}: missing card`); continue; }
    const crops = cropCardSprite(view, card, frame.mode === 'lock' ? 'lock' : 'selection');
    if (!crops) { console.log(`  opp slot ${slot}: no sprite bounds`); continue; }
    const query = buildQuerySignature(crops.card, crops.mask, {});
    const results = matchQuery(query, db, { coalesceMegas: true }, 20);
    console.log(`\n  opp slot ${slot}  bb=${crops.bw}x${crops.bh}`);
    console.log(`  rank  species             combined  color  templ  shape  phash`);
    for (let i = 0; i < Math.min(10, results.length); i++) {
      const r = results[i];
      const mark = SPECIES_OF_INTEREST.includes(r.species) ? ' ★' : '';
      console.log(
        `  ${(i + 1).toString().padStart(3)}   ${r.species.padEnd(20)} ${r.combined.toFixed(3)}    ${r.colorScore.toFixed(3)} ${r.templateScore.toFixed(3)} ${r.shapeScore.toFixed(3)}  ${r.phashDistance}${mark}`,
      );
    }
    for (const species of SPECIES_OF_INTEREST) {
      const idx = results.findIndex(r => r.species === species);
      if (idx >= 10 && idx !== -1) {
        const r = results[idx];
        console.log(
          `  [${(idx + 1).toString().padStart(3)}] ${species.padEnd(20)} ${r.combined.toFixed(3)}    ${r.colorScore.toFixed(3)} ${r.templateScore.toFixed(3)} ${r.shapeScore.toFixed(3)}  ${r.phashDistance}`,
        );
      } else if (idx === -1) {
        console.log(`  [---] ${species.padEnd(20)} NOT in top-20`);
      }
    }
  }
}
