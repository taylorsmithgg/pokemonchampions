import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

/**
 * Detection logic tests using reference screenshots.
 * Validates OCR detection against known game screens without live stream.
 *
 * Images:
 *  - images/lineup-selection-no-overlay.png — selection screen (no stream overlay)
 *  - images/lineup-selection-lock-overlay.png — lock / order phase (stream overlay)
 *  - images/lineup-selection-overlay.png — selection with stream overlay
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

    const detectedRegion = det.autoDetectGameWindow ? det.autoDetectGameWindow(canvas) : null;
    let frame = canvas;
    if (detectedRegion) {
      const sx = Math.round(canvas.width * detectedRegion.x);
      const sy = Math.round(canvas.height * detectedRegion.y);
      const sw = Math.round(canvas.width * detectedRegion.w);
      const sh = Math.round(canvas.height * detectedRegion.h);
      if (sw > 100 && sh > 100) {
        const cropped = document.createElement('canvas');
        cropped.width = sw;
        cropped.height = sh;
        cropped.getContext('2d')!.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        frame = cropped;
      }
    }

    const onnxReady = det.isModelReady ? det.isModelReady() : false;
    const result = await det.detectPokemonFromFrame(frame);
    return {
      onnxReady,
      detectedRegion,
      frameWidth: frame.width,
      frameHeight: frame.height,
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

  test('lineup-selection-no-overlay.png — detects species from left column', async ({ page }) => {
    const imgData = loadImageAsBase64('images/lineup-selection-no-overlay.png');
    const result = await runDetection(page, imgData);

    console.log('=== LINEUP DETECTION ===');
    console.log('ONNX model ready:', result.onnxReady);
    console.log('Detected region:', result.detectedRegion, 'frame:', result.frameWidth, 'x', result.frameHeight);
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

    const leftSprites = result.spriteMatched.filter(s => s.side === 'left').map(s => s.species);
    const rightSprites = result.spriteMatched.filter(s => s.side === 'right').map(s => s.species);
    console.log('Left sprites:', leftSprites);
    console.log('Right sprites:', rightSprites);

    expect([...leftSprites].sort()).toEqual([
      'Aegislash-Shield',
      'Delphox',
      'Floette-Eternal',
      'Garchomp',
      'Kingambit',
      'Primarina',
    ].sort());
    expect([...rightSprites].sort()).toEqual([
      'Hydreigon',
      'Primarina',
      'Scizor',
      'Slowking-Galar',
      'Toucannon',
      'Victreebel',
    ].sort());
    expect(result.matched.every(m => m.method !== 'panel')).toBeTruthy();
  });

  test('lineup-selection-lock-overlay.png — detects slot species from sprites', async ({ page }) => {
    const imgData = loadImageAsBase64('images/lineup-selection-lock-overlay.png');
    const result = await runDetection(page, imgData);

    console.log('=== LINEUP DETECTION (LOCK) ===');
    console.log('Detected region:', result.detectedRegion, 'frame:', result.frameWidth, 'x', result.frameHeight);
    console.log('Screen context:', result.screenContext, '—', result.screenContextDebug);
    console.log('Selection progress:', `${result.selectionCount}/${result.selectionTarget}`, 'hover row:', result.hoveredRowIndex);
    console.log('Sprite matches:', result.spriteMatched);

    expect(result.screenContext).toBe('battle');

    const leftSprites = result.spriteMatched.filter(s => s.side === 'left').map(s => s.species);
    const rightSprites = result.spriteMatched.filter(s => s.side === 'right').map(s => s.species);
    expect([...leftSprites].sort()).toEqual([
      'Arcanine-Hisui',
      'Bellibolt',
      'Froslass',
      'Kingambit',
      'Kommo-o',
      'Ninetales-Alola',
    ].sort());
    expect([...rightSprites].sort()).toEqual([
      'Archaludon',
      'Meowscarada',
      'Sableye',
      'Starmie',
      'Sneasler',
      'Talonflame',
    ].sort());
    expect(result.matched.every(m => m.method !== 'panel')).toBeTruthy();
  });

  test('lineup-selection-overlay.png — detects slot species from sprites', async ({ page }) => {
    const imgData = loadImageAsBase64('images/lineup-selection-overlay.png');
    const result = await runDetection(page, imgData);

    expect(result.screenContext).toBe('battle');
    const leftSprites = result.spriteMatched.filter(s => s.side === 'left').map(s => s.species);
    const rightSprites = result.spriteMatched.filter(s => s.side === 'right').map(s => s.species);
    expect([...leftSprites].sort()).toEqual([
      'Aerodactyl',
      'Appletun',
      'Gallade',
      'Goodra',
      'Heliolisk',
      'Weavile',
    ].sort());
    expect([...rightSprites].sort()).toEqual([
      'Aegislash-Shield',
      'Delphox',
      'Garchomp',
      'Lucario',
      'Lycanroc',
      'Rotom-Wash',
    ].sort());
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
