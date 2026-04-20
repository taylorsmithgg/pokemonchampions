#!/usr/bin/env node
/** Quick probe: dump the raw valley detection output per panel. */

import { createCanvas, loadImage } from 'canvas';
import { pathToFileURL } from 'url';
import { join } from 'path';

async function load(p) {
  return import(pathToFileURL(join(process.cwd(), p)).href);
}

const { toHsv } = await load('src/utils/spriteDetector/image.ts');
const { morphOpen, morphClose } = await load('src/utils/spriteDetector/morphology.ts');

function crimsonMask(hsv, xLo, xHi) {
  const { h, s, v, width } = hsv;
  const rw = xHi - xLo;
  const data = new Uint8Array(rw * hsv.height);
  for (let y = 0; y < hsv.height; y++) {
    for (let x = 0; x < rw; x++) {
      const si = y * width + xLo + x;
      const H = h[si], S = s[si], V = v[si];
      if (H >= 155 && H <= 179 && S >= 80 && V >= 25 && V <= 160) data[y * rw + x] = 255;
    }
  }
  return { data, width: rw, height: hsv.height };
}

function rowDensity(mask) {
  const { data, width, height } = mask;
  const out = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) if (data[y * width + x]) sum++;
    out[y] = sum / width;
  }
  return out;
}

function smooth(signal, win) {
  const n = signal.length, out = new Float32Array(n), half = Math.floor(win / 2);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let k = Math.max(0, i - half); k <= Math.min(n - 1, i + half); k++) { s += signal[k]; c++; }
    out[i] = s / Math.max(1, c);
  }
  return out;
}

const path = process.argv[2] || 'images/lineup-selection-no-overlay.png';
const img = await loadImage(path);
const canvas = createCanvas(img.width, img.height);
canvas.getContext('2d').drawImage(img, 0, 0);
const id = canvas.getContext('2d').getImageData(0, 0, img.width, img.height);
const view = { data: id.data, width: id.width, height: id.height };
const hsv = toHsv(view);

const xLo = Math.floor(view.width * 0.65);
const xHi = Math.floor(view.width * 1.0);
let mask = crimsonMask(hsv, xLo, xHi);
mask = morphClose(mask, 5);
mask = morphOpen(mask, 5);

const density = rowDensity(mask);
const sm = smooth(density, 7);

// Dump density signal in rough text form
console.log(`mask ${mask.width}×${mask.height}, frame ${view.width}×${view.height}`);
const stride = Math.max(1, Math.floor(sm.length / 120));
let row = '';
for (let y = 0; y < sm.length; y += stride) {
  const bar = '#'.repeat(Math.min(40, Math.round(sm[y] * 40)));
  row += `y=${y.toString().padStart(4)} ${sm[y].toFixed(2)} ${bar}\n`;
}
console.log(row);

// Find valleys manually
const searchRadius = 15;
const valleys = [];
for (let y = searchRadius; y < sm.length - searchRadius; y++) {
  let lo = Infinity;
  for (let k = y - searchRadius; k <= y + searchRadius; k++) if (sm[k] < lo) lo = sm[k];
  if (sm[y] > lo + 0.01) continue;
  let lp = 0;
  for (let k = Math.max(0, y - 50); k < y; k++) if (sm[k] > lp) lp = sm[k];
  let rp = 0;
  for (let k = y; k < Math.min(sm.length, y + 50); k++) if (sm[k] > rp) rp = sm[k];
  const drop = Math.min(lp, rp) - sm[y];
  if (drop > 0.12) valleys.push({ y, drop, density: sm[y] });
}
console.log('\nRaw valleys (before dedup):');
for (const v of valleys) console.log(`  y=${v.y}  drop=${v.drop.toFixed(3)}  val=${v.density.toFixed(3)}`);
