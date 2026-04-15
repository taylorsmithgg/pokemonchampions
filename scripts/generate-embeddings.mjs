#!/usr/bin/env node
/**
 * Generate MobileNetV2 feature embeddings for all Champions sprites.
 * Outputs JSON → src/data/spriteEmbeddings.json
 * Run: node scripts/generate-embeddings.mjs
 */

import * as ort from 'onnxruntime-node';
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync, readFileSync } from 'fs';

const MODEL_PATH = 'public/models/mobilenetv2-7.onnx';
const SHOWDOWN_SPRITE_URL = 'https://play.pokemonshowdown.com/sprites/ani/';
const SHOWDOWN_STATIC_URL = 'https://play.pokemonshowdown.com/sprites/gen5/';

// Species + sprite ID mapping (same as generate-hash-db.mjs)
const ALIASES = {
  'Kommo-o': 'kommoo', 'Hakamo-o': 'hakamoo', 'Jangmo-o': 'jangmoo',
  'Ho-Oh': 'hooh', 'Porygon-Z': 'porygonz',
  'Aegislash-Shield': 'aegislash', 'Floette-Eternal': 'floette-eternal',
  'Basculegion-F': 'basculegion-f', 'Meowstic-F': 'meowstic-f',
  'Tauros-Paldea-Combat': 'tauros-paldeacombat',
  'Tauros-Paldea-Blaze': 'tauros-paldeablaze',
  'Tauros-Paldea-Aqua': 'tauros-paldeaaqua',
};

function speciesNameToId(name) {
  if (ALIASES[name]) return ALIASES[name];
  let id = name.toLowerCase();
  id = id.replace(/-mega-x$/, '-megax').replace(/-mega-y$/, '-megay').replace(/-mega-z$/, '-megaz');
  id = id.replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return id;
}

// Extract species from roster
const rosterFile = readFileSync('src/data/championsRoster.ts', 'utf8');
const speciesMatches = rosterFile.matchAll(/'([A-Z][a-zA-Z\-. ]+)'/g);
const allRaw = [...new Set([...speciesMatches].map(m => m[1]))];
// Filter to actual Pokemon (not regions, items, etc)
const SKIP = new Set(['Kanto','Johto','Hoenn','Sinnoh','Unova','Kalos','Alola','Galar','Paldea','II','III','IV','VI','VII','VIII','IX']);
const allSpecies = allRaw.filter(s => !SKIP.has(s) && !s.endsWith('ite') && !s.endsWith('ite X') && !s.endsWith('ite Y') && s.length > 2);

async function preprocessImage(img) {
  // Resize to 224×224 and normalize for MobileNetV2
  const canvas = createCanvas(224, 224);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080'; // neutral gray bg for transparent sprites
  ctx.fillRect(0, 0, 224, 224);
  // Center the sprite
  const scale = Math.min(224 / img.width, 224 / img.height) * 0.8;
  const sw = img.width * scale, sh = img.height * scale;
  ctx.drawImage(img, (224 - sw) / 2, (224 - sh) / 2, sw, sh);

  const imageData = ctx.getImageData(0, 0, 224, 224).data;
  const float32 = new Float32Array(3 * 224 * 224);

  // NCHW format, ImageNet normalization
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  for (let i = 0; i < 224 * 224; i++) {
    float32[i] = (imageData[i * 4] / 255 - mean[0]) / std[0];             // R
    float32[224 * 224 + i] = (imageData[i * 4 + 1] / 255 - mean[1]) / std[1]; // G
    float32[2 * 224 * 224 + i] = (imageData[i * 4 + 2] / 255 - mean[2]) / std[2]; // B
  }
  return new ort.Tensor('float32', float32, [1, 3, 224, 224]);
}

async function main() {
  console.log('Loading MobileNetV2...');
  const session = await ort.InferenceSession.create(MODEL_PATH);
  console.log('Model loaded. Input:', session.inputNames, 'Output:', session.outputNames);

  const db = [];
  let loaded = 0, failed = 0;

  for (const species of allSpecies) {
    const id = speciesNameToId(species);
    const urls = [
      `${SHOWDOWN_SPRITE_URL}${id}.gif`,
      `${SHOWDOWN_STATIC_URL}${id}.png`,
    ];

    let success = false;
    for (const url of urls) {
      try {
        const img = await loadImage(url);
        const tensor = await preprocessImage(img);
        const results = await session.run({ [session.inputNames[0]]: tensor });
        // Get the output — this is the 1000-class logits. Use as embedding.
        const output = results[session.outputNames[0]];
        const embedding = Array.from(output.data).map(v => Math.round(v * 1000) / 1000); // truncate precision
        db.push({ species, embedding });
        loaded++;
        success = true;
        if (loaded % 20 === 0) console.log(`  ${loaded}/${allSpecies.length}...`);
        break;
      } catch {
        continue;
      }
    }
    if (!success) {
      console.warn(`FAILED: ${species}`);
      failed++;
    }
  }

  db.sort((a, b) => a.species.localeCompare(b.species));
  writeFileSync('src/data/spriteEmbeddings.json', JSON.stringify(db));
  console.log(`\nDone: ${loaded} loaded, ${failed} failed`);
  const sizeMB = (JSON.stringify(db).length / 1024 / 1024).toFixed(1);
  console.log(`File size: ${sizeMB} MB`);
}

main().catch(console.error);
