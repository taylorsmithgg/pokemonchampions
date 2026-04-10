// Matchup Analysis & Lead Ordering Engine
// Given your team and an opponent Pokemon (or team), determines:
// 1. Type matchup scores for each member
// 2. Which of your Pokemon best handle each threat
// 3. Optimal pick-N selection (bring list) for the chosen format
// 4. Best lead pair (Doubles) or lead Pokemon (Singles) based on matchup

import { Move } from '@smogon/calc';
import { getPokemonData, getDefensiveMultiplier } from '../data/champions';
import { DEFAULT_FORMAT, type BattleFormat } from './lineupAnalysis';
import type { PokemonState } from '../types';




// ─── Types ──────────────────────────────────────────────────────────

export interface MatchupScore {
  species: string;
  offensiveScore: number;   // how well this Pokemon hits the target (0-10)
  defensiveScore: number;   // how well this Pokemon takes hits from the target (0-10)
  overallScore: number;     // combined (0-10)
  offenseDetail: string;    // e.g. "Ground hits Fire/Steel for 4x"
  defenseDetail: string;    // e.g. "Resists Fire (0.5x), weak to Ground (2x)"
  threatenedBy: string[];   // types the opponent hits us SE with
  threatens: string[];      // types we hit opponent SE with
}

export interface MatchupAnalysis {
  target: string;
  targetTypes: string[];
  scores: MatchupScore[];     // score for each team member vs this target
  bestCounter: string;        // your best answer
  dangerLevel: 'safe' | 'manageable' | 'dangerous' | 'critical';
  summary: string;
}

export interface BringListRecommendation {
  /** The format-appropriate pick count — 3 for Singles, 4 for Doubles. */
  bring: string[];
  /** Members left in the roster but not brought into this match. */
  bench: string[];
  /** Active-slot leads: 1 Pokemon in Singles, 2 in Doubles. */
  leads: string[];
  /** Reserve picks after the active leads — the rest of the bring list. */
  back: string[];
  reasoning: string[];
}

// ─── Matchup Scoring ────────────────────────────────────────────────

function scoreMatchup(myPokemon: PokemonState, targetSpecies: string): MatchupScore {
  const myData = getPokemonData(myPokemon.species);
  const targetData = getPokemonData(targetSpecies);
  if (!myData || !targetData) {
    return { species: myPokemon.species, offensiveScore: 5, defensiveScore: 5, overallScore: 5, offenseDetail: '', defenseDetail: '', threatenedBy: [], threatens: [] };
  }

  const myTypes = [...myData.types] as string[];
  const targetTypes = [...targetData.types] as string[];

  // Offensive: how well do my types/moves hit the target?
  let bestOffMult = 1;
  const threatens: string[] = [];

  // Check STAB types
  for (const myType of myTypes) {
    const mult = getDefensiveMultiplier(myType, targetTypes);
    if (mult > bestOffMult) bestOffMult = mult;
    if (mult > 1) threatens.push(myType);
  }

  // Check actual move coverage
  for (const moveName of myPokemon.moves) {
    if (!moveName) continue;
    try {
      const move = new Move(9 as any, moveName);
      if (move.category === 'Status') continue;
      const mult = getDefensiveMultiplier(move.type, targetTypes);
      if (mult > bestOffMult) bestOffMult = mult;
      if (mult > 1 && !threatens.includes(move.type)) threatens.push(move.type);
    } catch { /* skip */ }
  }

  // Defensive: how well do I take hits from the target's types?
  let worstDefMult = 1;
  const threatenedBy: string[] = [];

  for (const targetType of targetTypes) {
    const mult = getDefensiveMultiplier(targetType, myTypes);
    if (mult > worstDefMult) worstDefMult = mult;
    if (mult > 1) threatenedBy.push(targetType);
  }

  // Score: 0-10 scale
  // Offensive: 4x=10, 2x=8, 1x=5, 0.5x=3, 0x=0
  const offensiveScore = bestOffMult >= 4 ? 10 : bestOffMult >= 2 ? 8 : bestOffMult >= 1 ? 5 : bestOffMult > 0 ? 3 : 1;

  // Defensive: immunity=10, 0.25x=9, 0.5x=7, 1x=5, 2x=3, 4x=1
  const defensiveScore = worstDefMult === 0 ? 10 : worstDefMult <= 0.25 ? 9 : worstDefMult <= 0.5 ? 7 : worstDefMult <= 1 ? 5 : worstDefMult <= 2 ? 3 : 1;

  const overallScore = Math.round((offensiveScore * 0.6 + defensiveScore * 0.4));

  const offenseDetail = threatens.length > 0
    ? `${threatens.join('/')} hits ${targetTypes.join('/')} for ${bestOffMult}x`
    : `Neutral or resisted against ${targetTypes.join('/')}`;

  const defenseDetail = threatenedBy.length > 0
    ? `Weak to ${threatenedBy.join('/')} (${worstDefMult}x)`
    : `Resists or neutral to ${targetTypes.join('/')}`;

  return {
    species: myPokemon.species,
    offensiveScore,
    defensiveScore,
    overallScore,
    offenseDetail,
    defenseDetail,
    threatenedBy,
    threatens,
  };
}

// ─── Full Matchup Analysis ──────────────────────────────────────────

export function analyzeMatchup(team: PokemonState[], targetSpecies: string): MatchupAnalysis {
  const targetData = getPokemonData(targetSpecies);
  const targetTypes = targetData ? [...targetData.types] as string[] : [];
  const members = team.filter(p => p.species);

  const scores = members.map(m => scoreMatchup(m, targetSpecies));
  scores.sort((a, b) => b.overallScore - a.overallScore);

  const bestCounter = scores[0]?.species || '';
  const bestScore = scores[0]?.overallScore || 0;
  const canHitSE = scores.some(s => s.offensiveScore >= 8);
  const anyResist = scores.some(s => s.defensiveScore >= 7);

  let dangerLevel: MatchupAnalysis['dangerLevel'];
  if (canHitSE && anyResist) dangerLevel = 'safe';
  else if (canHitSE || anyResist) dangerLevel = 'manageable';
  else if (bestScore >= 5) dangerLevel = 'dangerous';
  else dangerLevel = 'critical';

  let summary = '';
  if (dangerLevel === 'safe') summary = `${bestCounter} handles ${targetSpecies} well — can hit SE and resist its STAB`;
  else if (dangerLevel === 'manageable') summary = `${bestCounter} can deal with ${targetSpecies} but be careful of ${scores[0]?.threatenedBy.join('/') || 'coverage'}`;
  else if (dangerLevel === 'dangerous') summary = `${targetSpecies} is hard to deal with — no strong answers on your team`;
  else summary = `${targetSpecies} is a major threat — consider adjusting your team`;

  return {
    target: targetSpecies,
    targetTypes,
    scores,
    bestCounter,
    dangerLevel,
    summary,
  };
}

// ─── Analyze vs Multiple Opponents ──────────────────────────────────

export function analyzeVsTeam(
  myTeam: PokemonState[],
  opponentTeam: PokemonState[],
  format: BattleFormat = DEFAULT_FORMAT,
): {
  matchups: MatchupAnalysis[];
  bringList: BringListRecommendation;
} {
  const opponents = opponentTeam.filter(p => p.species);
  const members = myTeam.filter(p => p.species);

  const matchups = opponents.map(opp => analyzeMatchup(myTeam, opp.species));

  // Calculate bring list for the chosen format
  const bringList = calculateBringList(members, matchups, format);

  return { matchups, bringList };
}

// ─── Bring List Calculator ──────────────────────────────────────────

function calculateBringList(
  team: PokemonState[],
  matchups: MatchupAnalysis[],
  format: BattleFormat,
): BringListRecommendation {
  const pickCount = format.battleSize;
  const activeSlots = format.activeSlots;

  if (team.length <= pickCount) {
    const bring = team.map(p => p.species);
    return {
      bring,
      bench: [],
      leads: bring.slice(0, activeSlots),
      back: bring.slice(activeSlots),
      reasoning: [`Team has ${team.length} Pokemon — bring all (${format.label} ${pickCount}-pick)`],
    };
  }

  // Score each team member based on how useful they are across all matchups
  const memberScores = new Map<string, { total: number; counters: number; dangers: number }>();

  for (const m of team) {
    let total = 0;
    let counters = 0;
    let dangers = 0;

    for (const mu of matchups) {
      const score = mu.scores.find(s => s.species === m.species);
      if (!score) continue;
      total += score.overallScore;
      if (score.offensiveScore >= 8) counters++;
      if (score.defensiveScore <= 3) dangers++;
    }

    memberScores.set(m.species, { total, counters, dangers });
  }

  // Sort by total score, preferring Pokemon that counter more threats
  const ranked = [...team]
    .filter(p => p.species)
    .sort((a, b) => {
      const sa = memberScores.get(a.species)!;
      const sb = memberScores.get(b.species)!;
      if (sb.total !== sa.total) return sb.total - sa.total;
      if (sb.counters !== sa.counters) return sb.counters - sa.counters;
      return sa.dangers - sb.dangers;
    });

  const bring = ranked.slice(0, pickCount).map(p => p.species);
  const bench = ranked.slice(pickCount).map(p => p.species);

  const hasData = (name: string) => {
    const p = team.find(t => t.species === name);
    return p ? getPokemonData(p.species) : null;
  };

  // Lead selection is format-sensitive:
  //   - Singles: 1 lead on the field — pick the single best matchup
  //   - Doubles: 2 leads — prioritize Fake Out + Tailwind pairing
  const bringPokemon = ranked.slice(0, pickCount);
  const reasoning: string[] = [];
  let leads: string[];
  let back: string[];

  if (format.id === 'singles') {
    // Best individual matchup leads; pivots and setup sweepers are
    // valuable on the back row as answers to what the opponent sends.
    const lead1 = bringPokemon[0]?.species || bring[0];
    leads = [lead1];
    back = bring.filter(s => s !== lead1);
    reasoning.push(`Lead ${lead1} — best individual matchup across threats`);
    const setupUser = bringPokemon.find(p =>
      p.moves.some(m => ['swords dance', 'dragon dance', 'nasty plot', 'calm mind', 'quiver dance'].includes(m?.toLowerCase() || ''))
    );
    if (setupUser && setupUser.species !== lead1) {
      reasoning.push(`${setupUser.species} in reserve — bring in after forcing a switch to set up`);
    }
  } else {
    // Doubles: prioritize Fake Out + Tailwind pairing
    const sortedBySpeed = [...bringPokemon].sort((a, b) => {
      const da = hasData(a.species);
      const db = hasData(b.species);
      return (db?.baseStats.spe || 0) - (da?.baseStats.spe || 0);
    });
    const fakeOutUser = bringPokemon.find(p =>
      p.moves.some(m => m?.toLowerCase() === 'fake out')
    );
    const tailwindUser = bringPokemon.find(p =>
      p.moves.some(m => m?.toLowerCase() === 'tailwind')
    );
    const trUser = bringPokemon.find(p =>
      p.moves.some(m => m?.toLowerCase() === 'trick room')
    );

    let lead1 = sortedBySpeed[0]?.species || bring[0];
    let lead2 = sortedBySpeed[1]?.species || bring[1];

    if (fakeOutUser) {
      lead1 = fakeOutUser.species;
      reasoning.push(`Lead ${fakeOutUser.species} for Fake Out pressure`);
    }
    if (tailwindUser && tailwindUser.species !== lead1) {
      lead2 = tailwindUser.species;
      reasoning.push(`Lead ${tailwindUser.species} for Tailwind speed control`);
    } else if (trUser && trUser.species !== lead1) {
      lead2 = trUser.species;
      reasoning.push(`Lead ${trUser.species} for Trick Room setup`);
    }

    leads = [lead1, lead2];
    back = bring.filter(s => s !== lead1 && s !== lead2);
  }

  const criticalMatchups = matchups.filter(m => m.dangerLevel === 'critical' || m.dangerLevel === 'dangerous');
  if (criticalMatchups.length > 0) {
    reasoning.push(`Watch out for: ${criticalMatchups.map(m => m.target).join(', ')}`);
  }

  for (const b of bench) {
    const bScores = memberScores.get(b);
    if (bScores && bScores.counters > 0) {
      reasoning.push(`${b} is benched but counters ${bScores.counters} threats — consider bringing if those show up`);
    }
  }

  return { bring, bench, leads, back, reasoning };
}

// ─── Quick Matchup Chart ────────────────────────────────────────────
// For displaying a type coverage heatmap

export interface TypeMatchupCell {
  mySpecies: string;
  theirSpecies: string;
  offensiveScore: number;
  defensiveScore: number;
  label: string;  // e.g. "SE", "Resist", "Immune", "Weak"
  color: string;  // CSS color
}

export function buildMatchupGrid(myTeam: PokemonState[], theirTeam: PokemonState[]): TypeMatchupCell[][] {
  const mine = myTeam.filter(p => p.species);
  const theirs = theirTeam.filter(p => p.species);

  return mine.map(my => {
    return theirs.map(their => {
      const score = scoreMatchup(my, their.species);
      let label = 'Neutral';
      let color = '#334155';

      if (score.offensiveScore >= 8) { label = 'SE'; color = '#22c55e'; }
      else if (score.offensiveScore <= 3) { label = 'Resist'; color = '#ef4444'; }

      if (score.defensiveScore <= 3) {
        label = score.offensiveScore >= 8 ? 'Trade' : 'Weak';
        color = score.offensiveScore >= 8 ? '#eab308' : '#ef4444';
      }
      if (score.defensiveScore >= 9) {
        label = 'Wall';
        color = '#3b82f6';
      }

      return {
        mySpecies: my.species,
        theirSpecies: their.species,
        offensiveScore: score.offensiveScore,
        defensiveScore: score.defensiveScore,
        label,
        color,
      };
    });
  });
}
