// SP Spread Optimizer
// Algorithmically determines optimal Stat Point allocations based on
// base stats, nature, role, and speed benchmarks

import type { StatID, StatsTable } from '@smogon/calc';
import { MAX_TOTAL_SP, MAX_STAT_SP, getNatureMod } from '../data/champions';
import { getAvailablePokemon, getPokemonData } from '../data/champions';
import type { NatureName } from '../types';

// Gen 9 data used via champions.ts helpers

// ─── Stat Calculation ────────────────────────────────────────────────

function calcStat(stat: StatID, base: number, sp: number, level: number, natureMod: number): number {
  if (stat === 'hp') {
    if (base === 1) return 1; // Shedinja
    return Math.floor(((2 * base + 31 + Math.floor(sp / 4)) * level) / 100) + level + 10;
  }
  return Math.floor(
    (Math.floor(((2 * base + 31 + Math.floor(sp / 4)) * level) / 100) + 5) * natureMod
  );
}

// ─── Speed Benchmarks ────────────────────────────────────────────────
// Dynamically build speed tiers from all available Pokemon

interface SpeedBenchmark {
  species: string;
  baseSpe: number;
  maxSpe: number;       // max speed at Lv50 (32 SP, +nature)
  neutralMaxSpe: number; // max speed at Lv50 (32 SP, neutral nature)
}

let speedBenchmarksCache: SpeedBenchmark[] | null = null;

function getSpeedBenchmarks(): SpeedBenchmark[] {
  if (speedBenchmarksCache) return speedBenchmarksCache;

  const benchmarks: SpeedBenchmark[] = [];
  for (const name of getAvailablePokemon()) {
    const data = getPokemonData(name);
    if (!data) continue;
    const baseSpe = data.baseStats.spe;
    benchmarks.push({
      species: data.name,
      baseSpe,
      maxSpe: calcStat('spe', baseSpe, MAX_STAT_SP, 50, 1.1),
      neutralMaxSpe: calcStat('spe', baseSpe, MAX_STAT_SP, 50, 1.0),
    });
  }
  benchmarks.sort((a, b) => b.baseSpe - a.baseSpe);
  speedBenchmarksCache = benchmarks;
  return benchmarks;
}

// ─── Spread Suggestion ──────────────────────────────────────────────

export interface SpreadSuggestion {
  name: string;
  description: string;
  sps: StatsTable;
  nature: NatureName;
  tags: string[];
  rationale: string[];
}

export function suggestSpreads(
  species: string,
  level: number = 50
): SpreadSuggestion[] {
  const data = getPokemonData(species);
  if (!data) return [];

  const bs = data.baseStats;
  const suggestions: SpreadSuggestion[] = [];

  // Determine offensive profile
  const isPhysical = bs.atk > bs.spa + 10;
  const isSpecial = bs.spa > bs.atk + 10;
  const isMixed = !isPhysical && !isSpecial;
  const mainAtk: StatID = isPhysical ? 'atk' : 'spa';
  const offNature: NatureName = isPhysical ? 'Adamant' : 'Modest';
  const speedNature: NatureName = isPhysical ? 'Jolly' : 'Timid';
  const bulkPhysNature: NatureName = isSpecial ? 'Bold' : 'Impish';
  const bulkSpecNature: NatureName = isPhysical ? 'Careful' : 'Calm';

  // ─── 1. Max Speed Sweeper ────────────────────────────────────
  if (bs.spe >= 60 && (bs.atk >= 80 || bs.spa >= 80)) {
    const sps: StatsTable = { hp: 2, atk: 0, def: 0, spa: 0, spd: 0, spe: 32 };
    sps[mainAtk] = 32;

    const speed = calcStat('spe', bs.spe, 32, level, 1.1);
    const benchmarks = getSpeedBenchmarks();
    const outspeeds = benchmarks.filter(b => b.species !== species && b.maxSpe < speed).slice(0, 5);

    suggestions.push({
      name: 'Speed Sweeper',
      description: `Max ${mainAtk === 'atk' ? 'Attack' : 'Sp.Atk'} + Speed with boosting nature`,
      sps,
      nature: speedNature,
      tags: ['offensive', 'speed'],
      rationale: [
        `${speed} Speed outspeeds: ${outspeeds.map(b => `${b.species} (${b.maxSpe})`).join(', ') || 'few threats at this tier'}`,
        `Maximizes damage output while ensuring you move first`,
        `2 SP leftover in HP for minimal bulk`,
      ],
    });
  }

  // ─── 2. Power Sweeper (max atk, +atk nature) ────────────────
  if (bs.atk >= 80 || bs.spa >= 80) {
    const sps: StatsTable = { hp: 2, atk: 0, def: 0, spa: 0, spd: 0, spe: 32 };
    sps[mainAtk] = 32;

    const speed = calcStat('spe', bs.spe, 32, level, 1.0);
    const benchmarks = getSpeedBenchmarks();
    const outspeeds = benchmarks.filter(b => b.species !== species && b.neutralMaxSpe < speed).slice(0, 3);

    suggestions.push({
      name: 'Power Sweeper',
      description: `Max ${mainAtk === 'atk' ? 'Attack' : 'Sp.Atk'} + Speed with power-boosting nature`,
      sps,
      nature: offNature,
      tags: ['offensive', 'power'],
      rationale: [
        `${offNature} boosts ${mainAtk === 'atk' ? 'Attack' : 'Sp.Atk'} by 10% for more damage`,
        `Still hits ${speed} Speed — outspeeds: ${outspeeds.map(b => b.species).join(', ') || 'neutral-natured peers'}`,
        `Trade speed tie wins for raw power`,
      ],
    });
  }

  // ─── 3. Bulky Attacker ───────────────────────────────────────
  if (bs.hp >= 70 || bs.def >= 70 || bs.spd >= 70) {
    const sps: StatsTable = { hp: 32, atk: 0, def: 0, spa: 0, spd: 2, spe: 0 };
    sps[mainAtk] = 32;

    suggestions.push({
      name: 'Bulky Attacker',
      description: `Max HP + ${mainAtk === 'atk' ? 'Attack' : 'Sp.Atk'}, no Speed investment`,
      sps,
      nature: offNature,
      tags: ['bulky offense'],
      rationale: [
        `HP investment maximizes overall bulk from both sides`,
        `Full offensive investment ensures you hit hard`,
        `Works best in Trick Room or with Tailwind support`,
      ],
    });
  }

  // ─── 4. Physically Defensive ─────────────────────────────────
  if (bs.def >= 70 || bs.hp >= 80) {
    const sps: StatsTable = { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 };

    const hp = calcStat('hp', bs.hp, 32, level, 1);
    const def = calcStat('def', bs.def, 32, level, getNatureMod(bulkPhysNature, 'def'));
    const physBulk = hp * def;

    suggestions.push({
      name: 'Physical Wall',
      description: 'Max HP + Defense with physical defensive nature',
      sps,
      nature: bulkPhysNature,
      tags: ['defensive', 'physical wall'],
      rationale: [
        `Physical bulk index: ${physBulk.toLocaleString()} (HP × Def)`,
        `+Def nature maximizes physical damage reduction`,
        `2 SP in SpD for marginal special bulk improvement`,
      ],
    });
  }

  // ─── 5. Specially Defensive ──────────────────────────────────
  if (bs.spd >= 70 || bs.hp >= 80) {
    const sps: StatsTable = { hp: 32, atk: 0, def: 2, spa: 0, spd: 32, spe: 0 };

    const hp = calcStat('hp', bs.hp, 32, level, 1);
    const spd = calcStat('spd', bs.spd, 32, level, getNatureMod(bulkSpecNature, 'spd'));
    const specBulk = hp * spd;

    suggestions.push({
      name: 'Special Wall',
      description: 'Max HP + Sp.Def with special defensive nature',
      sps,
      nature: bulkSpecNature,
      tags: ['defensive', 'special wall'],
      rationale: [
        `Special bulk index: ${specBulk.toLocaleString()} (HP × SpD)`,
        `+SpD nature maximizes special damage reduction`,
        `2 SP in Def for minimal physical soak`,
      ],
    });
  }

  // ─── 6. Speed Creep (outspeeds common max-speed Pokemon) ─────
  if (bs.spe >= 50 && bs.spe <= 100) {
    const benchmarks = getSpeedBenchmarks();

    // Find the closest common threats we can outspeed with minimal investment
    // Try different SP values and find meaningful breakpoints
    for (let sp = 4; sp <= 28; sp += 4) {
      const speedWith = calcStat('spe', bs.spe, sp, level, 1.1);
      const justOutspeeds = benchmarks.filter(b =>
        b.species !== species &&
        b.maxSpe > 0 &&
        b.maxSpe < speedWith &&
        b.maxSpe >= speedWith - 5 &&
        b.baseSpe >= 70
      );

      if (justOutspeeds.length > 0) {
        const remaining = MAX_TOTAL_SP - sp;
        const sps: StatsTable = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: sp };
        // Distribute remaining into main stat + HP
        const mainInvest = Math.min(MAX_STAT_SP, remaining);
        sps[mainAtk] = mainInvest;
        const leftover = remaining - mainInvest;
        sps.hp = Math.min(MAX_STAT_SP, leftover);
        const finalLeft = leftover - sps.hp;
        if (finalLeft > 0) sps.def = Math.min(MAX_STAT_SP, finalLeft);

        suggestions.push({
          name: `Speed Creep (${sp} Spe)`,
          description: `Just enough Speed to outspeed key threats, rest in bulk + offense`,
          sps,
          nature: speedNature,
          tags: ['speed creep', 'efficient'],
          rationale: [
            `${speedWith} Speed outspeeds max Speed ${justOutspeeds.map(b => `${b.species} (${b.maxSpe})`).join(', ')}`,
            `Saves ${MAX_STAT_SP - sp} SP from full Speed investment for other stats`,
            `More efficient than max Speed when you only need to beat specific targets`,
          ],
        });
        break; // Only show the best speed creep
      }
    }
  }

  // ─── 7. Trick Room Spread ────────────────────────────────────
  if (bs.spe <= 55) {
    const braveOrQuiet: NatureName = isPhysical ? 'Brave' : 'Quiet';
    const sps: StatsTable = { hp: 32, atk: 0, def: 0, spa: 0, spd: 2, spe: 0 };
    sps[mainAtk] = 32;

    const minSpeed = calcStat('spe', bs.spe, 0, level, 0.9);

    suggestions.push({
      name: 'Trick Room',
      description: `Min Speed + Max power for Trick Room teams`,
      sps,
      nature: braveOrQuiet,
      tags: ['trick room', 'min speed'],
      rationale: [
        `0 Speed SP + ${braveOrQuiet} nature = ${minSpeed} Speed (moves first under TR)`,
        `${braveOrQuiet} nature boosts ${mainAtk === 'atk' ? 'Attack' : 'Sp.Atk'} without wasting stats`,
        `Max HP for survivability while sweeping under Trick Room`,
      ],
    });
  }

  // ─── 8. Mixed / Balanced ────────────────────────────────────
  if (isMixed) {
    const sps: StatsTable = { hp: 2, atk: 16, def: 0, spa: 16, spd: 0, spe: 32 };
    suggestions.push({
      name: 'Mixed Attacker',
      description: 'Split between Attack and Sp.Atk with max Speed',
      sps,
      nature: 'Hasty' as NatureName,
      tags: ['mixed', 'versatile'],
      rationale: [
        `${bs.atk} base Atk / ${bs.spa} base SpA are close enough to run both`,
        `Unpredictable — opponent can't tell physical vs special until you attack`,
        `Max Speed ensures you move first; Hasty keeps both offenses neutral`,
      ],
    });
  }

  return suggestions;
}

// ─── Speed Tier Report ───────────────────────────────────────────────
// Show what a Pokemon outspeeds at various SP investments

export interface SpeedTierEntry {
  sp: number;
  speed: number;
  speedWithNature: number;
  outspeeds: string[];     // Pokemon this speed beats (max speed variants)
  outspeedBy: string[];    // Pokemon that outspeed us
}

export function getSpeedTiers(
  species: string,
  level: number = 50
): SpeedTierEntry[] {
  const data = getPokemonData(species);
  if (!data) return [];

  const baseSpe = data.baseStats.spe;
  const benchmarks = getSpeedBenchmarks();
  const tiers: SpeedTierEntry[] = [];

  for (const sp of [0, 4, 8, 12, 16, 20, 24, 28, 32]) {
    const speed = calcStat('spe', baseSpe, sp, level, 1.0);
    const speedWithNature = calcStat('spe', baseSpe, sp, level, 1.1);

    const outspeeds = benchmarks
      .filter(b => b.species !== species && b.maxSpe > 0 && b.maxSpe < speedWithNature)
      .slice(0, 5)
      .map(b => b.species);

    const outspeedBy = benchmarks
      .filter(b => b.species !== species && b.maxSpe > speedWithNature)
      .slice(-5)
      .map(b => b.species);

    tiers.push({ sp, speed, speedWithNature, outspeeds, outspeedBy });
  }

  return tiers;
}
