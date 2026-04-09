export interface FAQ {
  slug: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  content: string; // Rich HTML content for the full page
}

export const FAQ_CATEGORIES = [
  { id: 'transfers', label: 'Transfers & Compatibility' },
  { id: 'mechanics', label: 'Battle Mechanics' },
  { id: 'stats', label: 'Stats & Training' },
  { id: 'competitive', label: 'Competitive Play' },
  { id: 'general', label: 'General' },
] as const;

export const FAQS: FAQ[] = [
  {
    slug: 'can-you-transfer-purified-pokemon-go-to-champions',
    question: 'Can you transfer purified Pokémon from Pokémon GO to Pokémon Champions?',
    answer: 'Yes, but with limits and one missing link. Purified Pokémon can go from GO to HOME, and from HOME to Champions if the species is available. However, the purified status itself does not carry over as a mechanic outside of GO.',
    category: 'transfers',
    tags: ['pokemon go', 'pokemon home', 'transfer', 'purified', 'compatibility'],
    content: `
<h2>Can You Transfer Purified Pokémon from GO to Champions?</h2>
<p><strong>Yes, but with limits and one missing link.</strong></p>

<h3>Transfer Flow</h3>
<div class="flow-diagram">
  <span>Pokémon GO</span>
  <span class="arrow">→</span>
  <span>Pokémon HOME</span>
  <span class="arrow">→</span>
  <span>Pokémon Champions</span>
</div>

<h3>How It Works</h3>
<ul>
  <li>You can transfer <strong>purified Pokémon from GO to HOME</strong>. Purified status does not block transfer.</li>
  <li>Once in HOME, the Pokémon is treated like a normal Pokémon. The "purified" status <strong>does not carry over as a mechanic</strong>.</li>
  <li>From HOME, you can move it into <strong>Pokémon Champions</strong> only if:
    <ul>
      <li>The species exists in Champions (~251 available at launch)</li>
      <li>The game allows transfers from HOME (supported at launch)</li>
    </ul>
  </li>
</ul>

<h3>Important Limits</h3>
<ul class="limits">
  <li><strong>One-way transfer:</strong> GO → HOME is permanent, you cannot send Pokémon back to GO</li>
  <li><strong>Form restrictions:</strong> Some Pokémon (costumes, certain forms) may be blocked from transfer</li>
  <li><strong>Stat normalization:</strong> Movesets and stats will be recalculated using the Champions Stat Point system</li>
</ul>

<h3>Summary</h3>
<table>
  <tr><td>✔</td><td>Purified Pokémon can go GO → HOME</td></tr>
  <tr><td>✔</td><td>Likely usable in Champions if the species is available</td></tr>
  <tr><td>✖</td><td>Purified status itself will not matter outside GO</td></tr>
</table>
    `,
  },
  {
    slug: 'how-do-stat-points-work-pokemon-champions',
    question: 'How do Stat Points (SP) work in Pokémon Champions?',
    answer: 'Stat Points replace both EVs and IVs from previous games. You get 66 total SP to allocate across all six stats, with a max of 32 per stat. Each SP adds approximately 1 stat point at Level 50. All Pokémon have perfect base potential (equivalent to 31 IVs).',
    category: 'stats',
    tags: ['stat points', 'SP', 'EVs', 'IVs', 'training', 'stats'],
    content: `
<h2>How Do Stat Points Work in Pokémon Champions?</h2>
<p>Pokémon Champions completely overhauls the stat training system from mainline games, replacing both EVs (Effort Values) and IVs (Individual Values) with a single, streamlined system called <strong>Stat Points (SP)</strong>.</p>

<h3>Key Numbers</h3>
<table>
  <tr><th>Property</th><th>Value</th></tr>
  <tr><td>Total SP per Pokémon</td><td><strong>66</strong></td></tr>
  <tr><td>Max SP per stat</td><td><strong>32</strong></td></tr>
  <tr><td>SP per stat point (Lv50)</td><td><strong>~1:1</strong></td></tr>
  <tr><td>IVs</td><td><strong>Eliminated</strong> (all Pokémon have perfect base potential)</td></tr>
</table>

<h3>How It Compares to EVs/IVs</h3>
<p>In previous games, you had 510 EVs to distribute (max 252 per stat, with 4 EVs = 1 stat point at Lv50) plus random IVs (0-31) that required breeding to optimize. Champions eliminates all of that complexity:</p>
<ul>
  <li><strong>No IVs:</strong> Every Pokémon has the equivalent of perfect 31 IVs in all stats</li>
  <li><strong>No breeding for stats:</strong> Any Pokémon you obtain can be perfectly optimized</li>
  <li><strong>Simpler math:</strong> 1 SP ≈ 1 stat point, making spreads intuitive to calculate</li>
  <li><strong>Freely adjustable:</strong> SP can be reallocated at any time using Victory Points</li>
</ul>

<h3>Common SP Spreads</h3>
<ul>
  <li><strong>Max offense:</strong> 32 Atk or SpA / 32 Spe / 2 HP</li>
  <li><strong>Bulky attacker:</strong> 32 HP / 32 Atk / 2 Spe</li>
  <li><strong>Defensive wall:</strong> 32 HP / 32 Def / 2 SpD</li>
  <li><strong>Balanced:</strong> 11 in each stat (66 ÷ 6)</li>
</ul>

<h3>Natures Still Matter</h3>
<p>Natures still provide a +10%/-10% modifier to two stats. Combined with SP allocation, this is the primary way to customize your Pokémon's stat profile. Natures can be changed freely using Victory Points.</p>
    `,
  },
  {
    slug: 'what-is-the-omni-ring-pokemon-champions',
    question: 'What is the Omni Ring in Pokémon Champions?',
    answer: 'The Omni Ring is a single device that activates Mega Evolution in Champions. You can Mega Evolve one Pokémon per battle. Terastallization is not available in Champions.',
    category: 'mechanics',
    tags: ['omni ring', 'mega evolution', 'battle gimmick'],
    content: `
<h2>What Is the Omni Ring in Pokémon Champions?</h2>
<p>The <strong>Omni Ring</strong> is Pokémon Champions' battle gimmick device. Instead of the Mega Ring from previous games, Champions uses the Omni Ring to activate Mega Evolution.</p>

<h3>Available Gimmicks at Launch</h3>
<table>
  <tr><th>Gimmick</th><th>Status</th><th>Requirements</th></tr>
  <tr><td><strong>Mega Evolution</strong></td><td>✔ Available</td><td>Pokémon must hold its Mega Stone</td></tr>
  <tr><td>Terastallization</td><td>✖ Not Available</td><td>Not in Champions</td></tr>
  <tr><td>Z-Moves</td><td>? Unconfirmed</td><td>Appears in Omni Ring artwork</td></tr>
  <tr><td>Dynamax</td><td>? Unconfirmed</td><td>Appears in Omni Ring artwork</td></tr>
</table>

<h3>One Mega Per Battle Rule</h3>
<p>The most important tactical consideration: <strong>you can only Mega Evolve one Pokémon per battle</strong>. This means:</p>
<ul>
  <li>Choose your Mega Evolution wisely — it defines your team's power spike</li>
  <li>Teams are often built around their Mega Evolution as the centerpiece</li>
  <li>This creates a meaningful strategic choice at team building and in-battle</li>
</ul>

<h3>Competitive Impact</h3>
<p>The one-per-battle limit means teams must decide which Mega Evolution to build around. The choice of Mega shapes the entire team composition and strategy, making it one of the deepest strategic layers in Champions competitive play.</p>
    `,
  },
  {
    slug: 'pokemon-champions-new-mega-evolutions',
    question: 'What are the new Mega Evolutions in Pokémon Champions?',
    answer: 'Champions includes all new Mega Evolutions from Legends Z-A plus existing ones. Notable new Megas include Mega Meganium (Mega Sol), Mega Dragonite (Multiscale), Mega Starmie (Huge Power), Mega Froslass (Snow Warning), Mega Excadrill (Piercing Drill), and Mega Skarmory (Stalwart).',
    category: 'competitive',
    tags: ['mega evolution', 'legends z-a', 'new megas', 'competitive'],
    content: `
<h2>New Mega Evolutions in Pokémon Champions</h2>
<p>Pokémon Champions features all Mega Evolutions from previous games plus the new ones introduced in Pokémon Legends: Z-A. These are VGC-legal and form a core part of the competitive metagame.</p>

<h3>Notable New Mega Evolutions</h3>
<table>
  <tr><th>Pokémon</th><th>Ability</th><th>Notes</th></tr>
  <tr><td><strong>Mega Meganium</strong></td><td>Mega Sol</td><td>Moves act as if sun is active regardless of weather</td></tr>
  <tr><td><strong>Mega Dragonite</strong></td><td>Multiscale</td><td>Retains Multiscale with boosted stats</td></tr>
  <tr><td><strong>Mega Starmie</strong></td><td>Huge Power</td><td>Doubles Attack — physical Starmie is now viable</td></tr>
  <tr><td><strong>Mega Froslass</strong></td><td>Snow Warning</td><td>Sets Snow on Mega Evolution</td></tr>
  <tr><td><strong>Mega Excadrill</strong></td><td>Piercing Drill</td><td>Contact moves hit through Protect for 1/4 damage</td></tr>
  <tr><td><strong>Mega Skarmory</strong></td><td>Stalwart</td><td>Ignores redirection moves like Follow Me</td></tr>
</table>

<h3>New Abilities Introduced with Megas</h3>
<ul>
  <li><strong>Piercing Drill:</strong> Contact moves bypass Protect, dealing 25% damage through the shield</li>
  <li><strong>Dragonize:</strong> Normal-type moves become Dragon-type with a 20% power boost (like Pixilate but for Dragon)</li>
  <li><strong>Mega Sol:</strong> All moves calculate damage as if Sun is active, regardless of actual weather</li>
  <li><strong>Spicy Spray:</strong> Burns attackers when the Pokémon takes damage from any move</li>
</ul>

<h3>Competitive Implications</h3>
<p>Remember: you can only Mega Evolve one Pokémon per battle. Teams must choose their Mega wisely, as it defines the team's primary power spike and strategy.</p>
    `,
  },
  {
    slug: 'pokemon-champions-damage-calculator-how-to-use',
    question: 'How do I use the Pokémon Champions damage calculator?',
    answer: 'Select a Pokémon on each side (attacker and defender), set their Stat Points, nature, ability, item, and moves. The calculator shows real-time damage ranges, KO probabilities, and speed comparisons. Use the Field button to set weather, terrain, and other battle conditions.',
    category: 'general',
    tags: ['damage calculator', 'how to use', 'guide', 'tutorial'],
    content: `
<h2>How to Use the Pokémon Champions Damage Calculator</h2>
<p>Our damage calculator is built specifically for Pokémon Champions and its unique Stat Point system. Here's how to get the most out of it.</p>

<h3>Quick Start</h3>
<ol>
  <li><strong>Select Pokémon:</strong> Use the search dropdowns on the left (attacker) and right (defender) to choose your Pokémon</li>
  <li><strong>Set Stats:</strong> Use the SP sliders to allocate Stat Points (66 total, 32 max per stat)</li>
  <li><strong>Choose Nature:</strong> Pick a nature that matches your build — the stat labels will show +/- indicators</li>
  <li><strong>Add Moves:</strong> Select up to 4 moves per Pokémon — damage calculates instantly</li>
  <li><strong>Read Results:</strong> The center panel shows damage ranges, percentages, and KO probability</li>
</ol>

<h3>Understanding the Results</h3>
<ul>
  <li><strong>Red bar + "Guaranteed OHKO":</strong> The move will always KO in one hit</li>
  <li><strong>Orange bar + "% OHKO":</strong> There's a chance to KO in one hit based on the damage roll</li>
  <li><strong>Yellow/Blue + "2HKO/3HKO":</strong> How many hits are needed to KO</li>
  <li><strong>Speed comparison:</strong> Shows who moves first, accounting for Tailwind and paralysis</li>
</ul>

<h3>Advanced Features</h3>
<ul>
  <li><strong>Field conditions:</strong> Click "Field" to set weather, terrain, screens, hazards</li>
  <li><strong>Stat boosts:</strong> Expand "Stat Boosts" to set +1 to +6 or -1 to -6 modifiers</li>
  <li><strong>Critical hits:</strong> Click "Crit" next to any move to calculate critical hit damage</li>
  <li><strong>Swap:</strong> Click "Swap" to flip attacker and defender instantly</li>
  <li><strong>Import/Export:</strong> Paste Showdown-format sets to quickly load Pokémon configurations</li>
</ul>

<h3>SP System Reminder</h3>
<p>Unlike previous calculators that use EVs (0-252) and IVs (0-31), Champions uses Stat Points. All Pokémon have perfect base potential. You just allocate 66 SP total across stats.</p>
    `,
  },
  {
    slug: 'pokemon-champions-how-many-pokemon',
    question: 'How many Pokémon are in Pokémon Champions?',
    answer: 'Pokémon Champions launched with approximately 251 Pokémon, primarily fully evolved forms from all 9 generations, plus Pikachu. No Legendary or Mythical Pokémon are available at launch. More Pokémon are expected to be added in regular updates.',
    category: 'general',
    tags: ['pokedex', 'pokemon list', 'how many', 'available pokemon'],
    content: `
<h2>How Many Pokémon Are in Pokémon Champions?</h2>
<p>At launch, Pokémon Champions includes <strong>approximately 251 Pokémon</strong>.</p>

<h3>What's Included</h3>
<ul>
  <li><strong>Fully evolved Pokémon</strong> from all 9 generations</li>
  <li><strong>Pikachu</strong> (the only non-fully-evolved Pokémon at launch)</li>
  <li><strong>Mega Evolutions</strong> including new ones from Legends Z-A</li>
  <li><strong>Alternate forms</strong> where applicable (Alolan, Galarian, etc.)</li>
</ul>

<h3>What's NOT Included at Launch</h3>
<ul>
  <li><strong>Legendary Pokémon:</strong> No legendaries at launch</li>
  <li><strong>Mythical Pokémon:</strong> No mythicals at launch</li>
  <li><strong>NFE (Not Fully Evolved):</strong> Pre-evolutions generally not included (except Pikachu)</li>
</ul>

<h3>Future Updates</h3>
<p>The development team has confirmed that more Pokémon will be added in batches through regular updates. This approach helps maintain competitive balance and keeps the metagame fresh over time.</p>

<h3>Why 251?</h3>
<p>The number 251 is likely a deliberate reference to the original Johto Pokédex count (Gen 1 + Gen 2). Champions curates its roster for competitive balance rather than including every species, ensuring each Pokémon has a viable role in the metagame.</p>
    `,
  },
  {
    slug: 'pokemon-champions-victory-points-explained',
    question: 'What are Victory Points in Pokémon Champions and how do you earn them?',
    answer: 'Victory Points (VP) are the primary non-purchasable currency in Champions. You earn VP by battling. VP is used to scout (recruit) new Pokémon, change natures, reassign Stat Points, switch abilities, and unlock items. VP cannot be bought with real money.',
    category: 'general',
    tags: ['victory points', 'VP', 'currency', 'training', 'free to play'],
    content: `
<h2>Victory Points in Pokémon Champions</h2>
<p>Victory Points (VP) are Pokémon Champions' answer to the pay-to-win problem in free-to-play competitive games. <strong>VP cannot be purchased with real money</strong> — your team's strength directly reflects your battle record.</p>

<h3>How to Earn VP</h3>
<ul>
  <li><strong>Winning ranked battles:</strong> Primary source, more VP for higher rank matches</li>
  <li><strong>Completing daily challenges:</strong> Rotating objectives for bonus VP</li>
  <li><strong>Casual battles:</strong> Smaller VP rewards but still contribute</li>
  <li><strong>Seasonal rewards:</strong> VP bonuses based on end-of-season rank</li>
</ul>

<h3>What VP Is Used For</h3>
<table>
  <tr><th>Action</th><th>VP Cost</th></tr>
  <tr><td>Scout (recruit) a new Pokémon</td><td>Varies by rarity</td></tr>
  <tr><td>Change nature</td><td>Low</td></tr>
  <tr><td>Reassign Stat Points</td><td>Low</td></tr>
  <tr><td>Switch ability (including Hidden Ability)</td><td>Medium</td></tr>
  <tr><td>Unlock held items</td><td>Varies</td></tr>
  <tr><td>Unlock Mega Stones</td><td>High</td></tr>
</table>

<h3>Anti-Pay-to-Win Design</h3>
<p>Champions explicitly prevents purchasing competitive advantages. The VP system ensures that team building is a skill-based progression tied to actual gameplay, not wallet size. This makes the competitive ladder more fair and meaningful.</p>
    `,
  },
  {
    slug: 'pokemon-champions-vs-scarlet-violet-competitive',
    question: 'How does Pokémon Champions competitive differ from Scarlet and Violet?',
    answer: 'Champions replaces Scarlet & Violet as the official VGC platform. Key differences: SP system replaces EVs/IVs, Omni Ring activates Mega Evolution (no Terastallization), no Dynamax, smaller curated roster (~251), and paralysis/sleep mechanics are nerfed.',
    category: 'competitive',
    tags: ['scarlet violet', 'VGC', 'competitive differences', 'comparison'],
    content: `
<h2>Pokémon Champions vs. Scarlet & Violet Competitive</h2>
<p>Pokémon Champions replaces Scarlet & Violet as the official VGC (Video Game Championships) platform for the 2026 season. Here are the major competitive differences.</p>

<h3>Stat System</h3>
<table>
  <tr><th></th><th>Scarlet/Violet</th><th>Champions</th></tr>
  <tr><td><strong>EVs</strong></td><td>510 total, 252 max</td><td>Replaced by SP: 66 total, 32 max</td></tr>
  <tr><td><strong>IVs</strong></td><td>0-31, requires breeding</td><td>Eliminated (all perfect)</td></tr>
  <tr><td><strong>Nature changes</strong></td><td>Mints (item required)</td><td>Free with Victory Points</td></tr>
</table>

<h3>Battle Gimmicks</h3>
<table>
  <tr><th></th><th>Scarlet/Violet</th><th>Champions</th></tr>
  <tr><td><strong>Terastallization</strong></td><td>✔ (only gimmick)</td><td>✖ Not available</td></tr>
  <tr><td><strong>Mega Evolution</strong></td><td>✖</td><td>✔ (via Omni Ring)</td></tr>
  <tr><td><strong>Limit</strong></td><td>1 Tera per battle</td><td>1 Mega per battle</td></tr>
</table>

<h3>Mechanical Changes</h3>
<ul>
  <li><strong>Paralysis:</strong> 1/8 chance to be fully paralyzed (was 1/4 in SV)</li>
  <li><strong>Sleep:</strong> Lasts 2-3 turns (was 2-4 turns)</li>
  <li><strong>Item clause:</strong> Only 1 of each item per team (enforced by game, was a rule in VGC)</li>
  <li><strong>Roster:</strong> ~251 Pokémon (curated) vs. ~400+ in SV</li>
  <li><strong>Damage formula:</strong> Same as Gen 9 — existing knowledge transfers</li>
</ul>

<h3>Quality of Life</h3>
<ul>
  <li><strong>Instant team building:</strong> All moves, abilities, and natures freely changeable</li>
  <li><strong>No breeding:</strong> No IV grinding, no egg moves hassle</li>
  <li><strong>Cross-platform:</strong> Switch, Switch 2, and mobile (June 2026)</li>
  <li><strong>Free to play:</strong> No game purchase required, VP-based progression</li>
</ul>
    `,
  },
  {
    slug: 'best-pokemon-champions-competitive-pokemon-vgc-2026',
    question: 'What are the best competitive Pokémon in Champions for VGC 2026?',
    answer: 'Early VGC 2026 standouts include Mega Excadrill (Piercing Drill breaks Protect), Mega Meganium (permanent sun via Mega Sol), Mega Starmie (Huge Power physical sweeper), Garchomp, Dragapult, Incineroar, and Amoonguss. The meta is evolving rapidly.',
    category: 'competitive',
    tags: ['tier list', 'best pokemon', 'VGC 2026', 'meta', 'competitive'],
    content: `
<h2>Best Pokémon in Champions for VGC 2026</h2>
<p>The Champions metagame is brand new and evolving daily. Here are the early standouts based on initial competitive play and theorycraft.</p>

<h3>S-Tier: Meta-Defining</h3>
<table>
  <tr><th>Pokémon</th><th>Role</th><th>Why It's Great</th></tr>
  <tr><td><strong>Mega Excadrill</strong></td><td>Physical Sweeper</td><td>Piercing Drill breaks through Protect, devastating in Doubles</td></tr>
  <tr><td><strong>Incineroar</strong></td><td>Support</td><td>Intimidate + Fake Out remains elite; no competition for its niche</td></tr>
  <tr><td><strong>Mega Meganium</strong></td><td>Sun Enabler</td><td>Mega Sol means permanent sun without weather; enables sun teams without wasting a turn</td></tr>
</table>

<h3>A-Tier: Excellent</h3>
<table>
  <tr><th>Pokémon</th><th>Role</th><th>Why It's Great</th></tr>
  <tr><td><strong>Garchomp</strong></td><td>Sweeper/Pivot</td><td>Incredible base stats, Earthquake + Dragon coverage, versatile moveset</td></tr>
  <tr><td><strong>Mega Starmie</strong></td><td>Physical Sweeper</td><td>Huge Power doubles Attack; completely unexpected physical set</td></tr>
  <tr><td><strong>Dragapult</strong></td><td>Speed Control</td><td>Fastest common Pokémon, versatile physical/special/support sets</td></tr>
  <tr><td><strong>Amoonguss</strong></td><td>Redirector</td><td>Rage Powder + Spore (nerfed but still strong) + Regenerator</td></tr>
  <tr><td><strong>Mega Froslass</strong></td><td>Snow Setter</td><td>Snow Warning on Mega + Ghost/Ice typing for unique coverage</td></tr>
</table>

<h3>Team Building Tips</h3>
<ul>
  <li><strong>Choose your Mega wisely:</strong> Your Mega Evolution shapes the entire team</li>
  <li><strong>Prepare for Piercing Drill:</strong> Mega Excadrill ignores Protect, so have counters ready</li>
  <li><strong>Speed control matters:</strong> Tailwind, Trick Room, and Thunder Wave are crucial</li>
  <li><strong>Item diversity:</strong> Only 1 of each item per team — plan items carefully</li>
</ul>
    `,
  },
  {
    slug: 'pokemon-champions-free-to-play-pay-to-win',
    question: 'Is Pokémon Champions pay to win?',
    answer: 'No. Pokémon Champions is free to play with no pay-to-win mechanics. The Victory Points currency used for team building cannot be purchased with real money. Competitive advantages are earned exclusively through gameplay. Cosmetics are the only premium purchases.',
    category: 'general',
    tags: ['free to play', 'pay to win', 'microtransactions', 'f2p'],
    content: `
<h2>Is Pokémon Champions Pay to Win?</h2>
<p><strong>No.</strong> Pokémon Champions is explicitly designed to prevent pay-to-win mechanics.</p>

<h3>How Monetization Works</h3>
<table>
  <tr><th>What</th><th>Free?</th><th>Purchasable?</th></tr>
  <tr><td>Battling (Ranked & Casual)</td><td>✔ Free</td><td>—</td></tr>
  <tr><td>Victory Points (team building)</td><td>✔ Earned only</td><td>✖ Cannot buy</td></tr>
  <tr><td>Pokémon recruitment</td><td>✔ VP only</td><td>✖ Cannot buy</td></tr>
  <tr><td>Stat/Nature changes</td><td>✔ VP only</td><td>✖ Cannot buy</td></tr>
  <tr><td>Cosmetic outfits</td><td>Some free</td><td>✔ Premium shop</td></tr>
  <tr><td>Battle effects/animations</td><td>—</td><td>✔ Premium shop</td></tr>
</table>

<h3>The Design Philosophy</h3>
<p>The development team has stated: <em>"Your team's strength is a direct reflection of your battle record, not your wallet."</em> This is enforced at the system level — Victory Points physically cannot be purchased.</p>

<h3>Comparison to Other F2P Games</h3>
<ul>
  <li><strong>Pokémon Unite:</strong> Had pay-to-win item enhancers → Champions has none</li>
  <li><strong>Pokémon TCG Live:</strong> Can buy packs for competitive cards → Champions separates cosmetics from competition</li>
  <li><strong>League of Legends:</strong> Similar model — gameplay is free, cosmetics are paid</li>
</ul>

<p>For competitive players, this means the ladder is fair. Your rank reflects your skill and preparation, not spending.</p>
    `,
  },
  {
    slug: 'pokemon-champions-release-date-platforms',
    question: 'When did Pokémon Champions release and what platforms is it on?',
    answer: 'Pokémon Champions released on April 8, 2026 for Nintendo Switch and Nintendo Switch 2. Mobile versions (iOS/Android) with cross-platform play are expected in June 2026. The game is free to play.',
    category: 'general',
    tags: ['release date', 'platforms', 'switch', 'mobile', 'cross-platform'],
    content: `
<h2>Pokémon Champions Release Date & Platforms</h2>

<h3>Release Timeline</h3>
<table>
  <tr><th>Date</th><th>Event</th></tr>
  <tr><td><strong>February 27, 2025</strong></td><td>Announced during Pokémon Presents</td></tr>
  <tr><td><strong>April 8, 2026</strong></td><td>Launch on Nintendo Switch & Switch 2</td></tr>
  <tr><td><strong>June 2026 (expected)</strong></td><td>iOS & Android release with cross-platform play</td></tr>
</table>

<h3>Platform Details</h3>
<ul>
  <li><strong>Nintendo Switch:</strong> Full support on original Switch</li>
  <li><strong>Nintendo Switch 2:</strong> Enhanced performance and visuals</li>
  <li><strong>iOS:</strong> Expected June 2026</li>
  <li><strong>Android:</strong> Expected June 2026</li>
  <li><strong>Cross-platform:</strong> All platforms compete together</li>
</ul>

<h3>Price</h3>
<p><strong>Free to play.</strong> No purchase required on any platform. Optional cosmetic purchases available.</p>

<h3>Developer</h3>
<p>Developed by <strong>The Pokémon Works</strong>, a joint venture between The Pokémon Company and ILCA (who previously developed Pokémon Brilliant Diamond & Shining Pearl).</p>
    `,
  },
  {
    slug: 'pokemon-champions-tier-list-vgc-2026',
    question: 'What is the Pokémon Champions tier list for VGC 2026?',
    answer: 'The VGC 2026 tier list ranks Garchomp, Hippowdon, and Incineroar as S-tier normal Pokemon. For Megas, Mega Delphox, Mega Greninja, and Mega Gengar lead S-tier. A+ includes Meowscarada, Archaludon, Hydreigon, Mimikyu, Greninja, and Amoonguss.',
    category: 'competitive',
    tags: ['tier list', 'VGC 2026', 'rankings', 'meta', 'competitive', 'best pokemon'],
    content: `
<h2>Pokémon Champions VGC 2026 Tier List</h2>
<p>This tier list is aggregated from Game8, community consensus, and early tournament results. Rankings reflect the launch metagame and will evolve as the meta develops.</p>

<h3>S Tier — Meta-Defining</h3>
<table>
  <tr><th>Pokemon</th><th>Type</th><th>Role</th></tr>
  <tr><td><strong>Garchomp</strong></td><td>Dragon/Ground</td><td>Sweeper, Pivot</td></tr>
  <tr><td><strong>Hippowdon</strong></td><td>Ground</td><td>Wall, Hazard Setter</td></tr>
  <tr><td><strong>Incineroar</strong></td><td>Fire/Dark</td><td>Support, Pivot</td></tr>
  <tr><td><strong>Mega Delphox</strong></td><td>Fire/Psychic</td><td>Special Sweeper</td></tr>
  <tr><td><strong>Mega Greninja</strong></td><td>Water/Dark</td><td>Sweeper</td></tr>
  <tr><td><strong>Mega Gengar</strong></td><td>Ghost/Poison</td><td>Trapper</td></tr>
</table>

<h3>A+ Tier — Core Meta</h3>
<table>
  <tr><th>Pokemon</th><th>Type</th><th>Role</th></tr>
  <tr><td>Meowscarada</td><td>Grass/Dark</td><td>Sweeper, Hazard Setter</td></tr>
  <tr><td>Archaludon</td><td>Steel/Dragon</td><td>Wall, Tank</td></tr>
  <tr><td>Hydreigon</td><td>Dark/Dragon</td><td>Special Sweeper</td></tr>
  <tr><td>Mimikyu</td><td>Ghost/Fairy</td><td>Sweeper, Revenge Killer</td></tr>
  <tr><td>Greninja</td><td>Water/Dark</td><td>Sweeper</td></tr>
  <tr><td>Amoonguss</td><td>Grass/Poison</td><td>Redirector, Support</td></tr>
  <tr><td>Mega Charizard Y</td><td>Fire/Flying</td><td>Sun Sweeper</td></tr>
  <tr><td>Mega Charizard X</td><td>Fire/Dragon</td><td>Physical Sweeper</td></tr>
</table>

<h3>A Tier — Strong Picks</h3>
<p>Corviknight, Rotom-Wash, Primarina, Dragapult, Volcarona, Sneasler, Gholdengo, Rillaboom, and Mega Lopunny, Mega Feraligatr, Mega Froslass, Mega Venusaur, Mega Kangaskhan, Mega Gyarados.</p>

<h3>How Tiers Are Decided</h3>
<ul>
  <li><strong>S Tier:</strong> Great offensive or defensive stats, versatile moves, outperforms the field</li>
  <li><strong>A+ Tier:</strong> Common and relevant, slightly weaker than S Tier</li>
  <li><strong>A Tier:</strong> Stronger than most, but can be countered</li>
  <li><strong>B Tier:</strong> Specific strengths, often picked as meta counters</li>
  <li><strong>C Tier:</strong> Niche viable off-meta picks</li>
</ul>

<p>Use our <a href="/">damage calculator</a> to compare these Pokemon head-to-head with the built-in tier list browser.</p>
    `,
  },
];
