// Pokemon Champions VGC 2026 Tier List
// Aggregated from Game8, Pikalytics, and community consensus.
//
// This file's raw data may contain entries that are NOT in Champions
// (e.g., Amoonguss, Gholdengo, Rillaboom — legal in VGC 2026 but absent
// from the Champions roster). The exports are filtered through
// isChampionsPokemon() at the bottom of this file, so only legal
// entries are surfaced to the UI.

import { isChampionsPokemon } from './champions';

export type Tier = 'S' | 'A+' | 'A' | 'B' | 'C';

export interface TierEntry {
  name: string;
  tier: Tier;
  roles: string[];
  types: [string] | [string, string];
  note?: string;
  isMega?: boolean;
}

export interface TierDefinition {
  tier: Tier;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const TIER_DEFINITIONS: TierDefinition[] = [
  {
    tier: 'S',
    label: 'S Tier',
    description: 'Meta-defining. Great stats, versatile movepool, outperforms the field.',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  {
    tier: 'A+',
    label: 'A+ Tier',
    description: 'Core meta picks. Common and relevant, slightly below S tier.',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  {
    tier: 'A',
    label: 'A Tier',
    description: 'Strong picks. Above average but can be countered.',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  {
    tier: 'B',
    label: 'B Tier',
    description: 'Solid picks with specific strengths. Often used as meta counters.',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  {
    tier: 'C',
    label: 'C Tier',
    description: 'Niche picks. Viable off-meta with specific roles.',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/30',
  },
];

// ─── Normal Pokemon Tier List ──────────────────────────────────────
const NORMAL_TIER_LIST_RAW: TierEntry[] = [
  // S Tier
  {
    name: 'Hippowdon',
    tier: 'S',
    roles: ['Wall', 'Hazard Setter'],
    types: ['Ground'],
    note: 'Stealth Rock + Yawn + Slack Off. Sand Stream for passive damage.',
  },
  {
    name: 'Garchomp',
    tier: 'S',
    roles: ['Sweeper', 'Pivot'],
    types: ['Dragon', 'Ground'],
    note: 'Elite base stats, Rough Skin punishes contact, versatile sets.',
  },
  {
    name: 'Incineroar',
    tier: 'S',
    roles: ['Support', 'Pivot'],
    types: ['Fire', 'Dark'],
    note: 'Intimidate + Fake Out + Parting Shot. Best support in VGC.',
  },

  // A+ Tier
  {
    name: 'Meowscarada',
    tier: 'A+',
    roles: ['Sweeper', 'Hazard Setter'],
    types: ['Grass', 'Dark'],
    note: 'Blazing speed, Protean STAB, diverse coverage.',
  },
  {
    name: 'Archaludon',
    tier: 'A+',
    roles: ['Wall', 'Tank'],
    types: ['Steel', 'Dragon'],
    note: 'Only 2 weaknesses with 10 resistances. Incredible typing.',
  },
  {
    name: 'Hydreigon',
    tier: 'A+',
    roles: ['Special Sweeper'],
    types: ['Dark', 'Dragon'],
    note: 'High SpA, Levitate for Ground immunity, U-Turn pivoting.',
  },
  {
    name: 'Mimikyu',
    tier: 'A+',
    roles: ['Sweeper', 'Revenge Killer'],
    types: ['Ghost', 'Fairy'],
    note: 'Disguise guarantees setup. Ghost/Fairy gives 3 immunities.',
  },
  {
    name: 'Greninja',
    tier: 'A+',
    roles: ['Sweeper', 'Revenge Killer'],
    types: ['Water', 'Dark'],
    note: 'Top speed tier, Protean STAB on every move.',
  },
  {
    name: 'Amoonguss',
    tier: 'A+',
    roles: ['Redirector', 'Support'],
    types: ['Grass', 'Poison'],
    note: 'Rage Powder + Spore + Regenerator. VGC staple.',
  },

  // A Tier
  {
    name: 'Corviknight',
    tier: 'A',
    roles: ['Wall', 'Pivot'],
    types: ['Flying', 'Steel'],
    note: 'Incredible defensive typing with Mirror Armor.',
  },
  {
    name: 'Rotom-Wash',
    tier: 'A',
    roles: ['Pivot', 'Utility'],
    types: ['Electric', 'Water'],
    note: 'Only 1 weakness. Volt Switch pivoting, Will-O-Wisp.',
  },
  {
    name: 'Primarina',
    tier: 'A',
    roles: ['Special Sweeper', 'Bulky Attacker'],
    types: ['Water', 'Fairy'],
    note: 'Strong STAB combo, good bulk, Hyper Voice spread.',
  },
  {
    name: 'Dragapult',
    tier: 'A',
    roles: ['Sweeper', 'Support'],
    types: ['Dragon', 'Ghost'],
    note: 'Fastest common Pokemon. Physical, special, or support sets.',
  },
  {
    name: 'Volcarona',
    tier: 'A',
    roles: ['Special Sweeper', 'Setup'],
    types: ['Bug', 'Fire'],
    note: 'Quiver Dance makes it terrifying. Giga Drain for recovery.',
  },
  {
    name: 'Sneasler',
    tier: 'A',
    roles: ['Physical Sweeper'],
    types: ['Fighting', 'Poison'],
    note: 'Unburden + Close Combat. Fast and hard-hitting.',
  },
  {
    name: 'Gholdengo',
    tier: 'A',
    roles: ['Special Sweeper'],
    types: ['Steel', 'Ghost'],
    note: 'Good as Gold blocks all status moves. Make It Rain power.',
  },
  {
    name: 'Rillaboom',
    tier: 'A',
    roles: ['Physical Sweeper', 'Terrain Setter'],
    types: ['Grass'],
    note: 'Grassy Surge + priority Grassy Glide. Fake Out support.',
  },

  // B Tier
  {
    name: 'Whimsicott',
    tier: 'B',
    roles: ['Support', 'Speed Control'],
    types: ['Grass', 'Fairy'],
    note: 'Prankster Tailwind + Encore. Fast support.',
  },
  {
    name: 'Scizor',
    tier: 'B',
    roles: ['Physical Sweeper', 'Pivot'],
    types: ['Bug', 'Steel'],
    note: 'Technician Bullet Punch priority. U-Turn pivoting.',
  },
  {
    name: 'Snorlax',
    tier: 'B',
    roles: ['Special Wall', 'Tank'],
    types: ['Normal'],
    note: 'Massive HP and SpD. Curse sets are threatening.',
  },
  {
    name: 'Umbreon',
    tier: 'B',
    roles: ['Wall', 'Support'],
    types: ['Dark'],
    note: 'Incredible bulk, Foul Play punishes physical attackers.',
  },
  {
    name: 'Alolan Ninetales',
    tier: 'B',
    roles: ['Veil Setter', 'Support'],
    types: ['Ice', 'Fairy'],
    note: 'Snow Warning + Aurora Veil. Fast support.',
  },
  {
    name: 'Tyranitar',
    tier: 'B',
    roles: ['Sand Setter', 'Tank'],
    types: ['Rock', 'Dark'],
    note: 'Sand Stream, enormous SpD in sand. Assault Vest tank.',
  },
  {
    name: 'Sylveon',
    tier: 'B',
    roles: ['Special Attacker', 'Support'],
    types: ['Fairy'],
    note: 'Pixilate Hyper Voice spread. Good SpD.',
  },
  {
    name: 'Dragonite',
    tier: 'B',
    roles: ['Physical Sweeper', 'Bulky Attacker'],
    types: ['Dragon', 'Flying'],
    note: 'Multiscale for free setup. Dragon Dance + Extreme Speed.',
  },
  {
    name: 'Excadrill',
    tier: 'B',
    roles: ['Physical Sweeper'],
    types: ['Ground', 'Steel'],
    note: 'Sand Rush doubles Speed in sand. Mold Breaker utility.',
  },
  {
    name: 'Pelipper',
    tier: 'B',
    roles: ['Rain Setter', 'Support'],
    types: ['Water', 'Flying'],
    note: 'Drizzle rain setter. U-Turn pivoting.',
  },
  {
    name: 'Kingdra',
    tier: 'B',
    roles: ['Special Sweeper'],
    types: ['Water', 'Dragon'],
    note: 'Swift Swim doubles Speed in rain. Muddy Water spread.',
  },
  {
    name: 'Arcanine',
    tier: 'B',
    roles: ['Support', 'Physical Attacker'],
    types: ['Fire'],
    note: 'Intimidate support. Will-O-Wisp, Extreme Speed.',
  },
  {
    name: 'Espathra',
    tier: 'B',
    roles: ['Special Sweeper', 'Setup'],
    types: ['Psychic'],
    note: 'Speed Boost + Stored Power. Snowballs quickly with Calm Mind.',
  },
  {
    name: 'Rotom-Heat',
    tier: 'B',
    roles: ['Pivot', 'Utility'],
    types: ['Electric', 'Fire'],
    note: 'Levitate + good defensive typing. Overheat + Volt Switch.',
  },

  // C Tier
  {
    name: 'Serperior',
    tier: 'C',
    roles: ['Special Sweeper'],
    types: ['Grass'],
    note: 'Contrary + Leaf Storm for snowballing SpA.',
  },
  {
    name: 'Gallade',
    tier: 'C',
    roles: ['Physical Sweeper'],
    types: ['Psychic', 'Fighting'],
    note: 'Sharpness boosted Sacred Sword. Close Combat.',
  },
  {
    name: 'Ceruledge',
    tier: 'C',
    roles: ['Physical Sweeper'],
    types: ['Fire', 'Ghost'],
    note: 'Weak Armor speed boost. Bitter Blade for recovery.',
  },
  {
    name: 'Politoed',
    tier: 'C',
    roles: ['Rain Setter', 'Support'],
    types: ['Water'],
    note: 'Drizzle alternative to Pelipper with Perish Song.',
  },
  {
    name: 'Gengar',
    tier: 'C',
    roles: ['Special Sweeper'],
    types: ['Ghost', 'Poison'],
    note: 'High speed and SpA, Nasty Plot setup.',
  },
  {
    name: 'Skeledirge',
    tier: 'C',
    roles: ['Special Wall', 'Bulky Attacker'],
    types: ['Fire', 'Ghost'],
    note: 'Unaware ignores boosts. Torch Song SpA boosts.',
  },
  {
    name: 'Kingambit',
    tier: 'C',
    roles: ['Physical Sweeper'],
    types: ['Dark', 'Steel'],
    note: 'Supreme Overlord boosts after teammates faint.',
  },
  {
    name: 'Rotom-Mow',
    tier: 'C',
    roles: ['Pivot', 'Utility'],
    types: ['Electric', 'Grass'],
    note: 'Grass/Electric coverage. Leaf Storm + Volt Switch.',
  },
  {
    name: 'Vivillon',
    tier: 'C',
    roles: ['Support', 'Setup'],
    types: ['Bug', 'Flying'],
    note: 'Compound Eyes Sleep Powder. Quiver Dance if given time.',
  },
  {
    name: 'Vaporeon',
    tier: 'C',
    roles: ['Special Wall', 'Support'],
    types: ['Water'],
    note: 'Water Absorb + Wish passing. Great HP stat.',
  },
  {
    name: 'Palafin',
    tier: 'C',
    roles: ['Physical Sweeper'],
    types: ['Water'],
    note: 'Zero to Hero form change. Enormous Attack in Hero form.',
  },
  {
    name: 'Basculegion',
    tier: 'C',
    roles: ['Physical Sweeper', 'Special Sweeper'],
    types: ['Water', 'Ghost'],
    note: 'Adaptability + Swift Swim. Water/Ghost STAB coverage.',
  },
];

// ─── Mega Pokemon Tier List ────────────────────────────────────────
const MEGA_TIER_LIST_RAW: TierEntry[] = [
  // S Tier
  {
    name: 'Mega Delphox',
    tier: 'S',
    roles: ['Special Sweeper'],
    types: ['Fire', 'Psychic'],
    note: 'Extreme SpA and Speed. Burns physicals on contact.',
    isMega: true,
  },
  {
    name: 'Mega Greninja',
    tier: 'S',
    roles: ['Sweeper', 'Revenge Killer'],
    types: ['Water', 'Dark'],
    note: 'Ludicrous Speed. Protean STAB flexibility.',
    isMega: true,
  },
  {
    name: 'Mega Gengar',
    tier: 'S',
    roles: ['Trapper', 'Special Sweeper'],
    types: ['Ghost', 'Poison'],
    note: 'Shadow Tag prevents switching. High Speed + Will-O-Wisp.',
    isMega: true,
  },

  // A+ Tier
  {
    name: 'Mega Charizard Y',
    tier: 'A+',
    roles: ['Special Sweeper', 'Sun Setter'],
    types: ['Fire', 'Flying'],
    note: 'Drought + massive SpA. Solar Beam coverage.',
    isMega: true,
  },
  {
    name: 'Mega Charizard X',
    tier: 'A+',
    roles: ['Physical Sweeper'],
    types: ['Fire', 'Dragon'],
    note: 'Tough Claws + Dragon Dance. Dragon/Fire STAB.',
    isMega: true,
  },

  // A Tier
  {
    name: 'Mega Floette',
    tier: 'A',
    roles: ['Special Attacker', 'Support'],
    types: ['Fairy'],
    note: 'Unique Fairy offensive presence.',
    isMega: true,
  },
  {
    name: 'Mega Lopunny',
    tier: 'A',
    roles: ['Physical Sweeper', 'Revenge Killer'],
    types: ['Normal', 'Fighting'],
    note: 'Scrappy + Fake Out. Hits Ghosts with STAB.',
    isMega: true,
  },
  {
    name: 'Mega Feraligatr',
    tier: 'A',
    roles: ['Physical Sweeper'],
    types: ['Water'],
    note: 'Sheer Force + Life Orb equivalent. Dragon Dance setup.',
    isMega: true,
  },
  {
    name: 'Mega Froslass',
    tier: 'A',
    roles: ['Snow Setter', 'Support'],
    types: ['Ice', 'Ghost'],
    note: 'Snow Warning on Mega. Aurora Veil + offensive presence.',
    isMega: true,
  },
  {
    name: 'Mega Venusaur',
    tier: 'A',
    roles: ['Tank', 'Sun Sweeper'],
    types: ['Grass', 'Poison'],
    note: 'Thick Fat removes Fire/Ice weaknesses. Chlorophyll in sun.',
    isMega: true,
  },
  {
    name: 'Mega Blastoise',
    tier: 'A',
    roles: ['Special Attacker'],
    types: ['Water'],
    note: 'Mega Launcher boosts pulse moves. Shell Smash potential.',
    isMega: true,
  },
  {
    name: 'Mega Kangaskhan',
    tier: 'A',
    roles: ['Physical Sweeper', 'Support'],
    types: ['Normal'],
    note: 'Parental Bond hits twice. Fake Out + Power-Up Punch.',
    isMega: true,
  },
  {
    name: 'Mega Gyarados',
    tier: 'A',
    roles: ['Physical Sweeper'],
    types: ['Water', 'Dark'],
    note: 'Mold Breaker + Dragon Dance. Intimidate before Mega.',
    isMega: true,
  },

  // B Tier
  {
    name: 'Mega Clefable',
    tier: 'B',
    roles: ['Support', 'Wall'],
    types: ['Fairy'],
    note: 'Magic Guard + Follow Me support.',
    isMega: true,
  },
  {
    name: 'Mega Heracross',
    tier: 'B',
    roles: ['Physical Sweeper'],
    types: ['Bug', 'Fighting'],
    note: 'Skill Link multi-hit moves. Pin Missile + Rock Blast.',
    isMega: true,
  },
  {
    name: 'Mega Lucario',
    tier: 'B',
    roles: ['Physical Sweeper', 'Special Sweeper'],
    types: ['Fighting', 'Steel'],
    note: 'Adaptability STAB. Can go physical or special.',
    isMega: true,
  },
  {
    name: 'Mega Meganium',
    tier: 'B',
    roles: ['Sun Attacker', 'Support'],
    types: ['Grass'],
    note: 'Mega Sol — moves act as if Sun is active regardless of weather.',
    isMega: true,
  },
  {
    name: 'Mega Dragonite',
    tier: 'B',
    roles: ['Physical Sweeper', 'Bulky Attacker'],
    types: ['Dragon', 'Flying'],
    note: 'Retains Multiscale with boosted stats.',
    isMega: true,
  },
  {
    name: 'Mega Emboar',
    tier: 'B',
    roles: ['Physical Sweeper'],
    types: ['Fire', 'Fighting'],
    note: 'Reckless + Flare Blitz power. Head Smash coverage.',
    isMega: true,
  },
  {
    name: 'Mega Crabominable',
    tier: 'B',
    roles: ['Physical Sweeper'],
    types: ['Fighting', 'Ice'],
    note: 'Iron Fist boosted ice punches. Slow but powerful.',
    isMega: true,
  },
  {
    name: 'Mega Glimmora',
    tier: 'B',
    roles: ['Special Sweeper', 'Hazard Setter'],
    types: ['Rock', 'Poison'],
    note: 'Toxic Debris sets Toxic Spikes. High SpA.',
    isMega: true,
  },

  // C Tier
  {
    name: 'Mega Excadrill',
    tier: 'C',
    roles: ['Physical Sweeper'],
    types: ['Ground', 'Steel'],
    note: 'Piercing Drill — contact moves hit through Protect at 1/4 damage.',
    isMega: true,
  },
  {
    name: 'Mega Altaria',
    tier: 'C',
    roles: ['Setup Sweeper'],
    types: ['Dragon', 'Fairy'],
    note: 'Pixilate + Dragon Dance. Unique Dragon/Fairy typing.',
    isMega: true,
  },
  {
    name: 'Mega Aggron',
    tier: 'C',
    roles: ['Physical Wall'],
    types: ['Steel'],
    note: 'Filter reduces super effective damage. Pure Steel typing.',
    isMega: true,
  },
  {
    name: 'Mega Scizor',
    tier: 'C',
    roles: ['Physical Sweeper', 'Pivot'],
    types: ['Bug', 'Steel'],
    note: 'Technician Bullet Punch. Boosted stats over regular Scizor.',
    isMega: true,
  },
  {
    name: 'Mega Gallade',
    tier: 'C',
    roles: ['Physical Sweeper'],
    types: ['Psychic', 'Fighting'],
    note: 'Inner Focus prevents flinching. Wide Guard support.',
    isMega: true,
  },
  {
    name: 'Mega Alakazam',
    tier: 'C',
    roles: ['Special Sweeper'],
    types: ['Psychic'],
    note: 'Trace copies abilities. Blazing Speed + SpA.',
    isMega: true,
  },
  {
    name: 'Mega Slowbro',
    tier: 'C',
    roles: ['Physical Wall'],
    types: ['Water', 'Psychic'],
    note: 'Shell Armor prevents crits. Incredible physical bulk.',
    isMega: true,
  },
  {
    name: 'Mega Tyranitar',
    tier: 'C',
    roles: ['Tank', 'Sand Setter'],
    types: ['Rock', 'Dark'],
    note: 'Even bulkier than regular. Sand Stream + massive stats.',
    isMega: true,
  },
  {
    name: 'Mega Gardevoir',
    tier: 'C',
    roles: ['Special Sweeper'],
    types: ['Psychic', 'Fairy'],
    note: 'Pixilate Hyper Voice spread. High SpA.',
    isMega: true,
  },
  {
    name: 'Mega Hawlucha',
    tier: 'C',
    roles: ['Physical Sweeper'],
    types: ['Fighting', 'Flying'],
    note: 'Unburden + Acrobatics. Fast setup sweeper.',
    isMega: true,
  },
  {
    name: 'Mega Chimecho',
    tier: 'C',
    roles: ['Support', 'Special Attacker'],
    types: ['Psychic'],
    note: 'Levitate + support moves. Niche pick.',
    isMega: true,
  },
  {
    name: 'Mega Golurk',
    tier: 'C',
    roles: ['Physical Sweeper'],
    types: ['Ground', 'Ghost'],
    note: 'Iron Fist boosted punches. Ground/Ghost coverage.',
    isMega: true,
  },
  {
    name: 'Mega Chesnaught',
    tier: 'C',
    roles: ['Physical Wall'],
    types: ['Grass', 'Fighting'],
    note: 'Bulletproof blocks many moves. Spiky Shield + Drain Punch.',
    isMega: true,
  },
];

// ─── Champions-filtered exports ────────────────────────────────────
// Every entry is validated against the Champions roster whitelist. A
// warning is logged for any raw entry that fails the filter, so stale
// tier-list data is caught in development.

function filterToChampions(entries: TierEntry[], label: string): TierEntry[] {
  const kept: TierEntry[] = [];
  for (const e of entries) {
    if (isChampionsPokemon(e.name)) {
      kept.push(e);
    } else if (typeof console !== 'undefined') {
      console.warn(`[tierlist.ts] Dropping "${e.name}" from ${label} — not in Champions roster.`);
    }
  }
  return kept;
}

export const NORMAL_TIER_LIST: TierEntry[] = filterToChampions(NORMAL_TIER_LIST_RAW, 'NORMAL_TIER_LIST');
export const MEGA_TIER_LIST: TierEntry[] = filterToChampions(MEGA_TIER_LIST_RAW, 'MEGA_TIER_LIST');

// ─── Combined + helpers ────────────────────────────────────────────

export const ALL_TIERS: TierEntry[] = [...NORMAL_TIER_LIST, ...MEGA_TIER_LIST];

export function getTierForPokemon(name: string): TierEntry | undefined {
  return ALL_TIERS.find(e => e.name === name);
}

export function getPokemonByTier(tier: Tier, megasOnly?: boolean): TierEntry[] {
  const list = megasOnly ? MEGA_TIER_LIST : NORMAL_TIER_LIST;
  return list.filter(e => e.tier === tier);
}

export function getTierColor(tier: Tier): string {
  return TIER_DEFINITIONS.find(d => d.tier === tier)?.color ?? 'text-slate-400';
}

export function getTierBgColor(tier: Tier): string {
  return TIER_DEFINITIONS.find(d => d.tier === tier)?.bgColor ?? 'bg-slate-500/10';
}
