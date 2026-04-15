// Loader + typed accessors for the pikalytics tournament snapshot.
// Snapshot lives in pikalyticsTopTeams.json, refreshed by
// scripts/scrape-pikalytics.mjs on a CI cron.
//
// This is the AUTHORITATIVE source for "what wins Champions tournaments".
// Use it to weight viability, threat selection, partner suggestions, and
// archetype detection — Smogon ladder data is broader but biased toward
// VGC mons (Calyrex/Miraidon) that are banned in Champions.

import snapshot from './pikalyticsTopTeams.json';

export interface PikalyticsTeam {
  ranking: number;
  author: string;
  record: string;
  wins: number;
  losses: number;
  ties: number;
  archetypes: string[];
  tournamentLabel: string;
  tournamentId: string;
  link: string;
  pokemon: { name: string; item: string }[];
}

export interface PikalyticsSnapshot {
  source: string;
  format: string;
  formatLabel: string;
  scrapedAt: string;
  totalTeams: number;
  archetypeUsage: Record<string, number>;
  pokemonUsagePercent: Record<string, number>;
  pokemonUsageCount: Record<string, number>;
  itemByPokemon: Record<string, Record<string, number>>;
  teammates: Record<string, Record<string, number>>;
  teams: PikalyticsTeam[];
}

const data = snapshot as PikalyticsSnapshot;

export function getSnapshotMeta(): { scrapedAt: string; totalTeams: number; source: string } {
  return { scrapedAt: data.scrapedAt, totalTeams: data.totalTeams, source: data.source };
}

// Tournament usage % for a species (0-100). 0 if not seen.
export function getMetaUsage(species: string): number {
  return data.pokemonUsagePercent[species] ?? 0;
}

// Discrete weight scale matching the existing tier-weight convention
// (S=3, A+=2, A=1, below = 0). Used by benchmark/discovery engines.
export function getMetaWeight(species: string): number {
  const u = getMetaUsage(species);
  if (u >= 30) return 3;     // S — 30%+ of tournament teams
  if (u >= 15) return 2;     // A+ — 15-30%
  if (u >= 5) return 1;      // A — 5-15%
  return 0;
}

// Inverse of usageToTier — returns a tier label from tournament usage.
export function getMetaTier(species: string): 'S' | 'A+' | 'A' | 'B' | 'C' | null {
  const u = getMetaUsage(species);
  if (u >= 30) return 'S';
  if (u >= 15) return 'A+';
  if (u >= 5) return 'A';
  if (u >= 1) return 'B';
  if (u > 0) return 'C';
  return null;
}

// Pokemon ranked by tournament usage, highest first.
export function getMetaRanking(): { species: string; usagePercent: number }[] {
  return Object.entries(data.pokemonUsagePercent)
    .map(([species, usagePercent]) => ({ species, usagePercent }))
    .sort((a, b) => b.usagePercent - a.usagePercent);
}

// Top species in the meta — used to seed threat pools.
export function getTopMeta(n = 20): string[] {
  return getMetaRanking().slice(0, n).map((e) => e.species);
}

// Most common item carried on this species in tournament play.
export function getTopItem(species: string): string | null {
  const items = data.itemByPokemon[species];
  if (!items) return null;
  const sorted = Object.entries(items).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

// Item usage breakdown for a species, sorted by frequency.
export function getItemBreakdown(species: string): { item: string; count: number; percent: number }[] {
  const items = data.itemByPokemon[species];
  if (!items) return [];
  const total = Object.values(items).reduce((a, b) => a + b, 0);
  return Object.entries(items)
    .sort((a, b) => b[1] - a[1])
    .map(([item, count]) => ({ item, count, percent: +(count / total * 100).toFixed(1) }));
}

// Co-occurrence partners ranked by frequency. Useful for synergies engine.
export function getMetaTeammates(species: string, limit = 10): { species: string; count: number; percent: number }[] {
  const partners = data.teammates[species];
  if (!partners) return [];
  const ownCount = data.pokemonUsageCount[species] || 0;
  return Object.entries(partners)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([sp, count]) => ({
      species: sp,
      count,
      // % of teams running `species` that also ran `sp`
      percent: ownCount > 0 ? +(count / ownCount * 100).toFixed(1) : 0,
    }));
}

// Archetype frequency across all top teams (tailwind, trick-room, sun, etc).
export function getArchetypeUsage(): { archetype: string; count: number; percent: number }[] {
  const total = data.totalTeams;
  return Object.entries(data.archetypeUsage)
    .sort((a, b) => b[1] - a[1])
    .map(([archetype, count]) => ({
      archetype,
      count,
      percent: +(count / total * 100).toFixed(1),
    }));
}

// Raw team list — for browsing in UI ("see what lukasjoel1 ran").
export function getTopTeams(limit = 50): PikalyticsTeam[] {
  return data.teams.slice(0, limit);
}

// Quick membership check — has this Pokemon shown up in any top team?
export function isMetaRelevant(species: string): boolean {
  return getMetaUsage(species) > 0;
}
