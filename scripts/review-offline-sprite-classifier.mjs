#!/usr/bin/env node

import * as ort from 'onnxruntime-node';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const CLASSIFIER_PATH = path.join(repoRoot, 'src', 'data', 'offlineSpriteClassifier.json');
const REVIEW_TARGETS = path.join(repoRoot, 'training', 'sprite-classifier', 'config', 'review-targets.json');
const MODEL_PATH = path.join(repoRoot, 'public', 'models', 'mobilenetv2-features.onnx');
const OUTPUT_DIR = path.join(repoRoot, 'artifacts', 'offline-sprite-classifier-review');

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function l2Normalize(vector) {
  let sumSq = 0;
  for (const value of vector) sumSq += value * value;
  const norm = Math.sqrt(sumSq) || 1;
  return vector.map(value => value / norm);
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

function preprocessCanvas(canvas) {
  const resized = createCanvas(224, 224);
  const ctx = resized.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 224, 224);
  const scale = Math.min(224 / canvas.width, 224 / canvas.height) * 0.9;
  const sw = canvas.width * scale;
  const sh = canvas.height * scale;
  ctx.drawImage(canvas, (224 - sw) / 2, (224 - sh) / 2, sw, sh);
  const imageData = ctx.getImageData(0, 0, 224, 224).data;
  const float32 = new Float32Array(3 * 224 * 224);
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  for (let i = 0; i < 224 * 224; i++) {
    float32[i] = (imageData[i * 4] / 255 - mean[0]) / std[0];
    float32[224 * 224 + i] = (imageData[i * 4 + 1] / 255 - mean[1]) / std[1];
    float32[2 * 224 * 224 + i] = (imageData[i * 4 + 2] / 255 - mean[2]) / std[2];
  }
  return new ort.Tensor('float32', float32, [1, 3, 224, 224]);
}

async function extractFeatures(session, canvas) {
  const tensor = preprocessCanvas(canvas);
  const results = await session.run({ [session.inputNames[0]]: tensor });
  const output = results[session.outputNames[0]];
  return l2Normalize(Array.from(output.data));
}

function rank(feature, centroids, topN = 3) {
  return centroids
    .map(entry => ({
      species: entry.species,
      similarity: cosineSimilarity(feature, entry.centroid),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);
}

async function cropSlot(imagePath, crop) {
  const img = await loadImage(imagePath);
  const sx = Math.max(0, Math.round(img.width * crop.x));
  const sy = Math.max(0, Math.round(img.height * crop.y));
  const sw = Math.max(16, Math.round(img.width * crop.w));
  const sh = Math.max(16, Math.round(img.height * crop.h));
  const cropW = Math.min(sw, img.width - sx);
  const cropH = Math.min(sh, img.height - sy);
  const canvas = createCanvas(cropW, cropH);
  canvas.getContext('2d').drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
  return canvas;
}

async function main() {
  if (!fs.existsSync(CLASSIFIER_PATH)) {
    throw new Error('Missing classifier export. Run `npm run train:sprite-classifier` first.');
  }

  const classifier = JSON.parse(fs.readFileSync(CLASSIFIER_PATH, 'utf8'));
  const reviewTargets = JSON.parse(fs.readFileSync(REVIEW_TARGETS, 'utf8'));
  const session = await ort.InferenceSession.create(MODEL_PATH);
  mkdirp(OUTPUT_DIR);

  const reviews = [];
  let totalExact = 0;
  let totalTop3 = 0;
  let totalSlots = 0;

  for (const imageSpec of reviewTargets.images) {
    const slots = [];
    for (const slot of imageSpec.slots) {
      const canvas = await cropSlot(path.join(repoRoot, imageSpec.path), slot.crop);
      const feature = await extractFeatures(session, canvas);
      const topMatches = rank(feature, classifier.centroids, 3);
      const assigned = topMatches[0]?.species ?? null;
      const hitTop1 = assigned === slot.species;
      const hitTop3 = topMatches.some(match => match.species === slot.species);
      if (hitTop1) totalExact++;
      if (hitTop3) totalTop3++;
      totalSlots++;
      slots.push({
        side: slot.side,
        slotIndex: slot.slotIndex,
        expectedSpecies: slot.species,
        assignedSpecies: assigned,
        hitTop1,
        hitTop3,
        topMatches,
      });
    }

    const review = {
      key: imageSpec.key,
      image: imageSpec.path,
      exactMatches: slots.filter(slot => slot.hitTop1).length,
      top3Matches: slots.filter(slot => slot.hitTop3).length,
      slotCount: slots.length,
      slots,
    };
    reviews.push(review);
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${imageSpec.key}.json`),
      JSON.stringify(review, null, 2),
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    classifierPath: path.relative(repoRoot, CLASSIFIER_PATH),
    exactMatches: totalExact,
    top3Matches: totalTop3,
    slotCount: totalSlots,
    exactAccuracy: totalSlots ? totalExact / totalSlots : 0,
    top3Accuracy: totalSlots ? totalTop3 / totalSlots : 0,
    reviews,
  };

  const summaryLines = [
    '# Offline Sprite Classifier Review',
    '',
    `Generated: ${report.generatedAt}`,
    `Classifier: \`${report.classifierPath}\``,
    `Exact matches: ${report.exactMatches}/${report.slotCount}`,
    `Top-3 matches: ${report.top3Matches}/${report.slotCount}`,
    '',
  ];

  for (const review of reviews) {
    summaryLines.push(`## ${review.key}`);
    summaryLines.push('');
    summaryLines.push(`- Exact matches: ${review.exactMatches}/${review.slotCount}`);
    summaryLines.push(`- Top-3 matches: ${review.top3Matches}/${review.slotCount}`);
    summaryLines.push('');
    for (const slot of review.slots) {
      const top = slot.topMatches
        .map(match => `${match.species} (${(match.similarity * 100).toFixed(1)}%)`)
        .join(', ');
      summaryLines.push(
        `- slot ${slot.slotIndex + 1} ${slot.side}: expected \`${slot.expectedSpecies}\`, assigned \`${slot.assignedSpecies}\` | ${slot.hitTop1 ? 'exact' : 'miss'} | top-3: ${top}`,
      );
    }
    summaryLines.push('');
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.md'), `${summaryLines.join('\n')}\n`);

  console.log(`Wrote offline classifier review to ${OUTPUT_DIR}`);
  console.log(`Exact matches: ${report.exactMatches}/${report.slotCount}`);
  console.log(`Top-3 matches: ${report.top3Matches}/${report.slotCount}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
