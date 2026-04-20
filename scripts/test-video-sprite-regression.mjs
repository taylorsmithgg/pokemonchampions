#!/usr/bin/env node --experimental-strip-types
/**
 * Sprite-matching regression harness.
 *
 * Reads .video-review/rows.json (produced by test-video-regression.mjs),
 * finds every contiguous run of team-select frames (a "selection session"),
 * runs `detectPokemon` on every frame in the session, and accumulates
 * per-slot votes with the same rules as src/utils/spriteDetector/lineupAnalyzer.ts.
 *
 * Reports per session:
 *   • Per-slot winner + votes / frames observed + runner-up
 *   • Confidence flag (matches the analyzer's gates:
 *       ≥2 votes, ≥1.25x margin vs runner-up, ≥35% vote share)
 *   • Frame-to-frame churn — how often the top candidate changes
 *   • Timing breakdown
 *
 * Also emits .video-review/sprite-consensus.json + a CSV of per-frame
 * top picks so you can grep for specific sprites / sessions.
 *
 * Usage:
 *   node --experimental-strip-types scripts/test-video-sprite-regression.mjs \
 *     [--panel opponent|player|both] [--only opponent-only] [--limit N]
 */
import { createCanvas, loadImage } from 'canvas';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import path from 'path';

import { detectPokemon } from '../src/utils/spriteDetector/pokemonDetector.ts';
import { loadSpriteDatabase } from '../src/utils/spriteDetector/spriteDb.ts';

const FRAMES_DIR = '.video-frames';
const REVIEW_DIR = '.video-review';
const DB_PATH = 'public/sprite-detector-db.json';

// Voting thresholds — mirror lineupAnalyzer.ts defaults.
const MIN_VOTE_CONFIDENCE = 0.15;
const MIN_CONSENSUS_VOTES = 2;
const MIN_CONSENSUS_MARGIN = 1.25;
const MIN_CONSENSUS_SHARE = 0.35;

function parseArg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
}
const panelArg = parseArg('--panel', 'both');
const sessionLimit = parseInt(parseArg('--limit', '0'), 10) || 0;

if (!existsSync(path.join(REVIEW_DIR, 'rows.json'))) {
  console.error(`Missing ${REVIEW_DIR}/rows.json — run test-video-regression.mjs first.`);
  process.exit(1);
}

console.log('Loading sprite database…');
const rawDb = JSON.parse(readFileSync(DB_PATH, 'utf8'));
const db = loadSpriteDatabase(rawDb.entries ?? rawDb);
console.log(`  ${db.entries.length} sprite entries loaded`);

const rows = JSON.parse(readFileSync(path.join(REVIEW_DIR, 'rows.json'), 'utf8'));

// ── Group team-select frames into sessions (runs of consecutive rows) ──
const sessions = [];
let currentSession = null;
for (const row of rows) {
  if (row.category !== 'team-select') {
    if (currentSession) { sessions.push(currentSession); currentSession = null; }
    continue;
  }
  if (!currentSession) currentSession = { startSec: row.second, frames: [] };
  currentSession.frames.push(row);
  currentSession.endSec = row.second;
}
if (currentSession) sessions.push(currentSession);

console.log(`Found ${sessions.length} selection session(s):`);
for (const s of sessions) console.log(`  ${s.startSec}s → ${s.endSec}s  (${s.frames.length} frames)`);

const sessionsToRun = sessionLimit > 0 ? sessions.slice(0, sessionLimit) : sessions;

const panelsToRun = panelArg === 'both' ? ['opponent', 'player'] : [panelArg];

function viewFromImage(img) {
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  const id = c.getContext('2d').getImageData(0, 0, img.width, img.height);
  return { data: id.data, width: id.width, height: id.height };
}

function accumulateVote(acc, key, species, confidence, isShiny) {
  const bucket = acc.get(key) || { votes: 0, shinyVotes: 0, sumConf: 0, lastConf: 0 };
  bucket.votes += 1;
  if (isShiny) bucket.shinyVotes += 1;
  bucket.sumConf += confidence;
  bucket.lastConf = confidence;
  acc.set(key, bucket);
}

function rankCandidates(voteMap, framesObserved) {
  const ranked = [...voteMap.entries()]
    .map(([species, b]) => ({
      species,
      votes: b.votes,
      shinyVotes: b.shinyVotes,
      meanConfidence: b.sumConf / b.votes,
      lastConfidence: b.lastConf,
      share: b.votes / framesObserved,
      shinyShare: b.shinyVotes / Math.max(1, b.votes),
    }))
    .sort((a, b) => b.votes - a.votes || b.meanConfidence - a.meanConfidence);
  return ranked;
}

function consensusPasses(ranked, framesObserved) {
  if (ranked.length === 0) return false;
  const winner = ranked[0];
  const runner = ranked[1];
  if (winner.votes < MIN_CONSENSUS_VOTES) return false;
  if (winner.votes / framesObserved < MIN_CONSENSUS_SHARE) return false;
  if (runner && winner.votes / runner.votes < MIN_CONSENSUS_MARGIN) return false;
  return true;
}

const csvRows = [
  'sessionStart,sec,panel,slotIndex,topSpecies,topConf,runnerSpecies,runnerConf,candidates',
];
const sessionReports = [];

let totalMs = 0;
let totalCards = 0;

for (const session of sessionsToRun) {
  console.log(`\n━━ Session ${session.startSec}–${session.endSec}s  (${session.frames.length} frames) ━━`);
  // Per-panel, per-slot vote accumulators.
  const acc = {
    opponent: Array.from({ length: 6 }, () => new Map()),
    player: Array.from({ length: 6 }, () => new Map()),
  };
  const framesObserved = { opponent: 0, player: 0 };
  const topSeries = { opponent: Array.from({ length: 6 }, () => []), player: Array.from({ length: 6 }, () => []) };

  for (const frameRow of session.frames) {
    const img = await loadImage(path.join(FRAMES_DIR, frameRow.file));
    const view = viewFromImage(img);
    const t0 = performance.now();
    const result = detectPokemon(view, db, { matchPlayers: panelsToRun.includes('player') });
    const elapsed = performance.now() - t0;
    totalMs += elapsed;

    if (!result.frame.isTeamSelect) continue;

    for (const panel of panelsToRun) {
      const cards = panel === 'opponent' ? result.opponents : result.players;
      if (cards.length > 0) framesObserved[panel]++;
      for (const card of cards) {
        totalCards++;
        const top = card.top;
        const topSpecies = top?.species ?? 'none';
        const topConf = top?.combined ?? 0;
        const runner = card.candidates[1];
        topSeries[panel][card.index].push({ species: topSpecies, confidence: topConf });

        if (top && topConf >= MIN_VOTE_CONFIDENCE) {
          accumulateVote(
            acc[panel][card.index],
            `${card.index}:${top.species}`,
            top.species,
            topConf,
            !!top.isShiny,
          );
        }

        csvRows.push([
          session.startSec,
          frameRow.second,
          panel,
          card.index,
          topSpecies,
          topConf.toFixed(3),
          runner?.species ?? '',
          (runner?.combined ?? 0).toFixed(3),
          `"${card.candidates.slice(0, 3).map(c => `${c.species}:${(c.combined ?? 0).toFixed(2)}`).join(' | ')}"`,
        ].join(','));
      }
    }
  }

  // Summarize per panel
  const sessionReport = { startSec: session.startSec, endSec: session.endSec, frames: session.frames.length, panels: {} };
  for (const panel of panelsToRun) {
    console.log(`\n  ${panel.toUpperCase()} panel  (observed in ${framesObserved[panel]} frames):`);
    const slots = [];
    for (let i = 0; i < 6; i++) {
      const ranked = rankCandidates(acc[panel][i], framesObserved[panel] || 1);
      const top = ranked[0];
      const runner = ranked[1];
      const passes = consensusPasses(ranked, framesObserved[panel] || 1);
      // Compute churn — how many unique top-candidates across frames.
      const uniqueTops = new Set(topSeries[panel][i].map(t => t.species)).size;
      const topFlag = passes ? ' ✓' : top ? ' ·' : '  ';
      const shinyTag = top && top.shinyShare >= 0.5
        ? '✨ '
        : top && top.shinyVotes > 0
          ? `(${top.shinyVotes}✨) `
          : '';
      const topLine = top
        ? `${shinyTag}${top.species.padEnd(24)} votes=${top.votes}/${framesObserved[panel]} (share ${(top.share * 100).toFixed(0)}%) meanConf=${top.meanConfidence.toFixed(3)}`
        : '(no votes)';
      const runnerLine = runner
        ? `vs ${runner.species} (${runner.votes} votes)`
        : '';
      console.log(`    slot ${i}${topFlag}  ${topLine}  ${runnerLine}  [unique tops=${uniqueTops}]`);
      slots.push({
        index: i,
        winner: top?.species ?? null,
        winnerVotes: top?.votes ?? 0,
        winnerShinyVotes: top?.shinyVotes ?? 0,
        winnerIsShinyConsensus: !!top && top.shinyShare >= 0.5,
        winnerShare: top?.share ?? 0,
        meanConfidence: top?.meanConfidence ?? 0,
        runnerUp: runner?.species ?? null,
        runnerUpVotes: runner?.votes ?? 0,
        uniqueTops,
        confident: passes,
        framesObserved: framesObserved[panel],
      });
    }
    sessionReport.panels[panel] = slots;
  }
  sessionReports.push(sessionReport);
}

// Per-session sample frames for visual inspection
const SAMPLES_DIR = path.join(REVIEW_DIR, 'sprite-sessions');
if (!existsSync(SAMPLES_DIR)) mkdirSync(SAMPLES_DIR, { recursive: true });
for (const session of sessionsToRun) {
  // Mid-session frame
  const mid = session.frames[Math.floor(session.frames.length / 2)];
  if (mid) {
    copyFileSync(path.join(FRAMES_DIR, mid.file), path.join(SAMPLES_DIR, `session-${session.startSec}-${session.endSec}-mid.jpg`));
  }
}

writeFileSync(path.join(REVIEW_DIR, 'sprite-consensus.json'), JSON.stringify(sessionReports, null, 2));
writeFileSync(path.join(REVIEW_DIR, 'sprite-per-frame.csv'), csvRows.join('\n'));

console.log('\n════════════════════════════════════════════════════════');
console.log(`Cards matched: ${totalCards}`);
console.log(`Total detectPokemon time: ${(totalMs / 1000).toFixed(1)}s  (${(totalMs / totalCards).toFixed(1)}ms/card)`);
console.log(`Sessions analyzed: ${sessionsToRun.length}/${sessions.length}`);

// Aggregate: how many slots per session reached confident consensus
let confidentSlots = 0, totalSlots = 0;
for (const s of sessionReports) {
  for (const panel of panelsToRun) {
    for (const slot of s.panels[panel] || []) {
      totalSlots++;
      if (slot.confident) confidentSlots++;
    }
  }
}
console.log(`\nConfident consensus: ${confidentSlots}/${totalSlots} slots (${((confidentSlots / totalSlots) * 100).toFixed(1)}%)`);
console.log(`Reports:  ${REVIEW_DIR}/sprite-consensus.json`);
console.log(`Per-frame CSV: ${REVIEW_DIR}/sprite-per-frame.csv`);
console.log(`Mid-session frames: ${SAMPLES_DIR}/`);
