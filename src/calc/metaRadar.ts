// Meta Radar — Continuous Meta Analysis Engine
// Dynamically scores, ranks, and discovers strategies by cross-referencing:
// 1. Live Smogon usage data (refreshed periodically)
// 2. Champions roster constraints (filtered Pokemon/items/moves)
// 3. Type chart analysis against the actual available pool
// 4. Teammate correlation data for emerging cores
// 5. Ability/item distribution shifts
//
// This runs as a reactive computation — recalculates when data changes

import { getAvailablePokemon, getPokemonData, getDefensiveMultiplier } from '../data/champions';
import { NORMAL_TIER_LIST } from '../data/tierlist';
import { PRESETS } from '../data/presets';
import type { UsageStats, PokemonUsage } from '../data/liveData';
import { getMetaUsage, getMetaTeammates } from '../data/pikalyticsMeta';

// ─── Types ──────────────────────────────────────────────────────────

export interface MetaScore {
  species: string;
  score: number;              // 0-100 composite score
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  trend: 'rising' | 'stable' | 'falling' | 'new';
  components: {
    offensiveThreat: number;  // 0-25: how hard to wall
    defensiveValue: number;   // 0-25: how many threats it walls
    speedControl: number;     // 0-15: speed tier value
    roleValue: number;        // 0-15: Intimidate, Fake Out, redirect, etc.
    usageSignal: number;      // 0-10: live usage data signal
    synergyDensity: number;   // 0-10: how many strong partners
  };
  topMoves: string[];
  topItem: string;
  topTeammates: string[];
  insight: string;
}

export interface EmergingCore {
  pokemon: [string, string];
  pairing: number;           // 0-100 how often they appear together
  winCondition: string;
  coverage: number;          // % of meta hit SE
}

export interface MetaReport {
  timestamp: number;
  rankings: MetaScore[];
  emergingCores: EmergingCore[];
  risingThreats: MetaScore[];
  fallingPicks: MetaScore[];
  insights: string[];
  healthScore: number;       // 0-100 meta diversity
}

// ─── Scoring Engine ─────────────────────────────────────────────────


function scoreOffensiveThreat(species: string, pool: string[]): number {
  const data = getPokemonData(species);
  if (!data) return 0;
  const types = [...data.types] as string[];
  const bs = data.baseStats;
  const power = Math.max(bs.atk, bs.spa);

  // Count Pokemon in pool that can't resist this Pokemon's STAB
  let unresisted = 0;
  const sample = pool.slice(0, 80);
  for (const target of sample) {
    const tData = getPokemonData(target);
    if (!tData || target === species) continue;
    let canResist = false;
    for (const atkType of types) {
      if (getDefensiveMultiplier(atkType, [...tData.types] as string[]) <= 0.5) {
        canResist = true;
        break;
      }
    }
    if (!canResist) unresisted++;
  }

  const coverageScore = (unresisted / sample.length) * 15;
  const powerScore = Math.min(10, (power - 70) / 8);
  return Math.min(25, Math.round(coverageScore + powerScore));
}

function scoreDefensiveValue(species: string, pool: string[]): number {
  const data = getPokemonData(species);
  if (!data) return 0;
  const types = [...data.types] as string[];
  const bs = data.baseStats;

  // Count resistances against meta attackers
  let walls = 0;
  const attackers = pool.filter(n => {
    const d = getPokemonData(n);
    return d && (d.baseStats.atk >= 85 || d.baseStats.spa >= 85);
  }).slice(0, 50);

  for (const attacker of attackers) {
    const aData = getPokemonData(attacker);
    if (!aData) continue;
    let resists = false;
    for (const atkType of aData.types) {
      if (getDefensiveMultiplier(atkType as string, types) < 1) {
        resists = true;
        break;
      }
    }
    if (resists) walls++;
  }

  const bulkIndex = (bs.hp * bs.def + bs.hp * bs.spd) / 2;
  const bulkScore = Math.min(10, (bulkIndex - 5000) / 1500);
  const wallScore = (walls / attackers.length) * 15;
  return Math.min(25, Math.round(wallScore + bulkScore));
}

function scoreSpeedControl(species: string): number {
  const data = getPokemonData(species);
  if (!data) return 0;
  const spe = data.baseStats.spe;

  if (spe >= 120) return 15;
  if (spe >= 100) return 12;
  if (spe >= 80) return 8;
  if (spe <= 40) return 10; // Trick Room value
  if (spe <= 60) return 6;  // Slow but usable in TR
  return 4;
}

function scoreRoleValue(species: string, liveData?: PokemonUsage): number {
  const data = getPokemonData(species);
  if (!data) return 0;
  let score = 0;

  const ability = (data.abilities?.[0] || '') as string;
  if (ability === 'Intimidate') score += 8;
  if (ability === 'Regenerator') score += 5;
  if (ability === 'Good as Gold') score += 6;
  if (['Drought', 'Drizzle', 'Sand Stream', 'Snow Warning'].includes(ability)) score += 5;
  if (['Grassy Surge', 'Electric Surge', 'Psychic Surge', 'Misty Surge'].includes(ability)) score += 4;
  if (ability === 'Prankster') score += 5;

  // Check move-based roles from live data
  if (liveData) {
    const moves = Object.keys(liveData.moves);
    if (moves.includes('Fake Out')) score += 4;
    if (moves.includes('Tailwind')) score += 4;
    if (moves.includes('Trick Room')) score += 4;
    if (moves.includes('Rage Powder') || moves.includes('Follow Me')) score += 3;
    if (moves.includes('Parting Shot') || moves.includes('U-turn') || moves.includes('Volt Switch')) score += 2;
  }

  // Preset bonus — has a curated competitive set
  if (PRESETS.some(p => p.species === species)) score += 2;

  return Math.min(15, score);
}

function scoreUsageSignal(species: string, liveStats?: UsageStats | null): number {
  // Combine pikalytics tournament usage (Champions-specific, up to 14
  // points) with Smogon ladder usage (transferable signal, up to 6
  // points). Tournament data is the stronger signal so it dominates.
  const tournamentUsage = getMetaUsage(species);
  const tournamentScore = Math.min(14, tournamentUsage * 0.25);

  let ladderScore = 0;
  if (liveStats?.pokemon?.[species]) {
    const usage = liveStats.pokemon[species].usage.weighted;
    ladderScore = Math.min(6, usage * 15);
  }
  return Math.round(tournamentScore + ladderScore);
}

function scoreSynergyDensity(species: string, liveStats?: UsageStats | null, pool?: Set<string>): number {
  // Pikalytics tournament co-occurrence is the stronger synergy signal —
  // these are partners that actually won together. Ladder data is fallback.
  const tournamentPartners = getMetaTeammates(species, 50);
  let tournamentScore = 0;
  for (const p of tournamentPartners) {
    if (pool && !pool.has(p.species)) continue;
    if (p.percent >= 40) tournamentScore += 3;
    else if (p.percent >= 20) tournamentScore += 1.5;
  }
  if (tournamentScore > 0) return Math.min(10, Math.round(tournamentScore));

  if (!liveStats?.pokemon?.[species]) return 0;
  const teammates = liveStats.pokemon[species].teammates;
  let strongPartners = 0;
  for (const [partner, rate] of Object.entries(teammates)) {
    if (pool && !pool.has(partner)) continue;
    if (rate > 0.2) strongPartners++;
  }

  return Math.min(10, strongPartners * 2);
}

// ─── Core Detection ─────────────────────────────────────────────────

function findEmergingCores(liveStats: UsageStats | null, pool: Set<string>): EmergingCore[] {
  if (!liveStats) return [];
  const cores: EmergingCore[] = [];
  const checked = new Set<string>();

  for (const [speciesA, dataA] of Object.entries(liveStats.pokemon)) {
    if (!pool.has(speciesA)) continue;

    for (const [speciesB, rate] of Object.entries(dataA.teammates)) {
      if (!pool.has(speciesB)) continue;
      const key = [speciesA, speciesB].sort().join('+');
      if (checked.has(key)) continue;
      checked.add(key);

      if (rate < 0.25) continue; // Must be paired >25% of the time

      // Calculate combined coverage
      const aData = getPokemonData(speciesA);
      const bData = getPokemonData(speciesB);
      if (!aData || !bData) continue;

      const combinedTypes = new Set([...aData.types, ...bData.types]);
      let hitsSE = 0;
      let total = 0;
      for (const target of pool) {
        const tData = getPokemonData(target);
        if (!tData) continue;
        total++;
        for (const atkType of combinedTypes) {
          if (getDefensiveMultiplier(atkType as string, [...tData.types] as string[]) > 1) {
            hitsSE++;
            break;
          }
        }
      }
      const coverage = total > 0 ? (hitsSE / total) * 100 : 0;

      // Determine win condition
      const aAbility = (aData.abilities?.[0] || '') as string;
      const bAbility = (bData.abilities?.[0] || '') as string;
      let winCondition = 'Offensive pressure';
      if (aAbility === 'Intimidate' || bAbility === 'Intimidate') winCondition = 'Intimidate + attacker';
      if (['Drought', 'Drizzle', 'Sand Stream', 'Snow Warning'].includes(aAbility) ||
          ['Drought', 'Drizzle', 'Sand Stream', 'Snow Warning'].includes(bAbility)) winCondition = 'Weather core';
      if (aData.baseStats.spe <= 50 || bData.baseStats.spe <= 50) winCondition = 'Trick Room core';

      cores.push({
        pokemon: [speciesA, speciesB],
        pairing: Math.round(rate * 100),
        winCondition,
        coverage: Math.round(coverage),
      });
    }
  }

  cores.sort((a, b) => b.pairing - a.pairing);
  return cores.slice(0, 10);
}

// ─── Main Report Generator ──────────────────────────────────────────

export function generateMetaReport(liveStats: UsageStats | null): MetaReport {
  const poolList = getAvailablePokemon().filter(n =>
    !n.includes('-') || ['-Alola', '-Galar', '-Wash', '-Heat', '-Mow'].some(s => n.includes(s))
  );
  const pool = new Set(poolList);

  // Score every viable Pokemon
  const allScores: MetaScore[] = [];

  for (const species of poolList) {
    const data = getPokemonData(species);
    if (!data) continue;
    const bs = data.baseStats;
    // Skip pure walls with no offensive presence (BST too low)
    if (bs.atk < 60 && bs.spa < 60 && bs.hp + bs.def + bs.spd < 250) continue;

    const liveData = liveStats?.pokemon?.[species];
    const components = {
      offensiveThreat: scoreOffensiveThreat(species, poolList),
      defensiveValue: scoreDefensiveValue(species, poolList),
      speedControl: scoreSpeedControl(species),
      roleValue: scoreRoleValue(species, liveData),
      usageSignal: scoreUsageSignal(species, liveStats),
      synergyDensity: scoreSynergyDensity(species, liveStats, pool),
    };

    const score = Object.values(components).reduce((a, b) => a + b, 0);

    // Determine tier from score
    let tier: MetaScore['tier'];
    if (score >= 60) tier = 'S';
    else if (score >= 45) tier = 'A';
    else if (score >= 30) tier = 'B';
    else if (score >= 18) tier = 'C';
    else tier = 'D';

    // Determine trend by comparing dynamic radar score to a baseline.
    // Baseline = max of editorial tier rank and tournament-usage rank,
    // so a Pokemon that's S in pikalytics but C in editorial tier list
    // doesn't get incorrectly flagged as "rising".
    const staticTier = NORMAL_TIER_LIST.find(e => e.name === species);
    const staticTierScore: Record<string, number> = { S: 5, 'A+': 4, A: 3, B: 2, C: 1 };
    const dynamicTierScore: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };
    const editorialVal = staticTier ? (staticTierScore[staticTier.tier] || 0) : 0;

    const tournamentUsage = getMetaUsage(species);
    let tournamentVal = 0;
    if (tournamentUsage >= 30) tournamentVal = 5;
    else if (tournamentUsage >= 15) tournamentVal = 4;
    else if (tournamentUsage >= 5) tournamentVal = 3;
    else if (tournamentUsage >= 1) tournamentVal = 2;

    const baselineVal = Math.max(editorialVal, tournamentVal);
    const dynamicVal = dynamicTierScore[tier] || 0;

    let trend: MetaScore['trend'] = 'stable';
    if (baselineVal === 0) trend = 'new';
    else if (dynamicVal > baselineVal) trend = 'rising';
    else if (dynamicVal < baselineVal) trend = 'falling';

    // Extract top moves/items/teammates from live data
    const topMoves = liveData
      ? Object.entries(liveData.moves).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n]) => n)
      : [];
    const topItem = liveData
      ? Object.entries(liveData.items).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
      : '';
    const topTeammates = liveData
      ? Object.entries(liveData.teammates)
          .filter(([n]) => pool.has(n))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([n]) => n)
      : [];

    // Generate insight
    let insight = '';
    if (trend === 'rising') insight = `${species} is performing above its static ranking — consider building around it`;
    else if (trend === 'falling') insight = `${species} may be overrated in current tier list — meta is shifting away`;
    else if (trend === 'new') insight = `${species} isn't in the static tier list but scores well dynamically`;
    else if (components.offensiveThreat >= 20) insight = `Very few Pokemon can wall ${species}'s STAB — dominant offensive threat`;
    else if (components.defensiveValue >= 20) insight = `${species} walls a huge portion of the meta — premier defensive pick`;
    else if (components.roleValue >= 12) insight = `${species} provides critical team support roles`;

    allScores.push({
      species, score, tier, trend, components,
      topMoves, topItem, topTeammates, insight,
    });
  }

  allScores.sort((a, b) => b.score - a.score);

  // Extract rising/falling
  const risingThreats = allScores.filter(s => s.trend === 'rising').slice(0, 5);
  const fallingPicks = allScores.filter(s => s.trend === 'falling').slice(0, 5);

  // Emerging cores
  const emergingCores = findEmergingCores(liveStats, pool);

  // Meta health — diversity score
  const top10Usage = allScores.slice(0, 10).reduce((s, p) => s + p.components.usageSignal, 0);
  const healthScore = Math.max(0, Math.min(100, 100 - top10Usage * 2));

  // Generate insights
  const insights: string[] = [];
  if (risingThreats.length > 0) {
    insights.push(`Rising threats: ${risingThreats.map(s => s.species).join(', ')} are outperforming their tier rankings`);
  }
  if (emergingCores.length > 0) {
    insights.push(`Strongest core: ${emergingCores[0].pokemon.join(' + ')} (${emergingCores[0].pairing}% pairing rate, ${emergingCores[0].coverage}% coverage)`);
  }
  const weatherDominant = allScores.find(s => {
    const data = getPokemonData(s.species);
    const ability = (data?.abilities?.[0] || '') as string;
    return ['Drought', 'Drizzle', 'Sand Stream', 'Snow Warning'].includes(ability) && s.score >= 40;
  });
  if (weatherDominant) {
    insights.push(`Weather advantage: ${weatherDominant.species} is a top-tier weather setter with few competitors`);
  }

  return {
    timestamp: Date.now(),
    rankings: allScores.slice(0, 30),
    emergingCores,
    risingThreats,
    fallingPicks,
    insights,
    healthScore,
  };
}
