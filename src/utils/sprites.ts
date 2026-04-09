// Pokemon sprite URLs — SINGLE SOURCE OF TRUTH
// Every sprite in the app must go through these functions.
// Do NOT construct sprite URLs inline anywhere.

const nameToIdCache: Record<string, string> = {};

// New Z-A Megas without Showdown sprites — fall back to base form
const MISSING_MEGA_SPRITES = new Set([
  'Excadrill-Mega', 'Delphox-Mega', 'Greninja-Mega', 'Chesnaught-Mega',
  'Hawlucha-Mega', 'Chimecho-Mega', 'Crabominable-Mega', 'Golurk-Mega',
  'Drampa-Mega', 'Chandelure-Mega', 'Scovillain-Mega', 'Glimmora-Mega',
  'Meowstic-M-Mega', 'Meowstic-F-Mega', 'Victreebel-Mega', 'Floette-Mega',
]);

function speciesNameToId(name: string): string {
  if (nameToIdCache[name]) return nameToIdCache[name];

  // Megas with no sprite → use base form
  if (MISSING_MEGA_SPRITES.has(name)) {
    const baseName = name.replace(/-Mega$/, '').replace(/-[MF]-Mega$/, '');
    const baseId = baseName.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
    nameToIdCache[name] = baseId;
    return baseId;
  }

  let id = name.toLowerCase();

  // Showdown naming: "Charizard-Mega-X" → "charizard-megax"
  id = id.replace(/-mega-x$/, '-megax');
  id = id.replace(/-mega-y$/, '-megay');
  id = id.replace(/-mega-z$/, '-megaz');

  id = id.replace(/[^a-z0-9-]/g, '');
  id = id.replace(/-+/g, '-');
  id = id.replace(/^-|-$/g, '');

  nameToIdCache[name] = id;
  return id;
}

// Animated sprite (primary)
export function getSpriteUrl(species: string): string {
  if (!species) return '';
  return `https://play.pokemonshowdown.com/sprites/ani/${speciesNameToId(species)}.gif`;
}

// Static sprite (fallback)
export function getSpriteFallbackUrl(species: string): string {
  if (!species) return '';
  return `https://play.pokemonshowdown.com/sprites/dex/${speciesNameToId(species)}.png`;
}
