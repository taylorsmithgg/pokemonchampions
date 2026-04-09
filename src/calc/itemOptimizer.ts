// Team-Aware Item Optimizer
// Suggests optimal items considering:
// 1. Pokemon's types and moves (type-boost items)
// 2. Pokemon's role (sweeper, wall, support)
// 3. Items already held by teammates (item clause: only 1 of each)
// 4. Fallback alternatives when primary choice is taken

import { Move } from '@smogon/calc';
import { getPokemonData } from '../data/champions';
import type { PokemonState } from '../types';

interface ItemSuggestion {
  item: string;
  reason: string;
  priority: number; // higher = better fit
}

// Map move types to their boost items
const TYPE_BOOST_ITEMS: Record<string, string> = {
  Normal: 'Silk Scarf',
  Fire: 'Charcoal',
  Water: 'Mystic Water',
  Electric: 'Magnet',
  Grass: 'Miracle Seed',
  Ice: 'Never-Melt Ice',
  Fighting: 'Black Belt',
  Poison: 'Poison Barb',
  Ground: 'Soft Sand',
  Flying: 'Sharp Beak',
  Psychic: 'Twisted Spoon',
  Bug: 'Silver Powder',
  Rock: 'Hard Stone',
  Ghost: 'Spell Tag',
  Dragon: 'Dragon Fang',
  Dark: 'Black Glasses',
  Steel: 'Metal Coat',
  Fairy: 'Fairy Feather',
};

export function suggestItems(
  pokemon: PokemonState,
  takenItems: Set<string>,
): ItemSuggestion[] {
  const suggestions: ItemSuggestion[] = [];
  const data = getPokemonData(pokemon.species);
  if (!data) return suggestions;

  const bs = data.baseStats;
  const types = [...data.types] as string[];

  // Analyze moves to find the most-used offensive type
  const moveTypes: Record<string, number> = {};
  for (const moveName of pokemon.moves) {
    if (!moveName) continue;
    try {
      const move = new Move(9 as any, moveName);
      if (move.category === 'Status') continue;
      const bp = move.bp || 0;
      moveTypes[move.type] = (moveTypes[move.type] || 0) + bp;
    } catch { /* skip */ }
  }

  // Sort move types by total BP (strongest type first)
  const rankedTypes = Object.entries(moveTypes)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

  // 1. Type-boost item for strongest move type
  for (const moveType of rankedTypes) {
    const boostItem = TYPE_BOOST_ITEMS[moveType];
    if (boostItem) {
      suggestions.push({
        item: boostItem,
        reason: `20% boost to ${moveType}-type moves (primary damage type)`,
        priority: 10,
      });
    }
  }

  // 2. STAB type-boost items (if different from move types)
  for (const type of types) {
    const boostItem = TYPE_BOOST_ITEMS[type];
    if (boostItem && !suggestions.some(s => s.item === boostItem)) {
      suggestions.push({
        item: boostItem,
        reason: `20% boost to ${type}-type STAB moves`,
        priority: 8,
      });
    }
  }

  // 3. Role-based items
  const bulkIndex = (bs.hp * bs.def + bs.hp * bs.spd) / 2;
  const isBulky = bulkIndex > 12000;
  const isFrail = bulkIndex < 7000;
  const isFast = bs.spe >= 100;

  if (isFrail && isFast) {
    suggestions.push({ item: 'Focus Sash', reason: 'Survives one hit from full HP — essential for frail sweepers', priority: 9 });
  }
  if (isBulky) {
    suggestions.push({ item: 'Leftovers', reason: 'Passive recovery each turn — ideal for bulky Pokemon', priority: 7 });
    suggestions.push({ item: 'Sitrus Berry', reason: 'Restores 25% HP once — good for pivots', priority: 6 });
  }

  // 4. Utility items
  suggestions.push({ item: 'Lum Berry', reason: 'Cures any status once — prevents burn/sleep disruption', priority: 5 });

  const hasTailwind = pokemon.moves.some(m => m?.toLowerCase() === 'tailwind');
  const hasTrickRoom = pokemon.moves.some(m => m?.toLowerCase() === 'trick room');

  if (hasTailwind || hasTrickRoom) {
    suggestions.push({ item: 'Mental Herb', reason: 'Blocks Taunt — protects speed control setup', priority: 8 });
  }
  if (isFast) {
    suggestions.push({ item: 'Choice Scarf', reason: 'Outspeeds everything — locked into one move', priority: 6 });
  }

  // 5. Mega Stone check — if this Pokemon has a Mega, suggest the stone
  const megaStones: Record<string, string> = {
    Charizard: 'Charizardite X',
    Gengar: 'Gengarite',
    Kangaskhan: 'Kangaskhanite',
    Gyarados: 'Gyaradosite',
    Scizor: 'Scizorite',
    Alakazam: 'Alakazite',
    Venusaur: 'Venusaurite',
    Lopunny: 'Lopunnite',
    Altaria: 'Altarianite',
    Garchomp: 'Garchompite',
    Tyranitar: 'Tyranitarite',
    Dragonite: 'Dragoninite',
    Froslass: 'Froslassite',
    Heracross: 'Heracronite',
    Lucario: 'Lucarionite',
  };
  const megaStone = megaStones[pokemon.species];
  if (megaStone) {
    suggestions.push({ item: megaStone, reason: `Mega Evolve for boosted stats + new ability`, priority: 9 });
  }

  // Filter out taken items and sort by priority
  const available = suggestions.filter(s => !takenItems.has(s.item));
  available.sort((a, b) => b.priority - a.priority);

  // Deduplicate
  const seen = new Set<string>();
  return available.filter(s => {
    if (seen.has(s.item)) return false;
    seen.add(s.item);
    return true;
  });
}

// Check for duplicate items across a team
export function findDuplicateItems(team: PokemonState[]): { item: string; holders: string[] }[] {
  const itemMap = new Map<string, string[]>();
  for (const p of team) {
    if (!p.species || !p.item) continue;
    const holders = itemMap.get(p.item) || [];
    holders.push(p.species);
    itemMap.set(p.item, holders);
  }
  return Array.from(itemMap.entries())
    .filter(([, holders]) => holders.length > 1)
    .map(([item, holders]) => ({ item, holders }));
}
