#!/usr/bin/env node
/**
 * Precompute dHash for all Champions Pokemon sprites.
 * Outputs JSON → src/data/spriteHashDB.json
 * Run: node scripts/generate-hash-db.mjs
 */

import { createCanvas, loadImage } from 'canvas';
import { writeFileSync } from 'fs';

// Champions roster — import species list
// Can't import TS directly, so we'll fetch from Showdown and hash all
const SHOWDOWN_SPRITE_URL = 'https://play.pokemonshowdown.com/sprites/ani/';
const SHOWDOWN_STATIC_URL = 'https://play.pokemonshowdown.com/sprites/gen5/';

// Full Champions roster (copy from championsRoster.ts)
import { readFileSync } from 'fs';
const rosterFile = readFileSync('src/data/championsRoster.ts', 'utf8');

// Extract species from the file
const speciesMatches = rosterFile.matchAll(/'([A-Z][a-zA-Z\-. ]+)'/g);
const allSpecies = [...new Set([...speciesMatches].map(m => m[1]))];

// Sprite ID conversion (matches sprites.ts logic)
const ALIASES = {
  'Kommo-o': 'kommoo', 'Hakamo-o': 'hakamoo', 'Jangmo-o': 'jangmoo',
  'Ho-Oh': 'hooh', 'Porygon-Z': 'porygonz',
  'Aegislash-Shield': 'aegislash', 'Aegislash-Blade': 'aegislash-blade',
  'Floette-Eternal': 'floette-eternal', 'Basculegion-F': 'basculegion-f',
  'Meowstic-F': 'meowstic-f',
  'Tauros-Paldea-Combat': 'tauros-paldeacombat',
  'Tauros-Paldea-Blaze': 'tauros-paldeablaze',
  'Tauros-Paldea-Aqua': 'tauros-paldeaaqua',
};

function speciesNameToId(name) {
  if (ALIASES[name]) return ALIASES[name];
  let id = name.toLowerCase();
  id = id.replace(/-mega-x$/, '-megax');
  id = id.replace(/-mega-y$/, '-megay');
  id = id.replace(/-mega-z$/, '-megaz');
  id = id.replace(/[^a-z0-9-]/g, '');
  id = id.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return id;
}

function computeDHash(imageData, width, height) {
  // Resize to 9x8 grayscale manually
  const gray = new Float64Array(9 * 8);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 9; x++) {
      const srcX = Math.floor(x * width / 9);
      const srcY = Math.floor(y * height / 8);
      const idx = (srcY * width + srcX) * 4;
      gray[y * 9 + x] = 0.299 * imageData[idx] + 0.587 * imageData[idx + 1] + 0.114 * imageData[idx + 2];
    }
  }

  // Compute 64-bit difference hash
  let hashHi = 0, hashLo = 0;
  let bit = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const idx = y * 9 + x;
      if (gray[idx] < gray[idx + 1]) {
        if (bit < 32) hashLo |= (1 << bit);
        else hashHi |= (1 << (bit - 32));
      }
      bit++;
    }
  }
  // Return as hex string (portable, no BigInt serialization issues)
  return (hashHi >>> 0).toString(16).padStart(8, '0') + (hashLo >>> 0).toString(16).padStart(8, '0');
}

async function main() {
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
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height).data;
        const hash = computeDHash(imageData, img.width, img.height);
        db.push({ species, hash });
        loaded++;
        success = true;
        break;
      } catch {
        continue;
      }
    }
    if (!success) {
      console.warn(`FAILED: ${species} (${id})`);
      failed++;
    }
  }

  // Sort alphabetically
  db.sort((a, b) => a.species.localeCompare(b.species));

  writeFileSync('src/data/spriteHashDB.json', JSON.stringify(db, null, 2));
  console.log(`\nDone: ${loaded} loaded, ${failed} failed, ${db.length} in DB`);
}

main().catch(console.error);
