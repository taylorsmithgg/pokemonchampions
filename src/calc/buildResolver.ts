// ─── Unified Build Resolver ────────────────────────────────────────
//
// SINGLE SOURCE OF TRUTH for resolving a Pokemon's competitive build.
// Every path in the app that needs a moveset, nature, item, SPs, or
// ability for a species MUST go through this function. No more
// conflicting builds from 6 different pipelines.
//
// Source priority (consistent everywhere):
//   1. Live VGC usage data (most accurate real-world signal)
//   2. Curated preset library (hand-tuned competitive builds)
//   3. Auto-generated preset (type/stat heuristic)
//   4. Bare minimum defaults (ability only, no moves)
//
// The resolver also handles:
//   - Consistent EV → SP conversion (proportional scaling to 66 total)
//   - Team-aware item deduplication
//   - Team-aware coverage gap filling (optional)

import { getPokemonData } from '../data/champions';
import { getPresetsBySpecies } from '../data/presets';
import { getCachedUsageStats } from '../data/liveData';
import { getAvailableItems } from '../data/champions';
import { suggestItems } from './itemOptimizer';
import { createDefaultPokemonState } from '../types';
import type { PokemonState, NatureName } from '../types';
import type { StatsTable } from '@smogon/calc';

// ─── SP conversion (single formula) ───────────────────────────────

function evsToSPs(evParts: number[]): StatsTable {
  const totalEVs = evParts.reduce((a, b) => a + b, 0) || 510;
  const sps: StatsTable = {
    hp:  Math.min(32, Math.round((evParts[0] / totalEVs) * 66)),
    atk: Math.min(32, Math.round((evParts[1] / totalEVs) * 66)),
    def: Math.min(32, Math.round((evParts[2] / totalEVs) * 66)),
    spa: Math.min(32, Math.round((evParts[3] / totalEVs) * 66)),
    spd: Math.min(32, Math.round((evParts[4] / totalEVs) * 66)),
    spe: Math.min(32, Math.round((evParts[5] / totalEVs) * 66)),
  };
  // Clamp total to exactly 66
  let total = Object.values(sps).reduce((a, b) => a + b, 0);
  while (total > 66) {
    const entries = Object.entries(sps).filter(([, v]) => v > 0).sort((a, b) => a[1] - b[1]);
    if (!entries.length) break;
    (sps as any)[entries[0][0]]--;
    total--;
  }
  while (total < 66) {
    const entries = Object.entries(sps).sort((a, b) => b[1] - a[1]);
    const target = entries.find(([, v]) => v < 32);
    if (!target) break;
    (sps as any)[target[0]]++;
    total++;
  }
  return sps;
}

// ─── Live set extraction ───────────────────────────────────────────

function extractLiveSet(species: string): PokemonState | null {
  const stats = getCachedUsageStats();
  if (!stats?.pokemon?.[species]) return null;
  const data = stats.pokemon[species];

  // Top spread
  const topSpread = Object.entries(data.spreads)
    .sort((a, b) => (b[1] as number) - (a[1] as number))[0];
  if (!topSpread) return null;

  const [spreadStr] = topSpread;
  const [natureName, evStr] = spreadStr.split(':');
  if (!natureName || !evStr) return null;

  const evParts = evStr.split('/').map(Number);
  if (evParts.length !== 6) return null;

  const sps = evsToSPs(evParts);

  // Top moves (Champions-legal check not needed — moveIndex handles it)
  const topMoves = Object.entries(data.moves)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 4)
    .map(([name]) => name);

  // Top ability
  const topAbility = Object.entries(data.abilities || {})
    .sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || '';

  // Top item (filtered to Champions-legal)
  const champItems = new Set(getAvailableItems());
  const topItem = Object.entries(data.items || {})
    .filter(([name]) => champItems.has(name))
    .sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || '';

  return {
    ...createDefaultPokemonState(),
    species,
    nature: natureName as NatureName,
    sps,
    ability: topAbility,
    item: topItem,
    moves: [...topMoves, '', '', '', ''].slice(0, 4),
  };
}

// ─── Main resolver ─────────────────────────────────────────────────

export interface BuildOptions {
  /** Items already taken by teammates — will be excluded. */
  teammateItems?: Set<string>;
  /** Full team for coverage gap analysis. */
  teammates?: PokemonState[];
}

/**
 * Resolve the best competitive build for a species. Uses a consistent
 * source priority everywhere in the app:
 *   1. Live VGC data (if available)
 *   2. Curated preset (if available)
 *   3. Auto-generated preset (always available for BST ≥ 400)
 *   4. Bare defaults (ability only)
 *
 * Optional team context adjusts items and coverage.
 */
export function resolveBuild(species: string, options?: BuildOptions): PokemonState {
  if (!species) return createDefaultPokemonState();

  const pokemonData = getPokemonData(species);
  if (!pokemonData) return { ...createDefaultPokemonState(), species };

  // ─── 1. Try live VGC data ─────────────────────────────────────
  const liveSet = extractLiveSet(species);

  // ─── 2. Try curated / auto preset ─────────────────────────────
  const presets = getPresetsBySpecies(species);
  const preset = presets[0];

  // ─── 3. Pick the best available build ─────────────────────────
  let build: PokemonState;

  if (liveSet && liveSet.moves.filter(Boolean).length > 0) {
    build = liveSet;
  } else if (preset) {
    build = {
      ...createDefaultPokemonState(),
      species,
      nature: preset.nature,
      ability: preset.ability,
      item: preset.item,
      sps: { ...preset.sps },
      moves: [...preset.moves, '', '', '', ''].slice(0, 4),
    };
  } else {
    // Bare minimum — just ability
    build = {
      ...createDefaultPokemonState(),
      species,
      ability: (pokemonData.abilities?.[0] || '') as string,
    };
  }

  // ─── 4. Team-aware adjustments ────────────────────────────────
  if (options?.teammateItems && options.teammateItems.has(build.item)) {
    const suggestions = suggestItems(build, options.teammateItems);
    if (suggestions.length > 0) {
      build = { ...build, item: suggestions[0].item };
    }
  }

  return build;
}

/**
 * Resolve a build and return metadata about which source was used.
 * Useful for audit logging and UI transparency.
 */
export function resolveBuildWithSource(species: string, options?: BuildOptions): {
  build: PokemonState;
  source: 'live' | 'preset' | 'auto' | 'default';
  sourceName: string;
} {
  if (!species) return { build: createDefaultPokemonState(), source: 'default', sourceName: 'Empty' };

  const pokemonData = getPokemonData(species);
  if (!pokemonData) return { build: { ...createDefaultPokemonState(), species }, source: 'default', sourceName: 'No data' };

  const liveSet = extractLiveSet(species);
  const presets = getPresetsBySpecies(species);
  const preset = presets[0];

  let build: PokemonState;
  let source: 'live' | 'preset' | 'auto' | 'default';
  let sourceName: string;

  if (liveSet && liveSet.moves.filter(Boolean).length > 0) {
    build = liveSet;
    source = 'live';
    sourceName = `VGC usage data (${liveSet.nature}, ${liveSet.item})`;
  } else if (preset) {
    build = {
      ...createDefaultPokemonState(),
      species,
      nature: preset.nature,
      ability: preset.ability,
      item: preset.item,
      sps: { ...preset.sps },
      moves: [...preset.moves, '', '', '', ''].slice(0, 4),
    };
    source = preset.name.includes('(Auto)') ? 'auto' : 'preset';
    sourceName = `${source === 'auto' ? 'Auto-generated' : 'Curated preset'}: "${preset.label}" (${preset.nature}, ${preset.item})`;
  } else {
    build = {
      ...createDefaultPokemonState(),
      species,
      ability: (pokemonData.abilities?.[0] || '') as string,
    };
    source = 'default';
    sourceName = 'No data available';
  }

  // Team-aware item dedup
  if (options?.teammateItems && options.teammateItems.has(build.item)) {
    const suggestions = suggestItems(build, options.teammateItems);
    if (suggestions.length > 0) {
      build = { ...build, item: suggestions[0].item };
      sourceName += ` (item swapped: ${suggestions[0].item})`;
    }
  }

  return { build, source, sourceName };
}
