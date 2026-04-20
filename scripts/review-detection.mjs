import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'artifacts', 'detection-review');

const reviewTargets = [
  {
    key: 'lineup-selection-no-overlay',
    relativePath: 'images/lineup-selection-no-overlay.png',
    expected: {
      left: [
        'Garchomp',
        'Floette-Eternal',
        'Delphox',
        'Primarina',
        'Kingambit',
        'Aegislash-Shield',
      ],
      right: [
        'Victreebel',
        'Hydreigon',
        'Toucannon',
        'Primarina',
        'Slowking-Galar',
        'Scizor',
      ],
    },
  },
  {
    key: 'lineup-selection-lock-overlay',
    relativePath: 'images/lineup-selection-lock-overlay.png',
    expected: {
      left: [
        'Bellibolt',
        'Froslass',
        'Ninetales-Alola',
        'Kingambit',
        'Arcanine-Hisui',
        'Kommo-o',
      ],
      right: [
        'Starmie',
        'Talonflame',
        'Sneasler',
        'Sableye',
        'Meowscarada',
        'Archaludon',
      ],
    },
  },
  {
    key: 'lineup-selection-overlay',
    relativePath: 'images/lineup-selection-overlay.png',
    expected: {
      left: [
        'Weavile',
        'Aerodactyl',
        'Gallade',
        'Appletun',
        'Goodra',
        'Heliolisk',
      ],
      right: [
        'Rotom-Wash',
        'Aegislash-Shield',
        'Lycanroc',
        'Lucario',
        'Garchomp',
        'Delphox',
      ],
    },
  },
];

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
      // Try the next candidate.
    }
  }

  throw new Error(
    'No dev server found. Start `npm run dev` first or set DETECTION_REVIEW_BASE_URL.',
  );
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
    if (!det.isOcrReady()) {
      throw new Error('OCR worker failed to load after 30s');
    }

    retries = 0;
    while (!det.isModelReady() && retries < 60) {
      await new Promise(resolve => setTimeout(resolve, 500));
      retries++;
    }
  });
}

async function runDetection(page, imageDataUrl) {
  const runInPage = () => page.evaluate(async (imgDataUrl) => {
    const det = window.__ocrDetection;

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imgDataUrl;
    });

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = img.naturalWidth;
    sourceCanvas.height = img.naturalHeight;
    sourceCanvas.getContext('2d').drawImage(img, 0, 0);

    const detectedRegion = det.autoDetectGameWindow ? det.autoDetectGameWindow(sourceCanvas) : null;
    let frame = sourceCanvas;
    if (detectedRegion) {
      const sx = Math.round(sourceCanvas.width * detectedRegion.x);
      const sy = Math.round(sourceCanvas.height * detectedRegion.y);
      const sw = Math.round(sourceCanvas.width * detectedRegion.w);
      const sh = Math.round(sourceCanvas.height * detectedRegion.h);
      if (sw > 100 && sh > 100) {
        const cropped = document.createElement('canvas');
        cropped.width = sw;
        cropped.height = sh;
        cropped.getContext('2d').drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
        frame = cropped;
      }
    }

    const result = await det.detectPokemonFromFrame(frame);
    const selectionSlots = [...result.selectionSlots]
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map(slot => ({ ...slot }));

    if (det.rankCanvasWithOfflineSpriteClassifier) {
      for (const slot of selectionSlots) {
        const slotCanvas = document.createElement('canvas');
        slotCanvas.width = Math.max(1, Math.round(slot.w));
        slotCanvas.height = Math.max(1, Math.round(slot.h));
        slotCanvas.getContext('2d').drawImage(
          frame,
          Math.round(slot.x),
          Math.round(slot.y),
          slotCanvas.width,
          slotCanvas.height,
          0,
          0,
          slotCanvas.width,
          slotCanvas.height,
        );
        slot.offlineTopMatches = await det.rankCanvasWithOfflineSpriteClassifier(slotCanvas, 3, 0.2);
      }
    }

    const annotated = document.createElement('canvas');
    annotated.width = frame.width;
    annotated.height = frame.height;
    const ctx = annotated.getContext('2d');
    ctx.drawImage(frame, 0, 0);
    ctx.font = 'bold 14px system-ui';
    ctx.textBaseline = 'top';

    for (const slot of selectionSlots) {
      const color = slot.side === 'left' ? '#38bdf8' : '#f97316';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);

      const top = slot.candidates[0];
      const label = `#${slot.slotIndex + 1} ${slot.assignedSpecies ?? 'none'}${top ? ` | top:${top.species} ${Math.round(top.confidence * 100)}%` : ''}`;
      const textWidth = ctx.measureText(label).width + 8;
      const labelY = Math.max(0, slot.y - 18);
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(slot.x, labelY, textWidth, 18);
      ctx.fillStyle = color;
      ctx.fillText(label, slot.x + 4, labelY + 2);
    }

    return {
      detectedRegion,
      frameWidth: frame.width,
      frameHeight: frame.height,
      screenContext: result.screenContext,
      screenContextDebug: result.screenContextDebug,
      selectionCount: result.selectionCount,
      selectionTarget: result.selectionTarget,
      spriteMatched: result.spriteMatched,
      selectionSlots,
      annotatedDataUrl: annotated.toDataURL('image/png'),
    };
  }, imageDataUrl);

  try {
    return await runInPage();
  } catch (error) {
    if (!String(error).includes('Execution context was destroyed')) throw error;
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !!window.__ocrDetection, { timeout: 10000 });
    return runInPage();
  }
}

function decodeDataUrl(dataUrl) {
  const [, base64] = dataUrl.split(',');
  return Buffer.from(base64, 'base64');
}

function summarizeSide(slots, expected) {
  const detected = slots.map(slot => slot.assignedSpecies);
  const exactMatches = expected.filter((species, index) => detected[index] === species).length;
  const topCandidateMatches = expected.filter((species, index) => slots[index]?.candidates?.[0]?.species === species).length;
  return { detected, exactMatches, topCandidateMatches };
}

function formatSlotLine(slot, expectedSpecies) {
  const assigned = slot.assignedSpecies ?? 'none';
  const assignedConfidence = slot.assignedConfidence == null ? '-' : `${Math.round(slot.assignedConfidence * 100)}%`;
  const candidates = slot.candidates
    .slice(0, 3)
    .map(candidate => `${candidate.species} (${Math.round(candidate.confidence * 100)}%, score ${candidate.score.toFixed(2)})`)
    .join(', ');
  const offline = (slot.offlineTopMatches ?? [])
    .slice(0, 3)
    .map(match => `${match.species} (${Math.round(match.confidence * 100)}%, sim ${match.similarity.toFixed(2)})`)
    .join(', ');
  const matchLabel = assigned === expectedSpecies ? 'exact' : 'miss';
  return `- slot ${slot.slotIndex + 1}: expected \`${expectedSpecies}\`, assigned \`${assigned}\` (${assignedConfidence}) [${matchLabel}] | top candidates: ${candidates}${offline ? ` | offline classifier: ${offline}` : ''}`;
}

async function main() {
  const baseUrl = await resolveBaseUrl();
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${baseUrl}/#/stream`);
    await page.waitForLoadState('networkidle');
    await initDetector(page);

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      reviews: [],
    };

    for (const target of reviewTargets) {
      const result = await runDetection(page, loadImageAsBase64(target.relativePath));
      const leftSlots = result.selectionSlots.filter(slot => slot.side === 'left');
      const rightSlots = result.selectionSlots.filter(slot => slot.side === 'right');
      const leftSummary = summarizeSide(leftSlots, target.expected.left);
      const rightSummary = summarizeSide(rightSlots, target.expected.right);

      fs.writeFileSync(
        path.join(outputDir, `${target.key}.png`),
        decodeDataUrl(result.annotatedDataUrl),
      );

      const review = {
        key: target.key,
        image: target.relativePath,
        screenContext: result.screenContext,
        screenContextDebug: result.screenContextDebug,
        frame: {
          width: result.frameWidth,
          height: result.frameHeight,
          detectedRegion: result.detectedRegion,
        },
        selectionCount: result.selectionCount,
        selectionTarget: result.selectionTarget,
        expected: target.expected,
        detected: {
          left: leftSummary.detected,
          right: rightSummary.detected,
        },
        exactMatches: {
          left: leftSummary.exactMatches,
          right: rightSummary.exactMatches,
          total: leftSummary.exactMatches + rightSummary.exactMatches,
          max: 12,
        },
        topCandidateMatches: {
          left: leftSummary.topCandidateMatches,
          right: rightSummary.topCandidateMatches,
          total: leftSummary.topCandidateMatches + rightSummary.topCandidateMatches,
          max: 12,
        },
        selectionSlots: result.selectionSlots,
      };

      report.reviews.push(review);
      fs.writeFileSync(
        path.join(outputDir, `${target.key}.json`),
        JSON.stringify(review, null, 2),
      );
    }

    const summaryLines = [
      '# Detection Review',
      '',
      `Generated: ${report.generatedAt}`,
      `Base URL: ${report.baseUrl}`,
      '',
    ];

    for (const review of report.reviews) {
      summaryLines.push(`## ${review.key}`);
      summaryLines.push('');
      summaryLines.push(`- Image: \`${review.image}\``);
      summaryLines.push(`- Screen context: \`${review.screenContext}\` (${review.screenContextDebug})`);
      summaryLines.push(`- Exact assigned matches: ${review.exactMatches.total}/${review.exactMatches.max}`);
      summaryLines.push(`- Top-candidate matches: ${review.topCandidateMatches.total}/${review.topCandidateMatches.max}`);
      summaryLines.push(`- Selection progress: ${review.selectionCount ?? '-'} / ${review.selectionTarget ?? '-'}`);
      summaryLines.push(`- Annotated image: \`${review.key}.png\``);
      summaryLines.push(`- JSON detail: \`${review.key}.json\``);
      summaryLines.push('');
      summaryLines.push('### Left Slots');
      summaryLines.push(...review.selectionSlots.filter(slot => slot.side === 'left').map((slot, index) =>
        formatSlotLine(slot, review.expected.left[index]),
      ));
      summaryLines.push('');
      summaryLines.push('### Right Slots');
      summaryLines.push(...review.selectionSlots.filter(slot => slot.side === 'right').map((slot, index) =>
        formatSlotLine(slot, review.expected.right[index]),
      ));
      summaryLines.push('');
    }

    fs.writeFileSync(
      path.join(outputDir, 'summary.md'),
      `${summaryLines.join('\n')}\n`,
    );
    fs.writeFileSync(
      path.join(outputDir, 'report.json'),
      JSON.stringify(report, null, 2),
    );

    console.log(`Wrote detection review to ${outputDir}`);
    for (const review of report.reviews) {
      console.log(
        `${review.key}: exact ${review.exactMatches.total}/${review.exactMatches.max}, top-candidate ${review.topCandidateMatches.total}/${review.topCandidateMatches.max}`,
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
