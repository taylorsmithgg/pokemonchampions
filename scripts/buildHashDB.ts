#!/usr/bin/env node
/**
 * Build perceptual hash database from Bulbapedia Champions menu sprites.
 *
 * Downloads ~320 sprites named "Menu CP XXXX.png" from Bulbapedia's archive,
 * maps each to a species name via National Dex number, computes a 64-bit dHash,
 * and outputs src/data/spriteHashDB.json.
 *
 * Usage:
 *   npx tsx scripts/buildHashDB.ts
 *
 * Requires: canvas (already in devDependencies)
 */

import { createCanvas, loadImage, type Canvas } from 'canvas';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const OUTPUT_PATH = join(PROJECT_ROOT, 'src/data/spriteHashDB.json');
const CACHE_DIR = join(PROJECT_ROOT, '.sprite-cache');

// ─── National Dex → Species mapping ──────────────────────────────────
// Only includes species that appear in Champions (from championsRoster.ts).
// Base forms use just the dex number; alternate forms use "XXXX-Suffix".

const DEX_TO_SPECIES: Record<string, string> = {
  // Gen 1
  '0003': 'Venusaur',
  '0006': 'Charizard',
  '0009': 'Blastoise',
  '0015': 'Beedrill',
  '0018': 'Pidgeot',
  '0024': 'Arbok',
  '0025': 'Pikachu',
  '0026': 'Raichu',
  '0036': 'Clefable',
  '0038': 'Ninetales',
  '0059': 'Arcanine',
  '0065': 'Alakazam',
  '0068': 'Machamp',
  '0071': 'Victreebel',
  '0080': 'Slowbro',
  '0094': 'Gengar',
  '0115': 'Kangaskhan',
  '0121': 'Starmie',
  '0127': 'Pinsir',
  '0128': 'Tauros',
  '0130': 'Gyarados',
  '0132': 'Ditto',
  '0134': 'Vaporeon',
  '0135': 'Jolteon',
  '0136': 'Flareon',
  '0142': 'Aerodactyl',
  '0143': 'Snorlax',
  '0149': 'Dragonite',

  // Gen 2
  '0154': 'Meganium',
  '0157': 'Typhlosion',
  '0160': 'Feraligatr',
  '0168': 'Ariados',
  '0181': 'Ampharos',
  '0184': 'Azumarill',
  '0186': 'Politoed',
  '0196': 'Espeon',
  '0197': 'Umbreon',
  '0199': 'Slowking',
  '0205': 'Forretress',
  '0208': 'Steelix',
  '0212': 'Scizor',
  '0214': 'Heracross',
  '0227': 'Skarmory',
  '0229': 'Houndoom',
  '0248': 'Tyranitar',

  // Gen 3
  '0279': 'Pelipper',
  '0282': 'Gardevoir',
  '0302': 'Sableye',
  '0306': 'Aggron',
  '0308': 'Medicham',
  '0310': 'Manectric',
  '0319': 'Sharpedo',
  '0323': 'Camerupt',
  '0324': 'Torkoal',
  '0334': 'Altaria',
  '0350': 'Milotic',
  '0351': 'Castform',
  '0354': 'Banette',
  '0358': 'Chimecho',
  '0359': 'Absol',
  '0362': 'Glalie',

  // Gen 4
  '0389': 'Torterra',
  '0392': 'Infernape',
  '0395': 'Empoleon',
  '0405': 'Luxray',
  '0407': 'Roserade',
  '0409': 'Rampardos',
  '0411': 'Bastiodon',
  '0428': 'Lopunny',
  '0442': 'Spiritomb',
  '0445': 'Garchomp',
  '0448': 'Lucario',
  '0450': 'Hippowdon',
  '0454': 'Toxicroak',
  '0460': 'Abomasnow',
  '0461': 'Weavile',
  '0464': 'Rhyperior',
  '0470': 'Leafeon',
  '0471': 'Glaceon',
  '0472': 'Gliscor',
  '0473': 'Mamoswine',
  '0475': 'Gallade',
  '0478': 'Froslass',
  '0479': 'Rotom',

  // Gen 5
  '0497': 'Serperior',
  '0500': 'Emboar',
  '0503': 'Samurott',
  '0505': 'Watchog',
  '0510': 'Liepard',
  '0512': 'Simisage',
  '0514': 'Simisear',
  '0516': 'Simipour',
  '0530': 'Excadrill',
  '0531': 'Audino',
  '0534': 'Conkeldurr',
  '0547': 'Whimsicott',
  '0553': 'Krookodile',
  '0563': 'Cofagrigus',
  '0569': 'Garbodor',
  '0571': 'Zoroark',
  '0579': 'Reuniclus',
  '0584': 'Vanilluxe',
  '0587': 'Emolga',
  '0609': 'Chandelure',
  '0614': 'Beartic',
  '0618': 'Stunfisk',
  '0623': 'Golurk',
  '0635': 'Hydreigon',
  '0637': 'Volcarona',

  // Gen 6
  '0652': 'Chesnaught',
  '0655': 'Delphox',
  '0658': 'Greninja',
  '0660': 'Diggersby',
  '0663': 'Talonflame',
  '0666': 'Vivillon',
  '0670': 'Floette-Eternal',  // Special: we only want Eternal form, mapped via 0670-Eternal below
  '0671': 'Florges',
  '0676': 'Furfrou',
  '0678': 'Meowstic',
  '0679': 'Honedge',  // Not in roster — will be filtered
  '0681': 'Aegislash-Shield',
  '0686': 'Inkay',    // Not in roster — will be filtered
  '0689': 'Barbaracle', // Not in roster — will be filtered
  '0700': 'Sylveon',
  '0701': 'Hawlucha',
  '0702': 'Dedenne',
  '0706': 'Goodra',
  '0707': 'Klefki',
  '0708': 'Phantump', // Not in roster — will be filtered
  '0709': 'Trevenant',
  '0710': 'Pumpkaboo', // Not in roster — will be filtered
  '0711': 'Gourgeist',
  '0713': 'Avalugg',
  '0715': 'Noivern',
  '0683': 'Aromatisse',
  '0684': 'Swirlix',  // Not in roster
  '0685': 'Slurpuff',
  '0693': 'Clawitzer',
  '0695': 'Heliolisk',
  '0697': 'Tyrantrum',
  '0699': 'Aurorus',
  '0673': 'Pangoro',

  // Gen 7
  '0724': 'Decidueye',
  '0727': 'Incineroar',
  '0730': 'Primarina',
  '0733': 'Toucannon',
  '0740': 'Crabominable',
  '0745': 'Lycanroc',
  '0748': 'Toxapex',
  '0750': 'Mudsdale',
  '0752': 'Araquanid',
  '0758': 'Salazzle',
  '0763': 'Tsareena',
  '0765': 'Oranguru',
  '0766': 'Passimian',
  '0778': 'Mimikyu',
  '0780': 'Drampa',
  '0784': 'Kommo-o',

  // Gen 8
  '0823': 'Corviknight',
  '0841': 'Flapple',
  '0842': 'Appletun',
  '0844': 'Sandaconda',
  '0855': 'Polteageist',
  '0858': 'Hatterene',
  '0866': 'Mr. Rime',
  '0867': 'Runerigus',
  '0869': 'Alcremie',
  '0877': 'Morpeko',
  '0887': 'Dragapult',
  '0899': 'Wyrdeer',
  '0900': 'Kleavor',
  '0902': 'Basculegion',
  '0903': 'Sneasler',

  // Gen 9
  '0908': 'Meowscarada',
  '0911': 'Skeledirge',
  '0914': 'Quaquaval',
  '0925': 'Maushold',
  '0934': 'Garganacl',
  '0936': 'Armarouge',
  '0937': 'Ceruledge',
  '0939': 'Bellibolt',
  '0952': 'Scovillain',
  '0956': 'Espathra',
  '0957': 'Tinkatink',  // Not in roster
  '0959': 'Tinkaton',
  '0964': 'Palafin',
  '0968': 'Orthworm',
  '0970': 'Glimmora',
  '0981': 'Farigiraf',
  '0983': 'Kingambit',
  '1012': 'Sinistcha',
  '1018': 'Archaludon',
  '1019': 'Hydrapple',
};

// ─── Form suffixes → species names ───────────────────────────────────
// These map Bulbapedia "Menu CP XXXX-Suffix.png" to our species names.

const FORM_SUFFIXES: Record<string, string> = {
  // Mega evolutions
  '0003-Mega': 'Venusaur-Mega',
  '0006-Mega X': 'Charizard-Mega-X',
  '0006-Mega Y': 'Charizard-Mega-Y',
  '0009-Mega': 'Blastoise-Mega',
  '0015-Mega': 'Beedrill-Mega',
  '0018-Mega': 'Pidgeot-Mega',
  '0036-Mega': 'Clefable-Mega',
  '0065-Mega': 'Alakazam-Mega',
  '0071-Mega': 'Victreebel-Mega',
  '0080-Mega': 'Slowbro-Mega',
  '0094-Mega': 'Gengar-Mega',
  '0115-Mega': 'Kangaskhan-Mega',
  '0121-Mega': 'Starmie-Mega',
  '0127-Mega': 'Pinsir-Mega',
  '0130-Mega': 'Gyarados-Mega',
  '0142-Mega': 'Aerodactyl-Mega',
  '0149-Mega': 'Dragonite-Mega',
  '0154-Mega': 'Meganium-Mega',
  '0160-Mega': 'Feraligatr-Mega',
  '0181-Mega': 'Ampharos-Mega',
  '0208-Mega': 'Steelix-Mega',
  '0212-Mega': 'Scizor-Mega',
  '0214-Mega': 'Heracross-Mega',
  '0227-Mega': 'Skarmory-Mega',
  '0229-Mega': 'Houndoom-Mega',
  '0248-Mega': 'Tyranitar-Mega',
  '0282-Mega': 'Gardevoir-Mega',
  '0302-Mega': 'Sableye-Mega',
  '0306-Mega': 'Aggron-Mega',
  '0308-Mega': 'Medicham-Mega',
  '0310-Mega': 'Manectric-Mega',
  '0319-Mega': 'Sharpedo-Mega',
  '0323-Mega': 'Camerupt-Mega',
  '0334-Mega': 'Altaria-Mega',
  '0354-Mega': 'Banette-Mega',
  '0358-Mega': 'Chimecho-Mega',
  '0359-Mega': 'Absol-Mega',
  '0362-Mega': 'Glalie-Mega',
  '0428-Mega': 'Lopunny-Mega',
  '0445-Mega': 'Garchomp-Mega',
  '0448-Mega': 'Lucario-Mega',
  '0460-Mega': 'Abomasnow-Mega',
  '0475-Mega': 'Gallade-Mega',
  '0478-Mega': 'Froslass-Mega',
  '0500-Mega': 'Emboar-Mega',
  '0530-Mega': 'Excadrill-Mega',
  '0609-Mega': 'Chandelure-Mega',
  '0623-Mega': 'Golurk-Mega',
  '0652-Mega': 'Chesnaught-Mega',
  '0655-Mega': 'Delphox-Mega',
  '0658-Mega': 'Greninja-Mega',
  '0670-Mega': 'Floette-Mega',
  '0678-Mega': 'Meowstic-Mega',
  '0701-Mega': 'Hawlucha-Mega',
  '0740-Mega': 'Crabominable-Mega',
  '0780-Mega': 'Drampa-Mega',
  '0952-Mega': 'Scovillain-Mega',
  '0970-Mega': 'Glimmora-Mega',

  // Regional forms
  '0026-Alola': 'Raichu-Alola',
  '0038-Alola': 'Ninetales-Alola',
  '0059-Hisui': 'Arcanine-Hisui',
  '0080-Galar': 'Slowbro-Galar',
  '0128-Paldea Combat': 'Tauros-Paldea-Combat',
  '0128-Paldea Blaze': 'Tauros-Paldea-Blaze',
  '0128-Paldea Aqua': 'Tauros-Paldea-Aqua',
  '0157-Hisui': 'Typhlosion-Hisui',
  '0199-Galar': 'Slowking-Galar',
  '0503-Hisui': 'Samurott-Hisui',
  '0571-Hisui': 'Zoroark-Hisui',
  '0618-Galar': 'Stunfisk-Galar',
  '0706-Hisui': 'Goodra-Hisui',
  '0713-Hisui': 'Avalugg-Hisui',
  '0724-Hisui': 'Decidueye-Hisui',

  // Alternate forms
  '0670-Eternal': 'Floette-Eternal',
  '0678-Female': 'Meowstic-F',
  '0681-Blade': 'Aegislash-Blade',  // Will be skipped — we use Shield
  '0745-Midnight': 'Lycanroc-Midnight',
  '0745-Dusk': 'Lycanroc-Dusk',
  '0711-Small': 'Gourgeist-Small',
  '0711-Large': 'Gourgeist-Large',
  '0711-Super': 'Gourgeist-Super',

  // Rotom forms
  '0479-Heat': 'Rotom-Heat',
  '0479-Wash': 'Rotom-Wash',
  '0479-Frost': 'Rotom-Frost',
  '0479-Fan': 'Rotom-Fan',
  '0479-Mow': 'Rotom-Mow',
};

// ─── Which species to skip (not in Champions roster) ─────────────────

const SKIP_SPECIES = new Set([
  'Aegislash-Blade',  // We use Shield as the base
  'Honedge', 'Inkay', 'Barbaracle', 'Swirlix', 'Pumpkaboo', 'Phantump', 'Tinkatink',
]);

// Skip cosmetic-only form variants (Vivillon patterns, Furfrou trims, etc.)
const SKIP_FORM_PREFIXES = [
  '0666-',  // Vivillon patterns
  '0676-',  // Furfrou trims
  '0869-',  // Alcremie forms
  '0671-',  // Florges colors
];

// ─── Bulbapedia API ──────────────────────────────────────────────────

const BULBAPEDIA_API = 'https://archives.bulbagarden.net/w/api.php';
const BATCH_SIZE = 50; // MediaWiki API limit per request
const RATE_LIMIT_MS = 500; // Be polite to the API

interface ImageInfo {
  title: string;
  imageinfo?: { url: string }[];
}

async function fetchImageUrls(titles: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  for (let i = 0; i < titles.length; i += BATCH_SIZE) {
    const batch = titles.slice(i, i + BATCH_SIZE);
    const titlesParam = batch.map(t => `File:${t}`).join('|');

    const url = `${BULBAPEDIA_API}?action=query&titles=${encodeURIComponent(titlesParam)}&prop=imageinfo&iiprop=url&format=json`;

    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`API error: ${resp.status} ${resp.statusText}`);
      continue;
    }

    const data = await resp.json() as { query: { pages: Record<string, ImageInfo> } };
    const pages = data.query?.pages ?? {};

    for (const page of Object.values(pages)) {
      if (page.imageinfo && page.imageinfo.length > 0) {
        // Extract the original filename from the title (strip "File:" prefix)
        const filename = page.title.replace(/^File:/, '');
        result.set(filename, page.imageinfo[0].url);
      }
    }

    if (i + BATCH_SIZE < titles.length) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  return result;
}

// ─── dHash computation ───────────────────────────────────────────────
// Must match src/utils/perceptualHash.ts exactly:
// 1. Resize to 9x8 with bilinear smoothing
// 2. Convert to grayscale (ITU-R BT.601: 0.299R + 0.587G + 0.114B)
// 3. For each row, compare pixel[x] < pixel[x+1]
// 4. 64 bits → hex string

function computeDHash(canvas: Canvas): string {
  // Resize to 9x8 using canvas (bilinear interpolation, matching browser behavior)
  const small = createCanvas(9, 8);
  const ctx = small.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(canvas, 0, 0, 9, 8);
  const data = ctx.getImageData(0, 0, 9, 8).data;

  // Convert to grayscale
  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  // Compute difference hash: compare adjacent horizontal pixels
  // Bit ordering matches perceptualHash.ts: bit 0 = (0,0), bit 1 = (1,0), ...
  let hashHi = 0;
  let hashLo = 0;
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

  return (hashHi >>> 0).toString(16).padStart(8, '0') +
         (hashLo >>> 0).toString(16).padStart(8, '0');
}

// ─── Helpers ─────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldSkipForm(fileKey: string): boolean {
  return SKIP_FORM_PREFIXES.some(prefix => fileKey.startsWith(prefix));
}

// ─── Build the list of filenames to fetch ────────────────────────────

function buildFileList(): { filename: string; species: string; isShiny: boolean }[] {
  const entries: { filename: string; species: string; isShiny: boolean }[] = [];

  // Base forms from DEX_TO_SPECIES (normal + shiny)
  for (const [dexNum, species] of Object.entries(DEX_TO_SPECIES)) {
    if (SKIP_SPECIES.has(species)) continue;
    entries.push({ filename: `Menu CP ${dexNum}.png`, species, isShiny: false });
    entries.push({ filename: `Menu CP ${dexNum} shiny.png`, species, isShiny: true });
  }

  // Alternate forms from FORM_SUFFIXES (normal + shiny)
  for (const [formKey, species] of Object.entries(FORM_SUFFIXES)) {
    if (SKIP_SPECIES.has(species)) continue;
    if (shouldSkipForm(formKey)) continue;
    entries.push({ filename: `Menu CP ${formKey}.png`, species, isShiny: false });
    entries.push({ filename: `Menu CP ${formKey} shiny.png`, species, isShiny: true });
  }

  return entries;
}

// ─── Sprite cache (avoid re-downloading) ─────────────────────────────

function getCachePath(filename: string): string {
  return join(CACHE_DIR, filename.replace(/ /g, '_'));
}

async function downloadWithCache(url: string, filename: string): Promise<Buffer> {
  const cachePath = getCachePath(filename);

  if (existsSync(cachePath)) {
    return readFileSync(cachePath) as Buffer;
  }

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  writeFileSync(cachePath, buffer);
  return buffer;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('Building sprite hash database from Bulbapedia Champions menu sprites...\n');

  // Ensure cache directory exists
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  // 1. Build the list of files we need
  const fileList = buildFileList();
  console.log(`Need ${fileList.length} sprites\n`);

  // 2. Resolve direct download URLs via Bulbapedia API
  const filenames = fileList.map(f => f.filename);
  console.log('Fetching image URLs from Bulbapedia API...');
  const urlMap = await fetchImageUrls(filenames);
  console.log(`Got URLs for ${urlMap.size}/${filenames.length} files\n`);

  // 3. Download sprites and compute hashes
  const db: { species: string; hash: string }[] = [];
  let loaded = 0;
  let failed = 0;
  let skipped = 0;

  for (const { filename, species, isShiny } of fileList) {
    const url = urlMap.get(filename);
    if (!url) {
      // Shinies that don't exist on Bulbapedia are routine — log quietly.
      if (!isShiny) console.warn(`  NO URL: ${filename} → ${species}`);
      failed++;
      continue;
    }

    try {
      const buffer = await downloadWithCache(url, filename);
      const img = await loadImage(buffer);

      // Draw onto canvas at full resolution first
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      // White background to handle transparency consistently
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0);

      // Legacy dHash DB powers the OCR token-fallback path and only
      // needs the normal-colour variant per species. Shiny entries are
      // cached on disk for the sprite-detector DB builder to pick up.
      if (!isShiny) {
        const hash = computeDHash(canvas);
        db.push({ species, hash });
      }
      loaded++;

      if (loaded % 50 === 0) {
        console.log(`  Progress: ${loaded}/${fileList.length}`);
      }
    } catch (err) {
      console.warn(`  FAILED: ${filename} → ${species}: ${(err as Error).message}`);
      failed++;
    }
  }

  // Handle the special case: base 0670 is not Floette-Eternal
  // The base 0670 entry maps to Floette (not in roster), so remove it
  // and rely on the 0670-Eternal form entry instead.
  const floetteBaseIdx = db.findIndex(e => e.species === 'Floette-Eternal' &&
    fileList.find(f => f.species === 'Floette-Eternal' && f.filename === 'Menu CP 0670.png'));
  // (This is already handled by having 0670 map to Floette-Eternal in DEX_TO_SPECIES
  //  and 0670-Eternal also map to it in FORM_SUFFIXES — we'll deduplicate below)

  // 4. Deduplicate (prefer form-specific over base if both resolve to same species)
  const seen = new Map<string, { species: string; hash: string }>();
  for (const entry of db) {
    // For duplicates, keep the last one (form-specific entries come after base)
    seen.set(entry.species, entry);
  }
  const deduped = [...seen.values()];

  // 5. Sort alphabetically and write
  deduped.sort((a, b) => a.species.localeCompare(b.species));

  writeFileSync(OUTPUT_PATH, JSON.stringify(deduped, null, 2) + '\n');

  console.log(`\nDone!`);
  console.log(`  Loaded:  ${loaded}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Output:  ${deduped.length} entries → ${OUTPUT_PATH}`);

  // Report any species in the roster that we didn't get
  const rosterFile = readFileSync(join(PROJECT_ROOT, 'src/data/championsRoster.ts'), 'utf8');
  const rosterMatches = rosterFile.matchAll(/'([A-Z][a-zA-Z\-. ]+)'/g);
  const rosterSpecies = new Set([...rosterMatches].map(m => m[1]));
  const gotSpecies = new Set(deduped.map(e => e.species));
  const missing = [...rosterSpecies].filter(s => !gotSpecies.has(s));
  if (missing.length > 0) {
    console.log(`\n  Missing from roster (${missing.length}):`);
    for (const s of missing.sort()) {
      console.log(`    - ${s}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
