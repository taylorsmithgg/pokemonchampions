import classifierData from '../data/offlineSpriteClassifier.json';
import baseEmbeddingsData from '../data/spriteEmbeddings.json';
import {
  extractCanvasFeatures,
  rankFeaturesAgainstEmbeddings,
  type OnnxMatch,
  type RefEmbedding,
} from './onnxMatcher';

interface OfflineClassifierData {
  version: number;
  type: string;
  backbone: string;
  modelPath: string;
  inputSize: number;
  embeddingSize: number;
  classCount: number;
  centroids: Array<{
    species: string;
    centroid: number[];
    sampleCount: number;
  }>;
}

const offlineClassifier = classifierData as OfflineClassifierData;
const trainedRefs: RefEmbedding[] = offlineClassifier.centroids.map(entry => ({
  species: entry.species,
  embedding: entry.centroid,
}));
const baseRefs = baseEmbeddingsData as RefEmbedding[];
const mergedRefsBySpecies = new Map<string, RefEmbedding>();

for (const ref of baseRefs) {
  mergedRefsBySpecies.set(ref.species, ref);
}
for (const ref of trainedRefs) {
  mergedRefsBySpecies.set(ref.species, ref);
}

const refs: RefEmbedding[] = [...mergedRefsBySpecies.values()];

export function getOfflineSpriteClassifierMetadata() {
  return {
    version: offlineClassifier.version,
    type: offlineClassifier.type,
    backbone: offlineClassifier.backbone,
    classCount: refs.length,
    trainedClassCount: trainedRefs.length,
    inputSize: offlineClassifier.inputSize,
  };
}

export function hasOfflineSpriteClassifier(): boolean {
  return refs.length > 0;
}

export async function rankCanvasWithOfflineSpriteClassifier(
  canvas: HTMLCanvasElement,
  topN = 5,
  minSimilarity = 0.3,
): Promise<OnnxMatch[]> {
  if (refs.length === 0) return [];
  const features = await extractCanvasFeatures(canvas);
  if (!features) return [];
  return rankFeaturesAgainstEmbeddings(features, refs, topN, minSimilarity).map(match => ({
    ...match,
    confidence: Math.max(0, Math.min(1, (match.similarity - minSimilarity) / Math.max(0.05, 1 - minSimilarity))),
  }));
}
