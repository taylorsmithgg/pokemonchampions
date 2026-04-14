// Dynamic synergy recommendation engine
// All analysis is algorithmic — derived from @smogon/calc type chart,
// stats, ability data, preset movesets, and live usage stats.
// NO hardcoded species lists. Every classification is derived from
// the data so it stays correct as the roster / preset library evolves.

import { getAvailablePokemon, getPokemonData, getTypeEffectiveness, getDefensiveMultiplier } from './champions';
import { PRESETS, type PokemonPreset } from './presets';
import { NORMAL_TIER_LIST } from './tierlist';
import {
  speciesRunsMove, speciesHasAbility as sharedSpeciesHasAbility,
  likelyHasSpreadEQ as sharedLikelyHasSpreadEQ,
  SETUP_MOVES, SUB_PASS_MOVES, PIVOT_MOVES, PRIORITY_MOVES,
  SACRIFICE_SCALE_MOVES, SACRIFICE_SCALE_ABILITIES,
  SKILL_SWAP_MOVES, WIDE_GUARD_MOVES, HELPING_HAND_MOVES,
} from './moveIndex';
import {
  WEATHER_SETTERS, WEATHER_ABUSERS, TYPE_IMMUNE_ABILITIES, TYPE_ABSORB_ABILITIES,
} from './abilityClassification';


// ─── Types ──────────────────────────────────────────────────────────

const ALL_TYPES = [
  'Normal', 'Grass', 'Fire', 'Water', 'Electric', 'Ice', 'Flying', 'Bug',
  'Poison', 'Ground', 'Rock', 'Fighting', 'Psychic', 'Ghost', 'Dragon',
  'Dark', 'Steel', 'Fairy',
] as const;
// Types used from ALL_TYPES for iteration

// Build type chart from @smogon/calc data
// Type effectiveness imported from champions.ts

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
  healFromType?: string;    // heals 25% HP when hit by this type (Earth Eater, Water Absorb, etc.)
  statDrop?: boolean;       // drops opponent stats on switch-in
}

// Classify abilities using centralized data from abilityClassification.ts.
// No more duplicated ability string checks — add an ability to the
// centralized file and every consumer picks it up.
function classifyAbility(name: string): AbilityCategory {
  const cat: AbilityCategory = {};
  const lower = name.toLowerCase();

  // Weather (from centralized maps)
  if (lower in WEATHER_SETTERS) cat.weather = WEATHER_SETTERS[lower];
  if (lower in WEATHER_ABUSERS) cat.weatherAbuse = WEATHER_ABUSERS[lower];

  // Terrain (small enough to keep inline — rarely changes)
  if (lower === 'electric surge') cat.terrain = 'Electric';
  if (lower === 'grassy surge') cat.terrain = 'Grassy';
  if (lower === 'misty surge') cat.terrain = 'Misty';
  if (lower === 'psychic surge') cat.terrain = 'Psychic';
  if (lower === 'surge surfer') cat.terrainAbuse = 'Electric';
  if (lower === 'grass pelt') cat.terrainAbuse = 'Grassy';

  // Intimidate
  if (lower === 'intimidate') { cat.intimidate = true; cat.statDrop = true; }

  // Type immunities (from centralized map)
  if (lower in TYPE_IMMUNE_ABILITIES) cat.immunityType = TYPE_IMMUNE_ABILITIES[lower];

  // Healing from absorbed type (from centralized map)
  if (lower in TYPE_ABSORB_ABILITIES) cat.healFromType = TYPE_ABSORB_ABILITIES[lower];

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
      if (getTypeEffectiveness(aType, defType) > 1) aHitsSE.add(defType);
    }
  }
  for (const bType of b.types) {
    for (const defType of ALL_TYPES) {
      if (getTypeEffectiveness(bType, defType) > 1) bHitsSE.add(defType);
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

// ─── Doubles Combo Tech ────────────────────────────────────────────
// Detects emergent synergies that go beyond type chart coverage:
// spread-move + ability-immunity healing, Sub-passing + setup,
// sacrifice scaling, priority chains, and weather-stacking.
//
// ALL classification is derived dynamically from:
//   1. Abilities via getPokemonData().abilities
//   2. Competitive moves via PRESETS + live usage stats
//   3. Base stats + typing as heuristic fallback
// NO hardcoded species lists. Adding a preset or updating a roster
// entry automatically enrolls species into synergy detection.

// ─── Combo-detection helpers (delegated to shared moveIndex) ───────
//
// All move/ability classification is in moveIndex.ts — the shared
// utility scans presets + live data + gen9 abilities so adding a
// preset automatically updates every downstream consumer.

function hasSetupAccess(species: string): boolean {
  return speciesRunsMove(species, SETUP_MOVES);
}

function hasSubPass(species: string): boolean {
  return speciesRunsMove(species, SUB_PASS_MOVES);
}

function hasPivotMove(species: string): boolean {
  return speciesRunsMove(species, PIVOT_MOVES);
}

function hasPriorityAccess(species: string): boolean {
  return speciesRunsMove(species, PRIORITY_MOVES);
}

function hasSacrificeScaling(species: string): boolean {
  if (speciesRunsMove(species, SACRIFICE_SCALE_MOVES)) return true;
  for (const ab of SACRIFICE_SCALE_ABILITIES) {
    if (sharedSpeciesHasAbility(species, ab)) return true;
  }
  return false;
}

// Re-export under local names for scoreDoublesCombos
const likelyHasSpreadEQ = sharedLikelyHasSpreadEQ;
const speciesHasAbility = sharedSpeciesHasAbility;

function scoreDoublesCombos(a: AnalyzedPokemon, b: AnalyzedPokemon): SynergyReason[] {
  const reasons: SynergyReason[] = [];

  // 1. Spread Earthquake + ability-immune/healing partner
  //    Derived from: likelyHasSpreadEQ() scans presets + base stats;
  //    Ground immunity scans abilities (Earth Eater, Levitate) + typing.
  if (likelyHasSpreadEQ(a.name) && b.immunities.has('Ground')) {
    const heals = b.abilityCategories.some(c => c.healFromType === 'Ground');
    reasons.push({
      type: 'support',
      label: heals ? 'EQ Healing Partner' : 'EQ-Safe Partner',
      description: heals
        ? `${a.name} spams Earthquake — ${b.name}'s ${b.abilities[0]} heals 25% per hit instead of taking damage`
        : `${a.name} spams Earthquake freely — ${b.name} is Ground-immune via ${b.abilities[0]}`,
      strength: heals ? 4 : 3,
    });
  }
  if (likelyHasSpreadEQ(b.name) && a.immunities.has('Ground')) {
    const heals = a.abilityCategories.some(c => c.healFromType === 'Ground');
    reasons.push({
      type: 'support',
      label: heals ? 'EQ Healing Partner' : 'EQ-Safe Partner',
      description: heals
        ? `${b.name} spams Earthquake — ${a.name}'s ${a.abilities[0]} heals 25% per hit`
        : `${b.name} spams Earthquake freely — ${a.name} is Ground-immune via ${a.abilities[0]}`,
      strength: heals ? 4 : 3,
    });
  }

  // 2. Shed Tail → setup sweeper
  //    Derived from: hasSubPass() scans presets for Shed Tail;
  //    hasSetupAccess() scans presets for SD/DD/NP/CM/etc.
  if (hasSubPass(a.name) && hasSetupAccess(b.name)) {
    reasons.push({
      type: 'support',
      label: 'Shed Tail → Setup',
      description: `${a.name} passes a Substitute via Shed Tail → ${b.name} sets up behind it for free. One of the strongest openers in Champions.`,
      strength: 4,
    });
  }
  if (hasSubPass(b.name) && hasSetupAccess(a.name)) {
    reasons.push({
      type: 'support',
      label: 'Shed Tail → Setup',
      description: `${b.name} passes a Substitute via Shed Tail → ${a.name} sets up behind it for free.`,
      strength: 4,
    });
  }

  // 3. Sacrifice scaling (Last Respects / Supreme Overlord)
  //    Derived from: hasSacrificeScaling() scans presets for Last Respects
  //    + abilities for Supreme Overlord.
  if (hasSacrificeScaling(b.name)) {
    if (a.bulkTier === 'frail' || hasSubPass(a.name)) {
      reasons.push({
        type: 'offensive',
        label: 'Sacrifice Scaling Enabler',
        description: `${a.name} goes down early (or sacrifices via Shed Tail) → ${b.name}'s damage scales up with each fainted ally.`,
        strength: 3,
      });
    }
  }
  if (hasSacrificeScaling(a.name)) {
    if (b.bulkTier === 'frail' || hasSubPass(b.name)) {
      reasons.push({
        type: 'offensive',
        label: 'Sacrifice Scaling Enabler',
        description: `${b.name} goes down early → ${a.name}'s damage scales up with each fainted ally.`,
        strength: 3,
      });
    }
  }

  // 4. Form-change pivot chain (species with pivot moves + form-change abilities)
  //    Derived from: hasPivotMove() scans presets for Flip Turn / U-turn /
  //    Volt Switch; the "Zero to Hero" ability is detected dynamically.
  const aHasFormChange = speciesHasAbility(a.name, 'zero to hero');
  const bHasFormChange = speciesHasAbility(b.name, 'zero to hero');
  if (aHasFormChange && hasPivotMove(a.name)) {
    if (b.bulkTier === 'bulky' || b.bulkTier === 'very-bulky' || b.abilityCategories.some(c => c.intimidate)) {
      reasons.push({
        type: 'support',
        label: 'Form-Change Enabler',
        description: `${a.name} pivots out (transforms via ${a.abilities[0]}) → ${b.name} absorbs the hit → ${a.name} returns in powered-up form with priority access.`,
        strength: 3,
      });
    }
  }
  if (bHasFormChange && hasPivotMove(b.name)) {
    if (a.bulkTier === 'bulky' || a.bulkTier === 'very-bulky' || a.abilityCategories.some(c => c.intimidate)) {
      reasons.push({
        type: 'support',
        label: 'Form-Change Enabler',
        description: `${b.name} pivots out (transforms via ${b.abilities[0]}) → ${a.name} absorbs the hit → ${b.name} returns powered up.`,
        strength: 3,
      });
    }
  }

  // 5. Hospitality healing partner
  //    Derived from: speciesHasAbility() scans for "Hospitality".
  const aHasHospitality = speciesHasAbility(a.name, 'hospitality');
  const bHasHospitality = speciesHasAbility(b.name, 'hospitality');
  if (bHasHospitality && (a.bulkTier === 'frail' || a.bulkTier === 'moderate')) {
    reasons.push({
      type: 'support',
      label: 'Hospitality Healing',
      description: `${b.name}'s Hospitality heals ${a.name} by 25% on every switch-in — sustains fragile attackers across the game.`,
      strength: 2,
    });
  }
  if (aHasHospitality && (b.bulkTier === 'frail' || b.bulkTier === 'moderate')) {
    reasons.push({
      type: 'support',
      label: 'Hospitality Healing',
      description: `${a.name}'s Hospitality heals ${b.name} by 25% on every switch-in.`,
      strength: 2,
    });
  }

  // 6. Weather-stacking STAB
  //    Purely type-derived — no hardcoded species.
  if (a.types.includes('Ice') && b.types.includes('Ice')) {
    reasons.push({
      type: 'weather',
      label: 'Double Blizzard',
      description: `Both ${a.name} and ${b.name} are Ice-type — under Snow they both fire 100% Blizzard and get +50% Defense.`,
      strength: 3,
    });
  }
  if (a.types.includes('Fire') && b.types.includes('Fire') && !a.abilityCategories.some(c => c.weather === 'Sun') && !b.abilityCategories.some(c => c.weather === 'Sun')) {
    reasons.push({
      type: 'weather',
      label: 'Double Fire STAB',
      description: `Both ${a.name} and ${b.name} are Fire-type — under Sun both get +50% Fire moves. Pair with a Drought setter.`,
      strength: 2,
    });
  }

  // 7. Priority chaining — two priority users cover different types
  //    Derived from: hasPriorityAccess() scans presets for priority moves.
  if (hasPriorityAccess(a.name) && hasPriorityAccess(b.name)) {
    const aTypes = new Set(a.types);
    const bTypes = new Set(b.types);
    const overlap = [...aTypes].filter(t => bTypes.has(t)).length;
    if (overlap === 0) {
      reasons.push({
        type: 'offensive',
        label: 'Priority Coverage Duo',
        description: `Both ${a.name} and ${b.name} have priority moves with non-overlapping STAB — covers more endgame cleanup threats.`,
        strength: 2,
      });
    }
  }

  // 8. Skill Swap ability transfer
  //    If A has Skill Swap AND a powerful offensive ability (Huge Power,
  //    Pure Power, etc.), it can transfer that ability to B who has
  //    higher base Attack. This is the Mega Starmie → Tyranitar combo.
  const aHasSkillSwap = speciesRunsMove(a.name, SKILL_SWAP_MOVES);
  const bHasSkillSwap = speciesRunsMove(b.name, SKILL_SWAP_MOVES);
  const powerAbilities = ['huge power', 'pure power'];

  if (aHasSkillSwap) {
    const aHasPowerAbility = a.abilities.some(ab => powerAbilities.includes(ab.toLowerCase()));
    if (aHasPowerAbility && b.baseStats.atk >= 90) {
      const effectiveAtk = b.baseStats.atk * 2;
      reasons.push({
        type: 'support',
        label: 'Skill Swap → Huge Power Transfer',
        description: `${a.name} passes Huge Power via Skill Swap → ${b.name} gets ${effectiveAtk} effective Attack. One-turn Swords Dance equivalent without setup.`,
        strength: 5,
      });
    }
  }
  if (bHasSkillSwap) {
    const bHasPowerAbility = b.abilities.some(ab => powerAbilities.includes(ab.toLowerCase()));
    if (bHasPowerAbility && a.baseStats.atk >= 90) {
      const effectiveAtk = a.baseStats.atk * 2;
      reasons.push({
        type: 'support',
        label: 'Skill Swap → Huge Power Transfer',
        description: `${b.name} passes Huge Power via Skill Swap → ${a.name} gets ${effectiveAtk} effective Attack.`,
        strength: 5,
      });
    }
  }

  // 9. Wide Guard + spread-move user
  //    Wide Guard protects both slots from spread moves including your
  //    own Earthquake — key combo for enabling free EQ spam.
  const aHasWideGuard = speciesRunsMove(a.name, WIDE_GUARD_MOVES);
  const bHasWideGuard = speciesRunsMove(b.name, WIDE_GUARD_MOVES);
  if (aHasWideGuard && likelyHasSpreadEQ(b.name)) {
    reasons.push({
      type: 'support',
      label: 'Wide Guard + Earthquake',
      description: `${a.name} Wide Guards while ${b.name} Earthquakes — protects your side from the spread damage while hitting both opponents.`,
      strength: 3,
    });
  }
  if (bHasWideGuard && likelyHasSpreadEQ(a.name)) {
    reasons.push({
      type: 'support',
      label: 'Wide Guard + Earthquake',
      description: `${b.name} Wide Guards while ${a.name} Earthquakes freely.`,
      strength: 3,
    });
  }

  // 10. Helping Hand + high-offense partner
  //     Helping Hand boosts the partner's attack by 50% — pairs best
  //     with already-powerful attackers for OHKO thresholds.
  const aHasHelpingHand = speciesRunsMove(a.name, HELPING_HAND_MOVES);
  const bHasHelpingHand = speciesRunsMove(b.name, HELPING_HAND_MOVES);
  const highOffenseThreshold = 110;
  if (aHasHelpingHand && Math.max(b.baseStats.atk, b.baseStats.spa) >= highOffenseThreshold) {
    reasons.push({
      type: 'support',
      label: 'Helping Hand Boost',
      description: `${a.name} Helping Hands → ${b.name}'s attacks deal 50% more damage. Pushes OHKOs past defensive thresholds.`,
      strength: 2,
    });
  }
  if (bHasHelpingHand && Math.max(a.baseStats.atk, a.baseStats.spa) >= highOffenseThreshold) {
    reasons.push({
      type: 'support',
      label: 'Helping Hand Boost',
      description: `${b.name} Helping Hands → ${a.name}'s attacks deal 50% more damage.`,
      strength: 2,
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

export function getRecommendations(selectedSpecies: string, otherSpecies?: string, formatId?: string): SynergyRecommendation[] {
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
      // Doubles-specific combos (Shed Tail → partner, EQ + ally healing,
      // Follow Me redirect, etc.) only apply in Doubles format.
      ...(formatId !== 'singles' ? scoreDoublesCombos(selected, candidate) : []),
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
      if (getTypeEffectiveness(aType, defType) > 1) combinedSE.add(defType);
    }
  }
  for (const bType of b.types) {
    for (const defType of ALL_TYPES) {
      if (getTypeEffectiveness(bType, defType) > 1) combinedSE.add(defType);
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
