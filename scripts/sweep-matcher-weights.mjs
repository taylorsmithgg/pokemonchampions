#!/usr/bin/env node --experimental-strip-types
/**
 * Sweep matcher weight combinations against a labelled trail file.
 *
 * Usage:
 *   node --experimental-strip-types scripts/sweep-matcher-weights.mjs \
 *     <trail.json> "Slot0Species,Slot1Species,..." \
 *     [Player|Both] [extraSpeciesCsv]
 *
 * - The 6 expected species (in order) for the player panel are passed
 *   as the second arg. By default we only score the 6 player slots.
 * - The "extraSpeciesCsv" arg lets you supply opponent species so the
 *   sweep also evaluates right-panel slots when scope=Both.
 */
import { createCanvas, loadImage } from 'canvas';
import { readFileSync } from 'fs';

import { extractSpriteMask } from '../src/utils/spriteDetector/spriteMask.ts';
import { buildQuerySignature, matchQuery } from '../src/utils/spriteDetector/matcher.ts';
import { loadSpriteDatabase } from '../src/utils/spriteDetector/spriteDb.ts';

const TRAIL = process.argv[2];
const EXPECTED_PLAYER = (process.argv[3] ?? '').split(',').map(s => s.trim()).filter(Boolean);
const SCOPE = (process.argv[4] ?? 'Player').toLowerCase();
const EXPECTED_OPP = (process.argv[5] ?? '').split(',').map(s => s.trim()).filter(Boolean);

if (!TRAIL || EXPECTED_PLAYER.length === 0) {
  console.error('usage: sweep-matcher-weights.mjs <trail.json> "p0,p1,..." [Player|Both] [opp0,opp1,...]');
  process.exit(1);
}

const DB_PATH = 'public/sprite-detector-db.json';
const db = loadSpriteDatabase(JSON.parse(readFileSync(DB_PATH, 'utf8')).entries);

const trail = JSON.parse(readFileSync(TRAIL, 'utf8'));
const slotCrops = trail.metadata.slotCrops || {};
const lineup = trail.metadata.lineupSlots || [];

// Build per-slot query signatures once.
const slots = [];
for (const slot of lineup) {
  const entry = slotCrops[String(slot.slotIndex)];
  if (!entry?.cropDataUrl) continue;
  const buf = Buffer.from(entry.cropDataUrl.split(',')[1], 'base64');
  const img = await loadImage(buf);
  const cv = createCanvas(img.width, img.height);
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, img.width, img.height);
  const pv = { data: id.data, width: id.width, height: id.height };
  const panelType = slot.side === 'left' ? 'player' : 'opponent';
  const mask = extractSpriteMask(pv, panelType, { mode: 'selection' });
  const query = buildQuerySignature(pv, mask);

  let expected;
  if (slot.side === 'left' && EXPECTED_PLAYER[slot.slotIndex]) {
    expected = EXPECTED_PLAYER[slot.slotIndex];
  } else if (slot.side === 'right') {
    const oppIndex = slot.slotIndex - EXPECTED_PLAYER.length;
    if (EXPECTED_OPP[oppIndex]) expected = EXPECTED_OPP[oppIndex];
  }
  slots.push({ slotIndex: slot.slotIndex, side: slot.side, expected, query });
}

function scoreWeights(w) {
  // Returns { hits, total, gaps[] } where hits = times the top-1 match equals
  // the expected species, and gaps[] = combined(top1) - combined(expected).
  let hits = 0;
  let total = 0;
  const gaps = [];
  for (const s of slots) {
    if (!s.expected) continue;
    if (SCOPE !== 'both' && s.side !== 'left') continue;
    total++;
    const matches = matchQuery(s.query, db, {
      coalesceMegas: true,
      phashThreshold: 40,
      ...w,
    }, 5);
    if (matches[0]?.species === s.expected) hits++;
    const expScore = matches.find(m => m.species === s.expected)?.combined ?? 0;
    const topScore = matches[0]?.combined ?? 0;
    gaps.push(topScore - expScore);
  }
  return { hits, total, gaps };
}

function meanGap(g) {
  return g.length ? g.reduce((a, b) => a + b, 0) / g.length : 0;
}

const grid = [];
for (const wColor of [0.10, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50]) {
  for (const wTemplate of [0.05, 0.10, 0.15, 0.20, 0.25, 0.30]) {
    for (const wShape of [0.05, 0.10, 0.15, 0.20]) {
      const wPhash = +(1 - wColor - wTemplate - wShape).toFixed(2);
      if (wPhash < 0.10 || wPhash > 0.80) continue;
      grid.push({ weightColor: wColor, weightTemplate: wTemplate, weightShape: wShape, weightPhash: wPhash });
    }
  }
}

console.log(`grid size: ${grid.length}`);
console.log(`scope: ${SCOPE}, slots: ${slots.length}`);
console.log(`expected player: ${EXPECTED_PLAYER.join(',')}`);
if (SCOPE === 'both') console.log(`expected opp: ${EXPECTED_OPP.join(',')}`);

const results = grid.map(w => ({ ...w, ...scoreWeights(w) }));
results.sort((a, b) => (b.hits - a.hits) || (meanGap(a.gaps) - meanGap(b.gaps)));

console.log(`\n=== top 15 weight combos ===`);
console.log('  c     t     s     p   | hits  meanGap');
for (const r of results.slice(0, 15)) {
  console.log(
    `  ${r.weightColor.toFixed(2)}  ${r.weightTemplate.toFixed(2)}  ${r.weightShape.toFixed(2)}  ${r.weightPhash.toFixed(2)} ` +
    `| ${r.hits}/${r.total}  ${meanGap(r.gaps).toFixed(3)}`
  );
}

console.log(`\n=== current default (0.55/0.10/0.15/0.20) ===`);
const cur = scoreWeights({ weightColor: 0.55, weightTemplate: 0.10, weightShape: 0.15, weightPhash: 0.20 });
console.log(`hits=${cur.hits}/${cur.total}, meanGap=${meanGap(cur.gaps).toFixed(3)}`);
