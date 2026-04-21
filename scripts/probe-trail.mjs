#!/usr/bin/env node --experimental-strip-types
/**
 * Probe a detection-trail-lineup-lock JSON export.
 *
 * Decodes every slot's embedded `cropDataUrl`, runs the full
 * mask+matcher pipeline against the current sprite DB, and prints
 * a per-slot report:
 *   - mask spriteFrac
 *   - matcher top-10 with sub-scores (color / template / shape / phash)
 *   - forced score against a user-supplied expected species set
 *
 * Also dumps each raw crop + mask side-by-side under
 *   /tmp/trail-probe/slotNN-<side>.png
 * so you can eyeball what the detector actually sees.
 *
 * Usage:
 *   node --experimental-strip-types scripts/probe-trail.mjs \
 *     <trail.json> [expected1,expected2,...]
 */
import { createCanvas, loadImage } from 'canvas';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

import { extractSpriteMask } from '../src/utils/spriteDetector/spriteMask.ts';
import { buildQuerySignature, matchQuery } from '../src/utils/spriteDetector/matcher.ts';
import { loadSpriteDatabase } from '../src/utils/spriteDetector/spriteDb.ts';

const TRAIL = process.argv[2];
const EXPECTED = (process.argv[3] ?? '').split(',').map(s => s.trim()).filter(Boolean);
if (!TRAIL) {
  console.error('usage: probe-trail.mjs <trail.json> [expected1,expected2,...]');
  process.exit(1);
}
const OUT = '/tmp/trail-probe';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const DB_PATH = 'public/sprite-detector-db.json';
const rawDb = JSON.parse(readFileSync(DB_PATH, 'utf8'));
const db = loadSpriteDatabase(rawDb.entries ?? rawDb);
console.log(`DB: ${db.entries.length} entries`);

const trail = JSON.parse(readFileSync(TRAIL, 'utf8'));
const slotCrops = trail.metadata.slotCrops || {};
const lineup = trail.metadata.lineupSlots || [];

const expectedSet = EXPECTED.length ? new Set(EXPECTED) : null;

for (const slot of lineup) {
  const entry = slotCrops[String(slot.slotIndex)];
  if (!entry?.cropDataUrl) {
    console.log(`slot ${slot.slotIndex}: no crop`);
    continue;
  }
  const buf = Buffer.from(entry.cropDataUrl.split(',')[1], 'base64');
  const img = await loadImage(buf);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, img.width, img.height);
  const view = { data: id.data, width: img.width, height: id.height };
  // NB: ctx.getImageData returns height in id.height.
  const pv = { data: id.data, width: id.width, height: id.height };

  const panelType = slot.side === 'left' ? 'player' : 'opponent';
  const mask = extractSpriteMask(pv, panelType, { mode: 'selection' });
  let spriteCount = 0;
  for (let i = 0; i < mask.data.length; i++) if (mask.data[i]) spriteCount++;
  const spriteFrac = spriteCount / mask.data.length;

  const query = buildQuerySignature(pv, mask);
  const matches = matchQuery(query, db, { coalesceMegas: true, phashThreshold: 64 }, 10);

  console.log(`\n━━ slot ${slot.slotIndex} side=${slot.side} ${img.width}x${img.height} spriteFrac=${(spriteFrac*100).toFixed(1)}% ━━`);
  console.log(`   reported winner: ${slot.species} (${slot.winnerVotes}/${slot.framesObserved} = ${(slot.shareOfFrames*100).toFixed(0)}%)`);
  for (const m of matches) {
    console.log(
      `     ${m.species.padEnd(22)} combined=${m.combined.toFixed(3)}  ` +
      `c=${m.colorScore.toFixed(2)} t=${m.templateScore.toFixed(2)} ` +
      `s=${m.shapeScore.toFixed(2)} p=${m.phashScore.toFixed(2)} d=${m.phashDistance}`
    );
  }
  if (expectedSet) {
    const forced = matchQuery(query, db, {
      coalesceMegas: true,
      phashThreshold: 64,
      candidateSpecies: expectedSet,
    }, expectedSet.size);
    const line = forced.map(f => `${f.species}(${f.combined.toFixed(3)})`).join(' ');
    console.log(`   FORCED: ${line}`);
  }

  // Save side-by-side raw | mask.
  const out = createCanvas(img.width * 2, img.height);
  const octx = out.getContext('2d');
  octx.drawImage(canvas, 0, 0);
  const mImg = octx.createImageData(img.width, img.height);
  for (let i = 0; i < mask.data.length; i++) {
    const v = mask.data[i] ? 255 : 0;
    mImg.data[i * 4] = v; mImg.data[i * 4 + 1] = v; mImg.data[i * 4 + 2] = v; mImg.data[i * 4 + 3] = 255;
  }
  octx.putImageData(mImg, img.width, 0);
  const f = `slot${String(slot.slotIndex).padStart(2,'0')}-${slot.side}.png`;
  writeFileSync(path.join(OUT, f), out.toBuffer('image/png'));
}

console.log(`\nCrops dumped under ${OUT}/`);
