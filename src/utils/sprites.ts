// Pokemon sprite URLs
// Uses Showdown's animated sprites as primary, with intelligent fallbacks

const nameToIdCache: Record<string, string> = {};

// New Z-A Megas that DON'T have sprites on Showdown yet
// Fall back to base form sprite for these
const MISSING_MEGA_SPRITES = new Set([
  'Excadrill-Mega', 'Delphox-Mega', 'Greninja-Mega', 'Chesnaught-Mega',
  'Hawlucha-Mega', 'Chimecho-Mega', 'Crabominable-Mega', 'Golurk-Mega',
  'Drampa-Mega', 'Chandelure-Mega', 'Scovillain-Mega', 'Glimmora-Mega',
  'Meowstic-M-Mega', 'Meowstic-F-Mega', 'Victreebel-Mega', 'Floette-Mega',
]);

function speciesNameToId(name: string): string {
  if (nameToIdCache[name]) return nameToIdCache[name];

  // If this Mega has no sprite, use base form
  if (MISSING_MEGA_SPRITES.has(name)) {
    const baseName = name.replace(/-Mega$/, '').replace(/-M-Mega$/, '').replace(/-F-Mega$/, '');
    const baseId = baseName.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
    nameToIdCache[name] = baseId;
    return baseId;
  }

  let id = name.toLowerCase();

  // Showdown Mega naming: collapse "-mega-x" to "-megax"
  id = id.replace(/-mega-x$/, '-megax');
  id = id.replace(/-mega-y$/, '-megay');
  id = id.replace(/-mega-z$/, '-megaz');

  // Clean up
  id = id.replace(/[^a-z0-9-]/g, '');
  id = id.replace(/-+/g, '-');
  id = id.replace(/^-|-$/g, '');

  nameToIdCache[name] = id;
  return id;
}

// Export the converter so inline sprite URLs can use it
export function getSpriteId(species: string): string {
  return speciesNameToId(species);
}

// Primary: animated GIF
export function getSpriteUrl(species: string): string {
  if (!species) return '';
  return `https://play.pokemonshowdown.com/sprites/ani/${speciesNameToId(species)}.gif`;
}

// Fallback: static high-quality PNG
export function getSpriteFallbackUrl(species: string): string {
  if (!species) return '';
  return `https://play.pokemonshowdown.com/sprites/dex/${speciesNameToId(species)}.png`;
}
