export interface FAQ {
  slug: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  content: string; // Rich HTML content for the full page
}

export const FAQ_CATEGORIES = [
  { id: 'general', label: 'Overview' },
  { id: 'mechanics', label: 'Battle Mechanics' },
  { id: 'moves', label: 'Moves & Abilities' },
  { id: 'stats', label: 'Stats & Training' },
  { id: 'competitive', label: 'Competitive Play' },
  { id: 'transfers', label: 'Transfers & HOME' },
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

<h3>How HOME-Transferred Pokémon Convert</h3>
<p>When a Pokémon is transferred from Pokémon HOME into Champions for the first time, its existing EV investment is converted to SP:</p>
<ul>
  <li><strong>4 EVs</strong> → <strong>1 SP</strong> (the first Stat Point in a stat)</li>
  <li><strong>8 EVs</strong> → <strong>1 additional SP</strong> thereafter</li>
</ul>
<p>A fully EV-trained Pokémon from Scarlet/Violet (510 EVs, typically in 2-3 stats) will land at the SP cap on those stats. Pokémon spread across 5-6 stats may transfer already at the full 66 SP. Natures and Mints carry over; the Pokémon retains whatever nature stat-alignment it had in the source game.</p>
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
    answer: 'Pokémon Champions launched with 186 Pokémon and 44 Mega Evolutions — a curated roster drawn from every generation but deliberately excluding Legendaries, Mythicals, Paradox Pokémon, Ultra Beasts, and most Not-Fully-Evolved species. The developers have stated that more Pokémon will be added in batch updates after launch.',
    category: 'general',
    tags: ['pokedex', 'pokemon list', 'how many', 'available pokemon', 'roster'],
    content: `
<h2>How Many Pokémon Are in Pokémon Champions?</h2>
<p>At launch, Pokémon Champions includes <strong>186 Pokémon</strong> across all nine generations, plus <strong>44 Mega Evolutions</strong>. The roster is explicitly curated — not every species in Pokémon HOME is available, and the developers have publicly stated that more Pokémon will be added in batch updates after launch.</p>

<h3>Launch Roster Breakdown</h3>
<table>
  <tr><th>Generation</th><th>Count</th></tr>
  <tr><td>Gen I (Kanto)</td><td>28</td></tr>
  <tr><td>Gen II (Johto)</td><td>17</td></tr>
  <tr><td>Gen III (Hoenn)</td><td>16</td></tr>
  <tr><td>Gen IV (Sinnoh)</td><td>23</td></tr>
  <tr><td>Gen V (Unova)</td><td>25</td></tr>
  <tr><td>Gen VI (Kalos)</td><td>27</td></tr>
  <tr><td>Gen VII (Alola)</td><td>16</td></tr>
  <tr><td>Gen VIII (Galar / Hisui)</td><td>15</td></tr>
  <tr><td>Gen IX (Paldea)</td><td>19</td></tr>
  <tr><td><strong>Total</strong></td><td><strong>186</strong></td></tr>
</table>

<h3>What's Included</h3>
<ul>
  <li><strong>Fully evolved Pokémon</strong> — Champions skews heavily toward final-stage species</li>
  <li><strong>Pikachu</strong> — the only non-fully-evolved Pokémon in the base roster</li>
  <li><strong>Mega Evolutions</strong> — including the new Megas introduced in Pokémon Legends: Z-A</li>
  <li><strong>Hisuian evolutions</strong> — Wyrdeer, Kleavor, Basculegion, Sneasler</li>
</ul>

<h3>What's NOT Included at Launch</h3>
<ul>
  <li><strong>Legendary Pokémon</strong> — no box legendaries, sub-legendaries, or Tapus</li>
  <li><strong>Mythical Pokémon</strong> — no Mew, Celebi, Jirachi, etc.</li>
  <li><strong>Paradox Pokémon</strong> — no Great Tusk, Iron Valiant, Roaring Moon, etc.</li>
  <li><strong>Ultra Beasts</strong> — no Nihilego, Pheromosa, Kartana, etc.</li>
  <li><strong>Regional variants</strong> — no Alolan / Galarian / Paldean forms (base forms only)</li>
  <li><strong>Most NFE Pokémon</strong> — breed chains and pre-evolutions are excluded</li>
  <li><strong>Gigantamax / Totem forms</strong> — Dynamax is not in Champions</li>
  <li><strong>Popular VGC picks that didn't make the cut</strong> — notably Amoonguss, Rillaboom, Kingdra, and Gholdengo are all absent. pokemon-zone.com shows "Not currently available" banners on these when you look them up</li>
</ul>

<h3>Future Updates</h3>
<p>The development team has said more Pokémon will be added in batch updates rather than all at once. This is a deliberate balance lever: each batch lets the team tune the metagame, add new strategic options, and avoid the "everything at once" problem of previous mainline games.</p>

<h3>Why the Curated Approach?</h3>
<p>Champions is designed as a competitive-first battle game, not a collect-'em-all experience. The curated roster ensures every Pokémon has a viable role in the metagame rather than including hundreds of species that would never see ladder play.</p>
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

<h3>Status Condition Changes</h3>
<ul>
  <li><strong>Paralysis:</strong> Now only a 1/8 chance to be fully paralyzed (was 1/4 in Scarlet/Violet)</li>
  <li><strong>Sleep:</strong> Lasts 2–3 turns (down from 2–4)</li>
  <li>These changes make status less crippling and incentivize setup strategies that were previously too risky.</li>
</ul>

<h3>Move Changes</h3>
<p>Champions rebalances 15+ moves. Notable adjustments:</p>
<ul>
  <li><strong>Fake Out:</strong> Can no longer be used on the turn a Pokémon enters the battlefield — a significant nerf to Fake Out spam strategies. (Note: unclear whether this replaces the standard first-turn rule or layers on it; check in-game help for final wording.)</li>
  <li><strong>Dire Claw:</strong> Secondary effect chance reduced from 50% → 30%</li>
  <li><strong>Toxic Thread:</strong> Now lowers Speed by two stages instead of one</li>
  <li><strong>Snap Trap:</strong> Type changed from Grass → Steel</li>
  <li><strong>Unseen Fist:</strong> Moves hit through Protect for 25% damage instead of full damage</li>
  <li><strong>Apple Acid, Fire Lash, Beak Blast, Mountain Gale</strong> and several others: base power adjusted to rebalance offensive options</li>
  <li>Various accuracy and priority tweaks across the move pool</li>
</ul>

<h3>Battle Mechanic Changes</h3>
<ul>
  <li><strong>PP values are normalized</strong> to 8, 12, 16, or 20 — the old "5/10/15/20/25/30/40" distribution is gone</li>
  <li><strong>Intimidate triggers on both opposing Pokémon simultaneously</strong> in Doubles (was sequential in Scarlet/Violet)</li>
  <li><strong>Type effectiveness display</strong> now distinguishes "extremely effective" (4×) and "mostly ineffective" (¼×) in addition to the standard labels</li>
  <li><strong>In-battle usage statistics:</strong> You can see how often certain held items, moves, and abilities are used on specific Pokémon — all inside the game</li>
  <li><strong>Item clause:</strong> Only 1 of each item per team, enforced by the game itself (not just a tournament rule)</li>
</ul>

<h3>Format &amp; Roster</h3>
<ul>
  <li><strong>Roster:</strong> 186 curated Pokémon (vs. ~400+ in Scarlet/Violet). No legendaries, mythicals, paradoxes, or regional variants.</li>
  <li><strong>Damage formula:</strong> Still Gen 9 — existing calculator knowledge transfers</li>
  <li><strong>Formats:</strong> Both Singles and Doubles ranked ladders</li>
</ul>

<h3>Quality of Life</h3>
<ul>
  <li><strong>Instant team building:</strong> Moves, abilities, Mint natures, and SP spreads are all freely changeable using Victory Points</li>
  <li><strong>No breeding:</strong> All Pokémon have perfect IV-equivalent base potential from the start</li>
  <li><strong>Cross-platform:</strong> Nintendo Switch, Switch 2, iOS, and Android all share one ladder</li>
  <li><strong>Free-to-start:</strong> Nothing that affects battle outcomes can be bought with real money</li>
</ul>
    `,
  },
  {
    slug: 'best-pokemon-champions-competitive-pokemon-vgc-2026',
    question: 'What are the best competitive Pokémon in Champions for VGC 2026?',
    answer: 'Early VGC 2026 standouts include Incineroar (still the best support), Mega Meganium (permanent sun via Mega Sol), Mega Starmie (Huge Power physical sweeper), Mega Excadrill (Piercing Drill breaks Protect), Garchomp, Dragapult, and Mega Gengar. Several mainline VGC staples (Amoonguss, Rillaboom, Gholdengo) aren\'t in Champions yet, so the redirector and terrain slots look different here.',
    category: 'competitive',
    tags: ['tier list', 'best pokemon', 'VGC 2026', 'meta', 'competitive'],
    content: `
<h2>Best Pokémon in Champions for VGC 2026</h2>
<p>The Champions metagame is brand new. Here are the early standouts based on initial ladder play and theorycraft — and importantly, what's <em>missing</em> from the usual VGC rolodex.</p>

<h3>What's Missing vs. Mainline VGC</h3>
<p>Several classic VGC staples are absent from the 186-Pokémon Champions launch roster. pokemon-zone.com shows a "Not currently available in Pokémon Champions" banner on each of these if you look them up. If your VGC instincts tell you to reach for them, you'll need a substitute:</p>
<ul>
  <li><strong>Amoonguss</strong> — no native Rage Powder + Spore redirector. Clefable with Follow Me is the closest substitute.</li>
  <li><strong>Rillaboom</strong> — no Grassy Terrain priority. Grass offense runs through Meowscarada and Mega Meganium instead.</li>
  <li><strong>Gholdengo</strong> — no Good as Gold Steel wall. Archaludon and Corviknight cover the defensive Steel slot.</li>
  <li><strong>Kingdra</strong> — no Swift Swim rain abuser. Primarina and rain-boosted Greninja take over.</li>
  <li><strong>All legendaries, mythicals, and paradoxes</strong> — Champions is a restricted-free format from day one.</li>
</ul>

<h3>S-Tier: Meta-Defining</h3>
<table>
  <tr><th>Pokémon</th><th>Role</th><th>Why It's Great</th></tr>
  <tr><td><strong>Incineroar</strong></td><td>Support</td><td>Intimidate + Fake Out remains the best support package, and with Amoonguss absent it has even less competition for the slot.</td></tr>
  <tr><td><strong>Mega Meganium</strong></td><td>Sun Enabler</td><td>Mega Sol makes moves calculate as if Sun is up regardless of weather — a permanent Drought without having to waste a turn.</td></tr>
  <tr><td><strong>Mega Excadrill</strong></td><td>Physical Sweeper</td><td>Piercing Drill means Protect only blocks 75% of damage from contact moves — a massive disruption to Doubles support.</td></tr>
  <tr><td><strong>Mega Delphox</strong></td><td>Special Sweeper</td><td>Massive Speed and SpA. Burns physical attackers on contact.</td></tr>
  <tr><td><strong>Garchomp</strong></td><td>Sweeper / Pivot</td><td>Elite base stats, versatile moveset, Rough Skin punishes contact.</td></tr>
</table>

<h3>A-Tier: Excellent</h3>
<table>
  <tr><th>Pokémon</th><th>Role</th><th>Why It's Great</th></tr>
  <tr><td><strong>Mega Starmie</strong></td><td>Physical Sweeper</td><td>Huge Power doubles Attack — completely unexpected physical set with STAB Water.</td></tr>
  <tr><td><strong>Dragapult</strong></td><td>Speed Control</td><td>Fastest common Pokémon. Physical, special, and support variants all viable.</td></tr>
  <tr><td><strong>Mega Gengar</strong></td><td>Trapper</td><td>Shadow Tag prevents switches; Will-O-Wisp neuters physical threats.</td></tr>
  <tr><td><strong>Mega Froslass</strong></td><td>Snow Setter</td><td>Snow Warning on Mega Evolution — enables Aurora Veil turn one.</td></tr>
  <tr><td><strong>Whimsicott</strong></td><td>Support</td><td>Prankster Tailwind, Moonblast, Encore. Top pick for speed control.</td></tr>
  <tr><td><strong>Archaludon</strong></td><td>Bulky Wall</td><td>Steel/Dragon with only two weaknesses and ten resistances.</td></tr>
</table>

<h3>Team Building Tips</h3>
<ul>
  <li><strong>Choose your Mega first:</strong> You only get one Mega Evolution per battle, so build the rest of the team around it.</li>
  <li><strong>Respect the one-item clause:</strong> Each item can only appear once on a team — Focus Sash, Choice Scarf, and Leftovers are precious real estate.</li>
  <li><strong>Speed control is critical:</strong> Tailwind (Whimsicott), Trick Room (Hatterene, Mimikyu), and Icy Wind all matter.</li>
  <li><strong>Redirection matters more than ever:</strong> Without Amoonguss, Clefable with Follow Me becomes the de facto redirector slot.</li>
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
    answer: 'Pokémon Champions released on Nintendo Switch on April 7, 2026 in North America and April 8 elsewhere, with an enhanced version for Nintendo Switch 2. Mobile releases on iOS, iPadOS, and Android are scheduled for summer 2026. The game is free-to-start with optional premium purchases.',
    category: 'general',
    tags: ['release date', 'platforms', 'switch', 'mobile', 'cross-platform', 'switch 2'],
    content: `
<h2>Pokémon Champions Release Date & Platforms</h2>

<h3>Release Timeline</h3>
<table>
  <tr><th>Date</th><th>Event</th></tr>
  <tr><td><strong>February 27, 2025</strong></td><td>Announced during Pokémon Presents</td></tr>
  <tr><td><strong>April 7, 2026</strong></td><td>Nintendo Switch launch in North America</td></tr>
  <tr><td><strong>April 8, 2026</strong></td><td>Nintendo Switch launch in other regions</td></tr>
  <tr><td><strong>Summer 2026</strong></td><td>iOS, iPadOS, and Android release (scheduled)</td></tr>
</table>

<h3>Platform Details</h3>
<ul>
  <li><strong>Nintendo Switch:</strong> Full release at launch</li>
  <li><strong>Nintendo Switch 2:</strong> Enhanced via version update — better performance and visuals</li>
  <li><strong>iOS / iPadOS:</strong> Scheduled for summer 2026</li>
  <li><strong>Android:</strong> Scheduled for summer 2026</li>
  <li><strong>Cross-platform play:</strong> Switch and mobile players share the same ladder and ranked pool</li>
  <li><strong>Nintendo Switch Online:</strong> Not required for online battles</li>
</ul>

<h3>Pricing &amp; Monetization</h3>
<p>Champions is <strong>free-to-start</strong>. No purchase is required to download or battle online. Optional purchases include:</p>
<ul>
  <li><strong>Pokémon Champions + Starter Pack</strong> — paid bundle on Nintendo Switch with bonus cosmetics</li>
  <li><strong>Premium Battle Pass</strong> — seasonal cosmetic rewards</li>
  <li><strong>Annual Membership</strong> — longer-term premium subscription</li>
  <li><strong>Cosmetic items</strong> via the in-game Premium Shop</li>
</ul>
<p>Crucially, <strong>nothing that affects battle outcomes can be bought with real money</strong> — all competitive progression is tied to Victory Points earned in-game.</p>

<h3>Developer &amp; Publisher</h3>
<p>Developed by <strong>The Pokémon Works</strong> and published by <strong>Nintendo</strong> / <strong>The Pokémon Company</strong>. Champions is the first dedicated competitive-battle game published under the main series umbrella.</p>
    `,
  },
  // ─── Moves & Abilities ─────────────────────────────────────────
  {
    slug: 'pokemon-champions-move-changes',
    question: 'What moves were changed in Pokémon Champions?',
    answer: 'Champions rebalances 15+ moves. The biggest competitive changes: Fake Out can no longer be used on the turn a Pokémon switches in, Dire Claw\'s secondary effect dropped from 50% to 30%, Toxic Thread now lowers Speed by two stages, Snap Trap is Steel-type, and Unseen Fist only hits through Protect for 25% damage. Several other moves had base power tweaked.',
    category: 'moves',
    tags: ['move changes', 'fake out', 'dire claw', 'toxic thread', 'unseen fist', 'balance'],
    content: `
<h2>Move Changes in Pokémon Champions</h2>
<p>Pokémon Champions rebalances more than fifteen moves compared to Scarlet/Violet. Most changes are designed to reduce the dominance of a few strategies (Fake Out spam, broken secondary effects) and open up slower archetypes.</p>

<h3>High-Impact Changes</h3>
<table>
  <tr><th>Move</th><th>Old Behavior</th><th>Champions Behavior</th></tr>
  <tr><td><strong>Fake Out</strong></td><td>Usable the turn a Pokémon switches in</td><td>Cannot be used on the turn a Pokémon enters the battlefield</td></tr>
  <tr><td><strong>Dire Claw</strong></td><td>50% chance for status (sleep / paralysis / poison)</td><td>30% chance for status</td></tr>
  <tr><td><strong>Toxic Thread</strong></td><td>Lowers Speed by 1 stage + poisons</td><td>Lowers Speed by 2 stages + poisons</td></tr>
  <tr><td><strong>Snap Trap</strong></td><td>Grass-type trapping move</td><td>Steel-type</td></tr>
  <tr><td><strong>Unseen Fist</strong></td><td>Contact moves hit Protect for full damage</td><td>Contact moves hit Protect for 25% damage</td></tr>
</table>

<h3>Why Fake Out Was Nerfed</h3>
<p>In Scarlet/Violet VGC, Fake Out + Intimidate pressure from leads like Incineroar and Rillaboom defined the meta. The new restriction means Fake Out can still be used, but no longer gives a free flinch on turn one of a switch — opponents get a clean action before the flinch can land. This rewards slower, more deliberate positioning.</p>

<h3>Base Power Adjustments</h3>
<p>Several signature moves had their base power tuned up or down:</p>
<ul>
  <li><strong>Apple Acid</strong> — adjusted to keep Flapple/Appletun viable without overcentralizing them</li>
  <li><strong>Fire Lash</strong> — rebalanced as a physical Fire tool</li>
  <li><strong>Beak Blast</strong> — adjusted alongside the Fake Out nerf since they share a niche</li>
  <li><strong>Mountain Gale</strong> — tuned for Hisuian Avalugg</li>
</ul>
<p>Various other moves received accuracy or priority tweaks. The in-game help menu is the authoritative source for the exact numbers — the developers have indicated the balance pass is an ongoing process.</p>

<h3>What Hasn't Changed</h3>
<p>The core Gen 9 damage formula is intact. Our damage calculator uses the same math, so everything you learned from Scarlet/Violet calcs still applies for unchanged moves. The calculator includes overrides for known base-power changes.</p>
    `,
  },
  {
    slug: 'pokemon-champions-battle-mechanic-changes',
    question: 'What battle mechanics were changed in Pokémon Champions?',
    answer: 'Champions introduces several mechanic tweaks: PP values are normalized to 8/12/16/20, Intimidate triggers on both opposing Pokémon simultaneously in Doubles, type effectiveness displays now label 4× hits as "extremely effective" and ¼× as "mostly ineffective", status conditions are weaker (paralysis 1/8, sleep 2-3 turns), and the game enforces a one-of-each item clause by default.',
    category: 'mechanics',
    tags: ['mechanics', 'intimidate', 'PP', 'type effectiveness', 'status conditions', 'item clause'],
    content: `
<h2>Battle Mechanic Changes in Pokémon Champions</h2>
<p>Beyond move balance, Champions tweaks several foundational battle mechanics. These changes aren't always obvious, but they add up to a meaningfully different game feel from Scarlet/Violet.</p>

<h3>PP Values Normalized</h3>
<p>Every move now has a PP value drawn from a fixed set: <strong>8, 12, 16, or 20</strong>. The old "5/10/15/20/25/30/40" distribution is gone. This means:</p>
<ul>
  <li>Low-PP nuke moves (Hydro Cannon, Focus Punch) are no longer special — everything has at least 8 PP</li>
  <li>High-PP utility moves (Protect at 10, Growl at 40) are compressed toward the middle</li>
  <li>PP-stall strategies are effectively gone at the extremes</li>
</ul>

<h3>Intimidate Works on Both Opponents Simultaneously</h3>
<p>In Doubles, <strong>Intimidate now triggers on both opposing Pokémon at the same time</strong>, rather than sequentially. This seems small but matters a lot: abilities like Defiant and Competitive that activate off Intimidate now proc once, cleanly, rather than potentially cascading across multiple drops. It also makes Intimidate faster and snappier visually.</p>

<h3>Type Effectiveness Labels Expanded</h3>
<p>The in-battle message system now distinguishes more severity levels:</p>
<table>
  <tr><th>Multiplier</th><th>Old Label</th><th>Champions Label</th></tr>
  <tr><td>4×</td><td>"It's super effective!"</td><td>"Extremely effective!"</td></tr>
  <tr><td>2×</td><td>"It's super effective!"</td><td>"Super effective!"</td></tr>
  <tr><td>½×</td><td>"It's not very effective…"</td><td>"Not very effective…"</td></tr>
  <tr><td>¼×</td><td>"It's not very effective…"</td><td>"Mostly ineffective…"</td></tr>
</table>
<p>This is purely cosmetic but genuinely helpful — newer players can instantly see when a hit is doubly-weak-to or doubly-resisted, which affects KO math and switch decisions.</p>

<h3>Status Conditions Nerfed</h3>
<table>
  <tr><th>Status</th><th>Old Effect</th><th>Champions Effect</th></tr>
  <tr><td><strong>Paralysis</strong></td><td>25% chance to not move</td><td>12.5% chance to not move (1/8)</td></tr>
  <tr><td><strong>Sleep</strong></td><td>2–4 turns asleep</td><td>2–3 turns asleep</td></tr>
</table>
<p>Paralysis and sleep are both less punishing, which encourages setup and slower team archetypes. You're less likely to get hosed by a bad RNG roll when your sweeper eats a Thunder Wave.</p>

<h3>Item Clause Is Built-In</h3>
<p>In mainline VGC, the one-of-each-item rule is a tournament ruleset. In Champions, <strong>the game itself enforces it</strong> — you physically cannot build a team with two Focus Sashes or two Choice Scarves. This makes item choice a first-class strategic decision from slot one.</p>

<h3>In-Game Usage Stats</h3>
<p>Champions shows live usage statistics inside the game itself: for any Pokémon, you can see how often each held item, move, ability, and nature is used by ranked players. This makes the game much more approachable for newcomers who don't follow Smogon stats or VGC YouTube.</p>
    `,
  },
  {
    slug: 'pokemon-champions-new-abilities',
    question: 'What are the new abilities introduced in Pokémon Champions?',
    answer: 'Champions introduces four new abilities tied to new Mega Evolutions: Piercing Drill (Mega Excadrill — contact moves hit through Protect for 25% damage), Dragonize (converts Normal moves to Dragon-type with a 20% boost), Mega Sol (moves act as if Sun is active regardless of weather), and Spicy Spray (burns attackers that damage this Pokémon).',
    category: 'moves',
    tags: ['abilities', 'piercing drill', 'dragonize', 'mega sol', 'spicy spray', 'mega evolution'],
    content: `
<h2>New Abilities in Pokémon Champions</h2>
<p>Champions introduces four brand-new abilities, all tied to specific new Mega Evolutions from Pokémon Legends: Z-A. Each one enables a different strategic identity.</p>

<h3>Piercing Drill — Mega Excadrill</h3>
<p><strong>Contact moves hit through Protect and Detect for 25% of their normal damage.</strong></p>
<ul>
  <li>This is the most disruptive new ability in the format</li>
  <li>Protect — the most common Doubles support move — partially loses its value against Mega Excadrill</li>
  <li>Teams must rely on switching, redirection, or priority to handle it instead of relying on Protect turns</li>
  <li>Note: Unseen Fist (Urshifu's ability) works similarly in mainline games, but was itself nerfed to 25% in Champions — they now work identically in that respect</li>
</ul>

<h3>Dragonize — Mega Dragonite (or similar)</h3>
<p><strong>Normal-type moves become Dragon-type and gain a 20% power boost.</strong></p>
<ul>
  <li>Effectively a Dragon-type version of Pixilate / Refrigerate / Galvanize</li>
  <li>Turns Extreme Speed, Return, and Hyper Beam into STAB Dragon-type moves with extra power</li>
  <li>Priority Dragon STAB (Extreme Speed) is the main selling point — it ignores Speed control entirely</li>
</ul>

<h3>Mega Sol — Mega Meganium</h3>
<p><strong>Moves calculate damage as if Sunny Day is active, regardless of the actual weather.</strong></p>
<ul>
  <li>Permanent Sun without needing a weather setter or Drought</li>
  <li>Enables Chlorophyll partners (Venusaur, etc.) and boosts Fire-type damage on its team</li>
  <li>Doesn't change the actual weather — still vulnerable to rain disables, hail chip, etc. — it just pretends for damage calcs</li>
  <li>The cleanest permanent-sun enabler Champions has</li>
</ul>

<h3>Spicy Spray — (unannounced Mega)</h3>
<p><strong>Burns the attacker when this Pokémon takes damage from a move.</strong></p>
<ul>
  <li>Functions like an aggressive Flame Body that triggers on any damaging move, not just contact</li>
  <li>Punishes special attackers as well as physical — wider coverage than Flame Body or Static</li>
  <li>Makes the user an extremely strong wall against physical attackers who don't want to get burned</li>
</ul>

<h3>Ability Interactions to Remember</h3>
<ul>
  <li><strong>Mold Breaker</strong> still ignores all of these — a classic counter</li>
  <li><strong>Fire-type Pokémon</strong> cannot be burned, so they ignore Spicy Spray</li>
  <li><strong>Dragonize</strong> is blocked by Fairy-type Pokémon (immune to Dragon)</li>
  <li><strong>Piercing Drill</strong> still cares about contact — non-contact moves still get Protected normally</li>
</ul>
    `,
  },
  {
    slug: 'pokemon-champions-home-transfer-guide',
    question: 'How does transferring Pokémon from HOME to Champions work?',
    answer: 'Pokémon HOME can transfer Pokémon into Champions, but only if the species is on the 186-Pokémon roster. On first transfer, stats convert: EVs become SP (4 EVs = 1 SP, 8 EVs per additional point), nature and Mint data carry over, and the moveset is preserved where legal. Changes made in Champions do not sync back to HOME, and subsequent HOME changes don\'t update the Champions copy.',
    category: 'transfers',
    tags: ['pokemon home', 'transfer', 'EVs', 'SP conversion', 'mints', 'compatibility'],
    content: `
<h2>Transferring Pokémon from HOME to Champions</h2>
<p>Pokémon HOME is the bridge between Champions and every other Pokémon game. The transfer process is mostly automatic, but a few rules are worth knowing before you move your favorites over.</p>

<h3>Transfer Flow</h3>
<div class="flow-diagram">
  <span>Scarlet/Violet, GO, etc.</span>
  <span class="arrow">→</span>
  <span>Pokémon HOME</span>
  <span class="arrow">→</span>
  <span>Pokémon Champions</span>
</div>

<h3>Eligibility Rules</h3>
<ul>
  <li>The species must be on the <strong>Champions roster of 186 Pokémon</strong> — legendaries, mythicals, paradoxes, and most regional variants are rejected</li>
  <li>Alternate forms that don't exist in Champions (e.g., Alolan Ninetales) cannot transfer</li>
  <li>Shiny Pokémon transfer normally and remain shiny</li>
</ul>

<h3>What Carries Over on First Transfer</h3>
<table>
  <tr><th>Property</th><th>Behavior</th></tr>
  <tr><td><strong>EVs</strong></td><td>Converted to SP (see formula below)</td></tr>
  <tr><td><strong>IVs</strong></td><td>Ignored — every Pokémon has max base potential in Champions</td></tr>
  <tr><td><strong>Nature</strong></td><td>Preserved as-is</td></tr>
  <tr><td><strong>Mints</strong></td><td>Nature stat-alignment carries over</td></tr>
  <tr><td><strong>Moveset</strong></td><td>Preserved where legal for the Champions move pool</td></tr>
  <tr><td><strong>Ability</strong></td><td>Preserved</td></tr>
  <tr><td><strong>Held item</strong></td><td>Preserved if the item exists in Champions' curated item pool</td></tr>
  <tr><td><strong>Nickname</strong></td><td>Preserved</td></tr>
</table>

<h3>EV → SP Conversion Formula</h3>
<p>Champions uses a straightforward conversion:</p>
<ul>
  <li><strong>4 EVs</strong> → <strong>1 SP</strong> (for the first Stat Point in a stat)</li>
  <li><strong>8 EVs</strong> → <strong>1 SP</strong> for each additional point in the same stat</li>
</ul>
<p>Practical consequences:</p>
<ul>
  <li>A fully EV-trained Pokémon from Scarlet/Violet (510 EVs, usually in 2–3 stats) typically transfers with 65 SP — Champions grants one extra "bonus" SP on first arrival to round up to 66</li>
  <li>A Pokémon with EVs spread across 5–6 stats may arrive already at the 66 SP cap with no grace point</li>
  <li>You can freely reallocate SP after transfer using Victory Points, so the initial spread is just a starting point</li>
</ul>

<h3>The One-Way Rule</h3>
<p><strong>Changes made to a Pokémon in Champions do NOT sync back to Pokémon HOME.</strong> Once you bring a Pokémon over and retrain it, that training lives in the Champions copy only. Likewise, if you continue playing that Pokémon in Scarlet/Violet after transferring, those changes won't update the Champions version.</p>
<p>Think of it like making a copy rather than a live-synced save.</p>

<h3>Pokémon GO to Champions</h3>
<p>Pokémon GO Pokémon follow the same path: GO → HOME → Champions. Purified status, Best Buddy status, and GO-exclusive moves don't transfer as mechanics — the Pokémon is recalculated using standard Champions rules. See <a href="/#/faq/can-you-transfer-purified-pokemon-go-to-champions">Can you transfer purified Pokémon?</a> for details.</p>
    `,
  },
  {
    slug: 'pokemon-champions-battle-formats',
    question: 'What battle formats are available in Pokémon Champions?',
    answer: 'Pokémon Champions offers Ranked Battles, Casual Battles, and Private Battles. Ranked is the main competitive ladder with seasonal rewards. Casual lets you play without affecting your rank. Private Battles support custom matches with friends or family over local and online play. Both Singles and Doubles formats are supported.',
    category: 'general',
    tags: ['battle modes', 'ranked', 'casual', 'private battle', 'singles', 'doubles'],
    content: `
<h2>Battle Formats in Pokémon Champions</h2>
<p>Champions keeps the mode menu simple: three modes, each with a clear purpose.</p>

<h3>Ranked Battle</h3>
<p>The competitive ladder, and the reason most people install the game. Key features:</p>
<ul>
  <li>Seasonal rank resets with rewards based on your final rank</li>
  <li>VP (Victory Points) earned scales with the rank of your opponent</li>
  <li>Both <strong>Singles</strong> and <strong>Doubles</strong> ladders are available</li>
  <li>VGC 2026 World Championships run on this ladder</li>
  <li>No Nintendo Switch Online subscription required</li>
</ul>

<h3>Casual Battle</h3>
<p>Matchmade games with random opponents that don't affect your ranked position.</p>
<ul>
  <li>Ideal for testing new teams without ladder pressure</li>
  <li>Still earns a reduced amount of VP</li>
  <li>Same format options as Ranked</li>
</ul>

<h3>Private Battle</h3>
<p>Custom matches against friends, family, or tournament opponents.</p>
<ul>
  <li>Create a room and share a code with up to one other player</li>
  <li>Supports custom rulesets (tournament clauses, specific format restrictions)</li>
  <li>Works both locally and online</li>
  <li>Does not earn VP or affect rank</li>
</ul>

<h3>Format Differences: Singles vs. Doubles</h3>
<table>
  <tr><th></th><th>Singles</th><th>Doubles</th></tr>
  <tr><td><strong>Active Pokémon</strong></td><td>1 per side</td><td>2 per side</td></tr>
  <tr><td><strong>Team size</strong></td><td>6, choose lead</td><td>6, bring-4 format</td></tr>
  <tr><td><strong>Meta emphasis</strong></td><td>Raw stats, switching, setup</td><td>Speed control, support, positioning</td></tr>
  <tr><td><strong>Best for</strong></td><td>Traditional competitive players</td><td>VGC and World Championships</td></tr>
</table>

<h3>Viewing Match History</h3>
<p>Champions includes in-game usage statistics: after battles, you can see how often certain held items, moves, and abilities are used on each Pokémon across the entire ranked pool. It's effectively Smogon's usage stats built into the game itself, and it's a huge quality-of-life feature for newcomers.</p>
    `,
  },
  {
    slug: 'pokemon-champions-frontier-shop',
    question: 'What is the Frontier Shop in Pokémon Champions?',
    answer: 'The Frontier Shop is where you spend Victory Points (VP) — the currency you earn from battles. It sells held items for competitive team building and cosmetic clothing for your trainer. Crucially, VP cannot be purchased with real money, so nothing in the Frontier Shop gives a pay-to-win advantage.',
    category: 'general',
    tags: ['frontier shop', 'victory points', 'VP', 'held items', 'currency'],
    content: `
<h2>The Frontier Shop in Pokémon Champions</h2>
<p>The Frontier Shop is Champions' main in-game store. It's where you turn the Victory Points you earn from battles into the held items and cosmetics that make up your collection.</p>

<h3>What You Can Buy with VP</h3>
<table>
  <tr><th>Category</th><th>Examples</th></tr>
  <tr><td><strong>Held items</strong></td><td>Leftovers, Focus Sash, Choice Scarf, type-boost items, berries</td></tr>
  <tr><td><strong>Mega Stones</strong></td><td>Charizardite X/Y, Scizorite, Gardevoirite, and the new Z-A Mega Stones</td></tr>
  <tr><td><strong>Clothing</strong></td><td>Trainer outfits, hats, accessories</td></tr>
  <tr><td><strong>Stat / nature changes</strong></td><td>Reassign SP spreads and change natures on existing Pokémon</td></tr>
</table>

<h3>What VP Cannot Buy</h3>
<ul>
  <li><strong>Exclusive battle Pokémon</strong> — rare or premium-only species do not exist</li>
  <li><strong>Stat boosts beyond the cap</strong> — you can never exceed 32 SP per stat</li>
  <li><strong>Speed or power advantages not available to everyone else</strong></li>
</ul>
<p>Everything competitive in the Frontier Shop is available to every player by playing. This is by design — the development team has been explicit that Champions is not pay-to-win.</p>

<h3>Frontier Shop vs. Premium Shop</h3>
<p>Champions has a separate <strong>Premium Shop</strong> for real-money purchases:</p>
<table>
  <tr><th></th><th>Frontier Shop</th><th>Premium Shop</th></tr>
  <tr><td><strong>Currency</strong></td><td>Victory Points</td><td>Real money</td></tr>
  <tr><td><strong>Sells</strong></td><td>Competitive items, Mega Stones, cosmetics</td><td>Memberships, Battle Passes, bonus cosmetics</td></tr>
  <tr><td><strong>Competitive impact</strong></td><td>Direct (battle items)</td><td>None (cosmetic only)</td></tr>
</table>

<h3>Efficient VP Spending</h3>
<ul>
  <li>Prioritize core items first: Leftovers, Focus Sash, Choice Scarf, Lum Berry</li>
  <li>Unlock at least one Mega Stone for your main Mega before branching out</li>
  <li>Type-boost items (Charcoal, Mystic Water, etc.) are relatively cheap and unlock a wide range of sets</li>
  <li>Save heavier VP costs for Mega Stones and ability changes, which have the highest strategic impact</li>
</ul>
    `,
  },
  {
    slug: 'pokemon-champions-team-archetypes',
    question: 'What are the main team archetypes in Pokémon Champions VGC 2026?',
    answer: 'The launch meta revolves around Sun (Mega Charizard Y, Mega Meganium), Sand (Hippowdon + Garchomp), Snow (Mega Froslass + Aurora Veil), Trick Room (Hatterene, Mimikyu), Tailwind (Whimsicott, Talonflame), and Hyper Offense (Mega Delphox, Mega Greninja). The absence of Amoonguss, Rillaboom, and Gholdengo makes the redirector/terrain/Steel-wall slots look meaningfully different from mainline VGC.',
    category: 'competitive',
    tags: ['team archetypes', 'sun', 'rain', 'sand', 'snow', 'trick room', 'tailwind', 'hyper offense'],
    content: `
<h2>Team Archetypes in Pokémon Champions VGC 2026</h2>
<p>The Champions roster is missing several mainline VGC pillars (Amoonguss, Rillaboom, Gholdengo), which means the archetype lineup looks meaningfully different from Scarlet/Violet. Here's how the main strategies shake out at launch.</p>

<h3>Sun</h3>
<p>Champions has two sun enablers, and they work very differently:</p>
<ul>
  <li><strong>Mega Charizard Y</strong> — sets real Sun via Drought on Mega Evolution. Enables Chlorophyll abusers and boosts Solar Beam</li>
  <li><strong>Mega Meganium</strong> — uses the new ability Mega Sol: moves calculate as if Sun were active regardless of actual weather. Doesn't set weather but can't be disrupted by rain either</li>
</ul>
<p><strong>Core partners:</strong> Venusaur (Chlorophyll), Torkoal, Torterra, Victreebel. Without Amoonguss, redirection falls to Clefable or Whimsicott's Prankster support.</p>

<h3>Sand</h3>
<p>The cleanest archetype to build in Champions because both anchors are present and untouched.</p>
<ul>
  <li><strong>Hippowdon</strong> — Sand Stream + Slack Off + Stealth Rock. Durable and self-sustaining</li>
  <li><strong>Tyranitar</strong> — secondary Sand Stream option with Mega Tyranitar as a backup</li>
</ul>
<p><strong>Core partners:</strong> Garchomp, Excadrill (Sand Rush), Mega Aerodactyl, Rhyperior.</p>

<h3>Snow</h3>
<p>Snow is newly viable thanks to Mega Froslass, which gets Snow Warning on Mega Evolution.</p>
<ul>
  <li><strong>Mega Froslass</strong> — instant Snow + Aurora Veil enabler</li>
  <li><strong>Abomasnow</strong> — secondary Snow Warning if you can't spare the Mega slot</li>
</ul>
<p><strong>Core partners:</strong> Weavile, Mamoswine, Glaceon, Beartic (Slush Rush), Avalugg.</p>

<h3>Trick Room</h3>
<p>Slow, hard-hitting teams that reverse the speed tier for five turns. Champions has strong TR setters.</p>
<ul>
  <li><strong>Hatterene</strong> — bulky TR setter with Psychic/Fairy offense</li>
  <li><strong>Mimikyu</strong> — Disguise guarantees one free turn for TR setup</li>
  <li><strong>Reuniclus</strong> — slower TR setter with Magic Guard</li>
</ul>
<p><strong>Core abusers:</strong> Rhyperior, Conkeldurr, Mega Kangaskhan (ironically decent under TR because of Parental Bond double hits), Torkoal. Without Ursaluna, the slow physical slot goes to Rhyperior or Mamoswine.</p>

<h3>Tailwind</h3>
<p>The opposite of TR: double your speed tier for four turns. Fast Prankster setters are king.</p>
<ul>
  <li><strong>Whimsicott</strong> — Prankster Tailwind is the gold-standard enabler</li>
  <li><strong>Talonflame</strong> — Gale Wings priority + Tailwind</li>
  <li><strong>Pelipper</strong> — rain + Tailwind pivot</li>
</ul>

<h3>Hyper Offense</h3>
<p>Pure attacking pressure with minimal support. Champions' hyper offense revolves around the strongest Megas.</p>
<ul>
  <li><strong>Mega Delphox</strong> — insane SpA and Speed</li>
  <li><strong>Mega Greninja</strong> — Protean STAB flexibility at elite Speed</li>
  <li><strong>Mega Gengar</strong> — Shadow Tag trapping + Perish Song or Will-O-Wisp</li>
</ul>
<p><strong>Typical support:</strong> Incineroar (Intimidate + Fake Out), Whimsicott (Tailwind), a dedicated priority user like Sneasler or a Choice Scarf cleaner like Garchomp.</p>

<h3>What's Missing That Mainline VGC Players Expect</h3>
<ul>
  <li><strong>Amoonguss</strong> — no native Rage Powder redirector. Clefable + Follow Me is the closest substitute, and it's strictly worse.</li>
  <li><strong>Rillaboom</strong> — no Grassy Terrain priority. Grass offense relies on Meowscarada and Mega Meganium instead.</li>
  <li><strong>Gholdengo</strong> — no Good as Gold Steel wall. Archaludon, Corviknight, and Aegislash fill the role.</li>
  <li><strong>Tornadus / Raging Bolt / Flutter Mane</strong> — all legendaries/paradoxes, absent from the roster.</li>
</ul>
<p>The net effect is that Champions' meta rewards creative team building rather than copying Scarlet/Violet lists. Use our <a href="/">team builder</a> with live Smogon data filtered to Champions-legal mons to find fresh ideas.</p>
    `,
  },
  {
    slug: 'pokemon-champions-tier-list-vgc-2026',
    question: 'What is the Pokémon Champions tier list for VGC 2026?',
    answer: 'Early VGC 2026 Champions tiers put Garchomp, Hippowdon, and Incineroar as S-tier support/offense anchors. Mega Delphox, Mega Greninja, Mega Gengar, and Mega Excadrill headline the Mega tier. A+ picks include Meowscarada, Archaludon, Hydreigon, Mimikyu, and Dragapult. Several mainline VGC staples (Amoonguss, Rillaboom, Gholdengo, Kingdra) are not in Champions yet.',
    category: 'competitive',
    tags: ['tier list', 'VGC 2026', 'rankings', 'meta', 'competitive', 'best pokemon'],
    content: `
<h2>Pokémon Champions VGC 2026 Tier List</h2>
<p>This tier list is aggregated from Game8, community consensus, and early tournament results. Rankings reflect the launch metagame and will evolve as the meta develops. Champions has a curated 186-Pokémon roster, so several mainline VGC staples (Amoonguss, Rillaboom, Gholdengo, Kingdra) are <strong>not legal</strong> — plan accordingly. Use the interactive <a href="/#/tier-list">tier list page</a> in the calculator for filterable-by-generation, live-data-enhanced rankings.</p>

<h3>S Tier — Meta-Defining</h3>
<table>
  <tr><th>Pokémon</th><th>Type</th><th>Role</th></tr>
  <tr><td><strong>Garchomp</strong></td><td>Dragon/Ground</td><td>Sweeper, Pivot</td></tr>
  <tr><td><strong>Hippowdon</strong></td><td>Ground</td><td>Wall, Sand Setter</td></tr>
  <tr><td><strong>Incineroar</strong></td><td>Fire/Dark</td><td>Support, Pivot</td></tr>
  <tr><td><strong>Mega Delphox</strong></td><td>Fire/Psychic</td><td>Special Sweeper</td></tr>
  <tr><td><strong>Mega Greninja</strong></td><td>Water/Dark</td><td>Sweeper</td></tr>
  <tr><td><strong>Mega Gengar</strong></td><td>Ghost/Poison</td><td>Trapper</td></tr>
  <tr><td><strong>Mega Excadrill</strong></td><td>Ground/Steel</td><td>Protect-breaker</td></tr>
</table>

<h3>A+ Tier — Core Meta</h3>
<table>
  <tr><th>Pokémon</th><th>Type</th><th>Role</th></tr>
  <tr><td>Meowscarada</td><td>Grass/Dark</td><td>Sweeper, Hazard Setter</td></tr>
  <tr><td>Archaludon</td><td>Steel/Dragon</td><td>Wall, Tank</td></tr>
  <tr><td>Hydreigon</td><td>Dark/Dragon</td><td>Special Sweeper</td></tr>
  <tr><td>Mimikyu</td><td>Ghost/Fairy</td><td>Sweeper, Revenge Killer</td></tr>
  <tr><td>Dragapult</td><td>Dragon/Ghost</td><td>Speed Control</td></tr>
  <tr><td>Greninja</td><td>Water/Dark</td><td>Sweeper</td></tr>
  <tr><td>Mega Charizard Y</td><td>Fire/Flying</td><td>Sun Sweeper</td></tr>
  <tr><td>Mega Charizard X</td><td>Fire/Dragon</td><td>Physical Sweeper</td></tr>
</table>

<h3>A Tier — Strong Picks</h3>
<p>Corviknight, Rotom-Wash, Primarina, Volcarona, Sneasler, Kingambit, Hatterene, Tinkaton, Whimsicott, and the Megas Lopunny, Feraligatr, Froslass, Venusaur, Kangaskhan, Gyarados, and Meganium.</p>

<h3>How Tiers Are Decided</h3>
<ul>
  <li><strong>S Tier:</strong> Great offensive or defensive stats, versatile moves, outperforms the field</li>
  <li><strong>A+ Tier:</strong> Common and relevant, slightly weaker than S Tier</li>
  <li><strong>A Tier:</strong> Stronger than most, but can be countered</li>
  <li><strong>B Tier:</strong> Specific strengths, often picked as meta counters</li>
  <li><strong>C Tier:</strong> Niche viable off-meta picks</li>
</ul>

<p>Use our <a href="/">damage calculator</a> and built-in tier list browser to compare these Pokémon head-to-head with live Smogon usage data filtered to the Champions roster.</p>
    `,
  },
];
