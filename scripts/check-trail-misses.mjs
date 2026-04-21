#!/usr/bin/env node --experimental-strip-types
import { createCanvas, loadImage } from 'canvas';
import { readFileSync } from 'fs';
import { extractSpriteMask } from '../src/utils/spriteDetector/spriteMask.ts';
import { buildQuerySignature, matchQuery } from '../src/utils/spriteDetector/matcher.ts';
import { loadSpriteDatabase } from '../src/utils/spriteDetector/spriteDb.ts';

const TRAIL = process.argv[2];
const EXPECTED = (process.argv[3] ?? '').split(',').map(s => s.trim()).filter(Boolean);
const trail = JSON.parse(readFileSync(TRAIL, 'utf8'));
const db = loadSpriteDatabase(JSON.parse(readFileSync('public/sprite-detector-db.json', 'utf8')).entries);

console.log('panel  slot  expected         winner           rank top3');
let hits = 0;
for (const slot of trail.metadata.lineupSlots) {
  const c = trail.metadata.slotCrops[String(slot.slotIndex)];
  if (!c?.cropDataUrl) continue;
  const img = await loadImage(Buffer.from(c.cropDataUrl.split(',')[1], 'base64'));
  const cv = createCanvas(img.width, img.height);
  cv.getContext('2d').drawImage(img, 0, 0);
  const id = cv.getContext('2d').getImageData(0, 0, img.width, img.height);
  const pv = { data: id.data, width: id.width, height: id.height };
  const mask = extractSpriteMask(pv, slot.side === 'left' ? 'player' : 'opponent', { mode: 'selection' });
  const q = buildQuerySignature(pv, mask);
  const matches = matchQuery(q, db, { coalesceMegas: true }, 5);
  const expected = EXPECTED[slot.slotIndex];
  const rank = matches.findIndex(m => m.species === expected);
  const ok = matches[0]?.species === expected;
  if (ok) hits++;
  const top3 = matches.slice(0, 3).map(m => `${m.species}:${m.combined.toFixed(2)}`).join(' ');
  console.log(
    `${slot.side.padEnd(5)}  ${String(slot.slotIndex).padEnd(4)}  ${(expected || '?').padEnd(16)} ${(matches[0]?.species ?? '?').padEnd(16)} ${ok ? 'OK' : `MISS (exp rank ${rank + 1})`}  ${top3}`
  );
}
console.log(`\nhits ${hits}/${trail.metadata.lineupSlots.length}`);
