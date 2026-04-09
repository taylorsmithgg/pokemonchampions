// Pokemon sprite URLs
// Uses Showdown's animated sprites as primary, static as fallback

const nameToIdCache: Record<string, string> = {};

// Showdown uses specific naming for forms — handle special cases
const SPRITE_NAME_OVERRIDES: Record<string, string> = {
  'Charizard-Mega-X': 'charizard-megax',
  'Charizard-Mega-Y': 'charizard-megay',
  'Mewtwo-Mega-X': 'mewtwo-megax',
  'Mewtwo-Mega-Y': 'mewtwo-megay',
  'Ninetales-Alola': 'ninetales-alola',
  'Rotom-Wash': 'rotom-wash',
  'Rotom-Heat': 'rotom-heat',
  'Rotom-Mow': 'rotom-mow',
  'Rotom-Fan': 'rotom-fan',
  'Rotom-Frost': 'rotom-frost',
};

function speciesNameToId(name: string): string {
  if (nameToIdCache[name]) return nameToIdCache[name];

  // Check overrides first
  if (SPRITE_NAME_OVERRIDES[name]) {
    nameToIdCache[name] = SPRITE_NAME_OVERRIDES[name];
    return SPRITE_NAME_OVERRIDES[name];
  }

  // Standard conversion: lowercase, keep hyphens, remove other special chars
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  nameToIdCache[name] = id;
  return id;
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

// Second fallback: gen5 static
export function getGen5SpriteUrl(species: string): string {
  if (!species) return '';
  return `https://play.pokemonshowdown.com/sprites/gen5/${speciesNameToId(species)}.png`;
}
