// Champions Damage Calculator wrapper
// Uses @smogon/calc Gen 9 engine with Champions-specific overrides

import { calculate, Pokemon, Move, Field, Side } from '@smogon/calc';
import type { StatID, StatsTable } from '@smogon/calc';
import { getMoveBP } from '../data/champions';
import type { PokemonState, FieldState } from '../types';

// Convert our SP-based Pokemon state to @smogon/calc Pokemon
function buildCalcPokemon(state: PokemonState): Pokemon {
  // Convert SP to EVs for the calc engine
  // In Champions at Lv50: 1 SP ≈ 1 stat point
  // In Gen 9 at Lv50: 4 EVs = 1 stat point
  // So SP * 4 = equivalent EVs
  const evs: Partial<StatsTable> = {};
  const statKeys: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  for (const stat of statKeys) {
    evs[stat] = Math.min((state.sps[stat] || 0) * 4, 252);
  }

  return new Pokemon(9 as any, state.species, {
    level: state.level,
    nature: state.nature as any,
    evs,
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    item: (state.item || undefined) as any,
    ability: (state.ability || undefined) as any,
    boosts: state.boosts,
    status: (state.status || undefined) as any,
    curHP: state.currentHp,
    teraType: undefined,
    isDynamaxed: false,
  });
}

function buildCalcMove(moveName: string, options?: {
  isCrit?: boolean;
  hits?: number;
  ability?: string;
  item?: string;
}): Move {
  const bpOverride = getMoveBP(moveName);
  const move = new Move(9 as any, moveName, {
    isCrit: options?.isCrit,
    hits: options?.hits,
    ability: options?.ability as any,
    item: options?.item as any,
    overrides: bpOverride ? { basePower: bpOverride } : undefined,
  });
  return move;
}

function buildCalcField(state: FieldState): Field {
  return new Field({
    gameType: state.format,
    weather: (state.weather || undefined) as any,
    terrain: (state.terrain || undefined) as any,
    isGravity: state.isGravity,
    isBeadsOfRuin: state.isBeadsOfRuin,
    isSwordOfRuin: state.isSwordOfRuin,
    isTabletsOfRuin: state.isTabletsOfRuin,
    isVesselOfRuin: state.isVesselOfRuin,
    attackerSide: new Side({
      spikes: state.attackerSide.spikes,
      isSR: state.attackerSide.isSR,
      isReflect: state.attackerSide.isReflect,
      isLightScreen: state.attackerSide.isLightScreen,
      isAuroraVeil: state.attackerSide.isAuroraVeil,
      isTailwind: state.attackerSide.isTailwind,
      isHelpingHand: state.attackerSide.isHelpingHand,
      isFriendGuard: state.attackerSide.isFriendGuard,
      isBattery: state.attackerSide.isBattery,
      isPowerSpot: state.attackerSide.isPowerSpot,
    }),
    defenderSide: new Side({
      spikes: state.defenderSide.spikes,
      isSR: state.defenderSide.isSR,
      isReflect: state.defenderSide.isReflect,
      isLightScreen: state.defenderSide.isLightScreen,
      isAuroraVeil: state.defenderSide.isAuroraVeil,
      isTailwind: state.defenderSide.isTailwind,
      isHelpingHand: state.defenderSide.isHelpingHand,
      isFriendGuard: state.defenderSide.isFriendGuard,
    }),
  });
}

export interface CalcResult {
  moveName: string;
  damage: number[];
  minDamage: number;
  maxDamage: number;
  minPercent: number;
  maxPercent: number;
  defenderHP: number;
  koChance: { chance: number | undefined; n: number; text: string };
  description: string;
  moveDescription: string;
  recoil?: { recoil: number | [number, number]; text: string };
  recovery?: { recovery: [number, number]; text: string };
}

export function calculateDamage(
  attacker: PokemonState,
  defender: PokemonState,
  moveName: string,
  field: FieldState,
  options?: { isCrit?: boolean; hits?: number }
): CalcResult | null {
  if (!attacker.species || !defender.species || !moveName) return null;

  try {
    const calcAttacker = buildCalcPokemon(attacker);
    const calcDefender = buildCalcPokemon(defender);
    const calcMove = buildCalcMove(moveName, {
      ...options,
      ability: attacker.ability,
      item: attacker.item,
    });

    // Handle Dragonize ability (like Pixilate but for Dragon)
    if (attacker.ability === 'Dragonize' && calcMove.type === 'Normal') {
      calcMove.type = 'Dragon' as any;
      calcMove.bp = Math.floor(calcMove.bp * 1.2);
    }

    // Handle Mega Sol ability (always sun)
    let calcField = buildCalcField(field);
    if (attacker.ability === 'Mega Sol') {
      calcField = new Field({
        ...calcField,
        weather: 'Sun' as any,
      });
    }

    const result = calculate(9 as any, calcAttacker, calcDefender, calcMove, calcField);

    const range = result.range();
    const defenderHP = calcDefender.maxHP();
    const minPercent = (range[0] / defenderHP) * 100;
    const maxPercent = (range[1] / defenderHP) * 100;

    // Flatten damage array
    let damageArr: number[] = [];
    if (Array.isArray(result.damage)) {
      if (Array.isArray(result.damage[0])) {
        damageArr = (result.damage as number[][]).flat();
      } else {
        damageArr = result.damage as number[];
      }
    } else {
      damageArr = [result.damage as number];
    }

    return {
      moveName,
      damage: damageArr,
      minDamage: range[0],
      maxDamage: range[1],
      minPercent,
      maxPercent,
      defenderHP,
      koChance: result.kochance(),
      description: result.desc(),
      moveDescription: result.moveDesc(),
      recoil: result.recoil(),
      recovery: result.recovery(),
    };
  } catch {
    return null;
  }
}

// Calculate all 4 moves at once
export function calculateAllMoves(
  attacker: PokemonState,
  defender: PokemonState,
  field: FieldState,
  moveOptions?: Record<number, { isCrit?: boolean; hits?: number }>
): (CalcResult | null)[] {
  return attacker.moves.map((move, i) => {
    if (!move) return null;
    return calculateDamage(attacker, defender, move, field, moveOptions?.[i]);
  });
}

// Speed comparison
export function compareSpeed(a: PokemonState, b: PokemonState, field: FieldState): {
  aSpeed: number;
  bSpeed: number;
  aFirst: boolean;
  speedTie: boolean;
} {
  const calcA = buildCalcPokemon(a);
  const calcB = buildCalcPokemon(b);

  let aSpeed = calcA.stats.spe;
  let bSpeed = calcB.stats.spe;

  // Tailwind
  if (field.attackerSide.isTailwind) aSpeed *= 2;
  if (field.defenderSide.isTailwind) bSpeed *= 2;

  // Paralysis
  if (a.status === 'par') aSpeed = Math.floor(aSpeed * 0.5);
  if (b.status === 'par') bSpeed = Math.floor(bSpeed * 0.5);

  return {
    aSpeed,
    bSpeed,
    aFirst: aSpeed > bSpeed,
    speedTie: aSpeed === bSpeed,
  };
}
