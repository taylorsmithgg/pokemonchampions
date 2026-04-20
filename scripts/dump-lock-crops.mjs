#!/usr/bin/env node --experimental-strip-types
/**
 * Lock-screen sprite-crop diagnostic dump.
 *
 * Mirrors `dump-sprite-crops.mjs` but operates on lock-screen frames
 * (one per second of footage). The lock pipeline uses different
 * background masking (per-card adaptive HSV) and a slightly different
 * sprite bbox geometry, so dumping a separate review surface lets us
 * audit alignment + matcher choices independently from the selection
 * pipeline.
 *
 * Output: .video-review/lock-crops/lock-f<sec>.png  (+ index.html)
 *
 * Usage:
 *   node --experimental-strip-types scripts/dump-lock-crops.mjs \
 *     [--limit N]   # cap frames processed
 */
import { createCanvas, loadImage } from 'canvas';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'fs';
import path from 'path';

import { detectPokemon } from '../src/utils/spriteDetector/pokemonDetector.ts';
import { loadSpriteDatabase } from '../src/utils/spriteDetector/spriteDb.ts';
import { extractSpriteMask, findSpriteBounds } from '../src/utils/spriteDetector/spriteMask.ts';

const FRAMES_DIR = '.video-frames';
const REVIEW_DIR = '.video-review';
const OUT_DIR = path.join(REVIEW_DIR, 'lock-crops');
const DB_PATH = 'public/sprite-detector-db.json';

function parseArg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
}
const frameLimit = parseInt(parseArg('--limit', '0'), 10) || 0;

if (!existsSync(path.join(REVIEW_DIR, 'rows.json'))) {
  console.error(`Missing ${REVIEW_DIR}/rows.json — run test-video-regression.mjs first.`);
  process.exit(1);
}

console.log('Loading sprite database…');
const rawDb = JSON.parse(readFileSync(DB_PATH, 'utf8'));
const db = loadSpriteDatabase(rawDb.entries ?? rawDb);
console.log(`  ${db.entries.length} sprite entries loaded`);

const rows = JSON.parse(readFileSync(path.join(REVIEW_DIR, 'rows.json'), 'utf8'));
const lockRows = rows.filter(r => r.category === 'lock-screen');
const teamSelectRows = rows.filter(r => r.category === 'team-select');
const rowsToRun = frameLimit > 0 ? lockRows.slice(0, frameLimit) : lockRows;
console.log(`Found ${lockRows.length} lock-screen frame(s); processing ${rowsToRun.length}.`);

/**
 * Group adjacent team-select frames into "sessions" (gaps > 60s split
 * sessions). Each lock frame is then attached to the session whose
 * range contains it (or that ended within 60s before it). The session's
 * selection consensus becomes the constrained-matching candidate pool
 * for that lock frame — exactly mirroring how `StreamCompanionPage`
 * builds `lockMatchHints` from the live selection consensus.
 */
function buildSessions(selectRows) {
  const sessions = [];
  let cur = null;
  for (const r of selectRows) {
    if (cur && r.second - cur.lastSec <= 60) {
      cur.frames.push(r);
      cur.lastSec = r.second;
    } else {
      cur = { firstSec: r.second, lastSec: r.second, frames: [r] };
      sessions.push(cur);
    }
  }
  return sessions;
}
const sessions = buildSessions(teamSelectRows);

function findSessionForLock(lockSec) {
  for (const s of sessions) {
    if (lockSec >= s.firstSec - 5 && lockSec <= s.lastSec + 90) return s;
  }
  return null;
}

if (existsSync(OUT_DIR)) {
  for (const f of readdirSync(OUT_DIR)) rmSync(path.join(OUT_DIR, f), { force: true });
} else {
  mkdirSync(OUT_DIR, { recursive: true });
}

function viewFromImage(img) {
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  const id = c.getContext('2d').getImageData(0, 0, img.width, img.height);
  return { data: id.data, width: id.width, height: id.height };
}

/**
 * Run the matcher on every selection frame in a session and tally
 * top-pick votes per slot (left/right × slotIndex). The species that
 * collects the most votes (with confidence ≥ 0.15, mirroring the live
 * lineupAnalyzer rules) becomes the consensus pick for that slot.
 *
 * Returns the union of confident picks per side — exactly the shape
 * the live `buildLockMatchHints` produces, so the dump faithfully
 * reproduces what production lock matching will see.
 */
const sessionConsensusCache = new Map();
async function deriveSessionConsensus(session) {
  const cached = sessionConsensusCache.get(session);
  if (cached) return cached;

  const votes = new Map();
  const frameCount = new Map();

  for (const r of session.frames) {
    const img = await loadImage(path.join(FRAMES_DIR, r.file));
    const view = viewFromImage(img);
    const result = detectPokemon(view, db, { matchPlayers: true });
    if (!result.frame.isLineupScreen || result.frame.mode !== 'selection') continue;
    const tally = (det, side) => {
      const key = `${side}:${det.index}`;
      frameCount.set(key, (frameCount.get(key) ?? 0) + 1);
      const top = det.candidates[0];
      if (!top || (top.combined ?? 0) < 0.15) return;
      let m = votes.get(key);
      if (!m) {
        m = new Map();
        votes.set(key, m);
      }
      m.set(top.species, (m.get(top.species) ?? 0) + 1);
    };
    result.players.forEach(p => tally(p, 'left'));
    result.opponents.forEach(o => tally(o, 'right'));
  }

  const playerSpecies = new Set();
  const opponentSpecies = new Set();
  for (const [key, m] of votes) {
    const ranked = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const winner = ranked[0];
    const runner = ranked[1];
    const observed = frameCount.get(key) ?? 0;
    if (!winner || winner[1] < 2) continue;
    if (winner[1] / observed < 0.35) continue;
    if (runner && winner[1] / runner[1] < 1.25) continue;
    if (key.startsWith('left:')) playerSpecies.add(winner[0]);
    else opponentSpecies.add(winner[0]);
  }
  const hints = { playerSpecies, opponentSpecies };
  sessionConsensusCache.set(session, hints);
  return hints;
}

const TILE_W = 220;
const TILE_LABEL_H = 60;
const TILE_HEADER_H = 18;
const TILE_PAD = 8;
const PANEL_HEADER_H = 24;
const FRAME_HEADER_H = 36;
const COLS = 6;

function tileHeightForCrop(cropW, cropH) {
  const ratio = cropH / Math.max(1, cropW);
  // Stack RAW + MASKED side by side; the tile reserves height for one
  // image (they share the same crop dims).
  return Math.round(TILE_W * ratio) + TILE_HEADER_H + TILE_LABEL_H;
}

function drawTile(ctx, ox, oy, slot, accent) {
  const cropW = slot.sprite.w;
  const cropH = slot.sprite.h;
  // Each sub-image takes half the tile width so we can show RAW |
  // MASKED side by side. Aspect ratio is preserved per sub-image.
  const subW = Math.floor((TILE_W - 1) / 2);
  const imgH = Math.round(subW * (cropH / Math.max(1, cropW)));
  const tileH = imgH + TILE_HEADER_H + TILE_LABEL_H;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(ox, oy, TILE_W, tileH);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + 0.5, oy + 0.5, TILE_W - 1, tileH - 1);

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(ox, oy, TILE_W, TILE_HEADER_H);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`#${slot.slotIndex + 1}`, ox + 6, oy + 13);
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'right';
  const bboxLabel = slot.bbox
    ? ` bb=${slot.bbox.maxX - slot.bbox.minX + 1}×${slot.bbox.maxY - slot.bbox.minY + 1}`
    : ' bb=∅';
  ctx.fillText(`${cropW}×${cropH}${bboxLabel}`, ox + TILE_W - 6, oy + 13);
  ctx.textAlign = 'left';

  // Left: RAW crop. Right: MASKED crop with bbox overlay.
  if (slot.cropCanvas) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(slot.cropCanvas, ox, oy + TILE_HEADER_H, subW, imgH);
    if (slot.maskedCanvas) {
      ctx.drawImage(slot.maskedCanvas, ox + subW + 1, oy + TILE_HEADER_H, subW, imgH);
    }
    ctx.imageSmoothingEnabled = true;
  } else {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(ox, oy + TILE_HEADER_H, TILE_W, imgH);
    ctx.fillStyle = '#475569';
    ctx.font = '10px monospace';
    ctx.fillText('(crop unavailable)', ox + 8, oy + TILE_HEADER_H + 16);
  }

  const labelY = oy + TILE_HEADER_H + imgH;
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(ox, labelY, TILE_W, TILE_LABEL_H);
  const top = slot.candidates[0];
  const second = slot.candidates[1];
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = top ? (slot.confident ? '#34d399' : '#fbbf24') : '#64748b';
  const shinyMark = top?.isShinyWinner ? '✨ ' : '';
  const headLabel = top
    ? `${slot.confident ? '🔒 ' : ''}${shinyMark}${top.species} ${Math.round((top.combined ?? 0) * 100)}%`
    : 'no match';
  ctx.fillText(headLabel.slice(0, 32), ox + 6, labelY + 14);
  ctx.font = '10px monospace';
  ctx.fillStyle = '#64748b';
  if (second) {
    ctx.fillText(
      `vs ${second.species} ${Math.round((second.combined ?? 0) * 100)}%`.slice(0, 32),
      ox + 6,
      labelY + 28,
    );
  }
  // Reprocess fallback row — when the constrained pass failed and we
  // reran unconstrained, show the second pass's pick. If it agrees
  // with the constrained pick, render in green (consistency confirms
  // the lock); if it disagrees, render in amber as a "potential
  // mismatch" signal.
  if (slot.reprocessed && slot.fallbackTop) {
    const fb = slot.fallbackTop;
    const same = top && fb.species === top.species;
    ctx.fillStyle = same ? '#86efac' : '#fbbf24';
    ctx.fillText(
      `↻ ${fb.species} ${Math.round((fb.combined ?? 0) * 100)}%`.slice(0, 32),
      ox + 6,
      labelY + 42,
    );
  } else if (slot.reprocessed) {
    ctx.fillStyle = '#475569';
    ctx.fillText('↻ no fallback', ox + 6, labelY + 42);
  } else {
    const third = slot.candidates[2];
    if (third) {
      ctx.fillText(
        `   ${third.species} ${Math.round((third.combined ?? 0) * 100)}%`.slice(0, 32),
        ox + 6,
        labelY + 42,
      );
    }
  }
  return tileH;
}

function buildSlotsFromCards(view, cards, panel, mode) {
  return cards.map(c => {
    const card = c.card;
    const sb = card.spriteBbox;
    const sx = Math.max(0, card.xStart + sb.x1);
    const sy = Math.max(0, card.yStart + sb.y1);
    const sw = Math.min(view.width - sx, sb.x2 - sb.x1);
    const sh = Math.min(view.height - sy, sb.y2 - sb.y1);
    let cropCanvas = null;
    let maskedCanvas = null;
    let bbox = null;
    if (sw > 4 && sh > 4) {
      // Raw crop
      cropCanvas = createCanvas(sw, sh);
      const cctx = cropCanvas.getContext('2d');
      const cropId = cctx.createImageData(sw, sh);
      const cropPix = new Uint8ClampedArray(sw * sh * 4);
      for (let y = 0; y < sh; y++) {
        const srcRow = ((sy + y) * view.width + sx) * 4;
        const dstRow = y * sw * 4;
        for (let x = 0; x < sw * 4; x++) {
          cropId.data[dstRow + x] = view.data[srcRow + x];
          cropPix[dstRow + x] = view.data[srcRow + x];
        }
      }
      cctx.putImageData(cropId, 0, 0);

      // Run the same masking the matcher uses, then bound + render
      const cardImg = { data: cropPix, width: sw, height: sh };
      const mask = extractSpriteMask(cardImg, panel, { mode });
      const bounds = findSpriteBounds(mask);
      maskedCanvas = createCanvas(sw, sh);
      const mctx = maskedCanvas.getContext('2d');
      const maskedId = mctx.createImageData(sw, sh);
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const i = y * sw + x;
          const di = i * 4;
          if (mask.data[i]) {
            // Foreground (chibi) — keep original RGBA.
            maskedId.data[di]     = cropPix[di];
            maskedId.data[di + 1] = cropPix[di + 1];
            maskedId.data[di + 2] = cropPix[di + 2];
            maskedId.data[di + 3] = 255;
          } else {
            // Background — checkerboard so we can SEE what was masked.
            const checker = ((x >> 3) ^ (y >> 3)) & 1;
            maskedId.data[di]     = checker ? 30 : 50;
            maskedId.data[di + 1] = checker ? 30 : 50;
            maskedId.data[di + 2] = checker ? 30 : 50;
            maskedId.data[di + 3] = 255;
          }
        }
      }
      mctx.putImageData(maskedId, 0, 0);
      // Draw the bbox the matcher would crop to.
      if (bounds) {
        bbox = bounds;
        mctx.strokeStyle = '#fbbf24';
        mctx.lineWidth = 1;
        mctx.strokeRect(
          bounds.minX + 0.5,
          bounds.minY + 0.5,
          Math.max(1, bounds.maxX - bounds.minX),
          Math.max(1, bounds.maxY - bounds.minY),
        );
      }
    }
    return {
      slotIndex: c.index,
      panel,
      sprite: { x: sx, y: sy, w: sw, h: sh },
      card: { x: card.xStart, y: card.yStart, w: card.xEnd - card.xStart, h: card.yEnd - card.yStart },
      cropCanvas,
      maskedCanvas,
      bbox,
      candidates: c.candidates,
      confident: c.isConfident,
      reprocessed: c.reprocessed,
      fallbackTop: c.fallbackTop,
      fallbackCandidates: c.fallbackCandidates,
    };
  });
}

const indexEntries = [];

for (const sample of rowsToRun) {
  const img = await loadImage(path.join(FRAMES_DIR, sample.file));
  const view = viewFromImage(img);

  // Find the session this lock frame belongs to, derive its selection
  // consensus, and pass that as constrained-matching hints. This is
  // how live `StreamCompanionPage.buildLockMatchHints` works — we just
  // do it offline against the session's selection frames.
  const session = findSessionForLock(sample.second);
  let hints = null;
  let hintSummary = '(no session — full DB)';
  if (session) {
    hints = await deriveSessionConsensus(session);
    hintSummary =
      `plr[${[...hints.playerSpecies].join('|') || '∅'}] / ` +
      `opp[${[...hints.opponentSpecies].join('|') || '∅'}]`;
  }

  const restrictMatching = hints
    ? {
        player: hints.playerSpecies.size > 0 ? hints.playerSpecies : undefined,
        opponent: hints.opponentSpecies.size > 0 ? hints.opponentSpecies : undefined,
      }
    : undefined;

  const result = detectPokemon(view, db, { matchPlayers: true, restrictMatching });

  if (!result.frame.isLineupScreen) {
    console.log(`  s${sample.second}s — frame detector REJECTED (mode=${result.frame.mode})`);
    continue;
  }
  if (result.frame.mode !== 'lock') {
    console.log(`  s${sample.second}s — frame mode=${result.frame.mode} (expected lock); rendering anyway`);
  }

  const maskMode = result.frame.mode === 'lock' ? 'lock' : 'selection';
  const playerSlots = buildSlotsFromCards(view, result.players, 'player', maskMode);
  const opponentSlots = buildSlotsFromCards(view, result.opponents, 'opponent', maskMode);

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

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, totalW, FRAME_HEADER_H);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(
    `LOCK f${sample.second}s   mode=${result.frame.mode}   ` +
    `frameConf=${result.frame.confidence.toFixed(2)}   ` +
    `opp=${result.opponents.length}/6 plr=${result.players.length}/6   ` +
    `hints=${restrictMatching ? 'YES' : 'no'}`,
    10,
    16,
  );
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px monospace';
  ctx.fillText(`pool: ${hintSummary}`.slice(0, 180), 10, 30);

  let y = FRAME_HEADER_H;

  ctx.fillStyle = '#0c4a6e';
  ctx.fillRect(0, y, totalW, PANEL_HEADER_H);
  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('◄ YOURS (player panel — lock-mode adaptive bg)', 10, y + 16);
  y += PANEL_HEADER_H;
  for (let i = 0; i < playerSlots.length; i++) {
    const slot = playerSlots[i];
    const ox = TILE_PAD + i * (TILE_W + TILE_PAD);
    drawTile(ctx, ox, y, slot, '#38bdf8');
  }
  y += playerRowH + TILE_PAD;

  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(0, y, totalW, PANEL_HEADER_H);
  ctx.fillStyle = '#fca5a5';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('OPPONENT panel ► (crimson bg)', 10, y + 16);
  y += PANEL_HEADER_H;
  for (let i = 0; i < opponentSlots.length; i++) {
    const slot = opponentSlots[i];
    const ox = TILE_PAD + i * (TILE_W + TILE_PAD);
    drawTile(ctx, ox, y, slot, '#f43f5e');
  }

  const fname = `lock-f${sample.second}s.png`;
  writeFileSync(path.join(OUT_DIR, fname), composite.toBuffer('image/png'));
  const summarize = (s) => {
    const top = s.candidates[0];
    const tag = top?.isShinyWinner ? '✨' : '';
    const species = top?.species ?? '—';
    if (s.reprocessed && s.fallbackTop) {
      const same = top && s.fallbackTop.species === top.species;
      return same
        ? `${tag}${species}*` // matched after reprocess (consistent)
        : `${tag}${species}↦${s.fallbackTop.species}`; // mismatch
    }
    return `${tag}${species}`;
  };
  const summary =
    `plr: ${playerSlots.map(summarize).join(' / ')}   opp: ${opponentSlots.map(summarize).join(' / ')}`;
  indexEntries.push({
    sec: sample.second,
    file: fname,
    summary,
    mode: result.frame.mode,
    hints: hintSummary,
    hadHints: !!restrictMatching,
  });
  console.log(`  s${sample.second}s [${result.frame.mode}] hints=${restrictMatching ? 'YES' : 'no'} → ${fname}`);
  console.log(`     ${summary}`);
}

const indexHtml =
  `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lock-screen crop diagnostics</title>` +
  `<style>body{background:#020617;color:#e2e8f0;font-family:ui-monospace,monospace;padding:24px;}` +
  `h2{color:#fca5a5;margin-top:32px;font-size:14px;}` +
  `.entry{margin-bottom:24px;}` +
  `.entry img{display:block;max-width:100%;border:1px solid #1e293b;}` +
  `.entry .meta{font-size:11px;color:#94a3b8;margin-top:6px;}` +
  `.entry .mode{font-size:10px;color:#fbbf24;}` +
  `</style></head><body>` +
  `<h1 style="font-size:18px;color:#fbbf24;">Lock-screen sprite-crop diagnostics — gameplay.mp4</h1>` +
  `<p style="color:#64748b;font-size:11px;">Lock-screen pipeline output. Player cards use adaptive per-card HSV background masking (each card's tint sampled from its corners). Opponent cards reuse the crimson selection-mode mask.</p>` +
  indexEntries
    .map(
      e => `<div class="entry"><h2>Frame ${e.sec}s <span class="mode">[${e.mode}] ${e.hadHints ? 'hints=YES' : 'hints=no'}</span></h2>` +
        `<img src="${e.file}" alt="${e.file}"/>` +
        `<div class="meta">${e.summary}</div>` +
        `<div class="meta" style="color:#475569;">pool: ${e.hints}</div></div>`,
    )
    .join('') +
  `</body></html>`;
writeFileSync(path.join(OUT_DIR, 'index.html'), indexHtml);

console.log(`\n${indexEntries.length} composite(s) written to ${OUT_DIR}/`);
console.log(`Open ${OUT_DIR}/index.html for a scrollable view.`);
