#!/usr/bin/env node --experimental-strip-types
/**
 * Video regression harness.
 *
 * Runs BOTH the selection-screen frame detector and the W/L result
 * detector against every frame in .video-frames/, then emits:
 *
 *   1. A CSV log line per frame with classification + all raw signals.
 *   2. A JSON summary with counts and W/L run-length analysis (real
 *      W/L screens last multiple seconds — single-frame positives
 *      are almost always false).
 *   3. Sample frames copied to .video-review/<category>/ so you can
 *      eyeball each class at a glance.
 *
 * Usage:
 *   node --experimental-strip-types scripts/test-video-regression.mjs [--sample N]
 */
import { createCanvas, loadImage } from 'canvas';
import { existsSync, mkdirSync, readdirSync, writeFileSync, copyFileSync, rmSync } from 'fs';
import path from 'path';

import { detectFrame } from '../src/utils/spriteDetector/frameDetector.ts';
import { detectResult } from '../src/utils/spriteDetector/resultDetector.ts';

const FRAMES_DIR = '.video-frames';
const REVIEW_DIR = '.video-review';
const SAMPLE_ARG = process.argv.indexOf('--sample');
const SAMPLES_PER_CATEGORY = SAMPLE_ARG > 0 ? parseInt(process.argv[SAMPLE_ARG + 1], 10) || 20 : 20;

if (!existsSync(FRAMES_DIR)) {
  console.error(`${FRAMES_DIR}/ missing — run ffmpeg extraction first:`);
  console.error(`  ffmpeg -i gameplay.mp4 -vf fps=1 -q:v 3 ${FRAMES_DIR}/f_%05d.jpg`);
  process.exit(1);
}

rmSync(REVIEW_DIR, { recursive: true, force: true });
mkdirSync(REVIEW_DIR, { recursive: true });
for (const cat of ['team-select', 'lock-screen', 'win', 'loss', 'result-only', 'frame-only', 'none']) {
  mkdirSync(path.join(REVIEW_DIR, cat), { recursive: true });
}

function viewFromImage(img) {
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  const id = c.getContext('2d').getImageData(0, 0, img.width, img.height);
  return { data: id.data, width: id.width, height: id.height };
}

const files = readdirSync(FRAMES_DIR)
  .filter(f => f.endsWith('.jpg'))
  .sort();

console.log(`Analyzing ${files.length} frames…`);

const rows = [];
const counts = {
  'team-select': 0,
  'lock-screen': 0,
  'win': 0,
  'loss': 0,
  'result-only': 0,
  'frame-only': 0,
  'none': 0,
};
// For sampling: track how many frames per category we've copied and
// space them across the timeline (every Nth match).
const sampled = Object.fromEntries(Object.keys(counts).map(k => [k, 0]));
const sampleStride = new Map();

const t0 = Date.now();
let processed = 0;
for (const file of files) {
  const full = path.join(FRAMES_DIR, file);
  const img = await loadImage(full);
  const view = viewFromImage(img);
  const frame = detectFrame(view);
  const result = detectResult(view);

  // Classification priority: W/L > team-select > nothing.
  let category;
  if (result.isResultScreen) {
    category = result.outcome ?? 'result-only';
    if (!frame.isTeamSelect) {
      // could also be "result-only" if we want to flag W/L without
      // concurrent team-select, which is normal.
    }
  } else if (frame.mode === 'selection') {
    category = 'team-select';
  } else if (frame.mode === 'lock') {
    category = 'lock-screen';
  } else {
    category = 'none';
  }
  counts[category] = (counts[category] || 0) + 1;

  rows.push({
    file,
    second: parseInt(file.match(/f_(\d+)/)?.[1] ?? '0', 10),
    category,
    frame: {
      isTeamSelect: frame.isTeamSelect,
      isLineupScreen: frame.isLineupScreen,
      mode: frame.mode,
      frameConfidence: Number(frame.confidence.toFixed(3)),
      opponentCardCount: frame.opponentCards.length,
      playerCardCount: frame.playerCards.length,
    },
    result: {
      isResultScreen: result.isResultScreen,
      outcome: result.outcome,
      confidence: Number(result.confidence.toFixed(3)),
      signals: {
        centerDark: Number(result.signals.centerDark.toFixed(2)),
        badgeRedLeft: Number(result.signals.badgeRedLeft.toFixed(2)),
        badgeRedRight: Number(result.signals.badgeRedRight.toFixed(2)),
        goldLeft: Number(result.signals.goldLeft.toFixed(2)),
        silverLeft: Number(result.signals.silverLeft.toFixed(2)),
        goldRight: Number(result.signals.goldRight.toFixed(2)),
        silverRight: Number(result.signals.silverRight.toFixed(2)),
        decision: result.signals.decision,
      },
    },
  });

  // (Sampling happens in a second pass below after we know the total
  //  per-category counts so we can evenly stride across the timeline.)

  processed++;
  if (processed % 100 === 0) {
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    const rate = (processed / (Date.now() - t0) * 1000).toFixed(1);
    console.log(`  ${processed}/${files.length}  (${dt}s, ${rate} fps)`);
  }
}

// ── Run-length analysis for W/L ─────────────────────────────────
// A genuine W/L screen persists for ~5-15 seconds. Isolated
// single-frame wins or losses are false positives.
function computeRuns(category) {
  const runs = [];
  let start = -1;
  for (let i = 0; i < rows.length; i++) {
    const hit = rows[i].category === category;
    if (hit && start < 0) start = i;
    if (!hit && start >= 0) {
      runs.push({ startSec: rows[start].second, endSec: rows[i - 1].second, len: i - start });
      start = -1;
    }
  }
  if (start >= 0) {
    runs.push({ startSec: rows[start].second, endSec: rows[rows.length - 1].second, len: rows.length - start });
  }
  return runs;
}

const winRuns = computeRuns('win');
const lossRuns = computeRuns('loss');
const isolatedWins = winRuns.filter(r => r.len === 1);
const isolatedLosses = lossRuns.filter(r => r.len === 1);

const summary = {
  totalFrames: files.length,
  counts,
  win: { total: counts.win, runs: winRuns.length, isolated: isolatedWins.length, isolatedAt: isolatedWins.map(r => r.startSec) },
  loss: { total: counts.loss, runs: lossRuns.length, isolated: isolatedLosses.length, isolatedAt: isolatedLosses.map(r => r.startSec) },
  winRuns,
  lossRuns,
  elapsedSec: (Date.now() - t0) / 1000,
  samplesCopied: sampled,
};

// Second pass: evenly-strided sampling so each category yields up to
// SAMPLES_PER_CATEGORY frames spread across the full timeline.
for (const [cat, total] of Object.entries(counts)) {
  if (total === 0) continue;
  const stride = Math.max(1, Math.floor(total / SAMPLES_PER_CATEGORY));
  let seen = 0;
  let copied = 0;
  for (const row of rows) {
    if (row.category !== cat) continue;
    if (seen % stride === 0 && copied < SAMPLES_PER_CATEGORY) {
      copyFileSync(path.join(FRAMES_DIR, row.file), path.join(REVIEW_DIR, cat, row.file));
      copied++;
    }
    seen++;
  }
  sampled[cat] = copied;
}

writeFileSync(path.join(REVIEW_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
writeFileSync(path.join(REVIEW_DIR, 'rows.json'), JSON.stringify(rows, null, 2));

// Per-category rows as CSV for quick grep/sort
const csvHeader = 'second,file,category,isTeamSelect,frameConf,oppCards,plrCards,isResult,outcome,resConf,centerDark,badgeL,badgeR,goldL,silverL,goldR,silverR,decision';
const csvLines = rows.map(r => [
  r.second,
  r.file,
  r.category,
  r.frame.isTeamSelect,
  r.frame.frameConfidence,
  r.frame.opponentCardCount,
  r.frame.playerCardCount,
  r.result.isResultScreen,
  r.result.outcome ?? '',
  r.result.confidence,
  r.result.signals.centerDark,
  r.result.signals.badgeRedLeft,
  r.result.signals.badgeRedRight,
  r.result.signals.goldLeft,
  r.result.signals.silverLeft,
  r.result.signals.goldRight,
  r.result.signals.silverRight,
  `"${(r.result.signals.decision ?? '').replace(/"/g, '""')}"`,
].join(','));
writeFileSync(path.join(REVIEW_DIR, 'rows.csv'), [csvHeader, ...csvLines].join('\n'));

console.log('\n════════════════════════════════════════════════════════');
console.log('Frame counts:');
for (const [k, v] of Object.entries(counts)) {
  const pct = ((v / files.length) * 100).toFixed(1);
  console.log(`  ${k.padEnd(14)} ${String(v).padStart(5)}  (${pct}%)`);
}
console.log('\nW/L runs (consecutive 1-fps frames classified win/loss):');
console.log(`  wins:   ${winRuns.length} runs — ${isolatedWins.length} isolated (≤1s) @ seconds ${isolatedWins.slice(0, 10).map(r => r.startSec).join(', ')}${isolatedWins.length > 10 ? '…' : ''}`);
for (const r of winRuns) console.log(`    win  ${String(r.startSec).padStart(4)}–${String(r.endSec).padStart(4)}s  len=${r.len}${r.len === 1 ? '  ← suspicious' : ''}`);
console.log(`  losses: ${lossRuns.length} runs — ${isolatedLosses.length} isolated (≤1s) @ seconds ${isolatedLosses.slice(0, 10).map(r => r.startSec).join(', ')}${isolatedLosses.length > 10 ? '…' : ''}`);
for (const r of lossRuns) console.log(`    loss ${String(r.startSec).padStart(4)}–${String(r.endSec).padStart(4)}s  len=${r.len}${r.len === 1 ? '  ← suspicious' : ''}`);
console.log(`\nSamples saved to ${REVIEW_DIR}/<category>/ (summary.json, rows.json, rows.csv)`);
console.log(`Elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
