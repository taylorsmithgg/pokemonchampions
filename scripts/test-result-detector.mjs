#!/usr/bin/env node --experimental-strip-types
// Quick harness: run the TS result detector against the reference
// win/loss screenshot and a non-result screenshot to confirm the
// port matches the Python baseline.

import { createCanvas, loadImage } from 'canvas';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { detectResult } from '../src/utils/spriteDetector/resultDetector.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/**
 * Run the detector on `view` and print results.
 * Returns the detection so callers can assert on it.
 */
function runView(view, label, extraMeta = '') {
  const t0 = Date.now();
  const r = detectResult(view);
  const dt = Date.now() - t0;
  console.log(`\n=== ${label} ===`);
  if (extraMeta) console.log(`  ${extraMeta}`);
  console.log(`  size: ${view.width}×${view.height}`);
  console.log(`  is_result_screen: ${r.isResultScreen}`);
  console.log(`  outcome: ${r.outcome}`);
  console.log(`  confidence: ${r.confidence.toFixed(3)}`);
  console.log(`  signals:`);
  for (const [k, v] of Object.entries(r.signals)) {
    if (v === undefined) continue;
    if (typeof v === 'number') {
      console.log(`    ${k.padEnd(13)} ${v.toFixed(2)}%`);
    } else {
      console.log(`    ${k.padEnd(13)} ${v}`);
    }
  }
  console.log(`  time: ${dt}ms`);
  return r;
}

function viewFromCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: id.data, width: canvas.width, height: canvas.height };
}

async function canvasFromImage(imagePath) {
  const img = await loadImage(imagePath);
  const canvas = createCanvas(img.width, img.height);
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas;
}

/**
 * Horizontally flip `canvas` so its left and right halves swap.
 * A genuine win screen becomes a synthetic loss screen: player side
 * moves to the right, opponent side moves to the left. If the
 * detector is properly symmetric it should classify this as a LOSS
 * with comparable confidence.
 */
function flipHorizontally(canvas) {
  const out = createCanvas(canvas.width, canvas.height);
  const ctx = out.getContext('2d');
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

async function runOn(imagePath, label) {
  const canvas = await canvasFromImage(imagePath);
  return runView(viewFromCanvas(canvas), label, `path: ${path.relative(repoRoot, imagePath)}`);
}

const fixtures = [
  { path: path.join(repoRoot, 'images', 'win-loss-screen.png'), label: 'win-loss reference' },
  { path: path.join(repoRoot, 'images', 'lineup-selection-overlay.png'), label: 'lineup-selection (negative)' },
  { path: path.join(repoRoot, 'images', 'lineup-selection-lock-overlay.png'), label: 'lineup-selection-lock (negative)' },
];

const results = [];
for (const f of fixtures) {
  try {
    const r = await runOn(f.path, f.label);
    results.push({ label: f.label, detection: r });
  } catch (err) {
    console.error(`\n!! ${f.label}: ${err.message}`);
  }
}

// Synthetic-loss test: mirror the win reference. If the detector is
// properly symmetric it must flag this as LOSS with no false-positive
// risk increase, because mirrored WON!/LOST… typography still has the
// correct HSV signature on the flipped side.
try {
  const winCanvas = await canvasFromImage(path.join(repoRoot, 'images', 'win-loss-screen.png'));
  const flipped = flipHorizontally(winCanvas);
  const r = runView(
    viewFromCanvas(flipped),
    'synthetic loss (win ref, flipped LR)',
    'source: images/win-loss-screen.png (mirrored)',
  );
  results.push({ label: 'synthetic loss', detection: r });
  const ok = r.isResultScreen && r.outcome === 'loss';
  console.log(
    `\n  ASSERTION: detector classifies mirrored win as LOSS → ${ok ? 'PASS' : 'FAIL'}`,
  );
  if (!ok) process.exitCode = 1;
} catch (err) {
  console.error(`\n!! synthetic loss: ${err.message}`);
  process.exitCode = 1;
}
