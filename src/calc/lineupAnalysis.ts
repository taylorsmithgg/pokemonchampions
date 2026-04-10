// Lineup Analysis Engine — Format-Aware (Singles + Doubles)
// =================================================================
//
// Pokemon Champions supports both Singles and Doubles ranked ladders.
// The formats have different pick counts AND fundamentally different
// metas — a Pokemon's value as a Doubles lead (Fake Out, Rage Powder,
// spread moves) is unrelated to its value in Singles (hazards, setup,
// bulky pivot moves).
//
//   - Singles: bring 6, pick 3, 1v1 on the field
//   - Doubles: bring 6, pick 4, 2v2 on the field (the VGC format)
//
// A team's practical strength is NOT the sum of all 6 members — it's
// the quality of the *best* pick-N subsets that team can field AND
// the size of the flexible subset pool (so you can adapt at team
// preview to what the opponent brings).
//
// This engine enumerates every C(6,N) subset for the selected format,
// scores each using format-appropriate weights, and exposes:
//
//   - The top K lineups (the best picks you can make)
//   - The weakest viable subset (stress test for team flexibility)
//   - Load-bearing members (Pokemon that appear in most top lineups)
//   - Team flexibility score (0-100)

import { Move } from '@smogon/calc';
import { getPokemonData, getTypeEffectiveness } from '../data/champions';
import type { PokemonState } from '../types';
import { scoreLeadPair, type LeadScore } from './openerAnalysis';

// ─── Format Constants ──────────────────────────────────────────────

export type FormatId = 'singles' | 'doubles';

export interface BattleFormat {
  id: FormatId;
  label: string;
  /** How many Pokemon fit in a team roster. */
  rosterSize: number;
  /** How many Pokemon a player brings into a single battle. */
  battleSize: number;
  /** How many Pokemon are active on the field at once. */
  activeSlots: number;
  /** Natural-language description shown in the UI. */
  description: string;
}

/** Singles Ranked — bring 6, pick 3, 1v1 on the field. */
export const SINGLES_FORMAT: BattleFormat = {
  id: 'singles',
  label: 'Singles',
  rosterSize: 6,
  battleSize: 3,
  activeSlots: 1,
  description: 'Bring 6, pick 3. One Pokemon on the field at a time — hazards, setup, and bulky pivots define the meta.',
};

/** Doubles Ranked — bring 6, pick 4, 2v2 on the field. This is VGC. */
export const DOUBLES_FORMAT: BattleFormat = {
  id: 'doubles',
  label: 'Doubles',
  rosterSize: 6,
  battleSize: 4,
  activeSlots: 2,
  description: 'Bring 6, pick 4. Two Pokemon active — Fake Out, redirection, spread moves, and speed control define the meta. This is the VGC 2026 format.',
};

export const ALL_FORMATS: readonly BattleFormat[] = [DOUBLES_FORMAT, SINGLES_FORMAT];

/** Default format for the app. VGC is the main competitive scene. */
export const DEFAULT_FORMAT = DOUBLES_FORMAT;

/** Legacy constant — prefer DEFAULT_FORMAT for new code. */
export const BATTLE_FORMAT = {
  ROSTER_SIZE: DEFAULT_FORMAT.rosterSize,
  BATTLE_SIZE: DEFAULT_FORMAT.battleSize,
  ACTIVE_SLOTS: DEFAULT_FORMAT.activeSlots,
} as const;

// ─── Types ─────────────────────────────────────────────────────────

export interface LineupScore {
  /** The 3 species in this sub-selection. */
  members: string[];
  /** Total score (higher = stronger). */
  total: number;
  /** Score breakdown by category. */
  breakdown: LineupBreakdown;
  /** Best lead pair among the 3 members. */
  bestLeadPair: LeadScore | null;
  /** Short commentary describing why this lineup works (or doesn't). */
  commentary: string[];
}

export interface LineupBreakdown {
  /** 0-25: Best lead pair strength (from openerAnalysis). */
  leadPair: number;
  /** 0-15: Presence of speed control (Tailwind/TR/Icy Wind). */
  speedControl: number;
  /** 0-15: Redirection + Fake Out + support density. */
  support: number;
  /** 0-15: Spread-move density + raw offense. */
  offense: number;
  /** 0-10: Protect / Wide Guard / defensive coverage. */
  defense: number;
  /** 0-10: Bench/reserve value — the 3rd mon as a pivot option. */
  bench: number;
  /** -10 to 0: Shared weakness penalty across the lineup. */
  weaknessOverlap: number;
}

export interface TeamFlexibilityReport {
  /** 0-100 flexibility score. */
  score: number;
  /** All viable subsets ordered by strength. */
  lineups: LineupScore[];
  /** Best lineup the team can field. */
  bestLineup: LineupScore | null;
  /** Weakest lineup (highlights a team's worst forced selection). */
  weakestLineup: LineupScore | null;
  /** Pokemon that appear in > half of the top-K lineups. */
  loadBearing: { species: string; appearances: number }[];
  /** Pokemon that appear in < quarter of the top-K lineups. */
  underused: { species: string; appearances: number }[];
  /** Diagnostic messages about the team's flexibility. */
  diagnostics: string[];
}

// ─── Move / Ability Categories ─────────────────────────────────────

// Shared across both formats
const SPEED_CONTROL_MOVES = new Set(['Tailwind', 'Trick Room', 'Icy Wind', 'Electroweb', 'Bleakwind Storm', 'Rock Tomb', 'Thunder Wave']);
const PROTECT_MOVES = new Set(['Protect', 'Detect', 'Spiky Shield', 'King\'s Shield', 'Baneful Bunker', 'Obstruct', 'Silk Trap', 'Burning Bulwark']);
const PIVOT_MOVES = new Set(['U-turn', 'Volt Switch', 'Parting Shot', 'Flip Turn', 'Teleport']);

// Doubles-focused move sets
const REDIRECTION_MOVES = new Set(['Rage Powder', 'Follow Me', 'Ally Switch']);
const DOUBLES_SUPPORT_MOVES = new Set(['Helping Hand', 'Wide Guard', 'Quick Guard', 'Heal Pulse', 'Life Dew', 'Pollen Puff', 'After You']);
const FAKE_OUT_MOVES = new Set(['Fake Out', 'First Impression']);

// Singles-focused move sets
const HAZARD_MOVES = new Set(['Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web']);
const HAZARD_CONTROL_MOVES = new Set(['Rapid Spin', 'Defog', 'Tidy Up', 'Court Change', 'Mortal Spin']);
const SETUP_MOVES = new Set(['Swords Dance', 'Dragon Dance', 'Nasty Plot', 'Calm Mind', 'Bulk Up', 'Quiver Dance', 'Shell Smash', 'Coil', 'Iron Defense', 'Curse', 'Agility', 'Rock Polish', 'Autotomize']);
const STATUS_MOVES = new Set(['Will-O-Wisp', 'Toxic', 'Thunder Wave', 'Sleep Powder', 'Spore', 'Stun Spore', 'Glare', 'Yawn', 'Nuzzle']);
const RECOVERY_MOVES = new Set(['Recover', 'Roost', 'Slack Off', 'Soft-Boiled', 'Synthesis', 'Moonlight', 'Morning Sun', 'Wish', 'Rest', 'Milk Drink', 'Strength Sap']);
const PHAZING_MOVES = new Set(['Roar', 'Whirlwind', 'Dragon Tail', 'Circle Throw']);

function hasMove(pokemon: PokemonState, set: Set<string>): boolean {
  return pokemon.moves.some(m => m && set.has(m));
}

function isIntimidate(pokemon: PokemonState): boolean {
  return pokemon.ability.toLowerCase() === 'intimidate';
}

function hasSpreadMove(pokemon: PokemonState): boolean {
  for (const moveName of pokemon.moves) {
    if (!moveName) continue;
    try {
      const move = new Move(9 as any, moveName);
      if (move.category === 'Status') continue;
      if (move.target === 'allAdjacentFoes' || move.target === 'allAdjacent') return true;
    } catch { /* skip */ }
  }
  return false;
}

function hasPriorityMove(pokemon: PokemonState): boolean {
  for (const moveName of pokemon.moves) {
    if (!moveName) continue;
    try {
      const move = new Move(9 as any, moveName);
      if (move.category !== 'Status' && move.priority > 0) return true;
    } catch { /* skip */ }
  }
  return false;
}

// ─── Subset Enumeration ────────────────────────────────────────────

/**
 * Returns every K-sized subset of an array. For K=3 and a 6-team
 * roster, this produces C(6,3) = 20 subsets.
 */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...tail] = arr;
  const withHead = combinations(tail, k - 1).map(c => [head, ...c]);
  const withoutHead = combinations(tail, k);
  return [...withHead, ...withoutHead];
}

// ─── Lineup Scoring — Format-Aware ─────────────────────────────────

const ALL_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

export function evaluateLineup(lineup: PokemonState[], format: BattleFormat = DEFAULT_FORMAT): LineupScore {
  return format.id === 'doubles'
    ? evaluateDoublesLineup(lineup)
    : evaluateSinglesLineup(lineup);
}

// ─── Doubles scoring ───────────────────────────────────────────────
// Doubles rewards lead synergy, Fake Out, redirection, Wide Guard,
// spread moves, Intimidate stacking, and Helping Hand. Bench value
// for Doubles (pick 4) is the 3rd/4th mon as a flex pivot.
function evaluateDoublesLineup(lineup: PokemonState[]): LineupScore {
  const members = lineup.map(p => p.species);
  const commentary: string[] = [];
  const bd: LineupBreakdown = {
    leadPair: 0, speedControl: 0, support: 0,
    offense: 0, defense: 0, bench: 0, weaknessOverlap: 0,
  };

  // Lead pair: the strongest pair among the lineup as opening
  let bestLeadPair: LeadScore | null = null;
  for (let i = 0; i < lineup.length; i++) {
    for (let j = i + 1; j < lineup.length; j++) {
      const pair = scoreLeadPair(lineup[i], lineup[j]);
      if (!bestLeadPair || pair.totalScore > bestLeadPair.totalScore) {
        bestLeadPair = pair;
      }
    }
  }
  if (bestLeadPair) {
    bd.leadPair = Math.min(25, Math.round(bestLeadPair.totalScore / 3));
  }

  // Speed control
  const speedControllers = lineup.filter(p => hasMove(p, SPEED_CONTROL_MOVES));
  const tailwinders = lineup.filter(p => p.moves.includes('Tailwind'));
  const tr = lineup.filter(p => p.moves.includes('Trick Room'));
  if (speedControllers.length >= 2) {
    bd.speedControl = 15;
    commentary.push(`Two speed-control options — ${speedControllers.map(p => p.species).join(', ')}`);
  } else if (speedControllers.length === 1) {
    bd.speedControl = 9;
    const sc = speedControllers[0];
    const type = sc.moves.find(m => SPEED_CONTROL_MOVES.has(m));
    commentary.push(`${sc.species} provides ${type}`);
  }
  if (tailwinders.length > 0 && tr.length > 0) {
    bd.speedControl -= 4;
    commentary.push('⚠ Tailwind and Trick Room both present — they interfere');
  }

  // Support density: Fake Out, redirection, Helping Hand, Intimidate
  const fakeOutUsers = lineup.filter(p => hasMove(p, FAKE_OUT_MOVES));
  const redirectors = lineup.filter(p => hasMove(p, REDIRECTION_MOVES));
  const helpers = lineup.filter(p => hasMove(p, DOUBLES_SUPPORT_MOVES));
  const intimidators = lineup.filter(isIntimidate);

  if (fakeOutUsers.length >= 1) {
    bd.support += 4;
    commentary.push(`${fakeOutUsers[0].species} has Fake Out`);
  }
  if (redirectors.length >= 1) {
    bd.support += 5;
    commentary.push(`${redirectors[0].species} provides redirection`);
  }
  if (helpers.length >= 1) {
    bd.support += 3;
  }
  if (intimidators.length >= 1) {
    bd.support += 3;
    if (intimidators.length >= 2) {
      bd.support += 2;
      commentary.push('Double Intimidate — strong physical pressure mitigation');
    }
  }
  bd.support = Math.min(15, bd.support);

  // Offense: spread moves, priority, raw offense
  const spreadUsers = lineup.filter(hasSpreadMove);
  const priorityUsers = lineup.filter(hasPriorityMove);
  const avgOffense = lineup.reduce((sum, p) => {
    const data = getPokemonData(p.species);
    if (!data) return sum;
    return sum + Math.max(data.baseStats.atk, data.baseStats.spa);
  }, 0) / lineup.length;

  bd.offense = Math.min(10, Math.round((avgOffense - 80) / 10));
  if (spreadUsers.length >= 2) {
    bd.offense += 4;
    commentary.push(`${spreadUsers.length} spread-move users — heavy board pressure`);
  } else if (spreadUsers.length === 1) {
    bd.offense += 2;
  }
  if (priorityUsers.length >= 1) {
    bd.offense += 2;
    commentary.push(`${priorityUsers[0].species} has priority for cleanup`);
  }
  bd.offense = Math.min(15, Math.max(0, bd.offense));

  // Defense: Protect coverage, Wide Guard (vital in Doubles vs spread moves)
  const protectors = lineup.filter(p => hasMove(p, PROTECT_MOVES));
  const wideGuarders = lineup.filter(p => p.moves.includes('Wide Guard'));
  bd.defense = Math.min(10, protectors.length * 2 + wideGuarders.length * 3);
  if (wideGuarders.length >= 1) {
    commentary.push(`${wideGuarders[0].species} Wide Guard protects against spread moves`);
  }
  if (protectors.length === 0) {
    bd.defense -= 2;
    commentary.push('⚠ No Protect — vulnerable to double-targeting');
  }

  // Bench value: Pokemon not in the best lead pair serve as flex pivots
  if (bestLeadPair) {
    const leadSpecies = new Set(bestLeadPair.pokemon);
    const bench = lineup.filter(p => !leadSpecies.has(p.species));
    for (const b of bench) {
      const bData = getPokemonData(b.species);
      if (!bData) continue;
      if (hasMove(b, PIVOT_MOVES)) bd.bench += 3;
      if (hasMove(b, DOUBLES_SUPPORT_MOVES)) bd.bench += 2;
      const bBulk = bData.baseStats.hp + (bData.baseStats.def + bData.baseStats.spd) / 2;
      if (bBulk > 180) bd.bench += 2;
      // Speed-tier divergence from leads
      const leadSpeeds = bestLeadPair.pokemon.map(name => getPokemonData(name)?.baseStats.spe || 0);
      const avgLeadSpe = leadSpeeds.reduce((a, b2) => a + b2, 0) / leadSpeeds.length;
      if (Math.abs(bData.baseStats.spe - avgLeadSpe) > 40) bd.bench += 1;
    }
    if (bench.length > 0 && bd.bench === 0) {
      commentary.push(`⚠ Bench ${bench.map(b => b.species).join(', ')} offers little flex value`);
    }
  }
  bd.bench = Math.min(10, bd.bench);

  // Shared-weakness penalty
  let sharedWk = 0;
  const sharedWkTypes: string[] = [];
  for (const atkType of ALL_TYPES) {
    let weakCount = 0;
    for (const p of lineup) {
      const d = getPokemonData(p.species);
      if (!d) continue;
      let mult = 1;
      for (const t of d.types) mult *= getTypeEffectiveness(atkType, t as string);
      if (mult > 1) weakCount++;
    }
    if (weakCount >= Math.ceil(lineup.length / 2)) {
      sharedWk++;
      sharedWkTypes.push(atkType);
    }
  }
  bd.weaknessOverlap = -Math.min(10, sharedWk * 2);
  if (sharedWk >= 2) {
    commentary.push(`⚠ Shared weaknesses: ${sharedWkTypes.slice(0, 3).join(', ')}`);
  }

  const total = Object.values(bd).reduce((s, v) => s + v, 0);
  return { members, total, breakdown: bd, bestLeadPair, commentary };
}

// ─── Singles scoring ───────────────────────────────────────────────
// Singles rewards individual Pokemon quality, hazards, setup
// opportunities, bulky pivots, status spreading, and recovery.
// Lead synergy matters less; what matters is each mon's ability to
// stand alone, switch safely, and win 1v1s.
function evaluateSinglesLineup(lineup: PokemonState[]): LineupScore {
  const members = lineup.map(p => p.species);
  const commentary: string[] = [];
  const bd: LineupBreakdown = {
    // In Singles, leadPair holds "individual threat quality" instead
    // of pair synergy. Reusing the field keeps the UI shared.
    leadPair: 0, speedControl: 0, support: 0,
    offense: 0, defense: 0, bench: 0, weaknessOverlap: 0,
  };

  // "Individual threat quality" — average of each mon's offensive potential + coverage
  const individualScores: number[] = lineup.map(p => {
    const d = getPokemonData(p.species);
    if (!d) return 0;
    const maxAtk = Math.max(d.baseStats.atk, d.baseStats.spa);
    const spe = d.baseStats.spe;
    const bulk = d.baseStats.hp + (d.baseStats.def + d.baseStats.spd) / 2;
    // Balanced score: offense + speed + bulk
    return Math.round((maxAtk * 0.5) + (spe * 0.3) + (bulk * 0.2));
  });
  const avgIndividual = individualScores.reduce((a, b) => a + b, 0) / individualScores.length;
  bd.leadPair = Math.min(25, Math.round((avgIndividual - 60) / 3));

  // Speed control — matters less in Singles but Trick Room and
  // Thunder Wave remain strong
  const speedControllers = lineup.filter(p => hasMove(p, SPEED_CONTROL_MOVES));
  const phazers = lineup.filter(p => hasMove(p, PHAZING_MOVES));
  if (speedControllers.length >= 1) bd.speedControl += 6;
  if (phazers.length >= 1) {
    bd.speedControl += 5;
    commentary.push(`${phazers[0].species} phazing counters setup sweepers`);
  }
  bd.speedControl = Math.min(15, bd.speedControl);

  // Support: hazards, hazard control, status, recovery, pivots
  const hazardSetters = lineup.filter(p => hasMove(p, HAZARD_MOVES));
  const hazardRemovers = lineup.filter(p => hasMove(p, HAZARD_CONTROL_MOVES));
  const statusSpreaders = lineup.filter(p => hasMove(p, STATUS_MOVES));
  const pivots = lineup.filter(p => hasMove(p, PIVOT_MOVES));
  const recoveryUsers = lineup.filter(p => hasMove(p, RECOVERY_MOVES));

  if (hazardSetters.length >= 1) {
    bd.support += 5;
    commentary.push(`${hazardSetters[0].species} provides hazards`);
  }
  if (hazardRemovers.length >= 1) {
    bd.support += 3;
    commentary.push(`${hazardRemovers[0].species} removes opposing hazards`);
  }
  if (statusSpreaders.length >= 1) {
    bd.support += 3;
  }
  if (pivots.length >= 2) {
    bd.support += 3;
    commentary.push('Multiple pivot moves — maintains momentum');
  } else if (pivots.length === 1) {
    bd.support += 2;
  }
  if (recoveryUsers.length >= 1) bd.support += 2;
  bd.support = Math.min(15, bd.support);

  // Offense: setup move availability, coverage diversity, STAB strength
  const setupSweepers = lineup.filter(p => hasMove(p, SETUP_MOVES));
  const priorityUsers = lineup.filter(hasPriorityMove);

  // Singles offense = maximum single-mon power, not team spread
  const bestOffense = Math.max(...lineup.map(p => {
    const d = getPokemonData(p.species);
    if (!d) return 0;
    return Math.max(d.baseStats.atk, d.baseStats.spa);
  }));
  bd.offense = Math.min(10, Math.round((bestOffense - 90) / 10));
  if (setupSweepers.length >= 1) {
    bd.offense += 3;
    commentary.push(`${setupSweepers[0].species} can set up a sweep`);
  }
  if (priorityUsers.length >= 1) {
    bd.offense += 2;
  }
  bd.offense = Math.min(15, Math.max(0, bd.offense));

  // Defense: bulk + recovery + status immunity
  const bulkyMembers = lineup.filter(p => {
    const d = getPokemonData(p.species);
    if (!d) return false;
    const bulk = d.baseStats.hp + (d.baseStats.def + d.baseStats.spd) / 2;
    return bulk > 180;
  });
  if (bulkyMembers.length >= 1) bd.defense += 4;
  if (bulkyMembers.length >= 2) bd.defense += 3;
  if (recoveryUsers.length >= 1) bd.defense += 3;
  bd.defense = Math.min(10, bd.defense);

  // Bench: In Singles pick-3, the 1-2 reserve Pokemon are safe
  // switch-ins. Reward different types/roles from the lead.
  const types = new Set<string>();
  for (const p of lineup) {
    const d = getPokemonData(p.species);
    if (d) for (const t of d.types) types.add(t as string);
  }
  bd.bench = Math.min(10, types.size * 2);

  // Shared-weakness penalty — stricter in Singles where you have
  // fewer active mons to switch between.
  let sharedWk = 0;
  const sharedWkTypes: string[] = [];
  for (const atkType of ALL_TYPES) {
    let weakCount = 0;
    for (const p of lineup) {
      const d = getPokemonData(p.species);
      if (!d) continue;
      let mult = 1;
      for (const t of d.types) mult *= getTypeEffectiveness(atkType, t as string);
      if (mult > 1) weakCount++;
    }
    if (weakCount >= Math.ceil(lineup.length / 2)) {
      sharedWk++;
      sharedWkTypes.push(atkType);
    }
  }
  bd.weaknessOverlap = -Math.min(10, sharedWk * 3);
  if (sharedWk >= 2) {
    commentary.push(`⚠ Shared weaknesses: ${sharedWkTypes.slice(0, 3).join(', ')}`);
  }

  const total = Object.values(bd).reduce((s, v) => s + v, 0);
  return { members, total, breakdown: bd, bestLeadPair: null, commentary };
}

// ─── Team-Wide Analysis ────────────────────────────────────────────

export function analyzeTeamLineups(
  team: PokemonState[],
  format: BattleFormat = DEFAULT_FORMAT,
): TeamFlexibilityReport {
  const filled = team.filter(p => p.species);
  if (filled.length < format.battleSize) {
    return {
      score: 0,
      lineups: [],
      bestLineup: null,
      weakestLineup: null,
      loadBearing: [],
      underused: [],
      diagnostics: [`Need at least ${format.battleSize} Pokemon to analyze ${format.label} lineups (team has ${filled.length}).`],
    };
  }

  // Enumerate every battleSize-sized subset (C(6, 3) = 20 for
  // Singles, C(6, 4) = 15 for Doubles).
  const subsets = combinations(filled, format.battleSize);
  const lineups = subsets
    .map(subset => evaluateLineup(subset, format))
    .sort((a, b) => b.total - a.total);

  const bestLineup = lineups[0] ?? null;
  const weakestLineup = lineups[lineups.length - 1] ?? null;

  // Load-bearing members: appear in > half of the top-K lineups
  const topK = Math.min(5, lineups.length);
  const topLineups = lineups.slice(0, topK);
  const appearances = new Map<string, number>();
  for (const l of topLineups) {
    for (const m of l.members) {
      appearances.set(m, (appearances.get(m) ?? 0) + 1);
    }
  }
  const loadBearing = Array.from(appearances.entries())
    .filter(([, count]) => count > topK / 2)
    .map(([species, count]) => ({ species, appearances: count }))
    .sort((a, b) => b.appearances - a.appearances);
  const underused = filled
    .map(p => p.species)
    .filter(species => (appearances.get(species) ?? 0) < topK / 4)
    .map(species => ({ species, appearances: appearances.get(species) ?? 0 }));

  // Flexibility score: blend of best-lineup strength + depth of
  // viable subsets + adaptability penalties. The scoring should
  // reward teams with many strong subsets AND punish teams where a
  // single anchor appears in every top lineup (load-bearing) or
  // where some members never contribute (dead slots).
  const viableThreshold = 25;
  const strongThreshold = 40;
  const viableCount = lineups.filter(l => l.total >= viableThreshold).length;
  const strongCount = lineups.filter(l => l.total >= strongThreshold).length;
  const bestScore = bestLineup?.total ?? 0;
  const avgTopThree = topLineups.slice(0, 3).reduce((s, l) => s + l.total, 0) / Math.max(1, Math.min(3, topLineups.length));

  // Positive contributions
  const ceilingPts = Math.min(30, bestScore * 0.6);                    // up to 30
  const consistencyPts = Math.min(25, avgTopThree * 0.5);              // up to 25
  const depthPts = Math.min(25, (viableCount / subsets.length) * 40);  // up to 25
  const strengthPts = Math.min(20, strongCount * 3);                   // up to 20 from strong subsets

  // Penalties
  // Load-bearing anchor: one member in every top lineup = -15
  const topKCount = Math.max(1, Math.min(5, lineups.length));
  const maxAppearances = loadBearing[0]?.appearances ?? 0;
  const anchorPenalty = maxAppearances >= topKCount ? 15
    : maxAppearances >= topKCount * 0.8 ? 8
    : 0;
  // Dead slots: members that never make the top-5
  const deadSlotPenalty = underused.length * 5;
  // Large best-vs-worst gap means picking wrong is catastrophic
  const worstScore = weakestLineup?.total ?? 0;
  const gapPenalty = (bestScore - worstScore > 40) ? 5 : 0;

  const flexibilityRaw = ceilingPts + consistencyPts + depthPts + strengthPts - anchorPenalty - deadSlotPenalty - gapPenalty;
  const score = Math.round(Math.max(0, Math.min(100, flexibilityRaw)));

  const diagnostics: string[] = [];
  const pickLabel = `pick-${format.battleSize}`;
  if (score >= 75) {
    diagnostics.push(`Team has strong lineup flexibility in ${format.label} — many viable ${pickLabel} combinations.`);
  } else if (score >= 55) {
    diagnostics.push(`Team has moderate flexibility in ${format.label} — a few clear best picks.`);
  } else {
    diagnostics.push(`Team has limited flexibility in ${format.label} — most of the roster is dead weight for typical matchups.`);
  }
  if (viableCount === 1) {
    diagnostics.push(`⚠ Only one viable ${pickLabel} lineup — opponents that beat this lineup beat the team.`);
  }
  if (loadBearing.length >= 1 && loadBearing[0].appearances === topK) {
    diagnostics.push(`${loadBearing[0].species} is load-bearing — appears in every top lineup. Its weaknesses are the team's weaknesses.`);
  }
  if (underused.length > 0) {
    diagnostics.push(`${underused.map(u => u.species).join(', ')} rarely make the best picks. Consider replacing them.`);
  }
  if (weakestLineup && bestLineup && bestLineup.total - weakestLineup.total > 40) {
    diagnostics.push(`Large gap between best and worst ${pickLabel} subsets — picking right at team preview is critical.`);
  }

  return { score, lineups, bestLineup, weakestLineup, loadBearing, underused, diagnostics };
}
