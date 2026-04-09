// Pokemon Champions data layer
// Wraps @smogon/calc Gen 9 data with Champions-specific modifications

import { Generations } from '@smogon/calc';
import type { StatID } from '@smogon/calc';
import type { NatureName, TypeName } from '../types';

const gen9 = Generations.get(9);

// ─── Stat Point System ─────────────────────────────────────────────
// Champions replaces EVs/IVs with Stat Points (SP)
// 66 total SP, max 32 per stat, 1 SP = +1 stat at Lv50
export const MAX_TOTAL_SP = 66;
export const MAX_STAT_SP = 32;

// ─── Nature Data ────────────────────────────────────────────────────
export interface NatureInfo {
  name: NatureName;
  plus?: StatID;
  minus?: StatID;
}

export const NATURES: NatureInfo[] = [
  { name: 'Adamant', plus: 'atk', minus: 'spa' },
  { name: 'Bold', plus: 'def', minus: 'atk' },
  { name: 'Brave', plus: 'atk', minus: 'spe' },
  { name: 'Calm', plus: 'spd', minus: 'atk' },
  { name: 'Careful', plus: 'spd', minus: 'spa' },
  { name: 'Gentle', plus: 'spd', minus: 'def' },
  { name: 'Hasty', plus: 'spe', minus: 'def' },
  { name: 'Impish', plus: 'def', minus: 'spa' },
  { name: 'Jolly', plus: 'spe', minus: 'spa' },
  { name: 'Lax', plus: 'def', minus: 'spd' },
  { name: 'Lonely', plus: 'atk', minus: 'def' },
  { name: 'Mild', plus: 'spa', minus: 'def' },
  { name: 'Modest', plus: 'spa', minus: 'atk' },
  { name: 'Naive', plus: 'spe', minus: 'spd' },
  { name: 'Naughty', plus: 'atk', minus: 'spd' },
  { name: 'Quiet', plus: 'spa', minus: 'spe' },
  { name: 'Rash', plus: 'spa', minus: 'spd' },
  { name: 'Relaxed', plus: 'def', minus: 'spe' },
  { name: 'Sassy', plus: 'spd', minus: 'spe' },
  { name: 'Timid', plus: 'spe', minus: 'atk' },
  { name: 'Hardy' },
  { name: 'Docile' },
  { name: 'Serious' },
  { name: 'Bashful' },
  { name: 'Quirky' },
];

export function getNatureMod(nature: NatureName, stat: StatID): number {
  const n = NATURES.find(n => n.name === nature);
  if (!n) return 1;
  if (n.plus === stat) return 1.1;
  if (n.minus === stat) return 0.9;
  return 1;
}

export function getNatureLabel(nature: NatureName): string {
  const n = NATURES.find(n2 => n2.name === nature);
  if (!n || !n.plus || !n.minus) return nature;
  const statLabels: Record<string, string> = {
    atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe'
  };
  return `${nature} (+${statLabels[n.plus]}, -${statLabels[n.minus]})`;
}

// ─── Available Pokemon in Champions ─────────────────────────────────
// ~251 fully evolved Pokemon + Pikachu from Gens 1-9
// We pull from @smogon/calc's Gen 9 data and filter

// Legendaries, Mythicals, Paradox, Ultra Beasts — excluded from Champions
const EXCLUDED_POKEMON = new Set([
  // Box legendaries
  'Mewtwo', 'Lugia', 'Ho-Oh', 'Kyogre', 'Groudon', 'Rayquaza',
  'Dialga', 'Palkia', 'Giratina', 'Reshiram', 'Zekrom', 'Kyurem',
  'Xerneas', 'Yveltal', 'Zygarde', 'Cosmog', 'Cosmoem', 'Solgaleo',
  'Lunala', 'Necrozma', 'Zacian', 'Zamazenta', 'Eternatus',
  'Calyrex', 'Koraidon', 'Miraidon', 'Terapagos',
  // Sub-legendaries
  'Articuno', 'Zapdos', 'Moltres', 'Raikou', 'Entei', 'Suicune',
  'Regirock', 'Regice', 'Registeel', 'Regigigas', 'Regieleki', 'Regidrago',
  'Latios', 'Latias', 'Heatran', 'Cresselia',
  'Uxie', 'Mesprit', 'Azelf', 'Cobalion', 'Terrakion', 'Virizion',
  'Tornadus', 'Tornadus-Therian', 'Thundurus', 'Thundurus-Therian',
  'Landorus', 'Landorus-Therian', 'Enamorus',
  'Tapu Koko', 'Tapu Lele', 'Tapu Bulu', 'Tapu Fini',
  'Type: Null', 'Silvally',
  'Kubfu', 'Urshifu', 'Urshifu-Rapid-Strike',
  'Glastrier', 'Spectrier',
  'Wo-Chien', 'Chien-Pao', 'Ting-Lu', 'Chi-Yu',
  'Ogerpon', 'Ogerpon-Hearthflame', 'Ogerpon-Wellspring', 'Ogerpon-Cornerstone',
  // Mythicals
  'Mew', 'Celebi', 'Jirachi', 'Deoxys', 'Phione', 'Manaphy',
  'Darkrai', 'Shaymin', 'Arceus', 'Victini', 'Keldeo', 'Meloetta',
  'Genesect', 'Diancie', 'Hoopa', 'Volcanion', 'Magearna',
  'Marshadow', 'Zeraora', 'Meltan', 'Melmetal', 'Zarude', 'Pecharunt',
  // Paradox Pokemon (not in Champions)
  'Great Tusk', 'Scream Tail', 'Brute Bonnet', 'Flutter Mane',
  'Slither Wing', 'Sandy Shocks', 'Roaring Moon', 'Walking Wake',
  'Gouging Fire', 'Raging Bolt',
  'Iron Treads', 'Iron Bundle', 'Iron Hands', 'Iron Jugulis',
  'Iron Moth', 'Iron Thorns', 'Iron Valiant', 'Iron Leaves',
  'Iron Boulder', 'Iron Crown',
  // Ultra Beasts
  'Nihilego', 'Buzzwole', 'Pheromosa', 'Xurkitree', 'Celesteela',
  'Kartana', 'Guzzlord', 'Poipole', 'Naganadel', 'Stakataka', 'Blacephalon',
  // Other exclusions
  'Dondozo', 'Tatsugiri', // Commander gimmick not confirmed in Champions
  'Ursaluna', 'Ursaluna-Bloodmoon', // Legends Arceus exclusive form
  'Farigiraf', 'Annihilape', 'Dudunsparce', // Paldea evolutions TBD
  // Smogon CAP (Create-A-Pokemon) — fake Pokemon, not real
  'Syclant', 'Syclar', 'Revenankh', 'Pyroak', 'Flarelm', 'Fidgit', 'Breezi',
  'Stratagem', 'Privatyke', 'Arghonaut', 'Kitsunoh', 'Cyclohm', 'Colossoil',
  'Krilowatt', 'Voodoom', 'Tomohawk', 'Necturna', 'Mollux', 'Aurumoth',
  'Malaconda', 'Cawmodore', 'Volkraken', 'Plasmanta', 'Naviathan',
  'Crucibelle', 'Crucibelle-Mega', 'Kerfluffle', 'Pajantom', 'Jumbao',
  'Caribolt', 'Smokomodo', 'Snaelstrom', 'Equilibra', 'Astrolotl',
  'Chromera', 'Saharaja', 'Hemogoblin', 'Venomicon', 'Venomicon-Epilogue',
]);

const CHAMPIONS_POKEMON_SET = new Set<string>();

function initChampionsPokemon() {
  if (CHAMPIONS_POKEMON_SET.size > 0) return;

  for (const species of gen9.species) {
    const name = species.name;
    // Skip excluded Pokemon
    if (EXCLUDED_POKEMON.has(name)) continue;
    // Skip alternate forms of excluded Pokemon
    if (species.baseSpecies && EXCLUDED_POKEMON.has(species.baseSpecies as string)) continue;
    // Include fully evolved Pokemon (not NFE) and Pikachu
    if (name === 'Pikachu' || !species.nfe) {
      CHAMPIONS_POKEMON_SET.add(name);
    }
  }
}

export function getAvailablePokemon(): string[] {
  initChampionsPokemon();
  return Array.from(CHAMPIONS_POKEMON_SET).sort();
}

export function getPokemonData(name: string) {
  return gen9.species.get(name.toLowerCase().replace(/[^a-z0-9]/g, '') as any);
}

// ─── Moves ──────────────────────────────────────────────────────────
export function getAvailableMoves(): string[] {
  const moves: string[] = [];
  for (const move of gen9.moves) {
    moves.push(move.name);
  }
  return moves.sort();
}

export function getMoveData(name: string) {
  return gen9.moves.get(name.toLowerCase().replace(/[^a-z0-9]/g, '') as any);
}

// Champions-specific move BP changes
const MOVE_BP_OVERRIDES: Record<string, number> = {
  'First Impression': 100,
  'Grav Apple': 90,
};

export function getMoveBP(name: string): number | undefined {
  return MOVE_BP_OVERRIDES[name];
}

// ─── Abilities ──────────────────────────────────────────────────────
export const CHAMPIONS_NEW_ABILITIES = [
  { name: 'Piercing Drill', desc: 'Contact moves hit through Protect for 1/4 damage' },
  { name: 'Dragonize', desc: 'Normal-type moves become Dragon-type with 20% power boost' },
  { name: 'Mega Sol', desc: 'Moves act as if sun is up, regardless of weather' },
  { name: 'Spicy Spray', desc: 'Burns attackers when the Pokemon takes damage from a move' },
];

export function getAvailableAbilities(): string[] {
  const abilities: string[] = [];
  for (const ability of gen9.abilities) {
    abilities.push(ability.name);
  }
  CHAMPIONS_NEW_ABILITIES.forEach(a => {
    if (!abilities.includes(a.name)) abilities.push(a.name);
  });
  return abilities.sort();
}

// ─── Items ──────────────────────────────────────────────────────────
// Exclude items tied to banned Pokemon, removed mechanics, or non-competitive items
const EXCLUDED_ITEMS = new Set([
  // Z-Crystals (Z-Moves not in Champions)
  'Buginium Z', 'Darkinium Z', 'Dragonium Z', 'Electrium Z', 'Fairium Z',
  'Fightinium Z', 'Firium Z', 'Flyinium Z', 'Ghostium Z', 'Grassium Z',
  'Groundium Z', 'Icium Z', 'Normalium Z', 'Poisonium Z', 'Psychium Z',
  'Rockium Z', 'Steelium Z', 'Waterium Z',
  'Aloraichium Z', 'Decidium Z', 'Eevium Z', 'Incinium Z', 'Kommonium Z',
  'Lunalium Z', 'Lycanium Z', 'Marshadium Z', 'Mewnium Z', 'Mimikium Z',
  'Pikanium Z', 'Pikashunium Z', 'Primarium Z', 'Snorlium Z', 'Solganium Z',
  'Tapunium Z', 'Ultranecrozium Z',
  // Dynamax items
  'Max Mushrooms',
  // Legendary-specific items
  'Rusted Sword', 'Rusted Shield', 'Soul Dew',
  'Adamant Crystal', 'Lustrous Globe', 'Griseous Core', 'Griseous Orb',
  // Paradox/Ogerpon items
  'Booster Energy', 'Wellspring Mask', 'Hearthflame Mask', 'Cornerstone Mask',
  // Non-competitive items (balls, stones, etc.)
  'Fast Ball', 'Friend Ball', 'Great Ball', 'Heavy Ball', 'Level Ball',
  'Love Ball', 'Lure Ball', 'Moon Ball', 'Poke Ball', 'Premier Ball',
  'Quick Ball', 'Repeat Ball', 'Safari Ball', 'Timer Ball', 'Ultra Ball',
  'Beast Ball', 'Cherish Ball', 'Dive Ball', 'Dream Ball', 'Dusk Ball',
  'Heal Ball', 'Luxury Ball', 'Master Ball', 'Nest Ball', 'Net Ball',
  'Sport Ball', 'Park Ball',
  // Evolution stones (not battle items)
  'Fire Stone', 'Water Stone', 'Thunder Stone', 'Leaf Stone', 'Moon Stone',
  'Sun Stone', 'Shiny Stone', 'Dusk Stone', 'Dawn Stone', 'Ice Stone',
  'Dragon Scale', 'Deep Sea Scale', 'Deep Sea Tooth', 'Dubious Disc',
  'Electirizer', 'Magmarizer', 'Oval Stone', 'Protector', 'Razor Claw',
  'Razor Fang', 'Reaper Cloth', 'Sachet', 'Whipped Dream',
  'Prism Scale', 'Upgrade',
  // Arceus plates (Arceus banned)
  'Draco Plate', 'Dread Plate', 'Earth Plate', 'Fist Plate', 'Flame Plate',
  'Icicle Plate', 'Insect Plate', 'Iron Plate', 'Meadow Plate', 'Mind Plate',
  'Pixie Plate', 'Sky Plate', 'Splash Plate', 'Spooky Plate', 'Stone Plate',
  'Toxic Plate', 'Zap Plate', 'Blank Plate', 'Legend Plate',
  // Silvally memories (Silvally banned)
  'Bug Memory', 'Dark Memory', 'Dragon Memory', 'Electric Memory', 'Fairy Memory',
  'Fighting Memory', 'Fire Memory', 'Flying Memory', 'Ghost Memory', 'Grass Memory',
  'Ground Memory', 'Ice Memory', 'Poison Memory', 'Psychic Memory', 'Rock Memory',
  'Steel Memory', 'Water Memory',
  // Misc non-battle
  'Berry Juice', 'Bright Powder', 'Smoke Ball', 'Amulet Coin', 'Lucky Egg',
  'Exp. Share', 'Soothe Bell', 'Cleanse Tag',
]);

export function getAvailableItems(): string[] {
  const items: string[] = [];
  for (const item of gen9.items) {
    if (!EXCLUDED_ITEMS.has(item.name)) {
      items.push(item.name);
    }
  }
  return items.sort();
}

// ─── Types ──────────────────────────────────────────────────────────
export const TYPES: TypeName[] = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'
];

// ─── Type Colors ────────────────────────────────────────────────────
export const TYPE_COLORS: Record<string, string> = {
  Normal: '#A8A77A',
  Fire: '#EE8130',
  Water: '#6390F0',
  Electric: '#F7D02C',
  Grass: '#7AC74C',
  Ice: '#96D9D6',
  Fighting: '#C22E28',
  Poison: '#A33EA1',
  Ground: '#E2BF65',
  Flying: '#A98FF3',
  Psychic: '#F95587',
  Bug: '#A6B91A',
  Rock: '#B6A136',
  Ghost: '#735797',
  Dragon: '#6F35FC',
  Dark: '#705746',
  Steel: '#B7B7CE',
  Fairy: '#D685AD',
  Stellar: '#44628B',
};

// ─── Status Conditions ──────────────────────────────────────────────
export const STATUS_CONDITIONS = [
  { id: '', label: 'Healthy' },
  { id: 'brn', label: 'Burned' },
  { id: 'par', label: 'Paralyzed' },
  { id: 'psn', label: 'Poisoned' },
  { id: 'tox', label: 'Badly Poisoned' },
  { id: 'slp', label: 'Asleep' },
  { id: 'frz', label: 'Frozen' },
] as const;

// ─── Stat Labels ────────────────────────────────────────────────────
export const STAT_IDS: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const STAT_LABELS: Record<StatID, string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe'
};
export const STAT_COLORS: Record<StatID, string> = {
  hp: '#FF5959',
  atk: '#F5AC78',
  def: '#FAE078',
  spa: '#9DB7F5',
  spd: '#A7DB8D',
  spe: '#FA92B2',
};

export { gen9 };
