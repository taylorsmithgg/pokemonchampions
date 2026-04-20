#!/usr/bin/env node --experimental-strip-types
/**
 * One-shot diagnostic for the user-provided detection trail export.
 *
 * Reads `/tmp/slot-crops/*.png` (dumped from the trail JSON) and for
 * each slot:
 *   - runs `extractSpriteMask` with the matching panel/mode
 *   - runs the full matcher against the sprite DB
 *   - saves a side-by-side PNG (raw crop | mask | matcher top-5)
 *
 * Goal: figure out whether the matcher is getting fed garbage (mask
 * eating the chibi) or whether the DB just doesn't discriminate these
 * species.
 */
import { createCanvas, loadImage } from 'canvas';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

import { extractSpriteMask } from '../src/utils/spriteDetector/spriteMask.ts';
import { buildQuerySignature, matchQuery } from '../src/utils/spriteDetector/matcher.ts';
import { loadSpriteDatabase } from '../src/utils/spriteDetector/spriteDb.ts';

const SRC = '/tmp/slot-crops';
const OUT = '/tmp/slot-crops/probed';
const DB_PATH = 'public/sprite-detector-db.json';

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

console.log('Loading DB…');
const rawDb = JSON.parse(readFileSync(DB_PATH, 'utf8'));
const db = loadSpriteDatabase(rawDb.entries ?? rawDb);
console.log(`  ${db.entries.length} entries`);

// Verify critical player species are in the DB
const wanted = ['Gengar', 'Incineroar', 'Sinistcha', 'Kingambit', 'Tyranitar', 'Kommo-o'];
for (const s of wanted) {
  const hit = db.entries.find(e => e.species === s);
  console.log(`  ${s}: ${hit ? `present (dex ${hit.dex}, form="${hit.form}")` : 'MISSING'}`);
}

const files = readdirSync(SRC).filter(f => /^slot\d+-/.test(f) && f.endsWith('.png')).sort();

const results = [];
for (const file of files) {
  const m = file.match(/^slot(\d+)-(left|right)-(.+)\.png$/);
  if (!m) continue;
  const slotIdx = parseInt(m[1], 10);
  const side = m[2];
  const winnerFromUi = m[3];
  const img = await loadImage(path.join(SRC, file));
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const pixelView = { data: imageData.data, width: img.width, height: img.height };

  const panelType = side === 'left' ? 'player' : 'opponent';
  const mode = 'selection';
  const mask = extractSpriteMask(pixelView, panelType, { mode });

  // Count mask sprite pixels — if <1% the mask is broken
  let spriteCount = 0;
  for (let i = 0; i < mask.data.length; i++) if (mask.data[i]) spriteCount++;
  const spriteFrac = spriteCount / mask.data.length;

  const query = buildQuerySignature(pixelView, mask);
  const matches = matchQuery(query, db, { coalesceMegas: true, phashThreshold: 64 }, 20);
  // Also force-score expected species to see where they land
  const expected = ['Gengar', 'Incineroar', 'Kingambit', 'Tyranitar', 'Kommo-o'];
  const forced = matchQuery(query, db, {
    coalesceMegas: true,
    phashThreshold: 64,
    candidateSpecies: new Set(expected),
  }, expected.length);
  const forcedLine = forced.map(f => `${f.species}(${f.combined.toFixed(3)})`).join(' ');
  console.log(`   FORCED: ${forcedLine}`);

  // Save mask preview next to raw crop
  const out = createCanvas(img.width * 2, img.height);
  const octx = out.getContext('2d');
  octx.drawImage(canvas, 0, 0);
  const maskImg = octx.createImageData(img.width, img.height);
  for (let i = 0; i < mask.data.length; i++) {
    const v = mask.data[i] ? 255 : 0;
    maskImg.data[i * 4] = v;
    maskImg.data[i * 4 + 1] = v;
    maskImg.data[i * 4 + 2] = v;
    maskImg.data[i * 4 + 3] = 255;
  }
  octx.putImageData(maskImg, img.width, 0);
  writeFileSync(path.join(OUT, file), out.toBuffer('image/png'));

  const top5 = matches.map(x => `${x.species}(${x.combined.toFixed(3)}|c=${x.colorScore.toFixed(2)} t=${x.templateScore.toFixed(2)} s=${x.shapeScore.toFixed(2)} p=${x.phashScore.toFixed(2)} d=${x.phashDistance})`).join('\n        ');
  console.log(`\nslot ${slotIdx} side=${side} spriteFrac=${(spriteFrac*100).toFixed(1)}% (was-winner=${winnerFromUi})`);
  console.log(`   TOP5: ${top5}`);
  results.push({ slotIdx, side, spriteFrac, top5: matches.map(m => m.species) });
}
