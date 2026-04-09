import type { PokemonState, NatureName } from '../types';
import { createDefaultPokemonState } from '../types';
import { MAX_STAT_SP, NATURES } from '../data/champions';

// Parse a Showdown-format set into PokemonState
// Format example:
// Garchomp @ Life Orb
// Ability: Rough Skin
// Level: 50
// EVs: 252 Atk / 252 Spe / 4 SpD
// Jolly Nature
// - Earthquake
// - Dragon Claw
// - Iron Head
// - Protect
export function importShowdownSet(text: string): PokemonState | null {
  try {
    const state = createDefaultPokemonState();
    const lines = text.trim().split('\n').map(l => l.trim());
    if (lines.length === 0) return null;

    // First line: Name @ Item or just Name
    const firstLine = lines[0];
    const itemMatch = firstLine.match(/^(.+?)\s*@\s*(.+)$/);
    if (itemMatch) {
      // Could be "Nickname (Species) @ Item" or "Species @ Item"
      const nameOrNick = itemMatch[1].trim();
      state.item = itemMatch[2].trim();
      const speciesMatch = nameOrNick.match(/\((.+)\)/);
      state.species = speciesMatch ? speciesMatch[1].trim() : nameOrNick;
    } else {
      const speciesMatch = firstLine.match(/\((.+)\)/);
      state.species = speciesMatch ? speciesMatch[1].trim() : firstLine.replace(/\s*\(.*\)/, '').trim();
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('Ability:')) {
        state.ability = line.replace('Ability:', '').trim();
      } else if (line.startsWith('Tera Type:')) {
        // Tera is not available in Champions — ignore imported Tera Type
      } else if (line.startsWith('Level:')) {
        state.level = parseInt(line.replace('Level:', '').trim()) || 50;
      } else if (line.startsWith('EVs:') || line.startsWith('SPs:')) {
        // Parse EV/SP line: "252 Atk / 252 Spe / 4 SpD"
        const label = line.startsWith('SPs:') ? 'SPs:' : 'EVs:';
        const evStr = line.replace(label, '').trim();
        const parts = evStr.split('/').map(p => p.trim());
        const isSP = label === 'SPs:';
        for (const part of parts) {
          const match = part.match(/(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)/);
          if (match) {
            const value = parseInt(match[1]);
            const stat = match[2];
            const statMap: Record<string, keyof typeof state.sps> = {
              HP: 'hp', Atk: 'atk', Def: 'def', SpA: 'spa', SpD: 'spd', Spe: 'spe'
            };
            const key = statMap[stat];
            if (key) {
              // If EVs, convert to SP: divide by 4 (approximate)
              state.sps[key] = isSP ? Math.min(value, MAX_STAT_SP) : Math.min(Math.floor(value / 4), MAX_STAT_SP);
            }
          }
        }
      } else if (line.endsWith('Nature')) {
        const natureName = line.replace('Nature', '').trim();
        const validNature = NATURES.find(n => n.name === natureName);
        if (validNature) {
          state.nature = natureName as NatureName;
        }
      } else if (line.startsWith('-')) {
        const moveName = line.replace(/^-\s*/, '').trim();
        const emptySlot = state.moves.indexOf('');
        if (emptySlot !== -1) {
          state.moves[emptySlot] = moveName;
        }
      }
    }

    return state.species ? state : null;
  } catch {
    return null;
  }
}

// Export PokemonState to Showdown format (using SPs instead of EVs)
export function exportShowdownSet(state: PokemonState): string {
  if (!state.species) return '';

  const lines: string[] = [];

  // First line
  let firstLine = state.species;
  if (state.item) firstLine += ` @ ${state.item}`;
  lines.push(firstLine);

  if (state.ability) lines.push(`Ability: ${state.ability}`);
  // Tera Type not exported — not available in Champions
  lines.push(`Level: ${state.level}`);

  // SP line
  const statNames: Record<string, string> = {
    hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe'
  };
  const spParts: string[] = [];
  for (const [stat, value] of Object.entries(state.sps)) {
    if (value > 0) {
      spParts.push(`${value} ${statNames[stat]}`);
    }
  }
  if (spParts.length > 0) {
    lines.push(`SPs: ${spParts.join(' / ')}`);
  }

  lines.push(`${state.nature} Nature`);

  // Moves
  for (const move of state.moves) {
    if (move) lines.push(`- ${move}`);
  }

  return lines.join('\n');
}

// Export both sides to clipboard
export function exportBothSets(attacker: PokemonState, defender: PokemonState): string {
  const parts: string[] = [];
  if (attacker.species) parts.push(exportShowdownSet(attacker));
  if (defender.species) parts.push(exportShowdownSet(defender));
  return parts.join('\n\n');
}
