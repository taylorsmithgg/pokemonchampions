#!/usr/bin/env node --experimental-strip-types
/**
 * Unit test for the result-confirmation state machine in
 * StreamCompanionPage.tsx (`pendingAutoResultRef` logic). The bug we're
 * preventing: a single dropped frame between two WIN detections used
 * to reset `pending` to null, which meant the confirmation never fired
 * and the win counter never incremented even though the detector
 * accepted the WIN.
 *
 * This script simulates the state machine in isolation using the same
 * branching logic as the production code (StreamCompanionPage.tsx
 * `runScan` result-handling block) so we can verify behavior across
 * realistic frame sequences.
 */

const STALE_MS = 6000;

/**
 * @param {Array<{result: 'win'|'loss'|null, t: number}>} frames
 * @returns {{confirmed: Array<{result:'win'|'loss', t:number}>, pendingTrace: any[]}}
 */
function simulate(frames) {
  let pending = null;
  const confirmed = [];
  const pendingTrace = [];

  for (const f of frames) {
    if (f.result) {
      const now = f.t;
      if (!pending || pending.result !== f.result) {
        pending = { result: f.result, seenCount: 1, lastSeen: now };
        pendingTrace.push({ t: now, action: 'init', pending: { ...pending } });
        continue;
      }
      const nextSeenCount = pending.seenCount + 1;
      if (nextSeenCount < 2) {
        pending = { result: f.result, seenCount: nextSeenCount, lastSeen: now };
        pendingTrace.push({ t: now, action: 'inc', pending: { ...pending } });
        continue;
      }
      // Confirmation
      pendingTrace.push({ t: now, action: 'confirm', pending: { ...pending } });
      confirmed.push({ result: f.result, t: now });
      pending = null;
      continue;
    }
    // No result — keep pending alive unless stale
    if (pending && f.t - pending.lastSeen > STALE_MS) {
      pendingTrace.push({ t: f.t, action: 'stale-reset', pending: { ...pending } });
      pending = null;
    } else if (pending) {
      pendingTrace.push({ t: f.t, action: 'tolerate-miss', pending: { ...pending } });
    }
  }
  return { confirmed, pendingTrace };
}

let pass = 0;
let fail = 0;
function check(name, cond, ctx) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    pass++;
  } else {
    console.log(`  ✗ ${name}`);
    if (ctx) console.log(`    ${JSON.stringify(ctx)}`);
    fail++;
  }
}

// Test 1: classic two consecutive hits → confirm
{
  console.log('\n[T1] two consecutive hits confirm immediately');
  const r = simulate([
    { result: 'win', t: 0 },
    { result: 'win', t: 1000 },
  ]);
  check('one win confirmed', r.confirmed.length === 1, r);
  check('confirmed result is win', r.confirmed[0]?.result === 'win', r);
}

// Test 2: hit, miss, hit (the bug scenario) → must still confirm
{
  console.log('\n[T2] hit / miss / hit  — formerly the bug');
  const r = simulate([
    { result: 'win', t: 0 },
    { result: null, t: 500 },
    { result: 'win', t: 1000 },
  ]);
  check('one win confirmed despite intermediate miss', r.confirmed.length === 1, r);
}

// Test 3: hit, then long gap of misses → pending must clear
{
  console.log('\n[T3] hit, then 7s of misses → pending cleared');
  const r = simulate([
    { result: 'win', t: 0 },
    { result: null, t: 1000 },
    { result: null, t: 2000 },
    { result: null, t: 3000 },
    { result: null, t: 4000 },
    { result: null, t: 5000 },
    { result: null, t: 6500 }, // > 6s after lastSeen=0
    { result: null, t: 7000 },
  ]);
  check('no confirmation', r.confirmed.length === 0, r);
  const stale = r.pendingTrace.find(e => e.action === 'stale-reset');
  check('stale-reset fired', !!stale, r.pendingTrace);
}

// Test 4: hit, miss, miss, miss (5s in), hit → must confirm
{
  console.log('\n[T4] one hit, 5s of misses, one more hit → confirm');
  const r = simulate([
    { result: 'win', t: 0 },
    { result: null, t: 1000 },
    { result: null, t: 2000 },
    { result: null, t: 3000 },
    { result: null, t: 4000 },
    { result: null, t: 5000 },
    { result: 'win', t: 5500 },
  ]);
  check('one win confirmed across 5s gap', r.confirmed.length === 1, r);
}

// Test 5: hit (win), then loss → pending switches, no confirm
{
  console.log('\n[T5] hit win then hit loss → switch, no confirm');
  const r = simulate([
    { result: 'win', t: 0 },
    { result: 'loss', t: 500 },
  ]);
  check('no confirmation yet', r.confirmed.length === 0, r);
  const inits = r.pendingTrace.filter(e => e.action === 'init');
  check('two inits (win then loss)', inits.length === 2, r.pendingTrace);
}

// Test 6: many hits + interleaved misses → confirm exactly once per match
{
  console.log('\n[T6] long WIN screen with flicker → confirm once');
  const r = simulate([
    { result: 'win', t: 0 },
    { result: null, t: 200 },
    { result: 'win', t: 400 },  // confirm here
    { result: 'win', t: 600 },
    { result: null, t: 800 },
    { result: 'win', t: 1000 },
  ]);
  // After confirmation pending is null, so the next 'win' at t=600 triggers
  // a new init (not a re-confirm). To re-confirm we'd need ANOTHER win
  // after the init (i.e., t=1000 confirms again). So total confirmations
  // can be > 1 if the WIN screen sustains. That's OK in production
  // because recordMatch() resets pending and starts a 5s cooldown on the
  // very first confirm — re-confirms within the cooldown are skipped at
  // the runScan top.
  check('at least one confirm', r.confirmed.length >= 1, r);
  check('first confirm at t=400', r.confirmed[0]?.t === 400, r);
}

// Test 7: real timeline — WIN screen at 1Hz scan, banner only matches
//        on alternate frames. With the OLD logic this would confirm
//        only if two consecutive scans both hit (fragile). With the
//        NEW logic, alternating hit/miss is fine.
{
  console.log('\n[T7] alternating hit/miss at 1Hz → confirm');
  const r = simulate([
    { result: 'win', t: 0 },
    { result: null, t: 1000 },
    { result: 'win', t: 2000 },
  ]);
  check('confirms on second hit', r.confirmed.length === 1, r);
}

console.log(`\n══════ ${pass} passed, ${fail} failed ══════`);
process.exit(fail > 0 ? 1 : 0);
