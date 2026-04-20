#!/usr/bin/env node --experimental-strip-types
/**
 * Sprite-crop diagnostic dump.
 *
 * Mirrors the in-app "Sprite crops — manual alignment review" grid
 * but runs offline against gameplay.mp4 frames. For each detected
 * team-select session (from .video-review/rows.json), samples several
 * frames across the session and dumps a composite PNG showing, per
 * slot, the EXACT sprite-bbox crop the matcher fed into the feature
 * extractor — alongside the species the matcher picked and its top-3
 * candidates.
 *
 * Output: .video-review/sprite-crops/session-<start>-<end>-f<sec>.png
 * One image per sampled frame, plus an index.html for quick scanning.
 *
 * Usage:
 *   node --experimental-strip-types scripts/dump-sprite-crops.mjs \
 *     [--samples N]   # crops per session (default 4, evenly spaced)
 *     [--limit N]     # cap session count
 */
import { createCanvas, loadImage } from 'canvas';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'fs';
import path from 'path';

import { detectPokemon } from '../src/utils/spriteDetector/pokemonDetector.ts';
import { loadSpriteDatabase } from '../src/utils/spriteDetector/spriteDb.ts';

const FRAMES_DIR = '.video-frames';
const REVIEW_DIR = '.video-review';
const OUT_DIR = path.join(REVIEW_DIR, 'sprite-crops');
const DB_PATH = 'public/sprite-detector-db.json';

function parseArg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
}
const samplesPerSession = parseInt(parseArg('--samples', '4'), 10) || 4;
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

// Group team-select frames into sessions (runs of consecutive rows).
const sessions = [];
let current = null;
for (const row of rows) {
  if (row.category !== 'team-select') {
    if (current) { sessions.push(current); current = null; }
    continue;
  }
  if (!current) current = { startSec: row.second, frames: [] };
  current.frames.push(row);
  current.endSec = row.second;
}
if (current) sessions.push(current);

const sessionsToRun = sessionLimit > 0 ? sessions.slice(0, sessionLimit) : sessions;
console.log(`Found ${sessions.length} session(s); processing ${sessionsToRun.length}.`);

if (existsSync(OUT_DIR)) {
  for (const f of readdirSync(OUT_DIR)) {
    rmSync(path.join(OUT_DIR, f), { force: true });
  }
} else {
  mkdirSync(OUT_DIR, { recursive: true });
}

function viewFromImage(img) {
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  const id = c.getContext('2d').getImageData(0, 0, img.width, img.height);
  return { data: id.data, width: id.width, height: id.height };
}

// Pick sample frames evenly spaced across the session (skip the very
// first/last frame — those tend to be transition frames where the UI
// is animating in/out).
function pickSamples(session, count) {
  const n = session.frames.length;
  if (n === 0) return [];
  if (n <= count) return session.frames.slice();
  const step = (n - 1) / (count + 1);
  const out = [];
  for (let i = 1; i <= count; i++) {
    out.push(session.frames[Math.round(i * step)]);
  }
  return out;
}

// Layout constants for the composite. Tile width is fixed; tile
// height varies with the crop aspect ratio. Player tiles go on top,
// opponent tiles below, so the visual layout matches the in-app
// review (yours on the left in-game ↔ top here for stacking).
const TILE_W = 220;
const TILE_LABEL_H = 56;
const TILE_HEADER_H = 18;
const TILE_PAD = 8;
const PANEL_HEADER_H = 24;
const FRAME_HEADER_H = 36;
const COLS = 6;

function tileHeightForCrop(cropW, cropH) {
  const ratio = cropH / Math.max(1, cropW);
  return Math.round(TILE_W * ratio) + TILE_HEADER_H + TILE_LABEL_H;
}

function drawTile(ctx, ox, oy, slot, accent) {
  const cropW = slot.sprite.w;
  const cropH = slot.sprite.h;
  const imgH = Math.round(TILE_W * (cropH / Math.max(1, cropW)));
  const tileH = tileHeightForCrop(cropW, cropH);

  // Tile background + border.
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(ox, oy, TILE_W, tileH);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + 0.5, oy + 0.5, TILE_W - 1, tileH - 1);

  // Header — slot number + crop dims.
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(ox, oy, TILE_W, TILE_HEADER_H);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`#${slot.slotIndex + 1}`, ox + 6, oy + 13);
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'right';
  ctx.fillText(`${cropW}×${cropH}`, ox + TILE_W - 6, oy + 13);
  ctx.textAlign = 'left';

  // Cropped sprite.
  if (slot.cropCanvas) {
    ctx.imageSmoothingEnabled = false; // pixelated rendering — lets the
    // user see exact pixel boundaries of the chibi.
    ctx.drawImage(slot.cropCanvas, ox, oy + TILE_HEADER_H, TILE_W, imgH);
    ctx.imageSmoothingEnabled = true;
  } else {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(ox, oy + TILE_HEADER_H, TILE_W, imgH);
    ctx.fillStyle = '#475569';
    ctx.font = '10px monospace';
    ctx.fillText('(crop unavailable)', ox + 8, oy + TILE_HEADER_H + 16);
  }

  // Label area below sprite.
  const labelY = oy + TILE_HEADER_H + imgH;
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(ox, labelY, TILE_W, TILE_LABEL_H);
  const top = slot.candidates[0];
  const second = slot.candidates[1];
  const third = slot.candidates[2];
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = top
    ? (slot.confident ? '#34d399' : '#fbbf24')
    : '#64748b';
  const headLabel = top
    ? `${slot.confident ? '🔒 ' : ''}${top.species} ${Math.round((top.combined ?? 0) * 100)}%`
    : 'no match';
  ctx.fillText(headLabel.slice(0, 30), ox + 6, labelY + 14);
  ctx.font = '10px monospace';
  ctx.fillStyle = '#64748b';
  if (second) {
    ctx.fillText(
      `vs ${second.species} ${Math.round((second.combined ?? 0) * 100)}%`.slice(0, 32),
      ox + 6,
      labelY + 28,
    );
  }
  if (third) {
    ctx.fillText(
      `   ${third.species} ${Math.round((third.combined ?? 0) * 100)}%`.slice(0, 32),
      ox + 6,
      labelY + 42,
    );
  }
  return tileH;
}

function buildSlotsFromCards(view, cards, panel) {
  return cards.map(c => {
    const card = c.card;
    const sb = card.spriteBbox;
    const sx = Math.max(0, card.xStart + sb.x1);
    const sy = Math.max(0, card.yStart + sb.y1);
    const sw = Math.min(view.width - sx, sb.x2 - sb.x1);
    const sh = Math.min(view.height - sy, sb.y2 - sb.y1);
    let cropCanvas = null;
    if (sw > 4 && sh > 4) {
      cropCanvas = createCanvas(sw, sh);
      const cctx = cropCanvas.getContext('2d');
      const id = cctx.createImageData(sw, sh);
      for (let y = 0; y < sh; y++) {
        const srcRow = ((sy + y) * view.width + sx) * 4;
        const dstRow = y * sw * 4;
        for (let x = 0; x < sw * 4; x++) {
          id.data[dstRow + x] = view.data[srcRow + x];
        }
      }
      cctx.putImageData(id, 0, 0);
    }
    return {
      slotIndex: c.index,
      panel,
      sprite: { x: sx, y: sy, w: sw, h: sh },
      card: { x: card.xStart, y: card.yStart, w: card.xEnd - card.xStart, h: card.yEnd - card.yStart },
      cropCanvas,
      candidates: c.candidates,
      confident: c.isConfident,
    };
  });
}

const indexEntries = []; // [{session, sec, file, summary}]

for (const session of sessionsToRun) {
  const samples = pickSamples(session, samplesPerSession);
  console.log(`\n━━ Session ${session.startSec}–${session.endSec}s — sampling ${samples.length} frames ━━`);
  for (const sample of samples) {
    const img = await loadImage(path.join(FRAMES_DIR, sample.file));
    const view = viewFromImage(img);
    const result = detectPokemon(view, db, { matchPlayers: true });
    if (!result.frame.isTeamSelect) {
      console.log(`  s${sample.second}s — frame detector REJECTED (skipping)`);
      continue;
    }
    const playerSlots = buildSlotsFromCards(view, result.players, 'player');
    const opponentSlots = buildSlotsFromCards(view, result.opponents, 'opponent');

    // Compute total height: each row's height = max tile in that row.
    const playerRowH = Math.max(0, ...playerSlots.map(s => tileHeightForCrop(s.sprite.w, s.sprite.h)));
    const opponentRowH = Math.max(0, ...opponentSlots.map(s => tileHeightForCrop(s.sprite.w, s.sprite.h)));
    const totalW = COLS * TILE_W + (COLS + 1) * TILE_PAD;
    const totalH =
      FRAME_HEADER_H +
      PANEL_HEADER_H + playerRowH + TILE_PAD +
      PANEL_HEADER_H + opponentRowH + TILE_PAD * 2;

    const composite = createCanvas(totalW, totalH);
    const ctx = composite.getContext('2d');
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, totalW, totalH);

    // Title bar.
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, totalW, FRAME_HEADER_H);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(
      `Session ${session.startSec}-${session.endSec}s   frame=${sample.second}s   ` +
      `frameConf=${result.frame.confidence.toFixed(2)}   ` +
      `opp=${result.opponents.length}/6  plr=${result.players.length}/6`,
      10,
      24,
    );

    let y = FRAME_HEADER_H;

    // Player panel.
    ctx.fillStyle = '#0c4a6e';
    ctx.fillRect(0, y, totalW, PANEL_HEADER_H);
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('◄ YOURS (player panel)', 10, y + 16);
    y += PANEL_HEADER_H;
    for (let i = 0; i < playerSlots.length; i++) {
      const slot = playerSlots[i];
      const ox = TILE_PAD + i * (TILE_W + TILE_PAD);
      drawTile(ctx, ox, y, slot, '#38bdf8');
    }
    y += playerRowH + TILE_PAD;

    // Opponent panel.
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(0, y, totalW, PANEL_HEADER_H);
    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('OPPONENT panel ►', 10, y + 16);
    y += PANEL_HEADER_H;
    for (let i = 0; i < opponentSlots.length; i++) {
      const slot = opponentSlots[i];
      const ox = TILE_PAD + i * (TILE_W + TILE_PAD);
      drawTile(ctx, ox, y, slot, '#f43f5e');
    }

    const fname = `session-${session.startSec}-${session.endSec}-f${sample.second}s.png`;
    writeFileSync(path.join(OUT_DIR, fname), composite.toBuffer('image/png'));
    const summary =
      `plr: ${playerSlots.map(s => s.candidates[0]?.species ?? '—').join(' / ')}   ` +
      `opp: ${opponentSlots.map(s => s.candidates[0]?.species ?? '—').join(' / ')}`;
    indexEntries.push({ session: `${session.startSec}-${session.endSec}`, sec: sample.second, file: fname, summary });
    console.log(`  s${sample.second}s → ${fname}`);
    console.log(`     ${summary}`);
  }
}

// Tiny index.html so all dumps are scrollable in the browser.
const indexHtml =
  `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sprite crop diagnostics</title>` +
  `<style>body{background:#020617;color:#e2e8f0;font-family:ui-monospace,monospace;padding:24px;}` +
  `h2{color:#7dd3fc;margin-top:32px;font-size:14px;}` +
  `.entry{margin-bottom:24px;}` +
  `.entry img{display:block;max-width:100%;border:1px solid #1e293b;}` +
  `.entry .meta{font-size:11px;color:#94a3b8;margin-top:6px;}` +
  `</style></head><body>` +
  `<h1 style="font-size:18px;color:#fbbf24;">Sprite-crop diagnostics — gameplay.mp4</h1>` +
  `<p style="color:#64748b;font-size:11px;">Each composite shows the exact pixel region the matcher fed into the feature extractor for every slot. Pixelated rendering preserves the chibi's actual edges.</p>` +
  indexEntries
    .map(
      e => `<div class="entry"><h2>Session ${e.session} — frame ${e.sec}s</h2>` +
        `<img src="${e.file}" alt="${e.file}"/>` +
        `<div class="meta">${e.summary}</div></div>`,
    )
    .join('') +
  `</body></html>`;
writeFileSync(path.join(OUT_DIR, 'index.html'), indexHtml);

console.log(`\n${indexEntries.length} composite(s) written to ${OUT_DIR}/`);
console.log(`Open ${OUT_DIR}/index.html for a scrollable view.`);
