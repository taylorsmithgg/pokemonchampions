// ─── Pokemon Champions Official Roster ──────────────────────────────
//
// SINGLE SOURCE OF TRUTH for which Pokemon actually exist in Champions.
//
// Sourced from Bulbapedia's "List of Pokémon in Pokémon Champions" page.
// Cross-referenced against pokemon-zone.com, which maintains per-Pokemon
// pages but shows an "Not currently available in Pokémon Champions.
// Stats shown are from previous VGC regulations" banner on species that
// exist in the VGC 2026 format but aren't yet in the game (e.g.,
// Gholdengo, Amoonguss, Rillaboom). Trust the banner, not the URL.
//
// Structure: one const per generation so both the flat roster list
// and the `gen -> species[]` map derive from the same data. Generation
// buckets map to the debut generation of each species.
//
// Name format matches Smogon/@smogon/calc conventions (hyphenated
// forms like "Kommo-o", "Mr. Rime"). If a name fails to resolve
// against gen9.species at runtime, champions.ts logs a warning.
//
// Last synced: 2026-04-10

const GEN_1: readonly string[] = [
  'Venusaur',
  'Charizard',
  'Blastoise',
  'Beedrill',
  'Pidgeot',
  'Arbok',
  'Pikachu',
  'Raichu',
  'Clefable',
  'Ninetales',
  'Arcanine',
  'Alakazam',
  'Machamp',
  'Victreebel',
  'Slowbro',
  'Gengar',
  'Kangaskhan',
  'Starmie',
  'Pinsir',
  'Tauros',
  'Gyarados',
  'Ditto',
  'Vaporeon',
  'Jolteon',
  'Flareon',
  'Aerodactyl',
  'Snorlax',
  'Dragonite',
];

const GEN_2: readonly string[] = [
  'Meganium',
  'Typhlosion',
  'Feraligatr',
  'Ariados',
  'Ampharos',
  'Azumarill',
  'Politoed',
  'Espeon',
  'Umbreon',
  'Slowking',
  'Forretress',
  'Steelix',
  'Scizor',
  'Heracross',
  'Skarmory',
  'Houndoom',
  'Tyranitar',
];

const GEN_3: readonly string[] = [
  'Pelipper',
  'Gardevoir',
  'Sableye',
  'Aggron',
  'Medicham',
  'Manectric',
  'Sharpedo',
  'Camerupt',
  'Torkoal',
  'Altaria',
  'Milotic',
  'Castform',
  'Banette',
  'Chimecho',
  'Absol',
  'Glalie',
];

const GEN_4: readonly string[] = [
  'Torterra',
  'Infernape',
  'Empoleon',
  'Luxray',
  'Roserade',
  'Rampardos',
  'Bastiodon',
  'Lopunny',
  'Spiritomb',
  'Garchomp',
  'Lucario',
  'Hippowdon',
  'Toxicroak',
  'Abomasnow',
  'Weavile',
  'Rhyperior',
  'Leafeon',
  'Glaceon',
  'Gliscor',
  'Mamoswine',
  'Gallade',
  'Froslass',
  'Rotom',
];

const GEN_5: readonly string[] = [
  'Serperior',
  'Emboar',
  'Samurott',
  'Watchog',
  'Liepard',
  'Simisage',
  'Simisear',
  'Simipour',
  'Excadrill',
  'Audino',
  'Conkeldurr',
  'Whimsicott',
  'Krookodile',
  'Cofagrigus',
  'Garbodor',
  'Zoroark',
  'Reuniclus',
  'Vanilluxe',
  'Emolga',
  'Chandelure',
  'Beartic',
  'Stunfisk',
  'Golurk',
  'Hydreigon',
  'Volcarona',
];

const GEN_6: readonly string[] = [
  'Chesnaught',
  'Delphox',
  'Greninja',
  'Diggersby',
  'Talonflame',
  'Vivillon',
  // AZ's Eternal Flower form — debuted playable in Legends: Z-A and
  // is the only Floette variant in Champions (per Bulbapedia, which
  // lists it as "transfer only" — must come via HOME from Z-A).
  // Base Floette and the flower color variants are not legal here.
  // Floette-Eternal + Floettite → Floette-Mega, handled by
  // resolveForm's sub-form Mega fallback.
  'Floette-Eternal',
  'Florges',
  'Pangoro',
  'Furfrou',
  'Meowstic',
  'Aegislash-Shield', // Smogon has no base "Aegislash" entry; Stance Change handles Blade swap
  'Aromatisse',
  'Slurpuff',
  'Clawitzer',
  'Heliolisk',
  'Tyrantrum',
  'Aurorus',
  'Sylveon',
  'Hawlucha',
  'Dedenne',
  'Goodra',
  'Klefki',
  'Trevenant',
  'Gourgeist',
  'Avalugg',
  'Noivern',
];

const GEN_7: readonly string[] = [
  'Decidueye',
  'Incineroar',
  'Primarina',
  'Toucannon',
  'Crabominable',
  'Lycanroc',
  'Toxapex',
  'Mudsdale',
  'Araquanid',
  'Salazzle',
  'Tsareena',
  'Oranguru',
  'Passimian',
  'Mimikyu',
  'Drampa',
  'Kommo-o',
];

const GEN_8: readonly string[] = [
  'Corviknight',
  'Flapple',
  'Appletun',
  'Sandaconda',
  'Polteageist',
  'Hatterene',
  'Mr. Rime',
  'Runerigus',
  'Alcremie',
  'Morpeko',
  'Dragapult',
  'Wyrdeer',      // Hisuian evolution, but debuted alongside Gen 8
  'Kleavor',      // Hisuian evolution
  'Basculegion',  // Hisuian evolution
  'Sneasler',     // Hisuian evolution
];

const GEN_9: readonly string[] = [
  'Meowscarada',
  'Skeledirge',
  'Quaquaval',
  'Maushold',
  'Garganacl',
  'Armarouge',
  'Ceruledge',
  'Bellibolt',
  'Scovillain',
  'Espathra',
  'Tinkaton',
  'Palafin',
  'Orthworm',
  'Glimmora',
  'Farigiraf',
  'Kingambit',
  'Sinistcha',
  'Archaludon',
  'Hydrapple',
];

// Map: gen number → species list. Exposes ordered access by generation.
export const CHAMPIONS_POKEMON_BY_GEN: Readonly<Record<number, readonly string[]>> = {
  1: GEN_1,
  2: GEN_2,
  3: GEN_3,
  4: GEN_4,
  5: GEN_5,
  6: GEN_6,
  7: GEN_7,
  8: GEN_8,
  9: GEN_9,
};

// ─── Regional / alternate forms ────────────────────────────────────
// These are regional variants of base-roster species that have
// meaningfully different stats, types, or abilities. They exist in
// Champions as separate selectable forms and should be scored
// independently by the projection engines.
//
// Adding a form here automatically makes it available in the
// calculator, tier list, synergy engine, and team builder.

export const REGIONAL_FORMS: readonly string[] = [
  // Alolan forms
  'Ninetales-Alola',      // Ice/Fairy — Snow Warning, Aurora Veil
  'Raichu-Alola',         // Electric/Psychic — Surge Surfer
  'Exeggutor-Alola',      // Grass/Dragon — Frisk
  'Marowak-Alola',        // Fire/Ghost — Lightning Rod
  'Muk-Alola',            // Poison/Dark — Power of Alchemy
  // Hisuian forms
  'Arcanine-Hisui',       // Fire/Rock — Intimidate, Rock Head
  'Typhlosion-Hisui',     // Fire/Ghost — Frisk
  'Decidueye-Hisui',      // Grass/Fighting — Scrappy
  'Zoroark-Hisui',        // Normal/Ghost — Illusion
  'Goodra-Hisui',         // Steel/Dragon — Sap Sipper
  'Lilligant-Hisui',      // Grass/Fighting — Chlorophyll
  // Galarian forms
  'Slowking-Galar',       // Poison/Psychic — Regenerator
  // Paldean forms
  'Tauros-Paldea-Combat', // Fighting — Intimidate
];

/** Map of base species → their available alternate forms. */
export const FORM_ALTERNATIVES: Readonly<Record<string, readonly string[]>> = {
  Ninetales: ['Ninetales-Alola'],
  Raichu: ['Raichu-Alola'],
  Exeggutor: ['Exeggutor-Alola'],
  Marowak: ['Marowak-Alola'],
  Muk: ['Muk-Alola'],
  Arcanine: ['Arcanine-Hisui'],
  Typhlosion: ['Typhlosion-Hisui'],
  Decidueye: ['Decidueye-Hisui'],
  Zoroark: ['Zoroark-Hisui'],
  Goodra: ['Goodra-Hisui'],
  Lilligant: ['Lilligant-Hisui'],
  Slowking: ['Slowking-Galar'],
  Tauros: ['Tauros-Paldea-Combat'],
};

// Flat list, generated from the per-gen buckets + regional forms.
// This is the single list every other file in the app should use.
export const CHAMPIONS_POKEMON_LIST: readonly string[] = [
  ...GEN_1,
  ...GEN_2,
  ...GEN_3,
  ...GEN_4,
  ...GEN_5,
  ...GEN_6,
  ...GEN_7,
  ...GEN_8,
  ...GEN_9,
  ...REGIONAL_FORMS,
];

// ─── Generation Display Metadata ────────────────────────────────────
// Labels and theming for the Gen filter UI. Each generation gets a
// region name (for labels), a short label (for compact badges), and a
// color scheme (for visual identification).

export interface GenMeta {
  gen: number;
  region: string;
  shortLabel: string;
  color: string;       // Tailwind text color class
  bgColor: string;     // Tailwind background color class
  borderColor: string; // Tailwind border color class
  hex: string;         // Raw hex for inline styles
}

export const GENERATION_META: readonly GenMeta[] = [
  { gen: 1, region: 'Kanto',   shortLabel: 'I',   color: 'text-red-300',     bgColor: 'bg-red-500/15',     borderColor: 'border-red-500/30',     hex: '#ef4444' },
  { gen: 2, region: 'Johto',   shortLabel: 'II',  color: 'text-amber-300',   bgColor: 'bg-amber-500/15',   borderColor: 'border-amber-500/30',   hex: '#f59e0b' },
  { gen: 3, region: 'Hoenn',   shortLabel: 'III', color: 'text-emerald-300', bgColor: 'bg-emerald-500/15', borderColor: 'border-emerald-500/30', hex: '#10b981' },
  { gen: 4, region: 'Sinnoh',  shortLabel: 'IV',  color: 'text-sky-300',     bgColor: 'bg-sky-500/15',     borderColor: 'border-sky-500/30',     hex: '#0ea5e9' },
  { gen: 5, region: 'Unova',   shortLabel: 'V',   color: 'text-slate-300',   bgColor: 'bg-slate-500/15',   borderColor: 'border-slate-500/30',   hex: '#64748b' },
  { gen: 6, region: 'Kalos',   shortLabel: 'VI',  color: 'text-indigo-300',  bgColor: 'bg-indigo-500/15',  borderColor: 'border-indigo-500/30',  hex: '#6366f1' },
  { gen: 7, region: 'Alola',   shortLabel: 'VII', color: 'text-orange-300',  bgColor: 'bg-orange-500/15',  borderColor: 'border-orange-500/30',  hex: '#f97316' },
  { gen: 8, region: 'Galar',   shortLabel: 'VIII',color: 'text-purple-300',  bgColor: 'bg-purple-500/15',  borderColor: 'border-purple-500/30',  hex: '#a855f7' },
  { gen: 9, region: 'Paldea',  shortLabel: 'IX',  color: 'text-rose-300',    bgColor: 'bg-rose-500/15',    borderColor: 'border-rose-500/30',    hex: '#f43f5e' },
];

// ─── Mega Evolutions Available in Champions ────────────────────────
// These are the base species that can Mega Evolve. The actual Mega form
// is resolved via CalcPokemon.getForme() when the correct Mega Stone
// is equipped — see resolveForm() in champions.ts.
//
// MEGA_STONE_MAP is the single source of truth for which stone
// activates which species' Mega. CHAMPIONS_MEGA_LIST is derived from
// its keys, and itemOptimizer reads it directly for recommendations.

export const MEGA_STONE_MAP: Readonly<Record<string, readonly string[]>> = {
  Venusaur:          ['Venusaurite'],
  Charizard:         ['Charizardite X', 'Charizardite Y'],
  Blastoise:         ['Blastoisinite'],
  Beedrill:          ['Beedrillite'],
  Pidgeot:           ['Pidgeotite'],
  Clefable:          ['Clefablite'],      // Z-A
  Alakazam:          ['Alakazite'],
  Victreebel:        ['Victreebelite'],   // Z-A
  Slowbro:           ['Slowbronite'],
  Gengar:            ['Gengarite'],
  Kangaskhan:        ['Kangaskhanite'],
  Starmie:           ['Starminite'],      // Z-A
  Pinsir:            ['Pinsirite'],
  Gyarados:          ['Gyaradosite'],
  Aerodactyl:        ['Aerodactylite'],
  Dragonite:         ['Dragoninite'],     // Z-A
  Meganium:          ['Meganiumite'],     // Z-A
  Feraligatr:        ['Feraligite'],      // Z-A
  Ampharos:          ['Ampharosite'],
  Steelix:           ['Steelixite'],
  Scizor:            ['Scizorite'],
  Heracross:         ['Heracronite'],
  Skarmory:          ['Skarmorite'],      // Z-A
  Houndoom:          ['Houndoominite'],
  Tyranitar:         ['Tyranitarite'],
  Gardevoir:         ['Gardevoirite'],
  Sableye:           ['Sablenite'],
  Aggron:            ['Aggronite'],
  Medicham:          ['Medichamite'],
  Manectric:         ['Manectite'],
  Sharpedo:          ['Sharpedonite'],
  Camerupt:          ['Cameruptite'],
  Altaria:           ['Altarianite'],
  Banette:           ['Banettite'],
  Chimecho:          ['Chimechite'],      // Z-A
  Absol:             ['Absolite'],
  Glalie:            ['Glalitite'],
  Lopunny:           ['Lopunnite'],
  Garchomp:          ['Garchompite'],
  Lucario:           ['Lucarionite'],
  Abomasnow:         ['Abomasite'],
  Gallade:           ['Galladite'],
  Froslass:          ['Froslassite'],     // Z-A
  Emboar:            ['Emboarite'],       // Z-A
  'Floette-Eternal': ['Floettite'],       // Z-A — Mega of AZ's form
};

export const CHAMPIONS_MEGA_LIST: readonly string[] = Object.keys(MEGA_STONE_MAP);

// Reverse index: stone → species. Useful when we know the item but
// not the species (e.g., validating item selection). Multi-stone
// entries (Charizardite X/Y) produce one entry per stone.
export const STONE_TO_SPECIES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(MEGA_STONE_MAP).flatMap(([species, stones]) =>
    stones.map(stone => [stone, species] as const)
  )
);

