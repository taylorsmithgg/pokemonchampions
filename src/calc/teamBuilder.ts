// Incremental Team Builder
// Builds a competitive team one slot at a time, each pick optimizing
// for what the team is missing: coverage, roles, speed tiers, synergy,
// AND — critically for a bring-6-pick-3 Doubles format — how many
// additional viable 3-mon subsets the candidate would unlock.

import { Move } from '@smogon/calc';
import { getAvailablePokemon, getPokemonData, getTypeEffectiveness} from '../data/champions';
import { PRESETS } from '../data/presets';
import { NORMAL_TIER_LIST } from '../data/tierlist';
import type { PokemonState } from '../types';
import { createDefaultPokemonState } from '../types';
import { analyzeTeamLineups, DEFAULT_FORMAT, type BattleFormat } from './lineupAnalysis';



const ALL_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

interface CandidateScore {
  species: string;
  score: number;
  reasons: string[];
}

// Score how well a candidate fills gaps in the current team
function scoreCandidateForTeam(
  candidateName: string,
  currentTeam: PokemonState[],
  format: BattleFormat = DEFAULT_FORMAT,
): CandidateScore {
  const data = getPokemonData(candidateName);
  if (!data) return { species: candidateName, score: 0, reasons: [] };

  const bs = data.baseStats;
  const types = [...data.types] as string[];
  const ability = (data.abilities?.[0] || '') as string;
  const reasons: string[] = [];
  let score = 0;

  const teamMembers = currentTeam.filter(p => p.species);
  const teamSpecies = new Set(teamMembers.map(p => p.species));

  // Skip if already on team
  if (teamSpecies.has(candidateName)) return { species: candidateName, score: -999, reasons: [] };

  // ─── 1. Tier bonus ────────────────────────────────────────────
  const tierEntry = NORMAL_TIER_LIST.find(e => e.name === candidateName);
  if (tierEntry) {
    const tierScore: Record<string, number> = { S: 15, 'A+': 12, A: 9, B: 5, C: 2 };
    score += tierScore[tierEntry.tier] || 0;
    if (tierEntry.tier === 'S' || tierEntry.tier === 'A+') {
      reasons.push(`${tierEntry.tier} tier — meta staple`);
    }
  }

  // ─── 2. Type coverage gaps ────────────────────────────────────
  // What types can the current team NOT hit super-effectively?
  const teamHitsSE = new Set<string>();
  for (const member of teamMembers) {
    const mData = getPokemonData(member.species);
    if (!mData) continue;
    for (const mType of mData.types) {
      for (const defType of ALL_TYPES) {
        if (getTypeEffectiveness(mType as string, defType) > 1) teamHitsSE.add(defType);
      }
    }
    // Also check moves
    for (const moveName of member.moves) {
      if (!moveName) continue;
      try {
        
        const move = new Move(9, moveName);
        if (move.category !== 'Status') {
          for (const defType of ALL_TYPES) {
            if (getTypeEffectiveness(move.type, defType) > 1) teamHitsSE.add(defType);
          }
        }
      } catch { /* skip */ }
    }
  }

  // Does this candidate cover uncovered types?
  let coverageFills = 0;
  for (const myType of types) {
    for (const defType of ALL_TYPES) {
      if (!teamHitsSE.has(defType) && getTypeEffectiveness(myType, defType) > 1) {
        coverageFills++;
      }
    }
  }
  if (coverageFills > 0) {
    score += coverageFills * 3;
    reasons.push(`Covers ${coverageFills} uncovered type matchups`);
  }

  // ─── 3. Role gaps ─────────────────────────────────────────────
  const teamHasFakeOut = teamMembers.some(m => m.moves.some(mv => mv?.toLowerCase() === 'fake out'));
  const teamHasIntim = teamMembers.some(m => m.ability.toLowerCase() === 'intimidate');
  const teamHasRedirect = teamMembers.some(m => m.moves.some(mv => ['rage powder', 'follow me'].includes(mv?.toLowerCase() || '')));
  // Priority detection uses Move import directly

  const preset = PRESETS.find(p => p.species === candidateName);
  const candidateMoves = preset?.moves || [];

  if (!teamHasFakeOut && candidateMoves.some(m => m.toLowerCase() === 'fake out')) {
    score += 8;
    reasons.push('Adds Fake Out (missing from team)');
  }
  if (!teamHasIntim && ability.toLowerCase() === 'intimidate') {
    score += 8;
    reasons.push('Adds Intimidate (missing from team)');
  }
  if (!teamHasRedirect && candidateMoves.some(m => ['rage powder', 'follow me'].includes(m.toLowerCase()))) {
    score += 6;
    reasons.push('Adds redirection support');
  }

  // ─── 4. Speed tier diversity ──────────────────────────────────
  const teamSpeeds = teamMembers.map(m => getPokemonData(m.species)?.baseStats.spe || 0);
  const avgTeamSpeed = teamSpeeds.length > 0 ? teamSpeeds.reduce((a, b) => a + b, 0) / teamSpeeds.length : 0;

  if (teamSpeeds.length > 0) {
    // Bonus for being in a different speed tier than the team average
    const speedDiff = Math.abs(bs.spe - avgTeamSpeed);
    if (speedDiff > 40) {
      score += 4;
      reasons.push(`Diversifies speed (${bs.spe} vs team avg ${Math.round(avgTeamSpeed)})`);
    }
  }

  // ─── 5. Physical/Special balance ──────────────────────────────
  const teamPhys = teamMembers.filter(m => {
    const d = getPokemonData(m.species);
    return d && d.baseStats.atk > d.baseStats.spa;
  }).length;
  const teamSpec = teamMembers.filter(m => {
    const d = getPokemonData(m.species);
    return d && d.baseStats.spa > d.baseStats.atk;
  }).length;

  const isPhys = bs.atk > bs.spa;
  if (isPhys && teamSpec > teamPhys) {
    // Team needs physical — no bonus needed
  } else if (!isPhys && teamPhys > teamSpec) {
    // Team needs special — no bonus needed
  } else if (isPhys && teamPhys >= teamSpec + 2) {
    score -= 3; // Too many physical
  } else if (!isPhys && teamSpec >= teamPhys + 2) {
    score -= 3; // Too many special
  }
  if ((isPhys && teamPhys < teamSpec) || (!isPhys && teamSpec < teamPhys)) {
    score += 3;
    reasons.push(`Balances ${isPhys ? 'physical' : 'special'} offense`);
  }

  // ─── 6. Shared weakness penalty ───────────────────────────────
  for (const atkType of ALL_TYPES) {
    let myMult = 1;
    for (const t of types) myMult *= getTypeEffectiveness(atkType, t);
    if (myMult > 1) {
      // I'm weak to this type — how many teammates are also weak?
      let sharedCount = 0;
      for (const member of teamMembers) {
        const mData = getPokemonData(member.species);
        if (!mData) continue;
        let memberMult = 1;
        for (const mt of mData.types) memberMult *= getTypeEffectiveness(atkType, mt as string);
        if (memberMult > 1) sharedCount++;
      }
      if (sharedCount >= 2) {
        score -= 5;
        reasons.push(`Adds another ${atkType} weakness (${sharedCount} already weak)`);
      }
    }
  }

  // ─── 7. Has a preset (we can optimize it) ─────────────────────
  if (preset) {
    score += 2;
  }

  // ─── 8. Lineup flexibility — bring-N-pick-M impact ────────────
  // Score how much this candidate improves the team's pool of
  // viable pick-M sub-selections for the selected format. For
  // Doubles (pick 4) this means 4-mon subsets, for Singles it
  // means 3-mon subsets.
  if (teamMembers.length >= format.battleSize - 1) {
    const trialMember: PokemonState = preset ? {
      ...createDefaultPokemonState(),
      species: preset.species,
      nature: preset.nature,
      ability: preset.ability,
      item: preset.item,
      sps: { ...preset.sps },
      moves: [...preset.moves, '', '', '', ''].slice(0, 4),
    } : {
      ...createDefaultPokemonState(),
      species: candidateName,
      ability,
    };

    const currentReport = analyzeTeamLineups(teamMembers, format);
    const trialReport = analyzeTeamLineups([...teamMembers, trialMember], format);
    const flexDelta = trialReport.score - currentReport.score;
    if (flexDelta > 0) {
      score += Math.min(12, Math.round(flexDelta * 0.6));
      if (flexDelta >= 10) {
        reasons.push(`Unlocks ${flexDelta}-point jump in ${format.label} lineup flexibility`);
      }
    }

    const trialTopCount = trialReport.lineups.filter(l => l.total >= 50).length;
    const currentTopCount = currentReport.lineups.filter(l => l.total >= 50).length;
    if (trialTopCount > currentTopCount) {
      score += (trialTopCount - currentTopCount) * 3;
      reasons.push(`Creates ${trialTopCount - currentTopCount} new strong ${format.label} lineups`);
    }
  }

  return { species: candidateName, score, reasons };
}

// Build a full team incrementally
export function buildOptimalTeam(
  startingTeam: PokemonState[] = [],
  slots: number = 6,
  format: BattleFormat = DEFAULT_FORMAT,
): PokemonState[] {
  const team = [...startingTeam];

  // Pad to 6 slots
  while (team.length < slots) {
    team.push(createDefaultPokemonState());
  }

  // For each empty slot, pick the best candidate
  const allPokemon = getAvailablePokemon();

  // Focus on Pokemon that have presets or are in the tier list (competitive viable)
  const viablePokemon = allPokemon.filter(name =>
    PRESETS.some(p => p.species === name) || NORMAL_TIER_LIST.some(e => e.name === name)
  );

  for (let i = 0; i < slots; i++) {
    if (team[i].species) continue; // Skip filled slots

    const scores = viablePokemon.map(name => scoreCandidateForTeam(name, team, format));
    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];
    if (!best || best.score <= 0) continue;

    // Build an optimized state for this Pokemon
    const preset = PRESETS.find(p => p.species === best.species);
    if (preset) {
      team[i] = {
        ...createDefaultPokemonState(),
        species: preset.species,
        nature: preset.nature,
        ability: preset.ability,
        item: preset.item,
        sps: { ...preset.sps },
        moves: [...preset.moves, '', '', '', ''].slice(0, 4),
      };
    } else {
      const data = getPokemonData(best.species);
      team[i] = {
        ...createDefaultPokemonState(),
        species: best.species,
        ability: (data?.abilities?.[0] || '') as string,
      };
    }
  }

  return team;
}

// Get next best pick for the team
export function suggestNextPick(
  currentTeam: PokemonState[],
  count: number = 5,
  format: BattleFormat = DEFAULT_FORMAT,
): CandidateScore[] {
  const allPokemon = getAvailablePokemon();
  const viable = allPokemon.filter(name =>
    PRESETS.some(p => p.species === name) || NORMAL_TIER_LIST.some(e => e.name === name)
  );

  const scores = viable.map(name => scoreCandidateForTeam(name, currentTeam, format));
  scores.sort((a, b) => b.score - a.score);
  return scores.filter(s => s.score > 0).slice(0, count);
}
