// Archetype Detection & Move Suggestions
// Detects role from SP spread, provides multiple viable archetype options

import { getPokemonData } from '../data/champions';
import { getCachedUsageStats } from '../data/liveData';
import type { StatsTable } from '@smogon/calc';
import type { NatureName } from '../types';

export interface Archetype {
  name: string;
  description: string;
  nature: NatureName;
  sps: StatsTable;
  moves: string[];
  item: string;
  tags: string[];
}

export function detectArchetype(species: string, sps: StatsTable, nature: NatureName): string {
  const data = getPokemonData(species);
  if (!data) return 'Unknown';
  const isPhys = data.baseStats.atk > data.baseStats.spa;
  const mainOff = isPhys ? sps.atk : sps.spa;
  const isMinSpeed = sps.spe === 0 && ['Brave', 'Quiet', 'Relaxed', 'Sassy'].includes(nature);

  if (isMinSpeed && mainOff >= 20) return 'Trick Room Attacker';
  if (isMinSpeed && sps.hp >= 20) return 'Trick Room Tank';
  if (sps.spe >= 20 && mainOff >= 20 && sps.hp < 16) return 'Speed Sweeper';
  if (mainOff >= 20 && sps.hp >= 20 && sps.spe < 16) return 'Bulky Attacker';
  if (sps.hp >= 20 && (sps.def >= 16 || sps.spd >= 16) && mainOff < 16) return 'Defensive Wall';
  if (sps.hp >= 20 && (sps.def >= 12 || sps.spd >= 12)) return 'Bulky Pivot';
  if (mainOff >= 24 && sps.spe >= 16) return 'Offensive';
  if (sps.hp >= 20) return 'Support';
  return 'Flexible';
}

export function getArchetypes(species: string): Archetype[] {
  const data = getPokemonData(species);
  if (!data) return [];
  const bs = data.baseStats;
  const isPhys = bs.atk > bs.spa;
  const archetypes: Archetype[] = [];
  const stats = getCachedUsageStats();
  const liveData = stats?.pokemon?.[species];

  if (liveData) {
    const spreadEntries = Object.entries(liveData.spreads)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 8);
    const topMoves = Object.entries(liveData.moves)
      .sort((a, b) => (b[1] as number) - (a[1] as number));
    const seenArchetypes = new Set<string>();

    for (const [spreadStr] of spreadEntries) {
      const [natureName, evStr] = spreadStr.split(':');
      if (!natureName || !evStr) continue;
      const evParts = evStr.split('/').map(Number);
      if (evParts.length !== 6) continue;

      const totalEVs = evParts.reduce((a, b) => a + b, 0) || 510;
      const sps: StatsTable = {
        hp: Math.min(32, Math.round((evParts[0] / totalEVs) * 66)),
        atk: Math.min(32, Math.round((evParts[1] / totalEVs) * 66)),
        def: Math.min(32, Math.round((evParts[2] / totalEVs) * 66)),
        spa: Math.min(32, Math.round((evParts[3] / totalEVs) * 66)),
        spd: Math.min(32, Math.round((evParts[4] / totalEVs) * 66)),
        spe: Math.min(32, Math.round((evParts[5] / totalEVs) * 66)),
      };
      let total = Object.values(sps).reduce((a, b) => a + b, 0);
      while (total > 66) { const e = Object.entries(sps).filter(([,v])=>v>0).sort((a,b)=>a[1]-b[1]); if(!e.length) break; (sps as any)[e[0][0]]--; total--; }
      while (total < 66) { const e = Object.entries(sps).sort((a,b)=>b[1]-a[1]); const t = e.find(([,v])=>v<32); if(!t) break; (sps as any)[t[0]]++; total++; }

      const archName = detectArchetype(species, sps, natureName as NatureName);
      if (seenArchetypes.has(archName)) continue;
      seenArchetypes.add(archName);

      const moves = pickMovesForArchetype(archName, topMoves);
      const item = pickItemForArchetype(archName, bs);

      archetypes.push({
        name: archName,
        description: `${archName} ${species} — ${natureName} nature`,
        nature: natureName as NatureName,
        sps, moves, item,
        tags: archName.toLowerCase().split(' '),
      });

      if (archetypes.length >= 4) break;
    }
  }

  if (archetypes.length === 0) {
    // Fallback defaults
    if (bs.spe >= 70) {
      archetypes.push({
        name: 'Speed Sweeper', description: `Fast offensive ${species}`,
        nature: isPhys ? 'Jolly' : 'Timid',
        sps: { hp: 2, atk: isPhys?32:0, def: 0, spa: isPhys?0:32, spd: 0, spe: 32 },
        moves: [], item: 'Focus Sash', tags: ['offensive', 'fast'],
      });
    }
    archetypes.push({
      name: 'Bulky Attacker', description: `Bulky offensive ${species}`,
      nature: isPhys ? 'Adamant' : 'Modest',
      sps: { hp: 32, atk: isPhys?32:0, def: 2, spa: isPhys?0:32, spd: 0, spe: 0 },
      moves: [], item: 'Sitrus Berry', tags: ['bulky', 'offensive'],
    });
    if (bs.spe <= 60) {
      archetypes.push({
        name: 'Trick Room', description: `Trick Room ${species}`,
        nature: isPhys ? 'Brave' : 'Quiet',
        sps: { hp: 32, atk: isPhys?32:0, def: 2, spa: isPhys?0:32, spd: 0, spe: 0 },
        moves: [], item: 'Sitrus Berry', tags: ['trick', 'room'],
      });
    }
  }

  return archetypes;
}

function pickMovesForArchetype(archetype: string, allMoves: [string, number][]): string[] {
  const moves: string[] = [];
  const offMoves = allMoves.filter(([, w]) => w > 0.05).slice(0, 6).map(([n]) => n);
  const statusMoves = allMoves.filter(([, w]) => w > 0.02).map(([n]) => n);

  switch (archetype) {
    case 'Speed Sweeper': case 'Offensive':
      for (const m of offMoves) { if (moves.length >= 3) break; if (!moves.includes(m)) moves.push(m); }
      if (statusMoves.includes('Protect') && !moves.includes('Protect')) moves.push('Protect');
      break;
    case 'Bulky Attacker':
      for (const m of offMoves) { if (moves.length >= 2) break; if (!moves.includes(m)) moves.push(m); }
      if (statusMoves.includes('Protect') && !moves.includes('Protect')) moves.push('Protect');
      for (const m of offMoves) { if (moves.length >= 4) break; if (!moves.includes(m)) moves.push(m); }
      break;
    case 'Trick Room Attacker': case 'Trick Room Tank':
      for (const m of offMoves) { if (moves.length >= 2) break; if (!moves.includes(m)) moves.push(m); }
      if (statusMoves.includes('Trick Room') && !moves.includes('Trick Room')) moves.push('Trick Room');
      if (statusMoves.includes('Protect') && !moves.includes('Protect')) moves.push('Protect');
      break;
    case 'Defensive Wall': case 'Support': case 'Bulky Pivot':
      if (offMoves.length > 0) moves.push(offMoves[0]);
      for (const m of statusMoves) { if (moves.length >= 4) break; if (!moves.includes(m)) moves.push(m); }
      break;
    default:
      for (const m of offMoves) { if (moves.length >= 3) break; if (!moves.includes(m)) moves.push(m); }
      if (statusMoves.includes('Protect') && !moves.includes('Protect')) moves.push('Protect');
  }
  while (moves.length < 4) {
    const next = offMoves.find(m => !moves.includes(m)) || statusMoves.find(m => !moves.includes(m));
    if (next) moves.push(next); else break;
  }
  return moves.slice(0, 4);
}

function pickItemForArchetype(
  archetype: string,
  bs: { hp: number; def: number; spd: number; spe: number },
): string {
  switch (archetype) {
    case 'Speed Sweeper': case 'Offensive':
      return bs.hp + bs.def + bs.spd < 230 ? 'Focus Sash' : 'Choice Scarf';
    case 'Bulky Attacker': return 'Sitrus Berry';
    case 'Trick Room Attacker': case 'Trick Room Tank': return 'Sitrus Berry';
    case 'Defensive Wall': return 'Leftovers';
    default: return 'Sitrus Berry';
  }
}
