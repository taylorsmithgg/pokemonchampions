// Archetype → Wiki slug mapping.
//
// App surfaces (Meta Projection cores, Team Comp archetype badges,
// Team Audit role labels, etc.) all need to link back to the
// corresponding wiki deep-dive article. This helper centralizes the
// name → slug lookup so every callsite links consistently and adding
// a new archetype only requires one edit here.

const ARCHETYPE_SLUGS: Record<string, string> = {
  // Doubles projection core names
  'Mega Sol Sun': 'pokemon-champions-sun-archetype-guide',
  'Sun': 'pokemon-champions-sun-archetype-guide',
  'Sun Offense': 'pokemon-champions-sun-archetype-guide',
  'Sand': 'pokemon-champions-sand-archetype-guide',
  'Sand Offense': 'pokemon-champions-sand-archetype-guide',
  'Mega Froslass Snow': 'pokemon-champions-snow-archetype-guide',
  'Snow': 'pokemon-champions-snow-archetype-guide',
  'Snow Offense': 'pokemon-champions-snow-archetype-guide',
  'Rain': 'pokemon-champions-rain-archetype-guide',
  'Rain Offense': 'pokemon-champions-rain-archetype-guide',
  'Trick Room': 'pokemon-champions-trick-room-archetype-guide',
  'Tailwind': 'pokemon-champions-tailwind-archetype-guide',
  'Tailwind Offense': 'pokemon-champions-tailwind-archetype-guide',
  // Doubles
  'Hyper Offense': 'pokemon-champions-hyper-offense-archetype-guide',
  // Doubles Intimidate goodstuff
  'Balance': 'pokemon-champions-intimidate-balance-archetype-guide',
  'Balanced Goodstuffs': 'pokemon-champions-intimidate-balance-archetype-guide',
  'Intimidate Balance': 'pokemon-champions-intimidate-balance-archetype-guide',
  // Stall has no dedicated article — closest reference is Singles Balance
  'Stall': 'pokemon-champions-singles-balance-archetype-guide',
};

// Team comp archetype IDs (lowercase, hyphenated) used in teams.ts.
const TEAM_ARCHETYPE_ID_SLUGS: Record<string, string> = {
  sun: 'pokemon-champions-sun-archetype-guide',
  sand: 'pokemon-champions-sand-archetype-guide',
  rain: 'pokemon-champions-rain-archetype-guide',
  snow: 'pokemon-champions-snow-archetype-guide',
  'trick-room': 'pokemon-champions-trick-room-archetype-guide',
  tailwind: 'pokemon-champions-tailwind-archetype-guide',
  'hyper-offense': 'pokemon-champions-hyper-offense-archetype-guide',
  balance: 'pokemon-champions-intimidate-balance-archetype-guide',
};

/**
 * Look up the wiki slug for an archetype core name. Returns undefined
 * for cores without a dedicated article (e.g., Shadow Tag Perish,
 * Volt-Turn) so callers can fall back to plain text.
 */
export function getArchetypeWikiSlug(coreName: string): string | undefined {
  // Exact match first — most core names will resolve directly.
  if (ARCHETYPE_SLUGS[coreName]) return ARCHETYPE_SLUGS[coreName];
  // Loose match: try to find any key that's a substring of the core
  // name. This catches cases like "Sun Offense" or "Mega Charizard Y
  // Sun" that weren't pre-registered.
  for (const [key, slug] of Object.entries(ARCHETYPE_SLUGS)) {
    if (coreName.includes(key)) return slug;
  }
  return undefined;
}

/**
 * Look up the wiki slug for a team comp archetype ID (e.g., "sun",
 * "trick-room"). Returns undefined for IDs without a matching article.
 */
export function getTeamArchetypeWikiSlug(archetypeId: string): string | undefined {
  return TEAM_ARCHETYPE_ID_SLUGS[archetypeId];
}

/** Build the HashRouter path for a wiki slug. */
export function wikiPath(slug: string): string {
  return `/faq/${slug}`;
}
