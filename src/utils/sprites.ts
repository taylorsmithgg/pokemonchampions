// Pokemon sprite URLs — SINGLE SOURCE OF TRUTH
// Every sprite in the app must go through these functions.
// Do NOT construct sprite URLs inline anywhere.

const nameToIdCache: Record<string, string> = {};

// Z-A Megas Showdown ships as static-only (dex PNG exists, ani GIF 404s).
// For these, getSpriteUrl returns the dex URL directly so the UI renders
// the actual Mega artwork instead of flashing through a broken ani URL.
const STATIC_ONLY_MEGAS = new Set([
  'Golurk-Mega', 'Delphox-Mega', 'Greninja-Mega', 'Chesnaught-Mega',
  'Excadrill-Mega', 'Hawlucha-Mega', 'Crabominable-Mega', 'Chimecho-Mega',
  'Drampa-Mega', 'Chandelure-Mega', 'Scovillain-Mega', 'Glimmora-Mega',
]);

// Z-A Megas with no Showdown sprite at all (both ani + dex 404) —
// fall back to rendering the base-form sprite so at least something
// shows up.
const MISSING_MEGA_SPRITES = new Set([
  'Meowstic-M-Mega', 'Meowstic-F-Mega', 'Floette-Mega',
]);

// Explicit Showdown sprite IDs for species whose name contains a
// hyphen or special character that ISN'T a form separator. The
// general transform below preserves hyphens so it can distinguish
// "Charizard-Mega-X" from "Charizard", but that's wrong for
// species like Kommo-o whose hyphen is part of the base name and
// gets stripped in Showdown's sprite URL.
const SPECIES_ID_ALIASES: Record<string, string> = {
  'Kommo-o': 'kommoo',
  'Hakamo-o': 'hakamoo',
  'Jangmo-o': 'jangmoo',
  'Ho-Oh': 'hooh',
  'Porygon-Z': 'porygonz',
  // Showdown uses base name or different hyphenation for these
  'Aegislash-Shield': 'aegislash',
  'Aegislash-Blade': 'aegislash-blade',
  'Floette-Eternal': 'floette-eternal',
  'Basculegion-F': 'basculegion-f',
  'Meowstic-F': 'meowstic-f',
  'Tauros-Paldea-Combat': 'tauros-paldeacombat',
  'Tauros-Paldea-Blaze': 'tauros-paldeablaze',
  'Tauros-Paldea-Aqua': 'tauros-paldeaaqua',
};

function speciesNameToId(name: string): string {
  if (nameToIdCache[name]) return nameToIdCache[name];

  // Explicit alias — takes precedence over the generic transform so
  // we can override special cases like Kommo-o → kommoo.
  const alias = SPECIES_ID_ALIASES[name];
  if (alias) {
    nameToIdCache[name] = alias;
    return alias;
  }

  // Megas with no sprite → use base form
  if (MISSING_MEGA_SPRITES.has(name)) {
    const baseName = name.replace(/-Mega$/, '').replace(/-[MF]-Mega$/, '');
    // Check the alias map for the base too (e.g., a hypothetical
    // Kommo-o-Mega would want to fall back to "kommoo")
    const baseAlias = SPECIES_ID_ALIASES[baseName];
    if (baseAlias) {
      nameToIdCache[name] = baseAlias;
      return baseAlias;
    }
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
  // Static-only Megas: skip the 404-bound ani URL, serve the dex PNG
  // directly so the Mega artwork is what actually renders.
  if (STATIC_ONLY_MEGAS.has(species)) return getSpriteFallbackUrl(species);
  return `https://play.pokemonshowdown.com/sprites/ani/${speciesNameToId(species)}.gif`;
}

// Static sprite (fallback)
export function getSpriteFallbackUrl(species: string): string {
  if (!species) return '';
  // Static-only Megas keep their Mega name here (dex PNG exists). The
  // speciesNameToId map only redirects them via MISSING_MEGA_SPRITES,
  // which they aren't in — so "Golurk-Mega" → "golurk-mega" naturally.
  return `https://play.pokemonshowdown.com/sprites/dex/${speciesNameToId(species)}.png`;
}
