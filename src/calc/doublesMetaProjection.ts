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

import { getAvailablePokemon, getPokemonData, getDefensiveMultiplier, hasChampionsMega } from '../data/champions';
import { MEGA_STONE_MAP } from '../data/championsRoster';

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
const VACANT_ROLES: { role: string; missing: string; fillers: string[]; bonus: number }[] = [
  {
    role: 'Redirector',
    missing: 'Amoonguss',
    fillers: ['Clefable', 'Togekiss', 'Hatterene'],
    bonus: 6,
  },
  {
    role: 'Grassy Terrain priority',
    missing: 'Rillaboom',
    fillers: ['Meowscarada', 'Sylveon'],
    bonus: 4,
  },
  {
    role: 'Steel wall',
    missing: 'Gholdengo',
    fillers: ['Archaludon', 'Corviknight', 'Aegislash-Shield', 'Kingambit'],
    bonus: 5,
  },
  {
    role: 'Swift Swim rain abuser',
    missing: 'Kingdra',
    fillers: ['Greninja', 'Primarina'],
    bonus: 3,
  },
];

// ─── Move Detection ────────────────────────────────────────────────
// We don't have per-species learnsets wired up reliably, so we lean
// on well-known Doubles-relevant moves that each Pokemon is known
// to have access to in mainline Gen 9. This is a hand-curated
// allowlist — it's fine for projection since we only care about
// "can this Pokemon plausibly run X in Champions".

const KNOWN_FAKE_OUT: Set<string> = new Set([
  'Incineroar', 'Kangaskhan', 'Meowscarada', 'Lopunny', 'Infernape',
  'Lycanroc', 'Weavile', 'Glalie', 'Meowstic', 'Mr. Rime',
  'Pangoro', 'Raichu', 'Persian', 'Purugly', 'Salazzle',
]);

const KNOWN_RAGE_POWDER: Set<string> = new Set([
  // Rage Powder requires Butterfree/Vivillon/Venomoth/Vespiquen etc.
  'Vivillon', 'Volcarona',
]);

const KNOWN_FOLLOW_ME: Set<string> = new Set([
  'Clefable', 'Togekiss', 'Audino', 'Castform',
]);

const KNOWN_TAILWIND: Set<string> = new Set([
  'Whimsicott', 'Talonflame', 'Pelipper', 'Pidgeot', 'Noivern',
  'Corviknight', 'Altaria', 'Dragonite', 'Aerodactyl', 'Gyarados',
  'Staraptor', 'Skarmory',
]);

const KNOWN_TRICK_ROOM: Set<string> = new Set([
  'Hatterene', 'Mimikyu', 'Reuniclus', 'Cofagrigus', 'Polteageist',
  'Runerigus', 'Gourgeist', 'Slowking', 'Slowbro', 'Alcremie',
  'Musharna', 'Porygon2', 'Farigiraf',
]);

const KNOWN_ICY_WIND: Set<string> = new Set([
  'Weavile', 'Mamoswine', 'Abomasnow', 'Glaceon', 'Beartic',
  'Avalugg', 'Vanilluxe', 'Delibird', 'Glalie', 'Froslass',
  'Walrein', 'Lapras',
]);

const KNOWN_WIDE_GUARD: Set<string> = new Set([
  'Scrafty', 'Conkeldurr', 'Machamp', 'Aegislash-Shield', 'Lucario',
  'Mienshao', 'Heracross', 'Gallade', 'Passimian', 'Hariyama',
]);

const KNOWN_HELPING_HAND: Set<string> = new Set([
  'Pikachu', 'Raichu', 'Togekiss', 'Mr. Rime', 'Hatterene',
  'Dragonite', 'Clefable', 'Alcremie', 'Audino',
]);

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

const KNOWN_PIVOT_MOVES: Set<string> = new Set([
  'Incineroar', 'Corviknight', 'Whimsicott', 'Scizor', 'Gengar',
  'Dragapult', 'Hydreigon', 'Greninja', 'Rotom',
]);

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
  if (['Talonflame', 'Weavile', 'Scizor', 'Sneasler', 'Mamoswine', 'Lycanroc', 'Hawlucha', 'Arcanine'].includes(species)) {
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

  const bs = data.baseStats;
  const types = [...data.types] as string[];

  // Raw offensive stats
  const maxOffense = Math.max(bs.atk, bs.spa);
  if (maxOffense >= 130) { score += 7; reasons.push(`Elite offensive stat (${maxOffense})`); }
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

  // Vacant role fillers
  for (const vr of VACANT_ROLES) {
    if (vr.fillers.includes(species)) {
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
  // Consider any Pokemon scoring above the weak C-tier threshold as
  // eligible for archetype participation. Archetype anchors don't
  // need to be top-20 globally to enable a viable strategy — a
  // mid-tier Pokemon that IS the best at its niche is still the
  // centerpiece of that archetype.
  const eligibleSpecies = new Set(rankings.filter(r => r.score >= 30).map(r => r.species));
  const cores: ArchetypeCore[] = [];

  const has = (name: string) => eligibleSpecies.has(name);

  // Sun teams — Mega Meganium / Mega Charizard Y + Chlorophyll abusers
  if (has('Meganium') || has('Charizard')) {
    cores.push({
      name: 'Mega Sol Sun',
      description: 'Mega Meganium\'s Mega Sol ability treats every turn as Sun without needing a weather setter. Pairs with Chlorophyll abusers for instant field pressure.',
      anchors: has('Meganium') ? ['Meganium'] : ['Charizard'],
      partners: ['Venusaur', 'Victreebel', 'Torkoal', 'Torterra'].filter(has),
      winCondition: 'Overwhelming Sun-boosted Fire/Grass offense through Chlorophyll speed',
      requires: ['Mega Sol (Mega Meganium) or Drought (Mega Charizard Y)', 'Chlorophyll partners'],
    });
  }

  // Sand core — Hippowdon / Tyranitar + Sand Rush abusers
  if (has('Hippowdon') || has('Tyranitar')) {
    cores.push({
      name: 'Sand Offense',
      description: 'Hippowdon or Tyranitar sets Sand; Excadrill (Sand Rush) doubles its speed and Garchomp abuses passive chip damage for winning trades.',
      anchors: ['Hippowdon', 'Tyranitar'].filter(has),
      partners: ['Excadrill', 'Garchomp', 'Rhyperior', 'Mamoswine', 'Krookodile'].filter(has),
      winCondition: 'Sand chip + Sand Rush speed advantage',
      requires: ['Sand Stream setter', 'Sand Rush abuser'],
    });
  }

  // Snow core — Mega Froslass + Aurora Veil + Slush Rush
  if (has('Froslass') || has('Abomasnow')) {
    cores.push({
      name: 'Mega Froslass Snow',
      description: 'Mega Froslass gains Snow Warning on Mega Evolution, enabling turn-1 Aurora Veil + Slush Rush speed boosts for Beartic and Mamoswine.',
      anchors: ['Froslass'].filter(has),
      partners: ['Beartic', 'Mamoswine', 'Abomasnow', 'Glaceon', 'Avalugg'].filter(has),
      winCondition: 'Aurora Veil → boosted physical ice offense',
      requires: ['Mega Froslass for Snow Warning', 'Aurora Veil'],
    });
  }

  // Trick Room core
  if (has('Hatterene') || has('Mimikyu')) {
    cores.push({
      name: 'Trick Room',
      description: 'Hatterene or Mimikyu sets Trick Room; slow bulky attackers (Rhyperior, Conkeldurr) clean up with reversed speed priority. Mimikyu\'s Disguise guarantees setup.',
      anchors: ['Hatterene', 'Mimikyu'].filter(has),
      partners: ['Rhyperior', 'Conkeldurr', 'Mamoswine', 'Reuniclus', 'Runerigus'].filter(has),
      winCondition: 'Reverse speed tier for 5 turns; slow hitters outspeed the field',
      requires: ['Trick Room setter', 'Low-speed attackers'],
    });
  }

  // Tailwind spam
  if (has('Whimsicott') || has('Talonflame')) {
    cores.push({
      name: 'Tailwind Offense',
      description: 'Prankster Tailwind (Whimsicott) or Gale Wings Tailwind (Talonflame) sets up speed advantage, then hyper-offensive sweepers clean.',
      anchors: ['Whimsicott', 'Talonflame'].filter(has),
      partners: ['Garchomp', 'Dragapult', 'Mimikyu', 'Meowscarada', 'Tyranitar'].filter(has),
      winCondition: 'Fast offense under Tailwind priority speed control',
      requires: ['Tailwind setter (ideally Prankster)'],
    });
  }

  // Perish Song trap
  if (has('Gengar') && hasChampionsMega('Gengar')) {
    cores.push({
      name: 'Shadow Tag Perish',
      description: 'Mega Gengar\'s Shadow Tag prevents switches. Paired with Perish Song or Taunt/Will-O-Wisp, it forces trades or sacrifices.',
      anchors: ['Gengar'],
      partners: ['Whimsicott', 'Clefable', 'Alcremie'].filter(has),
      winCondition: 'Trap → Perish Song → force 1-for-1 trades',
      requires: ['Mega Gengar for Shadow Tag', 'Perish Song user'],
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

  // ─── Insights: analysis that isn't in any other source ────────
  const insights: string[] = [];
  const megaMeganium = rankings.find(r => r.species === 'Meganium');
  if (megaMeganium && megaMeganium.score >= 55) {
    insights.push(`Mega Meganium's Mega Sol is a unique permanent-sun enabler — no weather setter required. Pairs with Chlorophyll abusers for a cleaner sun archetype than Mega Charizard Y, which wastes a turn to Mega Evolve before Drought activates.`);
  }
  if (rankings.find(r => r.species === 'Whimsicott' && r.score >= 50)) {
    insights.push(`Whimsicott rises significantly as the primary Prankster Tailwind setter. With Amoonguss absent, it also absorbs some redirection responsibility alongside Clefable.`);
  }
  if (rankings.find(r => r.species === 'Incineroar' && r.score >= 55)) {
    insights.push(`Incineroar remains S-tier despite the Fake Out switch-in nerf — Intimidate + Parting Shot are still the best support package. The nerf hurts it less than it hurts faster Fake Out users.`);
  }
  const clefable = rankings.find(r => r.species === 'Clefable');
  if (clefable && clefable.score >= 45) {
    insights.push(`Clefable fills the redirection vacuum left by Amoonguss via Follow Me. Expect significantly higher usage than mainline VGC.`);
  }
  const dragonite = rankings.find(r => r.species === 'Dragonite');
  if (dragonite && dragonite.score >= 60) {
    insights.push(`Mega Dragonite with Dragonize turns Extreme Speed into a priority STAB Dragon move — bypasses every form of speed control. One of the only priority wincons in the format.`);
  }
  insights.push(`Roster absences (Amoonguss, Rillaboom, Gholdengo, Kingdra) create role vacuums that reshape the meta. Clefable, Meowscarada, Archaludon, and Primarina are the most direct beneficiaries.`);
  insights.push(`The Fake Out nerf (unusable on switch-in) matters more for offensive Fake Out users like Mega Lopunny than for Incineroar, which uses Fake Out as turn-2 support anyway.`);

  // ─── Dark horses: strong score, not in any obvious top-tier list ──
  const darkHorses = rankings
    .filter(r => r.tier === 'A' || r.tier === 'A+')
    .filter(r => !['Incineroar', 'Garchomp', 'Dragapult', 'Whimsicott', 'Mimikyu', 'Greninja', 'Gengar', 'Charizard', 'Tyranitar', 'Hippowdon'].includes(r.species))
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
