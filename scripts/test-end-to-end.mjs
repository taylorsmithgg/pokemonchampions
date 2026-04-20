#!/usr/bin/env node
/**
 * Full-pipeline test: loads the sprite DB, runs every screenshot under
 * images/ through `detectPokemon`, and writes an annotated preview.
 *
 * Usage:
 *   node --experimental-strip-types scripts/test-end-to-end.mjs [image-path...]
 */

import { createCanvas, loadImage } from 'canvas';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

const IMAGES_DIR = 'images';
const OUT_DIR = '.detector-debug';
const DB_PATH = 'public/sprite-detector-db.json';

async function loadModule(relPath) {
  return import(pathToFileURL(join(process.cwd(), relPath)).href);
}

const { detectPokemon } = await loadModule('src/utils/spriteDetector/pokemonDetector.ts');
const { loadSpriteDatabase } = await loadModule('src/utils/spriteDetector/spriteDb.ts');

if (!existsSync(DB_PATH)) {
  console.error(`Missing ${DB_PATH} — run scripts/build-sprite-detector-db.mjs first.`);
  process.exit(1);
}

const payload = JSON.parse(readFileSync(DB_PATH, 'utf-8'));
console.log(`Loaded sprite DB: ${payload.entries.length} entries, templateDim=${payload.templateDim}`);
const db = loadSpriteDatabase(payload.entries);

const targets = process.argv.slice(2);
const imagePaths = targets.length > 0
  ? targets
  : readdirSync(IMAGES_DIR)
      .filter(f => f.toLowerCase().endsWith('.png') && f.toLowerCase().startsWith('lineup'))
      .map(f => join(IMAGES_DIR, f));

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR);

function pixelViewFromCanvas(canvas) {
  const id = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  return { data: id.data, width: id.width, height: id.height };
}

function drawAnnotatedFrame(baseCanvas, result) {
  const out = createCanvas(baseCanvas.width, baseCanvas.height);
  const ctx = out.getContext('2d');
  ctx.drawImage(baseCanvas, 0, 0);

  // Outer HSV panels.
  const drawPanel = (bounds, color, label) => {
    if (!bounds) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(bounds.x1, bounds.y1, bounds.x2 - bounds.x1, bounds.y2 - bounds.y1);
    ctx.setLineDash([]);
    ctx.font = 'bold 12px sans-serif';
    const tw = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(bounds.x1, bounds.y1 - 16, tw, 16);
    ctx.fillStyle = color;
    ctx.fillText(label, bounds.x1 + 4, bounds.y1 - 3);
  };
  drawPanel(result.frame.playerPanelBounds, '#38bdf8', 'PANEL YOURS');
  drawPanel(result.frame.opponentPanelBounds, '#f43f5e', 'PANEL OPP');

  const drawPokemon = (det, cardColor, spriteColor) => {
    const c = det.card;
    // Card rectangle — thin dashed.
    ctx.strokeStyle = cardColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(c.xStart, c.yStart, c.xEnd - c.xStart, c.yEnd - c.yStart);
    ctx.setLineDash([]);

    // Sprite bbox — solid, thicker.
    const sx = c.xStart + c.spriteBbox.x1;
    const sy = c.yStart + c.spriteBbox.y1;
    const sw = c.spriteBbox.x2 - c.spriteBbox.x1;
    const sh = c.spriteBbox.y2 - c.spriteBbox.y1;
    ctx.lineWidth = 3;
    ctx.strokeStyle = spriteColor;
    ctx.strokeRect(sx, sy, sw, sh);

    const label = det.top
      ? `${det.top.species} ${(det.top.combined * 100).toFixed(0)}%${det.isConfident ? '' : '?'}`
      : '—';
    ctx.font = 'bold 16px sans-serif';
    const padX = 8;
    const metrics = ctx.measureText(label);
    const bgW = metrics.width + padX * 2;
    const bgH = 22;
    const bgY = sy + 6;
    const bgX = c.panel === 'opponent' ? sx + 6 : sx + sw - bgW - 6;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(bgX, bgY, bgW, bgH);
    ctx.fillStyle = det.isConfident ? '#22d3ee' : '#fb923c';
    ctx.fillText(label, bgX + padX, bgY + 16);
  };

  for (const det of result.opponents) drawPokemon(det, '#f43f5e', '#fb923c');
  for (const det of result.players) drawPokemon(det, '#38bdf8', '#22d3ee');

  return out;
}

for (const path of imagePaths) {
  const img = await loadImage(path);
  const canvas = createCanvas(img.width, img.height);
  canvas.getContext('2d').drawImage(img, 0, 0);
  const view = pixelViewFromCanvas(canvas);

  console.log(`\n=== ${path}  (${img.width}×${img.height}) ===`);
  const result = detectPokemon(view, db);
  console.log(`  isTeamSelect=${result.frame.isTeamSelect} confidence=${result.frame.confidence.toFixed(2)}  total=${result.totalMs.toFixed(0)}ms`);

  const report = (label, list) => {
    console.log(`  ${label}:`);
    for (const det of list) {
      if (!det.top) {
        console.log(`    #${det.index} <no match>`);
        continue;
      }
      const candStr = det.candidates
        .map(c => `${c.species}:${(c.combined * 100).toFixed(0)}`)
        .join(', ');
      console.log(
        `    #${det.index} ${det.isConfident ? '✓' : '?'} ${det.top.species} ` +
        `combined=${det.top.combined.toFixed(2)} ` +
        `color=${det.top.colorScore.toFixed(2)} ` +
        `tmpl=${det.top.templateScore.toFixed(2)} ` +
        `shape=${det.top.shapeScore.toFixed(2)} ` +
        `phash=${det.top.phashDistance}  [${candStr}]`,
      );
    }
  };
  report('OPP', result.opponents);
  report('PLR', result.players);

  const outCanvas = drawAnnotatedFrame(canvas, result);
  const base = path.slice(path.lastIndexOf('/') + 1);
  const outPath = join(OUT_DIR, `detect-${base}`);
  writeFileSync(outPath, outCanvas.toBuffer('image/png'));
  console.log(`  wrote ${outPath}`);
}
