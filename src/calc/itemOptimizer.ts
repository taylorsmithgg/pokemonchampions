// Team-Aware Item Optimizer
// Suggests optimal items based on role, moves, and teammate context

import { Move } from '@smogon/calc';
import { getPokemonData } from '../data/champions';
import type { PokemonState } from '../types';

interface ItemSuggestion {
  item: string;
  reason: string;
  priority: number;
}

const TYPE_BOOST_ITEMS: Record<string, string> = {
  Normal: 'Silk Scarf', Fire: 'Charcoal', Water: 'Mystic Water',
  Electric: 'Magnet', Grass: 'Miracle Seed', Ice: 'Never-Melt Ice',
  Fighting: 'Black Belt', Poison: 'Poison Barb', Ground: 'Soft Sand',
  Flying: 'Sharp Beak', Psychic: 'Twisted Spoon', Bug: 'Silver Powder',
  Rock: 'Hard Stone', Ghost: 'Spell Tag', Dragon: 'Dragon Fang',
  Dark: 'Black Glasses', Steel: 'Metal Coat', Fairy: 'Fairy Feather',
};

const MEGA_STONES: Record<string, string[]> = {
  Charizard: ['Charizardite X', 'Charizardite Y'],
  Gengar: ['Gengarite'], Kangaskhan: ['Kangaskhanite'],
  Gyarados: ['Gyaradosite'], Scizor: ['Scizorite'],
  Alakazam: ['Alakazite'], Venusaur: ['Venusaurite'],
  Lopunny: ['Lopunnite'], Altaria: ['Altarianite'],
  Garchomp: ['Garchompite'], Tyranitar: ['Tyranitarite'],
  Dragonite: ['Dragoninite'], Froslass: ['Froslassite'],
  Heracross: ['Heracronite'], Lucario: ['Lucarionite'],
  Blastoise: ['Blastoisinite'], Gardevoir: ['Gardevoirite'],
  Gallade: ['Galladite'], Aggron: ['Aggronite'],
  Pinsir: ['Pinsirite'], Aerodactyl: ['Aerodactylite'],
  Steelix: ['Steelixite'], Medicham: ['Medichamite'],
  Banette: ['Banettite'], Absol: ['Absolite'],
  Glalie: ['Glalitite'], Sableye: ['Sablenite'],
  Sharpedo: ['Sharpedonite'], Camerupt: ['Cameruptite'],
  Slowbro: ['Slowbronite'], Pidgeot: ['Pidgeotite'],
  Ampharos: ['Ampharosite'], Beedrill: ['Beedrillite'],
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

  // Classify the Pokemon
  const bulkIndex = (bs.hp * bs.def + bs.hp * bs.spd) / 2;
  const isBulky = bulkIndex > 12000;
  const isFrail = bulkIndex < 7000;
  const isFast = bs.spe >= 100;
  const isSlow = bs.spe <= 60;

  // Detect moves
  const hasFakeOut = pokemon.moves.some(m => m?.toLowerCase() === 'fake out');
  const hasTailwind = pokemon.moves.some(m => m?.toLowerCase() === 'tailwind');
  const hasTrickRoom = pokemon.moves.some(m => m?.toLowerCase() === 'trick room');
  const hasProtect = pokemon.moves.some(m => ['protect', 'detect'].includes(m?.toLowerCase() || ''));
  const hasSetup = pokemon.moves.some(m => ['swords dance', 'dragon dance', 'quiver dance', 'nasty plot', 'calm mind', 'curse', 'iron defense'].includes(m?.toLowerCase() || ''));

  // Find strongest move type for type-boost items
  const moveTypes: Record<string, number> = {};
  for (const moveName of pokemon.moves) {
    if (!moveName) continue;
    try {
      const move = new Move(9 as any, moveName);
      if (move.category === 'Status') continue;
      moveTypes[move.type] = (moveTypes[move.type] || 0) + (move.bp || 0);
    } catch { /* skip */ }
  }
  const primaryMoveType = Object.entries(moveTypes).sort((a, b) => b[1] - a[1])[0]?.[0];

  // ─── Priority 1: Mega Stones (highest priority) ───────────────
  const megaStones = MEGA_STONES[pokemon.species];
  if (megaStones) {
    for (const stone of megaStones) {
      suggestions.push({
        item: stone,
        reason: 'Mega Evolve — massive stat boost + new ability',
        priority: 20,
      });
    }
  }

  // ─── Priority 2: Role-critical items ──────────────────────────
  if (hasTailwind || hasTrickRoom) {
    suggestions.push({
      item: 'Mental Herb',
      reason: 'Blocks Taunt — protects Tailwind/Trick Room setup',
      priority: 16,
    });
  }

  if (isFrail && isFast) {
    suggestions.push({
      item: 'Focus Sash',
      reason: 'Guarantees surviving one hit — essential for frail fast attackers',
      priority: 15,
    });
  }

  if (isFrail && !isFast) {
    suggestions.push({
      item: 'Focus Sash',
      reason: 'Survives a hit to get off an attack or set up',
      priority: 13,
    });
  }

  // ─── Priority 3: Competitive staple items ─────────────────────
  if (hasFakeOut || isBulky) {
    suggestions.push({
      item: 'Sitrus Berry',
      reason: 'Restores 25% HP — great for pivots and bulky Pokemon',
      priority: 12,
    });
  }

  if (isBulky && hasProtect) {
    suggestions.push({
      item: 'Leftovers',
      reason: 'Passive 6% HP recovery each turn — stacks with Protect stalling',
      priority: 12,
    });
  }

  if (isFast && !hasSetup) {
    suggestions.push({
      item: 'Choice Scarf',
      reason: '1.5x Speed — outspeeds the entire meta, locked into one move',
      priority: 11,
    });
  }

  if (hasSetup) {
    suggestions.push({
      item: 'Lum Berry',
      reason: 'Cures burn/paralysis/sleep — protects setup sweepers from status',
      priority: 11,
    });
  }

  // ─── Priority 4: Type-boost items (good but not top tier) ─────
  if (primaryMoveType) {
    const boostItem = TYPE_BOOST_ITEMS[primaryMoveType];
    if (boostItem) {
      suggestions.push({
        item: boostItem,
        reason: `20% boost to ${primaryMoveType}-type moves`,
        priority: 9,
      });
    }
  }

  // STAB boost for secondary type
  for (const type of types) {
    const boostItem = TYPE_BOOST_ITEMS[type];
    if (boostItem && !suggestions.some(s => s.item === boostItem)) {
      suggestions.push({
        item: boostItem,
        reason: `20% boost to ${type}-type STAB`,
        priority: 7,
      });
    }
  }

  // ─── Priority 5: Defensive berries ────────────────────────────
  // Suggest resist berry for worst weakness
  const weaknessMap: Record<string, string> = {
    Fire: 'Occa Berry', Water: 'Passho Berry', Electric: 'Wacan Berry',
    Grass: 'Rindo Berry', Ice: 'Yache Berry', Fighting: 'Chople Berry',
    Poison: 'Kebia Berry', Ground: 'Shuca Berry', Flying: 'Coba Berry',
    Psychic: 'Payapa Berry', Bug: 'Tanga Berry', Rock: 'Charti Berry',
    Ghost: 'Kasib Berry', Dragon: 'Haban Berry', Dark: 'Colbur Berry',
    Steel: 'Babiri Berry', Fairy: 'Roseli Berry',
  };
  // Find 4x weaknesses
  for (const [weakType, berry] of Object.entries(weaknessMap)) {
    let mult = 1;
    for (const t of types) {
      // Simple check - would need type chart for accuracy
      // Just suggest common ones for now
    }
  }

  // ─── Priority 6: General utility ──────────────────────────────
  if (!suggestions.some(s => s.item === 'Lum Berry')) {
    suggestions.push({
      item: 'Lum Berry',
      reason: 'Status cure — prevents Spore, Will-O-Wisp, Thunder Wave',
      priority: 5,
    });
  }

  suggestions.push({
    item: 'Focus Band',
    reason: '10% chance to survive any hit — luck-based but clutch',
    priority: 3,
  });

  // Filter out taken items, deduplicate, sort
  const seen = new Set<string>();
  return suggestions
    .filter(s => !takenItems.has(s.item))
    .filter(s => {
      if (seen.has(s.item)) return false;
      seen.add(s.item);
      return true;
    })
    .sort((a, b) => b.priority - a.priority);
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
