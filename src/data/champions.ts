// Pokemon Champions data layer
// Wraps @smogon/calc Gen 9 data with Champions-specific modifications

import { Generations, Pokemon as CalcPokemon } from '@smogon/calc';
import type { StatID } from '@smogon/calc';
import type { NatureName, TypeName } from '../types';
import { CHAMPIONS_POKEMON_LIST, CHAMPIONS_MEGA_LIST } from './championsRoster';

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
}

export function getAvailablePokemon(): string[] {
  initChampionsPokemon();
  return Array.from(CHAMPIONS_POKEMON_SET).sort();
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

  // Mega forms (Foo-Mega, Foo-Mega-X, Foo-Mega-Y)
  const megaMatch = name.match(/^(.+?)-Mega(?:-[XY])?$/);
  if (megaMatch && CHAMPIONS_MEGA_SET.has(megaMatch[1])) return true;

  // "Mega Foo" / "Mega Foo X" display-name format (used in tier list)
  const megaDisplayMatch = name.match(/^Mega (.+?)(?: [XY])?$/);
  if (megaDisplayMatch && CHAMPIONS_MEGA_SET.has(megaDisplayMatch[1])) return true;

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
  }

  return { data: baseData, formName: species, isMega: false };
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
  // ─── Mega Stones ──────────────────────────────────────────────
  // IMPORTANT: Every stone here MUST have a corresponding base species
  // in CHAMPIONS_MEGA_LIST (src/data/championsRoster.ts). Adding a stone
  // without a valid Mega will let users "equip" a fake evolution.
  // Original Mega Stones (Gens VI/VII)
  'Venusaurite', 'Charizardite X', 'Charizardite Y', 'Blastoisinite',
  'Beedrillite', 'Pidgeotite', 'Alakazite', 'Slowbronite', 'Gengarite',
  'Kangaskhanite', 'Pinsirite', 'Gyaradosite', 'Aerodactylite',
  'Ampharosite', 'Steelixite', 'Scizorite', 'Heracronite', 'Houndoominite',
  'Tyranitarite', 'Gardevoirite', 'Sablenite', 'Aggronite', 'Medichamite',
  'Manectite', 'Sharpedonite', 'Cameruptite', 'Altarianite', 'Banettite',
  'Absolite', 'Glalitite', 'Lopunnite', 'Garchompite', 'Lucarionite',
  'Abomasite', 'Galladite', 'Audinite',
  // Z-A Mega Stones for Pokemon confirmed to have Megas in Champions
  'Dragoninite',   // Mega Dragonite
  'Meganiumite',   // Mega Meganium
  'Feraligite',    // Mega Feraligatr
  'Skarmorite',    // Mega Skarmory
  'Clefablite',    // Mega Clefable
  'Victreebelite', // Mega Victreebel
  'Starminite',    // Mega Starmie
  'Chimechite',    // Mega Chimecho
  'Froslassite',   // Mega Froslass
  'Emboarite',     // Mega Emboar
]);


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
