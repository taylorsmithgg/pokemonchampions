#!/usr/bin/env node --experimental-strip-types
// Reproduce the live companion's ROI crop (84%×100% @ x=8%, y=0)
// and run the detector against it.

import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'node:fs';

const { detectPokemon } = await import('../src/utils/spriteDetector/pokemonDetector.ts');
const { loadSpriteDatabase } = await import('../src/utils/spriteDetector/spriteDb.ts');

const db = loadSpriteDatabase(
  JSON.parse(await (await import('node:fs/promises')).readFile('public/sprite-detector-db.json', 'utf-8')).entries,
);

const img = await loadImage(process.argv[2] ?? 'images/live-capture-failing.png');
console.log(`source: ${img.width}×${img.height}`);

const rois = [
  { name: 'full (no ROI)', x: 0, y: 0, w: 1, h: 1 },
  { name: 'ROI 84%×100% @ 8%,0', x: 0.08, y: 0, w: 0.84, h: 1 },
];

for (const roi of rois) {
  const sw = Math.round(img.width * roi.w);
  const sh = Math.round(img.height * roi.h);
  const sx = Math.round(img.width * roi.x);
  const sy = Math.round(img.height * roi.y);
  const canvas = createCanvas(sw, sh);
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const id = canvas.getContext('2d').getImageData(0, 0, sw, sh);
  const view = { data: id.data, width: sw, height: sh };
  const t0 = Date.now();
  const r = detectPokemon(view, db);
  const dt = Date.now() - t0;
  console.log(`\n=== ${roi.name}  (${sw}×${sh}) ===`);
  console.log(`  isTeamSelect=${r.frame.isTeamSelect} conf=${r.frame.confidence.toFixed(2)} ` +
              `opp=${r.frame.opponentCards.length}/6 plr=${r.frame.playerCards.length}/6  ${dt}ms`);
  if (r.frame.opponentPanelBounds) {
    const b = r.frame.opponentPanelBounds;
    console.log(`  opp panel: x=[${b.x1}..${b.x2}] (${((b.x1/sw)*100).toFixed(1)}%..${((b.x2/sw)*100).toFixed(1)}%) y=[${b.y1}..${b.y2}]`);
  }
  if (r.frame.playerPanelBounds) {
    const b = r.frame.playerPanelBounds;
    console.log(`  plr panel: x=[${b.x1}..${b.x2}] (${((b.x1/sw)*100).toFixed(1)}%..${((b.x2/sw)*100).toFixed(1)}%) y=[${b.y1}..${b.y2}]`);
  }
  writeFileSync(`.detector-debug/roi-${roi.name.replace(/[^a-z0-9]/gi,'_')}.png`, canvas.toBuffer('image/png'));
}
