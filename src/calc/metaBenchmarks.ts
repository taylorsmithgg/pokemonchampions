// Meta-aware benchmark engine
// Runs actual damage calculations against top-tier threats to find
// meaningful SP breakpoints for offense, defense, and speed

import { calculate, Pokemon, Move, Field } from '@smogon/calc';
import type { StatID, StatsTable } from '@smogon/calc';
import { NORMAL_TIER_LIST, MEGA_TIER_LIST } from '../data/tierlist';
import { getPokemonData, getNatureMod, MAX_STAT_SP, MAX_TOTAL_SP } from '../data/champions';
import { PRESETS } from '../data/presets';
import { getMetaRanking, getMetaWeight, getTopItem } from '../data/pikalyticsMeta';
import type { NatureName } from '../types';

// ─── Meta Threat Pool ───────────────────────────────────────────────
// Primary source: pikalytics tournament top-team usage. Threats are
// weighted by how often they actually show up in winning teams, not by
// editorial tier ranking. Tier list + presets remain a fallback for
// picks not yet in tournament data (Megas, new releases, theorymon).
//
// Weight scale (matches old tier convention):
//   3 = S — ≥30% tournament usage (Sneasler, Incineroar)
//   2 = A+ — 15-30% usage (Basculegion, Charizard)
//   1 = A — 5-15% usage (Whimsicott, Tyranitar)

interface MetaThreat {
  species: string;
  tier: string;
  weight: number;
  nature: NatureName;
  sps: StatsTable;
  item: string;
  ability: string;
  moves: string[];
}

function tierLabelFromWeight(w: number): string {
  if (w >= 3) return 'S';
  if (w >= 2) return 'A+';
  if (w >= 1) return 'A';
  return 'B';
}

function defaultThreatSpread(species: string, weight: number, tier: string): MetaThreat | null {
  const data = getPokemonData(species);
  if (!data) return null;
  const bs = data.baseStats;
  const isPhys = bs.atk > bs.spa;
  return {
    species,
    tier,
    weight,
    nature: isPhys ? 'Adamant' : 'Modest',
    sps: isPhys
      ? { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }
      : { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 },
    item: getTopItem(species) || 'Life Orb',
    ability: (data.abilities?.[0] || '') as string,
    moves: [],
  };
}

function threatFromPreset(species: string, weight: number, tier: string): MetaThreat | null {
  const preset = PRESETS.find(p => p.species === species);
  if (!preset) return null;
  // Override preset item with tournament-confirmed item when available —
  // tournament players have already optimized item choice for the metagame.
  const tournamentItem = getTopItem(species);
  return {
    species: preset.species,
    tier,
    weight,
    nature: preset.nature,
    sps: { ...preset.sps },
    item: tournamentItem || preset.item,
    ability: preset.ability,
    moves: [...preset.moves],
  };
}

function buildMetaThreats(): MetaThreat[] {
  const threats: MetaThreat[] = [];
  const seen = new Set<string>();

  // ─── Primary: pikalytics tournament data ──────────────────────────
  for (const { species } of getMetaRanking()) {
    const weight = getMetaWeight(species);
    if (weight === 0) continue;  // below 5% usage — not a benchmark target
    const tier = tierLabelFromWeight(weight);
    const built = threatFromPreset(species, weight, tier) || defaultThreatSpread(species, weight, tier);
    if (!built) continue;
    threats.push(built);
    seen.add(species);
  }

  // ─── Fallback: editorial tier list S/A+/A ─────────────────────────
  // Catches Megas and rare picks that haven't shown up in pikalytics data
  // yet. Tier weight used directly.
  const tierWeight: Record<string, number> = { S: 3, 'A+': 2, A: 1 };
  const relevantTiers = ['S', 'A+', 'A'];

  for (const entry of [...NORMAL_TIER_LIST, ...MEGA_TIER_LIST]) {
    if (!relevantTiers.includes(entry.tier)) continue;
    const speciesLookup = entry.isMega ? entry.name.replace('Mega ', '') : entry.name;
    if (seen.has(speciesLookup)) continue;
    const weight = tierWeight[entry.tier] || 1;
    const built = threatFromPreset(speciesLookup, weight, entry.tier) || defaultThreatSpread(speciesLookup, weight, entry.tier);
    if (!built) continue;
    threats.push(built);
    seen.add(speciesLookup);
  }

  return threats;
}

let metaThreatsCache: MetaThreat[] | null = null;

function getMetaThreats(): MetaThreat[] {
  if (!metaThreatsCache) metaThreatsCache = buildMetaThreats();
  return metaThreatsCache;
}

// ─── Calc Helpers ────────────────────────────────────────────────────

function buildPokemon(
  species: string,
  nature: NatureName,
  sps: StatsTable,
  item: string,
  ability: string,
  level: number = 50
): Pokemon | null {
  try {
    const evs: Partial<StatsTable> = {};
    for (const stat of ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as StatID[]) {
      evs[stat] = Math.min((sps[stat] || 0) * 4, 252);
    }
    return new Pokemon(9 as any, species, {
      level,
      nature: nature as any,
      evs,
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      item: (item || undefined) as any,
      ability: (ability || undefined) as any,
    });
  } catch {
    return null;
  }
}

function calcDamagePercent(
  attacker: Pokemon,
  defender: Pokemon,
  moveName: string
): { min: number; max: number } | null {
  try {
    const move = new Move(9 as any, moveName);
    const result = calculate(9 as any, attacker, defender, move, new Field());
    const range = result.range();
    const hp = defender.maxHP();
    return {
      min: (range[0] / hp) * 100,
      max: (range[1] / hp) * 100,
    };
  } catch {
    return null;
  }
}

// ─── Benchmark Types ─────────────────────────────────────────────────

export interface OffensiveBenchmark {
  target: string;
  targetTier: string;
  move: string;
  minSP: number;          // SP needed in Atk/SpA
  nature: NatureName;
  result: 'OHKO' | '2HKO';
  damageRange: string;    // e.g. "95.2% - 112.4%"
  importance: number;     // weight from tier
}

export interface DefensiveBenchmark {
  attacker: string;
  attackerTier: string;
  move: string;
  minHpSP: number;
  minDefSP: number;
  statInvested: 'def' | 'spd';
  nature: NatureName;
  result: 'survives' | 'needs-more';
  damageRange: string;
  importance: number;
}

export interface SpeedBenchmark {
  target: string;
  targetTier: string;
  targetSpeed: number;
  minSP: number;
  withNature: boolean;    // needs +Spe nature?
  yourSpeed: number;
  importance: number;
}

export interface MetaAnalysis {
  species: string;
  offensiveBenchmarks: OffensiveBenchmark[];
  defensiveBenchmarks: DefensiveBenchmark[];
  speedBenchmarks: SpeedBenchmark[];
  suggestedSpread: {
    name: string;
    nature: NatureName;
    sps: StatsTable;
    reasoning: string[];
  } | null;
}

// ─── Main Analysis Engine ────────────────────────────────────────────

export function analyzeForMeta(
  species: string,
  moves: string[],
  ability: string,
  item: string,
  level: number = 50
): MetaAnalysis {
  const data = getPokemonData(species);
  if (!data) return { species, offensiveBenchmarks: [], defensiveBenchmarks: [], speedBenchmarks: [], suggestedSpread: null };

  const bs = data.baseStats;
  const threats = getMetaThreats();
  const isPhys = bs.atk > bs.spa;
  const mainStat: StatID = isPhys ? 'atk' : 'spa';
  const offensiveBenchmarks: OffensiveBenchmark[] = [];
  const defensiveBenchmarks: DefensiveBenchmark[] = [];
  const speedBenchmarks: SpeedBenchmark[] = [];

  // ─── Offensive Benchmarks ─────────────────────────────────────
  // For each move, test against each threat at various SP levels
  const damagingMoves = moves.filter(m => {
    if (!m) return false;
    try {
      const move = new Move(9 as any, m);
      return move.category !== 'Status';
    } catch { return false; }
  });

  for (const moveName of damagingMoves) {
    for (const threat of threats) {
      // Build the threat as a defender with their preset spread
      const defender = buildPokemon(threat.species, threat.nature, threat.sps, threat.item, threat.ability, level);
      if (!defender) continue;

      // Binary search for minimum SP to OHKO
      const offNature: NatureName = isPhys ? 'Adamant' : 'Modest';
      const spdNature: NatureName = isPhys ? 'Jolly' : 'Timid';

      for (const nature of [offNature, spdNature]) {
        // Test with max SP
        const maxSps: StatsTable = { hp: 2, atk: 0, def: 0, spa: 0, spd: 0, spe: 32 };
        maxSps[mainStat] = 32;
        const maxAttacker = buildPokemon(species, nature, maxSps, item, ability, level);
        if (!maxAttacker) continue;

        const maxDmg = calcDamagePercent(maxAttacker, defender, moveName);
        if (!maxDmg) continue;

        if (maxDmg.min >= 100) {
          // Can OHKO — find minimum SP
          let minSP = 0;
          for (let sp = 0; sp <= MAX_STAT_SP; sp += 4) {
            const testSps = { ...maxSps, [mainStat]: sp };
            const testAtk = buildPokemon(species, nature, testSps, item, ability, level);
            if (!testAtk) continue;
            const dmg = calcDamagePercent(testAtk, defender, moveName);
            if (dmg && dmg.min >= 100) {
              minSP = sp;
              break;
            }
          }

          offensiveBenchmarks.push({
            target: threat.species,
            targetTier: threat.tier,
            move: moveName,
            minSP,
            nature,
            result: 'OHKO',
            damageRange: `${maxDmg.min.toFixed(1)}%-${maxDmg.max.toFixed(1)}%`,
            importance: threat.weight * (minSP <= 20 ? 2 : 1),
          });
        } else if (maxDmg.min >= 50) {
          // Can 2HKO
          offensiveBenchmarks.push({
            target: threat.species,
            targetTier: threat.tier,
            move: moveName,
            minSP: 32,
            nature,
            result: '2HKO',
            damageRange: `${maxDmg.min.toFixed(1)}%-${maxDmg.max.toFixed(1)}%`,
            importance: threat.weight,
          });
        }

        // Only show the best nature result
        if (maxDmg.min >= 50) break;
      }
    }
  }

  // ─── Defensive Benchmarks ──────────────────────────────────────
  // For each threat, calculate their strongest moves against us
  for (const threat of threats) {
    if (threat.moves.length === 0) continue;

    const damagingThreatMoves = threat.moves.filter(m => {
      try {
        const move = new Move(9 as any, m);
        return move.category !== 'Status';
      } catch { return false; }
    });

    for (const moveName of damagingThreatMoves) {
      const attacker = buildPokemon(threat.species, threat.nature, threat.sps, threat.item, threat.ability, level);
      if (!attacker) continue;

      // Determine if this is physical or special
      let moveCategory: 'Physical' | 'Special';
      try {
        const move = new Move(9 as any, moveName);
        moveCategory = move.category as 'Physical' | 'Special';
      } catch { continue; }

      const defStat: 'def' | 'spd' = moveCategory === 'Physical' ? 'def' : 'spd';
      const defNature: NatureName = defStat === 'def'
        ? (isPhys ? 'Impish' : 'Bold')
        : (isPhys ? 'Careful' : 'Calm');

      // Test if we can survive with max HP + Def investment
      const tankSps: StatsTable = { hp: 32, atk: 0, def: 0, spa: 0, spd: 2, spe: 0 };
      tankSps[defStat] = 32;

      const defender = buildPokemon(species, defNature, tankSps, item, ability, level);
      if (!defender) continue;

      const dmg = calcDamagePercent(attacker, defender, moveName);
      if (!dmg) continue;

      // Only show hits that are relevant (>30% damage even with investment)
      if (dmg.max < 30) continue;

      defensiveBenchmarks.push({
        attacker: threat.species,
        attackerTier: threat.tier,
        move: moveName,
        minHpSP: 32,
        minDefSP: 32,
        statInvested: defStat,
        nature: defNature,
        result: dmg.max < 100 ? 'survives' : 'needs-more',
        damageRange: `${dmg.min.toFixed(1)}%-${dmg.max.toFixed(1)}%`,
        importance: threat.weight * (dmg.max >= 100 ? 2 : 1),
      });
    }
  }

  // ─── Speed Benchmarks ──────────────────────────────────────────
  for (const threat of threats) {
    const threatData = getPokemonData(threat.species);
    if (!threatData) continue;

    const threatBaseSpe = threatData.baseStats.spe;

    // Calculate threat's speed with their preset
    const threatNatureMod = getNatureMod(threat.nature, 'spe');
    const threatSpeed = calcStatSimple('spe', threatBaseSpe, threat.sps.spe, level, threatNatureMod);

    // Find minimum SP to outspeed
    for (const withNature of [true, false]) {
      const natureMod = withNature ? 1.1 : 1.0;
      let minSP = -1;

      for (let sp = 0; sp <= MAX_STAT_SP; sp += 2) {
        const ourSpeed = calcStatSimple('spe', bs.spe, sp, level, natureMod);
        if (ourSpeed > threatSpeed) {
          minSP = sp;
          break;
        }
      }

      if (minSP >= 0 && minSP <= MAX_STAT_SP) {
        const ourSpeed = calcStatSimple('spe', bs.spe, minSP, level, natureMod);
        speedBenchmarks.push({
          target: threat.species,
          targetTier: threat.tier,
          targetSpeed: threatSpeed,
          minSP,
          withNature,
          yourSpeed: ourSpeed,
          importance: threat.weight * (minSP <= 16 ? 2 : 1), // Bonus if cheap to outspeed
        });
        break; // Only show best (with nature first)
      }
    }
  }

  // Sort all benchmarks by importance
  offensiveBenchmarks.sort((a, b) => b.importance - a.importance);
  defensiveBenchmarks.sort((a, b) => b.importance - a.importance);
  speedBenchmarks.sort((a, b) => b.importance - a.importance);

  // ─── Generate Meta-Optimized Spread ────────────────────────────
  const suggestedSpread = generateMetaSpread(
    species, bs, mainStat, isPhys,
    offensiveBenchmarks.slice(0, 5),
    defensiveBenchmarks.slice(0, 5),
    speedBenchmarks.slice(0, 5),
    level
  );

  return {
    species,
    offensiveBenchmarks: offensiveBenchmarks.slice(0, 8),
    defensiveBenchmarks: defensiveBenchmarks.slice(0, 8),
    speedBenchmarks: speedBenchmarks.slice(0, 8),
    suggestedSpread,
  };
}

function calcStatSimple(stat: StatID, base: number, sp: number, level: number, natureMod: number): number {
  if (stat === 'hp') {
    if (base === 1) return 1;
    return Math.floor(((2 * base + 31 + Math.floor(sp / 4)) * level) / 100) + level + 10;
  }
  return Math.floor(
    (Math.floor(((2 * base + 31 + Math.floor(sp / 4)) * level) / 100) + 5) * natureMod
  );
}

function generateMetaSpread(
  _species: string,
  bs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number },
  mainStat: StatID,
  isPhys: boolean,
  offBench: OffensiveBenchmark[],
  defBench: DefensiveBenchmark[],
  spdBench: SpeedBenchmark[],
  _level: number,
): MetaAnalysis['suggestedSpread'] {
  const reasoning: string[] = [];
  const sps: StatsTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  let remaining = MAX_TOTAL_SP;

  // 1. Speed — find the most important speed benchmark we can hit
  const bestSpd = spdBench.find(b => b.minSP <= 32);
  let nature: NatureName = isPhys ? 'Adamant' : 'Modest';

  if (bestSpd) {
    sps.spe = bestSpd.minSP;
    remaining -= bestSpd.minSP;
    if (bestSpd.withNature) {
      nature = isPhys ? 'Jolly' : 'Timid';
      reasoning.push(`${bestSpd.minSP} Spe (${bestSpd.yourSpeed}) to outspeed ${bestSpd.target} (${bestSpd.targetSpeed}) — ${nature} nature`);
    } else {
      reasoning.push(`${bestSpd.minSP} Spe (${bestSpd.yourSpeed}) outspeeds ${bestSpd.target} (${bestSpd.targetSpeed}) without +Spe nature`);
    }
  } else {
    // Can't outspeed threats efficiently — go bulky
    reasoning.push(`Can't efficiently outspeed meta threats — investing in bulk instead`);
  }

  // 2. Offense — check if max investment hits key OHKOs
  const keyOhko = offBench.find(b => b.result === 'OHKO' && b.minSP <= 32);
  if (keyOhko) {
    const offSP = Math.min(Math.max(keyOhko.minSP, 16), Math.min(32, remaining));
    sps[mainStat] = offSP;
    remaining -= offSP;
    reasoning.push(`${offSP} ${mainStat === 'atk' ? 'Atk' : 'SpA'} to ${keyOhko.result} ${keyOhko.target} with ${keyOhko.move}`);
  } else {
    // Default: invest as much as possible in offense
    const offSP = Math.min(32, remaining);
    sps[mainStat] = offSP;
    remaining -= offSP;
    reasoning.push(`Max ${mainStat === 'atk' ? 'Atk' : 'SpA'} (${offSP} SP) for general damage output`);
  }

  // 3. Bulk — distribute remaining into HP and the more important defensive stat
  if (remaining > 0) {
    // Check if any defensive benchmarks are critical
    const criticalHit = defBench.find(b => b.result === 'needs-more' && b.importance >= 4);
    if (criticalHit) {
      const bulkSP = Math.min(remaining, 32);
      sps.hp = bulkSP;
      remaining -= bulkSP;
      reasoning.push(`${bulkSP} HP to improve survivability vs ${criticalHit.attacker}'s ${criticalHit.move} (${criticalHit.damageRange})`);
    } else {
      sps.hp = Math.min(remaining, 32);
      remaining -= sps.hp;
      reasoning.push(`${sps.hp} HP for general bulk`);
    }
  }

  // 4. Distribute any remaining into the weaker defensive stat
  if (remaining > 0) {
    const weakerDef: StatID = bs.def <= bs.spd ? 'def' : 'spd';
    sps[weakerDef] = Math.min(remaining, MAX_STAT_SP);
    remaining -= sps[weakerDef];
    reasoning.push(`${sps[weakerDef]} ${weakerDef === 'def' ? 'Def' : 'SpD'} to shore up weaker side`);
  }

  // 5. Final check — dump any leftover into the strongest defensive stat
  if (remaining > 0) {
    const strongerDef: StatID = bs.def > bs.spd ? 'def' : 'spd';
    const add = Math.min(remaining, MAX_STAT_SP - sps[strongerDef]);
    sps[strongerDef] += add;
    remaining -= add;
  }
  // Absolute last resort
  if (remaining > 0) {
    sps.hp = Math.min(MAX_STAT_SP, sps.hp + remaining);
  }

  return {
    name: 'Meta-Optimized',
    nature,
    sps,
    reasoning,
  };
}
