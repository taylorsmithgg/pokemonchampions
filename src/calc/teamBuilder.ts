// Incremental Team Builder
// Builds a competitive team one slot at a time, each pick optimizing
// for what the team is missing: coverage, roles, speed tiers, synergy,
// AND — critically for a bring-6-pick-3 Doubles format — how many
// additional viable 3-mon subsets the candidate would unlock.

import { Move } from '@smogon/calc';
import { getAvailablePokemon, getPokemonData, getTypeEffectiveness} from '../data/champions';
import { PRESETS } from '../data/presets';
import { NORMAL_TIER_LIST } from '../data/tierlist';
import { getRecommendations } from '../data/synergies';
import type { PokemonState } from '../types';
import { createDefaultPokemonState } from '../types';
import { analyzeTeamLineups, DEFAULT_FORMAT, type BattleFormat } from './lineupAnalysis';
import { generateDoublesProjection, type DoublesRole } from './doublesMetaProjection';
import { generateSinglesProjection, type SinglesRole } from './singlesMetaProjection';



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

  // ─── 8. Synergy combo detection ──────────────────────────────
  // Cross-reference the synergy engine's combo tech to surface
  // specific interactions: "Shed Tail → free Nasty Plot for Froslass",
  // "EQ heals Orthworm via Earth Eater", etc. These are the
  // insights that content creators find manually — we should
  // discover them programmatically and show them as primary reasons.
  for (const member of teamMembers) {
    if (!member.species) continue;
    const recs = getRecommendations(member.species, undefined, format.id);
    const match = recs.find(r => r.species === candidateName);
    if (match) {
      // Find the highest-strength combo reason (strength ≥ 3)
      const combos = match.reasons.filter(r => r.strength >= 3);
      for (const combo of combos) {
        score += combo.strength * 3;
        reasons.unshift(`${combo.label}: ${combo.description}`);
      }
      // Even weaker synergies contribute
      const minor = match.reasons.filter(r => r.strength < 3 && r.strength >= 2);
      if (minor.length > 0 && combos.length === 0) {
        score += minor[0].strength * 2;
        reasons.push(`${minor[0].label} with ${member.species}`);
      }
      break; // only count the strongest teammate synergy
    }
  }

  // ─── 9. Lineup flexibility — bring-N-pick-M impact ────────────
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

// ─── Role-aware replacement suggestions ────────────────────────────
//
// When a user asks for replacements for a specific slot (e.g., their
// Tailwind setter in a Tailwind comp, or their Hazard Lead in a
// Hyper Offense team), we want suggestions that fill the SAME role,
// not just generic "best next pick" candidates.
//
// Roles are detected from two sources and unioned:
//   1. The projection engine's role classification (authoritative)
//   2. Move/ability heuristics on the current slot (catches sets
//      the projection doesn't profile, like a custom Stealth Rock
//      Aerodactyl)

type AnyRole = DoublesRole | SinglesRole | 'Fake Out User' | 'Intimidate' | 'Setup Sweeper' | 'Hazard Setter' | 'Tailwind Setter' | 'Trick Room Setter' | 'Redirector';

const MOVE_ROLE_MAP: Array<{ moves: string[]; role: AnyRole }> = [
  { moves: ['Fake Out'], role: 'Fake Out User' },
  { moves: ['Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web'], role: 'Hazard Setter' },
  { moves: ['Tailwind'], role: 'Tailwind Setter' },
  { moves: ['Trick Room'], role: 'Trick Room Setter' },
  { moves: ['Rage Powder', 'Follow Me', 'Ally Switch'], role: 'Redirector' },
  { moves: ['Swords Dance', 'Dragon Dance', 'Nasty Plot', 'Calm Mind', 'Quiver Dance', 'Shell Smash', 'Bulk Up', 'Coil'], role: 'Setup Sweeper' },
];

function detectSlotRoles(pokemon: PokemonState, format: BattleFormat): Set<AnyRole> {
  const roles = new Set<AnyRole>();

  // 1. Projection engine roles
  if (pokemon.species) {
    const projection = format.id === 'doubles'
      ? generateDoublesProjection().rankings
      : generateSinglesProjection().rankings;
    const entry = projection.find(r => r.species === pokemon.species);
    if (entry) {
      for (const role of entry.roles) roles.add(role as AnyRole);
    }
  }

  // 2. Move-based detection
  const moveSet = new Set(pokemon.moves.filter(Boolean));
  for (const { moves, role } of MOVE_ROLE_MAP) {
    if (moves.some(m => moveSet.has(m))) roles.add(role);
  }

  // 3. Ability-based detection
  if (pokemon.ability.toLowerCase() === 'intimidate') roles.add('Intimidate');

  return roles;
}

/**
 * Return candidate species for replacing a specific team slot,
 * prioritizing candidates whose detected roles overlap with the
 * current slot's roles. This makes replacement suggestions feel
 * like "find me another Tailwind setter" instead of "find me any
 * high-tier mon".
 */
export function suggestReplacementsForSlot(
  team: PokemonState[],
  slotIndex: number,
  count: number = 5,
  format: BattleFormat = DEFAULT_FORMAT,
): Array<CandidateScore & { matchedRoles: string[] }> {
  const currentSlot = team[slotIndex];
  if (!currentSlot || !currentSlot.species) {
    // No species in this slot — fall back to generic suggestions
    const teamWithout = team.map((p, i) => i === slotIndex ? createDefaultPokemonState() : p);
    return suggestNextPick(teamWithout, count, format).map(s => ({ ...s, matchedRoles: [] }));
  }

  const targetRoles = detectSlotRoles(currentSlot, format);
  const teamWithout = team.map((p, i) => i === slotIndex ? createDefaultPokemonState() : p);

  // Generate base candidates with generic team-fit scoring
  const allPokemon = getAvailablePokemon();
  const viable = allPokemon.filter(name =>
    name !== currentSlot.species && (
      PRESETS.some(p => p.species === name) || NORMAL_TIER_LIST.some(e => e.name === name)
    )
  );

  // Build a projection lookup for role matching
  const projection = format.id === 'doubles'
    ? generateDoublesProjection().rankings
    : generateSinglesProjection().rankings;
  const projectionByName = new Map(projection.map(r => [r.species, r]));

  const scored: Array<CandidateScore & { matchedRoles: string[] }> = [];

  for (const name of viable) {
    const base = scoreCandidateForTeam(name, teamWithout, format);
    if (base.score <= 0) continue;

    // Compute role overlap
    const candRoles = new Set<string>();
    const candProj = projectionByName.get(name);
    if (candProj) {
      for (const r of candProj.roles) candRoles.add(r);
    }
    // Also detect move-based roles from the preset (if any)
    const preset = PRESETS.find(p => p.species === name);
    if (preset) {
      const moveSet = new Set(preset.moves);
      for (const { moves, role } of MOVE_ROLE_MAP) {
        if (moves.some(m => moveSet.has(m))) candRoles.add(role);
      }
      const data = getPokemonData(name);
      const ability = (data?.abilities?.[0] || '') as string;
      if (ability === 'Intimidate') candRoles.add('Intimidate');
    }

    const matchedRoles = [...targetRoles].filter(r => candRoles.has(r));

    // Heavily weight role matches — a 1-role-match candidate should
    // outrank a generically strong pick with no matching role.
    let boost = 0;
    if (targetRoles.size > 0) {
      if (matchedRoles.length === 0) {
        // No overlap — demote significantly so role-matched
        // candidates rise to the top
        boost = -20;
      } else {
        // Each matched role is worth a significant bonus
        boost = matchedRoles.length * 15;
      }
    }

    scored.push({
      ...base,
      score: base.score + boost,
      reasons: matchedRoles.length > 0
        ? [`Same role${matchedRoles.length > 1 ? 's' : ''}: ${matchedRoles.join(', ')}`, ...base.reasons]
        : base.reasons,
      matchedRoles,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.filter(s => s.score > 0).slice(0, count);
}
