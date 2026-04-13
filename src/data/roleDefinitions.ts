// ─── Role Definitions ──────────────────────────────────────────────
// Single source of truth for what each competitive role means, how to
// use it, and which archetype deep-dive it maps to. Surfaced in
// clickable role badges across the app.

export interface RoleDefinition {
  name: string;
  short: string;
  description: string;
  /** HashRouter path to the most relevant wiki article, if any. */
  wikiPath?: string;
  /** Key Pokemon that exemplify this role in Champions. */
  examples: string[];
}

const ROLE_DEFS: Record<string, RoleDefinition> = {
  // ─── Doubles roles ─────────────────────────────────────────────
  'Lead Anchor': {
    name: 'Lead Anchor',
    short: 'Controls turn 1 with Fake Out, Intimidate, or Parting Shot.',
    description: 'The glue that holds a Doubles team together. Lead Anchors use Fake Out to flinch a threat, Intimidate to weaken physical attackers, and Parting Shot to pivot safely. They rarely KO anything directly — their value is in buying time for the real damage dealer.',
    wikiPath: '/faq/pokemon-champions-intimidate-balance-archetype-guide',
    examples: ['Incineroar', 'Kangaskhan', 'Lopunny'],
  },
  'Speed Controller': {
    name: 'Speed Controller',
    short: 'Sets Tailwind, Trick Room, or Icy Wind to control the speed tier.',
    description: 'Speed Controllers determine who moves first for 4–5 turns. Tailwind doubles your Speed; Trick Room reverses it. The format revolves around speed control — whoever sets theirs first usually wins the early game.',
    wikiPath: '/faq/pokemon-champions-tailwind-archetype-guide',
    examples: ['Whimsicott', 'Talonflame', 'Hatterene'],
  },
  'Redirector': {
    name: 'Redirector',
    short: 'Uses Follow Me or Rage Powder to absorb attacks aimed at a partner.',
    description: 'Redirectors force both opposing attacks onto themselves, protecting a fragile partner for a free turn of setup or sweeping. In Champions, Amoonguss is absent — Clefable and Sinistcha are the primary redirectors.',
    wikiPath: '/faq/pokemon-champions-intimidate-balance-archetype-guide',
    examples: ['Clefable', 'Sinistcha', 'Togekiss'],
  },
  'Wallbreaker': {
    name: 'Wallbreaker',
    short: 'Hits hard enough to 2HKO defensive walls without setup.',
    description: 'Wallbreakers use raw power (high base Atk/SpA + STAB + item) to punch through defensive cores. They don\'t need a boost turn — they just click their strongest move and force switches. Pair with a pivot to keep momentum.',
    wikiPath: '/faq/pokemon-champions-hyper-offense-archetype-guide',
    examples: ['Garchomp', 'Hydreigon', 'Mega Delphox'],
  },
  'Wincon': {
    name: 'Win Condition',
    short: 'The Pokemon that closes the game — usually a Mega with a game-changing ability.',
    description: 'The single most important slot on your team. The Wincon is the Pokemon your entire game plan is built around. Usually a Mega Evolution with an ability that fundamentally changes the matchup (Drought, Shadow Tag, Dragonize). Build the other 5 slots to enable this one.',
    wikiPath: '/faq/pokemon-champions-team-building-fundamentals',
    examples: ['Mega Charizard Y', 'Mega Gengar', 'Mega Dragonite'],
  },
  'Pivot Wall': {
    name: 'Pivot Wall',
    short: 'Bulky Pokemon that takes hits and pivots with U-turn, Volt Switch, or Parting Shot.',
    description: 'Pivot Walls absorb damage and maintain momentum. They cycle Intimidate or Regenerator healing across multiple switch-ins, grinding the opponent down without committing to a KO. The backbone of Balance teams.',
    wikiPath: '/faq/pokemon-champions-intimidate-balance-archetype-guide',
    examples: ['Corviknight', 'Slowking', 'Incineroar'],
  },
  'Hyper Offense': {
    name: 'Hyper Offense',
    short: 'Glass cannon — maximum damage, minimal bulk.',
    description: 'Hyper Offense threats trade all defensive investment for speed and power. They\'re designed to OHKO the opponent before taking a hit. If they don\'t KO, they die. Pair with speed control and priority backup.',
    wikiPath: '/faq/pokemon-champions-hyper-offense-archetype-guide',
    examples: ['Mega Greninja', 'Mega Delphox', 'Weavile'],
  },
  'Trick Room Abuser': {
    name: 'Trick Room Abuser',
    short: 'Slow, powerful attacker that dominates under reversed speed.',
    description: 'Trick Room Abusers have low Speed and massive offensive stats. Under Trick Room, they outspeed the entire field and OHKO with raw power. Useless outside the TR window — build your team around protecting the 4-turn abuse phase.',
    wikiPath: '/faq/pokemon-champions-trick-room-archetype-guide',
    examples: ['Rhyperior', 'Conkeldurr', 'Mamoswine'],
  },
  'Weather Abuser': {
    name: 'Weather Abuser',
    short: 'Has an ability (Chlorophyll, Swift Swim, Sand Rush, Slush Rush) that activates in weather.',
    description: 'Weather Abusers double their Speed or boost their damage in a specific weather condition. They need a weather setter on the team — without the weather active, their ability does nothing and they\'re just average-speed attackers.',
    wikiPath: '/faq/pokemon-champions-sun-archetype-guide',
    examples: ['Venusaur', 'Excadrill', 'Beartic', 'Kingdra'],
  },
  'Utility': {
    name: 'Utility',
    short: 'Fills a niche role — status spreading, hazard control, or niche coverage.',
    description: 'Utility Pokemon don\'t fit cleanly into other categories. They provide specific tools the team needs — Will-O-Wisp to cripple physical threats, Defog for hazard removal, or niche type coverage. Valuable flex picks.',
    examples: ['Rotom-Wash', 'Sableye', 'Glimmora'],
  },

  // ─── Singles roles ─────────────────────────────────────────────
  'Setup Sweeper': {
    name: 'Setup Sweeper',
    short: 'Uses a stat-boosting move (+2 Attack/SpA) then sweeps the weakened team.',
    description: 'Setup Sweepers click Swords Dance, Dragon Dance, Nasty Plot, or Calm Mind on a forced switch to double their offensive stats. At +2, they OHKO most of the metagame. Your team\'s job is to create the one safe turn they need to set up.',
    wikiPath: '/faq/pokemon-champions-singles-hyper-offense-archetype-guide',
    examples: ['Garchomp', 'Dragonite', 'Volcarona', 'Mimikyu'],
  },
  'Hazard Setter': {
    name: 'Hazard Setter',
    short: 'Lays Stealth Rock, Spikes, or Toxic Spikes to chip every switch-in.',
    description: 'Hazard Setters are the foundation of Singles offense. Stealth Rock deals 12.5% on every switch; Spikes layer up to 25%. Over a 30-turn game, hazards deal more total damage than any single attacker. Set them turn 1.',
    wikiPath: '/faq/pokemon-champions-singles-hyper-offense-archetype-guide',
    examples: ['Hippowdon', 'Glimmora', 'Skarmory', 'Orthworm'],
  },
  'Hazard Removal': {
    name: 'Hazard Removal',
    short: 'Removes opposing hazards with Defog or Rapid Spin.',
    description: 'Hazard Removal prevents the opponent\'s Stealth Rock from compounding across the game. Defog removes all hazards (including your own); Rapid Spin only removes the opponent\'s. Every Singles team needs one.',
    wikiPath: '/faq/pokemon-champions-singles-balance-archetype-guide',
    examples: ['Corviknight', 'Scizor', 'Excadrill'],
  },
  'Choice Scarf': {
    name: 'Choice Scarf',
    short: 'Revenge killer — outspeeds boosted threats with a Choice Scarf.',
    description: 'Choice Scarf users are insurance against setup sweepers. If the opponent gets a Dragon Dance off, the Scarf user still outspeeds and revenge-kills. Locked into one move per switch-in, so they\'re reactive, not proactive.',
    examples: ['Garchomp', 'Hydreigon', 'Dragapult'],
  },
  'Physical Wall': {
    name: 'Physical Wall',
    short: 'Walls physical attackers with massive Defense + reliable recovery.',
    description: 'Physical Walls have high HP + Defense and reliable recovery moves (Slack Off, Roost, Recover). They switch into physical threats repeatedly across the game, taking hits the rest of your team can\'t. Pair with a Special Wall for full coverage.',
    wikiPath: '/faq/pokemon-champions-singles-balance-archetype-guide',
    examples: ['Hippowdon', 'Corviknight', 'Avalugg', 'Skarmory'],
  },
  'Special Wall': {
    name: 'Special Wall',
    short: 'Walls special attackers with massive Special Defense + reliable recovery.',
    description: 'Special Walls absorb Draco Meteor, Hydro Pump, and other special nukes. They pair with Physical Walls to create a defensive core that can handle both sides of the offensive spectrum.',
    wikiPath: '/faq/pokemon-champions-singles-balance-archetype-guide',
    examples: ['Slowking', 'Umbreon', 'Clefable'],
  },
  'Pivot': {
    name: 'Pivot',
    short: 'Uses U-turn, Volt Switch, or Flip Turn to maintain momentum.',
    description: 'Pivots attack and switch in one move, keeping the favorable matchup on the field at all times. The core of Volt-Turn teams. Regenerator pivots (Slowking, Corviknight) heal 33% on every switch, making them nearly impossible to wear down.',
    wikiPath: '/faq/pokemon-champions-singles-volt-turn-archetype-guide',
    examples: ['Scizor', 'Rotom-Wash', 'Corviknight', 'Palafin'],
  },
  'Phazer': {
    name: 'Phazer',
    short: 'Forces the opponent to switch with Roar, Whirlwind, or Dragon Tail.',
    description: 'Phazers counter setup sweepers by forcing them out before they can attack at +2. They also rack up hazard chip damage by forcing repeated switch-ins. Essential on Balance and Stall teams.',
    wikiPath: '/faq/pokemon-champions-singles-balance-archetype-guide',
    examples: ['Hippowdon', 'Skarmory', 'Dragonite'],
  },
  'Status Spreader': {
    name: 'Status Spreader',
    short: 'Spreads Will-O-Wisp, Toxic, Thunder Wave, or Sleep to cripple threats.',
    description: 'Status Spreaders shut down specific threats permanently. Will-O-Wisp halves Attack (cripples physical sweepers); Toxic adds escalating chip (breaks stall mirrors); Thunder Wave cuts Speed (stops fast threats). Champions\' status nerfs make paralysis weaker (1/8 chance) but it\'s still impactful.',
    examples: ['Gliscor', 'Sinistcha', 'Sableye', 'Rotom-Frost'],
  },
  'Lead': {
    name: 'Lead',
    short: 'Designed to win turn 1 — sets hazards, Taunts, or trades favorably.',
    description: 'Leads are built for the opening turn. Hazard leads (Glimmora, Hippowdon) get Stealth Rock up immediately. Anti-lead (Aerodactyl with Taunt) prevents the opponent from setting up. Focus Sash guarantees survival for at least one action.',
    wikiPath: '/faq/pokemon-champions-singles-hyper-offense-archetype-guide',
    examples: ['Glimmora', 'Hippowdon', 'Aerodactyl'],
  },

  // ─── Shared / general ─────────────────────────────────────────
  'Wall': {
    name: 'Wall',
    short: 'Defensive Pokemon with high bulk and reliable recovery.',
    description: 'Walls absorb hits the rest of the team can\'t take. They need reliable recovery (Recover, Roost, Slack Off) to function across a long game. Without recovery, they\'re just bulky — not true walls.',
    wikiPath: '/faq/pokemon-champions-singles-balance-archetype-guide',
    examples: ['Hippowdon', 'Clefable', 'Avalugg'],
  },
  'Support': {
    name: 'Support',
    short: 'Provides team utility — Intimidate, redirection, healing, screens.',
    description: 'Support Pokemon enable their partners rather than dealing damage directly. Intimidate drops opposing Attack; Follow Me redirects attacks; Helping Hand boosts partner damage by 50%. The best support Pokemon (Incineroar) do all of this while still threatening offensive pressure.',
    wikiPath: '/faq/pokemon-champions-intimidate-balance-archetype-guide',
    examples: ['Incineroar', 'Sinistcha', 'Whimsicott'],
  },
  'Physical Sweeper': {
    name: 'Physical Sweeper',
    short: 'High Attack stat — deals damage primarily through physical moves.',
    description: 'Physical Sweepers use Earthquake, Close Combat, Icicle Crash, and other contact/physical moves to deal damage. They\'re walled by high-Defense Pokemon and crippled by Will-O-Wisp (halves Attack). Pair with a special attacker for mixed offense.',
    examples: ['Garchomp', 'Dragonite', 'Palafin'],
  },
  'Special Sweeper': {
    name: 'Special Sweeper',
    short: 'High Special Attack — deals damage primarily through special moves.',
    description: 'Special Sweepers use Hydro Pump, Draco Meteor, Shadow Ball, and other non-contact moves. They\'re walled by high-SpD Pokemon like Umbreon and Slowking. Not affected by Intimidate or Will-O-Wisp.',
    examples: ['Mega Delphox', 'Volcarona', 'Hydreigon'],
  },
};

export function getRoleDefinition(role: string): RoleDefinition | undefined {
  return ROLE_DEFS[role];
}

export function getAllRoleDefinitions(): Record<string, RoleDefinition> {
  return ROLE_DEFS;
}
