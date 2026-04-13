// Team Audit Engine
// Scans a team (or partial team) for structural gaps and suggests fixes
// Analyzes: type coverage, shared weaknesses, role coverage, speed profile,
// weather vulnerability, offensive balance, and meta preparedness

import { Move } from '@smogon/calc';
import { getPokemonData, getAvailablePokemon, getTypeEffectiveness, getDefensiveMultiplier, isChampionsPokemon } from '../data/champions';
import { PRESETS } from '../data/presets';
import { NORMAL_TIER_LIST } from '../data/tierlist';
import { getCachedUsageStats, getLiveTeammates } from '../data/liveData';
import { analyzeTeamLineups, DEFAULT_FORMAT, type TeamFlexibilityReport, type BattleFormat } from './lineupAnalysis';
import { buildMoveRoleSet } from '../data/moveIndex';
import type { PokemonState } from '../types';


// ─── Types ──────────────────────────────────────────────────────────

export type Severity = 'critical' | 'warning' | 'info' | 'good';

export interface AuditIssue {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  detail: string;
  suggestion?: string;
  suggestedPokemon?: string[];
}

export interface TeamAudit {
  issues: AuditIssue[];
  score: number; // 0-100
  summary: string;
  typeChart: TypeCoverageReport;
  roleReport: RoleCoverageReport;
  speedProfile: SpeedProfile;
  /** Bring-6-pick-3 lineup flexibility report. Null for < 3 members. */
  lineupReport: TeamFlexibilityReport | null;
}

interface TypeCoverageReport {
  uncoveredOffensively: string[];  // types no team member hits SE
  sharedWeaknesses: { type: string; count: number; members: string[] }[];
  unresisted: string[];  // types no team member resists
}

interface RoleCoverageReport {
  hasFakeOut: boolean;
  hasTailwind: boolean;
  hasTrickRoom: boolean;
  hasIntim: boolean;
  hasRedirect: boolean;
  hasPriority: boolean;
  hasHazards: boolean;
  hasStatusAbsorb: boolean;  // Good as Gold, Magic Bounce, etc
  hasWeatherSetter: boolean;
  hasTerrainSetter: boolean;
  hasProtect: number;  // count of Pokemon with Protect
  hasPivot: boolean;   // U-Turn, Volt Switch, Parting Shot
}

interface SpeedProfile {
  fastest: { species: string; speed: number } | null;
  slowest: { species: string; speed: number } | null;
  avgSpeed: number;
  trickRoomViable: boolean;  // >=2 members below 50 base spe
  tailwindDependent: boolean; // most members in 70-100 range
}

// ─── Type Chart ─────────────────────────────────────────────────────

const ALL_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];



// ─── Role Detection ─────────────────────────────────────────────────

function hasMove(pokemon: PokemonState, ...names: string[]): boolean {
  return pokemon.moves.some(m => m && names.some(n => m.toLowerCase() === n.toLowerCase()));
}

function hasMoveType(pokemon: PokemonState, check: (m: any) => boolean): boolean {
  for (const m of pokemon.moves) {
    if (!m) continue;
    try {
      const move = new Move(9 as any, m);
      if (check(move)) return true;
    } catch { /* skip */ }
  }
  return false;
}

// ─── Main Audit Engine ──────────────────────────────────────────────

export function auditTeam(team: PokemonState[], format: BattleFormat = DEFAULT_FORMAT): TeamAudit {
  const members = team.filter(p => p.species);
  const issues: AuditIssue[] = [];

  if (members.length === 0) {
    return {
      issues: [{ id: 'empty', severity: 'info', category: 'Team', title: 'No Pokemon selected', detail: 'Add Pokemon to see team analysis', suggestedPokemon: [] }],
      score: 0,
      summary: 'Select Pokemon to begin team analysis',
      typeChart: { uncoveredOffensively: [], sharedWeaknesses: [], unresisted: [] },
      roleReport: { hasFakeOut: false, hasTailwind: false, hasTrickRoom: false, hasIntim: false, hasRedirect: false, hasPriority: false, hasHazards: false, hasStatusAbsorb: false, hasWeatherSetter: false, hasTerrainSetter: false, hasProtect: 0, hasPivot: false },
      speedProfile: { fastest: null, slowest: null, avgSpeed: 0, trickRoomViable: false, tailwindDependent: false },
      lineupReport: null,
    };
  }

  // ─── Lineup analysis for the selected format ──────────────────
  // Champions runs separate Singles and Doubles ladders with very
  // different pick counts (3 vs 4) and metas. The lineup report
  // here drives the flexibility audit checks below and respects
  // whichever format the caller asked for.
  const lineupReport = members.length >= format.battleSize
    ? analyzeTeamLineups(members, format)
    : null;

  // ─── Gather team data ──────────────────────────────────────────
  const memberData = members.map(m => ({
    state: m,
    data: getPokemonData(m.species),
  })).filter(m => m.data);

  const teamTypes = memberData.map(m => [...m.data!.types] as string[]);
  const teamSpeeds = memberData.map(m => m.data!.baseStats.spe);

  // ─── 1. TYPE COVERAGE ANALYSIS ─────────────────────────────────

  // Offensive: what types can the team hit super-effectively via STAB?
  const offensiveSE = new Set<string>();
  for (const types of teamTypes) {
    for (const atkType of types) {
      for (const defType of ALL_TYPES) {
        if (getTypeEffectiveness(atkType, defType) > 1) offensiveSE.add(defType);
      }
    }
  }
  // Also check moves for coverage
  for (const m of members) {
    for (const moveName of m.moves) {
      if (!moveName) continue;
      try {
        const move = new Move(9 as any, moveName);
        if (move.category === 'Status') continue;
        for (const defType of ALL_TYPES) {
          if (getTypeEffectiveness(move.type, defType) > 1) offensiveSE.add(defType);
        }
      } catch { /* skip */ }
    }
  }
  const uncoveredOffensively = ALL_TYPES.filter(t => !offensiveSE.has(t));

  if (uncoveredOffensively.length > 0) {
    const severity: Severity = uncoveredOffensively.length >= 4 ? 'critical' : uncoveredOffensively.length >= 2 ? 'warning' : 'info';
    // Find Pokemon that cover these gaps
    const fillers = findOffensiveCoverage(uncoveredOffensively, members.map(m => m.species));
    issues.push({
      id: 'offensive-gap',
      severity,
      category: 'Coverage',
      title: `No super-effective coverage against ${uncoveredOffensively.join(', ')}`,
      detail: `Your team can't hit ${uncoveredOffensively.join(', ')}-type Pokemon for super-effective damage with current moves/STAB.`,
      suggestion: fillers.length > 0 ? `Consider adding: ${fillers.slice(0, 3).join(', ')}` : undefined,
      suggestedPokemon: fillers.slice(0, 3),
    });
  }

  // Defensive: shared weaknesses
  const weaknessCounts = new Map<string, string[]>();
  for (const { state, data } of memberData) {
    if (!data) continue;
    for (const atkType of ALL_TYPES) {
      const mult = getDefensiveMultiplier(atkType, [...data.types] as string[]);
      if (mult > 1) {
        const list = weaknessCounts.get(atkType) || [];
        list.push(state.species);
        weaknessCounts.set(atkType, list);
      }
    }
  }

  const sharedWeaknesses: { type: string; count: number; members: string[] }[] = [];
  for (const [type, pokemonList] of weaknessCounts) {
    if (pokemonList.length >= 3) {
      sharedWeaknesses.push({ type, count: pokemonList.length, members: pokemonList });
    }
  }
  sharedWeaknesses.sort((a, b) => b.count - a.count);

  for (const sw of sharedWeaknesses) {
    const severity: Severity = sw.count >= 4 ? 'critical' : 'warning';
    const resistors = findDefensiveAnswers(sw.type, members.map(m => m.species));
    issues.push({
      id: `shared-weak-${sw.type}`,
      severity,
      category: 'Weakness',
      title: `${sw.count}/${members.length} Pokemon weak to ${sw.type}`,
      detail: `${sw.members.join(', ')} are all weak to ${sw.type}-type attacks. A single ${sw.type}-type attacker threatens most of your team.`,
      suggestion: resistors.length > 0 ? `Add a ${sw.type} resist: ${resistors.slice(0, 3).join(', ')}` : undefined,
      suggestedPokemon: resistors.slice(0, 3),
    });
  }

  // Unresisted types — no team member resists this type
  const unresisted: string[] = [];
  for (const atkType of ALL_TYPES) {
    let anyResist = false;
    for (const { data } of memberData) {
      if (!data) continue;
      const mult = getDefensiveMultiplier(atkType, [...data.types] as string[]);
      if (mult < 1 || mult === 0) { anyResist = true; break; }
    }
    if (!anyResist) unresisted.push(atkType);
  }

  if (unresisted.length > 0) {
    const fillers = findDefensiveAnswers(unresisted[0], members.map(m => m.species));
    issues.push({
      id: 'unresisted',
      severity: unresisted.length >= 3 ? 'warning' : 'info',
      category: 'Coverage',
      title: `No resistances to ${unresisted.join(', ')}`,
      detail: `No team member resists ${unresisted.join(', ')}-type attacks. You have no safe switch-in against these types.`,
      suggestion: fillers.length > 0 ? `Consider: ${fillers.slice(0, 3).join(', ')}` : undefined,
      suggestedPokemon: fillers.slice(0, 3),
    });
  }

  // ─── 2. ROLE COVERAGE ──────────────────────────────────────────

  const roles: RoleCoverageReport = {
    hasFakeOut: members.some(m => hasMove(m, 'Fake Out')),
    hasTailwind: members.some(m => hasMove(m, 'Tailwind')),
    hasTrickRoom: members.some(m => hasMove(m, 'Trick Room')),
    hasIntim: members.some(m => m.ability.toLowerCase() === 'intimidate'),
    hasRedirect: members.some(m => hasMove(m, 'Rage Powder', 'Follow Me', 'Ally Switch')),
    hasPriority: members.some(m => hasMoveType(m, (mv: any) => mv.priority > 0 && mv.category !== 'Status')),
    hasHazards: members.some(m => hasMove(m, 'Stealth Rock', 'Spikes', 'Toxic Spikes')),
    hasStatusAbsorb: members.some(m => ['Good as Gold', 'Magic Bounce', 'Magic Guard'].includes(m.ability)),
    hasWeatherSetter: members.some(m => ['Drought', 'Drizzle', 'Sand Stream', 'Snow Warning'].includes(m.ability)),
    hasTerrainSetter: members.some(m => ['Electric Surge', 'Grassy Surge', 'Misty Surge', 'Psychic Surge'].includes(m.ability)),
    hasProtect: members.filter(m => hasMove(m, 'Protect', 'Detect', 'Baneful Bunker', 'Spiky Shield', 'King\'s Shield', 'Silk Trap')).length,
    hasPivot: members.some(m => hasMove(m, 'U-turn', 'Volt Switch', 'Parting Shot', 'Flip Turn', 'Teleport')),
  };

  // Detect Pokemon that COULD provide speed control but don't have
  // the move equipped. Filtered through isChampionsPokemon so stale
  // species (Rillaboom etc.) don't create phantom suggestions.
  // Dynamic role detection — derived from moveIndex presets + live data.
  // NO hardcoded species. Adding a preset with Trick Room auto-enrolls.
  const trSet = buildMoveRoleSet(new Set(['Trick Room']));
  const twSet = buildMoveRoleSet(new Set(['Tailwind']));
  const foSet = buildMoveRoleSet(new Set(['Fake Out']));
  const KNOWN_TR_SETTERS = [...trSet].filter(isChampionsPokemon);
  const KNOWN_TAILWIND = [...twSet].filter(isChampionsPokemon);
  const KNOWN_FAKE_OUT = [...foSet].filter(isChampionsPokemon);

  const potentialTR = members.filter(m => KNOWN_TR_SETTERS.includes(m.species) && !hasMove(m, 'Trick Room'));
  const potentialTailwind = members.filter(m => KNOWN_TAILWIND.includes(m.species) && !hasMove(m, 'Tailwind'));
  const potentialFakeOut = members.filter(m => KNOWN_FAKE_OUT.includes(m.species) && !hasMove(m, 'Fake Out'));

  // Check for missing critical roles
  if (!roles.hasFakeOut && !roles.hasTailwind && !roles.hasTrickRoom) {
    const hasPotential = potentialTR.length > 0 || potentialTailwind.length > 0 || potentialFakeOut.length > 0;

    if (hasPotential) {
      // Team has Pokemon that COULD fill the role — suggest moveset change
      const moveHints: string[] = [];
      potentialTR.forEach(m => moveHints.push(`${m.species} can learn Trick Room`));
      potentialTailwind.forEach(m => moveHints.push(`${m.species} can learn Tailwind`));
      potentialFakeOut.forEach(m => moveHints.push(`${m.species} can learn Fake Out`));

      issues.push({
        id: 'speed-control-available',
        severity: 'warning',
        category: 'Speed Control',
        title: 'Speed control available but not equipped',
        detail: `Your team has Pokemon that can provide speed control, but they don't have the moves: ${moveHints.join(', ')}. Consider adjusting their movesets.`,
        suggestion: moveHints[0] + ' — swap a move slot to add it',
      });
    } else {
      issues.push({
        id: 'no-speed-control',
        severity: 'critical',
        category: 'Speed Control',
        title: 'No speed control (Fake Out, Tailwind, or Trick Room)',
        detail: 'Your team has no way to control the pace of battle and no Pokemon that naturally learn these moves.',
        suggestion: 'Add Whimsicott (Tailwind), Incineroar (Fake Out), or Mimikyu (Trick Room)',
        suggestedPokemon: ['Whimsicott', 'Incineroar', 'Mimikyu'],
      });
    }
  } else if (!roles.hasFakeOut) {
    if (potentialFakeOut.length > 0) {
      issues.push({
        id: 'fake-out-available',
        severity: 'info',
        category: 'Speed Control',
        title: `${potentialFakeOut[0].species} can learn Fake Out`,
        detail: `Fake Out guarantees a free turn for your partner. ${potentialFakeOut[0].species} can learn it — consider swapping a move.`,
      });
    } else {
      issues.push({
        id: 'no-fake-out',
        severity: 'warning',
        category: 'Speed Control',
        title: 'No Fake Out user',
        detail: 'Fake Out guarantees a free turn for your partner by flinching one opponent. In Champions, Fake Out cannot be used on the turn a Pokemon switches in.',
        suggestion: 'Consider Incineroar, Meowscarada, or Sneasler for Fake Out',
        suggestedPokemon: ['Incineroar', 'Meowscarada', 'Sneasler'].filter(isChampionsPokemon),
      });
    }
  }

  if (!roles.hasIntim) {
    issues.push({
      id: 'no-intimidate',
      severity: 'warning',
      category: 'Support',
      title: 'No Intimidate user',
      detail: 'Intimidate is the most impactful ability in Doubles — it drops both opponents\' Attack on switch-in, effectively reducing physical damage by ~33%.',
      suggestion: 'Add Incineroar (Intimidate + Fake Out + Parting Shot) or Arcanine',
      suggestedPokemon: ['Incineroar', 'Arcanine', 'Gyarados'],
    });
  }

  if (!roles.hasRedirect && members.length >= 3) {
    issues.push({
      id: 'no-redirect',
      severity: 'info',
      category: 'Support',
      title: 'No redirection support',
      detail: 'Follow Me / Ally Switch redirects single-target attacks to protect your sweeper. Useful for enabling setup or protecting fragile attackers. Note: Amoonguss (the mainline VGC redirector) is not in Champions.',
      suggestion: 'Consider Clefable or Togekiss (Follow Me) as the primary redirector slot',
      suggestedPokemon: ['Clefable', 'Togekiss'],
    });
  }

  if (!roles.hasPriority) {
    issues.push({
      id: 'no-priority',
      severity: 'warning',
      category: 'Offense',
      title: 'No priority moves',
      detail: 'Priority attacks (Extreme Speed, Bullet Punch, Sucker Punch, Aqua Jet) bypass Speed and pick off weakened targets. Without them, faster opponents can sweep you at low HP.',
      suggestion: 'Consider Scizor (Bullet Punch), Dragonite (Extreme Speed), or Weavile (Ice Shard)',
      suggestedPokemon: ['Scizor', 'Dragonite', 'Weavile'],
    });
  }

  if (!roles.hasPivot) {
    issues.push({
      id: 'no-pivot',
      severity: 'info',
      category: 'Momentum',
      title: 'No pivot moves (U-Turn / Volt Switch / Parting Shot)',
      detail: 'Pivot moves let you switch while dealing damage or debuffing, maintaining momentum and bringing in teammates safely.',
      suggestion: 'Incineroar (Parting Shot), Rotom-Wash (Volt Switch), or Scizor (U-turn)',
      suggestedPokemon: ['Incineroar', 'Rotom-Wash', 'Scizor'].filter(isChampionsPokemon),
    });
  }

  if (roles.hasProtect < Math.min(members.length, 4) - 1 && members.length >= 3) {
    issues.push({
      id: 'low-protect',
      severity: 'info',
      category: 'Defense',
      title: `Only ${roles.hasProtect}/${members.length} Pokemon have Protect`,
      detail: 'Protect is essential in Doubles — it scouts moves, stalls field turns, and enables your partner to act freely. Most Pokemon should carry it.',
    });
  }

  // ─── 3. SPEED PROFILE ─────────────────────────────────────────

  const sortedSpeeds = memberData
    .map(m => ({ species: m.state.species, speed: m.data!.baseStats.spe }))
    .sort((a, b) => b.speed - a.speed);

  const speedProfile: SpeedProfile = {
    fastest: sortedSpeeds[0] || null,
    slowest: sortedSpeeds[sortedSpeeds.length - 1] || null,
    avgSpeed: teamSpeeds.length > 0 ? Math.round(teamSpeeds.reduce((a, b) => a + b, 0) / teamSpeeds.length) : 0,
    trickRoomViable: teamSpeeds.filter(s => s <= 50).length >= 2,
    tailwindDependent: teamSpeeds.filter(s => s >= 70 && s <= 100).length >= Math.ceil(members.length / 2),
  };

  if (speedProfile.tailwindDependent && !roles.hasTailwind) {
    issues.push({
      id: 'needs-tailwind',
      severity: 'critical',
      category: 'Speed Control',
      title: 'Mid-speed team without Tailwind',
      detail: `Most of your team sits in the 70-100 base Speed range. Without Tailwind, faster threats (Dragapult, Greninja, Meowscarada) will consistently outspeed you.`,
      suggestion: 'Add Whimsicott (Prankster Tailwind)',
      suggestedPokemon: ['Whimsicott'],
    });
  }

  if (speedProfile.trickRoomViable && !roles.hasTrickRoom && !roles.hasTailwind) {
    issues.push({
      id: 'tr-viable-no-setter',
      severity: 'warning',
      category: 'Speed Control',
      title: 'Slow Pokemon without Trick Room access',
      detail: `You have ${teamSpeeds.filter(s => s <= 50).length} slow Pokemon that would benefit from Trick Room, but no setter.`,
      suggestion: 'Add Mimikyu (Disguise guarantees TR setup) or another TR setter',
      suggestedPokemon: ['Mimikyu'],
    });
  }

  // ─── 4. OFFENSIVE BALANCE ─────────────────────────────────────

  const physAttackers = memberData.filter(m => m.data!.baseStats.atk > m.data!.baseStats.spa).length;
  const specAttackers = memberData.filter(m => m.data!.baseStats.spa > m.data!.baseStats.atk).length;

  if (members.length >= 3 && physAttackers > 0 && specAttackers === 0) {
    issues.push({
      id: 'all-physical',
      severity: 'critical',
      category: 'Offense',
      title: 'Entirely physical offense',
      detail: 'Every attacker on your team is physical. A single Intimidate drop or Will-O-Wisp cripples your entire damage output. Physical walls like Corviknight wall your whole team.',
      suggestion: 'Add a special attacker: Dragapult, Volcarona, Primarina, or Hydreigon',
      suggestedPokemon: ['Dragapult', 'Volcarona', 'Primarina', 'Hydreigon'].filter(isChampionsPokemon),
    });
  }
  if (members.length >= 3 && specAttackers > 0 && physAttackers === 0) {
    issues.push({
      id: 'all-special',
      severity: 'critical',
      category: 'Offense',
      title: 'Entirely special offense',
      detail: 'Every attacker is special. Assault Vest users and special walls like Snorlax or Umbreon wall your entire team.',
      suggestion: 'Add a physical attacker: Garchomp, Scizor, Dragonite, or Weavile',
      suggestedPokemon: ['Garchomp', 'Scizor', 'Dragonite', 'Weavile'].filter(isChampionsPokemon),
    });
  }

  // ─── 5. META PREPAREDNESS ─────────────────────────────────────

  // Derive meta threats dynamically from the tier list — S and A+
  // tier Pokemon are the threats every team should prepare for.
  // No hardcoded species: updating the tier list auto-updates the
  // audit warnings.
  const metaThreats = NORMAL_TIER_LIST
    .filter(e => (e.tier === 'S' || e.tier === 'A+' || e.tier === 'A') && isChampionsPokemon(e.name))
    .map(e => e.name);
  for (const threat of metaThreats) {
    if (members.some(m => m.species === threat)) continue; // You have it

    const threatData = getPokemonData(threat);
    if (!threatData) continue;

    // Can any team member hit it SE?
    const canHit = memberData.some(({ state }) => {
      for (const moveName of state.moves) {
        if (!moveName) continue;
        try {
          const move = new Move(9 as any, moveName);
          if (move.category === 'Status') continue;
          const mult = getDefensiveMultiplier(move.type, [...threatData.types] as string[]);
          if (mult > 1) return true;
        } catch { /* skip */ }
      }
      return false;
    });

    if (!canHit && members.length >= 3) {
      issues.push({
        id: `no-answer-${threat}`,
        severity: 'warning',
        category: 'Meta',
        title: `No super-effective answer to ${threat}`,
        detail: `${threat} is a top-tier meta threat and none of your current moves hit it super-effectively.`,
        suggestion: `Ensure you have ${threatData.types.join('/')}-coverage moves or a Pokemon that checks ${threat}`,
      });
    }
  }

  // ─── 6. LIVE DATA INSIGHTS ────────────────────────────────────
  const liveStats = getCachedUsageStats();
  if (liveStats && members.length >= 2) {
    // Check teammate synergy from real data
    for (const m of members) {
      const teammates = getLiveTeammates(liveStats, m.species);
      if (teammates.length === 0) continue;

      // Find if any of the top teammates are missing from the team
      const topMissing = teammates
        .filter(t => t.usage > 0.15 && !members.some(m2 => m2.species === t.name))
        .slice(0, 2);

      if (topMissing.length > 0 && members.length <= 4) {
        issues.push({
          id: `missing-teammate-${m.species}`,
          severity: 'info',
          category: 'Synergy',
          title: `${m.species}'s top partners aren't on the team`,
          detail: `In competitive play, ${m.species} is most commonly paired with ${topMissing.map(t => `${t.name} (${(t.usage * 100).toFixed(0)}%)`).join(', ')}.`,
          suggestion: `Consider adding ${topMissing.map(t => t.name).join(' or ')}`,
          suggestedPokemon: topMissing.map(t => t.name),
        });
      }
    }
  }

  // ─── BRING-6-PICK-3 LINEUP FLEXIBILITY ────────────────────────
  // Surface lineup-specific issues that the per-member checks above
  // can't catch. These are the signals that matter most in a bring-N
  // format but are invisible if you only look at the 6-mon team.
  if (lineupReport) {
    const pickLabel = `pick-${format.battleSize}`;
    if (lineupReport.score < 50 && members.length >= format.battleSize) {
      issues.push({
        id: 'lineup-inflexibility',
        severity: members.length === format.rosterSize ? 'critical' : 'warning',
        category: `${format.label} Flexibility`,
        title: `Low ${pickLabel} flexibility (${lineupReport.score}/100)`,
        detail: `Most ${format.battleSize}-Pokemon subsets of this team score poorly in ${format.label}. An opponent who bans or pressures your 1-2 strongest picks leaves you without a backup plan.`,
        suggestion: `Add Pokemon that enable new strong ${format.battleSize}-mon subsets rather than duplicating roles you already have.`,
      });
    }

    // Single viable lineup — the most dangerous trap in bring-N-pick-M.
    const viableCount = lineupReport.lineups.filter(l => l.total >= 25).length;
    if (viableCount === 1 && lineupReport.lineups.length > 1) {
      issues.push({
        id: 'lineup-single-viable',
        severity: 'critical',
        category: `${format.label} Flexibility`,
        title: `Only one viable ${pickLabel} lineup`,
        detail: `Only ${lineupReport.bestLineup?.members.join(' + ')} scores as a viable ${pickLabel} lineup. Any matchup that punishes that lineup beats the entire team.`,
        suggestion: `Diversify roles — aim for at least 3 strong ${pickLabel} subsets so you can adapt at team preview.`,
      });
    }

    // Load-bearing Pokemon: a single member appears in EVERY top lineup.
    if (lineupReport.loadBearing.length > 0 && lineupReport.loadBearing[0].appearances >= Math.min(5, lineupReport.lineups.length)) {
      const anchor = lineupReport.loadBearing[0].species;
      issues.push({
        id: `lineup-anchor-${anchor}`,
        severity: 'warning',
        category: `${format.label} Flexibility`,
        title: `${anchor} is load-bearing`,
        detail: `${anchor} appears in every top ${format.battleSize}-lineup. Its weaknesses are effectively the team's weaknesses — if the opponent prepares for ${anchor}, you have no plan B.`,
        suggestion: `Build an alternate win condition that doesn't rely on ${anchor}.`,
      });
    }

    // Underused Pokemon: roster members that never make a top lineup.
    if (lineupReport.underused.length > 0 && members.length === format.rosterSize) {
      const dead = lineupReport.underused.map(u => u.species);
      issues.push({
        id: 'lineup-dead-slots',
        severity: 'warning',
        category: `${format.label} Flexibility`,
        title: `${dead.length} Pokemon rarely appear in top lineups`,
        detail: `${dead.join(', ')} don't make the best ${pickLabel} selections for this team. They're likely taking up a roster slot without contributing.`,
        suggestion: `Consider replacing with Pokemon that unlock new viable ${format.battleSize}-mon subsets.`,
      });
    }

    // Positive: strong flexibility
    if (lineupReport.score >= 75 && members.length >= 4) {
      issues.push({
        id: 'good-flexibility',
        severity: 'good',
        category: `${format.label} Flexibility`,
        title: `Strong ${pickLabel} flexibility (${lineupReport.score}/100)`,
        detail: `${lineupReport.lineups.filter(l => l.total >= 40).length} lineups score above the viable threshold. You can adapt at team preview to most matchups.`,
      });
    }
  }

  // ─── POSITIVE FINDINGS ────────────────────────────────────────
  if (roles.hasFakeOut && roles.hasTailwind) {
    issues.push({
      id: 'good-speed',
      severity: 'good',
      category: 'Speed Control',
      title: 'Strong speed control with Fake Out + Tailwind',
      detail: 'Fake Out protects the Tailwind setter, guaranteeing speed advantage from turn 1.',
    });
  }

  if (roles.hasIntim && roles.hasPivot) {
    issues.push({
      id: 'good-cycle',
      severity: 'good',
      category: 'Support',
      title: 'Intimidate cycling available',
      detail: 'Pivot moves let you re-trigger Intimidate by switching out and back in, repeatedly dropping opponent Attack.',
    });
  }

  if (sharedWeaknesses.length === 0 && members.length >= 3) {
    issues.push({
      id: 'good-typing',
      severity: 'good',
      category: 'Coverage',
      title: 'No major shared weaknesses',
      detail: 'Your team has good type diversity — no single type threatens 3+ members.',
    });
  }

  if (physAttackers > 0 && specAttackers > 0) {
    issues.push({
      id: 'good-mixed',
      severity: 'good',
      category: 'Offense',
      title: 'Mixed physical/special offense',
      detail: 'Your team threatens from both sides — opponents can\'t wall you with a single defensive stat.',
    });
  }

  // ─── SCORE ────────────────────────────────────────────────────
  const criticals = issues.filter(i => i.severity === 'critical').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const goods = issues.filter(i => i.severity === 'good').length;
  let score = 100 - (criticals * 15) - (warnings * 5) + (goods * 5);
  score = Math.max(0, Math.min(100, score));

  // Scale down if team is incomplete
  if (members.length < 6) {
    score = Math.min(score, 40 + members.length * 10);
  }

  const summary = score >= 80 ? 'Strong team composition with minor tweaks available'
    : score >= 60 ? 'Decent foundation but has notable gaps to address'
    : score >= 40 ? 'Several structural issues — address critical gaps first'
    : 'Significant team building issues — major roles and coverage missing';

  // Sort: good at bottom, critical at top
  const severityOrder: Record<Severity, number> = { critical: 0, warning: 1, info: 2, good: 3 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    issues,
    score,
    summary,
    typeChart: { uncoveredOffensively, sharedWeaknesses, unresisted },
    roleReport: roles,
    speedProfile,
    lineupReport,
  };
}

// ─── Suggestion Helpers ─────────────────────────────────────────────

function findOffensiveCoverage(uncoveredTypes: string[], excludeSpecies: string[]): string[] {
  const candidates = getAvailablePokemon().filter(n => !excludeSpecies.includes(n));
  const tierScore: Record<string, number> = { S: 10, 'A+': 8, A: 6, B: 4, C: 2 };

  const scored: { name: string; score: number }[] = [];

  for (const name of candidates) {
    if (name.includes('-') && !name.includes('-Alola') && !name.includes('-Galar') && !name.includes('-Hisui') && !name.includes('-Paldea') && !name.includes('-Wash') && !name.includes('-Heat') && !name.includes('-Mow')) continue;

    const data = getPokemonData(name);
    if (!data) continue;
    let hits = 0;
    for (const atkType of data.types) {
      for (const uncovered of uncoveredTypes) {
        if (getTypeEffectiveness(atkType as string, uncovered) > 1) hits++;
      }
    }
    if (hits === 0) continue;

    let score = hits * 3;
    const tier = NORMAL_TIER_LIST.find(e => e.name === name);
    if (tier) score += tierScore[tier.tier] || 0;
    if (PRESETS.some(p => p.species === name)) score += 3;

    scored.push({ name, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map(s => s.name);
}

function findDefensiveAnswers(weakType: string, excludeSpecies: string[]): string[] {
  const candidates = getAvailablePokemon().filter(n => !excludeSpecies.includes(n));
  const tierScore: Record<string, number> = { S: 10, 'A+': 8, A: 6, B: 4, C: 2 };

  const scored: { name: string; score: number }[] = [];

  for (const name of candidates) {
    // Skip alternate forms (anything with a hyphen that isn't a regional form)
    if (name.includes('-') && !name.includes('-Alola') && !name.includes('-Galar') && !name.includes('-Hisui') && !name.includes('-Paldea') && !name.includes('-Wash') && !name.includes('-Heat') && !name.includes('-Mow')) continue;

    const data = getPokemonData(name);
    if (!data) continue;
    const mult = getDefensiveMultiplier(weakType, [...data.types] as string[]);
    if (mult >= 1) continue; // Must resist

    // Score by meta viability
    let score = 0;
    const tier = NORMAL_TIER_LIST.find(e => e.name === name);
    if (tier) score += tierScore[tier.tier] || 0;
    if (PRESETS.some(p => p.species === name)) score += 3;
    if (mult === 0) score += 2; // Immune is better than resist

    scored.push({ name, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map(s => s.name);
}
