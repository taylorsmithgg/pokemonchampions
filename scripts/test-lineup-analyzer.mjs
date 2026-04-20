#!/usr/bin/env node --experimental-strip-types
// Exercise the multi-frame lineup analyzer with mock snapshots that
// mirror the score distribution we see on live 3D-rendered cards:
//   • the correct species wins the top slot in most frames
//   • a different wrong species occasionally edges it out by <0.02
//   • confidence is always in the 0.18–0.30 band
//
// We assert the analyzer eventually locks in the correct species.

import {
  feedSnapshot,
  getConsensus,
  reset,
  LINEUP_ANALYZER_CONFIG,
} from '../src/utils/spriteDetector/lineupAnalyzer.ts';

function makeSlot(slotIndex, side, top, runnerUp, x = 0, y = 0) {
  return {
    slotIndex,
    side,
    cardX: x,
    cardY: y,
    cardW: 300,
    cardH: 120,
    x: x + 10,
    y: y + 10,
    w: 280,
    h: 100,
    assignedSpecies: null, // analyzer doesn't look at this
    assignedConfidence: null,
    candidates: [
      { species: top.species, confidence: top.confidence, score: top.confidence, supportCount: 1 },
      { species: runnerUp.species, confidence: runnerUp.confidence, score: runnerUp.confidence, supportCount: 1 },
    ],
  };
}

function fmt(consensus) {
  return consensus.slots.map(s =>
    `${s.side}#${s.slotIndex}=${s.assignedSpecies ?? '-'}(${s.winnerVotes}/${s.framesObserved}${s.isConfident ? ',✓' : ''})`,
  ).join('  ');
}

let passCount = 0;
let failCount = 0;
function assert(label, cond, extra = '') {
  if (cond) { console.log(`  PASS  ${label}`); passCount++; }
  else { console.log(`  FAIL  ${label}${extra ? ' - ' + extra : ''}`); failCount++; }
}

console.log('== analyzer config:', LINEUP_ANALYZER_CONFIG);

// ---- Test 1: clean consensus. Correct species wins 4 of 4 frames.
reset();
for (let f = 0; f < 4; f++) {
  feedSnapshot([
    makeSlot(0, 'left', { species: 'Volcarona', confidence: 0.26 + Math.random() * 0.02 },
                        { species: 'Vivillon', confidence: 0.24 }),
  ]);
}
let c = getConsensus();
console.log('\n== test 1 (clean): ', fmt(c));
assert('volcarona locks after 4 unanimous frames', c.slots[0].isConfident && c.slots[0].assignedSpecies === 'Volcarona');
assert('winnerVotes == framesObserved (4/4)', c.slots[0].winnerVotes === 4 && c.slots[0].framesObserved === 4);

// ---- Test 2: noisy majority. Correct wins 3 of 5 frames, wrong wins 2.
reset();
const picks = [
  'Volcarona', 'Vivillon', 'Volcarona', 'Volcarona', 'Vivillon',
];
for (const pick of picks) {
  feedSnapshot([makeSlot(0, 'left',
    { species: pick, confidence: 0.25 },
    { species: pick === 'Volcarona' ? 'Vivillon' : 'Volcarona', confidence: 0.24 })]);
}
c = getConsensus();
console.log('\n== test 2 (noisy majority): ', fmt(c));
// 3/5 > 45%, and 3/2 = 1.5 margin equal-to (not greater-than) → should be NOT confident (margin rule is strict >).
// Actually with MIN_CONSENSUS_MARGIN = 1.5, ratio 3/2 = 1.5 meets the floor via >=.
assert('winner is Volcarona', c.slots[0].voteCandidates[0].species === 'Volcarona',
  `got ${c.slots[0].voteCandidates[0]?.species}`);
assert('3/2 ratio passes the >=1.5 margin gate', c.slots[0].isConfident,
  `isConfident=${c.slots[0].isConfident} ratio=${3/2}`);

// ---- Test 3: tie. No confident consensus.
reset();
for (let f = 0; f < 4; f++) {
  const pick = f % 2 === 0 ? 'Volcarona' : 'Vivillon';
  feedSnapshot([makeSlot(0, 'left',
    { species: pick, confidence: 0.25 }, { species: 'Cofagrigus', confidence: 0.23 })]);
}
c = getConsensus();
console.log('\n== test 3 (tie): ', fmt(c));
assert('tie does not produce confident consensus', !c.slots[0].isConfident);

// ---- Test 4: low-confidence votes don't count.
reset();
for (let f = 0; f < 5; f++) {
  feedSnapshot([makeSlot(0, 'left',
    { species: 'Volcarona', confidence: 0.10 /* below MIN_VOTE_CONFIDENCE */ },
    { species: 'Vivillon', confidence: 0.09 })]);
}
c = getConsensus();
console.log('\n== test 4 (low conf): ', fmt(c));
assert('no votes recorded when conf < threshold', !c.slots[0] || c.slots[0].winnerVotes === 0,
  `got winnerVotes=${c.slots[0]?.winnerVotes}`);

// ---- Test 5: multi-slot scenario across multiple frames.
reset();
const team = ['Aegislash', 'Volcarona', 'Gardevoir', 'Blastoise', 'Meowscarada', 'Corviknight'];
for (let f = 0; f < 5; f++) {
  const slots = team.map((species, i) => makeSlot(
    i, 'left',
    { species, confidence: 0.24 + Math.random() * 0.05 },
    { species: 'Random' + i, confidence: 0.20 },
    0, i * 120,
  ));
  feedSnapshot(slots);
}
c = getConsensus();
console.log('\n== test 5 (6-slot team): ', fmt(c));
const confidentSlots = c.slots.filter(s => s.isConfident);
assert('all 6 slots reach confident consensus', confidentSlots.length === 6,
  `got ${confidentSlots.length}/6`);
for (let i = 0; i < team.length; i++) {
  assert(`  slot ${i} == ${team[i]}`, c.slots[i]?.assignedSpecies === team[i],
    `got ${c.slots[i]?.assignedSpecies}`);
}

// ---- Test 6: reset wipes state.
reset();
c = getConsensus();
assert('reset clears all slots', c.slots.length === 0);

console.log(`\n==== ${passCount} passed, ${failCount} failed ====`);
process.exit(failCount > 0 ? 1 : 0);
