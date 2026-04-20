import { SELECTION_REFERENCE_SEEDS } from '../data/selectionReferenceCatalog';

interface SeedTemplate {
  species: string;
  templateData: Uint8ClampedArray;
}

export interface SeedMatch {
  species: string;
  score: number;
  confidence: number;
}

let _seedTemplates: SeedTemplate[] | null = null;
let _seedLoading: Promise<SeedTemplate[]> | null = null;

function templateMatchScore(regionData: Uint8ClampedArray, template: Uint8ClampedArray): number {
  const len = Math.min(regionData.length, template.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  let validPixels = 0;

  for (let i = 0; i < len; i += 4) {
    const ta = template[i + 3];
    if (ta < 128) continue;

    const rr = regionData[i];
    const rg = regionData[i + 1];
    const rb = regionData[i + 2];
    const tr = template[i];
    const tg = template[i + 1];
    const tb = template[i + 2];

    if (rr < 15 && rg < 15 && rb < 15) continue;

    dotProduct += rr * tr + rg * tg + rb * tb;
    normA += rr * rr + rg * rg + rb * rb;
    normB += tr * tr + tg * tg + tb * tb;
    validPixels++;
  }

  if (validPixels < 20 || normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function toTemplateCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, width, height, 0, 0, 32, 32);
  return canvas;
}

async function loadSeedTemplates(): Promise<SeedTemplate[]> {
  if (_seedTemplates) return _seedTemplates;
  if (_seedLoading) return _seedLoading;

  _seedLoading = Promise.all(
    SELECTION_REFERENCE_SEEDS.map(seed => new Promise<SeedTemplate | null>(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          const sx = Math.max(0, Math.round(img.width * seed.region.x));
          const sy = Math.max(0, Math.round(img.height * seed.region.y));
          const sw = Math.max(16, Math.round(img.width * seed.region.w));
          const sh = Math.max(16, Math.round(img.height * seed.region.h));
          const tmp = document.createElement('canvas');
          tmp.width = sw;
          tmp.height = sh;
          tmp.getContext('2d')!.drawImage(
            img,
            sx,
            sy,
            Math.min(sw, img.width - sx),
            Math.min(sh, img.height - sy),
            0,
            0,
            sw,
            sh,
          );
          const templateCanvas = toTemplateCanvas(tmp, sw, sh);
          const templateData = templateCanvas.getContext('2d')!.getImageData(0, 0, 32, 32).data;
          resolve({ species: seed.species, templateData });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = seed.imageUrl;
    })),
  ).then(results => {
    _seedTemplates = results.filter((entry): entry is SeedTemplate => entry !== null);
    return _seedTemplates;
  });

  return _seedLoading;
}

export async function rankCanvasWithSelectionSeeds(
  canvas: HTMLCanvasElement,
  topN = 5,
): Promise<SeedMatch[]> {
  const templates = await loadSeedTemplates();
  if (templates.length === 0) return [];

  const scaled = toTemplateCanvas(canvas, canvas.width, canvas.height);
  const regionData = scaled.getContext('2d')!.getImageData(0, 0, 32, 32).data;
  const bestBySpecies = new Map<string, number>();

  for (const template of templates) {
    const score = templateMatchScore(regionData, template.templateData);
    const existing = bestBySpecies.get(template.species) ?? -1;
    if (score > existing) bestBySpecies.set(template.species, score);
  }

  return [...bestBySpecies.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([species, score]) => ({
      species,
      score,
      confidence: Math.max(0, Math.min(1, (score - 0.72) / 0.2)),
    }))
    .filter(match => match.score >= 0.7);
}
