// ─── Champions Singles Meta Projection Engine ─────────────────────
//
// Sibling to doublesMetaProjection. Singles has a completely
// different meta: no Fake Out / redirection / Wide Guard, but
// instead hazards, setup sweepers, pivoting, status spreading, and
// phazing. A Pokemon's value in Singles is about standing alone in
// 1v1s and winning via setup / hazards / pivot chains, not about
// lead pair synergy.
//
// This engine scores every Champions-legal Pokemon for Singles from
// first principles, detects emerging Singles archetype cores
// (Hyper Offense, Balance, Stall, Weather Offense, Trick Room,
// Volt-Turn), and exposes a projection report with the same shape
// as the Doubles engine so the team comp generator can consume
// either format.

import { getAvailablePokemon, getPokemonData, getDefensiveMultiplier, hasChampionsMega } from '../data/champions';
import { MEGA_STONE_MAP } from '../data/championsRoster';
import {
  buildSetupIndex, buildMoveRoleSet,
  HAZARD_MOVES, HAZARD_REMOVAL_MOVES, RECOVERY_MOVES, PIVOT_MOVES as PIVOT_MOVE_SET,
  PHAZING_MOVES, STATUS_MOVES,
} from '../data/moveIndex';

// ─── Types ─────────────────────────────────────────────────────────

export type SinglesRole =
  | 'Setup Sweeper'    // SD / DD / NP / CM / QD / SS boosters
  | 'Hazard Setter'    // Stealth Rock, Spikes, Toxic Spikes, Sticky Web
  | 'Hazard Removal'   // Rapid Spin, Defog, Tidy Up, Court Change
  | 'Choice Scarf'     // Revenge killer / cleaner
  | 'Wallbreaker'      // Choice Band / Specs
  | 'Physical Wall'    // high def + recovery
  | 'Special Wall'     // high spd + recovery
  | 'Pivot'            // U-turn / Volt Switch / Parting Shot / Teleport
  | 'Phazer'           // Roar / Whirlwind / Dragon Tail — defense vs setup
  | 'Status Spreader'  // Will-O-Wisp / Toxic / Thunder Wave
  | 'Lead'             // Focus Sash lead / hazard-setting lead
  | 'Wincon'           // Mega with game-changing ability
  | 'Utility';

export interface SinglesProjection {
  species: string;
  score: number;
  tier: 'S' | 'A+' | 'A' | 'B' | 'C';
  roles: SinglesRole[];
  breakdown: {
    sweeperValue: number;     // 0-25
    utilityValue: number;     // 0-20
    defensiveValue: number;   // 0-20
    individualPower: number;  // 0-15
    championsAdjust: number;  // -10 to +15
  };
  reasoning: string[];
  championsFactors: string[];
  hasMega: boolean;
  megaStone?: string;
}

export interface SinglesArchetypeCore {
  name: string;
  description: string;
  anchors: string[];
  partners: string[];
  winCondition: string;
  requires: string[];
}

export interface SinglesProjectionReport {
  timestamp: number;
  rankings: SinglesProjection[];
  cores: SinglesArchetypeCore[];
  insights: string[];
  roleLeaders: Record<SinglesRole, string[]>;
  darkHorses: SinglesProjection[];
}

// ─── Champions-Specific Adjustments (Singles flavor) ──────────────

// Z-A Megas with new abilities. The Singles impact is different
// from Doubles — some new abilities matter more/less here.
const SINGLES_MEGA_ABILITIES: Record<string, { ability: string; impact: number; reason: string }> = {
  Meganium: {
    ability: 'Mega Sol',
    impact: 9,
    reason: 'Permanent Sun without needing a setter — enables Chlorophyll sweepers without wasting a turn to Drought',
  },
  Dragonite: {
    ability: 'Dragonize',
    impact: 11,
    reason: 'Dragonize + Extreme Speed gives priority Dragon STAB — bypasses Choice Scarf revenge killers entirely',
  },
  Starmie: {
    ability: 'Huge Power',
    impact: 9,
    reason: 'Huge Power doubles Attack — unexpected physical sweeper from a species the meta prepares for specially',
  },
  Froslass: {
    ability: 'Snow Warning',
    impact: 6,
    reason: 'Auto-Snow sets up a weather core without dedicating a slot',
  },
  Skarmory: {
    ability: 'Stalwart',
    impact: 5,
    reason: 'Stalwart bypasses redirection — but more importantly, Skarmory\'s hazard-setting role stays elite',
  },
};

// Singles-specific vacant roles. These differ from Doubles because
// Singles cares less about Amoonguss (no Rage Powder in Singles)
// and more about Gholdengo (Good as Gold + Nasty Plot is a Singles
// staple) and Kingdra (rain abuser).
const SINGLES_VACANT_ROLES: { role: string; missing: string; fillers: string[]; bonus: number }[] = [
  {
    role: 'Steel win condition',
    missing: 'Gholdengo',
    fillers: ['Kingambit', 'Archaludon', 'Aegislash-Shield'],
    bonus: 6,
  },
  {
    role: 'Swift Swim rain sweeper',
    missing: 'Kingdra',
    fillers: ['Primarina', 'Greninja'],
    bonus: 4,
  },
  {
    role: 'Grass priority',
    missing: 'Rillaboom',
    fillers: ['Meowscarada'],
    bonus: 4,
  },
];

// ─── Move Category Detection ───────────────────────────────────────
// Singles cares about different move categories than Doubles. These
// allowlists are based on well-known Singles sets in Gen 9 — they
// give the projection engine a heuristic for "could this Pokemon
// plausibly run X".

// ─── Dynamic role classification ───────────────────────────────────
// All role sets are derived from presets + live data + gen9 abilities
// via the shared moveIndex. NO hardcoded species lists — adding a
// preset auto-enrolls a species into role detection.

// Lazy-initialized caches — built once on first access.
let _setupMoves: Record<string, 'physical' | 'special' | 'both'> | null = null;
let _hazardSetters: Set<string> | null = null;
let _hazardRemovers: Set<string> | null = null;
let _recoveryUsers: Set<string> | null = null;
let _phazers: Set<string> | null = null;
let _statusSpreaders: Set<string> | null = null;
let _pivotUsers: Set<string> | null = null;

function getKnownSetupMoves(): Record<string, 'physical' | 'special' | 'both'> {
  if (!_setupMoves) _setupMoves = buildSetupIndex();
  return _setupMoves;
}
function getKnownHazardSetters(): Set<string> {
  if (!_hazardSetters) _hazardSetters = buildMoveRoleSet(HAZARD_MOVES);
  return _hazardSetters;
}
function getKnownHazardRemovers(): Set<string> {
  if (!_hazardRemovers) _hazardRemovers = buildMoveRoleSet(HAZARD_REMOVAL_MOVES);
  return _hazardRemovers;
}
function getKnownRecoveryUsers(): Set<string> {
  if (!_recoveryUsers) _recoveryUsers = buildMoveRoleSet(RECOVERY_MOVES);
  return _recoveryUsers;
}
function getKnownPhazers(): Set<string> {
  if (!_phazers) _phazers = buildMoveRoleSet(PHAZING_MOVES);
  return _phazers;
}
function getKnownStatusSpreaders(): Set<string> {
  if (!_statusSpreaders) _statusSpreaders = buildMoveRoleSet(STATUS_MOVES);
  return _statusSpreaders;
}
function getKnownPivotUsers(): Set<string> {
  if (!_pivotUsers) _pivotUsers = buildMoveRoleSet(PIVOT_MOVE_SET);
  return _pivotUsers;
}

// Choice Scarf viability: derived from base speed ≥ 85 + offensive stats
function isChoiceScarfViable(species: string): boolean {
  const data = getPokemonData(species);
  if (!data) return false;
  const bs = data.baseStats;
  return bs.spe >= 85 && Math.max(bs.atk, bs.spa) >= 90;
}

// Backward-compat aliases for the scoring functions below.
const KNOWN_SETUP_MOVES = new Proxy({} as Record<string, 'physical' | 'special' | 'both'>, {
  get(_target, prop: string) { return getKnownSetupMoves()[prop]; },
  has(_target, prop: string) { return prop in getKnownSetupMoves(); },
});
const KNOWN_HAZARD_SETTERS = { has: (s: string) => getKnownHazardSetters().has(s) };
const KNOWN_HAZARD_REMOVERS = { has: (s: string) => getKnownHazardRemovers().has(s) };
const KNOWN_RECOVERY_USERS = { has: (s: string) => getKnownRecoveryUsers().has(s) };
const KNOWN_PHAZERS = { has: (s: string) => getKnownPhazers().has(s) };
const KNOWN_STATUS_SPREADERS = { has: (s: string) => getKnownStatusSpreaders().has(s) };
const KNOWN_PIVOT_MOVES = { has: (s: string) => getKnownPivotUsers().has(s) };
const KNOWN_CHOICE_SCARF_USERS = { has: (s: string) => isChoiceScarfViable(s) };

// ─── Core Scoring ──────────────────────────────────────────────────

function scoreSweeperValue(species: string): { score: number; reasons: string[] } {
  const data = getPokemonData(species);
  if (!data) return { score: 0, reasons: [] };
  const reasons: string[] = [];
  let score = 0;

  const bs = data.baseStats;
  const maxOffense = Math.max(bs.atk, bs.spa);
  const spe = bs.spe;

  // Raw stat baseline
  if (maxOffense >= 130) { score += 8; reasons.push(`Elite offense (${maxOffense})`); }
  else if (maxOffense >= 110) { score += 6; reasons.push(`Strong offense (${maxOffense})`); }
  else if (maxOffense >= 90) score += 4;

  // Speed tier
  if (spe >= 120) { score += 7; reasons.push(`Elite Speed (${spe})`); }
  else if (spe >= 100) { score += 5; reasons.push(`Fast (${spe} base)`); }
  else if (spe >= 85) score += 3;
  else if (spe <= 45 && Math.max(bs.hp + bs.def + bs.spd) > 200) {
    // Slow but bulky — Trick Room potential
    score += 2;
  }

  // Setup move access
  const setupType = KNOWN_SETUP_MOVES[species];
  if (setupType) {
    score += 6;
    const moveNames: Record<string, string> = {
      Garchomp: 'Swords Dance', Gyarados: 'Dragon Dance', Dragonite: 'Dragon Dance',
      Scizor: 'Swords Dance', Weavile: 'Swords Dance', Tyranitar: 'Dragon Dance',
      Volcarona: 'Quiver Dance', Mimikyu: 'Swords Dance', Lucario: 'Swords Dance',
      Gengar: 'Nasty Plot', Gardevoir: 'Calm Mind', Alakazam: 'Calm Mind',
      Meowscarada: 'Swords Dance', Kingambit: 'Swords Dance',
    };
    const move = moveNames[species];
    reasons.push(move ? `${move} setup sweeper` : 'Setup move access');
  }

  // Priority access rewards offensive Pokemon
  if (['Talonflame', 'Weavile', 'Scizor', 'Sneasler', 'Mamoswine', 'Lycanroc', 'Arcanine', 'Kingambit', 'Dragonite'].includes(species)) {
    score += 3;
  }

  // Power abilities
  const ability = (data.abilities?.[0] || '') as string;
  if (['Huge Power', 'Pure Power', 'Sheer Force', 'Tough Claws', 'Adaptability'].includes(ability)) {
    score += 4;
    reasons.push(`${ability} massively boosts damage output`);
  }

  return { score: Math.min(25, score), reasons };
}

function scoreUtilityValue(species: string): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Hazard setting
  if (KNOWN_HAZARD_SETTERS.has(species)) {
    score += 6;
    reasons.push('Hazard setter (Stealth Rock / Spikes)');
  }

  // Hazard removal
  if (KNOWN_HAZARD_REMOVERS.has(species)) {
    score += 5;
    reasons.push('Hazard control (Rapid Spin / Defog)');
  }

  // Status spreading
  if (KNOWN_STATUS_SPREADERS.has(species)) {
    score += 4;
    reasons.push('Status spreader');
  }

  // Pivot moves
  if (KNOWN_PIVOT_MOVES.has(species)) {
    score += 4;
    reasons.push('Pivot move momentum');
  }

  // Phazing
  if (KNOWN_PHAZERS.has(species)) {
    score += 3;
    reasons.push('Phazing counters opposing setup');
  }

  return { score: Math.min(20, score), reasons };
}

function scoreSinglesDefense(species: string, pool: string[]): { score: number; reasons: string[] } {
  const data = getPokemonData(species);
  if (!data) return { score: 0, reasons: [] };
  const reasons: string[] = [];
  let score = 0;

  const bs = data.baseStats;
  const types = [...data.types] as string[];

  // Bulk
  const bulk = bs.hp + (bs.def + bs.spd) / 2;
  if (bulk > 230) { score += 7; reasons.push('Exceptional bulk'); }
  else if (bulk > 200) score += 5;
  else if (bulk > 170) score += 3;

  // Recovery access — critical in Singles
  if (KNOWN_RECOVERY_USERS.has(species)) {
    score += 5;
    reasons.push('Reliable recovery');
  }

  // Resistance coverage
  let resists = 0;
  const sample = pool.slice(0, 40);
  for (const n of sample) {
    const d = getPokemonData(n);
    if (!d) continue;
    for (const atkType of d.types) {
      if (getDefensiveMultiplier(atkType as string, types) < 1) {
        resists++;
        break;
      }
    }
  }
  const resistRatio = resists / sample.length;
  if (resistRatio > 0.5) {
    score += 5;
    reasons.push(`Resists ${Math.round(resistRatio * 100)}% of meta attackers`);
  } else if (resistRatio > 0.3) {
    score += 2;
  }

  // Defensive abilities
  const ability = (data.abilities?.[0] || '') as string;
  if (ability === 'Regenerator') { score += 4; reasons.push('Regenerator — free healing on switch'); }
  if (ability === 'Magic Guard') { score += 3; reasons.push('Magic Guard ignores indirect damage'); }
  if (ability === 'Natural Cure') { score += 2; }

  return { score: Math.min(20, score), reasons };
}

function scoreIndividualPower(species: string): { score: number; reasons: string[] } {
  const data = getPokemonData(species);
  if (!data) return { score: 0, reasons: [] };
  const reasons: string[] = [];
  let score = 0;

  const bs = data.baseStats;
  const bst = bs.hp + bs.atk + bs.def + bs.spa + bs.spd + bs.spe;

  if (bst >= 600) { score += 6; reasons.push(`Elite BST (${bst})`); }
  else if (bst >= 550) score += 4;
  else if (bst >= 500) score += 2;

  // Choice item wearer — single-move wallbreaker value
  if (KNOWN_CHOICE_SCARF_USERS.has(species)) score += 3;

  // Mega eligibility
  if (hasChampionsMega(species)) score += 3;

  return { score: Math.min(15, score), reasons };
}

function scoreSinglesChampionsAdjust(species: string): { score: number; reasons: string[]; factors: string[] } {
  const reasons: string[] = [];
  const factors: string[] = [];
  let score = 0;

  // Z-A Mega ability buffs — filtered to Megas actually in Champions
  const megaBuff = SINGLES_MEGA_ABILITIES[species];
  if (megaBuff && MEGA_STONE_MAP[species]) {
    score += megaBuff.impact;
    reasons.push(megaBuff.reason);
    factors.push(`New Mega ability: ${megaBuff.ability}`);
  }

  // Vacant role fillers
  for (const vr of SINGLES_VACANT_ROLES) {
    if (vr.fillers.includes(species)) {
      score += vr.bonus;
      reasons.push(`Fills ${vr.missing}'s vacated ${vr.role} role`);
      factors.push(`Vacant role: ${vr.role} (${vr.missing} absent)`);
      break;
    }
  }

  // Status condition nerf beneficiaries — sleep/paralysis weaker
  // helps setup sweepers the most
  const setupType = KNOWN_SETUP_MOVES[species];
  if (setupType) {
    score += 2;
    factors.push('Status nerfs benefit setup sweepers (paralysis 1/8, sleep 2-3 turns)');
  }

  // Base Mega bonus
  if (hasChampionsMega(species) && !megaBuff) {
    score += 2;
    factors.push('Mega Evolution eligible');
  }

  return { score: Math.max(-10, Math.min(15, score)), reasons, factors };
}

// ─── Role Classification ───────────────────────────────────────────

function classifyRoles(species: string, bd: SinglesProjection['breakdown'], hasMega: boolean): SinglesRole[] {
  const data = getPokemonData(species);
  if (!data) return ['Utility'];
  const bs = data.baseStats;
  const ability = (data.abilities?.[0] || '') as string;
  const roles: SinglesRole[] = [];

  // Wincon — Mega with game-changing ability
  if (hasMega && SINGLES_MEGA_ABILITIES[species]) {
    roles.push('Wincon');
  }

  // Setup Sweeper
  if (KNOWN_SETUP_MOVES[species]) {
    roles.push('Setup Sweeper');
  }

  // Hazard Setter
  if (KNOWN_HAZARD_SETTERS.has(species)) {
    roles.push('Hazard Setter');
  }

  // Hazard Removal
  if (KNOWN_HAZARD_REMOVERS.has(species)) {
    roles.push('Hazard Removal');
  }

  // Pivot
  if (KNOWN_PIVOT_MOVES.has(species)) {
    roles.push('Pivot');
  }

  // Phazer
  if (KNOWN_PHAZERS.has(species)) {
    roles.push('Phazer');
  }

  // Status Spreader
  if (KNOWN_STATUS_SPREADERS.has(species)) {
    roles.push('Status Spreader');
  }

  // Choice Scarf revenge killer
  if (KNOWN_CHOICE_SCARF_USERS.has(species) && bs.spe >= 90) {
    roles.push('Choice Scarf');
  }

  // Wallbreaker — Choice Band/Specs power
  if (bd.sweeperValue >= 14 && Math.max(bs.atk, bs.spa) >= 100 && bs.spe < 100) {
    roles.push('Wallbreaker');
  }

  // Physical Wall
  if (bs.def > bs.spd && bs.hp + bs.def > 180 && KNOWN_RECOVERY_USERS.has(species)) {
    roles.push('Physical Wall');
  }

  // Special Wall
  if (bs.spd > bs.def && bs.hp + bs.spd > 180 && KNOWN_RECOVERY_USERS.has(species)) {
    roles.push('Special Wall');
  }

  // Lead — fast with Focus Sash or hazard-setting lead
  if (bs.spe >= 100 && (KNOWN_HAZARD_SETTERS.has(species) || ability === 'Sturdy')) {
    roles.push('Lead');
  }

  if (roles.length === 0) roles.push('Utility');
  return roles;
}

// ─── Archetype Core Detection ──────────────────────────────────────

function detectSinglesCores(rankings: SinglesProjection[]): SinglesArchetypeCore[] {
  const eligible = new Set(rankings.filter(r => r.score >= 30).map(r => r.species));
  const cores: SinglesArchetypeCore[] = [];
  const has = (n: string) => eligible.has(n);

  // Hyper Offense — fast setup sweepers + Stealth Rock lead
  if ((has('Garchomp') || has('Mimikyu') || has('Dragonite')) && (has('Hippowdon') || has('Tyranitar') || has('Glimmora'))) {
    cores.push({
      name: 'Hyper Offense',
      description: 'Fast setup sweepers chain one-shot kills while a hazard lead chips the opponent\'s switch-ins. Every member is an offensive threat — nothing passive.',
      anchors: ['Garchomp', 'Mimikyu', 'Dragonite'].filter(has).slice(0, 2),
      partners: ['Glimmora', 'Weavile', 'Volcarona', 'Kingambit', 'Dragapult'].filter(has),
      winCondition: 'Set Stealth Rock → force switches → setup sweep through weakened team',
      requires: ['Hazard setter', 'Multiple setup sweepers'],
    });
  }

  // Balance — hazards + pivot + wincon + wall
  if (has('Corviknight') || has('Hippowdon')) {
    cores.push({
      name: 'Balance',
      description: 'A balanced team with a hazard setter, a defensive pivot (Regenerator preferred), a setup sweeper, and a bulky wall. Wins via attrition + setup in the endgame.',
      anchors: ['Hippowdon', 'Corviknight'].filter(has).slice(0, 2),
      partners: ['Clefable', 'Garchomp', 'Dragonite', 'Slowking', 'Hydreigon'].filter(has),
      winCondition: 'Attrition via hazards + pivot cycling → setup sweeper cleans late game',
      requires: ['Hazard setter', 'Recovery user', 'Wincon'],
    });
  }

  // Stall — full walls + Toxic + hazards
  if (has('Hippowdon') && has('Clefable')) {
    cores.push({
      name: 'Stall',
      description: 'Heavy defensive core — multiple walls with recovery, Toxic stall, and hazard chip. Wins by outlasting anything that isn\'t a wallbreaker.',
      anchors: ['Hippowdon', 'Clefable'].filter(has),
      partners: ['Corviknight', 'Slowking', 'Umbreon', 'Sylveon', 'Milotic'].filter(has),
      winCondition: 'Passive damage via Toxic + hazards + Sand chip, kept up by recovery',
      requires: ['Toxic user', 'Hazards', 'Hazard control', 'Bulky walls'],
    });
  }

  // Rain Offense — Pelipper Drizzle + rain sweepers
  if (has('Pelipper')) {
    cores.push({
      name: 'Rain Offense',
      description: 'Pelipper sets Rain via Drizzle, enabling Primarina and Greninja to abuse boosted Water STAB. Dragon cleaners follow up.',
      anchors: ['Pelipper'],
      partners: ['Primarina', 'Greninja', 'Dragonite', 'Garchomp'].filter(has),
      winCondition: 'Rain-boosted Water attacks break walls; cleaners sweep survivors',
      requires: ['Drizzle setter', 'Water attackers'],
    });
  }

  // Sand Offense — Tyranitar + Excadrill Sand Rush
  if (has('Tyranitar') && has('Excadrill')) {
    cores.push({
      name: 'Sand Offense',
      description: 'Tyranitar sets Sand via Sand Stream, Excadrill doubles its speed with Sand Rush and sweeps through the weakened field. Classic singles powerhouse.',
      anchors: ['Tyranitar', 'Excadrill'],
      partners: ['Garchomp', 'Gliscor', 'Rhyperior', 'Mamoswine'].filter(has),
      winCondition: 'Excadrill outspeeds the entire meta in Sand, cleans with Earthquake + Iron Head',
      requires: ['Sand Stream', 'Sand Rush'],
    });
  }

  // Sun Offense
  if (has('Charizard') || has('Meganium')) {
    cores.push({
      name: 'Sun Offense',
      description: 'Mega Charizard Y (Drought) or Mega Meganium (Mega Sol) enables Chlorophyll sweepers and Fire-boosted STAB. Solar Beam has no charge turn.',
      anchors: ['Charizard', 'Meganium'].filter(has).slice(0, 1),
      partners: ['Venusaur', 'Victreebel', 'Torkoal', 'Arcanine'].filter(has),
      winCondition: 'Sun-boosted Fire + Chlorophyll speed break through walls',
      requires: ['Sun setter', 'Chlorophyll abuser'],
    });
  }

  // Trick Room
  if (has('Hatterene') || has('Reuniclus')) {
    cores.push({
      name: 'Trick Room',
      description: 'Psychic-type setter (Hatterene / Reuniclus / Slowking) flips the speed tier, and slow wallbreakers like Rhyperior or Conkeldurr clean up with reversed priority.',
      anchors: ['Hatterene', 'Reuniclus', 'Slowking'].filter(has).slice(0, 2),
      partners: ['Rhyperior', 'Conkeldurr', 'Mamoswine', 'Kingambit'].filter(has),
      winCondition: 'Setup Trick Room → slow attackers outspeed for 5 turns → sweep',
      requires: ['Trick Room setter', 'Slow wallbreakers'],
    });
  }

  // Volt-Turn
  if (has('Rotom') || has('Corviknight')) {
    cores.push({
      name: 'Volt-Turn',
      description: 'Momentum-based team using Volt Switch, U-turn, and Parting Shot to keep the advantageous matchup on the field at all times. Wears down the opponent through pivot chains.',
      anchors: ['Rotom', 'Corviknight', 'Scizor'].filter(has).slice(0, 2),
      partners: ['Hydreigon', 'Dragapult', 'Garchomp', 'Weavile'].filter(has),
      winCondition: 'Pivot chains force favorable matchups; hazards chip every entry',
      requires: ['Pivot moves on 3+ members', 'Hazard setter'],
    });
  }

  return cores;
}

// ─── Main Engine ───────────────────────────────────────────────────

export function generateSinglesProjection(): SinglesProjectionReport {
  const pool = getAvailablePokemon();
  const rankings: SinglesProjection[] = [];

  for (const species of pool) {
    const data = getPokemonData(species);
    if (!data) continue;
    const bst = data.baseStats.hp + data.baseStats.atk + data.baseStats.def +
                data.baseStats.spa + data.baseStats.spd + data.baseStats.spe;
    if (bst < 400) continue;

    const sweeper = scoreSweeperValue(species);
    const utility = scoreUtilityValue(species);
    const defense = scoreSinglesDefense(species, pool);
    const power = scoreIndividualPower(species);
    const adjust = scoreSinglesChampionsAdjust(species);

    const breakdown = {
      sweeperValue: sweeper.score,
      utilityValue: utility.score,
      defensiveValue: defense.score,
      individualPower: power.score,
      championsAdjust: adjust.score,
    };

    const rawTotal = Object.values(breakdown).reduce((a, b) => a + b, 0);
    // Singles has lower ceilings per Pokemon since there's less
    // role overlap — scale against 50 as the realistic max.
    const score = Math.max(0, Math.min(100, Math.round((rawTotal / 50) * 100)));

    let tier: SinglesProjection['tier'];
    if (score >= 80) tier = 'S';
    else if (score >= 66) tier = 'A+';
    else if (score >= 50) tier = 'A';
    else if (score >= 35) tier = 'B';
    else tier = 'C';

    const hasMega = hasChampionsMega(species);
    const megaStone = MEGA_STONE_MAP[species]?.[0];
    const roles = classifyRoles(species, breakdown, hasMega);

    const allReasons = [
      ...adjust.reasons.map(r => ({ r, weight: 4 })),
      ...sweeper.reasons.map(r => ({ r, weight: 3 })),
      ...utility.reasons.map(r => ({ r, weight: 3 })),
      ...defense.reasons.map(r => ({ r, weight: 2 })),
      ...power.reasons.map(r => ({ r, weight: 1 })),
    ];
    const reasoning = allReasons
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(x => x.r);

    rankings.push({
      species,
      score,
      tier,
      roles,
      breakdown,
      reasoning,
      championsFactors: adjust.factors,
      hasMega,
      megaStone,
    });
  }

  rankings.sort((a, b) => b.score - a.score);

  // Role leaders
  const roleLeaders: Record<SinglesRole, string[]> = {
    'Setup Sweeper': [], 'Hazard Setter': [], 'Hazard Removal': [],
    'Choice Scarf': [], 'Wallbreaker': [], 'Physical Wall': [],
    'Special Wall': [], 'Pivot': [], 'Phazer': [],
    'Status Spreader': [], 'Lead': [], 'Wincon': [], 'Utility': [],
  };
  for (const r of rankings) {
    for (const role of r.roles) {
      if (roleLeaders[role].length < 5) roleLeaders[role].push(r.species);
    }
  }

  const cores = detectSinglesCores(rankings);

  // Insights
  const insights: string[] = [];
  const drag = rankings.find(r => r.species === 'Dragonite');
  if (drag && drag.score >= 55) {
    insights.push(`Mega Dragonite with Dragonize + Extreme Speed is the format's answer to Choice Scarf revenge killers — priority Dragon STAB bypasses the speed tier entirely.`);
  }
  const excadrill = rankings.find(r => r.species === 'Excadrill');
  const tyranitar = rankings.find(r => r.species === 'Tyranitar');
  if (excadrill && tyranitar && excadrill.score >= 45 && tyranitar.score >= 45) {
    insights.push(`Tyranitar + Excadrill Sand core remains S-tier in Singles despite no new ability support — the speed tier + stat combination wasn't touched by any Champions rule change.`);
  }
  const gliscor = rankings.find(r => r.species === 'Gliscor');
  if (gliscor && gliscor.score >= 45) {
    insights.push(`Gliscor is positioned to be a top-tier Singles pivot: Poison Heal + Toxic + Defog handles both hazard stacking and wallbreakers.`);
  }
  insights.push(`The Fake Out nerf has zero impact on Singles — Incineroar drops tiers here but Tyranitar, Garchomp, and Dragonite remain untouched by any Champions rule change.`);
  insights.push(`Status condition nerfs (paralysis 1/8, sleep 2-3 turns) directly benefit setup sweepers — expect Dragon Dance and Quiver Dance teams to be stronger than in mainline Singles.`);
  insights.push(`Without Gholdengo, the "Good as Gold nuke" archetype is dead. Kingambit and Archaludon inherit the Steel win-condition slot via Supreme Overlord and Stamina + Electro Shot respectively.`);

  // Dark horses
  const darkHorses = rankings
    .filter(r => r.tier === 'A' || r.tier === 'A+')
    .filter(r => !['Garchomp', 'Dragonite', 'Tyranitar', 'Hippowdon', 'Dragapult', 'Greninja', 'Volcarona', 'Hydreigon', 'Mimikyu', 'Gengar'].includes(r.species))
    .slice(0, 6);

  return {
    timestamp: Date.now(),
    rankings,
    cores,
    insights,
    roleLeaders,
    darkHorses,
  };
}
