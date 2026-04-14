// Z-A Mega Evolution stat overrides.
//
// Smogon's @smogon/calc Gen 9 data predates Legends: Z-A, so the new
// Megas introduced in Z-A (and carried into Champions) have no species
// entry. Without an override, `resolveForm` silently falls through and
// the damage calc uses base-form stats — wrong.
//
// This table is the Champions-specific truth for Z-A Mega stat blocks.
// Stats sourced from Bulbapedia. Add entries as they are confirmed.

import type { StatsTable } from '@smogon/calc';

export interface ZAMegaEntry {
  formName: string;              // e.g., 'Golurk-Mega'
  baseSpecies: string;           // e.g., 'Golurk'
  stone: string;                 // e.g., 'Golurkite'
  types: [string] | [string, string];
  ability: string;               // forced Mega ability
  baseStats: StatsTable;
  weightkg: number;
}

export const Z_A_MEGA_DATA: Record<string, ZAMegaEntry> = {
  'Golurk-Mega': {
    formName: 'Golurk-Mega',
    baseSpecies: 'Golurk',
    stone: 'Golurkite',
    types: ['Ground', 'Ghost'],
    ability: 'Cacophony',
    baseStats: { hp: 89, atk: 159, def: 105, spa: 70, spd: 105, spe: 55 },
    weightkg: 330,
  },
};

export function getZAMegaByForm(formName: string): ZAMegaEntry | undefined {
  return Z_A_MEGA_DATA[formName];
}

export function getZAMegaByStone(baseSpecies: string, item: string): ZAMegaEntry | undefined {
  if (!item) return undefined;
  for (const entry of Object.values(Z_A_MEGA_DATA)) {
    if (entry.baseSpecies === baseSpecies && entry.stone === item) return entry;
  }
  return undefined;
}
