// ─── Dynamic Move & Ability Index ──────────────────────────────────
//
// Scans presets, live VGC usage data, and @smogon/calc ability slots
// to build a searchable index of what moves + abilities each species
// competitively runs. NO hardcoded species lists.
//
// Used by: synergies.ts, singlesMetaProjection.ts, doublesMetaProjection.ts
//
// Adding a preset or updating live data automatically updates every
// downstream consumer on next page load.

import { getAvailablePokemon, getPokemonData } from './champions';
import { PRESETS } from './presets';
import { getCachedUsageStats } from './liveData';
import { WEATHER_SETTERS as WEATHER_SETTER_MAP, WEATHER_ABUSERS as WEATHER_ABUSER_MAP, ABILITY_SCORING } from './abilityClassification';

// ─── Move categories for classification ────────────────────────────

export const SETUP_MOVES = new Set([
  'Swords Dance', 'Dragon Dance', 'Nasty Plot', 'Calm Mind',
  'Quiver Dance', 'Shell Smash', 'Bulk Up', 'Iron Defense',
  'Coil', 'Growth', 'Agility', 'Rock Polish', 'Shift Gear',
  'Curse', 'Work Up',
]);

export const PHYSICAL_SETUP = new Set([
  'Swords Dance', 'Dragon Dance', 'Bulk Up', 'Coil', 'Curse',
]);

export const SPECIAL_SETUP = new Set([
  'Nasty Plot', 'Calm Mind', 'Quiver Dance',
]);

export const MIXED_SETUP = new Set([
  'Shell Smash', 'Growth', 'Work Up',
]);

export const HAZARD_MOVES = new Set([
  'Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web',
]);

export const HAZARD_REMOVAL_MOVES = new Set([
  'Rapid Spin', 'Defog', 'Tidy Up', 'Court Change',
]);

export const RECOVERY_MOVES = new Set([
  'Recover', 'Roost', 'Slack Off', 'Soft-Boiled', 'Moonlight',
  'Morning Sun', 'Synthesis', 'Shore Up', 'Strength Sap',
  'Wish', 'Rest', 'Giga Drain', 'Drain Punch', 'Leech Life',
  'Matcha Gotcha',
]);

export const PIVOT_MOVES = new Set([
  'U-turn', 'Volt Switch', 'Flip Turn', 'Parting Shot',
  'Teleport', 'Chilly Reception',
]);

export const SPREAD_GROUND_MOVES = new Set([
  'Earthquake', 'Bulldoze', 'High Horsepower',
]);

export const SUB_PASS_MOVES = new Set(['Shed Tail']);

export const PRIORITY_MOVES = new Set([
  'Extreme Speed', 'Aqua Jet', 'Jet Punch', 'Ice Shard',
  'Bullet Punch', 'Mach Punch', 'Quick Attack', 'Shadow Sneak',
  'Sucker Punch', 'First Impression', 'Accelerock', 'Water Shuriken',
  'Grassy Glide', 'Fake Out',
]);

export const PHAZING_MOVES = new Set([
  'Roar', 'Whirlwind', 'Dragon Tail', 'Circle Throw',
]);

export const STATUS_MOVES = new Set([
  'Will-O-Wisp', 'Thunder Wave', 'Toxic', 'Yawn', 'Sleep Powder',
  'Spore', 'Glare', 'Nuzzle', 'Stun Spore',
]);

export const TRICK_ROOM_MOVE = 'Trick Room';
export const TAILWIND_MOVE = 'Tailwind';

export const SACRIFICE_SCALE_MOVES = new Set(['Last Respects']);
export const SACRIFICE_SCALE_ABILITIES = new Set(['supreme overlord']);

export const REDIRECT_MOVES = new Set([
  'Follow Me', 'Rage Powder', 'Ally Switch',
]);

// ─── Lazy-built index ──────────────────────────────────────────────

let _moveIndex: Map<string, Set<string>> | null = null;
let _abilityIndex: Map<string, Set<string>> | null = null;

function ensureIndex() {
  if (_moveIndex) return;
  _moveIndex = new Map();
  _abilityIndex = new Map();

  const ensureMoves = (species: string): Set<string> => {
    if (!_moveIndex!.has(species)) _moveIndex!.set(species, new Set());
    return _moveIndex!.get(species)!;
  };
  const ensureAbilities = (species: string): Set<string> => {
    if (!_abilityIndex!.has(species)) _abilityIndex!.set(species, new Set());
    return _abilityIndex!.get(species)!;
  };

  // 1. Presets — curated competitive sets
  for (const preset of PRESETS) {
    const moves = ensureMoves(preset.species);
    for (const m of preset.moves) if (m) moves.add(m);
    ensureAbilities(preset.species).add(preset.ability);
  }

  // 2. Live VGC usage stats
  const stats = getCachedUsageStats();
  if (stats?.pokemon) {
    for (const [species, data] of Object.entries(stats.pokemon)) {
      const moves = ensureMoves(species);
      for (const moveName of Object.keys((data as any).moves || {})) {
        moves.add(moveName);
      }
      for (const abilityName of Object.keys((data as any).abilities || {})) {
        ensureAbilities(species).add(abilityName);
      }
    }
  }

  // 3. Gen 9 slot-0 abilities
  for (const species of getAvailablePokemon()) {
    const data = getPokemonData(species);
    if (!data?.abilities) continue;
    const abs = ensureAbilities(species);
    for (const slot of Object.values(data.abilities)) {
      abs.add(slot as string);
    }
  }
}

// ─── Query functions ───────────────────────────────────────────────

/** Check if a species is known to run any move in the given set. */
export function speciesRunsMove(species: string, moveSet: Set<string>): boolean {
  ensureIndex();
  const moves = _moveIndex!.get(species);
  if (moves) {
    for (const m of moves) if (moveSet.has(m)) return true;
  }
  return false;
}

/** Check if a species has a specific ability (any slot, preset, or live data). */
export function speciesHasAbility(species: string, abilityLower: string): boolean {
  ensureIndex();
  const abs = _abilityIndex!.get(species);
  if (abs) {
    for (const a of abs) if (a.toLowerCase() === abilityLower) return true;
  }
  return false;
}

/** Get all known moves for a species. */
export function getSpeciesMoves(species: string): Set<string> {
  ensureIndex();
  return _moveIndex!.get(species) ?? new Set();
}

/** Get all known abilities for a species. */
export function getSpeciesAbilities(species: string): Set<string> {
  ensureIndex();
  return _abilityIndex!.get(species) ?? new Set();
}

// ─── Derived classifiers ───────────────────────────────────────────

/** Does this species likely carry Earthquake (from preset or Ground-type + high Atk heuristic)? */
export function likelyHasSpreadEQ(species: string): boolean {
  if (speciesRunsMove(species, SPREAD_GROUND_MOVES)) return true;
  const data = getPokemonData(species);
  if (!data) return false;
  return (data.types as string[]).includes('Ground') && data.baseStats.atk >= 80;
}

/** Classify a species' setup move orientation from its known moves. */
export function classifySetupOrientation(species: string): 'physical' | 'special' | 'both' | null {
  const moves = getSpeciesMoves(species);
  let hasPhys = false;
  let hasSpec = false;
  for (const m of moves) {
    if (PHYSICAL_SETUP.has(m)) hasPhys = true;
    if (SPECIAL_SETUP.has(m)) hasSpec = true;
    if (MIXED_SETUP.has(m)) { hasPhys = true; hasSpec = true; }
  }
  if (hasPhys && hasSpec) return 'both';
  if (hasPhys) return 'physical';
  if (hasSpec) return 'special';
  // Fallback: infer from base stats if the species has any generic setup move
  if (speciesRunsMove(species, SETUP_MOVES)) {
    const data = getPokemonData(species);
    if (data) {
      if (data.baseStats.atk > data.baseStats.spa + 15) return 'physical';
      if (data.baseStats.spa > data.baseStats.atk + 15) return 'special';
      return 'both';
    }
  }
  return null;
}

/** Build a map of all Champions species that run setup moves, with their orientation. */
export function buildSetupIndex(): Record<string, 'physical' | 'special' | 'both'> {
  ensureIndex();
  const result: Record<string, 'physical' | 'special' | 'both'> = {};
  for (const species of getAvailablePokemon()) {
    const orientation = classifySetupOrientation(species);
    if (orientation) result[species] = orientation;
  }
  return result;
}

/** Build a set of all Champions species that run a given move category. */
export function buildMoveRoleSet(moveSet: Set<string>): Set<string> {
  ensureIndex();
  const result = new Set<string>();
  for (const species of getAvailablePokemon()) {
    if (speciesRunsMove(species, moveSet)) result.add(species);
  }
  return result;
}

/** Find species with high-impact abilities that have NO preset or live
 *  data — these are blind spots the system might be undervaluing. */
export function findBlindSpots(): Array<{ species: string; ability: string; reason: string }> {
  ensureIndex();
  const blindSpots: Array<{ species: string; ability: string; reason: string }> = [];

  for (const species of getAvailablePokemon()) {
    const moves = _moveIndex!.get(species);
    // Skip species that already have presets or live data (they're in the index)
    if (moves && moves.size > 0) continue;

    const data = getPokemonData(species);
    if (!data?.abilities) continue;
    for (const slot of Object.values(data.abilities)) {
      const abilityLower = (slot as string).toLowerCase();
      const bonus = ABILITY_SCORING[abilityLower];
      if (bonus && bonus.bonus >= 4) {
        blindSpots.push({
          species,
          ability: slot as string,
          reason: bonus.reason,
        });
      }
    }
  }
  return blindSpots;
}

/** Build a set of all Champions species with a given ability (case-insensitive). */
export function buildAbilitySet(abilityLower: string): Set<string> {
  ensureIndex();
  const result = new Set<string>();
  for (const species of getAvailablePokemon()) {
    if (speciesHasAbility(species, abilityLower)) result.add(species);
  }
  return result;
}

// ─── Weather / archetype core detection helpers ────────────────────
// These let projection engines discover weather setters, weather
// abusers, and archetype anchors from ability data instead of
// hardcoded species lists.

// Weather ability maps imported from abilityClassification.ts —
// single source of truth, no duplication.
const WEATHER_SETTER_ABILITIES = WEATHER_SETTER_MAP;
const WEATHER_ABUSER_ABILITIES = WEATHER_ABUSER_MAP;

export interface WeatherCore {
  weather: string;
  setters: string[];
  abusers: string[];
}

/** Discover all weather cores from the Champions roster by scanning abilities. */
export function discoverWeatherCores(): WeatherCore[] {
  ensureIndex();
  const settersByWeather = new Map<string, string[]>();
  const abusersByWeather = new Map<string, string[]>();

  for (const species of getAvailablePokemon()) {
    const abilities = getSpeciesAbilities(species);
    for (const ability of abilities) {
      const lower = ability.toLowerCase();
      const setWeather = WEATHER_SETTER_ABILITIES[lower];
      if (setWeather) {
        if (!settersByWeather.has(setWeather)) settersByWeather.set(setWeather, []);
        settersByWeather.get(setWeather)!.push(species);
      }
      const abuseWeather = WEATHER_ABUSER_ABILITIES[lower];
      if (abuseWeather) {
        if (!abusersByWeather.has(abuseWeather)) abusersByWeather.set(abuseWeather, []);
        abusersByWeather.get(abuseWeather)!.push(species);
      }
    }
  }

  const cores: WeatherCore[] = [];
  for (const [weather, setters] of settersByWeather) {
    cores.push({
      weather,
      setters,
      abusers: abusersByWeather.get(weather) ?? [],
    });
  }
  return cores;
}

/** Get all species that set a specific weather via ability. */
export function getWeatherSetters(weather: string): string[] {
  return discoverWeatherCores().find(c => c.weather === weather)?.setters ?? [];
}

/** Get all species that abuse a specific weather via ability. */
export function getWeatherAbusers(weather: string): string[] {
  return discoverWeatherCores().find(c => c.weather === weather)?.abusers ?? [];
}
