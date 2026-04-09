// Dynamic synergy recommendation engine
// All analysis is algorithmic — derived from @smogon/calc type chart, stats, and ability data
// No hardcoded pairings

import { Generations } from '@smogon/calc';
import { getAvailablePokemon, getPokemonData } from './champions';
import { PRESETS, type PokemonPreset } from './presets';
import { NORMAL_TIER_LIST } from './tierlist';

const gen9 = Generations.get(9);

// ─── Types ──────────────────────────────────────────────────────────

const ALL_TYPES = [
  'Normal', 'Grass', 'Fire', 'Water', 'Electric', 'Ice', 'Flying', 'Bug',
  'Poison', 'Ground', 'Rock', 'Fighting', 'Psychic', 'Ghost', 'Dragon',
  'Dark', 'Steel', 'Fairy',
] as const;
// Types used from ALL_TYPES for iteration

// Build type chart from @smogon/calc data
function getEffectiveness(attackType: string, defenseType: string): number {
  const typeData = gen9.types.get(attackType.toLowerCase() as any);
  if (!typeData) return 1;
  return (typeData.effectiveness as any)[defenseType] ?? 1;
}

function getDefensiveMultiplier(attackType: string, defenderTypes: string[]): number {
  let mult = 1;
  for (const dt of defenderTypes) {
    mult *= getEffectiveness(attackType, dt);
  }
  return mult;
}

// ─── Ability Classification ─────────────────────────────────────────
// Categorize abilities by effect — derived from ability names/known mechanics

interface AbilityCategory {
  weather?: string;         // sets this weather
  weatherAbuse?: string;    // benefits from this weather
  terrain?: string;         // sets this terrain
  terrainAbuse?: string;    // benefits from this terrain
  intimidate?: boolean;
  redirect?: boolean;
  fakeOut?: boolean;        // detected from moves, not ability
  speedControl?: 'boost' | 'trick-room-setter'; // from moves
  priority?: boolean;       // has priority moves
  immunityType?: string;    // grants immunity to a type
  statDrop?: boolean;       // drops opponent stats on switch-in
}

// Classify abilities dynamically by name pattern matching
function classifyAbility(name: string): AbilityCategory {
  const cat: AbilityCategory = {};
  const lower = name.toLowerCase();

  // Weather setters
  if (['drought', 'desolate land'].includes(lower)) cat.weather = 'Sun';
  if (['drizzle', 'primordial sea'].includes(lower)) cat.weather = 'Rain';
  if (['sand stream'].includes(lower)) cat.weather = 'Sand';
  if (['snow warning'].includes(lower)) cat.weather = 'Snow';

  // Weather abusers
  if (['chlorophyll', 'solar power', 'flower gift', 'harvest', 'leaf guard', 'mega sol'].includes(lower)) cat.weatherAbuse = 'Sun';
  if (['swift swim', 'rain dish', 'dry skin', 'hydration'].includes(lower)) cat.weatherAbuse = 'Rain';
  if (['sand rush', 'sand force', 'sand veil'].includes(lower)) cat.weatherAbuse = 'Sand';
  if (['slush rush', 'ice body', 'snow cloak', 'ice face'].includes(lower)) cat.weatherAbuse = 'Snow';

  // Terrain setters
  if (lower === 'electric surge') cat.terrain = 'Electric';
  if (lower === 'grassy surge') cat.terrain = 'Grassy';
  if (lower === 'misty surge') cat.terrain = 'Misty';
  if (lower === 'psychic surge') cat.terrain = 'Psychic';

  // Terrain abusers
  if (lower === 'surge surfer') cat.terrainAbuse = 'Electric';
  if (lower === 'grass pelt') cat.terrainAbuse = 'Grassy';

  // Intimidate
  if (lower === 'intimidate') cat.intimidate = true;

  // Stat-dropping
  if (['intimidate'].includes(lower)) cat.statDrop = true;

  // Type immunities from abilities
  if (['flash fire', 'well-baked body'].includes(lower)) cat.immunityType = 'Fire';
  if (['water absorb', 'storm drain', 'dry skin'].includes(lower)) cat.immunityType = 'Water';
  if (['lightning rod', 'volt absorb', 'motor drive'].includes(lower)) cat.immunityType = 'Electric';
  if (['levitate'].includes(lower)) cat.immunityType = 'Ground';
  if (['sap sipper'].includes(lower)) cat.immunityType = 'Grass';

  return cat;
}

// ─── Pokemon Analysis ────────────────────────────────────────────────

interface AnalyzedPokemon {
  name: string;
  types: string[];
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  abilities: string[];
  abilityCategories: AbilityCategory[];
  weaknesses: Map<string, number>;    // type -> multiplier (>1)
  resistances: Map<string, number>;   // type -> multiplier (<1)
  immunities: Set<string>;            // types with 0x
  offensiveProfile: 'physical' | 'special' | 'mixed';
  speedTier: 'very-slow' | 'slow' | 'medium' | 'fast' | 'very-fast';
  bulkTier: 'frail' | 'moderate' | 'bulky' | 'very-bulky';
  bst: number;
}

function analyzePokemon(name: string): AnalyzedPokemon | null {
  const data = getPokemonData(name);
  if (!data) return null;

  const types = [...data.types] as string[];
  const bs = data.baseStats;
  const abilities = data.abilities ? [data.abilities[0] as string] : [];
  const abilityCategories = abilities.map(a => classifyAbility(a));

  // Compute defensive matchups
  const weaknesses = new Map<string, number>();
  const resistances = new Map<string, number>();
  const immunities = new Set<string>();

  for (const atkType of ALL_TYPES) {
    const mult = getDefensiveMultiplier(atkType, types);
    if (mult === 0) immunities.add(atkType);
    else if (mult > 1) weaknesses.set(atkType, mult);
    else if (mult < 1) resistances.set(atkType, mult);
  }

  // Add ability immunities
  for (const cat of abilityCategories) {
    if (cat.immunityType) immunities.add(cat.immunityType);
  }

  // Offensive profile
  const offensiveProfile = bs.atk > bs.spa + 15 ? 'physical'
    : bs.spa > bs.atk + 15 ? 'special'
    : 'mixed';

  // Speed tier
  const speedTier = bs.spe <= 40 ? 'very-slow'
    : bs.spe <= 65 ? 'slow'
    : bs.spe <= 95 ? 'medium'
    : bs.spe <= 115 ? 'fast'
    : 'very-fast';

  // Bulk tier (physical + special bulk)
  const physBulk = bs.hp * bs.def;
  const specBulk = bs.hp * bs.spd;
  const avgBulk = (physBulk + specBulk) / 2;
  const bulkTier = avgBulk < 6000 ? 'frail'
    : avgBulk < 10000 ? 'moderate'
    : avgBulk < 15000 ? 'bulky'
    : 'very-bulky';

  const bst = bs.hp + bs.atk + bs.def + bs.spa + bs.spd + bs.spe;

  return {
    name: data.name,
    types,
    baseStats: { ...bs },
    abilities,
    abilityCategories,
    weaknesses,
    resistances,
    immunities,
    offensiveProfile,
    speedTier,
    bulkTier,
    bst,
  };
}

// ─── Scoring Functions ──────────────────────────────────────────────

export interface SynergyReason {
  type: 'defensive' | 'offensive' | 'weather' | 'terrain' | 'speed-control' | 'support' | 'stat-profile';
  label: string;
  description: string;
  strength: number;
}

export interface SynergyRecommendation {
  species: string;
  reasons: SynergyReason[];
  totalScore: number;
  preset?: PokemonPreset;
}

// How well does B cover A's defensive weaknesses?
function scoreDefensiveSynergy(a: AnalyzedPokemon, b: AnalyzedPokemon): SynergyReason[] {
  const reasons: SynergyReason[] = [];

  // Count how many of A's weaknesses B resists or is immune to
  let covered = 0;
  const coveredTypes: string[] = [];
  for (const [wkType, mult] of a.weaknesses) {
    if (b.immunities.has(wkType)) {
      covered += mult >= 4 ? 3 : 2; // extra credit for covering 4x weaknesses
      coveredTypes.push(`${wkType} (immune)`);
    } else if (b.resistances.has(wkType)) {
      covered += mult >= 4 ? 2 : 1;
      coveredTypes.push(wkType);
    }
  }

  if (coveredTypes.length >= 2) {
    const strength = covered >= 5 ? 3 : covered >= 3 ? 2 : 1;
    reasons.push({
      type: 'defensive',
      label: 'Defensive Coverage',
      description: `Resists/absorbs ${coveredTypes.length} of ${a.name}'s weaknesses: ${coveredTypes.slice(0, 4).join(', ')}${coveredTypes.length > 4 ? '...' : ''}`,
      strength,
    });
  }

  // Mutual coverage — does A also cover B's weaknesses?
  let mutualCover = 0;
  for (const [wkType] of b.weaknesses) {
    if (a.immunities.has(wkType) || a.resistances.has(wkType)) {
      mutualCover++;
    }
  }

  if (coveredTypes.length >= 2 && mutualCover >= 2) {
    reasons.push({
      type: 'defensive',
      label: 'Mutual Defense',
      description: `Forms a defensive core — each resists the other's weaknesses (${coveredTypes.length}/${a.weaknesses.size} and ${mutualCover}/${b.weaknesses.size} covered)`,
      strength: 2,
    });
  }

  return reasons;
}

// How well do A and B complement offensively?
function scoreOffensiveSynergy(a: AnalyzedPokemon, b: AnalyzedPokemon): SynergyReason[] {
  const reasons: SynergyReason[] = [];

  // A is physical, B is special (or vice versa) = harder to wall
  if (
    (a.offensiveProfile === 'physical' && b.offensiveProfile === 'special') ||
    (a.offensiveProfile === 'special' && b.offensiveProfile === 'physical')
  ) {
    reasons.push({
      type: 'offensive',
      label: 'Mixed Offense',
      description: `${a.name} is ${a.offensiveProfile}, ${b.name} is ${b.offensiveProfile} — hard to wall both sides`,
      strength: 2,
    });
  }

  // Type coverage complement — compute how many types A+B hit super-effectively together
  const aHitsSE = new Set<string>();
  const bHitsSE = new Set<string>();
  for (const aType of a.types) {
    for (const defType of ALL_TYPES) {
      if (getEffectiveness(aType, defType) > 1) aHitsSE.add(defType);
    }
  }
  for (const bType of b.types) {
    for (const defType of ALL_TYPES) {
      if (getEffectiveness(bType, defType) > 1) bHitsSE.add(defType);
    }
  }

  const combined = new Set([...aHitsSE, ...bHitsSE]);
  const unique = [...bHitsSE].filter(t => !aHitsSE.has(t));

  if (unique.length >= 3) {
    reasons.push({
      type: 'offensive',
      label: 'Coverage Complement',
      description: `${b.name} adds super-effective hits on ${unique.slice(0, 4).join(', ')} that ${a.name} can't hit — together they threaten ${combined.size}/18 types`,
      strength: unique.length >= 5 ? 3 : 2,
    });
  }

  return reasons;
}

// Weather and terrain synergies
function scoreWeatherTerrainSynergy(a: AnalyzedPokemon, b: AnalyzedPokemon): SynergyReason[] {
  const reasons: SynergyReason[] = [];

  for (const aCat of a.abilityCategories) {
    for (const bCat of b.abilityCategories) {
      // A sets weather, B abuses it
      if (aCat.weather && bCat.weatherAbuse === aCat.weather) {
        reasons.push({
          type: 'weather',
          label: `${aCat.weather} Engine`,
          description: `${a.name} sets ${aCat.weather} via ${a.abilities[0]}, activating ${b.name}'s ${b.abilities[0]} — doubled Speed or boosted moves`,
          strength: 3,
        });
      }
      // B sets weather, A abuses it
      if (bCat.weather && aCat.weatherAbuse === bCat.weather) {
        reasons.push({
          type: 'weather',
          label: `${bCat.weather} Engine`,
          description: `${b.name} sets ${bCat.weather} via ${b.abilities[0]}, activating ${a.name}'s ${a.abilities[0]}`,
          strength: 3,
        });
      }
      // Terrain synergy
      if (aCat.terrain && bCat.terrainAbuse === aCat.terrain) {
        reasons.push({
          type: 'terrain',
          label: `${aCat.terrain} Terrain`,
          description: `${a.name} sets ${aCat.terrain} Terrain, boosting ${b.name}'s ${b.abilities[0]}`,
          strength: 2,
        });
      }
      if (bCat.terrain && aCat.terrainAbuse === bCat.terrain) {
        reasons.push({
          type: 'terrain',
          label: `${bCat.terrain} Terrain`,
          description: `${b.name} sets ${bCat.terrain} Terrain, boosting ${a.name}'s ${a.abilities[0]}`,
          strength: 2,
        });
      }
    }
  }

  // If A sets weather and B is immune to the chip damage or benefits from it type-wise
  for (const aCat of a.abilityCategories) {
    if (aCat.weather === 'Sand') {
      // Sand chip damages non-Rock/Ground/Steel
      if (b.types.some(t => ['Rock', 'Ground', 'Steel'].includes(t))) {
        reasons.push({
          type: 'weather',
          label: 'Sand Immune',
          description: `${b.name} is immune to Sand chip damage (${b.types.join('/')}-type)`,
          strength: 1,
        });
      }
    }
    if (aCat.weather === 'Sun') {
      // Sun boosts Fire, weakens Water
      if (b.types.includes('Fire')) {
        reasons.push({
          type: 'weather',
          label: 'Sun Boost',
          description: `${b.name}'s Fire-type attacks get 50% boost in Sun`,
          strength: 2,
        });
      }
    }
    if (aCat.weather === 'Rain') {
      if (b.types.includes('Water')) {
        reasons.push({
          type: 'weather',
          label: 'Rain Boost',
          description: `${b.name}'s Water-type attacks get 50% boost in Rain`,
          strength: 2,
        });
      }
    }
  }

  return reasons;
}

// Speed tier synergy
function scoreSpeedSynergy(a: AnalyzedPokemon, b: AnalyzedPokemon): SynergyReason[] {
  const reasons: SynergyReason[] = [];

  // Trick Room: A is slow, B could set TR (or vice versa)
  // We detect TR potential by slow + bulky + Psychic/Ghost/Fairy typing (common TR setters)
  const trSetterTypes = ['Psychic', 'Ghost', 'Fairy'];

  if (a.speedTier === 'very-slow' || a.speedTier === 'slow') {
    // A would benefit from TR — does B look like a TR setter?
    if (b.types.some(t => trSetterTypes.includes(t)) && (b.bulkTier === 'bulky' || b.bulkTier === 'very-bulky' || b.bulkTier === 'moderate')) {
      reasons.push({
        type: 'speed-control',
        label: 'Trick Room',
        description: `${a.name} has ${a.baseStats.spe} base Speed — moves first under Trick Room. ${b.name}'s ${b.types.join('/')} typing suggests TR setter potential`,
        strength: 2,
      });
    }
  }

  if (b.speedTier === 'very-slow' || b.speedTier === 'slow') {
    if (a.types.some(t => trSetterTypes.includes(t)) && (a.bulkTier === 'bulky' || a.bulkTier === 'very-bulky' || a.bulkTier === 'moderate')) {
      reasons.push({
        type: 'speed-control',
        label: 'Trick Room',
        description: `${b.name} has ${b.baseStats.spe} base Speed — devastating under Trick Room. ${a.name} could set it`,
        strength: 2,
      });
    }
  }

  // Tailwind: A is medium speed, B is fast with support typing
  if ((a.speedTier === 'medium' || a.speedTier === 'slow') && b.speedTier === 'fast') {
    if (b.types.includes('Flying') || b.types.includes('Fairy')) {
      reasons.push({
        type: 'speed-control',
        label: 'Tailwind',
        description: `${b.name}'s Flying/Fairy typing + speed suggests Tailwind access — would double ${a.name}'s ${a.baseStats.spe} Speed to ${a.baseStats.spe * 2}`,
        strength: 2,
      });
    }
  }
  if ((b.speedTier === 'medium' || b.speedTier === 'slow') && a.speedTier === 'fast') {
    if (a.types.includes('Flying') || a.types.includes('Fairy')) {
      reasons.push({
        type: 'speed-control',
        label: 'Tailwind',
        description: `${a.name} can set Tailwind — doubles ${b.name}'s ${b.baseStats.spe} Speed to ${b.baseStats.spe * 2}`,
        strength: 2,
      });
    }
  }

  return reasons;
}

// Support synergy (Intimidate, redirect, etc.)
function scoreSupportSynergy(a: AnalyzedPokemon, b: AnalyzedPokemon): SynergyReason[] {
  const reasons: SynergyReason[] = [];

  for (const bCat of b.abilityCategories) {
    // B has Intimidate and A is physically frail
    if (bCat.intimidate && a.bulkTier === 'frail') {
      reasons.push({
        type: 'support',
        label: 'Intimidate Shield',
        description: `${b.name}'s Intimidate protects ${a.name}'s low physical bulk (${a.baseStats.def} base Def) by dropping opponent Attack`,
        strength: 2,
      });
    }

    // B has type immunity that absorbs A's weakness
    if (bCat.immunityType && a.weaknesses.has(bCat.immunityType)) {
      const mult = a.weaknesses.get(bCat.immunityType)!;
      reasons.push({
        type: 'support',
        label: 'Ability Shield',
        description: `${b.name}'s ${b.abilities[0]} absorbs ${bCat.immunityType}-type attacks (${mult}x weakness on ${a.name})`,
        strength: mult >= 4 ? 3 : 2,
      });
    }
  }

  // Stat profile complementarity
  if (a.bulkTier === 'frail' && (b.bulkTier === 'bulky' || b.bulkTier === 'very-bulky')) {
    reasons.push({
      type: 'stat-profile',
      label: 'Bulk Complement',
      description: `${b.name} provides the defensive backbone that fragile ${a.name} needs — can take hits while ${a.name} attacks`,
      strength: 1,
    });
  }

  return reasons;
}

// ─── Main Engine ────────────────────────────────────────────────────

// Cache analyzed Pokemon
const analysisCache = new Map<string, AnalyzedPokemon>();

function getAnalysis(name: string): AnalyzedPokemon | null {
  if (analysisCache.has(name)) return analysisCache.get(name)!;
  const analysis = analyzePokemon(name);
  if (analysis) analysisCache.set(name, analysis);
  return analysis;
}

export function getRecommendations(selectedSpecies: string, otherSpecies?: string): SynergyRecommendation[] {
  const selected = getAnalysis(selectedSpecies);
  if (!selected) return [];

  const candidates = getAvailablePokemon();
  const recommendations: SynergyRecommendation[] = [];

  for (const candidateName of candidates) {
    if (candidateName === selectedSpecies || candidateName === otherSpecies) continue;

    const candidate = getAnalysis(candidateName);
    if (!candidate) continue;

    const reasons: SynergyReason[] = [
      ...scoreDefensiveSynergy(selected, candidate),
      ...scoreOffensiveSynergy(selected, candidate),
      ...scoreWeatherTerrainSynergy(selected, candidate),
      ...scoreSpeedSynergy(selected, candidate),
      ...scoreSupportSynergy(selected, candidate),
    ];

    if (reasons.length === 0) continue;

    const synergyScore = reasons.reduce((sum, r) => sum + r.strength, 0);

    // Meta viability bonus — S/A+ tier Pokemon get significant boosts
    const tierEntry = NORMAL_TIER_LIST.find(e => e.name === candidateName);
    const tierBonus: Record<string, number> = { S: 8, 'A+': 6, A: 4, B: 2, C: 0 };
    const viability = tierEntry ? (tierBonus[tierEntry.tier] || 0) : 0;

    // Preset bonus — Pokemon with presets are proven competitive picks
    const preset = PRESETS.find(p => p.species === candidateName);
    const presetBonus = preset ? 3 : 0;

    const totalScore = synergyScore + viability + presetBonus;

    if (viability > 0) {
      reasons.push({
        type: 'stat-profile',
        label: `${tierEntry!.tier} Tier`,
        description: `Meta-viable — ranked ${tierEntry!.tier} tier in competitive play`,
        strength: 0, // Don't double-count in display, just for context
      });
    }

    recommendations.push({
      species: candidateName,
      reasons,
      totalScore,
      preset: preset || undefined,
    });
  }

  // Sort by total score (synergy + meta viability)
  recommendations.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    const aTypes = new Set(a.reasons.map(r => r.type)).size;
    const bTypes = new Set(b.reasons.map(r => r.type)).size;
    return bTypes - aTypes;
  });

  return recommendations.slice(0, 12);
}

// ─── Team Analysis ──────────────────────────────────────────────────
// Analyze a pair of Pokemon for the results panel

export interface PairAnalysis {
  defensiveSynergy: number;  // 0-10 how well they cover each other
  offensivePressure: number; // 0-10 how many types they threaten together
  speedDynamic: string;      // description of speed interaction
  weaknessOverlap: string[]; // shared weaknesses (bad)
  suggestions: string[];     // actionable suggestions
}

export function analyzePair(speciesA: string, speciesB: string): PairAnalysis | null {
  const a = getAnalysis(speciesA);
  const b = getAnalysis(speciesB);
  if (!a || !b) return null;

  // Defensive synergy score
  let defScore = 0;
  for (const [wk] of a.weaknesses) {
    if (b.immunities.has(wk)) defScore += 2;
    else if (b.resistances.has(wk)) defScore += 1;
  }
  for (const [wk] of b.weaknesses) {
    if (a.immunities.has(wk)) defScore += 2;
    else if (a.resistances.has(wk)) defScore += 1;
  }
  const totalWeaknesses = a.weaknesses.size + b.weaknesses.size;
  const defensiveSynergy = totalWeaknesses > 0 ? Math.min(10, Math.round((defScore / totalWeaknesses) * 10)) : 5;

  // Offensive pressure — how many types do they hit SE together
  const combinedSE = new Set<string>();
  for (const aType of a.types) {
    for (const defType of ALL_TYPES) {
      if (getEffectiveness(aType, defType) > 1) combinedSE.add(defType);
    }
  }
  for (const bType of b.types) {
    for (const defType of ALL_TYPES) {
      if (getEffectiveness(bType, defType) > 1) combinedSE.add(defType);
    }
  }
  const offensivePressure = Math.min(10, Math.round((combinedSE.size / 18) * 10));

  // Speed dynamic
  let speedDynamic = '';
  const spdDiff = Math.abs(a.baseStats.spe - b.baseStats.spe);
  if (a.speedTier === 'very-slow' && b.speedTier === 'very-slow') {
    speedDynamic = 'Both very slow — Trick Room team candidate';
  } else if (a.speedTier === 'very-fast' && b.speedTier === 'very-fast') {
    speedDynamic = 'Both very fast — hyper offense duo';
  } else if (spdDiff > 50) {
    speedDynamic = `Large speed gap (${Math.max(a.baseStats.spe, b.baseStats.spe)} vs ${Math.min(a.baseStats.spe, b.baseStats.spe)}) — can operate in different speed modes`;
  } else {
    speedDynamic = `Similar speed range (${a.baseStats.spe} / ${b.baseStats.spe}) — compete for the same speed tier`;
  }

  // Shared weaknesses (dangerous overlap)
  const weaknessOverlap: string[] = [];
  for (const [wk] of a.weaknesses) {
    if (b.weaknesses.has(wk)) {
      weaknessOverlap.push(wk);
    }
  }

  // Generate suggestions
  const suggestions: string[] = [];

  if (weaknessOverlap.length > 0) {
    suggestions.push(`Shared ${weaknessOverlap.join('/')} weakness — add a teammate that resists these`);
  }

  if (a.offensiveProfile === b.offensiveProfile) {
    const side = a.offensiveProfile === 'physical' ? 'special' : 'physical';
    suggestions.push(`Both ${a.offensiveProfile} attackers — consider adding a ${side} threat to prevent walling`);
  }

  const hasWeatherSetter = a.abilityCategories.some(c => c.weather) || b.abilityCategories.some(c => c.weather);
  const hasWeatherAbuser = a.abilityCategories.some(c => c.weatherAbuse) || b.abilityCategories.some(c => c.weatherAbuse);
  if (hasWeatherSetter && !hasWeatherAbuser) {
    suggestions.push('Weather is being set but not abused — add a Swift Swim/Chlorophyll/Sand Rush partner');
  }
  if (!hasWeatherSetter && hasWeatherAbuser) {
    suggestions.push('Weather abuser without a setter — add a Drizzle/Drought/Sand Stream partner');
  }

  const hasIntimidate = a.abilityCategories.some(c => c.intimidate) || b.abilityCategories.some(c => c.intimidate);
  if (!hasIntimidate && (a.bulkTier === 'frail' || b.bulkTier === 'frail')) {
    suggestions.push('No Intimidate support for fragile team — consider Incineroar or Arcanine');
  }

  if (a.speedTier === 'medium' && b.speedTier === 'medium' && !hasWeatherAbuser) {
    suggestions.push('Mid-speed without speed control — add Tailwind (Whimsicott) or Trick Room (Mimikyu)');
  }

  if (defensiveSynergy <= 3) {
    suggestions.push('Poor defensive synergy — these Pokemon share too many weaknesses to form a core');
  }

  if (suggestions.length === 0) {
    if (defensiveSynergy >= 7 && offensivePressure >= 6) {
      suggestions.push('Excellent pairing — strong defensive coverage and offensive pressure');
    }
  }

  return {
    defensiveSynergy,
    offensivePressure,
    speedDynamic,
    weaknessOverlap,
    suggestions,
  };
}
