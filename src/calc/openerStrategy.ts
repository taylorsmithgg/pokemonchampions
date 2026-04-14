// ─── Opener Strategy Engine ─────────────────────────────────────────
//
// Infers specific turn-1 and turn-2 actions from team composition,
// archetype detection, and opponent archetype matchup. Produces
// actionable opening plays, not generic advice.
//
// Also provides orderBringList() to re-sort a bring list with
// lead/pivot/closer role awareness.

import { getPokemonData } from '../data/champions';
import {
  speciesRunsMove,
  speciesHasAbility,
  getSpeciesMoves,
  SETUP_MOVES,
  PRIORITY_MOVES,
  PIVOT_MOVES,
  REDIRECT_MOVES,
} from '../data/moveIndex';
import { WEATHER_SETTERS, WEATHER_ABUSERS } from '../data/abilityClassification';
import type { PokemonState } from '../types';

// ─── Types ──────────────────────────────────────────────────────────

export interface OpenerStrategy {
  lead: [string, string];
  turn1: { mon1Action: string; mon2Action: string };
  turn2: { action: string };
  reasoning: string;
  archetype: string;
  counterPlay: string;
}

interface ArchetypeDetection {
  name: string;
  confidence: number;
  weatherSetter?: string;
  speedController?: string;
  coreMembers: string[];
}

// ─── Move checks (singleton Sets for individual move lookups) ────────

const FAKE_OUT = new Set(['Fake Out']);
const TAILWIND = new Set(['Tailwind']);
const TRICK_ROOM = new Set(['Trick Room']);
const PROTECT = new Set(['Protect', 'Detect', 'Baneful Bunker', 'Silk Trap', 'Spiky Shield', 'King\'s Shield', 'Obstruct']);
const TAUNT = new Set(['Taunt']);
const WILL_O_WISP = new Set(['Will-O-Wisp']);
const HELPING_HAND = new Set(['Helping Hand']);
const SPREAD_ATTACKS = new Set([
  'Heat Wave', 'Dazzling Gleam', 'Muddy Water', 'Rock Slide',
  'Earthquake', 'Discharge', 'Blizzard', 'Snarl', 'Icy Wind',
  'Electroweb', 'Lava Plume', 'Surf', 'Brutal Swing',
]);

// ─── Species-level capability checks ─────────────────────────────────

function canFakeOut(species: string): boolean {
  return speciesRunsMove(species, FAKE_OUT);
}

function canTailwind(species: string): boolean {
  return speciesRunsMove(species, TAILWIND);
}

function canTrickRoom(species: string): boolean {
  return speciesRunsMove(species, TRICK_ROOM);
}

function canProtect(species: string): boolean {
  return speciesRunsMove(species, PROTECT);
}

function canTaunt(species: string): boolean {
  return speciesRunsMove(species, TAUNT);
}

function canRedirect(species: string): boolean {
  return speciesRunsMove(species, REDIRECT_MOVES);
}

function canSpreadAttack(species: string): boolean {
  return speciesRunsMove(species, SPREAD_ATTACKS);
}

function hasIntimidate(species: string): boolean {
  return speciesHasAbility(species, 'intimidate');
}

function hasPrankster(species: string): boolean {
  return speciesHasAbility(species, 'prankster');
}

function getWeatherAbility(species: string): { weather: string; role: 'setter' | 'abuser' } | null {
  const data = getPokemonData(species);
  if (!data?.abilities) return null;
  for (const slot of Object.values(data.abilities)) {
    const lower = (slot as string).toLowerCase();
    if (WEATHER_SETTERS[lower]) return { weather: WEATHER_SETTERS[lower], role: 'setter' };
  }
  for (const slot of Object.values(data.abilities)) {
    const lower = (slot as string).toLowerCase();
    if (WEATHER_ABUSERS[lower]) return { weather: WEATHER_ABUSERS[lower], role: 'abuser' };
  }
  return null;
}

function getBaseSpeed(species: string): number {
  const data = getPokemonData(species);
  return data?.baseStats?.spe ?? 0;
}

function isSlow(species: string): boolean {
  return getBaseSpeed(species) <= 55;
}

function isFast(species: string): boolean {
  return getBaseSpeed(species) >= 95;
}

function isPhysicalAttacker(species: string): boolean {
  const data = getPokemonData(species);
  if (!data) return false;
  return data.baseStats.atk > data.baseStats.spa;
}

function getBestSpreadMove(species: string): string | null {
  const moves = getSpeciesMoves(species);
  for (const m of ['Heat Wave', 'Dazzling Gleam', 'Rock Slide', 'Muddy Water', 'Earthquake', 'Discharge', 'Blizzard', 'Lava Plume', 'Surf', 'Snarl', 'Icy Wind', 'Electroweb']) {
    if (moves.has(m)) return m;
  }
  return null;
}

function getBestSingleTargetMove(species: string, _oppTypes?: Set<string>): string {
  const moves = getSpeciesMoves(species);
  const data = getPokemonData(species);
  if (!data) return 'attack';
  for (const m of moves) {
    if (SETUP_MOVES.has(m) || PROTECT.has(m) || FAKE_OUT.has(m) || TAILWIND.has(m) || TRICK_ROOM.has(m)) continue;
    if (REDIRECT_MOVES.has(m) || PIVOT_MOVES.has(m) || HELPING_HAND.has(m)) continue;
    return m;
  }
  return 'attack';
}

// getPriorityMove available for future strategy expansion
// function getPriorityMove(species: string): string | null {
//   const moves = getSpeciesMoves(species);
//   for (const m of moves) { if (PRIORITY_MOVES.has(m) && m !== 'Fake Out') return m; }
//   return null;
// }

// ─── Archetype Detection ─────────────────────────────────────────────

function detectArchetype(species: string[]): ArchetypeDetection {
  let bestArch: ArchetypeDetection = { name: 'Balance', confidence: 0.3, coreMembers: [] };

  // Check weather
  for (const s of species) {
    const wa = getWeatherAbility(s);
    if (wa?.role === 'setter') {
      const abusers = species.filter(o => {
        const oa = getWeatherAbility(o);
        return oa?.role === 'abuser' && oa.weather === wa.weather;
      });
      if (abusers.length > 0) {
        const conf = 0.7 + abusers.length * 0.1;
        if (conf > bestArch.confidence) {
          bestArch = {
            name: wa.weather,
            confidence: Math.min(conf, 0.95),
            weatherSetter: s,
            coreMembers: [s, ...abusers],
          };
        }
      } else {
        // Setter without abuser — still mild weather lean
        if (0.45 > bestArch.confidence) {
          bestArch = { name: wa.weather, confidence: 0.45, weatherSetter: s, coreMembers: [s] };
        }
      }
    }
  }

  // Check Trick Room
  const trSetters = species.filter(s => canTrickRoom(s));
  const slowMons = species.filter(s => isSlow(s));
  if (trSetters.length > 0 && slowMons.length >= 2) {
    const conf = 0.6 + trSetters.length * 0.1 + slowMons.length * 0.05;
    if (conf > bestArch.confidence) {
      bestArch = {
        name: 'Trick Room',
        confidence: Math.min(conf, 0.95),
        speedController: trSetters[0],
        coreMembers: [...trSetters, ...slowMons.slice(0, 2)],
      };
    }
  }

  // Check Tailwind
  const twSetters = species.filter(s => canTailwind(s));
  const fastAttackers = species.filter(s => isFast(s) && !canTailwind(s));
  if (twSetters.length > 0) {
    const conf = 0.5 + fastAttackers.length * 0.1;
    if (conf > bestArch.confidence) {
      bestArch = {
        name: 'Tailwind',
        confidence: Math.min(conf, 0.9),
        speedController: twSetters[0],
        coreMembers: [twSetters[0], ...fastAttackers.slice(0, 2)],
      };
    }
  }

  // Check Hyper Offense
  const hoMons = species.filter(s => {
    const d = getPokemonData(s);
    return d && Math.max(d.baseStats.atk, d.baseStats.spa) >= 100 && d.baseStats.spe >= 80;
  });
  if (hoMons.length >= 3 && bestArch.confidence < 0.6) {
    bestArch = { name: 'Hyper Offense', confidence: 0.65, coreMembers: hoMons.slice(0, 3) };
  }

  // Check Perish Trap
  if (species.includes('Gengar') || species.includes('Mega Gengar')) {
    const hasTrapSupport = species.some(s => canRedirect(s) || canFakeOut(s));
    if (hasTrapSupport && bestArch.confidence < 0.6) {
      bestArch = { name: 'Perish Trap', confidence: 0.6, coreMembers: ['Gengar', ...species.filter(s => canRedirect(s))] };
    }
  }

  return bestArch;
}

// ─── Opener Selection Logic ──────────────────────────────────────────

function findBestLead(
  mySpecies: string[],
  myArch: ArchetypeDetection,
  oppArch: ArchetypeDetection,
  oppSpecies: string[],
): OpenerStrategy {
  // Candidate pools
  const fakeOutUsers = mySpecies.filter(canFakeOut);
  const twSetters = mySpecies.filter(canTailwind);
  const trSetters = mySpecies.filter(canTrickRoom);
  const intimidators = mySpecies.filter(hasIntimidate);
  const redirectors = mySpecies.filter(canRedirect);
  const spreaders = mySpecies.filter(canSpreadAttack);
  // Reserved for archetype-specific branches
  void mySpecies.filter(canTaunt);
  void mySpecies.filter(s => getWeatherAbility(s)?.role === 'setter');

  // Determine opponent's likely lead threats
  const oppFakeOut = oppSpecies.filter(canFakeOut);
  const oppTW = oppSpecies.filter(canTailwind);
  const oppTR = oppSpecies.filter(canTrickRoom);
  const oppWeather = oppSpecies.filter(s => getWeatherAbility(s)?.role === 'setter');

  // ── Strategy: My weather vs their weather ─────────────────────
  if (myArch.name === 'Sun' || myArch.name === 'Rain' || myArch.name === 'Sand' || myArch.name === 'Snow') {
    if (myArch.weatherSetter) {
      const setter = myArch.weatherSetter;
      const abuser = myArch.coreMembers.find(s => s !== setter) ?? mySpecies.find(s => s !== setter) ?? mySpecies[1];

      if (oppArch.name === 'Sun' || oppArch.name === 'Rain' || oppArch.name === 'Sand' || oppArch.name === 'Snow') {
        // Weather war: lead setter to overwrite
        const support = fakeOutUsers.find(s => s !== setter && s !== abuser) ?? abuser;
        const partner = support !== abuser ? support : abuser;

        if (canFakeOut(partner)) {
          return {
            lead: [partner, setter],
            turn1: {
              mon1Action: `Fake Out their ${oppArch.weatherSetter ?? oppWeather[0] ?? 'weather setter'} to delay their weather`,
              mon2Action: canProtect(setter)
                ? `Protect to guarantee safe switch-in weather override next turn`
                : `${getBestSpreadMove(setter) ?? 'attack'} for immediate pressure`,
            },
            turn2: { action: `${setter} overwrites weather with ${myArch.name}. ${partner} pivots or attacks freely.` },
            reasoning: `Win the weather war by Faking Out their setter while ${setter} secures ${myArch.name}.`,
            archetype: myArch.name,
            counterPlay: `Overrides ${oppArch.name} with ${myArch.name} — their weather abusers lose their boost.`,
          };
        }

        // No Fake Out — just lead setter + attacker
        return {
          lead: [setter, abuser],
          turn1: {
            mon1Action: `${getBestSpreadMove(setter) ?? getBestSingleTargetMove(setter)} to apply pressure under ${myArch.name}`,
            mon2Action: `${getBestSingleTargetMove(abuser)} — boosted by ${myArch.name} weather`,
          },
          turn2: { action: `Continue aggression under your weather. Their ${oppArch.name} setter must come in to re-set, giving you tempo.` },
          reasoning: `Lead both weather cores to immediately establish ${myArch.name} and overwhelm their ${oppArch.name} team.`,
          archetype: myArch.name,
          counterPlay: `Your ${setter} auto-sets ${myArch.name} on switch-in, overriding their weather.`,
        };
      }

      // Non-weather opponent: lead setter + abuser for immediate pressure
      const fakeOutPartner = fakeOutUsers.find(s => s !== setter && s !== abuser);
      if (fakeOutPartner) {
        return {
          lead: [fakeOutPartner, abuser],
          turn1: {
            mon1Action: `Fake Out their biggest threat${oppTW.length > 0 ? ` (${oppTW[0]} — blocks Tailwind)` : oppTR.length > 0 ? ` (${oppTR[0]} — blocks Trick Room)` : ''}`,
            mon2Action: `${getBestSingleTargetMove(abuser)} — boosted by ${myArch.name} weather from ${setter}`,
          },
          turn2: { action: `${fakeOutPartner} pivots out for ${setter} to establish weather, or continues attacking.` },
          reasoning: `Fake Out disrupts their setup while ${abuser} deals boosted damage under ${myArch.name}.`,
          archetype: myArch.name,
          counterPlay: `Fake Out denies their turn-1 setup while your weather core applies pressure.`,
        };
      }

      return {
        lead: [setter, abuser],
        turn1: {
          mon1Action: `${getBestSpreadMove(setter) ?? getBestSingleTargetMove(setter)} under auto-set ${myArch.name}`,
          mon2Action: `${getBestSingleTargetMove(abuser)} — speed-doubled or power-boosted by ${myArch.name}`,
        },
        turn2: { action: `Maintain offensive pressure. Switch ${setter} if weather is secure to preserve re-set option.` },
        reasoning: `Lead weather core for immediate speed/power advantage under ${myArch.name}.`,
        archetype: myArch.name,
        counterPlay: `${myArch.name} gives ${abuser} a massive advantage — they must waste a turn overriding weather or lose the speed/damage race.`,
      };
    }
  }

  // ── Strategy: My Trick Room vs their Tailwind ─────────────────
  if (myArch.name === 'Trick Room' && (oppArch.name === 'Tailwind' || oppTW.length > 0)) {
    const trSetter = trSetters[0];
    const fakeOutPartner = fakeOutUsers.find(s => s !== trSetter);
    const twTarget = oppTW[0] ?? oppSpecies[0];

    if (fakeOutPartner) {
      return {
        lead: [fakeOutPartner, trSetter],
        turn1: {
          mon1Action: `Fake Out ${twTarget} to prevent Tailwind setup`,
          mon2Action: `Trick Room — reverses speed so your slow attackers move first`,
        },
        turn2: { action: `${fakeOutPartner} attacks or pivots. Under TR, your slow mons outspeed their entire team.` },
        reasoning: `Fake Out their Tailwind setter guarantees Trick Room goes up uncontested.`,
        archetype: 'Trick Room',
        counterPlay: `Trick Room flips their Tailwind advantage — their fast mons become slowest on the field.`,
      };
    }

    // No Fake Out — use redirector or protector
    const redirector = redirectors.find(s => s !== trSetter);
    if (redirector) {
      return {
        lead: [redirector, trSetter],
        turn1: {
          mon1Action: `Follow Me / Rage Powder to redirect attacks away from ${trSetter}`,
          mon2Action: `Trick Room — safe behind redirection`,
        },
        turn2: { action: `${trSetter} attacks under TR. ${redirector} supports or pivots.` },
        reasoning: `Redirect protection ensures Trick Room goes up safely.`,
        archetype: 'Trick Room',
        counterPlay: `They cannot stop Trick Room when ${redirector} absorbs their Taunt or KO attempt.`,
      };
    }

    return {
      lead: [trSetter, mySpecies.find(s => s !== trSetter && isSlow(s)) ?? mySpecies[1]],
      turn1: {
        mon1Action: `Trick Room — accept the risk, must get it up`,
        mon2Action: `${canProtect(mySpecies[1]) ? 'Protect to stay safe while TR sets up' : getBestSingleTargetMove(mySpecies[1])}`,
      },
      turn2: { action: `Under Trick Room, your slow attackers outspeed everything. Go aggressive.` },
      reasoning: `Must set Trick Room turn 1 to counter their speed advantage. Risky without Fake Out or redirect support.`,
      archetype: 'Trick Room',
      counterPlay: `If TR goes up, their speed investment is wasted. They need Taunt or Imprison to stop it.`,
    };
  }

  // ── Strategy: My Trick Room (non-tailwind opponent) ──────────
  if (myArch.name === 'Trick Room' && trSetters.length > 0) {
    const trSetter = trSetters[0];
    const fakeOutPartner = fakeOutUsers.find(s => s !== trSetter);
    const oppThreat = oppFakeOut[0] ?? oppTW[0] ?? oppSpecies[0];

    if (fakeOutPartner) {
      return {
        lead: [fakeOutPartner, trSetter],
        turn1: {
          mon1Action: `Fake Out ${oppThreat} to secure a free Trick Room setup`,
          mon2Action: `Trick Room`,
        },
        turn2: { action: `Under TR, lead with your hardest hitter. ${fakeOutPartner} can pivot or stay to support.` },
        reasoning: `Classic Fake Out + Trick Room opening — the most reliable way to set TR.`,
        archetype: 'Trick Room',
        counterPlay: `Once TR is up, your slow attackers dominate. Their fastest mons move last.`,
      };
    }

    const redirector = redirectors.find(s => s !== trSetter);
    if (redirector) {
      return {
        lead: [redirector, trSetter],
        turn1: {
          mon1Action: `Follow Me / Rage Powder — absorb both opponent attacks`,
          mon2Action: `Trick Room`,
        },
        turn2: { action: `Attack freely under Trick Room. Switch ${redirector} for a slow attacker if needed.` },
        reasoning: `Redirect ensures Trick Room goes up. ${redirector} takes both hits for the team.`,
        archetype: 'Trick Room',
        counterPlay: `Redirection makes it nearly impossible to stop Trick Room.`,
      };
    }

    // Bare TR set
    return {
      lead: [trSetter, mySpecies.find(s => s !== trSetter && isSlow(s)) ?? mySpecies[1]],
      turn1: {
        mon1Action: `Trick Room — must go up turn 1`,
        mon2Action: `${canProtect(mySpecies.find(s => s !== trSetter) ?? '') ? 'Protect' : getBestSingleTargetMove(mySpecies.find(s => s !== trSetter && isSlow(s)) ?? mySpecies[1])} while TR sets`,
      },
      turn2: { action: `Attack under Trick Room with your slow wallbreakers.` },
      reasoning: `Trick Room team — must set it or lose the speed game.`,
      archetype: 'Trick Room',
      counterPlay: `TR reverses speed tiers, making their fast mons liabilities.`,
    };
  }

  // ── Strategy: My Tailwind team ────────────────────────────────
  if ((myArch.name === 'Tailwind' || twSetters.length > 0) && myArch.name !== 'Trick Room') {
    const twSetter = twSetters[0];
    const fakeOutPartner = fakeOutUsers.find(s => s !== twSetter);
    const attacker = spreaders.find(s => s !== twSetter && s !== fakeOutPartner) ?? mySpecies.find(s => s !== twSetter) ?? mySpecies[1];

    if (fakeOutPartner) {
      const oppDisruptor = oppFakeOut[0] ?? oppTR[0] ?? oppSpecies[0];
      return {
        lead: [fakeOutPartner, twSetter],
        turn1: {
          mon1Action: `Fake Out ${oppDisruptor} — prevents their disruption`,
          mon2Action: `Tailwind — doubles your team's speed for 4 turns`,
        },
        turn2: { action: `Both attack freely under Tailwind. Swap ${fakeOutPartner} to ${attacker} if better matchup.` },
        reasoning: `Guaranteed Tailwind with Fake Out protection. Your team outspeeds everything for 4 turns.`,
        archetype: 'Tailwind',
        counterPlay: `Tailwind + Fake Out denies their turn-1 setup and gives you 4 turns of speed control.`,
      };
    }

    if (hasPrankster(twSetter)) {
      return {
        lead: [twSetter, attacker],
        turn1: {
          mon1Action: `Tailwind (Prankster priority — goes before anything)`,
          mon2Action: `${getBestSpreadMove(attacker) ?? getBestSingleTargetMove(attacker)} for immediate pressure`,
        },
        turn2: { action: `${twSetter} supports with Taunt/Encore/attack. ${attacker} continues sweeping under Tailwind.` },
        reasoning: `Prankster Tailwind cannot be outsped — guaranteed speed advantage from turn 1.`,
        archetype: 'Tailwind',
        counterPlay: `Priority Tailwind means they cannot prevent it. Your whole team outspeeds for 4 turns.`,
      };
    }

    return {
      lead: [twSetter, attacker],
      turn1: {
        mon1Action: `Tailwind`,
        mon2Action: `${canProtect(attacker) ? 'Protect to survive turn 1 safely' : getBestSingleTargetMove(attacker)}`,
      },
      turn2: { action: `Under Tailwind, ${attacker} outspeeds and sweeps. ${twSetter} supports or attacks.` },
      reasoning: `Set Tailwind turn 1 and begin sweeping immediately.`,
      archetype: 'Tailwind',
      counterPlay: `4 turns of doubled speed lets you pick off threats before they can act.`,
    };
  }

  // ── Strategy: Balance / Generic — pick best utility leads ─────

  // Prioritize Fake Out + Intimidate lead if both available
  const intimFO = mySpecies.find(s => hasIntimidate(s) && canFakeOut(s));
  if (intimFO) {
    const partner = spreaders.find(s => s !== intimFO) ?? mySpecies.find(s => s !== intimFO) ?? mySpecies[1];
    const oppPhysical = oppSpecies.filter(s => isPhysicalAttacker(s));
    const foTarget = oppTW[0] ?? oppTR[0] ?? oppFakeOut[0] ?? oppSpecies[0];

    return {
      lead: [intimFO, partner],
      turn1: {
        mon1Action: `Fake Out ${foTarget}${oppPhysical.length > 0 ? ' — Intimidate also drops their physical attackers\' Attack' : ''}`,
        mon2Action: `${getBestSpreadMove(partner) ?? getBestSingleTargetMove(partner)} for immediate damage`,
      },
      turn2: { action: `${intimFO} attacks or pivots out (U-turn/Parting Shot for re-Intimidate later). ${partner} continues pressure.` },
      reasoning: `Intimidate + Fake Out is the most disruptive opening in Doubles — drops Attack and steals a turn.`,
      archetype: 'Balance',
      counterPlay: `Intimidate weakens their physical side while Fake Out denies their turn-1 play.`,
    };
  }

  // Fake Out + attacker
  if (fakeOutUsers.length > 0) {
    const foUser = fakeOutUsers[0];
    const partner = spreaders.find(s => s !== foUser) ?? mySpecies.find(s => s !== foUser) ?? mySpecies[1];
    const foTarget = oppTW[0] ?? oppTR[0] ?? oppFakeOut[0] ?? oppSpecies[0];

    return {
      lead: [foUser, partner],
      turn1: {
        mon1Action: `Fake Out ${foTarget}`,
        mon2Action: `${getBestSpreadMove(partner) ?? getBestSingleTargetMove(partner)}`,
      },
      turn2: { action: `${foUser} attacks or switches. ${partner} continues offense.` },
      reasoning: `Fake Out steals tempo by stopping their most dangerous turn-1 play.`,
      archetype: 'Balance',
      counterPlay: `Fake Out prevents ${foTarget} from acting turn 1, giving you initiative.`,
    };
  }

  // Intimidate lead without Fake Out
  if (intimidators.length > 0) {
    const intim = intimidators[0];
    const partner = spreaders.find(s => s !== intim) ?? mySpecies.find(s => s !== intim) ?? mySpecies[1];

    return {
      lead: [intim, partner],
      turn1: {
        mon1Action: `${speciesRunsMove(intim, WILL_O_WISP) ? 'Will-O-Wisp their physical attacker' : getBestSingleTargetMove(intim)} — Intimidate already fired on switch-in`,
        mon2Action: `${getBestSpreadMove(partner) ?? getBestSingleTargetMove(partner)}`,
      },
      turn2: { action: `${intim} pivots out to recycle Intimidate later, or stays to attack.` },
      reasoning: `Intimidate drops their Attack on entry — strong against physical-heavy teams.`,
      archetype: 'Balance',
      counterPlay: `Intimidate neuters their physical attackers from the start.`,
    };
  }

  // Fallback: two highest-offense mons
  const byOffense = [...mySpecies].sort((a, b) => {
    const da = getPokemonData(a);
    const db = getPokemonData(b);
    if (!da || !db) return 0;
    return Math.max(db.baseStats.atk, db.baseStats.spa) - Math.max(da.baseStats.atk, da.baseStats.spa);
  });

  const lead1 = byOffense[0] ?? mySpecies[0];
  const lead2 = byOffense[1] ?? mySpecies[1];

  return {
    lead: [lead1, lead2],
    turn1: {
      mon1Action: `${getBestSpreadMove(lead1) ?? getBestSingleTargetMove(lead1)} into their weakest target`,
      mon2Action: `${getBestSpreadMove(lead2) ?? getBestSingleTargetMove(lead2)} for board pressure`,
    },
    turn2: { action: `Continue aggression. Switch out if a better matchup is available in the back.` },
    reasoning: `Lead with your two strongest attackers to apply maximum early pressure.`,
    archetype: 'Balance',
    counterPlay: `Raw offensive pressure forces them to react rather than set up.`,
  };
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Infer the optimal opening strategy based on team compositions.
 * Returns specific turn-1 and turn-2 actions with reasoning.
 */
export function inferOpenerStrategy(myTeam: PokemonState[], opponents: string[]): OpenerStrategy | null {
  const mySpecies = myTeam.filter(t => t.species).map(t => t.species);
  const oppSpecies = opponents.filter(Boolean);

  if (mySpecies.length < 2 || oppSpecies.length < 1) return null;

  const myArch = detectArchetype(mySpecies);
  const oppArch = detectArchetype(oppSpecies);

  return findBestLead(mySpecies, myArch, oppArch, oppSpecies);
}

/**
 * Reorder a bring list so positions reflect Doubles roles:
 *   0: Lead slot 1 (disruptor / speed control)
 *   1: Lead slot 2 (main attacker or setup)
 *   2: Mid-game pivot
 *   3: Endgame closer / backup wincon
 */
export function orderBringList(
  brings: { species: string; score: number; reasons: string[] }[],
  myTeam: PokemonState[],
  opponents: string[],
): { species: string; score: number; reasons: string[]; role: string }[] {
  if (brings.length <= 1) {
    return brings.map(b => ({ ...b, role: 'Lead' }));
  }

  const strategy = inferOpenerStrategy(myTeam, opponents);
  const ordered: { species: string; score: number; reasons: string[]; role: string }[] = [];
  const remaining = [...brings];

  // Place the recommended leads at positions 0-1
  if (strategy) {
    const [lead1Name, lead2Name] = strategy.lead;

    const lead1Idx = remaining.findIndex(b => b.species === lead1Name);
    if (lead1Idx >= 0) {
      ordered.push({ ...remaining[lead1Idx], role: 'Lead' });
      remaining.splice(lead1Idx, 1);
    }

    const lead2Idx = remaining.findIndex(b => b.species === lead2Name);
    if (lead2Idx >= 0) {
      ordered.push({ ...remaining[lead2Idx], role: 'Lead' });
      remaining.splice(lead2Idx, 1);
    }
  }

  // Fill any unfilled lead slots from remaining
  while (ordered.length < 2 && remaining.length > 0) {
    // Prefer Fake Out / Intimidate users as leads
    const supportIdx = remaining.findIndex(b =>
      canFakeOut(b.species) || hasIntimidate(b.species) || canTailwind(b.species) || canTrickRoom(b.species)
    );
    if (supportIdx >= 0 && ordered.length === 0) {
      ordered.push({ ...remaining[supportIdx], role: 'Lead' });
      remaining.splice(supportIdx, 1);
    } else {
      ordered.push({ ...remaining[0], role: 'Lead' });
      remaining.splice(0, 1);
    }
  }

  if (remaining.length === 0) return ordered;

  // Position 2: mid-game pivot — prefer pivot moves, Intimidate for re-entry, or setup mons
  const pivotScore = (species: string): number => {
    let s = 0;
    if (speciesRunsMove(species, PIVOT_MOVES)) s += 5;
    if (hasIntimidate(species)) s += 4;
    if (canProtect(species)) s += 1;
    if (speciesRunsMove(species, SETUP_MOVES)) s += 2;
    // Mid-game pivot should be moderately bulky
    const data = getPokemonData(species);
    if (data) {
      const bulk = data.baseStats.hp + data.baseStats.def + data.baseStats.spd;
      s += Math.min(3, Math.round((bulk - 200) / 50));
    }
    return s;
  };

  remaining.sort((a, b) => pivotScore(b.species) - pivotScore(a.species));
  ordered.push({ ...remaining[0], role: 'Pivot' });
  remaining.splice(0, 1);

  // Position 3: closer — prefer priority users, setup sweepers, or highest raw power
  if (remaining.length > 0) {
    const closerScore = (species: string): number => {
      let s = 0;
      if (speciesRunsMove(species, PRIORITY_MOVES)) s += 4;
      if (speciesRunsMove(species, SETUP_MOVES)) s += 3;
      const data = getPokemonData(species);
      if (data) {
        const power = Math.max(data.baseStats.atk, data.baseStats.spa);
        s += Math.min(4, Math.round((power - 80) / 20));
        // Bulk helps survive to close
        if (data.baseStats.hp >= 80) s += 1;
      }
      // Disguise / Multiscale — safe setup in endgame
      if (speciesHasAbility(species, 'disguise') || speciesHasAbility(species, 'multiscale')) s += 3;
      return s;
    };

    remaining.sort((a, b) => closerScore(b.species) - closerScore(a.species));
    ordered.push({ ...remaining[0], role: 'Closer' });
    remaining.splice(0, 1);
  }

  // Any extras just append
  for (const b of remaining) {
    ordered.push({ ...b, role: 'Flex' });
  }

  return ordered;
}
