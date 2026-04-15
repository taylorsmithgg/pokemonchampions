// ─── ONNX-based Pokemon Sprite Classifier ──────────────────────
//
// Uses MobileNetV2 feature embeddings for sprite classification.
// Reference embeddings precomputed from Showdown sprites (shipped as JSON).
// At runtime: extract features from captured region → cosine similarity
// → nearest neighbor = species ID.
//
// Neural features bridge the 2D↔3D gap better than pixel hashing.

import * as ort from 'onnxruntime-web';
import embeddingsData from '../data/spriteEmbeddings.json';

// ─── Model + Reference Embeddings ───────────────────────────────

let _session: ort.InferenceSession | null = null;
let _loading = false;

interface RefEmbedding {
  species: string;
  embedding: number[];
}

const _refEmbeddings: RefEmbedding[] = embeddingsData as RefEmbedding[];

export function isModelReady(): boolean { return _session !== null; }

export async function loadModel(): Promise<void> {
  if (_session || _loading) return;
  _loading = true;
  try {
    // Use WASM backend (works everywhere, no WebGL quirks)
    ort.env.wasm.numThreads = 1;
    const modelUrl = import.meta.env.BASE_URL + 'models/mobilenetv2-features.onnx';
    _session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ['wasm'],
    });
    console.log(`[ONNX] MobileNetV2 loaded. ${_refEmbeddings.length} reference embeddings ready.`);
  } catch (e) {
    console.warn('[ONNX] Failed to load model:', e);
  } finally {
    _loading = false;
  }
}

// ─── Feature Extraction ─────────────────────────────────────────

function preprocessCanvas(canvas: HTMLCanvasElement): ort.Tensor {
  // Resize to 224×224, normalize for ImageNet
  const resized = document.createElement('canvas');
  resized.width = 224;
  resized.height = 224;
  const ctx = resized.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 224, 224);
  const scale = Math.min(224 / canvas.width, 224 / canvas.height) * 0.9;
  const sw = canvas.width * scale, sh = canvas.height * scale;
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

async function extractFeatures(canvas: HTMLCanvasElement): Promise<number[] | null> {
  if (!_session) return null;
  try {
    const tensor = preprocessCanvas(canvas);
    const results = await _session.run({ [_session.inputNames[0]]: tensor });
    const output = results[_session.outputNames[0]];
    return Array.from(output.data as Float32Array);
  } catch {
    return null;
  }
}

// ─── Cosine Similarity Matching ─────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

export interface OnnxMatch {
  species: string;
  similarity: number;
  confidence: number;
}

export function rankEmbeddingMatches(features: number[], topN = 5, minSimilarity = 0.5): OnnxMatch[] {
  const scores = _refEmbeddings.map(ref => ({
    species: ref.species,
    similarity: cosineSimilarity(features, ref.embedding),
  }));
  scores.sort((a, b) => b.similarity - a.similarity);

  return scores
    .filter(score => score.similarity >= minSimilarity)
    .slice(0, topN)
    .map(score => ({
      species: score.species,
      similarity: score.similarity,
      confidence: Math.max(0, Math.min(1, (score.similarity - 0.5) / 0.35)),
    }));
}

export function matchEmbedding(features: number[], topN = 1, minSimilarity = 0.6): OnnxMatch[] {
  const ranked = rankEmbeddingMatches(features, Math.max(2, topN), minSimilarity);
  // Gap check: top match must be clearly better than runner-up
  const top = ranked[0];
  const second = ranked[1];
  if (!top || top.similarity < minSimilarity) return [];
  const gap = second ? top.similarity - second.similarity : 0.5;
  // Reject if gap is too small (ambiguous — could be noise)
  if (gap < 0.02) return [];

  return [{
    species: top.species,
    similarity: top.similarity,
    // Confidence from similarity + gap. 0.6→low, 0.85+→high
    confidence: Math.max(0, Math.min(1, (top.similarity - 0.5) / 0.35 * (1 + gap * 3))),
  }];
}

export async function matchCanvasWithOnnx(
  canvas: HTMLCanvasElement,
  topN = 5,
  minSimilarity = 0.5,
): Promise<OnnxMatch[]> {
  const features = await extractFeatures(canvas);
  if (!features) return [];
  return rankEmbeddingMatches(features, topN, minSimilarity);
}

// ─── Region Scan ────────────────────────────────────────────────

export interface OnnxSpriteMatch {
  species: string;
  confidence: number;
  similarity: number;
  x: number;
  y: number;
  side: 'left' | 'right';
}

export async function scanRegionsWithOnnx(
  canvas: HTMLCanvasElement,
  regions: { x: number; y: number; w: number; h: number; side: 'left' | 'right' }[],
): Promise<OnnxSpriteMatch[]> {
  if (!_session) return [];
  const results: OnnxSpriteMatch[] = [];
  const seen = new Set<string>();
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  for (const region of regions) {
    const rw = Math.round(region.w), rh = Math.round(region.h);
    if (rw < 16 || rh < 16) continue;

    // Crop region
    const crop = document.createElement('canvas');
    crop.width = rw; crop.height = rh;
    crop.getContext('2d')!.drawImage(canvas, Math.round(region.x), Math.round(region.y), rw, rh, 0, 0, rw, rh);

    const features = await extractFeatures(crop);
    if (!features) continue;

    const matches = matchEmbedding(features, 1, 0.6);
    for (const m of matches) {
      if (!seen.has(m.species)) {
        seen.add(m.species);
        results.push({
          species: m.species,
          confidence: m.confidence,
          similarity: m.similarity,
          x: region.x,
          y: region.y,
          side: region.side,
        });
      }
    }
  }

  return results;
}
