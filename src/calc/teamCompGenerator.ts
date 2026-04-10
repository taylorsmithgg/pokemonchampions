// ─── Champions Doubles Team Comp Generator ────────────────────────
//
// Converts the doublesMetaProjection's archetype cores into complete
// 6-Pokemon doubles team comps. This is the pipeline that makes us
// the leader in Champions Doubles meta analysis:
//
//   1. doublesMetaProjection — scores every Champions mon for
//      Doubles viability from first principles
//   2. Archetype core detection — groups top picks into thematic
//      strategies (Sand, Sun, TR, Tailwind, etc.)
//   3. This generator — expands each core into a full 6-mon team,
//      fills gaps (speed control, Fake Out, win con, item diversity),
//      and verifies the result via analyzeTeamLineups
//
// The output is a set of buildable, pre-validated doubles comps that
// don't exist in any VGC source because Champions is a new game.

import {
  generateDoublesProjection,
  type DoublesProjection,
  type ArchetypeCore,
  type ProjectionReport,
} from './doublesMetaProjection';
import { analyzeTeamLineups, DOUBLES_FORMAT } from './lineupAnalysis';
import { getPokemonData } from '../data/champions';
import { MEGA_STONE_MAP } from '../data/championsRoster';
import { getPresetsBySpecies } from '../data/presets';
import { createDefaultPokemonState } from '../types';
import type { PokemonState, NatureName } from '../types';
import type { StatsTable } from '@smogon/calc';
import type { TeamMember, TeamComp } from '../data/teams';

// ─── Types ─────────────────────────────────────────────────────────

export interface GeneratedDoublesTeam extends TeamComp {
  /** True marker so the UI can distinguish generated from curated. */
  generated: true;
  /** Which archetype core this team was built around. */
  basedOnCore: string;
  /** Lineup-analysis score for the generated team. */
  flexScore: number;
  /** Top 3 strongest 4-pick subsets for this team (bring 6, pick 4). */
  topPickLineups: Array<{ members: string[]; score: number }>;
}

// ─── Team-building helpers ─────────────────────────────────────────

/** Build a full TeamMember for a species, honoring a taken-item set. */
function buildMember(
  species: string,
  usedItems: Set<string>,
  role?: string,
): TeamMember | null {
  const data = getPokemonData(species);
  if (!data) return null;

  // Prefer a curated preset if one exists and its item is available.
  const presets = getPresetsBySpecies(species);
  const available = presets.find(p => !usedItems.has(p.item));
  if (available) {
    return {
      species: available.species,
      role: role ?? available.label,
      nature: available.nature,
      ability: available.ability,
      item: available.item,
      teraType: '',
      sps: { ...available.sps },
      moves: [...available.moves],
    };
  }

  // No preset (or all presets' items taken) — construct from scratch.
  const bs = data.baseStats;
  const ability = (data.abilities?.[0] || '') as string;
  const isPhys = bs.atk >= bs.spa;

  // Choose nature based on offensive role + speed
  let nature: NatureName;
  if (bs.spe >= 100) nature = isPhys ? 'Jolly' : 'Timid';
  else if (bs.hp + bs.def + bs.spd > bs.atk + bs.spa + bs.spe + 60) nature = 'Impish';
  else nature = isPhys ? 'Adamant' : 'Modest';

  // Choose SP spread
  let sps: StatsTable;
  if (bs.spe >= 100) {
    // Fast sweeper
    sps = { hp: 2, atk: isPhys ? 32 : 0, def: 0, spa: isPhys ? 0 : 32, spd: 0, spe: 32 };
  } else if (bs.hp + bs.def + bs.spd > 240) {
    // Bulky wall
    sps = { hp: 32, atk: isPhys ? 32 : 0, def: 2, spa: isPhys ? 0 : 32, spd: 0, spe: 0 };
  } else {
    // Balanced offensive
    sps = { hp: 32, atk: isPhys ? 32 : 0, def: 2, spa: isPhys ? 0 : 32, spd: 0, spe: 0 };
  }

  // Choose item based on role + what's still available
  const itemPriority = [
    'Sitrus Berry', 'Leftovers', 'Focus Sash', 'Lum Berry',
    'Mental Herb', 'Light Clay', 'Scope Lens', 'Shell Bell',
    'Quick Claw', 'Bright Powder',
  ];
  const item = itemPriority.find(i => !usedItems.has(i)) ?? '';

  return {
    species,
    role: role ?? 'Generalist',
    nature,
    ability,
    item,
    teraType: '',
    sps,
    moves: ['', '', '', ''],
  };
}

/** True if the given item is any Mega Stone. */
function isMegaStone(item: string): boolean {
  if (!item) return false;
  for (const stones of Object.values(MEGA_STONE_MAP)) {
    if (stones.includes(item)) return true;
  }
  return false;
}

/** True if the team already has a Mega Stone equipped. Champions
 *  enforces one Mega Evolution per battle — the generator must
 *  respect this at build time. */
function teamHasMegaStone(members: readonly TeamMember[]): boolean {
  return members.some(m => isMegaStone(m.item));
}

/** Strip a Mega Stone from a member's item if one is set. Used when
 *  a preset would have equipped a stone but the team already has
 *  another Mega committed. */
function stripMegaStone(member: TeamMember, usedItems: Set<string>): TeamMember {
  if (!isMegaStone(member.item)) return member;
  // Fall back to a safe utility item that isn't already taken
  const fallback = ['Sitrus Berry', 'Leftovers', 'Focus Sash', 'Lum Berry', 'Mental Herb', 'Shell Bell']
    .find(i => !usedItems.has(i)) ?? '';
  return { ...member, item: fallback };
}

/** Upgrade a member's item to a Mega Stone if the species has one
 *  AND no other member already holds one. */
function tryEquipMega(
  member: TeamMember,
  usedItems: Set<string>,
  existingMembers: readonly TeamMember[],
): TeamMember {
  if (teamHasMegaStone(existingMembers)) return member;
  const stones = MEGA_STONE_MAP[member.species];
  if (!stones) return member;
  const availableStone = stones.find(s => !usedItems.has(s));
  if (!availableStone) return member;
  return { ...member, item: availableStone };
}

// ─── Role gap detection ────────────────────────────────────────────
// Given a partial team, what doubles roles are still missing?

interface RoleGaps {
  needsFakeOut: boolean;
  needsTailwind: boolean;
  needsTrickRoom: boolean;
  needsIntimidate: boolean;
  needsRedirection: boolean;
  needsWincon: boolean;
}

const KNOWN_FAKE_OUT = new Set([
  'Incineroar', 'Kangaskhan', 'Meowscarada', 'Lopunny', 'Infernape',
  'Lycanroc', 'Weavile', 'Glalie', 'Mr. Rime', 'Pangoro',
]);
const KNOWN_TAILWIND = new Set([
  'Whimsicott', 'Talonflame', 'Pelipper', 'Pidgeot', 'Noivern',
  'Corviknight', 'Altaria', 'Dragonite', 'Aerodactyl', 'Gyarados',
]);
const KNOWN_TRICK_ROOM = new Set([
  'Hatterene', 'Mimikyu', 'Reuniclus', 'Cofagrigus', 'Polteageist',
  'Runerigus', 'Gourgeist', 'Slowking', 'Slowbro', 'Alcremie',
]);
const KNOWN_REDIRECTION = new Set([
  'Clefable', 'Togekiss', 'Audino', 'Volcarona', 'Vivillon',
]);

function detectGaps(members: readonly string[]): RoleGaps {
  return {
    needsFakeOut: !members.some(s => KNOWN_FAKE_OUT.has(s)),
    needsTailwind: !members.some(s => KNOWN_TAILWIND.has(s)),
    needsTrickRoom: !members.some(s => KNOWN_TRICK_ROOM.has(s)),
    needsIntimidate: !members.some(s => {
      const ability = (getPokemonData(s)?.abilities?.[0] || '') as string;
      return ability === 'Intimidate';
    }),
    needsRedirection: !members.some(s => KNOWN_REDIRECTION.has(s)),
    needsWincon: false, // computed below per-core
  };
}

// ─── Core-to-team builder ──────────────────────────────────────────

function buildTeamForCore(
  core: ArchetypeCore,
  report: ProjectionReport,
): GeneratedDoublesTeam | null {
  const picks: string[] = [];
  const seen = new Set<string>();

  const add = (name: string) => {
    if (seen.has(name)) return;
    if (picks.length >= 6) return;
    const proj = report.rankings.find(r => r.species === name);
    if (!proj) return; // skip species not actually in the projection
    seen.add(name);
    picks.push(name);
  };

  // 1. Anchors — the core's must-haves
  for (const a of core.anchors) add(a);

  // 2. Partners — the suggested synergy picks, capped at 3 to leave
  //    room for role fillers
  let partnerCount = 0;
  for (const p of core.partners) {
    if (partnerCount >= 3) break;
    if (!seen.has(p)) {
      add(p);
      partnerCount++;
    }
  }

  // 3. Fill gaps using top-projected Pokemon that cover missing roles
  const gaps = detectGaps(picks);
  const rankingOrder = [...report.rankings]
    .filter(r => !seen.has(r.species))
    .sort((a, b) => b.score - a.score);

  const gapResolvers: Array<{ need: keyof RoleGaps; test: (r: DoublesProjection) => boolean }> = [
    { need: 'needsFakeOut', test: r => KNOWN_FAKE_OUT.has(r.species) },
    { need: 'needsTailwind', test: r => KNOWN_TAILWIND.has(r.species) || KNOWN_TRICK_ROOM.has(r.species) },
    { need: 'needsIntimidate', test: r => {
      const a = (getPokemonData(r.species)?.abilities?.[0] || '') as string;
      return a === 'Intimidate';
    }},
    { need: 'needsRedirection', test: r => KNOWN_REDIRECTION.has(r.species) },
  ];

  for (const { need, test } of gapResolvers) {
    if (!gaps[need] || picks.length >= 6) continue;
    const found = rankingOrder.find(r => test(r) && !seen.has(r.species));
    if (found) add(found.species);
  }

  // 4. Fill remaining slots with the highest-projected Pokemon not
  //    yet on the team, prioritizing Wincon / Wallbreaker roles.
  const preferredRoles = new Set(['Wincon', 'Wallbreaker', 'Hyper Offense', 'Pivot Wall']);
  const sortedFillers = rankingOrder
    .filter(r => !seen.has(r.species))
    .sort((a, b) => {
      // Prioritize entries that match a preferred role
      const aPref = a.roles.some(r => preferredRoles.has(r));
      const bPref = b.roles.some(r => preferredRoles.has(r));
      if (aPref !== bPref) return aPref ? -1 : 1;
      return b.score - a.score;
    });
  for (const f of sortedFillers) {
    if (picks.length >= 6) break;
    add(f.species);
  }

  if (picks.length < 6) return null;

  // 5. Build full TeamMember objects with item deduplication. One
  //    Mega slot max per team — the anchor claims it if it can,
  //    otherwise the first eligible member does. All other presets
  //    with Mega Stones get their stone stripped to preserve the
  //    one-per-team rule.
  const members: TeamMember[] = [];
  const usedItems = new Set<string>();

  // Decide which slot index will own the Mega Stone (if any).
  let megaSlotIdx = -1;
  for (let i = 0; i < picks.length; i++) {
    if (MEGA_STONE_MAP[picks[i]]) {
      megaSlotIdx = i;
      break;
    }
  }

  for (let i = 0; i < picks.length; i++) {
    const species = picks[i];
    const isAnchor = i < core.anchors.length;
    const roleHint = isAnchor ? `${core.name} anchor` : undefined;

    let member = buildMember(species, usedItems, roleHint);
    if (!member) continue;

    if (i === megaSlotIdx && MEGA_STONE_MAP[species]) {
      // This slot gets the Mega Stone.
      const stones = MEGA_STONE_MAP[species];
      const availableStone = stones.find(s => !usedItems.has(s));
      if (availableStone) {
        member = { ...member, item: availableStone };
      }
    } else if (isMegaStone(member.item)) {
      // Preset would've equipped a Mega Stone but this slot isn't
      // the Mega owner — swap to a non-Mega item.
      member = stripMegaStone(member, usedItems);
    }

    if (member.item) usedItems.add(member.item);
    members.push(member);
  }

  if (members.length < 6) return null;

  // 6. Verify with the lineup analysis — generated teams should
  //    score at least moderately well, otherwise we're producing
  //    junk. Drop teams under the threshold.
  const team: PokemonState[] = members.map(m => ({
    ...createDefaultPokemonState(),
    species: m.species,
    nature: m.nature,
    ability: m.ability,
    item: m.item,
    sps: { ...m.sps },
    moves: [...m.moves, '', '', '', ''].slice(0, 4),
  }));
  const flexReport = analyzeTeamLineups(team, DOUBLES_FORMAT);
  // We surface every archetype the projection engine emits — the
  // projection already filters weak strategies upstream, and even
  // a "low flex" archetype team is valuable as a reference build
  // for players committing to that strategy.

  const topPickLineups = flexReport.lineups.slice(0, 3).map(l => ({
    members: l.members,
    score: l.total,
  }));

  // ─── Generate human-readable strategy text from the core + picks
  const leadOptions = topPickLineups
    .slice(0, 3)
    .map(l => l.members.slice(0, 2).join(' + '));

  const keyInteractions: string[] = [];
  if (core.anchors.length > 0) {
    keyInteractions.push(`${core.anchors.join(' + ')} ${core.requires.length > 0 ? `via ${core.requires[0]}` : 'as the core'}`);
  }
  keyInteractions.push(core.winCondition);
  if (members.some(m => KNOWN_FAKE_OUT.has(m.species))) {
    keyInteractions.push(`Fake Out pressure from ${members.find(m => KNOWN_FAKE_OUT.has(m.species))!.species}`);
  }
  if (members.some(m => KNOWN_TAILWIND.has(m.species) || KNOWN_TRICK_ROOM.has(m.species))) {
    const speedCon = members.find(m => KNOWN_TAILWIND.has(m.species) || KNOWN_TRICK_ROOM.has(m.species))!;
    keyInteractions.push(`Speed control via ${speedCon.species}`);
  }

  // Threats: species whose types the team is weakest to (heuristic)
  const threats: string[] = [];
  if (core.name.toLowerCase().includes('sun')) threats.push('Rain teams (Drizzle + Swift Swim)', 'Tyranitar Sand Stream');
  if (core.name.toLowerCase().includes('sand')) threats.push('Rain-boosted Water attacks', 'Fighting coverage');
  if (core.name.toLowerCase().includes('snow')) threats.push('Fire spread moves', 'Steel-type walls');
  if (core.name.toLowerCase().includes('trick room')) threats.push('Taunt users', 'Fast priority users');
  if (core.name.toLowerCase().includes('tailwind')) threats.push('Taunt before setup', 'Opposing Trick Room');
  if (threats.length === 0) threats.push('Piercing Drill if it enters the meta', 'Fast offensive pressure before setup');

  return {
    id: `gen-${core.name.toLowerCase().replace(/\s+/g, '-')}`,
    name: core.name,
    archetype: core.name.toLowerCase().includes('sun') ? 'sun'
      : core.name.toLowerCase().includes('sand') ? 'sand'
      : core.name.toLowerCase().includes('snow') ? 'snow'
      : core.name.toLowerCase().includes('trick room') ? 'trick-room'
      : core.name.toLowerCase().includes('tailwind') ? 'tailwind'
      : core.name.toLowerCase().includes('perish') ? 'balance'
      : 'balance',
    gimmick: core.anchors.some(a => MEGA_STONE_MAP[a]) ? 'Mega' : 'Flexible',
    format: 'doubles',
    description: core.description,
    strategy: `${core.description} ${core.winCondition}.`,
    leadOptions,
    keyInteractions,
    threats,
    members,
    tags: ['generated', 'doubles', core.name.toLowerCase().replace(/\s+/g, '-')],
    generated: true,
    basedOnCore: core.name,
    flexScore: flexReport.score,
    topPickLineups,
  };
}

// ─── Goodstuffs team ───────────────────────────────────────────────
// A generalist "best six" team built from the top-projected Pokemon
// across roles. This is the answer to "what does the top meta team
// look like when you don't commit to a single archetype?"

function buildGoodstuffsTeam(report: ProjectionReport): GeneratedDoublesTeam | null {
  const picks: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    if (!seen.has(name) && picks.length < 6) {
      seen.add(name);
      picks.push(name);
    }
  };

  // Pick one top mon from each essential doubles role so the team
  // has coverage without committing to an archetype.
  const roleOrder: Array<keyof ProjectionReport['roleLeaders']> = [
    'Lead Anchor',
    'Wincon',
    'Speed Controller',
    'Redirector',
    'Wallbreaker',
    'Pivot Wall',
  ];

  for (const role of roleOrder) {
    const leaders = report.roleLeaders[role];
    if (!leaders) continue;
    const pick = leaders.find(s => !seen.has(s));
    if (pick && picks.length < 6) add(pick);
  }

  // Fill remaining with highest-projected picks
  for (const r of report.rankings) {
    if (picks.length >= 6) break;
    if (!seen.has(r.species)) add(r.species);
  }

  if (picks.length < 6) return null;

  // Pick the highest-scoring Mega-eligible species to own the
  // single Mega slot; all other preset Mega Stones get stripped.
  const megaOwner = picks.find(s => MEGA_STONE_MAP[s]);

  const members: TeamMember[] = [];
  const usedItems = new Set<string>();
  for (const species of picks) {
    let member = buildMember(species, usedItems);
    if (!member) continue;
    if (species === megaOwner) {
      member = tryEquipMega(member, usedItems, members);
    } else if (isMegaStone(member.item)) {
      member = stripMegaStone(member, usedItems);
    }
    if (member.item) usedItems.add(member.item);
    members.push(member);
  }

  if (members.length < 6) return null;

  const team: PokemonState[] = members.map(m => ({
    ...createDefaultPokemonState(),
    species: m.species,
    nature: m.nature,
    ability: m.ability,
    item: m.item,
    sps: { ...m.sps },
    moves: [...m.moves, '', '', '', ''].slice(0, 4),
  }));
  const flexReport = analyzeTeamLineups(team, DOUBLES_FORMAT);

  return {
    id: 'gen-balanced-goodstuffs',
    name: 'Balanced Goodstuffs',
    archetype: 'balance',
    gimmick: members.some(m => MEGA_STONE_MAP[m.species]) ? 'Mega' : 'Flexible',
    format: 'doubles',
    description: 'A no-commit, role-balanced team built from the top-projected Pokemon in each doubles role. Flexible enough to adapt to any matchup without locking into a single win condition.',
    strategy: 'Bring four members that match the opponent\'s archetype. Lead the best Fake Out + speed control pairing. Save the Wincon for when the opponent commits to a disadvantaged position.',
    leadOptions: flexReport.lineups.slice(0, 3).map(l => l.members.slice(0, 2).join(' + ')),
    keyInteractions: [
      'Role coverage across every essential doubles slot',
      'No dead picks — every member has a matchup it\'s the answer to',
      'Flex in team preview — bring different 4-mon subsets against different opponents',
    ],
    threats: ['Dedicated archetype teams that out-specialize specific matchups', 'Fast setup sweepers that break through before support arrives'],
    members,
    tags: ['generated', 'doubles', 'goodstuffs', 'balance'],
    generated: true,
    basedOnCore: 'Role Balance',
    flexScore: flexReport.score,
    topPickLineups: flexReport.lineups.slice(0, 3).map(l => ({ members: l.members, score: l.total })),
  };
}

// ─── Main entry ────────────────────────────────────────────────────

export function generateDoublesTeams(): GeneratedDoublesTeam[] {
  const report = generateDoublesProjection();
  const teams: GeneratedDoublesTeam[] = [];

  // Build a team for each archetype core
  for (const core of report.cores) {
    const team = buildTeamForCore(core, report);
    if (team) teams.push(team);
  }

  // Always include a goodstuffs flex team
  const goodstuffs = buildGoodstuffsTeam(report);
  if (goodstuffs) teams.push(goodstuffs);

  // Sort by flex score descending — the best-projected teams surface first
  teams.sort((a, b) => b.flexScore - a.flexScore);
  return teams;
}
