// ─── Pokemon Champions Official Roster ──────────────────────────────
//
// SINGLE SOURCE OF TRUTH for which Pokemon actually exist in Champions.
//
// This is a WHITELIST (not a blacklist) sourced directly from Bulbapedia:
// https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_in_Pok%C3%A9mon_Champions
//
// Last synced: 2026-04-10
//
// Why a whitelist? Blacklists require anticipating every non-Champions
// Pokemon in Smogon's Gen 9 data (legendaries, paradoxes, CAP fakemon,
// regional variants, LA forms, alternate forms, etc.) and inevitably
// let invalid entries through. A whitelist says exactly what IS in the
// game — nothing more.
//
// When the game roster changes, update this file and re-sync from
// Bulbapedia. Every data source in the app routes through
// `getAvailablePokemon()` in champions.ts, which validates against
// this list.
//
// Name format matches Smogon/@smogon/calc conventions (Hyphenated forms
// use dashes, e.g., "Kommo-o", "Mr. Rime"). If a name here fails to
// resolve against gen9.species at runtime, champions.ts logs a warning.

export const CHAMPIONS_POKEMON_LIST: readonly string[] = [
  // ─── Generation I ─────────────────────────────────────────────
  'Venusaur',
  'Charizard',
  'Blastoise',
  'Beedrill',
  'Pidgeot',
  'Arbok',
  'Pikachu',
  'Raichu',
  'Clefable',
  'Ninetales',
  'Arcanine',
  'Alakazam',
  'Machamp',
  'Victreebel',
  'Slowbro',
  'Gengar',
  'Kangaskhan',
  'Starmie',
  'Pinsir',
  'Tauros',
  'Gyarados',
  'Ditto',
  'Vaporeon',
  'Jolteon',
  'Flareon',
  'Aerodactyl',
  'Snorlax',
  'Dragonite',

  // ─── Generation II ────────────────────────────────────────────
  'Meganium',
  'Typhlosion',
  'Feraligatr',
  'Ariados',
  'Ampharos',
  'Azumarill',
  'Politoed',
  'Espeon',
  'Umbreon',
  'Slowking',
  'Forretress',
  'Steelix',
  'Scizor',
  'Heracross',
  'Skarmory',
  'Houndoom',
  'Tyranitar',

  // ─── Generation III ───────────────────────────────────────────
  'Pelipper',
  'Gardevoir',
  'Sableye',
  'Aggron',
  'Medicham',
  'Manectric',
  'Sharpedo',
  'Camerupt',
  'Torkoal',
  'Altaria',
  'Milotic',
  'Castform',
  'Banette',
  'Chimecho',
  'Absol',
  'Glalie',

  // ─── Generation IV ────────────────────────────────────────────
  'Torterra',
  'Infernape',
  'Empoleon',
  'Luxray',
  'Roserade',
  'Rampardos',
  'Bastiodon',
  'Lopunny',
  'Spiritomb',
  'Garchomp',
  'Lucario',
  'Hippowdon',
  'Toxicroak',
  'Abomasnow',
  'Weavile',
  'Rhyperior',
  'Leafeon',
  'Glaceon',
  'Gliscor',
  'Mamoswine',
  'Gallade',
  'Froslass',
  'Rotom',

  // ─── Generation V ─────────────────────────────────────────────
  'Serperior',
  'Emboar',
  'Samurott',
  'Watchog',
  'Liepard',
  'Simisage',
  'Simisear',
  'Simipour',
  'Excadrill',
  'Audino',
  'Conkeldurr',
  'Whimsicott',
  'Krookodile',
  'Cofagrigus',
  'Garbodor',
  'Zoroark',
  'Reuniclus',
  'Vanilluxe',
  'Emolga',
  'Chandelure',
  'Beartic',
  'Stunfisk',
  'Golurk',
  'Hydreigon',
  'Volcarona',

  // ─── Generation VI ────────────────────────────────────────────
  'Chesnaught',
  'Delphox',
  'Greninja',
  'Diggersby',
  'Talonflame',
  'Vivillon',
  'Floette',
  'Florges',
  'Pangoro',
  'Furfrou',
  'Meowstic',
  'Aegislash-Shield', // Smogon has no base "Aegislash" entry; Stance Change handles Blade swap

  'Aromatisse',
  'Slurpuff',
  'Clawitzer',
  'Heliolisk',
  'Tyrantrum',
  'Aurorus',
  'Sylveon',
  'Hawlucha',
  'Dedenne',
  'Goodra',
  'Klefki',
  'Trevenant',
  'Gourgeist',
  'Avalugg',
  'Noivern',

  // ─── Generation VII ───────────────────────────────────────────
  'Decidueye',
  'Incineroar',
  'Primarina',
  'Toucannon',
  'Crabominable',
  'Lycanroc',
  'Toxapex',
  'Mudsdale',
  'Araquanid',
  'Salazzle',
  'Tsareena',
  'Oranguru',
  'Passimian',
  'Mimikyu',
  'Drampa',
  'Kommo-o',

  // ─── Generation VIII ──────────────────────────────────────────
  'Corviknight',
  'Flapple',
  'Appletun',
  'Sandaconda',
  'Polteageist',
  'Hatterene',
  'Mr. Rime',
  'Runerigus',
  'Alcremie',
  'Morpeko',
  'Dragapult',
  'Wyrdeer',
  'Kleavor',
  'Basculegion',
  'Sneasler',

  // ─── Generation IX ────────────────────────────────────────────
  'Meowscarada',
  'Skeledirge',
  'Quaquaval',
  'Maushold',
  'Garganacl',
  'Armarouge',
  'Ceruledge',
  'Bellibolt',
  'Scovillain',
  'Espathra',
  'Tinkaton',
  'Palafin',
  'Orthworm',
  'Glimmora',
  'Farigiraf',
  'Kingambit',
  'Sinistcha',
  'Archaludon',
  'Hydrapple',
];

// ─── Mega Evolutions Available in Champions ────────────────────────
// These are the base species that can Mega Evolve. The actual Mega form
// is resolved via CalcPokemon.getForme() when the correct Mega Stone
// is equipped — see resolveForm() in champions.ts.

export const CHAMPIONS_MEGA_LIST: readonly string[] = [
  'Venusaur',
  'Charizard',    // Mega X + Y
  'Blastoise',
  'Beedrill',
  'Pidgeot',
  'Clefable',     // Z-A
  'Alakazam',
  'Victreebel',   // Z-A
  'Slowbro',
  'Gengar',
  'Kangaskhan',
  'Starmie',      // Z-A
  'Pinsir',
  'Gyarados',
  'Aerodactyl',
  'Dragonite',    // Z-A
  'Meganium',     // Z-A
  'Feraligatr',   // Z-A
  'Ampharos',
  'Steelix',
  'Scizor',
  'Heracross',
  'Skarmory',     // Z-A
  'Houndoom',
  'Tyranitar',
  'Gardevoir',
  'Sableye',
  'Aggron',
  'Medicham',
  'Manectric',
  'Sharpedo',
  'Camerupt',
  'Altaria',
  'Banette',
  'Chimecho',     // Z-A
  'Absol',
  'Glalie',
  'Lopunny',
  'Garchomp',
  'Lucario',
  'Abomasnow',
  'Gallade',
  'Froslass',     // Z-A
  'Emboar',       // Z-A
];
