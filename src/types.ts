import type { StatsTable } from '@smogon/calc';

// Re-define types that @smogon/calc uses internally but doesn't export directly
export type NatureName = 'Adamant' | 'Bashful' | 'Bold' | 'Brave' | 'Calm' | 'Careful' | 'Docile' | 'Gentle' | 'Hardy' | 'Hasty' | 'Impish' | 'Jolly' | 'Lax' | 'Lonely' | 'Mild' | 'Modest' | 'Naive' | 'Naughty' | 'Quiet' | 'Quirky' | 'Rash' | 'Relaxed' | 'Sassy' | 'Serious' | 'Timid';
export type StatusName = 'slp' | 'psn' | 'brn' | 'frz' | 'par' | 'tox';
export type GameType = 'Singles' | 'Doubles';
export type Terrain = 'Electric' | 'Grassy' | 'Psychic' | 'Misty';
export type Weather = 'Sand' | 'Sun' | 'Rain' | 'Hail' | 'Snow' | 'Harsh Sunshine' | 'Heavy Rain' | 'Strong Winds';
export type TypeName = 'Normal' | 'Fighting' | 'Flying' | 'Poison' | 'Ground' | 'Rock' | 'Bug' | 'Ghost' | 'Steel' | 'Fire' | 'Water' | 'Grass' | 'Electric' | 'Psychic' | 'Ice' | 'Dragon' | 'Dark' | 'Fairy' | 'Stellar' | '???';

export interface PokemonState {
  species: string;
  level: number;
  nature: NatureName;
  ability: string;
  item: string;
  teraType: string;
  sps: StatsTable;
  boosts: StatsTable;
  status: StatusName | '';
  currentHp: number;
  moves: string[];
  isMega: boolean;
  moveOptions: Record<number, { isCrit: boolean; hits: number }>;
}

export interface SideState {
  spikes: number;
  isSR: boolean;
  isReflect: boolean;
  isLightScreen: boolean;
  isAuroraVeil: boolean;
  isTailwind: boolean;
  isHelpingHand: boolean;
  isFriendGuard: boolean;
  isBattery: boolean;
  isPowerSpot: boolean;
  isSteelySpirit: boolean;
}

export interface FieldState {
  format: GameType;
  weather: Weather | '';
  terrain: Terrain | '';
  isGravity: boolean;
  isBeadsOfRuin: boolean;
  isSwordOfRuin: boolean;
  isTabletsOfRuin: boolean;
  isVesselOfRuin: boolean;
  attackerSide: SideState;
  defenderSide: SideState;
}

export function createDefaultPokemonState(): PokemonState {
  return {
    species: '',
    level: 50,
    nature: 'Adamant',
    ability: '',
    item: '',
    teraType: '',
    sps: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    boosts: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    status: '',
    currentHp: 100,
    moves: ['', '', '', ''],
    isMega: false,
    moveOptions: {
      0: { isCrit: false, hits: 1 },
      1: { isCrit: false, hits: 1 },
      2: { isCrit: false, hits: 1 },
      3: { isCrit: false, hits: 1 },
    },
  };
}

export function createDefaultSideState(): SideState {
  return {
    spikes: 0,
    isSR: false,
    isReflect: false,
    isLightScreen: false,
    isAuroraVeil: false,
    isTailwind: false,
    isHelpingHand: false,
    isFriendGuard: false,
    isBattery: false,
    isPowerSpot: false,
    isSteelySpirit: false,
  };
}

export function createDefaultFieldState(): FieldState {
  return {
    format: 'Singles',
    weather: '',
    terrain: '',
    isGravity: false,
    isBeadsOfRuin: false,
    isSwordOfRuin: false,
    isTabletsOfRuin: false,
    isVesselOfRuin: false,
    attackerSide: createDefaultSideState(),
    defenderSide: createDefaultSideState(),
  };
}
