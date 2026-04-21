#!/usr/bin/env node --experimental-strip-types
/**
 * Replay a saved detection trail through the LIVE detector pipeline
 * with the player-species hint applied — exactly as the StreamCompanion
 * page would call it once the user has entered their team.
 *
 * Use this to confirm that the new `playerSpeciesHint` plumbing
 * recovers the lineup the trail's unconstrained matcher missed.
 */
import { createCanvas, loadImage } from 'canvas';
import { readFileSync } from 'fs';
import { extractSpriteMask } from '../src/utils/spriteDetector/spriteMask.ts';
import { buildQuerySignature, matchQuery } from '../src/utils/spriteDetector/matcher.ts';
import { loadSpriteDatabase } from '../src/utils/spriteDetector/spriteDb.ts';
import { detectPokemon } from '../src/utils/spriteDetector/pokemonDetector.ts';

const TRAIL = process.argv[2];
const PLAYER = (process.argv[3] ?? '').split(',').map(s => s.trim()).filter(Boolean);
const OPP = (process.argv[4] ?? '').split(',').map(s => s.trim()).filter(Boolean);

const trail = JSON.parse(readFileSync(TRAIL, 'utf8'));
const db = loadSpriteDatabase(JSON.parse(readFileSync('public/sprite-detector-db.json', 'utf8')).entries);

const playerHint = new Set(PLAYER);
const allLabels = [...PLAYER, ...OPP];

// Use slot crops for per-slot evaluation (the trail saved them as
// dataURLs). The slot crops are the same source the live pipeline sees
// after frame detection, so passing them to matchQuery directly is
// representative of what the player-hint restriction will produce.
let hits = 0, total = 0;
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
  // Player slots: use the manual hint as a tight pool. Opp slots: full DB.
  const matches = slot.side === 'left'
    ? matchQuery(q, db, { coalesceMegas: true, candidateSpecies: playerHint }, 6)
    : matchQuery(q, db, { coalesceMegas: true }, 5);
  const expected = allLabels[slot.slotIndex];
  const top = matches[0]?.species ?? '?';
  const ok = top === expected;
  if (ok) hits++;
  total++;
  console.log(`${slot.side.padEnd(5)}  ${String(slot.slotIndex).padEnd(3)}  exp=${(expected||'?').padEnd(16)} got=${top.padEnd(16)} ${ok ? 'OK' : 'MISS'}`);
}
console.log(`\nplayer-hint trail accuracy: ${hits}/${total}`);
console.log('(Note: player-side gets 6-species bipartite restriction; opp-side runs unrestricted across the whole DB.)');
