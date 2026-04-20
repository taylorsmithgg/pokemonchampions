#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'artifacts', 'selection-layout-review');
const targetConfigPath = path.join(
  repoRoot,
  'training',
  'sprite-classifier',
  'config',
  'review-targets.json',
);

function loadImageAsBase64(relativePath) {
  const abs = path.resolve(repoRoot, relativePath);
  const buf = fs.readFileSync(abs);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

async function resolveBaseUrl() {
  const candidates = [
    process.env.DETECTION_REVIEW_BASE_URL,
    'http://localhost:5174/pokemonchampions/',
    'http://localhost:5173/pokemonchampions/',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const normalized = candidate.endsWith('/') ? candidate : `${candidate}/`;
      const res = await fetch(normalized, { redirect: 'manual' });
      if (res.status >= 200 && res.status < 400) {
        return normalized.replace(/\/$/, '');
      }
    } catch {
      // Try next.
    }
  }

  throw new Error('No dev server found. Start `npm run dev` first.');
}

async function initDetector(page) {
  await page.waitForFunction(() => !!window.__ocrDetection, { timeout: 10000 });
  await page.evaluate(async () => {
    const det = window.__ocrDetection;
    await det.initOcrWorker();
    let retries = 0;
    while (!det.isOcrReady() && retries < 60) {
      await new Promise(resolve => setTimeout(resolve, 500));
      retries++;
    }
  });
}

async function runDetection(page, imageDataUrl) {
  const evaluateDetection = () => page.evaluate(async (imgDataUrl) => {
    const det = window.__ocrDetection;
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imgDataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);

    const result = await det.detectPokemonFromFrame(canvas);
    return {
      frameWidth: canvas.width,
      frameHeight: canvas.height,
      selectionSlots: result.selectionSlots.map(slot => ({
        slotIndex: slot.slotIndex,
        side: slot.side,
        x: slot.x / canvas.width,
        y: slot.y / canvas.height,
        w: slot.w / canvas.width,
        h: slot.h / canvas.height,
        assignedSpecies: slot.assignedSpecies,
      })),
    };
  }, imageDataUrl);

  try {
    return await evaluateDetection();
  } catch (error) {
    const message = String(error?.message ?? error);
    if (!message.includes('Execution context was destroyed')) throw error;
    await page.waitForLoadState('networkidle');
    await initDetector(page);
    return evaluateDetection();
  }
}

function iou(a, b) {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

async function main() {
  const baseUrl = await resolveBaseUrl();
  const targets = JSON.parse(fs.readFileSync(targetConfigPath, 'utf8')).images;
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${baseUrl}/#/stream`);
    await page.waitForLoadState('networkidle');
    await initDetector(page);

    const reviews = [];
    for (const target of targets) {
      const detection = await runDetection(page, loadImageAsBase64(target.path));
      const slots = target.slots.map(expected => {
        const detected = detection.selectionSlots.find(slot => slot.slotIndex === expected.slotIndex);
        return {
          slotIndex: expected.slotIndex,
          side: expected.side,
          expectedSpecies: expected.species,
          expectedCrop: expected.crop,
          detectedCrop: detected ?? null,
          iou: detected ? iou(expected.crop, detected) : 0,
          assignedSpecies: detected?.assignedSpecies ?? null,
        };
      });

      reviews.push({
        key: target.key,
        image: target.path,
        averageIoU: slots.reduce((sum, slot) => sum + slot.iou, 0) / Math.max(1, slots.length),
        slots,
      });
    }

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      reviews,
    };

    const lines = [
      '# Selection Layout Review',
      '',
      `Generated: ${report.generatedAt}`,
      '',
    ];

    for (const review of reviews) {
      lines.push(`## ${review.key}`);
      lines.push('');
      lines.push(`- Average IoU: ${review.averageIoU.toFixed(3)}`);
      lines.push('');
      for (const slot of review.slots) {
        lines.push(
          `- slot ${slot.slotIndex + 1} ${slot.side}: expected \`${slot.expectedSpecies}\`, assigned \`${slot.assignedSpecies ?? 'none'}\`, IoU ${slot.iou.toFixed(3)}`,
        );
      }
      lines.push('');
    }

    fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(outputDir, 'summary.md'), `${lines.join('\n')}\n`);
    console.log(`Wrote selection layout review to ${outputDir}`);
    for (const review of reviews) {
      console.log(`${review.key}: average IoU ${review.averageIoU.toFixed(3)}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
