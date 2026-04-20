#!/usr/bin/env node

import * as ort from 'onnxruntime-node';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const DATASET_MANIFEST = path.join(
  repoRoot,
  'training',
  'sprite-classifier',
  'dataset',
  'review-targets',
  'manifest.json',
);
const MODEL_PATH = path.join(repoRoot, 'public', 'models', 'mobilenetv2-features.onnx');
const OUTPUT_JSON = path.join(repoRoot, 'src', 'data', 'offlineSpriteClassifier.json');
const OUTPUT_SUMMARY = path.join(
  repoRoot,
  'training',
  'sprite-classifier',
  'artifacts',
  'offline-sprite-classifier-summary.json',
);

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function l2Normalize(vector) {
  let sumSq = 0;
  for (const value of vector) sumSq += value * value;
  const norm = Math.sqrt(sumSq) || 1;
  return vector.map(value => value / norm);
}

function meanVectors(vectors) {
  if (vectors.length === 0) return [];
  const out = new Array(vectors[0].length).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < out.length; i++) {
      out[i] += vector[i];
    }
  }
  for (let i = 0; i < out.length; i++) {
    out[i] /= vectors.length;
  }
  return out;
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

function applyImageAdjustments(imageData, options) {
  const { brightness = 1, contrast = 1 } = options;
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const centered = (data[i + c] - 128) * contrast + 128;
      data[i + c] = Math.max(0, Math.min(255, centered * brightness));
    }
  }
  return imageData;
}

function buildAugmentedVariants(sourceCanvas) {
  const presets = [
    { key: 'base', scale: 1.0, dx: 0, dy: 0, brightness: 1.0, contrast: 1.0, downscale: null },
    { key: 'left-shift', scale: 0.95, dx: -6, dy: 0, brightness: 1.0, contrast: 1.0, downscale: null },
    { key: 'right-shift', scale: 0.95, dx: 6, dy: 0, brightness: 1.0, contrast: 1.0, downscale: null },
    { key: 'bright', scale: 1.0, dx: 0, dy: 0, brightness: 1.08, contrast: 1.04, downscale: null },
    { key: 'dark', scale: 1.0, dx: 0, dy: 0, brightness: 0.9, contrast: 0.96, downscale: null },
    { key: 'compressed', scale: 0.92, dx: 0, dy: 0, brightness: 1.0, contrast: 1.0, downscale: 96 },
    { key: 'soft', scale: 0.88, dx: 0, dy: 0, brightness: 1.0, contrast: 1.0, downscale: 72 },
  ];

  return presets.map(preset => {
    const canvas = createCanvas(sourceCanvas.width, sourceCanvas.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawW = sourceCanvas.width * preset.scale;
    const drawH = sourceCanvas.height * preset.scale;
    const dx = (canvas.width - drawW) / 2 + preset.dx;
    const dy = (canvas.height - drawH) / 2 + preset.dy;
    ctx.drawImage(sourceCanvas, dx, dy, drawW, drawH);

    if (preset.downscale) {
      const temp = createCanvas(preset.downscale, preset.downscale);
      const tctx = temp.getContext('2d');
      tctx.drawImage(canvas, 0, 0, preset.downscale, preset.downscale);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(temp, 0, 0, canvas.width, canvas.height);
    }

    const adjusted = applyImageAdjustments(
      ctx.getImageData(0, 0, canvas.width, canvas.height),
      preset,
    );
    ctx.putImageData(adjusted, 0, 0);
    return { key: preset.key, canvas };
  });
}

async function extractFeatures(session, canvas) {
  const tensor = preprocessCanvas(canvas);
  const results = await session.run({ [session.inputNames[0]]: tensor });
  const output = results[session.outputNames[0]];
  return l2Normalize(Array.from(output.data));
}

async function loadExampleCanvas(example) {
  const img = await loadImage(path.join(repoRoot, example.outputPath));
  const canvas = createCanvas(img.width, img.height);
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas;
}

function rankAgainstCentroids(feature, centroids, topN = 3) {
  return centroids
    .map(entry => ({
      species: entry.species,
      similarity: cosineSimilarity(feature, entry.centroid),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);
}

async function main() {
  if (!fs.existsSync(DATASET_MANIFEST)) {
    throw new Error('Dataset manifest missing. Run `npm run dataset:export-review-crops` first.');
  }

  const dataset = JSON.parse(fs.readFileSync(DATASET_MANIFEST, 'utf8'));
  const session = await ort.InferenceSession.create(MODEL_PATH);
  const bySpecies = new Map();
  const evaluationExamples = [];

  for (const example of dataset.examples) {
    const baseCanvas = await loadExampleCanvas(example);
    const variants = buildAugmentedVariants(baseCanvas);

    for (const variant of variants) {
      const feature = await extractFeatures(session, variant.canvas);
      if (!bySpecies.has(example.species)) bySpecies.set(example.species, []);
      bySpecies.get(example.species).push(feature);

      if (variant.key === 'base') {
        evaluationExamples.push({
          species: example.species,
          outputPath: example.outputPath,
          feature,
        });
      }
    }
  }

  const centroids = [...bySpecies.entries()]
    .map(([species, vectors]) => ({
      species,
      centroid: l2Normalize(meanVectors(vectors)),
      sampleCount: vectors.length,
    }))
    .sort((a, b) => a.species.localeCompare(b.species));

  let top1Correct = 0;
  let top3Correct = 0;
  const evaluation = evaluationExamples.map(example => {
    const topMatches = rankAgainstCentroids(example.feature, centroids, 3);
    const top1 = topMatches[0]?.species ?? null;
    const hitTop1 = top1 === example.species;
    const hitTop3 = topMatches.some(match => match.species === example.species);
    if (hitTop1) top1Correct++;
    if (hitTop3) top3Correct++;
    return {
      species: example.species,
      outputPath: example.outputPath,
      top1,
      topMatches,
      hitTop1,
      hitTop3,
    };
  });

  const classifier = {
    version: 1,
    type: 'prototype-centroid',
    backbone: 'mobilenetv2-features',
    modelPath: 'models/mobilenetv2-features.onnx',
    inputSize: 224,
    embeddingSize: centroids[0]?.centroid.length ?? 0,
    classCount: centroids.length,
    sourceDataset: path.relative(repoRoot, DATASET_MANIFEST),
    augmentationVariantsPerExample: 7,
    centroids,
    metrics: {
      evaluationExampleCount: evaluationExamples.length,
      top1Accuracy: evaluationExamples.length ? top1Correct / evaluationExamples.length : 0,
      top3Accuracy: evaluationExamples.length ? top3Correct / evaluationExamples.length : 0,
    },
  };

  const summary = {
    generatedAt: new Date().toISOString(),
    classifier,
    evaluation,
  };

  ensureDir(OUTPUT_JSON);
  ensureDir(OUTPUT_SUMMARY);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(classifier, null, 2));
  fs.writeFileSync(OUTPUT_SUMMARY, JSON.stringify(summary, null, 2));

  console.log(`Wrote classifier centroids to ${path.relative(repoRoot, OUTPUT_JSON)}`);
  console.log(
    `Top-1 accuracy on seed crops: ${(classifier.metrics.top1Accuracy * 100).toFixed(1)}% (${top1Correct}/${evaluationExamples.length})`,
  );
  console.log(
    `Top-3 accuracy on seed crops: ${(classifier.metrics.top3Accuracy * 100).toFixed(1)}% (${top3Correct}/${evaluationExamples.length})`,
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
