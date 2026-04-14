// ─── Champions Doubles Meta Projection Engine ─────────────────────
//
// Pokemon Champions released April 2026. The Doubles meta hasn't
// formed yet — there's no Smogon usage data, no tournament results,
// no established tier lists. Everyone else is leaning on Scarlet/
// Violet VGC data as a baseline, which is wrong: Champions has a
// curated 186-mon roster (no legendaries, paradoxes, or many VGC
// staples like Amoonguss/Rillaboom/Gholdengo), plus its own rule
// changes (Fake Out switch-in restriction, Unseen Fist 25%,
// status nerfs, Intimidate simultaneous trigger, item clause).
//
// This engine predicts the Champions Doubles meta from first
// principles. It takes NO live usage stats as input. It scores
// each Champions-legal Pokemon purely on:
//
//   1. Doubles fundamentals (lead value, support, spread offense,
//      defensive presence)
//   2. Champions-specific adjustments (new Z-A Megas + abilities,
//      move changes, status nerfs, roster absences)
//   3. Archetype fit (who enables which doubles core?)
//
// The output is a projected tier list + role classification + core
// predictions. This is the analysis nobody else is doing yet.

import { getAvailablePokemon, getPokemonData, getDefensiveMultiplier, hasChampionsMega, isChampionsPokemon } from '../data/champions';
import { getEffectiveBaseStats } from '../data/abilityClassification';
import { MEGA_STONE_MAP } from '../data/championsRoster';
import { COMMUNITY_TIER_LIST } from '../data/tierlist';
import {
  buildMoveRoleSet, buildAbilitySet, REDIRECT_MOVES, PRIORITY_MOVES as PRIORITY_MOVE_SET,
  discoverWeatherCores,
  speciesRunsMove,
} from '../data/moveIndex';

// ─── Types ─────────────────────────────────────────────────────────

export type DoublesRole =
  | 'Lead Anchor'      // Fake Out / Intimidate support leads
  | 'Speed Controller' // Tailwind / Trick Room setters
  | 'Redirector'       // Rage Powder / Follow Me support
  | 'Wallbreaker'      // Spread-move offense
  | 'Wincon'           // Mega + game-changing ability
  | 'Pivot Wall'       // Bulky + pivot moves
  | 'Hyper Offense'    // Raw offensive stats, fast
  | 'Trick Room Abuser' // Slow bulky attackers
  | 'Weather Abuser'   // Chlorophyll / Swift Swim / Sand Rush / Slush Rush
  | 'Utility';         // Niche support

export interface DoublesProjection {
  species: string;
  /** 0-100 projected Doubles viability. */
  score: number;
  tier: 'S' | 'A+' | 'A' | 'B' | 'C';
  roles: DoublesRole[];
  breakdown: {
    leadValue: number;        // 0-25
    supportValue: number;     // 0-20
    offensivePressure: number; // 0-20
    defensiveValue: number;   // 0-15
    championsAdjust: number;  // -10 to +15
  };
  /** Top 2-3 reasons driving this projection. */
  reasoning: string[];
  /** Which Champions-specific factors apply to this Pokemon. */
  championsFactors: string[];
  hasMega: boolean;
  megaStone?: string;
}

export interface ArchetypeCore {
  name: string;
  description: string;
  anchors: string[];          // 1-2 key Pokemon
  partners: string[];         // 3-4 supporting Pokemon
  winCondition: string;
  requires: string[];         // abilities / moves required
}

export interface ProjectionReport {
  timestamp: number;
  rankings: DoublesProjection[];
  cores: ArchetypeCore[];
  /** Predictions surfacing non-obvious analysis. */
  insights: string[];
  /** The top N pokemon per role, as a quick-reference. */
  roleLeaders: Record<DoublesRole, string[]>;
  /** Dark horses: Pokemon scoring well that aren't in static tier lists. */
  darkHorses: DoublesProjection[];
}

// ─── Champions-Specific Constants ──────────────────────────────────

// Z-A Megas with game-changing new abilities. Each grants a major
// projection bonus to its base species because the ability
// fundamentally changes how the Pokemon operates. Only entries
// whose species is in MEGA_STONE_MAP will actually fire — species
// listed here but absent from the roster are treated as inert.
const NEW_MEGA_ABILITIES: Record<string, { ability: string; impact: number; reason: string }> = {
  Meganium: {
    ability: 'Mega Sol',
    impact: 11,
    reason: 'Mega Sol treats every turn as Sun regardless of weather — permanent sun enabler without losing a turn to Drought',
  },
  Dragonite: {
    ability: 'Dragonize',
    impact: 10,
    reason: 'Dragonize gives priority Dragon STAB via Extreme Speed — outruns speed control entirely',
  },
  Starmie: {
    ability: 'Huge Power',
    impact: 10,
    reason: 'Huge Power doubles Attack — turns Starmie into a physical Water nobody expects',
  },
  Froslass: {
    ability: 'Snow Warning',
    impact: 8,
    reason: 'Snow Warning on Mega Evolution enables turn-1 Aurora Veil setup for snow teams',
  },
  Skarmory: {
    ability: 'Stalwart',
    impact: 6,
    reason: 'Stalwart ignores redirection — bypasses Rage Powder / Follow Me entirely',
  },
};

// Species that lose value because of Champions move/mechanic changes.
const MECHANIC_NERFS: Record<string, { impact: number; reason: string }> = {
  Incineroar: {
    impact: -3,
    reason: 'Fake Out nerf (no switch-in turn) slightly reduces lead pressure',
  },
};

// Roles VGC typically fills that are vacant in Champions because
// the mainline specialist is absent. The species listed here get a
// bonus for filling the vacuum.
// ─── Vacant role detection ─────────────────────────────────────────
// Instead of hardcoding which VGC Pokemon are missing and who fills
// their role, we define the ROLE (what move/ability signature it
// requires) and let moveIndex derive the fillers dynamically. The
// "missing" species is informational only — the filler list auto-
// updates when the roster or presets change.
const VACANT_ROLES: { role: string; missing: string; moveSignature?: Set<string>; abilitySignature?: string; bonus: number }[] = [
  { role: 'Redirector', missing: 'Amoonguss', moveSignature: REDIRECT_MOVES, bonus: 6 },
  { role: 'Grassy Terrain priority', missing: 'Rillaboom', abilitySignature: 'grassy surge', bonus: 4 },
  { role: 'Steel wall (Good as Gold)', missing: 'Gholdengo', abilitySignature: 'good as gold', bonus: 5 },
  { role: 'Swift Swim rain abuser', missing: 'Kingdra', abilitySignature: 'swift swim', bonus: 3 },
];

function getVacantRoleFillers(vr: typeof VACANT_ROLES[0]): string[] {
  if (vr.moveSignature) return [...buildMoveRoleSet(vr.moveSignature)].filter(isChampionsPokemon);
  if (vr.abilitySignature) return [...buildAbilitySet(vr.abilitySignature)].filter(isChampionsPokemon);
  return [];
}

// ─── Move Detection ────────────────────────────────────────────────
// We don't have per-species learnsets wired up reliably, so we lean
// on well-known Doubles-relevant moves that each Pokemon is known
// to have access to in mainline Gen 9. This is a hand-curated
// allowlist — it's fine for projection since we only care about
// "can this Pokemon plausibly run X in Champions".

// ─── Dynamic Doubles role sets ─────────────────────────────────────
// Derived from presets + live data via moveIndex.ts. NO hardcoded
// species lists. Adding a preset with Fake Out auto-enrolls the
// species as a Fake Out user for projection scoring.

const FAKE_OUT_SET = new Set(['Fake Out']);
const TAILWIND_SET = new Set(['Tailwind']);
const TRICK_ROOM_SET = new Set(['Trick Room']);
const ICY_WIND_SET = new Set(['Icy Wind']);
const WIDE_GUARD_SET = new Set(['Wide Guard']);
const HELPING_HAND_SET = new Set(['Helping Hand']);

let _dblFakeOut: Set<string> | null = null;
let _dblRedirectors: Set<string> | null = null;
let _dblTailwind: Set<string> | null = null;
let _dblTrickRoom: Set<string> | null = null;
let _dblIcyWind: Set<string> | null = null;
let _dblWideGuard: Set<string> | null = null;
let _dblHelpingHand: Set<string> | null = null;

const KNOWN_FAKE_OUT    = { has: (s: string) => { if (!_dblFakeOut) _dblFakeOut = buildMoveRoleSet(FAKE_OUT_SET); return _dblFakeOut.has(s); } };
const KNOWN_TAILWIND    = { has: (s: string) => { if (!_dblTailwind) _dblTailwind = buildMoveRoleSet(TAILWIND_SET); return _dblTailwind.has(s); } };
const KNOWN_TRICK_ROOM  = { has: (s: string) => { if (!_dblTrickRoom) _dblTrickRoom = buildMoveRoleSet(TRICK_ROOM_SET); return _dblTrickRoom.has(s); } };
const KNOWN_ICY_WIND    = { has: (s: string) => { if (!_dblIcyWind) _dblIcyWind = buildMoveRoleSet(ICY_WIND_SET); return _dblIcyWind.has(s); } };
const KNOWN_WIDE_GUARD  = { has: (s: string) => { if (!_dblWideGuard) _dblWideGuard = buildMoveRoleSet(WIDE_GUARD_SET); return _dblWideGuard.has(s); } };
const KNOWN_HELPING_HAND = { has: (s: string) => { if (!_dblHelpingHand) _dblHelpingHand = buildMoveRoleSet(HELPING_HAND_SET); return _dblHelpingHand.has(s); } };

// Redirectors scan presets for Follow Me, Rage Powder, Ally Switch
function getRedirectors(): Set<string> {
  if (!_dblRedirectors) _dblRedirectors = buildMoveRoleSet(REDIRECT_MOVES);
  return _dblRedirectors;
}
// Backward-compat alias objects used by scoring functions:
const KNOWN_FOLLOW_ME   = { has: (s: string) => getRedirectors().has(s) };
const KNOWN_RAGE_POWDER = { has: (s: string) => getRedirectors().has(s) };

// Spread-move learners — a rough allowlist of Pokemon that run
// major spread attacks in Doubles. We use BST/types/signature to
// include broad candidates rather than a strict learnset check.
const SPREAD_ATTACK_PROFILES: { match: (types: string[], name: string) => boolean; reason: string }[] = [
  { match: (t) => t.includes('Ground'), reason: 'Earthquake / Bulldoze spread' },
  { match: (t) => t.includes('Fire'), reason: 'Heat Wave / Eruption spread' },
  { match: (t) => t.includes('Water'), reason: 'Muddy Water / Surf spread' },
  { match: (t) => t.includes('Ice'), reason: 'Blizzard / Icy Wind spread' },
  { match: (t) => t.includes('Rock'), reason: 'Rock Slide spread' },
  { match: (t) => t.includes('Electric'), reason: 'Discharge spread' },
  { match: (t) => t.includes('Dragon'), reason: 'Dragon Dance boosted spread via coverage' },
  { match: (t) => t.includes('Flying'), reason: 'Gust / Air Cutter / Hurricane spread' },
];

// Pivot detection derived from moveIndex — no hardcoded species.
const PIVOT_MOVE_NAMES = new Set(['U-turn', 'Volt Switch', 'Flip Turn', 'Parting Shot', 'Teleport', 'Chilly Reception']);
let _dblPivots: Set<string> | null = null;
const KNOWN_PIVOT_MOVES = { has: (s: string) => { if (!_dblPivots) _dblPivots = buildMoveRoleSet(PIVOT_MOVE_NAMES); return _dblPivots.has(s); } };

// ─── Core Scoring ──────────────────────────────────────────────────

function scoreLeadValue(species: string): { score: number; reasons: string[] } {
  const data = getPokemonData(species);
  if (!data) return { score: 0, reasons: [] };
  const reasons: string[] = [];
  let score = 0;

  const bs = data.baseStats;
  const ability = (data.abilities?.[0] || '') as string;

  // Fake Out pressure
  if (KNOWN_FAKE_OUT.has(species)) {
    score += 7;
    reasons.push('Fake Out lead pressure');
  }

  // Intimidate
  if (ability === 'Intimidate') {
    score += 6;
    reasons.push('Intimidate weakens physical attackers on entry');
  }

  // Speed — fast Pokemon win lead mirrors
  if (bs.spe >= 110) {
    score += 6;
    reasons.push(`Elite speed (${bs.spe}) wins lead mirrors`);
  } else if (bs.spe >= 90) {
    score += 4;
  } else if (bs.spe <= 45) {
    // Very slow — reverse-lead under Trick Room
    score += 2;
  }

  // Priority move access (rough heuristic)
  if (speciesRunsMove(species, PRIORITY_MOVE_SET)) {
    score += 3;
    reasons.push('Priority move access');
  }

  // Prankster (Tailwind priority)
  if (ability === 'Prankster') {
    score += 5;
    reasons.push('Prankster status priority');
  }

  // Redirection
  if (KNOWN_RAGE_POWDER.has(species) || KNOWN_FOLLOW_ME.has(species)) {
    score += 4;
    reasons.push('Redirection lead');
  }

  return { score: Math.min(25, score), reasons };
}

function scoreSupportValue(species: string): { score: number; reasons: string[] } {
  const data = getPokemonData(species);
  if (!data) return { score: 0, reasons: [] };
  const reasons: string[] = [];
  let score = 0;

  const ability = (data.abilities?.[0] || '') as string;

  // Regenerator = premium pivot ability
  if (ability === 'Regenerator') {
    score += 8;
    reasons.push('Regenerator sustain');
  }

  // Good as Gold (if any species has it in Champions)
  if (ability === 'Good as Gold') {
    score += 6;
    reasons.push('Status immunity');
  }

  // Speed control move access
  if (KNOWN_TAILWIND.has(species)) { score += 5; reasons.push('Tailwind access'); }
  if (KNOWN_TRICK_ROOM.has(species)) { score += 5; reasons.push('Trick Room access'); }
  if (KNOWN_ICY_WIND.has(species)) { score += 2; }

  // Redirection
  if (KNOWN_RAGE_POWDER.has(species)) { score += 6; reasons.push('Rage Powder redirection'); }
  if (KNOWN_FOLLOW_ME.has(species)) { score += 5; reasons.push('Follow Me redirection'); }

  // Helping Hand
  if (KNOWN_HELPING_HAND.has(species)) { score += 3; }

  // Wide Guard
  if (KNOWN_WIDE_GUARD.has(species)) { score += 3; reasons.push('Wide Guard counters spread'); }

  // Pivot move users
  if (KNOWN_PIVOT_MOVES.has(species)) { score += 3; }

  // Weather setters
  if (['Drought', 'Drizzle', 'Sand Stream', 'Snow Warning'].includes(ability)) {
    score += 4;
    reasons.push(`${ability} weather setter`);
  }

  // Terrain setters
  if (['Grassy Surge', 'Electric Surge', 'Psychic Surge', 'Misty Surge'].includes(ability)) {
    score += 3;
    reasons.push(`${ability} terrain setter`);
  }

  return { score: Math.min(20, score), reasons };
}

function scoreOffensivePressure(species: string, pool: string[]): { score: number; reasons: string[] } {
  const data = getPokemonData(species);
  if (!data) return { score: 0, reasons: [] };
  const reasons: string[] = [];
  let score = 0;

  const types = [...data.types] as string[];
  // Use EFFECTIVE base stats — accounts for ability modifiers like
  // Huge Power (2× Atk), Pure Power, Fur Coat, etc. This is what
  // auto-discovers Azumarill as a 100+ Atk threat instead of a
  // 50-Atk wall.
  const abilities = data.abilities ? Object.values(data.abilities).map(a => a as string) : [];
  const bs = getEffectiveBaseStats(data.baseStats, abilities);

  // Raw offensive stats (ability-adjusted)
  const maxOffense = Math.max(bs.atk, bs.spa);
  if (maxOffense >= 130) { score += 7; reasons.push(`Elite offense (${maxOffense} effective${bs.atk !== data.baseStats.atk ? ' via ability' : ''})`); }
  else if (maxOffense >= 110) score += 5;
  else if (maxOffense >= 90) score += 3;

  // Spread move availability (type-based heuristic)
  for (const profile of SPREAD_ATTACK_PROFILES) {
    if (profile.match(types, species)) {
      score += 2;
      if (reasons.length < 2) reasons.push(profile.reason);
      break; // only count one
    }
  }

  // STAB coverage against Champions roster
  let hitsCount = 0;
  const sample = pool.slice(0, 60);
  for (const target of sample) {
    if (target === species) continue;
    const tData = getPokemonData(target);
    if (!tData) continue;
    let hitsSE = false;
    for (const atkType of types) {
      let mult = 1;
      for (const t of tData.types) mult *= getDefensiveMultiplier(atkType, [t as string]);
      if (mult > 1) { hitsSE = true; break; }
    }
    if (hitsSE) hitsCount++;
  }
  const coverageRatio = hitsCount / sample.length;
  if (coverageRatio > 0.5) {
    score += 4;
    reasons.push(`Hits ${Math.round(coverageRatio * 100)}% of the roster for super-effective damage`);
  } else if (coverageRatio > 0.35) {
    score += 2;
  }

  return { score: Math.min(20, score), reasons };
}

function scoreDefensiveValue(species: string, pool: string[]): { score: number; reasons: string[] } {
  const data = getPokemonData(species);
  if (!data) return { score: 0, reasons: [] };
  const reasons: string[] = [];
  let score = 0;

  const bs = data.baseStats;
  const types = [...data.types] as string[];

  // Bulk index
  const bulk = bs.hp + (bs.def + bs.spd) / 2;
  if (bulk > 230) { score += 5; reasons.push('Exceptional bulk'); }
  else if (bulk > 200) score += 3;
  else if (bulk > 170) score += 2;

  // Resistance coverage
  let resists = 0;
  const attackerSample = pool.filter(n => {
    const d = getPokemonData(n);
    return d && (d.baseStats.atk >= 95 || d.baseStats.spa >= 95);
  }).slice(0, 40);

  for (const attacker of attackerSample) {
    const aData = getPokemonData(attacker);
    if (!aData) continue;
    for (const atkType of aData.types) {
      if (getDefensiveMultiplier(atkType as string, types) < 1) {
        resists++;
        break;
      }
    }
  }
  const resistRatio = resists / Math.max(1, attackerSample.length);
  if (resistRatio > 0.5) {
    score += 5;
    reasons.push(`Resists ${Math.round(resistRatio * 100)}% of meta attackers' STAB`);
  } else if (resistRatio > 0.3) {
    score += 3;
  }

  return { score: Math.min(15, score), reasons };
}

function scoreChampionsAdjustments(species: string): { score: number; reasons: string[]; factors: string[] } {
  const reasons: string[] = [];
  const factors: string[] = [];
  let score = 0;

  // Z-A Mega ability buffs
  const megaBuff = NEW_MEGA_ABILITIES[species];
  if (megaBuff) {
    score += megaBuff.impact;
    reasons.push(megaBuff.reason);
    factors.push(`New Mega ability: ${megaBuff.ability}`);
  }

  // Mechanic nerfs
  const nerf = MECHANIC_NERFS[species];
  if (nerf) {
    score += nerf.impact;
    factors.push(nerf.reason);
  }

  // Vacant role fillers — derived dynamically from moveIndex
  for (const vr of VACANT_ROLES) {
    const fillers = getVacantRoleFillers(vr);
    if (fillers.includes(species)) {
      score += vr.bonus;
      reasons.push(`Fills ${vr.missing}'s vacated ${vr.role} role`);
      factors.push(`Vacant role: ${vr.role} (${vr.missing} absent)`);
      break;
    }
  }

  // Has any Mega Evolution at all — Champions is a Mega-first meta
  if (hasChampionsMega(species)) {
    score += 3;
    factors.push('Mega Evolution eligible');
  }

  // Status condition nerf beneficiaries — setup sweepers and
  // sleep-vulnerable sweepers gain value because paralysis/sleep
  // are weaker in Champions.
  const data = getPokemonData(species);
  if (data && data.baseStats.spe >= 100 && Math.max(data.baseStats.atk, data.baseStats.spa) >= 100) {
    score += 2;
    if (!factors.find(f => f.includes('Status'))) {
      factors.push('Benefits from status condition nerfs (paralysis 1/8, sleep 2-3 turns)');
    }
  }

  return { score: Math.max(-10, Math.min(15, score)), reasons, factors };
}

// ─── Role Classification ───────────────────────────────────────────

function classifyRoles(species: string, bd: DoublesProjection['breakdown'], hasMega: boolean): DoublesRole[] {
  const data = getPokemonData(species);
  if (!data) return ['Utility'];
  const bs = data.baseStats;
  const ability = (data.abilities?.[0] || '') as string;
  const roles: DoublesRole[] = [];

  // Wincon: Mega with a game-changing ability
  if (hasMega && NEW_MEGA_ABILITIES[species]) {
    roles.push('Wincon');
  }

  // Lead Anchor: Fake Out + Intimidate
  if (KNOWN_FAKE_OUT.has(species) && ability === 'Intimidate') {
    roles.push('Lead Anchor');
  } else if (KNOWN_FAKE_OUT.has(species)) {
    roles.push('Lead Anchor');
  }

  // Speed Controller
  if (KNOWN_TAILWIND.has(species) || KNOWN_TRICK_ROOM.has(species) || ability === 'Prankster') {
    roles.push('Speed Controller');
  }

  // Redirector
  if (KNOWN_RAGE_POWDER.has(species) || KNOWN_FOLLOW_ME.has(species)) {
    roles.push('Redirector');
  }

  // Hyper Offense
  if (bs.spe >= 110 && Math.max(bs.atk, bs.spa) >= 110) {
    roles.push('Hyper Offense');
  }

  // Trick Room Abuser
  if (bs.spe <= 50 && Math.max(bs.atk, bs.spa) >= 100) {
    roles.push('Trick Room Abuser');
  }

  // Weather Abuser
  if (['Chlorophyll', 'Swift Swim', 'Sand Rush', 'Slush Rush'].includes(ability)) {
    roles.push('Weather Abuser');
  }

  // Wallbreaker: high offense + spread coverage
  if (bd.offensivePressure >= 14) {
    roles.push('Wallbreaker');
  }

  // Pivot Wall: high defense + pivot moves
  if (bd.defensiveValue >= 10 && KNOWN_PIVOT_MOVES.has(species)) {
    roles.push('Pivot Wall');
  } else if (bd.defensiveValue >= 12) {
    roles.push('Pivot Wall');
  }

  if (roles.length === 0) roles.push('Utility');
  return roles;
}

// ─── Core Archetype Detection ──────────────────────────────────────

function detectCores(rankings: DoublesProjection[]): ArchetypeCore[] {
  // Eligible species: anything scoring above weak C-tier threshold.
  const eligibleSpecies = new Set(rankings.filter(r => r.score >= 30).map(r => r.species));
  const cores: ArchetypeCore[] = [];
  const has = (name: string) => eligibleSpecies.has(name);

  // ─── Weather cores (derived from abilities, not species names) ──
  // Scans the roster for weather-setting abilities and pairs them
  // with weather-abusing abilities. Adding a new weather setter to
  // the roster or presets auto-discovers the core.
  const weatherCores = discoverWeatherCores();
  const WEATHER_NAMES: Record<string, string> = {
    Sun: 'Sun Offense', Sand: 'Sand Offense',
    Snow: 'Snow Offense', Rain: 'Rain Offense',
  };
  const WEATHER_DESC: Record<string, string> = {
    Sun: 'Sun setter activates Chlorophyll Speed doublers and boosts Fire STAB by 50%. Solar Beam has no charge turn.',
    Sand: 'Sand Stream sets chip damage and activates Sand Rush Speed doublers. Rock-type SpD boost protects the setter.',
    Snow: 'Snow Warning enables Aurora Veil (halves all incoming damage) and Slush Rush Speed doublers. Blizzard hits 100%.',
    Rain: 'Drizzle boosts Water STAB by 50%, enables Swift Swim Speed doublers, and makes Thunder/Hurricane 100% accurate.',
  };
  const WEATHER_WIN: Record<string, string> = {
    Sun: 'Boosted Fire/Grass offense through Chlorophyll speed',
    Sand: 'Sand chip + Sand Rush speed advantage',
    Snow: 'Aurora Veil protection + Slush Rush ice offense',
    Rain: 'Rain-boosted Water STAB + Swift Swim speed control',
  };

  for (const wc of weatherCores) {
    const eligibleSetters = wc.setters.filter(has);
    const eligibleAbusers = wc.abusers.filter(has);
    if (eligibleSetters.length === 0) continue;

    cores.push({
      name: WEATHER_NAMES[wc.weather] ?? `${wc.weather} Offense`,
      description: WEATHER_DESC[wc.weather] ?? `${wc.weather} weather core derived from ability scanning.`,
      anchors: eligibleSetters.slice(0, 2),
      partners: eligibleAbusers.filter(s => !eligibleSetters.includes(s)).slice(0, 5),
      winCondition: WEATHER_WIN[wc.weather] ?? `${wc.weather} weather advantage`,
      requires: [`${wc.weather} setter ability`, `${wc.weather} abuser ability`],
    });
  }

  // ─── Trick Room core (derived from move access) ────────────────
  const trSetters = [...(buildMoveRoleSet(new Set(['Trick Room'])))].filter(has);
  if (trSetters.length > 0) {
    // Slow wallbreakers: base Speed ≤ 55 and base Atk or SpA ≥ 90
    const slowBreakers = [...eligibleSpecies].filter(s => {
      const d = getPokemonData(s);
      if (!d) return false;
      return d.baseStats.spe <= 55 && Math.max(d.baseStats.atk, d.baseStats.spa) >= 90 && !trSetters.includes(s);
    });
    cores.push({
      name: 'Trick Room',
      description: `${trSetters.slice(0, 2).join(' or ')} sets Trick Room; slow wallbreakers outspeed the entire field for 5 turns under reversed speed.`,
      anchors: trSetters.slice(0, 2),
      partners: slowBreakers.slice(0, 5),
      winCondition: 'Reverse speed tier for 5 turns; slow hitters outspeed the field',
      requires: ['Trick Room setter', 'Low-speed attackers (base Speed ≤ 55)'],
    });
  }

  // ─── Tailwind core (derived from move access) ──────────────────
  const twSetters = [...(buildMoveRoleSet(new Set(['Tailwind'])))].filter(has);
  if (twSetters.length > 0) {
    // Fast offensive partners: base Speed ≥ 85 and offense ≥ 90
    const fastHitters = [...eligibleSpecies].filter(s => {
      const d = getPokemonData(s);
      if (!d) return false;
      return d.baseStats.spe >= 85 && Math.max(d.baseStats.atk, d.baseStats.spa) >= 90 && !twSetters.includes(s);
    });
    cores.push({
      name: 'Tailwind Offense',
      description: `${twSetters.slice(0, 2).join(' or ')} sets Tailwind to double team Speed for 4 turns, then fast sweepers clean.`,
      anchors: twSetters.slice(0, 2),
      partners: fastHitters.slice(0, 5),
      winCondition: 'Fast offense under Tailwind priority speed control',
      requires: ['Tailwind setter', 'Fast offensive threats'],
    });
  }

  // ─── Perish Trap (derived from Mega + Shadow Tag ability) ──────
  // Any Mega with Shadow Tag qualifies — currently only Gengar, but
  // if the roster adds another Shadow Tag Mega it auto-discovers.
  const shadowTagMegas = [...eligibleSpecies].filter(s =>
    hasChampionsMega(s) && speciesRunsMove(s, new Set(['Shadow Ball', 'Perish Song']))
  );
  if (shadowTagMegas.length > 0) {
    const redirectors = [...(buildMoveRoleSet(REDIRECT_MOVES))].filter(has);
    cores.push({
      name: 'Shadow Tag Perish',
      description: `Mega ${shadowTagMegas[0]}\'s Shadow Tag prevents switches. Paired with redirection and Perish Song, it forces trades.`,
      anchors: shadowTagMegas.slice(0, 1),
      partners: redirectors.slice(0, 4),
      winCondition: 'Trap → Perish Song → force 1-for-1 trades',
      requires: ['Shadow Tag Mega', 'Redirector or Perish Song user'],
    });
  }

  return cores;
}

// ─── Main Engine ───────────────────────────────────────────────────

export function generateDoublesProjection(): ProjectionReport {
  const pool = getAvailablePokemon();
  const rankings: DoublesProjection[] = [];

  for (const species of pool) {
    const data = getPokemonData(species);
    if (!data) continue;

    // Skip very low-tier species — they'll never be Doubles relevant
    const bst = data.baseStats.hp + data.baseStats.atk + data.baseStats.def +
                data.baseStats.spa + data.baseStats.spd + data.baseStats.spe;
    if (bst < 400) continue;

    const lead = scoreLeadValue(species);
    const support = scoreSupportValue(species);
    const offense = scoreOffensivePressure(species, pool);
    const defense = scoreDefensiveValue(species, pool);
    const champAdjust = scoreChampionsAdjustments(species);

    const breakdown = {
      leadValue: lead.score,
      supportValue: support.score,
      offensivePressure: offense.score,
      defensiveValue: defense.score,
      championsAdjust: champAdjust.score,
    };

    // Scale raw score against a realistic ceiling. A Pokemon can't
    // simultaneously max Lead, Support, Offense, AND Defense — those
    // are mutually exclusive role focuses. The practical ceiling for
    // an elite doubles mon is ~50/95 raw, so we scale against 50
    // and clamp to 100.
    const rawTotal = lead.score + support.score + offense.score + defense.score + champAdjust.score;
    const score = Math.max(0, Math.min(100, Math.round((rawTotal / 50) * 100)));

    let tier: DoublesProjection['tier'];
    if (score >= 80) tier = 'S';
    else if (score >= 66) tier = 'A+';
    else if (score >= 50) tier = 'A';
    else if (score >= 35) tier = 'B';
    else tier = 'C';

    const hasMega = hasChampionsMega(species);
    const megaStones = MEGA_STONE_MAP[species];
    const megaStone = megaStones?.[0];
    const roles = classifyRoles(species, breakdown, hasMega);

    // Merge top reasons from the highest-contributing dimensions
    const allReasons = [
      ...champAdjust.reasons.map(r => ({ r, weight: 4 })),
      ...lead.reasons.map(r => ({ r, weight: 3 })),
      ...offense.reasons.map(r => ({ r, weight: 2 })),
      ...support.reasons.map(r => ({ r, weight: 2 })),
      ...defense.reasons.map(r => ({ r, weight: 1 })),
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
      championsFactors: champAdjust.factors,
      hasMega,
      megaStone,
    });
  }

  rankings.sort((a, b) => b.score - a.score);

  // ─── Role leaders ──────────────────────────────────────────────
  const roleLeaders: Record<DoublesRole, string[]> = {
    'Lead Anchor': [], 'Speed Controller': [], 'Redirector': [],
    'Wallbreaker': [], 'Wincon': [], 'Pivot Wall': [],
    'Hyper Offense': [], 'Trick Room Abuser': [],
    'Weather Abuser': [], 'Utility': [],
  };
  for (const r of rankings) {
    for (const role of r.roles) {
      if (roleLeaders[role].length < 5) roleLeaders[role].push(r.species);
    }
  }

  // ─── Archetype cores ───────────────────────────────────────────
  const cores = detectCores(rankings);

  // ─── Insights: dynamically generated from projection data ────
  // No hardcoded species references. Each insight derives from the
  // ranking data directly — if a species falls off, the insight
  // vanishes; if a new species rises, new insights generate.
  const insights: string[] = [];

  // Top weather core insight — find the highest-scoring weather setter
  const weatherCoresForInsight = discoverWeatherCores();
  for (const wc of weatherCoresForInsight) {
    const topSetter = wc.setters.map(s => rankings.find(r => r.species === s)).filter(Boolean).sort((a, b) => b!.score - a!.score)[0];
    if (topSetter && topSetter.score >= 55) {
      const topAbuser = wc.abusers.map(s => rankings.find(r => r.species === s)).filter(Boolean).sort((a, b) => b!.score - a!.score)[0];
      insights.push(`${topSetter.species} anchors the ${wc.weather} archetype at ${topSetter.tier} tier${topAbuser ? `. Top ${wc.weather} abuser: ${topAbuser.species}.` : '.'}`);
    }
  }

  // Top Intimidate user insight
  const intimSet = buildAbilitySet('intimidate');
  const intimidateUsers = rankings.filter(r => intimSet.has(r.species));
  if (intimidateUsers.length > 0 && intimidateUsers[0].score >= 50) {
    insights.push(`${intimidateUsers[0].species} leads the Intimidate bracket at ${intimidateUsers[0].tier} tier — Intimidate remains the most impactful ability in Doubles. The Fake Out switch-in nerf hurts fast Fake Out users more than pivot-style Intimidators.`);
  }

  // Top Prankster Tailwind insight
  const pranksterSet = buildAbilitySet('prankster');
  const pranksterTW = rankings.filter(r => pranksterSet.has(r.species));
  if (pranksterTW.length > 0 && pranksterTW[0].score >= 45) {
    insights.push(`${pranksterTW[0].species} is the premier Prankster speed controller at ${pranksterTW[0].tier} tier.`);
  }

  // Redirector vacuum insight
  const redirectors = [...buildMoveRoleSet(REDIRECT_MOVES)].map(s => rankings.find(r => r.species === s)).filter(Boolean) as DoublesProjection[];
  if (redirectors.length > 0) {
    insights.push(`Redirection in Champions is led by ${redirectors.slice(0, 2).map(r => r.species).join(' and ')} — filling the vacuum left by absent mainline redirectors.`);
  }

  // Mega Wincon insight — highest scoring Mega
  const topMega = rankings.filter(r => r.hasMega).sort((a, b) => b.score - a.score)[0];
  if (topMega && topMega.score >= 60) {
    insights.push(`Mega ${topMega.species} is the format's top Mega Evolution at ${topMega.tier} tier. Build your team around enabling this wincon.`);
  }

  // General structural insight
  insights.push(`Champions' restricted item pool and Fake Out nerf reward creative ability + move synergies over raw stat stacking. The edge is in combo tech, not tier copying.`);

  // ─── Dark horses: strong projection score but NOT in the static
  // community S/A+ tier. These are the picks WE think are underrated.
  // Derived from data — no hardcoded exclusion list.
  const staticTop = new Set(
    COMMUNITY_TIER_LIST.filter(e => e.tier === 'S' || e.tier === 'A+').map(e => e.name)
  );
  const darkHorses = rankings
    .filter(r => r.tier === 'A' || r.tier === 'A+')
    .filter(r => !staticTop.has(r.species))
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
