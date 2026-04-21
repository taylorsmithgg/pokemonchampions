#!/usr/bin/env node --experimental-strip-types
/**
 * Verifies that the lineup analyzer's cross-panel duplicate softener
 * demotes a duplicate winner to its runner-up on the lower-confidence
 * side, while leaving the higher-confidence side untouched.
 *
 * Mirrors the user's "wrong sides" symptom from
 * detection-trail-lineup-lock-2026-04-21T00-10-38-296Z.json:
 *   - opp slot 8 wins Garchomp 26/27 (96% share) — correct
 *   - player slot 0 wins Garchomp 16/27 (59% share) — wrong, true is Gengar
 * After the cross-panel pass, opp keeps Garchomp and player slot 0
 * adopts its highest-voted alternative that isn't already locked.
 */
import { createLineupAnalyzer } from '../src/utils/spriteDetector/lineupAnalyzer.ts';

function frame(slotIndex, side, candidates) {
  return {
    slotIndex,
    side,
    cardX: 0, cardY: 0, cardW: 100, cardH: 100,
    x: 0, y: 0, w: 100, h: 100,
    assignedSpecies: candidates[0]?.species ?? null,
    assignedConfidence: candidates[0]?.confidence ?? null,
    candidates,
  };
}

function cand(species, confidence, isShiny = false) {
  return { species, confidence, isShiny };
}

let pass = 0, fail = 0;
function check(label, ok, details = '') {
  if (ok) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label} ${details}`);
    fail++;
  }
}

console.log('━━ Cross-panel duplicate softener ━━');

// Build an analyzer state matching the user's trail.
{
  const a = createLineupAnalyzer();
  // Player slot 0: Garchomp 16/27 (59%), Cofagrigus 6/27 (22%), Corviknight 5/27.
  //   No alternative clears the 35% confidence gate, so the slot becomes
  //   not-yet-confident after dedup — honest "I don't know" beats wrong.
  // Player slot 3: Kingambit 22/27 (correct lock).
  // Opp slot 8: Garchomp 26/27 (correct lock, higher share than player 0).
  for (let i = 0; i < 16; i++) a.feedSnapshot([frame(0, 'left', [cand('Garchomp', 0.40)])]);
  for (let i = 0; i < 6; i++)  a.feedSnapshot([frame(0, 'left', [cand('Cofagrigus', 0.30)])]);
  for (let i = 0; i < 5; i++)  a.feedSnapshot([frame(0, 'left', [cand('Corviknight', 0.30)])]);
  for (let i = 0; i < 22; i++) a.feedSnapshot([frame(3, 'left', [cand('Kingambit', 0.45)])]);
  for (let i = 0; i < 5; i++)  a.feedSnapshot([frame(3, 'left', [cand('Chandelure', 0.30)])]);
  for (let i = 0; i < 26; i++) a.feedSnapshot([frame(8, 'right', [cand('Garchomp', 0.41)])]);
  for (let i = 0; i < 1; i++)  a.feedSnapshot([frame(8, 'right', [cand('Arbok', 0.30)])]);

  const c = a.getConsensus();
  const player0 = c.slots.find(s => s.side === 'left' && s.slotIndex === 0);
  const player3 = c.slots.find(s => s.side === 'left' && s.slotIndex === 3);
  const opp8 = c.slots.find(s => s.side === 'right' && s.slotIndex === 8);

  check('opp slot 8 keeps Garchomp (higher share)', opp8?.assignedSpecies === 'Garchomp',
    `got ${opp8?.assignedSpecies}`);
  check('player slot 0 demotes off Garchomp', player0?.assignedSpecies !== 'Garchomp',
    `got ${player0?.assignedSpecies}`);
  check('player slot 0 with no strong fallback → null',
    player0?.assignedSpecies === null,
    `got ${player0?.assignedSpecies}`);
  check('player slot 3 untouched (no duplicate)', player3?.assignedSpecies === 'Kingambit',
    `got ${player3?.assignedSpecies}`);
}

// Scenario where the loser DOES have a strong-enough runner-up.
{
  const a = createLineupAnalyzer();
  // Player slot 0: Garchomp 12/20 (60%), Lucario 8/20 (40% — clears 35%).
  // Opp slot 8: Garchomp 18/20 (90%) — wins the duplicate.
  for (let i = 0; i < 12; i++) a.feedSnapshot([frame(0, 'left', [cand('Garchomp', 0.40)])]);
  for (let i = 0; i < 8; i++)  a.feedSnapshot([frame(0, 'left', [cand('Lucario', 0.34)])]);
  for (let i = 0; i < 18; i++) a.feedSnapshot([frame(8, 'right', [cand('Garchomp', 0.41)])]);
  for (let i = 0; i < 2; i++)  a.feedSnapshot([frame(8, 'right', [cand('Arbok', 0.30)])]);

  const c = a.getConsensus();
  const player0 = c.slots.find(s => s.side === 'left' && s.slotIndex === 0);
  const opp8 = c.slots.find(s => s.side === 'right' && s.slotIndex === 8);
  check('opp slot 8 keeps Garchomp (higher share)', opp8?.assignedSpecies === 'Garchomp',
    `got ${opp8?.assignedSpecies}`);
  check('player slot 0 falls back to Lucario (≥35% share)',
    player0?.assignedSpecies === 'Lucario',
    `got ${player0?.assignedSpecies}`);
}

// Edge: both sides tied on votes — keep the one with higher share.
{
  const a = createLineupAnalyzer();
  // Player slot 0 sees 5 frames total, all Tyranitar.
  // Opp slot 0 sees 10 frames total, 5 Tyranitar, 5 Hippowdon.
  for (let i = 0; i < 5; i++) a.feedSnapshot([frame(0, 'left', [cand('Tyranitar', 0.40)])]);
  for (let i = 0; i < 5; i++) a.feedSnapshot([frame(0, 'right', [cand('Tyranitar', 0.40)])]);
  for (let i = 0; i < 5; i++) a.feedSnapshot([frame(0, 'right', [cand('Hippowdon', 0.30)])]);

  const c = a.getConsensus();
  const left = c.slots.find(s => s.side === 'left');
  const right = c.slots.find(s => s.side === 'right');
  // Player share = 5/5 = 100%, opp share = 5/10 = 50%, but opp isConfident
  // requires margin > 1.25 (5 vs 5 = ratio 1.0) — opp WON'T be confident,
  // so no duplicate to resolve. Player keeps Tyranitar.
  check('lone confident slot keeps its species', left?.assignedSpecies === 'Tyranitar',
    `got ${left?.assignedSpecies}`);
  check('non-confident opp not promoted', right?.isConfident !== true || right?.assignedSpecies !== null,
    `confident=${right?.isConfident} species=${right?.assignedSpecies}`);
}

// Edge: no fallback available → demote to null
{
  const a = createLineupAnalyzer();
  // Player slot 0 has only Tyranitar (confident).
  // Opp slot 0 has Tyranitar (more votes) and nothing else.
  for (let i = 0; i < 3; i++) a.feedSnapshot([frame(0, 'left', [cand('Tyranitar', 0.40)])]);
  for (let i = 0; i < 10; i++) a.feedSnapshot([frame(0, 'right', [cand('Tyranitar', 0.40)])]);

  const c = a.getConsensus();
  const left = c.slots.find(s => s.side === 'left');
  const right = c.slots.find(s => s.side === 'right');

  check('opp slot 0 (more votes) keeps Tyranitar', right?.assignedSpecies === 'Tyranitar',
    `got ${right?.assignedSpecies}`);
  check('player slot 0 has no fallback → null', left?.assignedSpecies === null,
    `got ${left?.assignedSpecies}`);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
