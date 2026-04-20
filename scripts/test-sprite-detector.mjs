#!/usr/bin/env node
/**
 * Exercises the TS sprite detector against images/ screenshots.
 *
 * Usage:
 *   node scripts/test-sprite-detector.mjs [image-path...]
 *
 * Without arguments: runs the full images/ suite.
 */

import { createCanvas, loadImage } from 'canvas';
import { readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

const IMAGES_DIR = 'images';
const OUT_DIR = '.detector-debug';

async function loadModule(relPath) {
  const url = pathToFileURL(join(process.cwd(), relPath)).href;
  return import(url);
}

async function importDetector() {
  return loadModule('src/utils/spriteDetector/frameDetector.ts');
}

function pixelViewFromCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: imageData.data, width: imageData.width, height: imageData.height };
}

async function main() {
  // We import the TS file via tsx at runtime. Since this repo ships vite
  // for the front-end, use Node's native --import tsx loader. If that's
  // not available, ask the user to run with `npx tsx`.
  const { detectFrame, cropCard } = await importDetector();

  const targets = process.argv.slice(2);
  const imagePaths = targets.length > 0
    ? targets
    : readdirSync(IMAGES_DIR)
        .filter(f => f.toLowerCase().endsWith('.png'))
        .map(f => join(IMAGES_DIR, f));

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR);

  for (const path of imagePaths) {
    const img = await loadImage(path);
    const canvas = createCanvas(img.width, img.height);
    canvas.getContext('2d').drawImage(img, 0, 0);
    const view = pixelViewFromCanvas(canvas);

    console.log(`\n=== ${path} (${img.width}×${img.height}) ===`);
    const t0 = Date.now();
    const det = detectFrame(view);
    const dt = Date.now() - t0;
    console.log(`  isTeamSelect=${det.isTeamSelect}  confidence=${det.confidence.toFixed(2)}  (${dt}ms)`);
    console.log(`  opponent cards: ${det.opponentCards.length}  player cards: ${det.playerCards.length}`);
    if (det.opponentPanelBounds) {
      const b = det.opponentPanelBounds;
      console.log(`    opponent panel: x ${b.x1}-${b.x2} y ${b.y1}-${b.y2}`);
    }
    if (det.playerPanelBounds) {
      const b = det.playerPanelBounds;
      console.log(`    player panel:   x ${b.x1}-${b.x2} y ${b.y1}-${b.y2}`);
    }
    det.opponentCards.forEach((c, i) => {
      console.log(`    OPP  ${i}: y=${c.yStart}-${c.yEnd} x=${c.xStart}-${c.xEnd}`);
    });
    det.playerCards.forEach((c, i) => {
      console.log(`    PLR  ${i}: y=${c.yStart}-${c.yEnd} x=${c.xStart}-${c.xEnd} hl=${c.isHighlighted}`);
    });

    // Render an annotated PNG with panel outlines + card splits
    const out = createCanvas(img.width, img.height);
    const octx = out.getContext('2d');
    octx.drawImage(canvas, 0, 0);
    octx.lineWidth = 3;

    const drawPanel = (bounds, color, label) => {
      if (!bounds) return;
      octx.strokeStyle = color;
      octx.strokeRect(bounds.x1, bounds.y1, bounds.x2 - bounds.x1, bounds.y2 - bounds.y1);
      octx.fillStyle = color;
      octx.font = 'bold 16px sans-serif';
      octx.fillText(label, bounds.x1 + 6, bounds.y1 + 18);
    };
    const drawCards = (cards, color) => {
      for (const c of cards) {
        octx.strokeStyle = color;
        octx.strokeRect(c.xStart, c.yStart, c.xEnd - c.xStart, c.yEnd - c.yStart);
        // sprite bbox
        const bx = c.xStart + c.spriteBbox.x1;
        const by = c.yStart + c.spriteBbox.y1;
        const bw = c.spriteBbox.x2 - c.spriteBbox.x1;
        const bh = c.spriteBbox.y2 - c.spriteBbox.y1;
        octx.strokeStyle = color + '88';
        octx.strokeRect(bx, by, bw, bh);
      }
    };
    drawPanel(det.opponentPanelBounds, '#f43f5e', 'OPPONENT');
    drawPanel(det.playerPanelBounds, '#38bdf8', 'PLAYER');
    drawCards(det.opponentCards, '#f97316');
    drawCards(det.playerCards, '#22d3ee');

    const outPath = join(OUT_DIR, `frame-${basename(path)}`);
    writeFileSync(outPath, out.toBuffer('image/png'));
    console.log(`  wrote ${outPath}`);

    // Also dump one cropped opponent card so we can sanity-check the sprite bbox
    if (det.opponentCards.length > 0) {
      const first = det.opponentCards[0];
      const card = cropCard(view, first);
      const cardCanvas = createCanvas(card.width, card.height);
      cardCanvas.getContext('2d').putImageData(
        new (globalThis.ImageData ?? (await import('canvas')).ImageData)(card.data, card.width, card.height),
        0, 0,
      );
      writeFileSync(
        join(OUT_DIR, `card0-${basename(path)}`),
        cardCanvas.toBuffer('image/png'),
      );
    }
  }
}

function basename(p) {
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(i + 1) : p;
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
