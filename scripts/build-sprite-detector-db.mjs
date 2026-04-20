#!/usr/bin/env node
/**
 * Build the sprite-detector reference database from `.sprite-cache/`.
 *
 * For every cached `Menu_CP_*.png`:
 *   1. Map filename → Champions species id.
 *   2. Centre-fit the sprite onto a TEMPLATE_DIM² canvas.
 *   3. Use the PNG alpha channel as the sprite mask.
 *   4. Compute HS histogram, pHash, Hu moments, grayscale template.
 *   5. Base64-serialize the signature.
 *
 * Output: `public/sprite-detector-db.json` — loaded by the browser
 * runtime at startup.
 *
 * Usage: node --experimental-strip-types scripts/build-sprite-detector-db.mjs
 */

import { createCanvas, loadImage } from 'canvas';
import { existsSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

const CACHE_DIR = '.sprite-cache';
const OUTPUT = 'public/sprite-detector-db.json';
const TEMPLATE_DIM = 48;

async function loadModule(relPath) {
  return import(pathToFileURL(join(process.cwd(), relPath)).href);
}

const { computeHsHistogram, computeHuMoments, computePhash, toGrayscaleBuffer } =
  await loadModule('src/utils/spriteDetector/features.ts');
const { serializeEntry } = await loadModule('src/utils/spriteDetector/spriteDb.ts');

// Keep the DEX → species map in lock step with buildSpriteTemplates.mjs.
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
  'Female': '-F', 'Eternal': '-Eternal',
  'Rainy': '-Rainy', 'Snowy': '-Snowy', 'Sunny': '-Sunny',
};

const SKIP_FORMS = new Set([
  'Archipelago', 'Continental', 'Elegant', 'Fancy', 'Garden',
  'High Plains', 'Icy Snow', 'Jungle', 'Marine', 'Modern',
  'Monsoon', 'Ocean', 'Poke Ball', 'Poké Ball', 'Polar', 'River', 'Sandstorm',
  'Savanna', 'Sun', 'Tundra',
  'Dandy', 'Debutante', 'Diamond', 'Heart', 'Kabuki',
  'La Reine', 'Matron', 'Pharaoh', 'Star',
  'Blue', 'Orange', 'White', 'Yellow',
  'Caramel Swirl', 'Lemon Cream', 'Matcha Cream', 'Mint Cream',
  'Rainbow Swirl', 'Ruby Cream', 'Ruby Swirl', 'Salted Cream',
  'Blade', // Aegislash-Blade — skip, keep Shield only
  'Hangry', 'Hero', // keep base Morpeko / Palafin form only
  'Three', // Three-segment Maushold (== base)
]);

function filenameToSpecies(filename) {
  // Bulbapedia naming, after spaces → underscores from buildHashDB.ts:
  //   Menu_CP_0184.png              (normal base)
  //   Menu_CP_0184_shiny.png        (shiny base — `_shiny` not `-shiny`)
  //   Menu_CP_0006-Mega_X.png       (form, normal)
  //   Menu_CP_0006-Mega_X_shiny.png (form, shiny)
  // The separator between dex and form is `-`, but the shiny suffix is
  // joined with `_` because Bulbapedia's source uses a space.
  const match = filename.match(
    /Menu_CP_(\d{4})(?:-([^.]+?))?(_shiny)?\.png/,
  );
  if (!match) return null;
  const dex = match[1];
  let formRaw = match[2]?.replace(/_/g, ' ') ?? null;
  let isShiny = !!match[3];

  // Edge case: a form-only file whose form name itself ends with " shiny"
  // (legacy fallback for any odd casing the API might return).
  if (formRaw && formRaw.endsWith(' shiny')) {
    isShiny = true;
    formRaw = formRaw.slice(0, -' shiny'.length).trim() || null;
  }

  if (formRaw && SKIP_FORMS.has(formRaw)) return null;

  const base = DEX_TO_SPECIES[dex];
  if (!base) return null;

  if (!formRaw) {
    return {
      species: base,
      form: 'default',
      name: isShiny ? `${base} (shiny)` : base,
      dex: parseInt(dex, 10),
      isShiny,
    };
  }
  const suffix = FORM_SUFFIXES[formRaw];
  if (!suffix) return null;
  return {
    species: base + suffix,
    form: formRaw,
    name: isShiny ? `${base} (${formRaw}, shiny)` : `${base} (${formRaw})`,
    dex: parseInt(dex, 10),
    isShiny,
  };
}

function renderSpriteToTemplate(img) {
  const canvas = createCanvas(TEMPLATE_DIM, TEMPLATE_DIM);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, TEMPLATE_DIM, TEMPLATE_DIM);

  const scale = Math.min(TEMPLATE_DIM / img.width, TEMPLATE_DIM / img.height);
  const sw = img.width * scale;
  const sh = img.height * scale;
  ctx.drawImage(img, (TEMPLATE_DIM - sw) / 2, (TEMPLATE_DIM - sh) / 2, sw, sh);

  const id = ctx.getImageData(0, 0, TEMPLATE_DIM, TEMPLATE_DIM);
  const rgba = new Uint8ClampedArray(id.data);

  const maskBytes = new Uint8Array(TEMPLATE_DIM * TEMPLATE_DIM);
  const grayTemplate = new Uint8Array(TEMPLATE_DIM * TEMPLATE_DIM);
  for (let i = 0; i < TEMPLATE_DIM * TEMPLATE_DIM; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const a = rgba[i * 4 + 3];
    if (a > 128) {
      maskBytes[i] = 255;
      grayTemplate[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    } else {
      maskBytes[i] = 0;
      grayTemplate[i] = 0;
    }
  }

  return { rgba, maskBytes, grayTemplate };
}

async function main() {
  if (!existsSync(CACHE_DIR)) {
    console.error(`Missing ${CACHE_DIR}/ — run scripts/buildHashDB.ts first to populate.`);
    process.exit(1);
  }

  const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.png')).sort();
  console.log(`Found ${files.length} sprites in ${CACHE_DIR}/`);

  const serialized = [];
  const seen = new Set();
  let ok = 0, skipped = 0;

  let okShiny = 0;
  for (const file of files) {
    const meta = filenameToSpecies(file);
    if (!meta) { skipped++; continue; }
    // Key on species + shiny so the normal and shiny variants of the
    // same species both get emitted as separate entries.
    const dedupeKey = `${meta.species}|${meta.isShiny ? 'shiny' : 'normal'}`;
    if (seen.has(dedupeKey)) { skipped++; continue; }
    seen.add(dedupeKey);

    try {
      const img = await loadImage(join(CACHE_DIR, file));
      const { rgba, maskBytes, grayTemplate } = renderSpriteToTemplate(img);

      const view = { data: rgba, width: TEMPLATE_DIM, height: TEMPLATE_DIM };
      const mask = { data: maskBytes, width: TEMPLATE_DIM, height: TEMPLATE_DIM };

      const hsHist = computeHsHistogram(view, mask);
      const phash = computePhash(grayTemplate, TEMPLATE_DIM, TEMPLATE_DIM);
      const huMoments = computeHuMoments(mask);

      const signature = {
        hsHist,
        phash,
        huMoments,
        template: grayTemplate,
        templateWidth: TEMPLATE_DIM,
        templateHeight: TEMPLATE_DIM,
        maskBytes,
      };
      const entry = serializeEntry(
        {
          dex: meta.dex,
          species: meta.species,
          name: meta.name,
          form: meta.form,
          panelType: '',
          isShiny: meta.isShiny,
        },
        signature,
      );
      serialized.push(entry);
      ok++;
      if (meta.isShiny) okShiny++;
      if (ok % 50 === 0) console.log(`  ${ok}...`);
    } catch (e) {
      console.warn(`FAILED ${file}: ${e.message}`);
    }
  }

  serialized.sort((a, b) => {
    const c = a.species.localeCompare(b.species);
    if (c !== 0) return c;
    // Normal before shiny for stable ordering.
    return (a.isShiny ? 1 : 0) - (b.isShiny ? 1 : 0);
  });
  const payload = { version: 1, templateDim: TEMPLATE_DIM, entries: serialized };
  writeFileSync(OUTPUT, JSON.stringify(payload));
  const bytes = JSON.stringify(payload).length;
  console.log(
    `\nWrote ${OUTPUT}  (${(bytes / 1024).toFixed(1)} KB, ${ok} entries [${okShiny} shiny], ${skipped} skipped)`,
  );
}

main().catch(e => { console.error(e); process.exit(1); });
