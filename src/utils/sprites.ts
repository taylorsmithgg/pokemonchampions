// Pokemon sprite URLs
// Uses Showdown's animated sprites as primary, static as fallback

const nameToIdCache: Record<string, string> = {};

function speciesNameToId(name: string): string {
  if (nameToIdCache[name]) return nameToIdCache[name];

  let id = name.toLowerCase();

  // Showdown Mega naming: "Charizard-Mega-X" → "charizard-megax" (no hyphen before X/Y)
  // Generic pattern: collapse "-mega-" to "-mega" for all Mega forms
  id = id.replace(/-mega-x$/, '-megax');
  id = id.replace(/-mega-y$/, '-megay');
  id = id.replace(/-mega-z$/, '-megaz');
  // For Megas without X/Y/Z suffix: "Gengar-Mega" → "gengar-mega" (already correct)

  // Clean up non-alphanumeric (keep hyphens)
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
