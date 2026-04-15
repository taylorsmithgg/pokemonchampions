import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

/**
 * Detection logic tests using reference screenshots.
 * Validates OCR detection against known game screens without live stream.
 *
 * Images:
 *  - images/lineup-selection.png — team select screen with nicknames
 *  - images/win-loss-screen.png — results screen with WON!/LOST
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadImageAsBase64(relPath: string): string {
  const abs = path.resolve(__dirname, '..', relPath);
  const buf = fs.readFileSync(abs);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

/** Wait for OCR worker to initialize via window.__ocrDetection */
async function initOcr(page: import('@playwright/test').Page) {
  // Wait for __ocrDetection to be available (async import in dev mode)
  await page.waitForFunction(() => !!(window as any).__ocrDetection, { timeout: 10000 });
  await page.evaluate(async () => {
    const det = (window as any).__ocrDetection;
    await det.initOcrWorker();
    // Wait for OCR worker
    let retries = 0;
    while (!det.isOcrReady() && retries < 60) {
      await new Promise(r => setTimeout(r, 500));
      retries++;
    }
    if (!det.isOcrReady()) throw new Error('OCR worker failed to load after 30s');
    // Wait for ONNX model (takes longer — up to 30s for WASM)
    retries = 0;
    while (!det.isModelReady() && retries < 60) {
      await new Promise(r => setTimeout(r, 500));
      retries++;
    }
    if (!det.isModelReady()) console.warn('ONNX model not loaded — sprite matching disabled');
  });
}

/** Load image data URL and run detectPokemonFromFrame in browser context */
async function runDetection(page: import('@playwright/test').Page, dataUrl: string) {
  return page.evaluate(async (imgDataUrl: string) => {
    const det = (window as any).__ocrDetection;

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = imgDataUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);

    const onnxReady = det.isModelReady ? det.isModelReady() : false;
    const result = await det.detectPokemonFromFrame(canvas);
    return {
      onnxReady,
      rawText: result.rawText as string,
      species: result.species as string[],
      hoveredRowIndex: result.hoveredRowIndex as number | null,
      selectionCount: result.selectionCount as number | null,
      selectionTarget: result.selectionTarget as number | null,
      matched: (result.matched as any[]).map((m: any) => ({
        species: m.species, confidence: m.confidence, side: m.side, method: m.method, token: m.token,
      })),
      screenContext: result.screenContext as string,
      screenContextDebug: result.screenContextDebug as string,
      matchResult: result.matchResult as string | null,
      matchResultDebug: result.matchResultDebug as string,
      battleLogMatches: result.battleLogMatches as any[],
      spriteMatched: (result.spriteMatched as any[]).map((s: any) => ({
        species: s.species, confidence: s.confidence, side: s.side, x: s.x, y: s.y,
      })),
    };
  }, dataUrl);
}

test.describe('Detection Reference Images', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/stream');
    await page.waitForLoadState('networkidle');
    await initOcr(page);
  });

  test('lineup-selection.png — detects species from left column', async ({ page }) => {
    const imgData = loadImageAsBase64('images/lineup-selection.png');
    const result = await runDetection(page, imgData);

    console.log('=== LINEUP DETECTION ===');
    console.log('ONNX model ready:', result.onnxReady);
    console.log('Screen context:', result.screenContext, '—', result.screenContextDebug);
    console.log('Raw OCR text (first 500):', result.rawText.slice(0, 500));
    console.log('Detected species:', result.species);
    console.log('Selection progress:', `${result.selectionCount}/${result.selectionTarget}`, 'hover row:', result.hoveredRowIndex);
    console.log('Sprite matches:', result.spriteMatched.length);
    for (const s of result.spriteMatched) {
      console.log(`  ${s.side} ${s.species} ${(s.confidence * 100).toFixed(0)}%`);
    }
    console.log('OCR panel matches:', result.matched.length);
    for (const m of result.matched) {
      console.log(`  ${m.side} ${m.species} ${m.method} ${(m.confidence * 100).toFixed(0)}%`);
    }

    // Selection screen should be battle context (keywords: select, ranked, single)
    expect(result.screenContext).toBe('battle');
    expect(result.selectionTarget).toBe(3);
    expect(result.selectionCount).toBe(0);
    expect(result.hoveredRowIndex).toBe(3);

    // Left column shows NICKNAMES: LUCKY GIRL, Floette, Delphox, Primarina, Kingambit, Monado
    // OCR can only match species names that happen to equal the displayed nickname.
    // Floette → Floette-Eternal (via alias), Primarina = exact match.
    // Delphox, Kingambit may or may not be read depending on OCR accuracy.
    const knownPossible = ['Primarina', 'Floette-Eternal', 'Delphox', 'Kingambit'];
    const foundSpecies = knownPossible.filter(s => result.species.includes(s));
    console.log('Known species found:', foundSpecies, `(${foundSpecies.length}/${knownPossible.length})`);

    // At least 1 species should be detected (Primarina is most reliable)
    expect(foundSpecies.length).toBeGreaterThanOrEqual(1);

    // Left-column species should be assigned to 'left' side
    const leftMatches = result.matched.filter(m => m.side === 'left');
    console.log('Left-side matches:', leftMatches.map(m => m.species));
    expect(leftMatches.length).toBeGreaterThan(0);
  });

  test('win-loss-screen.png — detects WON on left half', async ({ page }) => {
    const imgData = loadImageAsBase64('images/win-loss-screen.png');
    const result = await runDetection(page, imgData);

    console.log('=== WIN/LOSS DETECTION ===');
    console.log('Raw OCR text (first 500):', result.rawText.slice(0, 500));
    console.log('Match result:', result.matchResult);
    console.log('Debug:', result.matchResultDebug);

    // Should detect "WON!" on left half → win
    expect(result.matchResult).toBe('win');
    expect(result.matchResultDebug).toContain('LEFT');
  });
});
