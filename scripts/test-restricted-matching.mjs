#!/usr/bin/env node --experimental-strip-types
/**
 * Verify that PER-PANEL candidate restriction recovers the user's
 * trail accuracy. Player slots are matched only against the 6 player
 * species; opponent slots only against the 6 opponent species.
 *
 * This simulates the fully-bootstrapped state where selection-screen
 * consensus has identified each side's species pool and feeds it back
 * as a `restrictMatching` hint for subsequent frames.
 */
import { createCanvas, loadImage } from 'canvas';
import { readFileSync } from 'fs';
import { extractSpriteMask } from '../src/utils/spriteDetector/spriteMask.ts';
import { buildQuerySignature, matchQuery } from '../src/utils/spriteDetector/matcher.ts';
import { loadSpriteDatabase } from '../src/utils/spriteDetector/spriteDb.ts';

const TRAIL = process.argv[2];
const PLAYER = (process.argv[3] ?? '').split(',').map(s => s.trim()).filter(Boolean);
const OPP = (process.argv[4] ?? '').split(',').map(s => s.trim()).filter(Boolean);

const trail = JSON.parse(readFileSync(TRAIL, 'utf8'));
const db = loadSpriteDatabase(JSON.parse(readFileSync('public/sprite-detector-db.json', 'utf8')).entries);

const playerPool = new Set(PLAYER);
const oppPool = new Set(OPP);

const allLabels = [...PLAYER, ...OPP];

// Build a per-panel score matrix N×N (slot × species in pool) so we can
// run the bipartite assignment (max-total-score permutation) the same
// way `resolveUniqueAssignment` in pokemonDetector.ts does.
async function panelMatrix(slotsForPanel, pool) {
  const speciesList = Array.from(pool);
  const N = speciesList.length;
  const matrix = []; // matrix[i][j] = score of slot i picking species j
  const top3PerSlot = [];
  for (const slot of slotsForPanel) {
    const c = trail.metadata.slotCrops[String(slot.slotIndex)];
    if (!c?.cropDataUrl) {
      matrix.push(new Float64Array(N));
      top3PerSlot.push('(no crop)');
      continue;
    }
    const img = await loadImage(Buffer.from(c.cropDataUrl.split(',')[1], 'base64'));
    const cv = createCanvas(img.width, img.height);
    cv.getContext('2d').drawImage(img, 0, 0);
    const id = cv.getContext('2d').getImageData(0, 0, img.width, img.height);
    const pv = { data: id.data, width: id.width, height: id.height };
    const mask = extractSpriteMask(pv, slot.side === 'left' ? 'player' : 'opponent', { mode: 'selection' });
    const q = buildQuerySignature(pv, mask);
    const matches = matchQuery(q, db, { coalesceMegas: true, candidateSpecies: pool }, N);
    const row = new Float64Array(N);
    for (const m of matches) {
      const j = speciesList.indexOf(m.species);
      if (j >= 0) row[j] = Math.max(row[j], m.combined);
    }
    matrix.push(row);
    top3PerSlot.push(matches.slice(0, 3).map(m => `${m.species}:${m.combined.toFixed(2)}`).join(' '));
  }
  return { speciesList, matrix, top3PerSlot };
}

function bestPermutation(matrix, N) {
  const perm = Array.from({ length: N }, (_, i) => i);
  let bestTotal = -Infinity;
  let bestPerm = null;
  function permute(k) {
    if (k === N) {
      let total = 0;
      for (let i = 0; i < N; i++) total += matrix[i][perm[i]];
      if (total > bestTotal) {
        bestTotal = total;
        bestPerm = perm.slice();
      }
      return;
    }
    for (let i = k; i < N; i++) {
      [perm[k], perm[i]] = [perm[i], perm[k]];
      permute(k + 1);
      [perm[k], perm[i]] = [perm[i], perm[k]];
    }
  }
  permute(0);
  return bestPerm;
}

let hits = 0;
let total = 0;

for (const side of ['left', 'right']) {
  const slots = trail.metadata.lineupSlots.filter(s => s.side === side);
  const pool = side === 'left' ? playerPool : oppPool;
  const { speciesList, matrix, top3PerSlot } = await panelMatrix(slots, pool);
  const N = speciesList.length;
  const perm = bestPermutation(matrix, N);
  console.log(`\n— ${side} panel —`);
  for (let i = 0; i < N; i++) {
    const slot = slots[i];
    if (!slot) continue;
    const expected = allLabels[slot.slotIndex];
    const got = speciesList[perm[i]];
    const ok = got === expected;
    if (ok) hits++;
    total++;
    console.log(`  slot ${slot.slotIndex}  exp=${(expected||'?').padEnd(16)} got=${got.padEnd(16)} ${ok ? 'OK' : 'MISS'}  | top3 ${top3PerSlot[i]}`);
  }
}
console.log(`\nrestricted+bipartite hits: ${hits}/${total}`);
