#!/usr/bin/env node

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'training', 'sprite-classifier', 'config', 'review-targets.json');
const outputRoot = path.join(repoRoot, 'training', 'sprite-classifier', 'dataset', 'review-targets');

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sanitize(value) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
}

async function exportCrop(imageSpec, slot) {
  const imagePath = path.join(repoRoot, imageSpec.path);
  const img = await loadImage(imagePath);

  const sx = Math.max(0, Math.round(img.width * slot.crop.x));
  const sy = Math.max(0, Math.round(img.height * slot.crop.y));
  const sw = Math.max(16, Math.round(img.width * slot.crop.w));
  const sh = Math.max(16, Math.round(img.height * slot.crop.h));
  const cropW = Math.min(sw, img.width - sx);
  const cropH = Math.min(sh, img.height - sy);

  const canvas = createCanvas(cropW, cropH);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH);

  const speciesDir = path.join(outputRoot, sanitize(slot.species));
  mkdirp(speciesDir);

  const fileName = `${imageSpec.key}-${slot.side}-slot-${slot.slotIndex + 1}.png`;
  const filePath = path.join(speciesDir, fileName);
  fs.writeFileSync(filePath, canvas.toBuffer('image/png'));

  return {
    imageKey: imageSpec.key,
    imagePath: imageSpec.path,
    side: slot.side,
    slotIndex: slot.slotIndex,
    species: slot.species,
    crop: slot.crop,
    outputPath: path.relative(repoRoot, filePath),
  };
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  mkdirp(outputRoot);

  const examples = [];
  for (const imageSpec of manifest.images) {
    for (const slot of imageSpec.slots) {
      const example = await exportCrop(imageSpec, slot);
      examples.push(example);
    }
  }

  const datasetManifest = {
    generatedAt: new Date().toISOString(),
    sourceManifest: path.relative(repoRoot, manifestPath),
    exampleCount: examples.length,
    examples,
  };

  fs.writeFileSync(
    path.join(outputRoot, 'manifest.json'),
    JSON.stringify(datasetManifest, null, 2),
  );

  const summary = [
    '# Review Target Crop Export',
    '',
    `Generated: ${datasetManifest.generatedAt}`,
    `Examples: ${datasetManifest.exampleCount}`,
    '',
    '## Labels',
    ...[...new Set(examples.map(example => example.species))]
      .sort((a, b) => a.localeCompare(b))
      .map(species => `- ${species}`),
    '',
  ];

  fs.writeFileSync(path.join(outputRoot, 'README.md'), `${summary.join('\n')}\n`);
  console.log(`Exported ${examples.length} crops to ${outputRoot}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
