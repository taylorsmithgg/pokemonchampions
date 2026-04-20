export interface SelectionReferenceSeed {
  imageUrl: string;
  species: string;
  region: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

const lineupSelectionNoOverlayUrl = new URL('../../images/lineup-selection-no-overlay.png', import.meta.url).href;
const lineupSelectionLockOverlayUrl = new URL('../../images/lineup-selection-lock-overlay.png', import.meta.url).href;
const lineupSelectionOverlayUrl = new URL('../../images/lineup-selection-overlay.png', import.meta.url).href;

const ROW_Y = [0.09, 0.207, 0.324, 0.441, 0.558, 0.675];
const ROW_H = 0.095;

function rowSeeds(
  imageUrl: string,
  species: string[],
  x: number,
  w: number,
): SelectionReferenceSeed[] {
  return species.map((entry, index) => ({
    imageUrl,
    species: entry,
    region: {
      x,
      y: ROW_Y[index],
      w,
      h: ROW_H,
    },
  }));
}

export const SELECTION_REFERENCE_SEEDS: SelectionReferenceSeed[] = [
  ...rowSeeds(
    lineupSelectionNoOverlayUrl,
    ['Garchomp', 'Floette-Eternal', 'Delphox', 'Primarina', 'Kingambit', 'Aegislash-Shield'],
    0.205,
    0.11,
  ),
  ...rowSeeds(
    lineupSelectionNoOverlayUrl,
    ['Victreebel', 'Toucannon', 'Sableye', 'Primarina', 'Hydreigon', 'Scizor'],
    0.765,
    0.105,
  ),
  ...rowSeeds(
    lineupSelectionLockOverlayUrl,
    ['Bellibolt', 'Mimikyu', 'Ninetales-Alola', 'Kingambit', 'Incineroar', 'Kommo-o'],
    0.165,
    0.11,
  ),
  {
    imageUrl: lineupSelectionLockOverlayUrl,
    species: 'Bellibolt',
    region: {
      x: 0.115,
      y: ROW_Y[0],
      w: 0.16,
      h: ROW_H,
    },
  },
  ...[
    { species: 'Starmie', row: 0 },
    { species: 'Talonflame', row: 1 },
    { species: 'Lopunny', row: 2 },
    { species: 'Sableye', row: 3 },
    { species: 'Meowscarada', row: 4 },
    { species: 'Skarmory', row: 5 },
  ].map(entry => ({
    imageUrl: lineupSelectionLockOverlayUrl,
    species: entry.species,
    region: {
      x: 0.708,
      y: ROW_Y[entry.row],
      w: 0.118,
      h: ROW_H,
    },
  })),
  ...rowSeeds(
    lineupSelectionOverlayUrl,
    ['Weavile', 'Aerodactyl', 'Gallade', 'Appletun', 'Goodra', 'Heliolisk'],
    0.203,
    0.109,
  ),
  ...rowSeeds(
    lineupSelectionOverlayUrl,
    ['Rotom-Wash', 'Aegislash-Shield', 'Lycanroc', 'Lucario', 'Garchomp', 'Delphox'],
    0.796,
    0.088,
  ),
];
