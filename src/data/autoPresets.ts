// ─── Auto-Generated Competitive Presets ────────────────────────────
//
// For species without hand-curated presets, we generate competitive
// builds from base stats + type + ability. This ensures every species
// in the roster has move data so the projection engines, synergy
// engine, and team builder can properly classify them.
//
// Auto-presets are lower priority than curated presets — if a curated
// preset exists, it takes precedence. These fill the gaps for the
// 150+ species that would otherwise be invisible to the system.
//
// Move selection is type-based heuristic — we pick STAB moves that
// match the species' types, then fill coverage/utility slots based
// on the offensive profile. Without learnset data from @smogon/calc,
// this is the best we can do. The moves may not all be learnable by
// every species, but they'll be close enough for archetype
// classification and synergy detection.

import { getAvailablePokemon, getPokemonData } from './champions';
import { PRESETS, type PokemonPreset } from './presets';
import { getEffectiveBaseStats } from './abilityClassification';
import type { NatureName } from '../types';
import type { StatsTable } from '@smogon/calc';

// ─── Type → common STAB moves ─────────────────────────────────────
// For each type, the most universally-available competitive moves.
// Ordered by preference (first = best).
const TYPE_MOVES: Record<string, { physical: string[]; special: string[] }> = {
  Normal:   { physical: ['Body Slam', 'Return', 'Facade', 'Double-Edge'], special: ['Hyper Voice', 'Tri Attack'] },
  Fire:     { physical: ['Flare Blitz', 'Fire Punch', 'Blaze Kick'], special: ['Flamethrower', 'Fire Blast', 'Heat Wave'] },
  Water:    { physical: ['Waterfall', 'Aqua Tail', 'Liquidation'], special: ['Surf', 'Hydro Pump', 'Muddy Water'] },
  Electric: { physical: ['Wild Charge', 'Thunder Punch'], special: ['Thunderbolt', 'Thunder', 'Volt Switch'] },
  Grass:    { physical: ['Leaf Blade', 'Wood Hammer', 'Seed Bomb'], special: ['Energy Ball', 'Giga Drain', 'Leaf Storm'] },
  Ice:      { physical: ['Icicle Crash', 'Ice Punch', 'Ice Shard'], special: ['Ice Beam', 'Blizzard', 'Freeze-Dry'] },
  Fighting: { physical: ['Close Combat', 'Drain Punch', 'Brick Break'], special: ['Aura Sphere', 'Focus Blast'] },
  Poison:   { physical: ['Poison Jab', 'Gunk Shot'], special: ['Sludge Bomb', 'Sludge Wave'] },
  Ground:   { physical: ['Earthquake', 'High Horsepower', 'Drill Run'], special: ['Earth Power', 'Mud Shot'] },
  Flying:   { physical: ['Brave Bird', 'Aerial Ace', 'Acrobatics'], special: ['Hurricane', 'Air Slash'] },
  Psychic:  { physical: ['Zen Headbutt', 'Psycho Cut'], special: ['Psychic', 'Psyshock', 'Future Sight'] },
  Bug:      { physical: ['X-Scissor', 'Bug Bite', 'Leech Life'], special: ['Bug Buzz', 'Signal Beam'] },
  Rock:     { physical: ['Stone Edge', 'Rock Slide', 'Rock Blast'], special: ['Power Gem', 'Ancient Power'] },
  Ghost:    { physical: ['Shadow Claw', 'Phantom Force', 'Shadow Sneak'], special: ['Shadow Ball', 'Hex'] },
  Dragon:   { physical: ['Dragon Claw', 'Outrage', 'Dragon Rush'], special: ['Draco Meteor', 'Dragon Pulse'] },
  Dark:     { physical: ['Knock Off', 'Crunch', 'Sucker Punch'], special: ['Dark Pulse', 'Night Daze'] },
  Steel:    { physical: ['Iron Head', 'Iron Tail', 'Meteor Mash'], special: ['Flash Cannon', 'Steel Beam'] },
  Fairy:    { physical: ['Play Rough', 'Spirit Break'], special: ['Moonblast', 'Dazzling Gleam'] },
};

// Utility moves are selected inline in pickMoves() based on stat profile.

function pickMoves(types: string[], isPhys: boolean, bs: { spe: number; hp: number; def: number; spd: number }): string[] {
  const moves: string[] = [];
  const category = isPhys ? 'physical' : 'special';

  // STAB move for each type
  for (const type of types) {
    const pool = TYPE_MOVES[type]?.[category];
    if (pool && pool.length > 0) {
      moves.push(pool[0]);
    }
  }

  // If only 1 STAB, add a coverage move
  if (moves.length < 2) {
    // Pick a coverage type that complements
    const coverageOrder = isPhys
      ? ['Earthquake', 'Ice Punch', 'Thunder Punch', 'Rock Slide', 'Close Combat', 'Knock Off']
      : ['Ice Beam', 'Thunderbolt', 'Earth Power', 'Focus Blast', 'Shadow Ball', 'Dark Pulse'];
    for (const m of coverageOrder) {
      if (!moves.includes(m)) { moves.push(m); break; }
    }
  }

  // Slot 3: Protect for Doubles viability (or utility)
  moves.push('Protect');

  // Slot 4: setup move if fast + offensive, or coverage if slow
  if (bs.spe >= 80 && moves.length < 4) {
    const setup = isPhys ? 'Swords Dance' : 'Nasty Plot';
    moves.push(setup);
  } else if (bs.hp + bs.def + bs.spd > 250 && moves.length < 4) {
    // Bulky — add a utility move
    moves.push('Stealth Rock');
  } else if (moves.length < 4) {
    // Default coverage
    const extra = isPhys ? 'Rock Slide' : 'Shadow Ball';
    if (!moves.includes(extra)) moves.push(extra);
    else moves.push('Protect');
  }

  return moves.slice(0, 4);
}

function pickNature(isPhys: boolean, bs: { spe: number; atk: number; spa: number; hp: number; def: number }): NatureName {
  if (isPhys) {
    if (bs.spe >= 80) return 'Jolly';
    if (bs.hp + bs.def > 200) return 'Impish';
    return 'Adamant';
  }
  if (bs.spe >= 80) return 'Timid';
  if (bs.hp + bs.def > 200) return 'Bold';
  return 'Modest';
}

function pickSPs(isPhys: boolean, bs: { spe: number; hp: number; def: number; spd: number; atk: number; spa: number }): StatsTable {
  const maxOff = isPhys ? bs.atk : bs.spa;
  const isBulky = bs.hp + Math.max(bs.def, bs.spd) > 200 && maxOff < 90;
  const isFast = bs.spe >= 80;

  if (isBulky) {
    // Defensive spread
    return bs.def >= bs.spd
      ? { hp: 32, atk: 0, def: 32, spa: 0, spd: 2, spe: 0 }
      : { hp: 32, atk: 0, def: 2, spa: 0, spd: 32, spe: 0 };
  }
  if (isFast) {
    // Speed + offense
    return isPhys
      ? { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }
      : { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 };
  }
  // Bulky attacker
  return isPhys
    ? { hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0 }
    : { hp: 32, atk: 0, def: 2, spa: 32, spd: 0, spe: 0 };
}

function pickItem(_isPhys: boolean, types: string[], bs: { spe: number; hp: number; def: number }): string {
  if (bs.hp + bs.def > 220) return 'Leftovers';
  if (bs.spe >= 100) return 'Focus Sash';
  // Type boost item
  const typeItems: Record<string, string> = {
    Fire: 'Charcoal', Water: 'Mystic Water', Electric: 'Magnet',
    Grass: 'Miracle Seed', Ice: 'Never-Melt Ice', Fighting: 'Black Belt',
    Poison: 'Poison Barb', Ground: 'Soft Sand', Flying: 'Sharp Beak',
    Psychic: 'Twisted Spoon', Bug: 'Silver Powder', Rock: 'Hard Stone',
    Ghost: 'Spell Tag', Dragon: 'Dragon Fang', Dark: 'Black Glasses',
    Steel: 'Metal Coat', Fairy: 'Fairy Feather', Normal: 'Silk Scarf',
  };
  return typeItems[types[0]] || 'Sitrus Berry';
}

/** Generate auto-presets for all species that lack curated ones. */
export function generateAutoPresets(): PokemonPreset[] {
  const curatedSpecies = new Set(PRESETS.map(p => p.species));
  const autoPresets: PokemonPreset[] = [];

  for (const species of getAvailablePokemon()) {
    if (curatedSpecies.has(species)) continue;

    const data = getPokemonData(species);
    if (!data) continue;

    const types = [...data.types] as string[];
    const abilities = data.abilities ? Object.values(data.abilities).map(a => a as string) : [];
    const bs = getEffectiveBaseStats(data.baseStats, abilities);
    const bst = bs.hp + bs.atk + bs.def + bs.spa + bs.spd + bs.spe;

    // Skip very weak species (BST < 400)
    if (bst < 400) continue;

    const isPhys = bs.atk > bs.spa;
    const nature = pickNature(isPhys, bs);
    const moves = pickMoves(types, isPhys, bs);
    const sps = pickSPs(isPhys, bs);
    const item = pickItem(isPhys, types, bs);
    const ability = abilities[0] || '';

    // Determine label from role
    const maxOff = Math.max(bs.atk, bs.spa);
    const isBulky = bs.hp + Math.max(bs.def, bs.spd) > 200 && maxOff < 90;
    const label = isBulky
      ? (bs.def > bs.spd ? 'Physical Wall' : 'Special Wall')
      : (bs.spe >= 80 ? 'Speed Sweeper' : 'Bulky Attacker');

    autoPresets.push({
      name: `${species} (Auto)`,
      species,
      nature,
      ability,
      item,
      teraType: '',
      sps,
      moves,
      label,
    });
  }

  return autoPresets;
}
