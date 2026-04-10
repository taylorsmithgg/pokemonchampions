// Archetype Detection & Move Suggestions
// Detects role from SP spread, provides multiple viable archetype options

import { getPokemonData } from '../data/champions';
import { getCachedUsageStats } from '../data/liveData';
import { getPresetsBySpecies } from '../data/presets';
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
  const bs = data.baseStats;
  const isPhys = bs.atk > bs.spa;
  const mainOff = isPhys ? sps.atk : sps.spa;
  const maxBaseOff = Math.max(bs.atk, bs.spa);
  const isMinSpeed = sps.spe === 0 && ['Brave', 'Quiet', 'Relaxed', 'Sassy'].includes(nature);

  // Species with weak offense and high bulk should never be called a
  // Trick Room Attacker or Bulky Attacker — they're walls no matter
  // what spread the user picks.
  const isInherentlyDefensive = maxBaseOff < 80 && bs.hp + Math.max(bs.def, bs.spd) > 200;
  if (isInherentlyDefensive) {
    if (sps.hp >= 20 && sps.def >= sps.spd) return 'Physical Wall';
    if (sps.hp >= 20 && sps.spd > sps.def) return 'Special Wall';
    return 'Defensive Wall';
  }

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
  const maxOff = Math.max(bs.atk, bs.spa);
  const bulk = bs.hp + Math.max(bs.def, bs.spd);
  const archetypes: Archetype[] = [];
  const stats = getCachedUsageStats();
  const liveData = stats?.pokemon?.[species];

  // Preset fallback — used to fill moves/items when live data is
  // missing or when a preset captures a build the archetype engine
  // can't derive (e.g., purely defensive walls with no VGC 2026
  // presence in the usage stats).
  const presets = getPresetsBySpecies(species);
  const presetMoves = presets.length > 0 ? [...presets[0].moves] : [];
  const presetItem = presets[0]?.item || '';

  // A species is "inherently defensive" if it lacks offensive stats
  // but has real bulk. For these, Trick Room / Bulky Attacker are
  // never meaningful archetypes — we always want Defensive Wall.
  const isInherentlyDefensive = maxOff < 80 && bulk > 180;

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

      // Skip offensive archetypes the species physically can't run.
      // Example: Avalugg has no offensive presence — any live-data
      // spread that gets classified as "Bulky Attacker" should be
      // rerouted to a wall role to match the projection engine.
      let archName = detectArchetype(species, sps, natureName as NatureName);
      if (isInherentlyDefensive && (archName.includes('Attacker') || archName === 'Speed Sweeper' || archName === 'Offensive')) {
        archName = bs.def >= bs.spd ? 'Physical Wall' : 'Special Wall';
      }
      if (seenArchetypes.has(archName)) continue;
      seenArchetypes.add(archName);

      const liveMoves = pickMovesForArchetype(archName, topMoves);
      // If the usage data didn't yield any moves (thin profiles for
      // lower-tier Pokemon), borrow from the preset library so the
      // Optimize button produces a usable set.
      const moves = liveMoves.filter(Boolean).length > 0 ? liveMoves : presetMoves;
      const item = pickItemForArchetype(archName, bs) || presetItem;

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
    // Data-aware fallback. This runs for species with no VGC 2026
    // usage data (e.g., lower-tier walls, Z-A exclusives). The
    // classification keys off base stats so we don't propose
    // "Bulky Attacker" for a species with 46 base Attack.
    if (isInherentlyDefensive) {
      const defNature: NatureName = bs.def >= bs.spd ? 'Impish' : 'Careful';
      const defName = bs.def >= bs.spd ? 'Physical Wall' : 'Special Wall';
      archetypes.push({
        name: defName,
        description: `Defensive ${species} — ${defNature} nature`,
        nature: defNature,
        sps: {
          hp: 32,
          atk: 0,
          def: bs.def >= bs.spd ? 32 : 2,
          spa: 0,
          spd: bs.def >= bs.spd ? 2 : 32,
          spe: 0,
        },
        moves: presetMoves,
        item: presetItem || 'Leftovers',
        tags: ['defensive', 'wall'],
      });
    } else {
      if (bs.spe >= 70 && maxOff >= 80) {
        archetypes.push({
          name: 'Speed Sweeper', description: `Fast offensive ${species}`,
          nature: isPhys ? 'Jolly' : 'Timid',
          sps: { hp: 2, atk: isPhys?32:0, def: 0, spa: isPhys?0:32, spd: 0, spe: 32 },
          moves: presetMoves, item: presetItem || 'Focus Sash', tags: ['offensive', 'fast'],
        });
      }
      if (maxOff >= 80) {
        archetypes.push({
          name: 'Bulky Attacker', description: `Bulky offensive ${species}`,
          nature: isPhys ? 'Adamant' : 'Modest',
          sps: { hp: 32, atk: isPhys?32:0, def: 2, spa: isPhys?0:32, spd: 0, spe: 0 },
          moves: presetMoves, item: presetItem || 'Sitrus Berry', tags: ['bulky', 'offensive'],
        });
      }
      if (bs.spe <= 60 && maxOff >= 80) {
        archetypes.push({
          name: 'Trick Room Attacker', description: `Trick Room ${species}`,
          nature: isPhys ? 'Brave' : 'Quiet',
          sps: { hp: 32, atk: isPhys?32:0, def: 2, spa: isPhys?0:32, spd: 0, spe: 0 },
          moves: presetMoves, item: presetItem || 'Sitrus Berry', tags: ['trick', 'room'],
        });
      }
      // Absolute last resort — species has no live data, no preset,
      // and doesn't cleanly fit any offensive profile. Propose a
      // flexible bulky spread so the button still does something.
      if (archetypes.length === 0) {
        archetypes.push({
          name: 'Bulky Pivot', description: `Flexible ${species}`,
          nature: isPhys ? 'Adamant' : 'Modest',
          sps: { hp: 24, atk: isPhys?24:0, def: 6, spa: isPhys?0:24, spd: 6, spe: 6 },
          moves: presetMoves, item: presetItem || 'Sitrus Berry', tags: ['flexible'],
        });
      }
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
    case 'Defensive Wall': case 'Physical Wall': case 'Special Wall':
    case 'Support': case 'Bulky Pivot':
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
    case 'Defensive Wall': case 'Physical Wall': case 'Special Wall':
      return 'Leftovers';
    default: return 'Sitrus Berry';
  }
}
