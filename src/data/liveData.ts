// Live Data Layer
// Fetches real competitive data from Smogon/Showdown APIs
// Falls back to static data if fetch fails

import type { StatsTable } from '@smogon/calc';
import type { NatureName } from '../types';
import { getAvailablePokemon } from './champions';

// ─── Types ──────────────────────────────────────────────────────────

export interface UsageStats {
  battles: number;
  pokemon: Record<string, PokemonUsage>;
}

export interface PokemonUsage {
  usage: { raw: number; real: number; weighted: number };
  lead: { raw: number; real: number; weighted: number };
  count: number;
  viability: number[];
  abilities: Record<string, number>;
  items: Record<string, number>;
  moves: Record<string, number>;
  spreads: Record<string, number>;  // "Nature:HP/Atk/Def/SpA/SpD/Spe": weight
  teammates: Record<string, number>;
  teraTypes: Record<string, number>;
}

export interface LivePokemonSet {
  species: string;
  nature: NatureName;
  sps: StatsTable;
  ability: string;
  item: string;
  moves: string[];
  usagePercent: number;
}

export interface LiveTierEntry {
  species: string;
  usagePercent: number;
  viability: number;
  topMoves: { name: string; usage: number }[];
  topItems: { name: string; usage: number }[];
  topAbilities: { name: string; usage: number }[];
  topTeraTypes: { name: string; usage: number }[];
  topTeammates: { name: string; usage: number }[];
  topSpreads: LivePokemonSet[];
}

// ─── Data Fetching ──────────────────────────────────────────────────

const STATS_URL = 'https://pkmn.github.io/smogon/data/stats/gen9vgc2026.json';

let usageStatsCache: UsageStats | null = null;
let fetchPromise: Promise<UsageStats | null> | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 min cache

export async function fetchUsageStats(): Promise<UsageStats | null> {
  // Return cache if fresh
  if (usageStatsCache && Date.now() - lastFetchTime < CACHE_DURATION) {
    return usageStatsCache;
  }

  // Deduplicate concurrent requests
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const res = await fetch(STATS_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      usageStatsCache = data as UsageStats;
      lastFetchTime = Date.now();
      return usageStatsCache;
    } catch (e) {
      console.warn('Failed to fetch usage stats:', e);
      return null;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

// Sync access (returns cached data or null)
export function getCachedUsageStats(): UsageStats | null {
  return usageStatsCache;
}

// ─── Data Processing ────────────────────────────────────────────────

// Parse Smogon spread format "Adamant:4/252/0/0/0/252" → nature + EVs → SP conversion
function parseSpread(spreadStr: string): { nature: NatureName; sps: StatsTable } | null {
  const [natureName, evStr] = spreadStr.split(':');
  if (!natureName || !evStr) return null;

  const evParts = evStr.split('/').map(Number);
  if (evParts.length !== 6) return null;

  // Convert EVs to SP
  // VGC uses 510 EVs → Champions uses 66 SP
  // Scale proportionally: SP = round(EV / 510 * 66), cap at 32
  const totalEVs = evParts.reduce((a: number, b: number) => a + b, 0) || 510;
  const sps: StatsTable = {
    hp: Math.min(32, Math.round((evParts[0] / totalEVs) * 66)),
    atk: Math.min(32, Math.round((evParts[1] / totalEVs) * 66)),
    def: Math.min(32, Math.round((evParts[2] / totalEVs) * 66)),
    spa: Math.min(32, Math.round((evParts[3] / totalEVs) * 66)),
    spd: Math.min(32, Math.round((evParts[4] / totalEVs) * 66)),
    spe: Math.min(32, Math.round((evParts[5] / totalEVs) * 66)),
  };

  // Normalize to exactly 66 total SP
  let total = Object.values(sps).reduce((a, b) => a + b, 0);
  while (total > 66) {
    const entries = Object.entries(sps).filter(([, v]) => v > 0).sort((a, b) => a[1] - b[1]);
    if (entries.length === 0) break;
    (sps as any)[entries[0][0]]--;
    total--;
  }
  while (total < 66) {
    // Add to the highest-invested stat (likely main stat)
    const entries = Object.entries(sps).sort((a, b) => b[1] - a[1]);
    const target = entries.find(([, v]) => v < 32);
    if (!target) break;
    (sps as any)[target[0]]++;
    total++;
  }

  return { nature: natureName as NatureName, sps };
}

// Build a tier list from real usage data — filtered to Champions-legal
export function buildLiveTierList(stats: UsageStats): LiveTierEntry[] {
  const entries: LiveTierEntry[] = [];
  const championsPool = new Set(getAvailablePokemon());

  for (const [name, data] of Object.entries(stats.pokemon)) {
    if (data.usage.weighted < 0.01) continue;
    if (!championsPool.has(name)) continue; // Only Champions-legal Pokemon

    const topMoves = Object.entries(data.moves)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, usage]) => ({ name, usage }));

    const topItems = Object.entries(data.items)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, usage]) => ({ name, usage }));

    const topAbilities = Object.entries(data.abilities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, usage]) => ({ name, usage }));

    const topTeraTypes = Object.entries(data.teraTypes || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, usage]) => ({ name, usage }));

    const topTeammates = Object.entries(data.teammates)
      .filter(([n]) => championsPool.has(n))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, usage]) => ({ name, usage }));

    // Parse top spreads into sets
    const topSpreads: LivePokemonSet[] = [];
    const spreadEntries = Object.entries(data.spreads)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    for (const [spreadStr, weight] of spreadEntries) {
      const parsed = parseSpread(spreadStr);
      if (!parsed) continue;
      topSpreads.push({
        species: name,
        nature: parsed.nature,
        sps: parsed.sps,
        ability: topAbilities[0]?.name || '',
        item: topItems[0]?.name || '',
        moves: topMoves.slice(0, 4).map(m => m.name),
        usagePercent: weight * 100,
      });
    }

    entries.push({
      species: name,
      usagePercent: data.usage.weighted * 100,
      viability: data.viability?.[0] || 0,
      topMoves,
      topItems,
      topAbilities,
      topTeraTypes,
      topTeammates,
      topSpreads,
    });
  }

  entries.sort((a, b) => b.usagePercent - a.usagePercent);
  return entries;
}

// Get the most popular set for a Pokemon from usage data
export function getLiveSet(stats: UsageStats, species: string): LivePokemonSet | null {
  const data = stats.pokemon[species];
  if (!data) return null;

  const topSpread = Object.entries(data.spreads).sort((a, b) => b[1] - a[1])[0];
  if (!topSpread) return null;

  const parsed = parseSpread(topSpread[0]);
  if (!parsed) return null;

  const topMoves = Object.entries(data.moves)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name);

  const topAbility = Object.entries(data.abilities).sort((a, b) => b[1] - a[1])[0];
  const topItem = Object.entries(data.items).sort((a, b) => b[1] - a[1])[0];
  return {
    species,
    nature: parsed.nature,
    sps: parsed.sps,
    ability: topAbility?.[0] || '',
    item: topItem?.[0] || '',
    moves: topMoves,
    usagePercent: data.usage.weighted * 100,
  };
}

// Get teammate recommendations from live data — filtered to Champions-legal Pokemon
export function getLiveTeammates(stats: UsageStats, species: string): { name: string; usage: number }[] {
  const data = stats.pokemon[species];
  if (!data) return [];

  // Lazy import to avoid circular dependency
  const championsPool = new Set(getAvailablePokemon());

  return Object.entries(data.teammates)
    .filter(([name]) => championsPool.has(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, usage]) => ({ name, usage }));
}

// Assign tier from usage percentage
export function usageToTier(usage: number): string {
  if (usage >= 20) return 'S';
  if (usage >= 10) return 'A+';
  if (usage >= 5) return 'A';
  if (usage >= 2) return 'B';
  return 'C';
}
