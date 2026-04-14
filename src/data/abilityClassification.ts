// ─── Centralized Ability Classification ────────────────────────────
//
// SINGLE SOURCE OF TRUTH for ability → competitive role mapping.
// Every file that needs to know "is this ability Intimidate?" or
// "does this ability set weather?" imports from here. No more
// duplicated ability string checks across 8 files.
//
// When a new ability is introduced (e.g., a Z-A Mega ability),
// add it here ONCE and every engine picks it up.

// ─── Weather abilities ─────────────────────────────────────────────

/** Abilities that set weather on switch-in (or via Mega). */
export const WEATHER_SETTERS: Record<string, string> = {
  drought: 'Sun',
  'desolate land': 'Sun',
  drizzle: 'Rain',
  'primordial sea': 'Rain',
  'sand stream': 'Sand',
  'snow warning': 'Snow',
  // Champions Z-A exclusive
  'mega sol': 'Sun',
};

/** Abilities that benefit from weather. */
export const WEATHER_ABUSERS: Record<string, string> = {
  chlorophyll: 'Sun',
  'solar power': 'Sun',
  'flower gift': 'Sun',
  harvest: 'Sun',
  'leaf guard': 'Sun',
  'swift swim': 'Rain',
  'rain dish': 'Rain',
  'dry skin': 'Rain',
  hydration: 'Rain',
  'sand rush': 'Sand',
  'sand force': 'Sand',
  'sand veil': 'Sand',
  'slush rush': 'Snow',
  'ice body': 'Snow',
  'snow cloak': 'Snow',
  'ice face': 'Snow',
};

// ─── Competitive role abilities ────────────────────────────────────

/** Abilities that grant type immunity AND heal from the absorbed type. */
export const TYPE_ABSORB_ABILITIES: Record<string, string> = {
  'earth eater': 'Ground',
  'water absorb': 'Water',
  'storm drain': 'Water',
  'dry skin': 'Water',
  'flash fire': 'Fire',
  'well-baked body': 'Fire',
  'lightning rod': 'Electric',
  'volt absorb': 'Electric',
  'motor drive': 'Electric',
  'sap sipper': 'Grass',
};

/** Abilities that grant type immunity (no healing). */
export const TYPE_IMMUNE_ABILITIES: Record<string, string> = {
  ...TYPE_ABSORB_ABILITIES,
  levitate: 'Ground',
};

/** High-impact competitive abilities and their scoring bonuses.
 *  Used by projection engines, meta radar, and meta deduction. */
export const ABILITY_SCORING: Record<string, { bonus: number; reason: string; category: string }> = {
  intimidate: { bonus: 8, reason: 'Intimidate drops opposing Attack on switch-in — universal Doubles support', category: 'support' },
  prankster: { bonus: 5, reason: 'Prankster gives +1 priority to status moves — premier speed control enabler', category: 'speed-control' },
  regenerator: { bonus: 4, reason: 'Regenerator recovers 33% on every switch — enables infinite pivot cycles', category: 'sustain' },
  'huge power': { bonus: 6, reason: 'Huge Power doubles Attack — massive physical damage output', category: 'offense' },
  'pure power': { bonus: 6, reason: 'Pure Power doubles Attack — equivalent to Huge Power', category: 'offense' },
  adaptability: { bonus: 4, reason: 'Adaptability doubles STAB bonus (1.5× → 2×) — raw damage multiplier', category: 'offense' },
  'sheer force': { bonus: 3, reason: 'Sheer Force removes secondary effects for 30% damage boost', category: 'offense' },
  'tough claws': { bonus: 3, reason: 'Tough Claws boosts contact moves by 30%', category: 'offense' },
  'magic guard': { bonus: 4, reason: 'Magic Guard ignores all indirect damage — hazards, burn, Toxic, weather', category: 'sustain' },
  'magic bounce': { bonus: 3, reason: 'Magic Bounce reflects status moves (Taunt, hazards, status)', category: 'support' },
  multiscale: { bonus: 3, reason: 'Multiscale halves damage at full HP — guaranteed setup turn', category: 'sustain' },
  'shadow tag': { bonus: 5, reason: 'Shadow Tag prevents switching — enables Perish Trap', category: 'trap' },
  'good as gold': { bonus: 4, reason: 'Good as Gold blocks all status moves — immune to Taunt, hazards, status', category: 'sustain' },
  'zero to hero': { bonus: 5, reason: 'Zero to Hero transforms on re-entry — 160 base Atk Hero form', category: 'offense' },
  hospitality: { bonus: 3, reason: 'Hospitality heals partner 25% on switch-in — Doubles sustain', category: 'support' },
  'supreme overlord': { bonus: 3, reason: 'Supreme Overlord scales damage with fainted allies — endgame closer', category: 'offense' },
  // Champions Z-A exclusive abilities
  'mega sol': { bonus: 8, reason: 'Mega Sol — all moves calculate as if Sun is active regardless of weather', category: 'weather' },
  dragonize: { bonus: 7, reason: 'Dragonize converts Normal moves to Dragon type with 20% boost', category: 'offense' },
  'piercing drill': { bonus: 5, reason: 'Piercing Drill — contact moves hit through Protect for 25% damage', category: 'offense' },
  'spicy spray': { bonus: 2, reason: 'Spicy Spray burns attackers on contact', category: 'support' },
  stalwart: { bonus: 2, reason: 'Stalwart bypasses redirection — ignores Follow Me / Rage Powder', category: 'offense' },
};

// ─── Helpers ───────────────────────────────────────────────────────

/** Check if an ability sets weather and return the weather type. */
export function getWeatherSet(ability: string): string | undefined {
  return WEATHER_SETTERS[ability.toLowerCase()];
}

/** Check if an ability abuses weather and return the weather type. */
export function getWeatherAbuse(ability: string): string | undefined {
  return WEATHER_ABUSERS[ability.toLowerCase()];
}

/** Check if an ability grants type immunity. */
export function getTypeImmunity(ability: string): string | undefined {
  return TYPE_IMMUNE_ABILITIES[ability.toLowerCase()];
}

/** Check if an ability heals from a type instead of just being immune. */
export function getTypeAbsorb(ability: string): string | undefined {
  return TYPE_ABSORB_ABILITIES[ability.toLowerCase()];
}

/** Get the scoring bonus for a competitive ability. */
export function getAbilityBonus(ability: string): { bonus: number; reason: string; category: string } | undefined {
  return ABILITY_SCORING[ability.toLowerCase()];
}

/** Is this a weather-setting ability? */
export function isWeatherSetter(ability: string): boolean {
  return ability.toLowerCase() in WEATHER_SETTERS;
}

/** All weather-setting ability names (lowercased). */
export function getAllWeatherSetterNames(): string[] {
  return Object.keys(WEATHER_SETTERS);
}
