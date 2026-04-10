// Opener / Lead Analysis Engine
// Analyzes all possible lead combinations from selected Pokemon
// to find the strongest turn-1 pairings in Doubles VGC

import { Move } from '@smogon/calc';
import { getPokemonData } from '../data/champions';
import { NORMAL_TIER_LIST, MEGA_TIER_LIST } from '../data/tierlist';
import { PRESETS } from '../data/presets';
import type { PokemonState } from '../types';

// ─── Lead Scoring Criteria ───────────────────────────────────────────
// A good lead combination should:
// 1. Have Fake Out access (controls the first turn)
// 2. Provide speed control (Tailwind, Trick Room)
// 3. Apply immediate offensive pressure
// 4. Cover each other's type weaknesses
// 5. Have Intimidate or other switch-in value
// 6. Not share weaknesses

export interface LeadScore {
  pokemon: [string, string];
  totalScore: number;
  breakdown: LeadScoreBreakdown;
  commentary: string[];
}

interface LeadScoreBreakdown {
  fakeOutPressure: number;       // 0-15: Fake Out control
  speedControl: number;          // 0-15: Tailwind / TR potential
  offensivePressure: number;     // 0-15: raw damage threat
  defensiveCoverage: number;     // 0-10: type coverage complement
  intimidatePivot: number;       // 0-10: Intimidate / support value
  weaknessOverlap: number;      // -10 to 0: shared weakness penalty
  synergyBonus: number;          // 0-10: specific combo bonus
}

// Detect capability from moves
function hasMoveNamed(moves: string[], ...names: string[]): boolean {
  return moves.some(m => names.some(n => m.toLowerCase() === n.toLowerCase()));
}

function hasMoveCategory(moves: string[], category: string): boolean {
  for (const m of moves) {
    if (!m) continue;
    try {
      const move = new Move(9 as any, m);
      if (category === 'spread' && ['allAdjacentFoes', 'allAdjacent'].includes(move.target)) return true;
      if (category === 'priority' && move.priority > 0) return true;
    } catch { /* skip */ }
  }
  return false;
}

export function scoreLeadPair(a: PokemonState, b: PokemonState): LeadScore {
  const aData = getPokemonData(a.species);
  const bData = getPokemonData(b.species);
  if (!aData || !bData) {
    return {
      pokemon: [a.species, b.species],
      totalScore: 0,
      breakdown: { fakeOutPressure: 0, speedControl: 0, offensivePressure: 0, defensiveCoverage: 0, intimidatePivot: 0, weaknessOverlap: 0, synergyBonus: 0 },
      commentary: ['Missing Pokemon data'],
    };
  }

  const commentary: string[] = [];
  const bd: LeadScoreBreakdown = {
    fakeOutPressure: 0,
    speedControl: 0,
    offensivePressure: 0,
    defensiveCoverage: 0,
    intimidatePivot: 0,
    weaknessOverlap: 0,
    synergyBonus: 0,
  };

  // ── Fake Out ──────────────────────────────────────────────
  const aHasFakeOut = hasMoveNamed(a.moves, 'Fake Out');
  const bHasFakeOut = hasMoveNamed(b.moves, 'Fake Out');
  if (aHasFakeOut && bHasFakeOut) {
    bd.fakeOutPressure = 15;
    commentary.push('Double Fake Out — controls both opponents turn 1');
  } else if (aHasFakeOut || bHasFakeOut) {
    bd.fakeOutPressure = 10;
    const fakeOutUser = aHasFakeOut ? a.species : b.species;
    commentary.push(`${fakeOutUser} Fake Out secures a free turn for the partner`);
  }

  // ── Speed Control ─────────────────────────────────────────
  const aHasTailwind = hasMoveNamed(a.moves, 'Tailwind');
  const bHasTailwind = hasMoveNamed(b.moves, 'Tailwind');
  const aHasTR = hasMoveNamed(a.moves, 'Trick Room');
  const bHasTR = hasMoveNamed(b.moves, 'Trick Room');
  const aHasIcyWind = hasMoveNamed(a.moves, 'Icy Wind', 'Electroweb', 'Bleakwind Storm');
  const bHasIcyWind = hasMoveNamed(b.moves, 'Icy Wind', 'Electroweb', 'Bleakwind Storm');

  if ((aHasTailwind || bHasTailwind) && (aHasFakeOut || bHasFakeOut)) {
    bd.speedControl = 15;
    commentary.push('Fake Out + Tailwind — guaranteed speed advantage from turn 1');
  } else if (aHasTailwind || bHasTailwind) {
    bd.speedControl = 10;
    commentary.push(`Tailwind sets up speed advantage`);
  } else if ((aHasTR || bHasTR) && (aHasFakeOut || bHasFakeOut)) {
    bd.speedControl = 14;
    commentary.push('Fake Out + Trick Room — protected setup for slow attackers');
  } else if (aHasTR || bHasTR) {
    bd.speedControl = 8;
    commentary.push('Trick Room access — but vulnerable to disruption without Fake Out');
  } else if (aHasIcyWind || bHasIcyWind) {
    bd.speedControl = 5;
    commentary.push('Speed-dropping spread move for soft speed control');
  }

  // ── Offensive Pressure ────────────────────────────────────
  const aHasSpread = hasMoveCategory(a.moves, 'spread');
  const bHasSpread = hasMoveCategory(b.moves, 'spread');
  const aHasPriority = hasMoveCategory(a.moves, 'priority');
  const bHasPriority = hasMoveCategory(b.moves, 'priority');

  const aBST = aData.baseStats.atk + aData.baseStats.spa;
  const bBST = bData.baseStats.atk + bData.baseStats.spa;
  const combinedOffense = aBST + bBST;

  // Raw offensive stat scoring
  bd.offensivePressure = Math.min(15, Math.round((combinedOffense - 200) / 20));

  if (aHasSpread && bHasSpread) {
    bd.offensivePressure = Math.min(15, bd.offensivePressure + 4);
    commentary.push('Both have spread moves — massive board pressure');
  } else if (aHasSpread || bHasSpread) {
    bd.offensivePressure = Math.min(15, bd.offensivePressure + 2);
  }

  if (aHasPriority || bHasPriority) {
    bd.offensivePressure = Math.min(15, bd.offensivePressure + 2);
    commentary.push(`Priority move for finishing weakened targets`);
  }

  // Physical + special mix
  const aProfile = aData.baseStats.atk > aData.baseStats.spa ? 'physical' : 'special';
  const bProfile = bData.baseStats.atk > bData.baseStats.spa ? 'physical' : 'special';
  if (aProfile !== bProfile) {
    bd.offensivePressure = Math.min(15, bd.offensivePressure + 2);
    commentary.push('Mixed physical + special — can\'t be walled by one stat');
  }

  // ── Defensive Coverage ────────────────────────────────────
  const aTypes = new Set(aData.types);
  const bTypes = new Set(bData.types);
  // Simple: count non-overlapping types for coverage
  const uniqueTypes = new Set([...aTypes, ...bTypes]);
  bd.defensiveCoverage = Math.min(10, uniqueTypes.size * 3);

  // ── Intimidate / Support ──────────────────────────────────
  const aIntim = a.ability.toLowerCase() === 'intimidate';
  const bIntim = b.ability.toLowerCase() === 'intimidate';
  const aHasParting = hasMoveNamed(a.moves, 'Parting Shot', 'U-turn', 'Volt Switch');
  const bHasParting = hasMoveNamed(b.moves, 'Parting Shot', 'U-turn', 'Volt Switch');

  if (aIntim || bIntim) {
    bd.intimidatePivot = 7;
    const intimUser = aIntim ? a.species : b.species;
    commentary.push(`${intimUser} Intimidate weakens physical attackers on switch-in`);
    if ((aIntim && aHasParting) || (bIntim && bHasParting)) {
      bd.intimidatePivot = 10;
      commentary.push('Intimidate + pivot move = reusable Attack drops');
    }
  }

  // Redirect support
  const aRedirect = hasMoveNamed(a.moves, 'Rage Powder', 'Follow Me', 'Ally Switch');
  const bRedirect = hasMoveNamed(b.moves, 'Rage Powder', 'Follow Me', 'Ally Switch');
  if (aRedirect || bRedirect) {
    bd.synergyBonus += 5;
    commentary.push('Redirect support protects the partner from single-target attacks');
  }

  // ── Weakness Overlap ──────────────────────────────────────
  // Penalty for shared weaknesses
  const aWeaknesses = new Set<string>();
  const bWeaknesses = new Set<string>();
  // Simple type weakness check
  const typeWeakMap: Record<string, string[]> = {
    Normal: ['Fighting'], Fire: ['Water', 'Ground', 'Rock'], Water: ['Electric', 'Grass'],
    Electric: ['Ground'], Grass: ['Fire', 'Ice', 'Poison', 'Flying', 'Bug'],
    Ice: ['Fire', 'Fighting', 'Rock', 'Steel'], Fighting: ['Flying', 'Psychic', 'Fairy'],
    Poison: ['Ground', 'Psychic'], Ground: ['Water', 'Grass', 'Ice'],
    Flying: ['Electric', 'Ice', 'Rock'], Psychic: ['Bug', 'Ghost', 'Dark'],
    Bug: ['Fire', 'Flying', 'Rock'], Rock: ['Water', 'Grass', 'Fighting', 'Ground', 'Steel'],
    Ghost: ['Ghost', 'Dark'], Dragon: ['Ice', 'Dragon', 'Fairy'],
    Dark: ['Fighting', 'Bug', 'Fairy'], Steel: ['Fire', 'Fighting', 'Ground'],
    Fairy: ['Poison', 'Steel'],
  };

  for (const t of aData.types) { (typeWeakMap[t] || []).forEach(w => aWeaknesses.add(w)); }
  for (const t of bData.types) { (typeWeakMap[t] || []).forEach(w => bWeaknesses.add(w)); }

  let sharedWeaknesses = 0;
  const sharedWkNames: string[] = [];
  for (const w of aWeaknesses) {
    if (bWeaknesses.has(w)) { sharedWeaknesses++; sharedWkNames.push(w); }
  }
  bd.weaknessOverlap = -Math.min(10, sharedWeaknesses * 3);
  if (sharedWeaknesses > 0) {
    commentary.push(`Shared ${sharedWkNames.join('/')} weakness — vulnerable to the same coverage`);
  }

  // ── Synergy Bonus ─────────────────────────────────────────
  // Weather setter + abuser as lead
  const weatherSetterAbilities = ['drought', 'drizzle', 'sand stream', 'snow warning'];
  const weatherAbuserAbilities = ['chlorophyll', 'swift swim', 'sand rush', 'slush rush'];
  const aIsWeatherSetter = weatherSetterAbilities.includes(a.ability.toLowerCase());
  const bIsWeatherSetter = weatherSetterAbilities.includes(b.ability.toLowerCase());
  const aIsWeatherAbuser = weatherAbuserAbilities.includes(a.ability.toLowerCase());
  const bIsWeatherAbuser = weatherAbuserAbilities.includes(b.ability.toLowerCase());

  if ((aIsWeatherSetter && bIsWeatherAbuser) || (bIsWeatherSetter && aIsWeatherAbuser)) {
    bd.synergyBonus += 10;
    commentary.push('Weather setter + abuser lead — immediate weather advantage');
  }

  // Prankster + partner
  const aIsPrankster = a.ability.toLowerCase() === 'prankster';
  const bIsPrankster = b.ability.toLowerCase() === 'prankster';
  if (aIsPrankster || bIsPrankster) {
    bd.synergyBonus += 3;
  }

  const totalScore = Object.values(bd).reduce((s, v) => s + v, 0);

  return {
    pokemon: [a.species, b.species],
    totalScore,
    breakdown: bd,
    commentary,
  };
}

// ─── Analyze All Lead Combinations ───────────────────────────────────

export function analyzeOpeners(team: PokemonState[]): LeadScore[] {
  const validMembers = team.filter(p => p.species);
  if (validMembers.length < 2) return [];

  const results: LeadScore[] = [];

  // Generate all pairs
  for (let i = 0; i < validMembers.length; i++) {
    for (let j = i + 1; j < validMembers.length; j++) {
      results.push(scoreLeadPair(validMembers[i], validMembers[j]));
    }
  }

  results.sort((a, b) => b.totalScore - a.totalScore);
  return results;
}

// ─── Suggest Best Lead From Meta ─────────────────────────────────────
// Given a single Pokemon, suggest the best partner from the tier list

export function suggestLeadPartners(pokemon: PokemonState): LeadScore[] {
  if (!pokemon.species) return [];

  const results: LeadScore[] = [];
  const relevantTiers = ['S', 'A+', 'A'];

  for (const entry of [...NORMAL_TIER_LIST, ...MEGA_TIER_LIST]) {
    if (!relevantTiers.includes(entry.tier)) continue;
    if (entry.name === pokemon.species) continue;

    // For Megas, use the base species name for data lookup
    const speciesName = entry.isMega ? entry.name.replace('Mega ', '') : entry.name;

    // Build a PokemonState from preset or defaults
    const preset = PRESETS.find(p => p.species === speciesName);
    const data = getPokemonData(speciesName);
    if (!data) continue;

    const partnerState: PokemonState = {
      species: speciesName,
      level: 50,
      nature: preset?.nature || (data.baseStats.atk > data.baseStats.spa ? 'Adamant' : 'Modest'),
      ability: preset?.ability || (data.abilities?.[0] || '') as string,
      item: preset?.item || '',
      teraType: '',
      sps: preset?.sps || { hp: 2, atk: 0, def: 0, spa: 0, spd: 0, spe: 32 },
      boosts: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      status: '',
      currentHp: 100,
      moves: preset?.moves || [],
      isMega: false,
      moveOptions: { 0: { isCrit: false, hits: 1 }, 1: { isCrit: false, hits: 1 }, 2: { isCrit: false, hits: 1 }, 3: { isCrit: false, hits: 1 } },
    };

    results.push(scoreLeadPair(pokemon, partnerState));
  }

  results.sort((a, b) => b.totalScore - a.totalScore);
  return results.slice(0, 8);
}
