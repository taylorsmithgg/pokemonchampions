#!/usr/bin/env node --experimental-strip-types
/**
 * One-off diagnostic: why does the matcher's color score rate the
 * Gengar query against the Gengar reference at only ~0.25 when both
 * sprites are clearly purple?
 *
 * Decodes the Gengar slot crop from the latest user-supplied trail,
 * builds a query histogram, then prints:
 *   - top-5 hue bins of the query
 *   - top-5 hue bins of every reference signature for purple-ish dex
 *     IDs (Gengar 94, Garchomp 445, Cofagrigus 563)
 *   - Bhattacharyya distance of query vs each reference
 */
import { createCanvas, loadImage } from 'canvas';
import { readFileSync } from 'fs';
import { extractSpriteMask } from '../src/utils/spriteDetector/spriteMask.ts';
import { buildQuerySignature } from '../src/utils/spriteDetector/matcher.ts';
import { loadSpriteDatabase } from '../src/utils/spriteDetector/spriteDb.ts';

const TRAIL = process.argv[2] ?? '/Users/taylorsmith/Downloads/detection-trail-lineup-lock-2026-04-21T00-10-38-296Z.json';
const trail = JSON.parse(readFileSync(TRAIL, 'utf8'));
const slot0 = trail.metadata.slotCrops['0'];
const buf = Buffer.from(slot0.cropDataUrl.split(',')[1], 'base64');
const img = await loadImage(buf);
const cv = createCanvas(img.width, img.height);
const ctx = cv.getContext('2d');
ctx.drawImage(img, 0, 0);
const id = ctx.getImageData(0, 0, img.width, img.height);
const pv = { data: id.data, width: id.width, height: id.height };
const mask = extractSpriteMask(pv, 'player', { mode: 'selection' });
const q = buildQuerySignature(pv, mask);

function topBins(hist, k = 5) {
  return Array.from(hist)
    .map((v, i) => ({ i, v }))
    .filter(b => b.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, k)
    .map(b => `bin${b.i}=${b.v.toFixed(3)}`)
    .join(', ');
}

function bhatt(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.sqrt(a[i] * b[i]);
  // The matcher's Bhattacharyya implementation uses a slightly different
  // form (likely 1 - sqrt(sum) or similar). Print both raw and 1 - bc.
  return { bc: sum, dist: Math.sqrt(Math.max(0, 1 - sum)) };
}

console.log('Query top hue bins (Gengar player crop):');
console.log(' ', topBins(q.hsHist, 8));
console.log('  total bins:', q.hsHist.length);

const db = loadSpriteDatabase(JSON.parse(readFileSync('public/sprite-detector-db.json', 'utf8')).entries);
for (const name of ['Gengar', 'Garchomp', 'Cofagrigus', 'Hippowdon', 'Kommo-o']) {
  const refs = db.entries.filter(e => e.species === name);
  for (const r of refs) {
    const sig = r.signature;
    const d = bhatt(q.hsHist, sig.hsHist);
    console.log(`\n${r.name} (dex ${r.dex}):`);
    console.log('  top hue bins:', topBins(sig.hsHist, 8));
    console.log('  bc=', d.bc.toFixed(3), 'dist=', d.dist.toFixed(3), 'colorScore=1-dist=', (1 - d.dist).toFixed(3));
  }
}
