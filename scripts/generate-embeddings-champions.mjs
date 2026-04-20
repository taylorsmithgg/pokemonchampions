#!/usr/bin/env node
/**
 * Generate MobileNetV2 embeddings from Bulbapedia Champions menu sprites.
 * Uses the sprites cached by buildHashDB.ts in .sprite-cache/
 * Outputs JSON → src/data/spriteEmbeddings.json
 *
 * Run: node scripts/generate-embeddings-champions.mjs
 */

import * as ort from 'onnxruntime-node';
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync, readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const MODEL_PATH = 'public/models/mobilenetv2-features.onnx';
const CACHE_DIR = '.sprite-cache';
const OUTPUT_PATH = 'src/data/spriteEmbeddings.json';

// Load the hash DB to get species → filename mapping
const hashDB = JSON.parse(readFileSync('src/data/spriteHashDB.json', 'utf8'));

// Build filename → species mapping from the buildHashDB output
// Files are named like "Menu_CP_0003.png" → species from hashDB
// We'll re-derive this from the DEX mapping in buildHashDB
// Actually, simpler: use the hashDB + cached files to match

// Map species to their cached filenames
function speciesToFilename(species) {
  // We need to figure out which cached file corresponds to which species.
  // The hashDB was built by buildHashDB.ts which downloaded from Bulbapedia.
  // The cached filenames are like Menu_CP_0003.png, Menu_CP_0006-Mega_X.png, etc.
  // Instead of re-deriving, just load all cached PNGs and use the dex→species mapping.
  return null; // We'll use a different approach
}

// Dex number → species (same as buildHashDB.ts)
const DEX_TO_SPECIES = {
  '0003': 'Venusaur', '0006': 'Charizard', '0009': 'Blastoise',
  '0015': 'Beedrill', '0018': 'Pidgeot', '0024': 'Arbok',
  '0025': 'Pikachu', '0026': 'Raichu', '0036': 'Clefable',
  '0038': 'Ninetales', '0059': 'Arcanine', '0065': 'Alakazam',
  '0068': 'Machamp', '0071': 'Victreebel', '0080': 'Slowbro',
  '0094': 'Gengar', '0115': 'Kangaskhan', '0121': 'Starmie',
  '0127': 'Pinsir', '0128': 'Tauros', '0130': 'Gyarados',
  '0132': 'Ditto', '0134': 'Vaporeon', '0135': 'Jolteon',
  '0136': 'Flareon', '0142': 'Aerodactyl', '0143': 'Snorlax',
  '0149': 'Dragonite', '0154': 'Meganium', '0157': 'Typhlosion',
  '0160': 'Feraligatr', '0168': 'Ariados', '0181': 'Ampharos',
  '0184': 'Azumarill', '0186': 'Politoed', '0196': 'Espeon',
  '0197': 'Umbreon', '0199': 'Slowking', '0205': 'Forretress',
  '0208': 'Steelix', '0212': 'Scizor', '0214': 'Heracross',
  '0227': 'Skarmory', '0229': 'Houndoom', '0248': 'Tyranitar',
  '0279': 'Pelipper', '0282': 'Gardevoir', '0302': 'Sableye',
  '0306': 'Aggron', '0308': 'Medicham', '0310': 'Manectric',
  '0319': 'Sharpedo', '0323': 'Camerupt', '0324': 'Torkoal',
  '0334': 'Altaria', '0350': 'Milotic', '0351': 'Castform',
  '0354': 'Banette', '0358': 'Chimecho', '0359': 'Absol',
  '0362': 'Glalie', '0389': 'Torterra', '0392': 'Infernape',
  '0395': 'Empoleon', '0405': 'Luxray', '0407': 'Roserade',
  '0409': 'Rampardos', '0411': 'Bastiodon', '0428': 'Lopunny',
  '0442': 'Spiritomb', '0445': 'Garchomp', '0448': 'Lucario',
  '0450': 'Hippowdon', '0454': 'Toxicroak', '0460': 'Abomasnow',
  '0461': 'Weavile', '0464': 'Rhyperior', '0470': 'Leafeon',
  '0471': 'Glaceon', '0472': 'Gliscor', '0473': 'Mamoswine',
  '0475': 'Gallade', '0478': 'Froslass', '0479': 'Rotom',
  '0497': 'Serperior', '0500': 'Emboar', '0503': 'Samurott',
  '0505': 'Watchog', '0510': 'Liepard', '0512': 'Simisage',
  '0514': 'Simisear', '0516': 'Simipour', '0530': 'Excadrill',
  '0531': 'Audino', '0534': 'Conkeldurr', '0547': 'Whimsicott',
  '0553': 'Krookodile', '0563': 'Cofagrigus', '0569': 'Garbodor',
  '0571': 'Zoroark', '0579': 'Reuniclus', '0584': 'Vanilluxe',
  '0587': 'Emolga', '0609': 'Chandelure', '0614': 'Beartic',
  '0618': 'Stunfisk', '0623': 'Golurk', '0635': 'Hydreigon',
  '0637': 'Volcarona', '0652': 'Chesnaught', '0655': 'Delphox',
  '0658': 'Greninja', '0660': 'Diggersby', '0663': 'Talonflame',
  '0666': 'Vivillon', '0670': 'Floette', '0671': 'Florges',
  '0675': 'Pangoro', '0676': 'Furfrou', '0678': 'Meowstic',
  '0681': 'Aegislash-Shield', '0683': 'Aromatisse',
  '0685': 'Slurpuff', '0693': 'Clawitzer', '0695': 'Heliolisk',
  '0697': 'Tyrantrum', '0699': 'Aurorus', '0700': 'Sylveon',
  '0701': 'Hawlucha', '0702': 'Dedenne', '0706': 'Goodra',
  '0707': 'Klefki', '0709': 'Trevenant', '0711': 'Gourgeist',
  '0713': 'Avalugg', '0715': 'Noivern', '0724': 'Decidueye',
  '0727': 'Incineroar', '0730': 'Primarina', '0733': 'Toucannon',
  '0740': 'Crabominable', '0745': 'Lycanroc', '0748': 'Toxapex',
  '0750': 'Mudsdale', '0752': 'Araquanid', '0758': 'Salazzle',
  '0763': 'Tsareena', '0765': 'Oranguru', '0766': 'Passimian',
  '0778': 'Mimikyu', '0780': 'Drampa', '0784': 'Kommo-o',
  '0823': 'Corviknight', '0841': 'Flapple', '0842': 'Appletun',
  '0844': 'Sandaconda', '0855': 'Polteageist', '0858': 'Hatterene',
  '0866': 'Mr. Rime', '0867': 'Runerigus', '0869': 'Alcremie',
  '0877': 'Morpeko', '0887': 'Dragapult', '0899': 'Wyrdeer',
  '0900': 'Kleavor', '0902': 'Basculegion', '0903': 'Sneasler',
  '0908': 'Meowscarada', '0911': 'Skeledirge', '0914': 'Quaquaval',
  '0923': 'Pawmot', '0925': 'Maushold', '0934': 'Rabsca',
  '0936': 'Armarouge', '0937': 'Ceruledge', '0939': 'Scovillain',
  '0952': 'Tinkaton', '0956': 'Orthworm', '0959': 'Tatsugiri',
  '0964': 'Palafin', '0968': 'Revavroom', '0970': 'Glimmora',
  '0981': 'Farigiraf', '0983': 'Kingambit', '1013': 'Sinistcha',
  '1018': 'Archaludon', '1019': 'Hydrapple',
};

const FORM_SUFFIXES = {
  'Mega': '-Mega', 'Mega X': '-Mega-X', 'Mega Y': '-Mega-Y',
  'Alola': '-Alola', 'Hisui': '-Hisui', 'Galar': '-Galar',
  'Paldea Combat': '-Paldea-Combat', 'Paldea Blaze': '-Paldea-Blaze',
  'Paldea Aqua': '-Paldea-Aqua',
  'Wash': '-Wash', 'Heat': '-Heat', 'Frost': '-Frost', 'Mow': '-Mow', 'Fan': '-Fan',
  'Midnight': '-Midnight', 'Dusk': '-Dusk',
  'Small': '-Small', 'Large': '-Large', 'Jumbo': '-Jumbo',
  'Female': '-F', 'Eternal': '-Eternal', 'Blade': '-Blade',
  'Hangry': '-Hangry', 'Hero': '-Hero', 'Three': '-Four',
  'Rainy': '-Rainy', 'Snowy': '-Snowy', 'Sunny': '-Sunny',
};

// Skip cosmetic-only forms
const SKIP_FORMS = new Set([
  'Archipelago', 'Continental', 'Elegant', 'Fancy', 'Garden',
  'High Plains', 'Icy Snow', 'Jungle', 'Marine', 'Modern',
  'Monsoon', 'Ocean', 'Poké Ball', 'Polar', 'River', 'Sandstorm',
  'Savanna', 'Sun', 'Tundra', // Vivillon
  'Dandy', 'Debutante', 'Diamond', 'Heart', 'Kabuki',
  'La Reine', 'Matron', 'Pharaoh', 'Star', // Furfrou
  'Blue', 'Orange', 'White', 'Yellow', // Florges
  'Caramel Swirl', 'Lemon Cream', 'Matcha Cream', 'Mint Cream',
  'Rainbow Swirl', 'Ruby Cream', 'Ruby Swirl', 'Salted Cream', // Alcremie
]);

function filenameToSpecies(filename) {
  // "Menu_CP_0003-Mega.png" → dex="0003", form="Mega"
  const match = filename.match(/Menu_CP_(\d{4})(?:-(.+))?\.png/);
  if (!match) return null;
  const dex = match[1];
  const form = match[2]?.replace(/_/g, ' ') ?? null;

  if (form && SKIP_FORMS.has(form)) return null;
  if (form === 'Blade') return null; // Skip Aegislash-Blade

  const base = DEX_TO_SPECIES[dex];
  if (!base) return null;

  if (!form) return base;
  const suffix = FORM_SUFFIXES[form];
  if (!suffix) return null;
  return base + suffix;
}

function preprocessImage(img) {
  const canvas = createCanvas(224, 224);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080'; // neutral gray bg for transparent sprites
  ctx.fillRect(0, 0, 224, 224);
  const scale = Math.min(224 / img.width, 224 / img.height) * 0.8;
  const sw = img.width * scale, sh = img.height * scale;
  ctx.drawImage(img, (224 - sw) / 2, (224 - sh) / 2, sw, sh);

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

async function main() {
  if (!existsSync(CACHE_DIR)) {
    console.error('No .sprite-cache/ directory. Run buildHashDB.ts first.');
    process.exit(1);
  }

  console.log('Loading MobileNetV2...');
  const session = await ort.InferenceSession.create(MODEL_PATH);
  console.log('Model loaded. Input:', session.inputNames, 'Output:', session.outputNames);

  const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.png')).sort();
  console.log(`Found ${files.length} cached sprites`);

  const db = [];
  let loaded = 0, skipped = 0;

  for (const file of files) {
    const species = filenameToSpecies(file);
    if (!species) { skipped++; continue; }

    // Skip if we already have this species
    if (db.some(e => e.species === species)) { skipped++; continue; }

    try {
      const img = await loadImage(join(CACHE_DIR, file));
      const tensor = preprocessImage(img);
      const results = await session.run({ [session.inputNames[0]]: tensor });
      const output = results[session.outputNames[0]];
      const embedding = Array.from(output.data).map(v => Math.round(v * 1000) / 1000);
      db.push({ species, embedding });
      loaded++;
      if (loaded % 50 === 0) console.log(`  ${loaded}...`);
    } catch (e) {
      console.warn(`FAILED: ${file} (${species}): ${e.message}`);
    }
  }

  db.sort((a, b) => a.species.localeCompare(b.species));
  writeFileSync(OUTPUT_PATH, JSON.stringify(db));
  console.log(`\nDone: ${loaded} loaded, ${skipped} skipped`);
  const sizeMB = (JSON.stringify(db).length / 1024 / 1024).toFixed(1);
  console.log(`File size: ${sizeMB} MB`);
}

main().catch(console.error);
