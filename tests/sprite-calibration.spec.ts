import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadImageAsBase64(relPath: string): string {
  const abs = path.resolve(__dirname, '..', relPath);
  const buf = fs.readFileSync(abs);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

test.describe('Sprite Calibration', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/stream');
    await page.waitForLoadState('networkidle');
  });

  test('lineup-selection-no-overlay.png — manual crop test + pHash diagnostic', async ({ page }) => {
    const imgData = loadImageAsBase64('images/lineup-selection-no-overlay.png');

    // Wait for __pHash to be available (loaded async on page load)
    await page.waitForFunction(() => !!(window as any).__pHash, { timeout: 10000 });

    const result = await page.evaluate(async (dataUrl: string) => {
      const pHash = (window as any).__pHash;
      if (!pHash) throw new Error('__pHash not available');
      const { loadHashDB, computeDHash, hammingDistance } = pHash;
      const hashDB = loadHashDB();

      // Load image
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = dataUrl;
      });
      const canvas = document.createElement('canvas');
      const w = canvas.width = img.naturalWidth;
      const h = canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);

      // Test multiple region alignments to find best positions
      // Right column opponent sprites — try different x offsets and widths
      const regions: { label: string; x: number; y: number; rw: number; rh: number; side: string }[] = [];

      // Left column icons — current alignment
      for (let i = 0; i < 6; i++) {
        regions.push({
          label: `L${i + 1}`,
          x: w * 0.01, y: h * (0.08 + i * 0.145),
          rw: w * 0.06, rh: h * 0.11,
          side: 'left',
        });
      }

      // Right column — try wider region covering full sprite area
      for (let i = 0; i < 6; i++) {
        regions.push({
          label: `R${i + 1}`,
          x: w * 0.80, y: h * (0.04 + i * 0.135),
          rw: w * 0.12, rh: h * 0.13,
          side: 'right',
        });
      }

      // Right column — narrower, just the sprite body
      for (let i = 0; i < 6; i++) {
        regions.push({
          label: `RN${i + 1}`,
          x: w * 0.84, y: h * (0.05 + i * 0.135),
          rw: w * 0.08, rh: h * 0.10,
          side: 'right',
        });
      }

      // For each region, compute hash and find best 3 matches (no distance filter)
      const results: { label: string; side: string; xPct: string; yPct: string; best: { species: string; distance: number }[] }[] = [];

      for (const reg of regions) {
        const crop = document.createElement('canvas');
        crop.width = Math.round(reg.rw);
        crop.height = Math.round(reg.rh);
        const ctx = crop.getContext('2d')!;
        ctx.drawImage(canvas, Math.round(reg.x), Math.round(reg.y), crop.width, crop.height, 0, 0, crop.width, crop.height);

        const regionHash = computeDHash(crop);

        // Find top 3 closest matches (no threshold)
        const scores: { species: string; distance: number }[] = [];
        for (const ref of hashDB) {
          const dist = hammingDistance(regionHash, ref.hash);
          scores.push({ species: ref.species, distance: dist });
        }
        scores.sort((a: any, b: any) => a.distance - b.distance);

        results.push({
          label: reg.label,
          side: reg.side,
          xPct: ((reg.x / w) * 100).toFixed(1),
          yPct: ((reg.y / h) * 100).toFixed(1),
          best: scores.slice(0, 3),
        });
      }

      return { w, h, results };
    }, imgData);

    console.log(`Image: ${result.w}×${result.h}`);
    console.log('=== PHASH DISTANCE DIAGNOSTIC (no threshold) ===');
    console.log('Threshold=10 means only distances ≤10 match. Check if correct species are close.');
    console.log('');
    // Known left team: slot1=? (LUCKY GIRL), slot2=Floette, slot3=Delphox, slot4=Primarina, slot5=Kingambit, slot6=? (Monado)
    const knownLeft = ['?', 'Floette', 'Delphox', 'Primarina', 'Kingambit', '?'];
    for (const r of result.results) {
      const known = r.side === 'left' ? knownLeft[parseInt(r.label.slice(1)) - 1] : '?';
      const top3 = r.best.map((b: any) => `${b.species}(${b.distance})`).join(', ');
      console.log(`${r.label} [${r.side}] at (${r.xPct}%,${r.yPct}%) expected=${known}`);
      console.log(`   → ${top3}`);
    }
  });
});
