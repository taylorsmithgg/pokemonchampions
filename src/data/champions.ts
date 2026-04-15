// Pokemon Champions data layer
// Wraps @smogon/calc Gen 9 data with Champions-specific modifications

import { Generations, Pokemon as CalcPokemon } from '@smogon/calc';
import type { StatID } from '@smogon/calc';
import type { NatureName, TypeName } from '../types';
import {
  CHAMPIONS_POKEMON_LIST,
  CHAMPIONS_MEGA_LIST,
  CHAMPIONS_POKEMON_BY_GEN,
  MEGA_STONE_MAP,
  GENERATION_META,
  FORM_ALTERNATIVES,
  type GenMeta,
} from './championsRoster';
import { getZAMegaByStone, type ZAMegaEntry } from './zaMegaData';

export { GENERATION_META, type GenMeta } from './championsRoster';
export { FORM_ALTERNATIVES } from './championsRoster';

const gen9 = Generations.get(9);

// ─── Type Effectiveness (single source of truth) ────────────────────
// Every file that needs type effectiveness MUST import this function.
// Do NOT create your own gen9.types.get() calls.
export function getTypeEffectiveness(atkType: string, defType: string): number {
  const typeData = gen9.types.get(atkType.toLowerCase() as any);
  if (!typeData) return 1;
  return (typeData.effectiveness as any)[defType] ?? 1;
}

export function getDefensiveMultiplier(atkType: string, defenderTypes: string[]): number {
  let mult = 1;
  for (const dt of defenderTypes) mult *= getTypeEffectiveness(atkType, dt);
  return mult;
}

// ─── Stat Point System ─────────────────────────────────────────────
// Champions replaces EVs/IVs with Stat Points (SP)
// 66 total SP, max 32 per stat, 1 SP = +1 stat at Lv50
export const MAX_TOTAL_SP = 66;
export const MAX_STAT_SP = 32;

// ─── Nature Data ────────────────────────────────────────────────────
export interface NatureInfo {
  name: NatureName;
  plus?: StatID;
  minus?: StatID;
}

export const NATURES: NatureInfo[] = [
  { name: 'Adamant', plus: 'atk', minus: 'spa' },
  { name: 'Bold', plus: 'def', minus: 'atk' },
  { name: 'Brave', plus: 'atk', minus: 'spe' },
  { name: 'Calm', plus: 'spd', minus: 'atk' },
  { name: 'Careful', plus: 'spd', minus: 'spa' },
  { name: 'Gentle', plus: 'spd', minus: 'def' },
  { name: 'Hasty', plus: 'spe', minus: 'def' },
  { name: 'Impish', plus: 'def', minus: 'spa' },
  { name: 'Jolly', plus: 'spe', minus: 'spa' },
  { name: 'Lax', plus: 'def', minus: 'spd' },
  { name: 'Lonely', plus: 'atk', minus: 'def' },
  { name: 'Mild', plus: 'spa', minus: 'def' },
  { name: 'Modest', plus: 'spa', minus: 'atk' },
  { name: 'Naive', plus: 'spe', minus: 'spd' },
  { name: 'Naughty', plus: 'atk', minus: 'spd' },
  { name: 'Quiet', plus: 'spa', minus: 'spe' },
  { name: 'Rash', plus: 'spa', minus: 'spd' },
  { name: 'Relaxed', plus: 'def', minus: 'spe' },
  { name: 'Sassy', plus: 'spd', minus: 'spe' },
  { name: 'Timid', plus: 'spe', minus: 'atk' },
  { name: 'Hardy' },
  { name: 'Docile' },
  { name: 'Serious' },
  { name: 'Bashful' },
  { name: 'Quirky' },
];

export function getNatureMod(nature: NatureName, stat: StatID): number {
  const n = NATURES.find(n => n.name === nature);
  if (!n) return 1;
  if (n.plus === stat) return 1.1;
  if (n.minus === stat) return 0.9;
  return 1;
}

export function getNatureLabel(nature: NatureName): string {
  const n = NATURES.find(n2 => n2.name === nature);
  if (!n || !n.plus || !n.minus) return nature;
  const statLabels: Record<string, string> = {
    atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe'
  };
  return `${nature} (+${statLabels[n.plus]}, -${statLabels[n.minus]})`;
}

// ─── Available Pokemon in Champions ─────────────────────────────────
// Single source of truth is a WHITELIST of ~186 species from
// src/data/championsRoster.ts (synced from Bulbapedia).
//
// Every Pokemon-facing surface in the app routes through
// getAvailablePokemon() / isChampionsPokemon() to filter. This
// guarantees an entry can only appear if Bulbapedia says so.

const CHAMPIONS_POKEMON_SET = new Set<string>();
const CHAMPIONS_MEGA_SET = new Set<string>();
// Reverse index: species name → gen number. Built once at init so
// getPokemonGeneration() is O(1). Accepts the base species; Mega/form
// suffixes are stripped before lookup.
const SPECIES_TO_GEN = new Map<string, number>();

function initChampionsPokemon() {
  if (CHAMPIONS_POKEMON_SET.size > 0) return;

  // Validate every roster entry resolves against Smogon's Gen 9 data.
  // If a name fails we log a warning so mismatches are caught early
  // instead of silently disappearing.
  for (const name of CHAMPIONS_POKEMON_LIST) {
    const data = gen9.species.get(name.toLowerCase().replace(/[^a-z0-9]/g, '') as any);
    if (!data) {
      if (typeof console !== 'undefined') {
        console.warn(`[champions.ts] Roster entry "${name}" did not resolve in Smogon Gen 9 data — skipping.`);
      }
      continue;
    }
    CHAMPIONS_POKEMON_SET.add(name);
  }

  for (const name of CHAMPIONS_MEGA_LIST) CHAMPIONS_MEGA_SET.add(name);

  // Build reverse gen index from the per-gen buckets.
  for (const [genStr, list] of Object.entries(CHAMPIONS_POKEMON_BY_GEN)) {
    const gen = Number(genStr);
    for (const name of list) SPECIES_TO_GEN.set(name, gen);
  }
}

export function getAvailablePokemon(): string[] {
  initChampionsPokemon();
  const all = new Set(CHAMPIONS_POKEMON_SET);

  // Include Rotom appliance forms — these are selectable species,
  // not just in-battle transformations. Players pick Rotom-Wash etc.
  if (all.has('Rotom')) {
    for (const form of ['Rotom-Wash', 'Rotom-Heat', 'Rotom-Frost', 'Rotom-Mow', 'Rotom-Fan']) {
      all.add(form);
    }
  }

  // Include Basculegion gender forms
  if (all.has('Basculegion')) {
    all.add('Basculegion-F');
  }

  return Array.from(all).sort();
}

/**
 * Predicate for filtering any external data source (tier list entries,
 * live Smogon usage stats, preset species, team members, etc.) against
 * the Champions roster.
 *
 * Regional variants (Alolan, Galarian, Hisuian, Paldean) are NOT
 * automatically allowed — only the base species. Mega forms are only
 * allowed when the base is in CHAMPIONS_MEGA_LIST. Rotom appliance forms
 * and Basculegion gender forms are allowed as in-game transformations
 * of a whitelisted base.
 */
export function isChampionsPokemon(name: string): boolean {
  initChampionsPokemon();
  if (!name) return false;
  if (CHAMPIONS_POKEMON_SET.has(name)) return true;

  // Regional display-name format (e.g., "Alolan Ninetales")
  const regionalDisplayMatch = name.match(/^(Alolan|Galarian|Hisuian|Paldean)\s+(.+)$/);
  if (regionalDisplayMatch) {
    const regionSuffix: Record<string, string> = {
      Alolan: 'Alola',
      Galarian: 'Galar',
      Hisuian: 'Hisui',
      Paldean: 'Paldea',
    };
    const canonicalName = `${regionalDisplayMatch[2]}-${regionSuffix[regionalDisplayMatch[1]]}`;
    if (CHAMPIONS_POKEMON_SET.has(canonicalName)) return true;
  }

  // Mega forms (Foo-Mega, Foo-Mega-X, Foo-Mega-Y)
  const megaMatch = name.match(/^(.+?)-Mega(?:-[XY])?$/);
  if (megaMatch) {
    // Exact family match (e.g., Charizard-Mega-Y → Charizard)
    if (CHAMPIONS_MEGA_SET.has(megaMatch[1])) return true;
    // Sub-form match (e.g., Floette-Mega → Floette-Eternal, because
    // AZ's Eternal Flower is the form that actually Mega Evolves).
    // Check if any entry in the Mega set starts with `${family}-`.
    for (const entry of CHAMPIONS_MEGA_SET) {
      if (entry.startsWith(`${megaMatch[1]}-`)) return true;
    }
  }

  // "Mega Foo" / "Mega Foo X" display-name format (used in tier list)
  const megaDisplayMatch = name.match(/^Mega (.+?)(?: [XY])?$/);
  if (megaDisplayMatch) {
    if (CHAMPIONS_MEGA_SET.has(megaDisplayMatch[1])) return true;
    for (const entry of CHAMPIONS_MEGA_SET) {
      if (entry.startsWith(`${megaDisplayMatch[1]}-`)) return true;
    }
  }

  // Rotom appliance forms — Rotom itself is whitelisted, these are
  // in-battle transformations of the base species.
  if (/^Rotom-(Wash|Heat|Mow|Fan|Frost)$/.test(name) && CHAMPIONS_POKEMON_SET.has('Rotom')) return true;

  // Basculegion gender forms.
  if (/^Basculegion-[FM]$/.test(name) && CHAMPIONS_POKEMON_SET.has('Basculegion')) return true;

  // Aegislash Stance Change forms — in-battle transformation of one species.
  if (/^Aegislash(-Blade|-Both)?$/.test(name) && CHAMPIONS_POKEMON_SET.has('Aegislash-Shield')) return true;

  return false;
}

/**
 * Returns true if the given species has a Mega Evolution available in
 * Champions. Used to gate Mega Stone item suggestions and resolveForm.
 */
export function hasChampionsMega(species: string): boolean {
  initChampionsPokemon();
  return CHAMPIONS_MEGA_SET.has(species);
}

export function getPokemonData(name: string) {
  return gen9.species.get(name.toLowerCase().replace(/[^a-z0-9]/g, '') as any);
}

/**
 * Get all Champions-legal alternate forms of a species (including the base).
 * Returns [baseForm, ...alternates] where each is a valid species name.
 * Used for form comparison in optimization — if you pick Arcanine,
 * this returns ['Arcanine', 'Arcanine-Hisui'] so the optimizer can
 * compare both and suggest the better one.
 */
export function getAlternateForms(species: string): string[] {
  initChampionsPokemon();
  const forms = [species];

  // Check if this species has registered alternate forms
  const baseName = species.replace(/-(Alola|Galar|Hisui|Paldea|Paldea-Combat)$/, '');
  const alts = FORM_ALTERNATIVES[baseName];
  if (alts) {
    for (const alt of alts) {
      if (alt !== species && CHAMPIONS_POKEMON_SET.has(alt)) forms.push(alt);
    }
  }

  // If this IS an alternate form, also include the base
  if (baseName !== species && CHAMPIONS_POKEMON_SET.has(baseName) && !forms.includes(baseName)) {
    forms.unshift(baseName);
  }

  return forms;
}

/**
 * Returns the debut generation (1-9) of a given Champions Pokemon, or
 * undefined if the species isn't in the roster. Accepts Mega forms
 * (Charizard-Mega-Y → 1) and Rotom appliance forms (Rotom-Wash → 4)
 * by normalizing to the base species first.
 */
export function getPokemonGeneration(name: string): number | undefined {
  initChampionsPokemon();
  if (!name) return undefined;
  if (SPECIES_TO_GEN.has(name)) return SPECIES_TO_GEN.get(name);

  // Strip Mega/form suffix and retry
  const stripped = name
    .replace(/-Mega(-[XY])?$/, '')
    .replace(/^(Rotom|Basculegion)-[A-Za-z]+$/, '$1')
    .replace(/^Aegislash(-Blade|-Both)?$/, 'Aegislash-Shield');
  if (SPECIES_TO_GEN.has(stripped)) return SPECIES_TO_GEN.get(stripped);

  // "Mega Foo X" display format
  const megaDisplay = name.match(/^Mega (.+?)(?: [XY])?$/);
  if (megaDisplay && SPECIES_TO_GEN.has(megaDisplay[1])) return SPECIES_TO_GEN.get(megaDisplay[1]);

  return undefined;
}

/**
 * Returns the GenMeta (region name, label, color) for a species, or
 * undefined if the species isn't in the roster.
 */
export function getGenMetaForPokemon(name: string): GenMeta | undefined {
  const gen = getPokemonGeneration(name);
  if (gen === undefined) return undefined;
  return GENERATION_META.find(m => m.gen === gen);
}

// Resolve the effective form based on held item (detects Mega Stones)
// Returns { species data for the correct form, the form name, isMega flag }
// Only species present in CHAMPIONS_MEGA_LIST can actually Mega Evolve —
// this prevents an accidental Mega Stone equip from fake-evolving a
// Pokemon whose Mega form isn't in Champions.
export function resolveForm(species: string, item: string): {
  data: ReturnType<typeof getPokemonData>;
  formName: string;
  isMega: boolean;
} {
  const baseData = getPokemonData(species);
  if (!baseData) return { data: undefined, formName: species, isMega: false };

  if (
    item &&
    hasChampionsMega(species) &&
    (item.endsWith('ite') || item.endsWith('ite X') || item.endsWith('ite Y'))
  ) {
    try {
      const megaFormName = CalcPokemon.getForme(9, species, item as any);
      if (megaFormName && megaFormName !== species) {
        const megaData = getPokemonData(megaFormName);
        if (megaData) {
          return { data: megaData, formName: megaFormName, isMega: true };
        }
      }
    } catch { /* fall through to base */ }

    // Fallback: Smogon calc's getForme doesn't know about every
    // Mega Stone → Mega form mapping (notably Floettite on
    // Floette-Eternal). If getForme returned the base species but a
    // sibling "{family}-Mega" entry exists, use that instead.
    // We strip any form suffix (e.g., "-Eternal") before appending
    // "-Mega" so Floette-Eternal + Floettite resolves to Floette-Mega.
    const baseFamily = species.replace(/-[^-]+$/, '');
    const directMegaName = `${baseFamily}-Mega`;
    const directMega = getPokemonData(directMegaName);
    if (directMega && directMegaName !== species) {
      return { data: directMega, formName: directMegaName, isMega: true };
    }

    // Z-A Mega fallback: Smogon calc ships no data for Z-A-new Mega
    // forms (Golurk-Mega, Delphox-Mega, etc.). Synthesize a species
    // object from the override table so UI + damage calc see the
    // correct stats/types/ability.
    const zaEntry = getZAMegaByStone(species, item);
    if (zaEntry) {
      return {
        data: buildZAMegaSpecies(zaEntry, baseData),
        formName: zaEntry.formName,
        isMega: true,
      };
    }
  }

  return { data: baseData, formName: species, isMega: false };
}

// Synthesize a Smogon-shaped Specie object from a Z-A Mega override
// entry, inheriting anything we don't explicitly override (gender,
// eggGroups, etc.) from the base species so downstream code that
// touches those fields doesn't blow up.
function buildZAMegaSpecies(
  entry: ZAMegaEntry,
  baseData: ReturnType<typeof getPokemonData>
): ReturnType<typeof getPokemonData> {
  if (!baseData) return baseData;
  return {
    ...baseData,
    name: entry.formName,
    types: entry.types,
    baseStats: entry.baseStats,
    weightkg: entry.weightkg,
    abilities: { 0: entry.ability },
  } as ReturnType<typeof getPokemonData>;
}

// ─── Moves ──────────────────────────────────────────────────────────
export function getAvailableMoves(): string[] {
  const moves: string[] = [];
  for (const move of gen9.moves) {
    moves.push(move.name);
  }
  return moves.sort();
}

export function getMoveData(name: string) {
  return gen9.moves.get(name.toLowerCase().replace(/[^a-z0-9]/g, '') as any);
}

// Champions-specific move BP changes
const MOVE_BP_OVERRIDES: Record<string, number> = {
  'First Impression': 100,
  'Grav Apple': 90,
};

export function getMoveBP(name: string): number | undefined {
  return MOVE_BP_OVERRIDES[name];
}

// ─── Abilities ──────────────────────────────────────────────────────
export const CHAMPIONS_NEW_ABILITIES = [
  { name: 'Piercing Drill', desc: 'Contact moves hit through Protect for 1/4 damage' },
  { name: 'Dragonize', desc: 'Normal-type moves become Dragon-type with 20% power boost' },
  { name: 'Mega Sol', desc: 'Moves act as if sun is up, regardless of weather' },
  { name: 'Spicy Spray', desc: 'Burns attackers when the Pokemon takes damage from a move' },
];

export function getAvailableAbilities(): string[] {
  const abilities: string[] = [];
  for (const ability of gen9.abilities) {
    abilities.push(ability.name);
  }
  CHAMPIONS_NEW_ABILITIES.forEach(a => {
    if (!abilities.includes(a.name)) abilities.push(a.name);
  });
  return abilities.sort();
}

/**
 * Get the legal abilities for a specific Pokemon in Champions.
 * Champions limits each Pokemon to 2 abilities (no hidden ability).
 * Returns [ability1, ability2] — may have 1 entry if both slots are the same.
 */
export function getPokemonAbilities(species: string): string[] {
  const data = getPokemonData(species);
  if (!data) return [];
  const abilities: string[] = [];
  // Smogon data: abilities = { 0: "Ability1", 1: "Ability2", H: "HiddenAbility", S: "Special" }
  const raw = data.abilities as Record<string, string>;
  if (raw['0']) abilities.push(raw['0']);
  if (raw['1'] && raw['1'] !== raw['0']) abilities.push(raw['1']);
  // No hidden ability in Champions — skip raw['H']
  return abilities;
}

// ─── Items ──────────────────────────────────────────────────────────
// Champions has a LIMITED item pool — use a whitelist from Game8's confirmed list
const CHAMPIONS_ITEMS = new Set([
  // Type-boost items (20% boost)
  'Black Belt', 'Black Glasses', 'Charcoal', 'Dragon Fang', 'Fairy Feather',
  'Hard Stone', 'Magnet', 'Metal Coat', 'Miracle Seed', 'Mystic Water',
  'Never-Melt Ice', 'Poison Barb', 'Sharp Beak', 'Silk Scarf', 'Silver Powder',
  'Soft Sand', 'Spell Tag', 'Twisted Spoon',
  // Competitive staples
  'Leftovers', 'Focus Sash', 'Choice Scarf', 'White Herb', 'Mental Herb',
  'Shell Bell', 'Scope Lens', 'Quick Claw', 'Focus Band',
  'King\'s Rock', 'Bright Powder', 'Light Ball',
  // Berries — recovery
  'Sitrus Berry', 'Lum Berry', 'Oran Berry', 'Leppa Berry',
  'Cheri Berry', 'Chesto Berry', 'Pecha Berry', 'Rawst Berry',
  'Aspear Berry', 'Persim Berry',
  // Berries — type resist (50% damage)
  'Occa Berry', 'Passho Berry', 'Wacan Berry', 'Rindo Berry',
  'Yache Berry', 'Chople Berry', 'Kebia Berry', 'Shuca Berry',
  'Coba Berry', 'Payapa Berry', 'Tanga Berry', 'Charti Berry',
  'Kasib Berry', 'Haban Berry', 'Colbur Berry', 'Babiri Berry',
  'Chilan Berry', 'Roseli Berry',
  // Mega Stones are added below from MEGA_STONE_MAP to keep them in
  // sync with the roster. Do NOT add stones inline — add the species
  // to championsRoster.ts::MEGA_STONE_MAP instead.
]);

// Pull every stone from MEGA_STONE_MAP into the item pool. This
// guarantees that if a species is legal to Mega Evolve, its stone is
// selectable in the UI.
for (const stones of Object.values(MEGA_STONE_MAP)) {
  for (const stone of stones) CHAMPIONS_ITEMS.add(stone);
}


export function getAvailableItems(): string[] {
  // Use whitelist — Champions has a curated item pool
  return Array.from(CHAMPIONS_ITEMS).sort();
}

// ─── Types ──────────────────────────────────────────────────────────
export const TYPES: TypeName[] = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'
];

// ─── Type Colors ────────────────────────────────────────────────────
export const TYPE_COLORS: Record<string, string> = {
  Normal: '#A8A77A',
  Fire: '#EE8130',
  Water: '#6390F0',
  Electric: '#F7D02C',
  Grass: '#7AC74C',
  Ice: '#96D9D6',
  Fighting: '#C22E28',
  Poison: '#A33EA1',
  Ground: '#E2BF65',
  Flying: '#A98FF3',
  Psychic: '#F95587',
  Bug: '#A6B91A',
  Rock: '#B6A136',
  Ghost: '#735797',
  Dragon: '#6F35FC',
  Dark: '#705746',
  Steel: '#B7B7CE',
  Fairy: '#D685AD',
  Stellar: '#44628B',
};

// ─── Status Conditions ──────────────────────────────────────────────
export const STATUS_CONDITIONS = [
  { id: '', label: 'Healthy' },
  { id: 'brn', label: 'Burned' },
  { id: 'par', label: 'Paralyzed' },
  { id: 'psn', label: 'Poisoned' },
  { id: 'tox', label: 'Badly Poisoned' },
  { id: 'slp', label: 'Asleep' },
  { id: 'frz', label: 'Frozen' },
] as const;

// ─── Stat Labels ────────────────────────────────────────────────────
export const STAT_IDS: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const STAT_LABELS: Record<StatID, string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe'
};
export const STAT_COLORS: Record<StatID, string> = {
  hp: '#FF5959',
  atk: '#F5AC78',
  def: '#FAE078',
  spa: '#9DB7F5',
  spd: '#A7DB8D',
  spe: '#FA92B2',
};

export { gen9 };
