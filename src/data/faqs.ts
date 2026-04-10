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
  <tr><td><strong>Mega Meganium</strong></td><td><a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun Enabler</a></td><td>Mega Sol makes moves calculate as if Sun is up regardless of weather — a permanent Drought without having to waste a turn.</td></tr>
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
  <tr><td><strong>Mega Froslass</strong></td><td><a href="/#/faq/pokemon-champions-snow-archetype-guide">Snow Setter</a></td><td>Snow Warning on Mega Evolution — enables Aurora Veil turn one.</td></tr>
  <tr><td><strong>Whimsicott</strong></td><td><a href="/#/faq/pokemon-champions-tailwind-archetype-guide">Support / Tailwind</a></td><td>Prankster Tailwind, Moonblast, Encore. Top pick for speed control.</td></tr>
  <tr><td><strong>Archaludon</strong></td><td>Bulky Wall</td><td>Steel/Dragon with only two weaknesses and ten resistances.</td></tr>
</table>

<h3>Team Building Tips</h3>
<ul>
  <li><strong>Choose your Mega first:</strong> You only get one Mega Evolution per battle, so build the rest of the team around it. The <a href="/#/faq/pokemon-champions-team-archetypes">team archetypes overview</a> links every archetype built around a specific Mega.</li>
  <li><strong>Respect the one-item clause:</strong> Each item can only appear once on a team — Focus Sash, Choice Scarf, and Leftovers are precious real estate.</li>
  <li><strong>Speed control is critical:</strong> <a href="/#/faq/pokemon-champions-tailwind-archetype-guide">Tailwind</a> (Whimsicott), <a href="/#/faq/pokemon-champions-trick-room-archetype-guide">Trick Room</a> (Hatterene, Mimikyu), and Icy Wind all matter.</li>
  <li><strong>Redirection matters more than ever:</strong> Without Amoonguss, Clefable with Follow Me becomes the de facto redirector slot.</li>
  <li><strong>Start from a tested archetype.</strong> If you're new to the format, copy a template from the <a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun</a>, <a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand</a>, or <a href="/#/faq/pokemon-champions-intimidate-balance-archetype-guide">Intimidate Balance</a> deep dives rather than building from scratch.</li>
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

<p><strong>Looking for a deep dive on a specific archetype?</strong> Each of the archetypes below links to a standalone guide with full SP spreads, sample teams, game plans, and matchup tables.</p>
<ul>
  <li><a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun (Charizard Y / Mega Meganium)</a></li>
  <li><a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand (Hippowdon + Excadrill)</a></li>
  <li><a href="/#/faq/pokemon-champions-snow-archetype-guide">Snow (Mega Froslass + Aurora Veil)</a></li>
  <li><a href="/#/faq/pokemon-champions-rain-archetype-guide">Rain (Pelipper + Swift Swim)</a></li>
  <li><a href="/#/faq/pokemon-champions-trick-room-archetype-guide">Trick Room (Hatterene + slow wallbreakers)</a></li>
  <li><a href="/#/faq/pokemon-champions-tailwind-archetype-guide">Tailwind (Whimsicott + fast Megas)</a></li>
  <li><a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">Doubles Hyper Offense</a></li>
  <li><a href="/#/faq/pokemon-champions-intimidate-balance-archetype-guide">Intimidate Balance (goodstuff)</a></li>
  <li><a href="/#/faq/pokemon-champions-singles-hyper-offense-archetype-guide">Singles Hyper Offense</a></li>
  <li><a href="/#/faq/pokemon-champions-singles-balance-archetype-guide">Singles Balance</a></li>
</ul>

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

  // ─── Acquisition & sourcing ───────────────────────────────────
  {
    slug: 'pokemon-champions-how-to-acquire-pokemon',
    question: 'How do you acquire Pokémon in Pokémon Champions?',
    answer: 'There are three ways to add Pokémon to your Champions roster: scouting them from the Frontier Shop using Victory Points, transferring from Pokémon HOME (which pulls in anything from Scarlet/Violet, GO, Legends Z-A, etc. as long as the species is on the Champions roster), and limited-time event unlocks. Scouting is the primary free-to-play method — VP is earned exclusively through battles and cannot be purchased.',
    category: 'general',
    tags: ['scouting', 'frontier shop', 'home transfer', 'go transfer', 'victory points', 'acquisition'],
    content: `
<h2>Three Paths to a Full Roster</h2>
<p>Pokémon Champions splits Pokémon acquisition into three non-overlapping systems. Understanding which one is cheapest for the mon you want is the difference between grinding for a week and having your team built by Tuesday.</p>

<h3>1. Scouting via the Frontier Shop (primary path)</h3>
<p>The <strong>Frontier Shop</strong> is Champions' in-game store where Victory Points (VP) are spent. Every Pokemon in the 186-mon roster is available here — no exceptions, no premium-only species. This is the primary acquisition path for free-to-play players.</p>
<ul>
  <li><strong>How you earn VP:</strong> Ranked Battles (primary source, scales with opponent rank), Casual Battles (smaller amount), Daily Challenges, and seasonal rank rewards.</li>
  <li><strong>What VP costs:</strong> A common B/C-tier Pokemon runs roughly a single evening's worth of laddering. S-tier picks and popular Megas cost noticeably more. Exact costs shift as the developers tune the economy.</li>
  <li><strong>Scout tickets vs direct purchase:</strong> The shop uses a scout-ticket model — you spend tickets to recruit specific species rather than gacha pulls. There is no randomized loot box system.</li>
</ul>
<p>VP <strong>cannot be purchased with real money</strong>. This is enforced at the system level and is the core reason Champions isn't pay-to-win.</p>

<h3>2. Pokémon HOME transfers</h3>
<p>If you already have competitive Pokémon in another mainline game, HOME is the fastest way to get them into Champions. See our <a href="/#/faq/pokemon-champions-home-transfer-guide">HOME transfer guide</a> for the full conversion rules, but the high-level flow is:</p>
<div class="flow-diagram">
  <span>Scarlet/Violet, GO, Legends Z-A</span>
  <span class="arrow">→</span>
  <span>Pokémon HOME</span>
  <span class="arrow">→</span>
  <span>Champions</span>
</div>
<ul>
  <li><strong>Must be on the roster:</strong> HOME will refuse to transfer a species Champions doesn't support. Legendaries, paradoxes, and most regional variants bounce back.</li>
  <li><strong>EVs convert to SP:</strong> 4 EVs → 1 SP for the first stat point, 8 EVs per additional. A fully EV-trained Scarlet/Violet mon transfers with ~65 SP and Champions grants a free bonus point to round up to 66.</li>
  <li><strong>Nature + Mints carry over:</strong> If you used a Mint to change a nature in the source game, the effective nature alignment transfers. Abilities and movesets carry over too.</li>
  <li><strong>One-way:</strong> Changes made to the Pokémon in Champions do not sync back to HOME.</li>
  <li><strong>Transfer-only species:</strong> A few Pokémon (like <strong>Eternal Flower Floette</strong>) are only obtainable by transferring from Legends: Z-A through HOME — you can't scout them from the Frontier Shop.</li>
</ul>

<h3>3. Events and seasonal unlocks</h3>
<p>The Pokémon Company typically runs seasonal events tied to the World Championships cycle, holiday drops, and promotional tie-ins. These events usually hand out VP rather than exclusive species, preserving the rule that every Pokémon is obtainable by every player.</p>
<ul>
  <li><strong>Daily login rewards</strong> grant small VP bonuses</li>
  <li><strong>Seasonal tournaments</strong> offer large VP payouts for top placements</li>
  <li><strong>Special distributions</strong> occasionally unlock shinies or rare natures as cosmetic touches</li>
</ul>

<h3>Which path is cheapest for which Pokémon?</h3>
<table>
  <tr><th>Pokémon Type</th><th>Best Acquisition Path</th></tr>
  <tr><td>Common meta picks (Garchomp, Incineroar, Whimsicott)</td><td>Frontier Shop (cheap + always available)</td></tr>
  <tr><td>Already built in Scarlet/Violet</td><td>HOME transfer (saves retraining)</td></tr>
  <tr><td>Hisuian evolutions (Wyrdeer, Kleavor, Basculegion, Sneasler)</td><td>HOME transfer from Legends: Arceus or Scarlet/Violet DLC</td></tr>
  <tr><td>Floette-Eternal</td><td>HOME transfer from Legends: Z-A (transfer-only)</td></tr>
  <tr><td>Mega Stones</td><td>Frontier Shop (VP cost scales with Mega strength)</td></tr>
</table>

<h3>Rarity does not mean unavailable</h3>
<p>Unlike mainline games where a Hidden Ability or specific nature might require hours of breeding, Champions' Frontier Shop sells every species with <strong>all of its legal abilities available for free swap</strong> once you've recruited it. There are no "rare" Pokemon that gate competitive viability behind RNG — only VP cost.</p>
    `,
  },

  // ─── Current meta breakdown ───────────────────────────────────
  {
    slug: 'pokemon-champions-current-meta-breakdown',
    question: 'What does the current Pokémon Champions meta look like?',
    answer: 'The launch meta splits into six major archetypes: Hyper Offense (fast setup sweepers + hazards), Balance (pivot core + wincon), Sand (Tyranitar/Hippowdon + Excadrill), Sun (Mega Meganium or Mega Charizard Y), Snow (Mega Froslass), and Trick Room (Hatterene/Mimikyu + slow attackers). The meta is unusually tempo-flexible because the Fake Out nerf slows down lead pressure, letting slower archetypes breathe. Incineroar and Garchomp anchor most teams regardless of archetype.',
    category: 'competitive',
    tags: ['meta', 'archetypes', 'top picks', 'tempo', 'sun', 'sand', 'snow', 'trick room', 'hyper offense', 'balance'],
    content: `
<h2>Champions Meta at a Glance</h2>
<p>The Champions meta is still forming — the game launched in April 2026 and tournament data is thin. What we know comes from first-principles analysis: taking the 186-mon roster, applying Champions-specific rule changes (Fake Out switch-in nerf, status condition nerfs, Intimidate simultaneous trigger), and projecting what each archetype looks like under those constraints.</p>

<h3>The six major archetypes</h3>

<h4>1. <a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">Hyper Offense</a></h4>
<p><strong>Game plan:</strong> Set hazards turn 1, force switches, setup sweep through weakened switch-ins. Every slot is an offensive threat — no dead weight, no passive pivots. See the <a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">Hyper Offense deep dive</a> (Doubles) or the <a href="/#/faq/pokemon-champions-singles-hyper-offense-archetype-guide">Singles Hyper Offense guide</a> for full team lists and matchups.</p>
<ul>
  <li><strong>Anchors:</strong> Garchomp, Mimikyu (Disguise setup), Dragonite (Dragon Dance or Dragonize Extreme Speed)</li>
  <li><strong>Hazard lead:</strong> Hippowdon (Stealth Rock + Slack Off), Tyranitar, or Glimmora</li>
  <li><strong>Cleaners:</strong> Weavile, Volcarona (Quiver Dance), Scizor, Kingambit (Supreme Overlord)</li>
  <li><strong>Weakness:</strong> Fast priority users, Focus Sash breakers, hazard removal spam</li>
</ul>

<h4>2. <a href="/#/faq/pokemon-champions-intimidate-balance-archetype-guide">Balance</a></h4>
<p><strong>Game plan:</strong> Hazards + pivot + wincon + wall. Wear the opponent down through attrition, then set up a sweep in the endgame when their counter is chipped. This is the default archetype for "I don't know what I'm doing yet" teams because every slot has a clear role. Full builds in the <a href="/#/faq/pokemon-champions-intimidate-balance-archetype-guide">Intimidate Balance deep dive</a> (Doubles) and the <a href="/#/faq/pokemon-champions-singles-balance-archetype-guide">Singles Balance guide</a>.</p>
<ul>
  <li><strong>Hazard/wall foundation:</strong> Hippowdon, Corviknight, Skarmory</li>
  <li><strong>Pivot core:</strong> Corviknight + Hydreigon (Volt-turn chain) or Incineroar (Parting Shot)</li>
  <li><strong>Wincon:</strong> Garchomp, Dragonite, Mimikyu, or Mega Gengar</li>
  <li><strong>Wall:</strong> Clefable (Magic Guard), Slowking, Umbreon</li>
  <li><strong>Weakness:</strong> Dedicated wallbreakers with Choice Band/Specs, setup teams that outpace your cycle</li>
</ul>

<h4>3. <a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand Offense</a></h4>
<p><strong>Game plan:</strong> Sand Stream setter + Sand Rush abuser. Classic Singles powerhouse that doesn't need new Z-A abilities to work — both anchors are vanilla in Champions. Sand damages anything that isn't Rock/Ground/Steel, giving you free chip every turn. See the <a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand archetype deep dive</a>.</p>
<ul>
  <li><strong>Setters:</strong> Tyranitar (Sand Stream + Rock/Dark STAB offense), Hippowdon (Sand Stream + defensive anchor)</li>
  <li><strong>Sand Rush abuser:</strong> Excadrill — doubles speed in sand, cleans with Earthquake + Iron Head</li>
  <li><strong>Secondary abusers:</strong> Garchomp, Gliscor (Poison Heal), Krookodile</li>
  <li><strong>Weakness:</strong> Rain-boosted Water coverage, Fighting STAB, opposing weather wars</li>
</ul>

<h4>4. <a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun (Mega Sol or Drought)</a></h4>
<p><strong>Game plan:</strong> Permanent Sun → Chlorophyll abusers hit top speed tier → Fire STAB boosted 50% → Solar Beam has no charge turn. Champions gives you two distinct Sun setters with different tradeoffs. The <a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun archetype deep dive</a> breaks down the Charizard Y vs Mega Meganium choice in full.</p>
<ul>
  <li><strong>Mega Meganium + Mega Sol:</strong> Makes every turn calculate as Sun regardless of actual weather. Doesn't set Sun on the field, but can't be disrupted by opposing weather either. The cleanest permanent-sun solution in the format.</li>
  <li><strong>Mega Charizard Y + Drought:</strong> Sets real Sun via Drought. Suffers from the "wasted first turn to Mega Evolve" problem, but the Sun is on the field so Chlorophyll + Solar Power activate.</li>
  <li><strong>Core partners:</strong> Venusaur (Chlorophyll), Victreebel (Chlorophyll), Arcanine (Intimidate)</li>
  <li><strong>Weakness:</strong> Opposing <a href="/#/faq/pokemon-champions-rain-archetype-guide">Rain</a> (overwrites real Sun but not Mega Sol), Rock-type priority, Mega Tyranitar Sand</li>
</ul>

<h4>5. <a href="/#/faq/pokemon-champions-snow-archetype-guide">Snow (Aurora Veil)</a></h4>
<p><strong>Game plan:</strong> Mega Froslass turn 1 sets Snow Warning → Aurora Veil goes up → Slush Rush abusers double their speed. The Z-A ability upgrade on Mega Froslass is the reason Snow is viable in Champions when it was fringe in Scarlet/Violet. See the <a href="/#/faq/pokemon-champions-snow-archetype-guide">Snow archetype deep dive</a>.</p>
<ul>
  <li><strong>Mega Froslass:</strong> Snow Warning on Mega Evolution — unique to Champions</li>
  <li><strong>Abusers:</strong> Beartic (Slush Rush), Mamoswine (Thick Fat + Slush Rush), Weavile</li>
  <li><strong>Aurora Veil caster:</strong> Froslass itself or Abomasnow</li>
  <li><strong>Weakness:</strong> Fire-type spread moves, Steel walls (resist Ice)</li>
</ul>

<h4>6. <a href="/#/faq/pokemon-champions-trick-room-archetype-guide">Trick Room</a></h4>
<p><strong>Game plan:</strong> Reverse the speed tier for 5 turns. Slow attackers with big Attack/SpA stats suddenly outspeed the whole field. The status condition nerfs in Champions benefit TR teams disproportionately — Thunder Wave and sleep are much weaker, so your setter survives. Full setter/wallbreaker builds in the <a href="/#/faq/pokemon-champions-trick-room-archetype-guide">Trick Room deep dive</a>.</p>
<ul>
  <li><strong>Setters:</strong> Hatterene (Magic Bounce blocks opposing Taunt), Mimikyu (Disguise guarantees one free turn), Reuniclus, Slowking</li>
  <li><strong>Slow wallbreakers:</strong> Rhyperior, Conkeldurr (Guts), Mamoswine, Kingambit</li>
  <li><strong>Weakness:</strong> Taunt before setup, phazing moves, faster Trick Room mirror</li>
</ul>

<h3>Tempo of the meta</h3>
<p>Champions is unusually <strong>tempo-flexible</strong> compared to mainline VGC. Two rule changes widen the viable pace:</p>
<ol>
  <li><strong>The Fake Out nerf</strong> (can't be used on switch-in) removes the "free turn 1 flinch + Tailwind" opener that dominated Scarlet/Violet. Slower teams aren't auto-disrupted on turn 1.</li>
  <li><strong>Status nerfs</strong> (paralysis 1/8 instead of 1/4, sleep 2-3 turns instead of 2-4) mean setup sweepers survive more turns of bad RNG. Setup archetypes that were too fragile in mainline are now viable.</li>
</ol>
<p>The practical effect: balanced and stall teams have a genuine shot against hyper offense, which wasn't true in Scarlet/Violet. The meta rewards players who can identify an opponent's archetype early and counter-pick their pivot chain.</p>

<h3>Who's in nearly every team</h3>
<p>A few Pokemon appear across almost all archetypes because their role isn't tied to a weather or terrain:</p>
<ul>
  <li><strong>Incineroar</strong> — Intimidate + Parting Shot is the default support core. The Fake Out nerf hurts fast lead mirrors but not Incineroar's real role as a turn-2+ pivot.</li>
  <li><strong>Garchomp</strong> — Elite stats, Rough Skin punishes contact, slots into Hyper Offense, Balance, Sand, and even Trick Room (Brave nature).</li>
  <li><strong>Whimsicott</strong> — Prankster Tailwind is the premier speed control option now that Amoonguss isn't in the format.</li>
  <li><strong>Clefable</strong> — Inherits the redirection role (Follow Me) from Amoonguss's vacuum. Magic Guard + Calm Mind makes it a legitimate stall wincon too.</li>
</ul>
<p>If a team doesn't have at least one of these four, it's either committing to a very specific archetype or making a deliberate counter-call.</p>
    `,
  },

  // ─── Team preview reading + response ──────────────────────────
  {
    slug: 'pokemon-champions-read-opponent-team-preview',
    question: 'How do I read an opposing team at team preview?',
    answer: 'Identify the archetype in 10 seconds by looking for archetype anchors: a weather setter means Sun/Sand/Snow, Hatterene or Mimikyu means Trick Room, Whimsicott or Talonflame means Tailwind. Then count the team\'s speed control, identify the win condition (usually a Mega or setup sweeper), and plan your pick-3/pick-4 bring list to counter both the most likely lead pair and the endgame cleaner. Your own team selection is where matches are won or lost.',
    category: 'competitive',
    tags: ['team preview', 'matchup', 'bring list', 'reading opponents', 'archetypes', 'strategy'],
    content: `
<h2>Team Preview: Your Most Important Decision</h2>
<p>In a bring-6-pick-N format, the team preview screen is where most matches are decided. You get ~60 seconds to look at the opponent's six Pokémon and select 3 (Singles) or 4 (Doubles) to bring into the match. Pick wrong and you've locked yourself into a disadvantaged matchup before the first move.</p>

<h3>The 10-second archetype read</h3>
<p>Most teams telegraph their archetype through one or two obvious anchors. Train yourself to spot these first:</p>
<table>
  <tr><th>If you see…</th><th>They're likely running…</th></tr>
  <tr><td>Tyranitar + Excadrill</td><td><a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand Offense</a></td></tr>
  <tr><td>Mega Meganium or Mega Charizard Y</td><td><a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun</a></td></tr>
  <tr><td>Mega Froslass</td><td><a href="/#/faq/pokemon-champions-snow-archetype-guide">Snow / Aurora Veil</a></td></tr>
  <tr><td>Pelipper + Kingdra or Mega Greninja</td><td><a href="/#/faq/pokemon-champions-rain-archetype-guide">Rain Offense</a></td></tr>
  <tr><td>Hatterene, Mimikyu with low-speed partners</td><td><a href="/#/faq/pokemon-champions-trick-room-archetype-guide">Trick Room</a></td></tr>
  <tr><td>Whimsicott, Talonflame, Pelipper (multiple speed control)</td><td><a href="/#/faq/pokemon-champions-tailwind-archetype-guide">Tailwind Offense</a></td></tr>
  <tr><td>Mimikyu + Weavile + Garchomp + setup sweepers</td><td><a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">Hyper Offense</a></td></tr>
  <tr><td>Corviknight + Hippowdon + pivot Pokémon</td><td><a href="/#/faq/pokemon-champions-intimidate-balance-archetype-guide">Balance</a></td></tr>
  <tr><td>Clefable + Umbreon + Slowking + recovery mons</td><td>Stall (defensive core — see <a href="/#/faq/pokemon-champions-singles-balance-archetype-guide">Singles Balance</a> for the closest template)</td></tr>
  <tr><td>Mega Gengar</td><td>Shadow Tag trap (Perish Song, Taunt/Will-O-Wisp)</td></tr>
</table>

<h3>Count the threats</h3>
<p>After identifying the archetype, count three things:</p>
<ol>
  <li><strong>Speed control:</strong> How many Tailwind, Trick Room, Icy Wind, and Thunder Wave users? Two or more means they plan to win the speed tier — you need your own speed control or a way to disrupt theirs (Taunt).</li>
  <li><strong>Setup sweepers:</strong> Anything with Dragon Dance, Swords Dance, Nasty Plot, Calm Mind, or Quiver Dance is a win condition waiting to happen. If you can't revenge-kill or phaze, you have to keep it from setting up in the first place.</li>
  <li><strong>Your answers to their Mega:</strong> Champions is a one-Mega-per-battle format. Their Mega is probably their win condition. Which of your 6 beats their Mega 1v1?</li>
</ol>

<h3>Predict their lead</h3>
<p>Teams typically lead with:</p>
<ul>
  <li><strong>Hyper Offense:</strong> Hazard setter (Hippowdon, Glimmora) + Focus Sash breaker</li>
  <li><strong>Sand/Sun/Snow:</strong> Weather setter + weather abuser together</li>
  <li><strong>Tailwind:</strong> Tailwind user + Fake Out partner (if they run one)</li>
  <li><strong>Trick Room:</strong> TR setter + slow wallbreaker</li>
  <li><strong>Balance:</strong> Intimidate pivot (Incineroar) + a safe bulky mon</li>
</ul>
<p>Your lead pair should be something that beats their predicted lead AND doesn't lose tempo to their back-row pivot.</p>

<h3>Build your bring list</h3>
<p>Your pick-N selection should satisfy these in order:</p>
<ol>
  <li><strong>A counter to their win condition.</strong> If you can't beat their Mega or setup sweeper, nothing else matters.</li>
  <li><strong>A counter to their lead.</strong> Your opening two mons should beat what they're most likely to send first.</li>
  <li><strong>A pivot answer for the endgame.</strong> Reserve a slot for the mon that cleans up when both wincons are traded.</li>
  <li><strong>Coverage against their wallbreaker.</strong> The mon they bring out when their lead sequence fails.</li>
</ol>

<h3>When in doubt, bring your anchor</h3>
<p>If you're unsure about their archetype, bring the most flexible members of your team — Incineroar, Garchomp, Whimsicott, or Clefable. These have something to do against any matchup. Save the hyper-specialized counter-picks (e.g., a dedicated Sun Pokemon or a Trick Room setter) for situations where you're confident about the matchup.</p>

<h3>The cost of a wrong read</h3>
<p>A bad team preview decision can auto-lose you the match even if you play the rest of it perfectly. Don't rush. Use the full preview timer. The calculator's Lineup Flexibility view shows your team's best pick-N subsets in advance so you can map "if I see X, I bring Y" before you queue.</p>
    `,
  },

  // ─── Responding to opposing archetypes ────────────────────────
  {
    slug: 'pokemon-champions-counter-opposing-archetypes',
    question: 'How do I counter each major archetype in Champions?',
    answer: 'Sun: pressure the weather setter with Rock/Water coverage and deny Chlorophyll speed. Sand: outspeed Excadrill before Sand goes up or bring your own weather. Snow: Fire coverage punches through Aurora Veil chip. Trick Room: Taunt the setter, phaze with Roar/Whirlwind, or simply outlast the 5-turn window. Tailwind: your own Tailwind for mirror, or Trick Room reverse. Hyper Offense: Focus Sash leads + priority + hazard removal. Balance: aggressive offense to break their pivot cycle before they can set up.',
    category: 'competitive',
    tags: ['counter', 'matchup', 'archetypes', 'response', 'strategy', 'bring list'],
    content: `
<h2>Archetype Counter-Picking Guide</h2>
<p>Once you've identified your opponent's archetype at team preview, this guide tells you how to respond. Each section lists the archetype's key vulnerabilities, the Pokémon on your team most likely to exploit them, and the bring-list shape you should aim for.</p>

<h3>Vs. <a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun</a> (Mega Meganium / Mega Charizard Y)</h3>
<p><strong>Their game plan:</strong> Permanent Sun boosts Fire STAB by 50% and doubles Chlorophyll partners' speed. Solar Beam has no charge turn. See the <a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun archetype deep dive</a> for their build details.</p>
<p><strong>Your answers:</strong></p>
<ul>
  <li><strong>Attack the weather setter directly.</strong> Mega Meganium is Grass — hit it with Ice, Flying, or Fire. Mega Charizard Y is Fire/Flying — hit it with Rock, Water, or Electric.</li>
  <li><strong>Deny Chlorophyll speed.</strong> Trick Room flips the script (Chlorophyll still doubles but the tier is reversed). Tailwind on your own team matches their speed.</li>
  <li><strong>Bring a rain setter or Mega Tyranitar</strong> — opposing weather overwrites Mega Charizard Y's Drought. (Mega Sol on Meganium cannot be overwritten because it's an ability-driven state, not field weather.)</li>
  <li><strong>Key threats:</strong> Tyranitar (Sand overwrites Sun), Archaludon (Electric STAB into Charizard), Primarina (Water into both Megas), Weavile (Ice Shard priority)</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand</a> (Tyranitar + Excadrill)</h3>
<p><strong>Their game plan:</strong> Sand Stream sets Sand → Excadrill doubles speed via Sand Rush → cleans with Earthquake + Iron Head. Sand chip wears down non-Rock/Ground/Steel. Full build breakdown in the <a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand archetype deep dive</a>.</p>
<p><strong>Your answers:</strong></p>
<ul>
  <li><strong>Outspeed Excadrill before Sand goes up.</strong> Choice Scarf Dragapult or base 130+ Speed Pokémon (Aerodactyl, Weavile) still win turn-1 before the weather lands.</li>
  <li><strong>Water or Fighting coverage.</strong> Both Tyranitar (4× Water/Fighting) and Excadrill (2× Water/Fighting) are hit super-effectively. Primarina with Moonblast + Surf shreds the core.</li>
  <li><strong>Bring your own weather.</strong> Rain shuts down Sand Rush since the weather changes, which disables Sand Rush's speed boost.</li>
  <li><strong>Key threats:</strong> Primarina, Greninja (Water STAB), Lucario (Fighting STAB), Scizor (resists Rock/Dark)</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-snow-archetype-guide">Snow</a> (Mega Froslass + Aurora Veil)</h3>
<p><strong>Their game plan:</strong> Turn-1 Mega Evolution triggers Snow Warning → Aurora Veil halves damage → Slush Rush abusers double speed. See the <a href="/#/faq/pokemon-champions-snow-archetype-guide">Snow archetype deep dive</a>.</p>
<p><strong>Your answers:</strong></p>
<ul>
  <li><strong>Fire coverage punches through Veil chip.</strong> Aurora Veil only halves damage, doesn't block it. Strong Fire attackers (Volcarona, Charizard) still break the core.</li>
  <li><strong>Steel walls resist Ice.</strong> Archaludon, Corviknight, and Scizor all wall Ice STAB.</li>
  <li><strong>Taunt the Froslass</strong> before it sets Aurora Veil. Prankster Taunt from Sableye or Whimsicott shuts the whole archetype down.</li>
  <li><strong>Defog to remove the Veil</strong> if it goes up — Corviknight and Dragapult both get Defog.</li>
  <li><strong>Key threats:</strong> Volcarona, Scizor, Archaludon, Mega Houndoom, Primarina (resists Ice but hits with Water)</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-trick-room-archetype-guide">Trick Room</a> (Hatterene / Mimikyu)</h3>
<p><strong>Their game plan:</strong> Set Trick Room → slow wallbreakers (Rhyperior, Conkeldurr, Mamoswine) outspeed the entire field for 5 turns → sweep. See the <a href="/#/faq/pokemon-champions-trick-room-archetype-guide">Trick Room archetype deep dive</a>.</p>
<p><strong>Your answers:</strong></p>
<ul>
  <li><strong>Taunt the setter before they click Trick Room.</strong> Whimsicott (Prankster), Sableye, or Dragapult can shut down the whole strategy with a single move.</li>
  <li><strong>Phazing forces them out before they can capitalize.</strong> Dragonite's Dragon Tail, Skarmory's Whirlwind, or Gyarados's Roar all reset their positioning.</li>
  <li><strong>Outlast the TR turns.</strong> Trick Room only lasts 5 turns. If you can stall with Protect + Substitute, you run out the clock and reverse the tempo.</li>
  <li><strong>Bring your own Trick Room.</strong> A Trick Room mirror neutralizes their advantage — whoever clicks last wins the tempo war.</li>
  <li><strong>Key threats:</strong> Whimsicott (Taunt), Gengar (Taunt + Mega Shadow Tag), Skarmory (Whirlwind), Dragonite (Dragon Tail)</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-tailwind-archetype-guide">Tailwind Offense</a></h3>
<p><strong>Their game plan:</strong> Turn-1 Tailwind doubles their speed for 4 turns → fast sweepers clean up while the tempo favor lasts. See the <a href="/#/faq/pokemon-champions-tailwind-archetype-guide">Tailwind archetype deep dive</a>.</p>
<p><strong>Your answers:</strong></p>
<ul>
  <li><strong>Bring your own Tailwind.</strong> The mirror forces them to set it first, which wastes a turn. Whimsicott's Prankster Tailwind is the fastest option.</li>
  <li><strong>Trick Room reverses the speed.</strong> Fast teams lose everything when Trick Room is up — pack a Hatterene or Mimikyu even if you're not running full TR.</li>
  <li><strong>Taunt the Tailwind setter</strong> on turn 1 before they set. Prankster Taunt is ideal.</li>
  <li><strong>Priority moves.</strong> Priority bypasses their speed boost entirely. Scizor's Bullet Punch, Dragonite's Extreme Speed, Weavile's Ice Shard.</li>
  <li><strong>Key threats:</strong> Whimsicott mirror, Dragonite (Dragonize priority STAB), Weavile, Scizor</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">Hyper Offense</a></h3>
<p><strong>Their game plan:</strong> Set Stealth Rock turn 1 → force switches → every setup sweeper cleans through weakened switch-ins. Full build details in the <a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">Doubles Hyper Offense guide</a> and the <a href="/#/faq/pokemon-champions-singles-hyper-offense-archetype-guide">Singles Hyper Offense guide</a>.</p>
<p><strong>Your answers:</strong></p>
<ul>
  <li><strong>Focus Sash leads</strong> survive the setup turn so you can trade.</li>
  <li><strong>Hazard removal on every team.</strong> Defog (Corviknight, Dragapult) or Rapid Spin (Excadrill, Scizor) clears chip damage before it compounds.</li>
  <li><strong>Priority priority priority.</strong> Hyper Offense has almost no bulk — one priority attack from Dragonite or Scizor often KOs the weakened sweeper.</li>
  <li><strong>Phazing</strong> cancels setup completely. Roar or Whirlwind forces out a boosted Dragonite and resets the win con.</li>
  <li><strong>Key threats:</strong> Corviknight (Defog + bulky wall), Dragonite (priority Extreme Speed), Scizor (Bullet Punch + U-turn momentum), Clefable (Magic Guard ignores hazards)</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-intimidate-balance-archetype-guide">Balance</a></h3>
<p><strong>Their game plan:</strong> Attrition. Hazards chip every switch, pivots keep the favorable matchup on the field, and a setup sweeper cleans in the endgame when everything is worn down. See the <a href="/#/faq/pokemon-champions-intimidate-balance-archetype-guide">Intimidate Balance deep dive</a> or <a href="/#/faq/pokemon-champions-singles-balance-archetype-guide">Singles Balance</a> for a look at what they\'re running.</p>
<p><strong>Your answers:</strong></p>
<ul>
  <li><strong>Aggressive wallbreakers</strong> force them to commit their walls turn 1 rather than cycle them safely. Choice Band Dragonite, Choice Specs Primarina, or setup sweepers that outpace their pivot cycle.</li>
  <li><strong>Deny their hazards.</strong> Taunt the Stealth Rock setter, or Defog/Court Change the hazards before they compound.</li>
  <li><strong>Target their wincon before they can set up.</strong> If you identify their setup sweeper, bring something that revenge-kills it (Choice Scarf user, priority) and don't let them spend turns on safe pivots.</li>
  <li><strong>Pressure their pivot chain.</strong> If you KO their Corviknight or Incineroar, the whole cycle collapses because they can't regen their walls.</li>
  <li><strong>Key threats:</strong> Choice Band Dragonite, Choice Specs Hydreigon, Mega Gengar (Shadow Tag traps their pivot), Kingambit (Supreme Overlord snowballs as their team falls)</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-rain-archetype-guide">Rain Offense</a> (Pelipper + Swift Swim)</h3>
<p><strong>Their game plan:</strong> Pelipper sets Drizzle on entry → Swift Swim sweepers double Speed → boosted Hydro Pump and 100%-accurate Thunder/Hurricane nuke your team. Mega Greninja is the scariest finisher. Full build in the <a href="/#/faq/pokemon-champions-rain-archetype-guide">Rain archetype deep dive</a>.</p>
<p><strong>Your answers:</strong></p>
<ul>
  <li><strong>Kill Pelipper turn 1.</strong> Pelipper is ×4 weak to Electric. Thundurus-style Thunderbolt or Archaludon Electro Shot removes the Rain enabler immediately, and Swift Swim turns off when weather drops.</li>
  <li><strong>Bring your own weather.</strong> Sand (Tyranitar) or Snow (Froslass) overwrites Rain on switch-in, disabling Swift Swim.</li>
  <li><strong>Grass resists water.</strong> Mega Venusaur and Rillaboom (if added) wall Rain-boosted Hydro Pump trivially.</li>
  <li><strong>Priority moves bypass Swift Swim.</strong> Ice Shard, Bullet Punch, Extreme Speed all ignore the doubled speed tier.</li>
  <li><strong>Key threats:</strong> Tyranitar (weather overwrite + Rock STAB), Archaludon (Electric + Steel), Mega Venusaur (Grass wall), Weavile (Ice Shard priority)</li>
</ul>

<h3>Vs. Stall</h3>
<p><strong>Their game plan:</strong> Outlast everything. Toxic, hazards, recovery, and phazing wear you down over 30+ turns. You cannot out-stall them — you have to break their walls.</p>
<p><strong>Your answers:</strong></p>
<ul>
  <li><strong>Wallbreakers with boosting items.</strong> Choice Band/Specs or setup sweepers that get past their recovery math are the only reliable way through.</li>
  <li><strong>Taunt spam</strong> on Prankster users shuts down Toxic + Recover cycles completely.</li>
  <li><strong>Magic Guard or Heavy-Duty Boots ignores their hazard chip</strong> — Clefable or Archaludon sit on stall walls indefinitely.</li>
  <li><strong>Substitute</strong> blocks Toxic and forces the wall to commit to actual offensive moves.</li>
  <li><strong>Key threats:</strong> Mega Gengar (Taunt trap), Choice Specs Hydreigon, Kingambit (Supreme Overlord chains through walls), Clefable mirror</li>
</ul>

<h3>General principles</h3>
<ul>
  <li><strong>Every archetype has a Taunt weakness.</strong> Prankster Taunt users (Whimsicott, Sableye) disrupt setup, hazards, and stall simultaneously.</li>
  <li><strong>Speed control is the highest-impact tech.</strong> Tailwind beats Trick Room beats raw speed beats nothing.</li>
  <li><strong>Your Mega is your answer.</strong> You only get one per battle — save it for the matchup where it's the key piece.</li>
</ul>
    `,
  },

  // ─── Team building fundamentals ───────────────────────────────
  {
    slug: 'pokemon-champions-team-building-fundamentals',
    question: 'How do I build a competitive team in Pokémon Champions?',
    answer: 'Start with a win condition (usually a Mega or setup sweeper), build a core around it (2-3 Pokemon that enable its setup), then fill with role coverage: speed control, support, wall, and a flex pick. Follow the role-slot framework (Lead, Pivot, Wincon, Wall, Support, Flex), respect the one-Mega and one-item clauses, and stress-test your team against every major archetype before you ladder.',
    category: 'competitive',
    tags: ['team building', 'fundamentals', 'theorycraft', 'roles', 'core', 'wincon'],
    content: `
<h2>The Six-Slot Framework</h2>
<p>Every competitive Champions team, regardless of archetype, maps cleanly onto six role slots. You don't have to name them this way, but if any slot is missing you're overcommitting somewhere else.</p>

<h3>The six slots</h3>
<table>
  <tr><th>Slot</th><th>Job</th><th>Example picks</th></tr>
  <tr><td><strong>1. Lead</strong></td><td>Wins turn 1 — Fake Out, hazards, Tailwind, Trick Room setup</td><td>Incineroar, Glimmora, Whimsicott, Hatterene</td></tr>
  <tr><td><strong>2. Wincon</strong></td><td>The mon that wins the game in the endgame. Usually a Mega or setup sweeper.</td><td>Mega Dragonite, Mega Meganium, Mimikyu, Volcarona</td></tr>
  <tr><td><strong>3. Pivot</strong></td><td>Maintains momentum via U-turn/Volt Switch/Parting Shot. Creates safe switches.</td><td>Incineroar, Corviknight, Scizor, Dragapult</td></tr>
  <tr><td><strong>4. Wall</strong></td><td>Absorbs the opposing wincon's attack. Typically has recovery.</td><td>Corviknight, Hippowdon, Clefable, Slowking</td></tr>
  <tr><td><strong>5. Support</strong></td><td>Intimidate, redirection, Wide Guard, Helping Hand, status spreading</td><td>Incineroar, Clefable, Togekiss, Gliscor</td></tr>
  <tr><td><strong>6. Flex / Tech</strong></td><td>Your counter-pick — fills the gap against a specific opponent archetype</td><td>Varies: Dragonite vs Sand, Tyranitar vs Sun, Hatterene vs HO</td></tr>
</table>
<p>Some Pokémon fill multiple slots at once — Incineroar is Lead + Pivot + Support in one. That's fine. But you shouldn't have two members occupying the same slot AND no coverage for another.</p>

<h3>Build order: start with the wincon</h3>
<p>The most common mistake is starting with "I like this Pokémon" and slotting in whatever synergizes. The better approach:</p>
<ol>
  <li><strong>Pick your wincon first.</strong> What mon ends games? If it's a Mega, that decides half your team because you're committing your one Mega slot.</li>
  <li><strong>Build a 2-3 mon core that enables the wincon.</strong> If your wincon is Mega Meganium (Sun), you need Chlorophyll partners. If it's setup Dragonite, you need a way to remove priority.</li>
  <li><strong>Add speed control.</strong> Tailwind if your core is fast, Trick Room if your core is slow. Champions' bring-6-pick-N format means you don't always bring speed control — but if every lineup subset lacks it, you're vulnerable.</li>
  <li><strong>Fill the wall slot.</strong> Something that absorbs the mirror match's wincon.</li>
  <li><strong>Fill support + flex last.</strong> These are tuned based on what gaps your other four members leave.</li>
</ol>

<h3>The core + cover pattern</h3>
<p>Once you've picked your wincon, identify the "cover" — the 1-2 mons that directly enable it. Common cores:</p>
<ul>
  <li><strong><a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun core</a>:</strong> Mega Meganium + Venusaur. The wincon is Venusaur sweeping under Sun; Meganium is the cover that enables it.</li>
  <li><strong><a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand core</a>:</strong> Tyranitar + Excadrill. Wincon is Excadrill; Tyranitar provides the Sand.</li>
  <li><strong><a href="/#/faq/pokemon-champions-rain-archetype-guide">Rain core</a>:</strong> Pelipper + Mega Greninja or Kingdra. Wincon is a Swift Swim sweeper abusing boosted Water STAB.</li>
  <li><strong><a href="/#/faq/pokemon-champions-snow-archetype-guide">Snow core</a>:</strong> Mega Froslass + Weavile / Beartic. Wincon is chip under Aurora Veil while Slush Rush attackers clean.</li>
  <li><strong><a href="/#/faq/pokemon-champions-trick-room-archetype-guide">Trick Room core</a>:</strong> Hatterene + Rhyperior / Conkeldurr. Wincon is a slow wallbreaker outspeeding the entire field for 5 turns.</li>
  <li><strong><a href="/#/faq/pokemon-champions-tailwind-archetype-guide">Setup / Tailwind core</a>:</strong> Mimikyu + Whimsicott. Wincon is a boosted sweeper; Mimikyu absorbs a hit with Disguise, Whimsicott sets Tailwind.</li>
  <li><strong>Trap core:</strong> Mega Gengar + Perish Song user. Wincon is forcing KOs via Shadow Tag + Perish Song.</li>
  <li><strong><a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">Hazard core</a>:</strong> Hippowdon + setup sweeper. Hazards chip through switches; the sweeper wins the endgame.</li>
</ul>

<h3>Speed tier ladder</h3>
<p>Understanding the speed tier ladder is critical for spread optimization. Key benchmarks in Champions at Level 50:</p>
<ul>
  <li><strong>142+ base speed:</strong> Dragapult — fastest common Pokémon. If you can't match this, pack a Scarf user or Tailwind.</li>
  <li><strong>130+ base:</strong> Aerodactyl, Weavile, Jolteon — outspeeds most Scarfers at base 110.</li>
  <li><strong>110-120:</strong> Greninja, Gengar, Starmie — the "fast sweeper" range.</li>
  <li><strong>100:</strong> Garchomp, Salamence, Infernape — the "Speed threshold" many bulky mons benchmark against.</li>
  <li><strong>80-95:</strong> The "balanced sweeper" range — you invest in Speed and outrun base 70 walls.</li>
  <li><strong>Below 60:</strong> Trick Room territory — don't try to outspeed, get under them with a Brave/Quiet nature.</li>
</ul>
<p>The <a href="/">damage calculator</a>'s speed benchmarks feature shows you the exact SP investment needed to outrun a specific target.</p>

<h3>Item clause planning</h3>
<p>Champions enforces <strong>one of each item per team</strong> — you physically cannot build a team with two Focus Sashes. Plan your item distribution up front:</p>
<ul>
  <li><strong>Focus Sash</strong> goes on your most fragile setup sweeper</li>
  <li><strong>Leftovers</strong> goes on your wall</li>
  <li><strong>Choice Scarf</strong> goes on your revenge killer</li>
  <li><strong>Lum Berry</strong> goes on your setup sweeper (status protection)</li>
  <li><strong>Mega Stone</strong> goes on exactly one Pokémon</li>
  <li><strong>Type-boost item</strong> (Life Orb equivalent, 20% boost) on your Choice-less wallbreaker</li>
</ul>
<p>That's 6 slots planned before you've filled any species. If you notice you're out of items before you're out of slots, some slot needs to drop an item they were getting for free — usually the "Flex / Tech" slot settles for a resist berry or Shell Bell.</p>

<h3>Stress-test against every archetype</h3>
<p>Before you ladder, run a mental simulation. Each archetype links to its deep-dive so you can re-read how they're built before imagining the matchup:</p>
<ul>
  <li>Vs <a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun</a> — which 3/4 do you bring? Do you have the SE coverage?</li>
  <li>Vs <a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand</a> — can you outspeed Excadrill?</li>
  <li>Vs <a href="/#/faq/pokemon-champions-rain-archetype-guide">Rain</a> — Electric answer to Pelipper? Grass resist for Swift Swim attackers?</li>
  <li>Vs <a href="/#/faq/pokemon-champions-snow-archetype-guide">Snow</a> — Fire coverage to punch through Aurora Veil?</li>
  <li>Vs <a href="/#/faq/pokemon-champions-trick-room-archetype-guide">TR</a> — who taunts, who phazes, who outlasts?</li>
  <li>Vs <a href="/#/faq/pokemon-champions-tailwind-archetype-guide">Tailwind</a> — mirror or reverse with TR?</li>
  <li>Vs <a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">HO</a> — hazard removal + priority user?</li>
  <li>Vs <a href="/#/faq/pokemon-champions-intimidate-balance-archetype-guide">Balance</a> — wallbreaker to punch through?</li>
</ul>
<p>If any archetype leaves you with a bring list of "I guess I'll figure it out" — that's a hole you need to fill before laddering, not after losing 5 games in a row.</p>

<h3>Common team-building mistakes</h3>
<ol>
  <li><strong>Two Megas on the same team.</strong> You can only use one per battle. The second Mega Stone is dead weight.</li>
  <li><strong>Overloading on setup sweepers.</strong> Three Dragon Dance users looks strong until you realize none of them can clean without setup support.</li>
  <li><strong>No hazard removal.</strong> Stealth Rock chip adds up across a match. A Defog or Rapid Spin user is mandatory.</li>
  <li><strong>All slow or all fast.</strong> Speed control only helps if your team can actually benefit. All-slow teams need Trick Room; all-fast teams need Tailwind or nothing.</li>
  <li><strong>Ignoring the Flex slot.</strong> A team with five "universal answer" picks and no specialized counter loses to hard-counter archetypes. Dedicate one slot to a tech pick.</li>
</ol>
    `,
  },

  // ─── SP theorycrafting ────────────────────────────────────────
  {
    slug: 'pokemon-champions-sp-spread-theorycrafting',
    question: 'How do I theorycraft optimal SP spreads in Pokémon Champions?',
    answer: 'Start from a speed benchmark (outspeed X after boost Y, or sit at a Trick Room tier), put the rest into HP and the relevant defense to survive a key attack, then dump remaining SP into offense. Champions\' 66-SP-max-32 budget is tighter than VGC\'s 510-EV-max-252, so every point is meaningful. Use the damage calculator\'s meta benchmarks feature to see exact SP thresholds for specific KOs and OHKOs.',
    category: 'stats',
    tags: ['sp spreads', 'theorycraft', 'speed benchmarks', 'bulk', 'stat points', 'training'],
    content: `
<h2>SP Spread Fundamentals</h2>
<p>Champions uses Stat Points instead of EVs: 66 total SP, max 32 per stat. That's roughly a quarter the budget of mainline VGC's 510-EV system, which means every SP has more impact and spread optimization matters more, not less.</p>

<h3>The three-phase allocation method</h3>
<p>Every spread should answer three questions in order:</p>
<ol>
  <li><strong>Speed: what do I need to outrun?</strong> Pick a specific target (e.g., "outspeed base 100 Garchomp with +Spe nature") and allocate exactly enough Spe SP to hit that benchmark. Anything more is wasted SP that could be bulk or offense.</li>
  <li><strong>Bulk: what do I need to survive?</strong> Identify the most threatening attack you have to live through and allocate HP + Def or HP + SpD to survive it. The calculator's damage output shows exactly how many SPs you need.</li>
  <li><strong>Offense: how much power do I need?</strong> Whatever SP is left goes into Atk or SpA. Hit a meaningful power benchmark (e.g., "2HKO max HP Incineroar") rather than just maxing the stat.</li>
</ol>
<p>Do them in that order. Players who start with "max Atk + max Spe" and then fill in bulk always end up short somewhere.</p>

<h3>Speed benchmarks worth knowing</h3>
<table>
  <tr><th>Target</th><th>Base Spe</th><th>SP + nature needed to outspeed (Lv50)</th></tr>
  <tr><td>Slow wall (Hippowdon)</td><td>47</td><td>0 Spe, any nature</td></tr>
  <tr><td>Neutral base 80 (Feraligatr)</td><td>78</td><td>~4 Spe without +nature</td></tr>
  <tr><td>Base 95 (Garchomp)</td><td>102 after +nature</td><td>Need Jolly + 12 Spe SP to match, or +Scarf</td></tr>
  <tr><td>Base 110 (Tornadus-class)</td><td>120 max</td><td>32 Spe + Jolly to match on Garchomp</td></tr>
  <tr><td>Base 142 (Dragapult)</td><td>156 max</td><td>Match only with Choice Scarf</td></tr>
  <tr><td>Trick Room sweet spot</td><td>50 or below</td><td>0 Spe, Brave/Quiet nature for max slow</td></tr>
</table>
<p>If your target isn't on this table, fire up the calculator — set your Pokemon, select the target, and drag the Spe slider until your stat exceeds theirs by 1 point. That's your benchmark.</p>

<h3>Bulk math — surviving a specific attack</h3>
<p>In Champions' tighter SP budget, most Pokémon don't need max HP AND max Def. You just need enough bulk to survive the attack you're worried about. Workflow:</p>
<ol>
  <li>In the calculator, set your Pokémon as the defender with 0 HP / 0 Def SP.</li>
  <li>Set the attacker as the threat you want to live (e.g., max-Atk Garchomp Earthquake).</li>
  <li>Read the damage percentage.</li>
  <li>If it's over 100%, add 4 HP SP and recalculate. Repeat until you survive 87.5% of rolls (the "guaranteed 2HKO survive" threshold).</li>
  <li>If you can survive with just HP, save Def SP. If HP alone isn't enough, add Def or SpD.</li>
</ol>

<h3>Common SP spread archetypes</h3>

<h4>Fast sweeper</h4>
<pre>0 HP / 32 Atk / 0 Def / 0 SpA / 2 SpD / 32 Spe   Jolly</pre>
<p>The classic offensive spread. Max Atk, max Spe, nothing else matters. Use when your role is "outrun and OHKO."</p>

<h4>Bulky attacker</h4>
<pre>32 HP / 32 Atk / 4 Def / 0 SpA / 0 SpD / 0 Spe   Adamant</pre>
<p>Slow and tanky. Dump Spe, max Atk + HP for multiple turns of pressure. Typical of Tyranitar, Conkeldurr, or Rhyperior.</p>

<h4>Trick Room attacker</h4>
<pre>32 HP / 32 Atk / 2 Def / 0 SpA / 0 SpD / 0 Spe   Brave</pre>
<p>Same as Bulky Attacker but with a Speed-reducing nature to hit the TR sweet spot. At 0 SP + Brave, your Speed is as low as it gets so you move first in Trick Room.</p>

<h4>Defensive wall</h4>
<pre>32 HP / 0 Atk / 32 Def / 0 SpA / 2 SpD / 0 Spe   Bold</pre>
<p>Classic physical wall. Max HP + Def, Bold nature for an extra 10% Def, invest nothing in offense since walls don't attack. Hippowdon, Corviknight, Clefable.</p>

<h4>Specially defensive wall</h4>
<pre>32 HP / 0 Atk / 2 Def / 0 SpA / 32 SpD / 0 Spe   Careful</pre>
<p>Same shape but flipped to specially defensive. Umbreon, Slowking, Florges.</p>

<h4>Mixed wall (assault vest-free bulk)</h4>
<pre>32 HP / 0 Atk / 16 Def / 0 SpA / 16 SpD / 2 Spe   Impish</pre>
<p>When you need to survive both sides because the calculator shows you get 2HKOd by specific physical AND special attacks.</p>

<h4>Speed-boosted bulky attacker</h4>
<pre>16 HP / 32 Atk / 0 Def / 0 SpA / 2 SpD / 16 Spe   Jolly</pre>
<p>Hits a specific speed benchmark (usually outspeed base 95 after +1) while retaining some bulk. The classic Dragon Dance Dragonite or Swords Dance Garchomp spread.</p>

<h3>Advanced: the "creep wars" consideration</h3>
<p>When two sweepers are at the exact same speed, whichever has more Spe SP wins. This creates a "creep war" — you might see some ladder players dump 1-2 extra SP into Speed specifically to creep the mirror match. In Champions' 32-SP-max world, a 1-point creep is significant because the cap is much lower than VGC's 252 EVs. If the mirror matters for your matchup (e.g., Whimsicott mirrors decide Tailwind speed), invest the extra point.</p>

<h3>Nature choices — the 10% multiplier</h3>
<p>Natures apply a 10% boost to one stat and a 10% penalty to another. Because SP is capped at 32, the nature multiplier is often worth MORE than spending SP:</p>
<ul>
  <li><strong>Jolly</strong> (+Spe, -SpA) on a physical sweeper that wants max Speed</li>
  <li><strong>Timid</strong> (+Spe, -Atk) on a special sweeper that wants max Speed</li>
  <li><strong>Adamant</strong> (+Atk, -SpA) when you need the extra 10% physical damage and Speed isn't the priority</li>
  <li><strong>Modest</strong> (+SpA, -Atk) same for special</li>
  <li><strong>Brave</strong> (+Atk, -Spe) for Trick Room physical attackers</li>
  <li><strong>Quiet</strong> (+SpA, -Spe) for Trick Room special attackers</li>
  <li><strong>Bold</strong> (+Def, -Atk) for physical walls</li>
  <li><strong>Careful</strong> (+SpD, -Atk) for special walls that don't want their Atk accidentally used by Foul Play calcs</li>
</ul>

<h3>Natures in Champions are free to change</h3>
<p>Unlike Scarlet/Violet where Mints cost Bottle Caps, Champions lets you change natures freely with Victory Points. This means you can test spreads with different natures without commitment — experiment liberally.</p>
    `,
  },

  // ─── Comp deep dive: Mega Meganium Sun ────────────────────────
  {
    slug: 'pokemon-champions-mega-meganium-sun-deep-dive',
    question: 'How do I build and play a Mega Meganium Sun team?',
    answer: 'Mega Meganium\'s Mega Sol ability treats every turn as Sun regardless of field weather, enabling a permanent-sun team that can\'t be disrupted by opposing Rain. Build around Meganium + Venusaur (Chlorophyll) as the core, add Incineroar for support, a Tailwind user for speed control, and a physical wallbreaker to punish Rock-types that try to counter the core. The team wins by keeping Meganium alive turn 1 so Chlorophyll speed comes online, then sweeping with boosted Solar Beam and Fire partners.',
    category: 'competitive',
    tags: ['mega meganium', 'mega sol', 'sun team', 'team deep dive', 'chlorophyll', 'archetype'],
    content: `
<h2>Mega Meganium Sun: A Complete Breakdown</h2>
<p>This is a deep dive on a specific team archetype: Mega Meganium Sun. The goal is to show you how to build around a single wincon from the ground up, including lead sequencing, matchup threats, and common play patterns.</p>

<h3>Why Mega Meganium?</h3>
<p>Mega Meganium gains the new Z-A ability <strong>Mega Sol</strong>: all moves calculate damage as if Sunny Day is active, regardless of the field weather. This is subtly but powerfully different from Drought (Mega Charizard Y):</p>
<ul>
  <li><strong>Can't be overwritten by opposing weather.</strong> Mega Tyranitar or Pelipper changing the weather doesn't stop Mega Sol — the ability is always on.</li>
  <li><strong>No wasted Mega Evolution turn.</strong> Mega Charizard Y has to Mega Evolve before Drought activates, giving the opponent a free turn. Mega Meganium activates Mega Sol the moment it Mega Evolves, and the effect applies to calc immediately.</li>
  <li><strong>But no field weather.</strong> Chlorophyll partners still need actual Sun to activate their speed boost — Mega Sol doesn't trigger weather-dependent abilities. So you need Meganium AND a real weather setter, OR a Chlorophyll partner that can abuse Sun-boosted moves without the speed boost.</li>
</ul>
<p>The niche: Mega Meganium is the ultimate <strong>weather-resistant Sun damage amplifier</strong>. It pairs with Drought Charizard or a held-item Heat Rock Ninetales to enable Chlorophyll, while itself never losing its Sun bonus.</p>

<h3>The team</h3>
<table>
  <tr><th>#</th><th>Pokémon</th><th>Item</th><th>Role</th></tr>
  <tr><td>1</td><td><strong>Meganium</strong></td><td>Meganiumite</td><td>Mega Sol anchor + lead</td></tr>
  <tr><td>2</td><td><strong>Venusaur</strong></td><td>Miracle Seed</td><td>Chlorophyll sweeper</td></tr>
  <tr><td>3</td><td><strong>Incineroar</strong></td><td>Sitrus Berry</td><td>Intimidate + Fake Out support</td></tr>
  <tr><td>4</td><td><strong>Whimsicott</strong></td><td>Focus Sash</td><td>Prankster Tailwind</td></tr>
  <tr><td>5</td><td><strong>Garchomp</strong></td><td>Soft Sand</td><td>Physical Rock/Ground answer</td></tr>
  <tr><td>6</td><td><strong>Hatterene</strong></td><td>Mental Herb</td><td>Trick Room flex + Taunt block</td></tr>
</table>

<h4>Meganium (Mega Sol)</h4>
<pre>Nature: Modest
Ability: Overgrow → Mega Sol on Mega Evolution
Item: Meganiumite
SPs: 32 HP / 0 Atk / 2 Def / 32 SpA / 0 SpD / 0 Spe
Moves: Solar Beam, Giga Drain, Earth Power, Protect</pre>
<p><strong>Role:</strong> Lead and anchor. Mega Evolves turn 1, Mega Sol activates, Solar Beam has no charge turn because it calculates as if Sun is up. Earth Power covers Rock, Fire, and Steel switch-ins. Giga Drain provides sustain. Protect buys a turn for Whimsicott to set Tailwind.</p>

<h4>Venusaur (Chlorophyll)</h4>
<pre>Nature: Timid
Ability: Chlorophyll
Item: Miracle Seed
SPs: 0 HP / 0 Atk / 2 Def / 32 SpA / 0 SpD / 32 Spe
Moves: Sludge Bomb, Solar Beam, Sleep Powder, Protect</pre>
<p><strong>Role:</strong> Chlorophyll requires real Sun to activate speed boost, so Venusaur either needs Charizard Y (not on this team) or pairs with a held item that simulates the boost. Here we accept that Venusaur won't hit the Chlorophyll speed unless we sacrifice Incineroar's slot for Charizard — but we don't. Instead Venusaur functions as a secondary special wallbreaker that benefits from Mega Sol's Grass-boost math even without the speed component. Sludge Bomb hits Fairy walls.</p>

<h4>Incineroar (Intimidate + Fake Out)</h4>
<pre>Nature: Adamant
Ability: Intimidate
Item: Sitrus Berry
SPs: 32 HP / 16 Atk / 2 Def / 0 SpA / 16 SpD / 0 Spe
Moves: Flare Blitz, Fake Out, Parting Shot, Knock Off</pre>
<p><strong>Role:</strong> Standard Incineroar support package. Fake Out can't be used on switch-in in Champions, so it's a turn-2+ disruption tool. Parting Shot pivots out safely while debuffing both opponents. Knock Off removes Choice items or Leftovers from walls.</p>

<h4>Whimsicott (Prankster Tailwind)</h4>
<pre>Nature: Timid
Ability: Prankster
Item: Focus Sash
SPs: 0 HP / 0 Atk / 0 Def / 16 SpA / 16 SpD / 32 Spe
Moves: Tailwind, Moonblast, Encore, Protect</pre>
<p><strong>Role:</strong> Prankster Tailwind gives you priority speed control. Focus Sash guarantees you get Tailwind up even against a Fake Out lead. Encore locks opposing setup sweepers into a move so you can pivot around them. Moonblast punishes Dragon/Dark threats like Hydreigon and Mega Charizard X.</p>

<h4>Garchomp (Physical wallbreaker)</h4>
<pre>Nature: Jolly
Ability: Rough Skin
Item: Soft Sand
SPs: 0 HP / 32 Atk / 0 Def / 0 SpA / 2 SpD / 32 Spe
Moves: Earthquake, Dragon Claw, Rock Slide, Protect</pre>
<p><strong>Role:</strong> The team's physical answer to Rock-type Pokémon that would normally counter the Sun core (Tyranitar, Rhyperior, Aerodactyl). Earthquake under Tailwind outspeeds and OHKOes most Rock walls.</p>

<h4>Hatterene (Trick Room flex)</h4>
<pre>Nature: Quiet
Ability: Magic Bounce
Item: Mental Herb
SPs: 32 HP / 0 Atk / 16 Def / 16 SpA / 2 SpD / 0 Spe
Moves: Trick Room, Psyshock, Dazzling Gleam, Protect</pre>
<p><strong>Role:</strong> Flex / tech slot. If the opponent is on <a href="/#/faq/pokemon-champions-tailwind-archetype-guide">Tailwind</a> or <a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">Hyper Offense</a>, you bring Hatterene to set Trick Room and flip the tempo. Magic Bounce blocks opposing Taunt that would otherwise lock Hatterene out of the setup.</p>

<h3>Lead sequencing</h3>
<p><strong>Default lead:</strong> Meganium + Whimsicott.</p>
<ol>
  <li><strong>Turn 1:</strong> Meganium Mega Evolves (Mega Sol activates). Whimsicott uses Prankster Tailwind. Tailwind is up, Mega Sol is active, and Solar Beam is ready with no charge turn.</li>
  <li><strong>Turn 2:</strong> Meganium fires Solar Beam at the biggest threat. Whimsicott either Encores an opposing setup move or switches to Incineroar to bring Intimidate online.</li>
  <li><strong>Turn 3:</strong> Endgame. Meganium pressures with Giga Drain + Earth Power, or switches to Garchomp under Tailwind for physical cleanup.</li>
</ol>

<h3>Matchups</h3>
<h4>Vs <a href="/#/faq/pokemon-champions-rain-archetype-guide">Rain</a> (Pelipper + Primarina)</h4>
<p>This is Mega Meganium's best matchup. Rain doesn't affect Mega Sol. You fire off full-power Solar Beam into Pelipper turn 1 (no charge turn) and OHKO. Primarina gets walled by Incineroar's Knock Off.</p>

<h4>Vs <a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand</a> (Tyranitar + Excadrill)</h4>
<p>Harder. Tyranitar's Rock STAB threatens Meganium, and Excadrill outspeeds even under Tailwind if you don't get it up turn 1. Lead Meganium + Whimsicott — Tailwind on turn 1 lets you outspeed Excadrill and OHKO with Garchomp Earthquake on turn 2. Meganium uses Earth Power into Tyranitar.</p>

<h4>Vs <a href="/#/faq/pokemon-champions-trick-room-archetype-guide">Trick Room</a></h4>
<p>Bring Hatterene and Magic Bounce the opposing Trick Room back at them. The rest of the team doesn't handle TR well, so Hatterene is a must-bring.</p>

<h4>Vs Opposing <a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun</a> (Charizard Y or Ninetales)</h4>
<p>Mega Sol still works — both Suns stack (their Drought sets weather, your Mega Sol calculates as if weather is Sun regardless). Your advantage is that Meganium doesn't take a Sun weakness the way Charizard Y does (Fire → Water becomes more dangerous under Rain). Lead Meganium + Garchomp, outspeed their Charizard with Rock Slide.</p>

<h4>Vs Mega Gengar trap</h4>
<p>Shadow Tag traps Meganium in. You have one shot to OHKO Gengar before Perish Song kicks in — Earth Power from Mega Sol-boosted Meganium does massive damage but may not OHKO. Bring Whimsicott to Encore the Perish Song into uselessness, or skip Meganium entirely this matchup.</p>

<h3>Common mistakes with Mega Meganium teams</h3>
<ul>
  <li><strong>Forgetting Mega Sol doesn't set field weather.</strong> Your Chlorophyll partner won't have doubled Speed unless actual Sun is up. Either pair with Charizard Y for real Drought, or accept that Venusaur is just a wallbreaker in your team.</li>
  <li><strong>Leading without Whimsicott.</strong> Without Tailwind, Meganium gets outsped and pressured before Mega Sol can matter. Whimsicott has to be in the front half of your lineup.</li>
  <li><strong>Protecting turn 1 instead of Mega Evolving.</strong> Mega Evolution is automatic — you can't skip it. Don't waste the Protect click before you've committed to Mega.</li>
  <li><strong>Bringing both Chlorophyll partners when Sun isn't set.</strong> Venusaur + Victreebel without Charizard Y = both partners at normal Speed. Only bring them if you have a real Sun setter on the team.</li>
</ul>

<h3>Variants and tech options</h3>
<ul>
  <li><strong>Swap Incineroar → Arcanine.</strong> Another Intimidate user with Flare Blitz boosted by Mega Sol. Loses Parting Shot but gains more raw damage.</li>
  <li><strong>Swap Hatterene → Torkoal.</strong> A real Drought setter turns this into a dedicated Sun team. Venusaur gets Chlorophyll online. Lose the Trick Room counter.</li>
  <li><strong>Swap Garchomp → Mega Charizard X.</strong> If you drop Meganiumite and go with Charizardite X, you get both physical Fire STAB AND Sun math, but you lose Mega Sol's weather immunity.</li>
</ul>
<p>The team as listed is designed to showcase Mega Meganium's specific strength (Mega Sol anti-weather) while keeping competitive balance against every major archetype. Copy it verbatim to climb ladder, or use it as a starting template for your own variant.</p>
    `,
  },
  {
    slug: 'pokemon-champions-sun-archetype-guide',
    question: 'How do Sun teams work in Pokémon Champions?',
    answer: 'Sun teams in Champions have two distinct flavors. Mega Charizard Y sets real weather via Drought, enabling Chlorophyll sweepers and turning Solar Beam into a no-charge nuke. Mega Meganium\'s new Mega Sol ability calculates every move as if Sun were active without actually setting weather — it\'s weather-immune but doesn\'t activate Chlorophyll. Both cores share Venusaur, Whimsicott, and Incineroar as universal partners.',
    category: 'competitive',
    tags: ['sun', 'drought', 'chlorophyll', 'mega charizard y', 'mega meganium', 'archetype', 'team comp'],
    content: `
<h2>Sun Archetype — Overview</h2>

<div class="at-a-glance">
  <div><span class="label">Playstyle</span><span class="value">Boosted offense</span></div>
  <div><span class="label">Enabler</span><span class="value">Charizard Y / Meganium</span></div>
  <div><span class="label">Best format</span><span class="value">Doubles</span></div>
  <div><span class="label">Difficulty</span><span class="value">Medium</span></div>
</div>

<p>Champions has <strong>two independent Sun enablers</strong> that play very differently. Picking between them is the first decision of the build.</p>

<div class="callout">
  <p><span class="tag">Key distinction</span>Charizard Y sets <em>real weather</em> (Drought). Mega Meganium\'s <em>Mega Sol</em> only fakes the damage math — it doesn\'t set weather, so Chlorophyll partners won\'t benefit.</p>
</div>

<h3>How Sun works</h3>
<ul>
  <li>Fire moves deal <strong>1.5×</strong> damage</li>
  <li>Water moves deal <strong>0.5×</strong> damage</li>
  <li>Solar Beam skips its charge turn</li>
  <li>Chlorophyll doubles Speed (real weather only)</li>
  <li>Synthesis / Morning Sun / Moonlight recover <strong>2/3 HP</strong></li>
  <li>Duration: <strong>5 turns</strong> (no Heat Rock in Champions)</li>
</ul>

<h2>Two cores, two strategies</h2>

<h3>Core A — Real Sun (Mega Charizard Y)</h3>
<p>Drought sets actual field weather. Enables Chlorophyll partners. Every Fire move on your side is boosted.</p>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Mega Charizard Y</span>
    <span class="meta">Timid · Charizardite Y · 32 SpA / 32 Spe</span>
    <p>Heat Wave / Solar Beam / Air Slash / Protect. Sets Sun via Drought on Mega Evolution.</p>
  </div>
  <div class="role-card">
    <span class="name">Venusaur</span>
    <span class="meta">Modest · Miracle Seed · 32 HP / 32 SpA</span>
    <p>Giga Drain / Sludge Bomb / Earth Power / Protect. Chlorophyll doubles Speed in Sun.</p>
  </div>
  <div class="role-card">
    <span class="name">Victreebel</span>
    <span class="meta">Jolly · Soft Sand · 32 Atk / 32 Spe</span>
    <p>Leaf Blade / Sucker Punch / Knock Off / Protect. Physical Chlorophyll alternative.</p>
  </div>
</div>

<h3>Core B — Mega Sol (Mega Meganium)</h3>
<p>Mega Sol calculates damage as if Sun were active. It does <em>not</em> set real weather, so Chlorophyll partners don\'t double their Speed — but nothing can disrupt it either.</p>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Mega Meganium</span>
    <span class="meta">Modest · Meganiumite · 32 HP / 32 SpA</span>
    <p>Earth Power / Solar Beam / Giga Drain / Protect. Weather-immune Sun math.</p>
  </div>
  <div class="role-card">
    <span class="name">Whimsicott</span>
    <span class="meta">Timid · Focus Sash · 32 HP / 32 Spe</span>
    <p>Prankster Tailwind solves Meganium\'s base 80 Speed problem. Mandatory partner.</p>
  </div>
</div>

<h3>Universal partners (both cores)</h3>
<div class="role-grid">
  <div class="role-card">
    <span class="name">Incineroar</span>
    <span class="meta">Intimidate + Fake Out</span>
    <p>Swings damage math turn 1. Parting Shot pivots safely.</p>
  </div>
  <div class="role-card">
    <span class="name">Garchomp</span>
    <span class="meta">Physical wallbreaker</span>
    <p>Answers Rock / Ground threats that Fire attackers fear.</p>
  </div>
  <div class="role-card">
    <span class="name">Clefable</span>
    <span class="meta">Follow Me redirection</span>
    <p>Fills the Amoonguss-shaped hole in Champions\' support roster.</p>
  </div>
</div>

<h2>Game plan</h2>

<h3>Doubles</h3>
<ol>
  <li><strong>Turn 1.</strong> Lead Whimsicott + Mega. Prankster Tailwind. Mega Evolves and attacks. Sun / Mega Sol live.</li>
  <li><strong>Turns 2–4.</strong> Outspeed everything. Fire STAB breaks soft walls. Incineroar rotates in for Intimidate cycling.</li>
  <li><strong>Turn 5+.</strong> Real Sun expires. Close, reset Drought via Charizard Y, or lean on priority. Mega Sol never expires.</li>
</ol>

<h3>Singles</h3>
<p class="tight">Sun in Singles works best with Mega Charizard Y + a Chlorophyll Venusaur. Mega Meganium is weaker here because there\'s no redirection partner to abuse the Grass type.</p>
<ol>
  <li><strong>Lead</strong> Charizard Y → Mega Evolve → Drought is up.</li>
  <li><strong>Force a switch</strong> with Solar Beam threat (no charge turn in Sun).</li>
  <li><strong>Pivot</strong> to Venusaur (Growth +2 in Sun) or a Sun-boosted wallbreaker on the predicted switch.</li>
  <li><strong>Sweep</strong> through weakened switch-ins with doubled Chlorophyll Speed.</li>
  <li><strong>Reset Drought</strong> via Charizard Y switch-in if Sun expires mid-game.</li>
</ol>
<p class="tight">Singles Sun is a glass-cannon archetype — don\'t expect to win long grinds. Close inside 10 turns or concede the pace.</p>

<h2>Matchups</h2>
<table>
  <tr><th>Vs</th><th>Outcome</th><th>Plan</th></tr>
  <tr><td>Rain</td><td>Charizard Y: bad · Meganium: neutral</td><td>Mega Sol ignores Rain. Charizard Y loses its math.</td></tr>
  <tr><td>Sand</td><td>Neutral</td><td>Mega Sol bypasses weather overwrites.</td></tr>
  <tr><td>Snow</td><td>Favored</td><td>Boosted Fire cuts through Aurora Veil.</td></tr>
  <tr><td>Trick Room</td><td>Unfavored</td><td>Bring Hatterene for Magic Bounce insurance.</td></tr>
  <tr><td>Tailwind</td><td>Neutral</td><td>Speed race. Whimsicott Taunt disrupts.</td></tr>
  <tr><td>Hyper Offense</td><td>Favored</td><td>Intimidate + Fire power overwhelms glass cannons.</td></tr>
</table>

<h2>Common mistakes</h2>

<div class="callout warn">
  <p><span class="tag">Pitfall</span>Running Chlorophyll partners with Mega Meganium. Mega Sol does <em>not</em> set weather — Venusaur stays at base Speed. Only use Chlorophyll with a real Drought setter.</p>
</div>

<ul>
  <li><strong>Protecting turn 1 instead of Mega Evolving.</strong> Click an attack — Mega triggers automatically.</li>
  <li><strong>Leading without a speed mechanic.</strong> Sun mons are mid-speed. You need Tailwind or Scarf.</li>
  <li><strong>Building for turn 6+.</strong> Real Sun is 5 turns. Close before the window expires.</li>
</ul>

<h2>Related articles</h2>
<ul>
  <li><a href="/#/faq/pokemon-champions-mega-meganium-sun-deep-dive">Mega Meganium Sun team — full build</a></li>
  <li><a href="/#/faq/pokemon-champions-team-archetypes">All team archetypes overview</a></li>
  <li><a href="/#/faq/pokemon-champions-counter-opposing-archetypes">Counter-picking opposing archetypes</a></li>
</ul>
    `,
  },
  {
    slug: 'pokemon-champions-sand-archetype-guide',
    question: 'How do Sand teams work in Pokémon Champions?',
    answer: 'Sand teams in Champions pair Hippowdon or Tyranitar (the two Sand Stream enablers) with Excadrill, whose Sand Rush ability doubles its Speed in the sand — instantly outpacing every meta threat. Sand also deals 1/16 chip damage per turn to non-Rock/Ground/Steel types, giving Sand teams free incidental damage. It\'s the most hardware-cheap archetype to build because both anchors are untouched by Champions rule changes.',
    category: 'competitive',
    tags: ['sand', 'sand stream', 'sand rush', 'hippowdon', 'tyranitar', 'excadrill', 'archetype', 'team comp'],
    content: `
<h2>Sand Archetype — Overview</h2>

<div class="at-a-glance">
  <div><span class="label">Playstyle</span><span class="value">Chip + cleanup</span></div>
  <div><span class="label">Enabler</span><span class="value">Hippowdon / Tyranitar</span></div>
  <div><span class="label">Win condition</span><span class="value">Sand Rush Excadrill</span></div>
  <div><span class="label">Difficulty</span><span class="value">Easy</span></div>
</div>

<p>Sand is the "just works" archetype of Champions. Both setters and Excadrill are in the roster, and none of them were touched by rule changes. <strong>Fastest ladder path</strong> if you want to skip theorycrafting.</p>

<h3>How Sand works</h3>
<ul>
  <li><strong>Sand Stream</strong> sets 5 turns on switch-in</li>
  <li><strong>Chip damage</strong> — 1/16 HP per turn vs non Rock / Ground / Steel</li>
  <li><strong>Rock types</strong> gain +50% Special Defense</li>
  <li><strong>Sand Rush</strong> doubles Speed (Excadrill)</li>
  <li><strong>Sand Force</strong> +30% to Rock / Ground / Steel moves (Garchomp, Stunfisk)</li>
  <li><strong>Sand Veil</strong> +20% evasion (Gliscor)</li>
</ul>

<h2>The locked core</h2>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Hippowdon</span>
    <span class="meta">Impish · Leftovers · 32 HP / 32 Def</span>
    <p>Earthquake / Slack Off / Stealth Rock / Whirlwind. Self-sustaining pivot.</p>
  </div>
  <div class="role-card">
    <span class="name">Tyranitar</span>
    <span class="meta">Adamant · Tyranitarite · 32 HP / 32 Atk</span>
    <p>Rock Slide / Crunch / Ice Punch / Protect. Alternate anchor + wallbreaker.</p>
  </div>
  <div class="role-card">
    <span class="name">Excadrill</span>
    <span class="meta">Jolly · Soft Sand · 32 Atk / 32 Spe</span>
    <p>Earthquake / Iron Head / Rock Slide / Protect. ~324 Speed in Sand.</p>
  </div>
</div>

<h3>Hippowdon vs Tyranitar</h3>
<table>
  <tr><th></th><th>Hippowdon</th><th>Tyranitar</th></tr>
  <tr><td>Bulk</td><td>Elite physical wall</td><td>Mixed + Sand SpD</td></tr>
  <tr><td>Mega slot</td><td>Free</td><td>Used (Mega T-Tar)</td></tr>
  <tr><td>Offense</td><td>Low</td><td>High — wallbreaker</td></tr>
  <tr><td>Hazards</td><td>Natural SR setter</td><td>Optional SR</td></tr>
</table>

<div class="callout tip">
  <p><span class="tag">Rule of thumb</span>Pick Hippowdon if you want to Mega with something else (Excadrill, Garchomp, Aerodactyl). Pick Tyranitar if you don\'t need another Mega and want the nuke.</p>
</div>

<h3>Common partners</h3>
<div class="role-grid">
  <div class="role-card">
    <span class="name">Garchomp</span>
    <span class="meta">Sand Force boost</span>
    <p>+30% Earthquake and Rock Slide. Also a full sweeper in its own right.</p>
  </div>
  <div class="role-card">
    <span class="name">Gliscor</span>
    <span class="meta">Sand Veil + Defog</span>
    <p>Keeps your own hazards while removing theirs. Evasion chip.</p>
  </div>
  <div class="role-card">
    <span class="name">Mega Aerodactyl</span>
    <span class="meta">Tough Claws</span>
    <p>Rock Slide + elite Speed. Flying secondary STAB.</p>
  </div>
  <div class="role-card">
    <span class="name">Mamoswine</span>
    <span class="meta">Ice Shard priority</span>
    <p>Handles Dragons that don\'t fear Sand.</p>
  </div>
</div>

<h2>Game plan</h2>

<h3>Doubles</h3>
<ol>
  <li><strong>Turn 1.</strong> Lead Hippowdon + Excadrill. Sand sets. Excadrill is now faster than everything unboosted.</li>
  <li><strong>Turn 2.</strong> Spam Earthquake — Hippowdon is Ground-immune. Hippowdon Protects or Stealth Rocks.</li>
  <li><strong>Turns 3–5.</strong> Cycle Garchomp / Mamoswine for cleanup. Sand chip compounds.</li>
  <li><strong>Turn 6+.</strong> Reset Sand via Hippowdon switch-in. Leftovers + Slack Off = immortal.</li>
</ol>

<h3>Singles</h3>
<ol>
  <li><strong>Lead</strong> Hippowdon or T-Tar → Stealth Rock → pivot out.</li>
  <li><strong>Bring Excadrill</strong> on a forced switch. OHKO or force another switch.</li>
  <li><strong>Close</strong> with Excadrill or Garchomp once Rock / Ground / Steel resists are gone.</li>
</ol>

<h2>Matchups</h2>
<table>
  <tr><th>Vs</th><th>Outcome</th><th>Plan</th></tr>
  <tr><td>Sun</td><td>Neutral</td><td>Sand overwrites Drought. Mega Sol unaffected.</td></tr>
  <tr><td>Rain</td><td>Favored</td><td>Tyranitar Rock STAB OHKOs Pelipper.</td></tr>
  <tr><td>Snow</td><td>Favored</td><td>Sand overwrites Snow. Excadrill punches through Veil.</td></tr>
  <tr><td>Trick Room</td><td>Unfavored</td><td>Excadrill becomes dead weight — grind with the setters.</td></tr>
  <tr><td>Tailwind</td><td>Neutral</td><td>Sand Rush ≈ Tailwind. Whoever sets first wins.</td></tr>
  <tr><td>Hyper Offense</td><td>Favored</td><td>Sand SpD boost protects T-Tar.</td></tr>
</table>

<h2>Common mistakes</h2>

<div class="callout warn">
  <p><span class="tag">Pitfall</span>Clicking Earthquake without a Ground-immune partner. Excadrill\'s EQ hits Hippowdon for 0, but every other partner for full. Only spam it with Hippowdon in the other slot.</p>
</div>

<ul>
  <li><strong>Excadrill without a Sand setter.</strong> Sand Rush is inactive. Excadrill becomes mid-speed and loses its identity.</li>
  <li><strong>Losing the weather war.</strong> Opposing Drizzle overwrites your Sand. Lead T-Tar to reset, or bring a backup setter.</li>
  <li><strong>Ignoring Trick Room.</strong> Excadrill is dead weight under TR — sideboard it out vs Hatterene / Mimikyu leads.</li>
</ul>

<h2>Related articles</h2>
<ul>
  <li><a href="/#/faq/pokemon-champions-team-archetypes">All team archetypes overview</a></li>
  <li><a href="/#/faq/pokemon-champions-counter-opposing-archetypes">Counter-picking opposing archetypes</a></li>
  <li><a href="/#/faq/pokemon-champions-sp-spread-theorycrafting">SP spread theorycrafting</a></li>
</ul>
    `,
  },
  {
    slug: 'pokemon-champions-snow-archetype-guide',
    question: 'How do Snow teams work in Pokémon Champions?',
    answer: 'Snow is newly viable in Champions thanks to Mega Froslass gaining Snow Warning on Mega Evolution. The archetype pairs instant Snow with Aurora Veil — a 5-turn screen that halves physical AND special damage. Ice-types like Weavile, Mamoswine, and Beartic get the usual +50% Defense from Snow, and Slush Rush abusers double their Speed. It\'s the glass-cannon archetype that turns glass into armor.',
    category: 'competitive',
    tags: ['snow', 'snow warning', 'aurora veil', 'mega froslass', 'slush rush', 'archetype', 'team comp'],
    content: `
<h2>Snow Archetype — Overview</h2>

<div class="at-a-glance">
  <div><span class="label">Playstyle</span><span class="value">Veil + Ice offense</span></div>
  <div><span class="label">Enabler</span><span class="value">Mega Froslass</span></div>
  <div><span class="label">Key move</span><span class="value">Aurora Veil</span></div>
  <div><span class="label">Difficulty</span><span class="value">Hard</span></div>
</div>

<p>Snow was fringe in mainline VGC. <strong>Champions changes that</strong> by giving Mega Froslass Snow Warning on Mega Evolution — a one-slot instant Snow setter that can Aurora Veil the same turn.</p>

<h3>How Snow works</h3>
<ul>
  <li><strong>Snow Warning</strong> sets 5 turns of Snow on switch-in</li>
  <li><strong>Ice types</strong> gain <strong>+50% Defense</strong></li>
  <li><strong>Aurora Veil</strong> halves physical AND special damage (Snow-only)</li>
  <li><strong>Slush Rush</strong> doubles Speed (Beartic, Arctozolt)</li>
  <li><strong>Blizzard</strong> hits 100% accurate in Snow</li>
  <li><em>Snow deals no chip damage</em> — unlike old Hail</li>
</ul>

<h2>The core</h2>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Mega Froslass</span>
    <span class="meta">Timid · Froslassite · 32 SpA / 32 Spe</span>
    <p>Blizzard / Ice Beam / Shadow Ball / Aurora Veil. Sets Snow + Veil turn 1. Expect to die turn 2.</p>
  </div>
  <div class="role-card">
    <span class="name">Weavile</span>
    <span class="meta">Jolly · Black Glasses · 32 Atk / 32 Spe</span>
    <p>Ice Shard / Icicle Crash / Knock Off / Protect. Priority cleanup under Veil.</p>
  </div>
  <div class="role-card">
    <span class="name">Mamoswine</span>
    <span class="meta">Adamant · Never-Melt Ice · 32 HP / 32 Atk</span>
    <p>Ice Shard / Icicle Crash / Earthquake / Rock Slide. Bulky secondary.</p>
  </div>
</div>

<h3>Common partners</h3>
<div class="role-grid">
  <div class="role-card">
    <span class="name">Beartic</span>
    <span class="meta">Slush Rush</span>
    <p>Doubled Speed + Icicle Crash flinch cheese. Snow-dependent.</p>
  </div>
  <div class="role-card">
    <span class="name">Arcanine</span>
    <span class="meta">Intimidate + Extreme Speed</span>
    <p>Priority cleaner + Fire coverage for non-Ice enemies.</p>
  </div>
  <div class="role-card">
    <span class="name">Dragonite</span>
    <span class="meta">Multiscale + ESpeed</span>
    <p>Priority cleaner that isn\'t weak to Ice mirrors.</p>
  </div>
  <div class="role-card">
    <span class="name">Avalugg</span>
    <span class="meta">Physical wall</span>
    <p>Appreciates the Snow +50% Defense boost on Ice types.</p>
  </div>
</div>

<h2>Game plan</h2>

<h3>Doubles</h3>
<ol>
  <li><strong>Turn 1.</strong> Lead Froslass + Weavile. Mega Evolve (Snow sets) → Aurora Veil. Weavile attacks with Ice Shard or Knock Off.</li>
  <li><strong>Turn 2.</strong> Froslass usually dies. Bring Mamoswine / Beartic. Veil still up → incoming attackers take half damage.</li>
  <li><strong>Turns 3–5.</strong> Spam Ice STAB. Blizzard is 100% accurate. Weavile cleans weakened targets.</li>
  <li><strong>Turn 6+.</strong> Armor phase ends. Close before this point or concede the pace.</li>
</ol>

<div class="callout">
  <p><span class="tag">Core rule</span>Aurora Veil is your <em>entire</em> defensive plan. If Froslass dies before setting it, the archetype collapses. Click Veil turn 1 no matter what.</p>
</div>

<h3>Singles</h3>
<p class="tight">Snow is much weaker in Singles. Aurora Veil\'s halved-damage defense only protects the one Pokémon on the field, and you can\'t use Froslass\'s "die turn 2" template because Singles 1v1 makes her too exposed. Instead, use Snow as a <strong>pivot support layer</strong>, not the primary archetype.</p>
<ol>
  <li><strong>Run Froslass mid-game</strong> — not as a lead. Switch her in after a forced KO to set Snow for Slush Rush partners.</li>
  <li><strong>Veil on a predicted switch</strong> so the incoming wallbreaker (Weavile SD, Mamoswine) absorbs one free hit.</li>
  <li><strong>Use Weavile Swords Dance</strong> as your main wincon — Ice Shard priority works in or out of Snow.</li>
</ol>
<p class="tight">For a full Singles template, see the <a href="/#/faq/pokemon-champions-singles-hyper-offense-archetype-guide">Singles HO guide</a> — Snow works there as a Weavile speed enabler layered onto standard HO structure.</p>

<h2>Matchups</h2>
<table>
  <tr><th>Vs</th><th>Outcome</th><th>Plan</th></tr>
  <tr><td>Sun</td><td>Unfavored</td><td>Fire shreds Ice. Skip Froslass, lead Mamoswine + Dragonite.</td></tr>
  <tr><td>Rain</td><td>Neutral</td><td>Rain overwrites Snow; Veil stays up.</td></tr>
  <tr><td>Sand</td><td>Unfavored</td><td>Sand overwrites Snow. Rock + Ground threaten Ice types.</td></tr>
  <tr><td>Trick Room</td><td>Favored</td><td>Veil neuters slow wallbreakers. Weavile priority works.</td></tr>
  <tr><td>Tailwind</td><td>Neutral</td><td>Speed race. Whoever sets their mechanic first wins.</td></tr>
  <tr><td>Hyper Offense</td><td>Favored</td><td>Veil halves damage — HO collapses without OHKOs.</td></tr>
</table>

<h2>Common mistakes</h2>
<ul>
  <li><strong>Skipping Aurora Veil turn 1.</strong> See callout above.</li>
  <li><strong>Beartic without Snow up.</strong> Slush Rush dies. Beartic becomes dead weight.</li>
  <li><strong>Expecting Snow chip damage.</strong> Unlike old Hail, Snow does no chip. Plan damage math accordingly.</li>
  <li><strong>Leading Snow into Sun / Sand.</strong> The entire archetype turns off. Sideboard Froslass out.</li>
</ul>

<h2>Related articles</h2>
<ul>
  <li><a href="/#/faq/pokemon-champions-new-mega-evolutions">New Mega Evolutions in Champions</a></li>
  <li><a href="/#/faq/pokemon-champions-team-archetypes">All team archetypes overview</a></li>
</ul>
    `,
  },
  {
    slug: 'pokemon-champions-rain-archetype-guide',
    question: 'How do Rain teams work in Pokémon Champions?',
    answer: 'Rain teams pair Pelipper (Drizzle) with Swift Swim abusers like Kingdra and Greninja, who double their Speed in Rain. Water moves deal 1.5× damage, Fire moves deal 0.5× damage, and Thunder becomes 100% accurate. Mega Greninja is the format\'s scariest Rain partner because Protean lets it stack Water STAB with any coverage move while still outspeeding the entire meta.',
    category: 'competitive',
    tags: ['rain', 'drizzle', 'swift swim', 'pelipper', 'greninja', 'kingdra', 'archetype', 'team comp'],
    content: `
<h2>Rain Archetype — Overview</h2>

<div class="at-a-glance">
  <div><span class="label">Playstyle</span><span class="value">Aggressive offense</span></div>
  <div><span class="label">Enabler</span><span class="value">Pelipper (Drizzle)</span></div>
  <div><span class="label">Win condition</span><span class="value">Swift Swim sweeper</span></div>
  <div><span class="label">Difficulty</span><span class="value">Medium</span></div>
</div>

<p>Rain is the aggressive weather archetype. No defensive pretense — just fast Water types clicking boosted STAB into everything.</p>

<h3>How Rain works</h3>
<ul>
  <li><strong>Water moves</strong> deal 1.5×</li>
  <li><strong>Fire moves</strong> deal 0.5×</li>
  <li><strong>Thunder / Hurricane</strong> hit 100% accurate</li>
  <li><strong>Swift Swim</strong> doubles Speed</li>
  <li><strong>Solar Beam</strong> halved + charge turn returns</li>
  <li>Duration: <strong>5 turns</strong> (no Damp Rock in Champions)</li>
</ul>

<h2>The core</h2>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Pelipper</span>
    <span class="meta">Modest · Mystic Water · 32 HP / 32 SpA</span>
    <p>Hurricane / Surf / Ice Beam / Protect. Drizzle on switch-in. Flying + Water STAB.</p>
  </div>
  <div class="role-card">
    <span class="name">Kingdra</span>
    <span class="meta">Modest · Dragon Fang · 32 SpA / 32 Spe</span>
    <p>Hydro Pump / Draco Meteor / Ice Beam / Protect. Swift Swim doubles Speed.</p>
  </div>
  <div class="role-card">
    <span class="name">Mega Greninja</span>
    <span class="meta">Timid · Greninjaite · 32 SpA / 32 Spe</span>
    <p>Hydro Pump / Ice Beam / Dark Pulse / Protect. Protean → every move STAB.</p>
  </div>
</div>

<div class="callout warn">
  <p><span class="tag">Heads up</span>Scald is <strong>removed</strong> in Champions. Use Surf, Hydro Pump, or Muddy Water instead. See <a href="/#/faq/pokemon-champions-move-changes">move changes</a>.</p>
</div>

<h3>Common partners</h3>
<div class="role-grid">
  <div class="role-card">
    <span class="name">Primarina</span>
    <span class="meta">Liquid Voice</span>
    <p>Hyper Voice becomes Water type — huge spread damage under Rain.</p>
  </div>
  <div class="role-card">
    <span class="name">Archaludon</span>
    <span class="meta">Stalwart + Electro Shot</span>
    <p>Electro Shot charges in 1 turn under Rain — a Rain-locked nuke.</p>
  </div>
  <div class="role-card">
    <span class="name">Rotom-Wash</span>
    <span class="meta">Levitate</span>
    <p>100% Thunder under Rain + Electric / Water dual STAB.</p>
  </div>
  <div class="role-card">
    <span class="name">Incineroar</span>
    <span class="meta">Intimidate buffer</span>
    <p>Softens the Electric moves opposing Rain teams like to spam.</p>
  </div>
</div>

<h2>Game plan</h2>

<h3>Doubles</h3>
<ol>
  <li><strong>Turn 1.</strong> Lead Pelipper + Swift Swim sweeper. Drizzle sets. Sweeper now outspeeds everything.</li>
  <li><strong>Turn 2.</strong> Hydro Pump / Hurricane / Thunder with perfect accuracy. Pelipper Protects or attacks based on threats.</li>
  <li><strong>Turns 3–5.</strong> Pivot to Mega Greninja for cleanup. Protean + boosted Water = compounding damage.</li>
  <li><strong>Turn 6+.</strong> Rain over. Close fast or reset via Pelipper switch-in.</li>
</ol>

<h3>Singles</h3>
<p class="tight">Singles Rain is a classic archetype — it works great here. The plan is pivot → hazard chip → Rain-boosted nuke turn.</p>
<ol>
  <li><strong>Lead</strong> Pelipper. Drizzle sets. U-turn out into a Swift Swim sweeper on a predicted Electric move.</li>
  <li><strong>Set hazards</strong> mid-game with a Tyranitar or Glimmora in slot 2. Stealth Rock compounds with Rain-boosted chip.</li>
  <li><strong>Boost up.</strong> Kingdra can Rain Dance + Dragon Dance in Singles for a double-boost sweep.</li>
  <li><strong>Sweep.</strong> Doubled Speed + boosted Water STAB OHKOs most walls.</li>
  <li><strong>Reset Rain</strong> via Pelipper switch-in when weather expires.</li>
</ol>
<p class="tight">Mega Greninja is the strongest Singles Rain cleaner — Protean + Choice Specs + doubled Speed is effectively a nuke on every click.</p>

<h2>Matchups</h2>
<table>
  <tr><th>Vs</th><th>Outcome</th><th>Plan</th></tr>
  <tr><td>Sun (Charizard Y)</td><td>Favored</td><td>Rain overwrites. Charizard takes ×2 Water.</td></tr>
  <tr><td>Sun (Mega Meganium)</td><td>Neutral</td><td>Mega Sol is weather-immune.</td></tr>
  <tr><td>Sand</td><td>Unfavored</td><td>T-Tar resets weather; Rock STAB kills Pelipper.</td></tr>
  <tr><td>Snow</td><td>Favored</td><td>Rain overwrites. Ice Def boost gone.</td></tr>
  <tr><td>Trick Room</td><td>Unfavored</td><td>Swift Swim becomes a liability. Bring Primarina.</td></tr>
  <tr><td>Tailwind</td><td>Favored</td><td>Stack Tailwind on Rain for 4× Speed on Mega Greninja.</td></tr>
  <tr><td>Hyper Offense</td><td>Favored</td><td>Rain IS hyper offense with weather.</td></tr>
</table>

<h2>Common mistakes</h2>
<ul>
  <li><strong>Running Scald.</strong> Removed in Champions — use Surf / Hydro Pump / Muddy Water.</li>
  <li><strong>Thunder without Rain.</strong> 70% accuracy outside Rain — run Thunderbolt as your baseline.</li>
  <li><strong>Ignoring Pelipper\'s 4× Electric weakness.</strong> Bring Rotom-Wash or Archaludon as an Electric resist.</li>
  <li><strong>Benching Mega Greninja when Rain isn\'t live.</strong> Protean makes every move STAB — Greninja is elite without weather too.</li>
</ul>

<h2>Related articles</h2>
<ul>
  <li><a href="/#/faq/pokemon-champions-team-archetypes">All team archetypes overview</a></li>
  <li><a href="/#/faq/pokemon-champions-move-changes">Champions move changes (Scald removed)</a></li>
</ul>
    `,
  },
  {
    slug: 'pokemon-champions-trick-room-archetype-guide',
    question: 'How do Trick Room teams work in Pokémon Champions?',
    answer: 'Trick Room reverses the Speed tier for 5 turns — slower Pokémon move first. In Champions, the best setters are Hatterene (bulk + Magic Bounce), Mimikyu (Disguise gives a free setup turn), and Reuniclus (Magic Guard). Slow wallbreakers like Rhyperior, Conkeldurr, and Mega Kangaskhan become the fastest threats on the field. The archetype trades speed control for raw damage.',
    category: 'competitive',
    tags: ['trick room', 'hatterene', 'mimikyu', 'reuniclus', 'rhyperior', 'archetype', 'team comp'],
    content: `
<h2>Trick Room Archetype — Overview</h2>

<div class="at-a-glance">
  <div><span class="label">Playstyle</span><span class="value">Speed inversion</span></div>
  <div><span class="label">Setter</span><span class="value">Hatterene / Mimikyu</span></div>
  <div><span class="label">Window</span><span class="value">4 turns of abuse</span></div>
  <div><span class="label">Difficulty</span><span class="value">Hard</span></div>
</div>

<p>TR flips the Speed tier for 5 turns so slow wallbreakers outspeed the entire field. It\'s the anti-meta archetype — the one that punishes teams built around speed control.</p>

<h3>How Trick Room works</h3>
<ul>
  <li>5-turn field effect — setup turn counts, so you get <strong>4 turns of abuse</strong></li>
  <li><strong>Lower Speed moves first</strong> within priority brackets</li>
  <li>Priority moves still resolve first (Extreme Speed beats TR)</li>
  <li>Second TR click toggles it <em>off</em> — plan around that in mirrors</li>
</ul>

<h2>Setters</h2>
<div class="role-grid">
  <div class="role-card">
    <span class="name">Hatterene</span>
    <span class="meta">Quiet · Leftovers · 32 HP / 32 SpA</span>
    <p>Dazzling Gleam / Psyshock / Trick Room / Protect. Magic Bounce reflects hazards and Taunt.</p>
  </div>
  <div class="role-card">
    <span class="name">Mimikyu</span>
    <span class="meta">Brave · Sitrus Berry · 32 HP / 32 Atk</span>
    <p>Play Rough / Shadow Claw / Trick Room / Protect. Disguise = free setup turn.</p>
  </div>
  <div class="role-card">
    <span class="name">Reuniclus</span>
    <span class="meta">Quiet · Leftovers · 32 HP / 32 SpA</span>
    <p>Psyshock / Focus Blast / Trick Room / Recover. Magic Guard ignores hazards.</p>
  </div>
  <div class="role-card">
    <span class="name">Slowking</span>
    <span class="meta">Sassy · Sitrus Berry · 32 HP / 32 SpD</span>
    <p>Surf / Psychic / Trick Room / Protect. Regenerator survives setup attempts.</p>
  </div>
</div>

<h2>Wallbreakers (TR beneficiaries)</h2>
<div class="role-grid">
  <div class="role-card">
    <span class="name">Rhyperior</span>
    <span class="meta">Brave · Weakness Policy</span>
    <p>Rock Slide / Earthquake / High Horsepower / Protect. Solid Rock tank.</p>
  </div>
  <div class="role-card">
    <span class="name">Conkeldurr</span>
    <span class="meta">Brave · Sitrus Berry</span>
    <p>Drain Punch / Mach Punch / Knock Off / Protect. Guts abuses burn.</p>
  </div>
  <div class="role-card">
    <span class="name">Mega Kangaskhan</span>
    <span class="meta">Adamant · Kangaskhanite</span>
    <p>Double-Edge / Power-Up Punch / Sucker Punch / Protect. Parental Bond is absurd under TR.</p>
  </div>
  <div class="role-card">
    <span class="name">Mamoswine</span>
    <span class="meta">Brave · Never-Melt Ice</span>
    <p>Icicle Crash / Earthquake / Ice Shard / Protect. Priority works in or out of TR.</p>
  </div>
</div>

<h2>Game plan</h2>

<h3>Doubles</h3>
<ol>
  <li><strong>Turn 1 · Setup.</strong> Lead Hatterene + wallbreaker. Hatterene clicks TR. Partner Protects or attacks. Partner <em>must</em> survive.</li>
  <li><strong>Turn 2 · Active, 4 remaining.</strong> Slow wallbreaker outspeeds and OHKOs. Swap Hatterene for a second wallbreaker.</li>
  <li><strong>Turns 3–5.</strong> Keep breaking. Plan OHKOs; anything that survives is a problem.</li>
  <li><strong>Turn 6 · Expired.</strong> You\'re the slow team now. Priority or a second TR setup from Hatterene.</li>
</ol>

<div class="callout tip">
  <p><span class="tag">Track your turns</span>You have exactly <strong>4 turns of abuse</strong>. Count them from the setup click — don\'t commit your wallbreaker on turn 6 thinking you still have Speed.</p>
</div>

<h3>Singles</h3>
<p class="tight">Trick Room is <strong>rare but viable</strong> in Singles. The problem: setting TR costs a turn 1-on-1, which usually means the setter takes a free hit. Reuniclus is the best Singles setter because Magic Guard ignores status and hazards while it clicks TR.</p>
<ol>
  <li><strong>Lead</strong> Reuniclus or Slowking. Click Trick Room turn 1. Accept the damage trade.</li>
  <li><strong>Pivot</strong> to Rhyperior, Conkeldurr, or Mamoswine on the turn TR goes up.</li>
  <li><strong>Wallbreak</strong> inside the 4-turn window. Aim for 2 KOs before TR expires.</li>
  <li><strong>Phaze with Whirlwind</strong> (Rhyperior) if the opponent brings a setup sweeper into your slow core.</li>
</ol>
<p class="tight">Singles TR is a <strong>niche counter-meta pick</strong> — bring it when the ladder is dominated by fast Hyper Offense, not as a default. Balance and Stall teams outlast your TR window too easily.</p>

<h2>Matchups</h2>
<table>
  <tr><th>Vs</th><th>Outcome</th><th>Plan</th></tr>
  <tr><td>Sun</td><td>Favored</td><td>Fast Sun attackers are slow under TR. Rhyperior OHKOs Charizard Y.</td></tr>
  <tr><td>Rain</td><td>Favored</td><td>Swift Swim becomes a liability.</td></tr>
  <tr><td>Sand</td><td>Neutral</td><td>Excadrill slows; Hippowdon still walls. Grind.</td></tr>
  <tr><td>Snow</td><td>Neutral</td><td>Aurora Veil cuts your damage.</td></tr>
  <tr><td>Tailwind</td><td>Favored</td><td>Their Tailwind actually makes them slower under TR.</td></tr>
  <tr><td>Hyper Offense</td><td>Favored</td><td>Glass cannons lose Speed; get OHKO\'d in return.</td></tr>
  <tr><td>TR mirror</td><td>Coin flip</td><td>Whoever sets TR <em>second</em> wins (toggle).</td></tr>
</table>

<h2>Common mistakes</h2>
<ul>
  <li><strong>Fast Pokémon on a TR team.</strong> Base Speed &gt; 70 moves last under TR. Whole team needs Speed &lt; 60.</li>
  <li><strong>Leaving Hatterene out after setup.</strong> Pivot her out on turn 2 so you can reset TR later.</li>
  <li><strong>Setting TR into an obvious Taunt.</strong> Lead Mimikyu (Disguise tanks) or Hatterene (Magic Bounce).</li>
  <li><strong>Not tracking TR turns.</strong> Count them aloud if you have to.</li>
</ul>

<h2>Related articles</h2>
<ul>
  <li><a href="/#/faq/pokemon-champions-team-archetypes">All team archetypes overview</a></li>
  <li><a href="/#/faq/pokemon-champions-counter-opposing-archetypes">Counter-picking opposing archetypes</a></li>
</ul>
    `,
  },
  {
    slug: 'pokemon-champions-tailwind-archetype-guide',
    question: 'How do Tailwind teams work in Pokémon Champions?',
    answer: 'Tailwind doubles your Speed for 4 turns, turning the entire team into glass-cannon speedsters. In Champions the best setters are Whimsicott (Prankster = +1 priority), Talonflame (Gale Wings), and Pelipper (Drizzle + Tailwind dual utility). Tailwind pairs naturally with the format\'s strong Mega Evolutions because it takes mid-speed Megas like Mega Charizard Y or Mega Meganium and lets them outspeed the entire meta.',
    category: 'competitive',
    tags: ['tailwind', 'whimsicott', 'talonflame', 'prankster', 'gale wings', 'archetype', 'team comp'],
    content: `
<h2>Tailwind Archetype — Overview</h2>

<div class="at-a-glance">
  <div><span class="label">Playstyle</span><span class="value">Speed amplifier</span></div>
  <div><span class="label">Setter</span><span class="value">Whimsicott</span></div>
  <div><span class="label">Window</span><span class="value">3 turns of abuse</span></div>
  <div><span class="label">Difficulty</span><span class="value">Easy</span></div>
</div>

<p>Tailwind isn\'t really a standalone archetype — it\'s a speed layer you bolt onto any offensive core. Most top Doubles teams run it as default support, whether or not they call themselves "Tailwind teams."</p>

<h3>How Tailwind works</h3>
<ul>
  <li>Doubles your side\'s Speed for <strong>4 turns</strong> (setup turn counted)</li>
  <li>Affects the <em>entire</em> side, not just the setter</li>
  <li>Does NOT stack with Choice Scarf</li>
  <li>DOES stack with Swift Swim, Chlorophyll, Unburden</li>
</ul>

<h2>Setters</h2>
<div class="role-grid">
  <div class="role-card">
    <span class="name">Whimsicott</span>
    <span class="meta">Timid · Focus Sash · 32 HP / 32 Spe</span>
    <p>Tailwind / Moonblast / Encore / Taunt. Prankster = +1 priority Tailwind. Gold standard.</p>
  </div>
  <div class="role-card">
    <span class="name">Talonflame</span>
    <span class="meta">Jolly · Sharp Beak · 32 Atk / 32 Spe</span>
    <p>Tailwind / Brave Bird / Flare Blitz / U-turn. Gale Wings priority Tailwind.</p>
  </div>
  <div class="role-card">
    <span class="name">Pelipper</span>
    <span class="meta">Modest · Mystic Water · 32 HP / 32 SpA</span>
    <p>Tailwind / Surf / Hurricane / Protect. Drizzle + Tailwind dual utility.</p>
  </div>
</div>

<h2>Fast abusers</h2>
<table>
  <tr><th>Pokémon</th><th>Base Spe</th><th>Under Tailwind</th></tr>
  <tr><td>Mega Aerodactyl</td><td>150</td><td>300</td></tr>
  <tr><td>Mega Greninja</td><td>145</td><td>290</td></tr>
  <tr><td>Dragapult</td><td>142</td><td>284</td></tr>
  <tr><td>Meowscarada</td><td>123</td><td>246</td></tr>
  <tr><td>Mega Delphox</td><td>104</td><td>208</td></tr>
  <tr><td>Garchomp</td><td>102</td><td>204</td></tr>
  <tr><td>Hydreigon</td><td>98</td><td>196</td></tr>
</table>

<h2>Game plan</h2>

<h3>Doubles</h3>
<ol>
  <li><strong>Turn 1 · Setup.</strong> Lead Whimsicott + hardest hitter. Prankster Tailwind resolves first. Partner attacks.</li>
  <li><strong>Turn 2 · Window turn 1.</strong> Outspeeding the entire opposing team. Spam damage.</li>
  <li><strong>Turn 3 · Window turn 2.</strong> Whimsicott Taunts TR setters or Encores Protects.</li>
  <li><strong>Turn 4 · Last window turn.</strong> Commit to KOs that require the speed tier.</li>
  <li><strong>Turn 5+.</strong> Tailwind over. Priority users or bulky pivots. Should have closed the game.</li>
</ol>

<div class="callout">
  <p><span class="tag">Math check</span>4 turns total includes the setup turn → you only get <strong>3 turns of real abuse</strong>. Plan your KOs around that window.</p>
</div>

<h3>Singles</h3>
<div class="callout warn">
  <p><span class="tag">Not viable</span>Tailwind is <strong>mostly unusable in Singles</strong>. With only one Pokémon on the field, the setter eats a free hit to support just one partner, and the 4-turn window usually expires before the replacement sweeper even gets a clean turn.</p>
</div>
<p class="tight">Singles speed control comes from <strong>Choice Scarf</strong> (revenge killers like Scarf Hydreigon or Scarf Garchomp) and <strong>priority moves</strong> (Dragonite Extreme Speed, Weavile Ice Shard, Kingambit Sucker Punch). If you need a pivot-and-attack layer, use a Regenerator core from the <a href="/#/faq/pokemon-champions-singles-balance-archetype-guide">Singles Balance guide</a> instead.</p>

<h2>Matchups</h2>
<table>
  <tr><th>Vs</th><th>Outcome</th><th>Plan</th></tr>
  <tr><td>Sun</td><td>Neutral</td><td>Sun + Tailwind is the Sun plan. Race to set first.</td></tr>
  <tr><td>Rain</td><td>Neutral</td><td>Swift Swim stacks with Tailwind for 4× Speed.</td></tr>
  <tr><td>Sand</td><td>Neutral</td><td>Sand Rush ×2 ≈ Tailwind ×2. Speed race.</td></tr>
  <tr><td>Snow</td><td>Favored</td><td>Veil cuts damage but you outpace Slush Rush baseline.</td></tr>
  <tr><td>Trick Room</td><td>Anti-synergy</td><td>Doubled Speed = slower under TR. Need Taunt or Magic Bounce.</td></tr>
  <tr><td>Hyper Offense</td><td>Favored</td><td>Your Megas outspeed theirs.</td></tr>
</table>

<h2>Common mistakes</h2>
<ul>
  <li><strong>Not leading Whimsicott.</strong> If she\'s in the back, you waste a turn bringing her in.</li>
  <li><strong>Running Choice Scarf under Tailwind.</strong> Scarf doesn\'t stack with Tailwind — wasted stat.</li>
  <li><strong>No TR answer.</strong> Opposing TR inverts your speed mechanic. Pack Taunt or Magic Bounce.</li>
</ul>

<h2>Related articles</h2>
<ul>
  <li><a href="/#/faq/pokemon-champions-team-archetypes">All team archetypes overview</a></li>
  <li><a href="/#/faq/pokemon-champions-sp-spread-theorycrafting">SP speed benchmark theorycrafting</a></li>
</ul>
    `,
  },
  {
    slug: 'pokemon-champions-hyper-offense-archetype-guide',
    question: 'How do Hyper Offense teams work in Pokémon Champions?',
    answer: 'Hyper Offense teams sacrifice all defensive pretense for maximum damage output. In Champions, the archetype is built around elite Mega Evolutions (Mega Delphox, Mega Greninja, Mega Gengar, Mega Alakazam) with speed control from Tailwind or Choice Scarf, and a Fake Out pivot like Incineroar or Kangaskhan to disrupt the opponent\'s first turn. The plan is to OHKO everything before the opponent can set up.',
    category: 'competitive',
    tags: ['hyper offense', 'mega delphox', 'mega greninja', 'mega gengar', 'incineroar', 'archetype', 'team comp'],
    content: `
<h2>Hyper Offense — Overview</h2>

<div class="at-a-glance">
  <div><span class="label">Playstyle</span><span class="value">All-in offense</span></div>
  <div><span class="label">Goal</span><span class="value">OHKO before they move</span></div>
  <div><span class="label">Best format</span><span class="value">Doubles</span></div>
  <div><span class="label">Difficulty</span><span class="value">Medium-Hard</span></div>
</div>

<p>"Delete the opponent before they get a turn." Trades defensive flexibility for raw kill pressure. Lives or dies on whether you get the first meaningful OHKO.</p>

<h3>Design principles</h3>
<ul>
  <li><strong>Every slot contributes damage</strong> — no dedicated walls</li>
  <li><strong>Speed control is mandatory</strong> — Tailwind, Scarf, or priority</li>
  <li><strong>Turn 1 disruption matters</strong> — Fake Out + Intimidate to survive the first exchange</li>
  <li><strong>Mega slot = biggest damage threat</strong> — never a defensive Mega</li>
</ul>

<h2>Mega slot candidates (pick one)</h2>
<div class="role-grid">
  <div class="role-card">
    <span class="name">Mega Delphox</span>
    <span class="meta">144 SpA · 104 Spe</span>
    <p>Pyro Break / Psychic / Dazzling Gleam / Protect. Hardest-hitting special attacker in the format.</p>
  </div>
  <div class="role-card">
    <span class="name">Mega Greninja</span>
    <span class="meta">145 Spe · Protean</span>
    <p>Hydro Pump / Ice Beam / Dark Pulse / Water Shuriken. Every move STAB.</p>
  </div>
  <div class="role-card">
    <span class="name">Mega Gengar</span>
    <span class="meta">Shadow Tag</span>
    <p>Traps opponents. Perish Song or Will-O-Wisp forces trades.</p>
  </div>
  <div class="role-card">
    <span class="name">Mega Alakazam</span>
    <span class="meta">175 Spe · Trace</span>
    <p>Psychic / Focus Blast / Dazzling Gleam / Shadow Ball. Steals abilities.</p>
  </div>
</div>

<h2>Support slots</h2>
<div class="role-grid">
  <div class="role-card">
    <span class="name">Incineroar</span>
    <span class="meta">Universal glue</span>
    <p>Intimidate + Fake Out + Parting Shot + Darkest Lariat. Mandatory HO support.</p>
  </div>
  <div class="role-card">
    <span class="name">Whimsicott</span>
    <span class="meta">Prankster Tailwind</span>
    <p>Mandatory speed control. Prankster Taunt disrupts opposing setup.</p>
  </div>
  <div class="role-card">
    <span class="name">Garchomp (Scarf)</span>
    <span class="meta">Revenge killer</span>
    <p>Earthquake / Rock Slide / Dragon Claw / Iron Head. Works outside Tailwind.</p>
  </div>
  <div class="role-card">
    <span class="name">Weavile / Sneasler</span>
    <span class="meta">Priority cleanup</span>
    <p>Ice Shard or Sucker Punch for when Tailwind expires.</p>
  </div>
</div>

<h2>Example team</h2>
<pre>
Mega Delphox  @ Delphoxite — Timid, 32 SpA / 32 Spe / 2 HP
  Pyro Break / Psychic / Dazzling Gleam / Protect
Whimsicott    @ Focus Sash — Timid, 32 HP / 32 Spe / 2 SpA
  Tailwind / Moonblast / Encore / Taunt
Incineroar    @ Sitrus Berry — Adamant, 32 HP / 32 Atk / 2 Def
  Fake Out / Flare Blitz / Parting Shot / Darkest Lariat
Garchomp      @ Choice Scarf — Jolly, 32 Atk / 32 Spe / 2 HP
  Earthquake / Rock Slide / Dragon Claw / Iron Head
Weavile       @ Black Glasses — Jolly, 32 Atk / 32 Spe / 2 HP
  Ice Shard / Icicle Crash / Knock Off / Protect
Sneasler      @ Focus Sash — Jolly, 32 Atk / 32 Spe / 2 HP
  Fake Out / Dire Claw / Close Combat / Sucker Punch
</pre>

<h2>Game plan</h2>

<h3>Doubles</h3>
<ol>
  <li><strong>Turn 1.</strong> Lead Delphox + Whimsicott. Prankster Tailwind. Delphox Mega Evolves and nukes the biggest threat.</li>
  <li><strong>Turn 2.</strong> Outspeeding everything. Another huge attack. Whimsicott Taunts or Encores.</li>
  <li><strong>Turn 3.</strong> Bring Incineroar to reset damage math with Intimidate + Fake Out.</li>
  <li><strong>Turn 4.</strong> Tailwind fades. Switch to Weavile / Sneasler for priority cleanup.</li>
  <li><strong>Turn 5+.</strong> If they\'re still alive here, HO has failed.</li>
</ol>

<div class="callout warn">
  <p><span class="tag">Fail state</span>HO has no bulk to win a grind-out. If you can\'t close by turn 5, the game is lost. Play every turn like it\'s the last one.</p>
</div>

<h3>Singles</h3>
<p class="tight">Singles HO is a completely different archetype with its own dedicated guide. It replaces Fake Out + Tailwind with hazard stacking + setup sweepers. Glimmora leads, Garchomp / Dragonite / Volcarona sweep, and Kingambit closes.</p>
<div class="callout tip">
  <p><span class="tag">Read the dedicated guide</span><a href="/#/faq/pokemon-champions-singles-hyper-offense-archetype-guide">Singles Hyper Offense deep dive</a> — full team template, role breakdown, matchup table, and the status-nerf synergy that makes Singles HO stronger in Champions than in mainline.</p>
</div>

<h2>Matchups</h2>
<table>
  <tr><th>Vs</th><th>Outcome</th><th>Plan</th></tr>
  <tr><td>Sun</td><td>Unfavored</td><td>Race to Tailwind first.</td></tr>
  <tr><td>Rain</td><td>Unfavored</td><td>Scarf Garchomp revenge-kills Swift Swim.</td></tr>
  <tr><td>Sand</td><td>Neutral</td><td>Taunt Hippowdon turn 1.</td></tr>
  <tr><td>Snow</td><td>Unfavored</td><td>Veil halves damage. Bring Delphox to punch through.</td></tr>
  <tr><td>Trick Room</td><td>Very unfavored</td><td>Taunt the setter or concede in preview.</td></tr>
  <tr><td>Tailwind</td><td>Neutral</td><td>Speed war. Leads matter.</td></tr>
  <tr><td>Balance</td><td>Neutral</td><td>Incineroar mirror until cycles run out.</td></tr>
</table>

<h2>Common mistakes</h2>
<ul>
  <li><strong>Protect on every slot.</strong> Double-Protect turns give the opponent free setup.</li>
  <li><strong>Switching too much.</strong> HO wants every attack to land. Pivots = lost tempo.</li>
  <li><strong>No priority.</strong> Once Tailwind drops, you need Weavile / Sneasler / Talonflame.</li>
  <li><strong>Defensive spreads.</strong> 32 HP on Mega Delphox is wasted — max offense, max Speed, die doing damage.</li>
</ul>

<h2>Related articles</h2>
<ul>
  <li><a href="/#/faq/pokemon-champions-team-archetypes">All team archetypes overview</a></li>
  <li><a href="/#/faq/pokemon-champions-tailwind-archetype-guide">Tailwind archetype (HO partner)</a></li>
  <li><a href="/#/faq/pokemon-champions-counter-opposing-archetypes">Counter-picking opposing archetypes</a></li>
</ul>
    `,
  },
  {
    slug: 'pokemon-champions-intimidate-balance-archetype-guide',
    question: 'How do Intimidate Balance teams work in Pokémon Champions?',
    answer: 'Intimidate Balance is the "goodstuff" archetype — no dedicated weather or speed mechanic, just a pile of high-tier Pokémon with defensive and offensive tools that flex into every matchup. The core is Incineroar (Intimidate + Fake Out + Parting Shot), a defensive Mega (Mega Venusaur, Mega Scizor), a speed control option (Whimsicott), and two offensive threats. It\'s the "no bad matchups" archetype at the cost of having no crushing ones.',
    category: 'competitive',
    tags: ['balance', 'intimidate', 'incineroar', 'mega venusaur', 'goodstuff', 'archetype', 'team comp'],
    content: `
<h2>Intimidate Balance — Overview</h2>

<div class="at-a-glance">
  <div><span class="label">Playstyle</span><span class="value">Flexible goodstuff</span></div>
  <div><span class="label">Anchor</span><span class="value">Incineroar</span></div>
  <div><span class="label">Best format</span><span class="value">Doubles</span></div>
  <div><span class="label">Difficulty</span><span class="value">Medium</span></div>
</div>

<p>Balance is the opposite of Hyper Offense. No single-mechanic commitment — just flexible tools that work in every matchup. <strong>You rarely win in 5 turns, but you also rarely lose.</strong></p>

<h3>Design principles</h3>
<ul>
  <li><strong>Every slot does two jobs</strong> — Incineroar is offense + pivot + Intimidate cycler</li>
  <li><strong>One defensive Mega</strong> — Venusaur / Scizor / Altaria</li>
  <li><strong>Speed control without weather commitment</strong></li>
  <li><strong>No hard matchups</strong> — cover everything at 60% instead of some at 100%</li>
</ul>

<h2>Core members</h2>
<div class="role-grid">
  <div class="role-card">
    <span class="name">Incineroar</span>
    <span class="meta">Adamant · Sitrus Berry · 32 HP / 32 Atk</span>
    <p>Fake Out / Flare Blitz / Parting Shot / Darkest Lariat. Universal glue.</p>
  </div>
  <div class="role-card">
    <span class="name">Mega Venusaur</span>
    <span class="meta">Bold · Venusaurite · 32 HP / 32 Def</span>
    <p>Giga Drain / Sludge Bomb / Sleep Powder / Protect. Thick Fat walls Fire + Ice.</p>
  </div>
  <div class="role-card">
    <span class="name">Whimsicott</span>
    <span class="meta">Timid · Focus Sash · 32 HP / 32 Spe</span>
    <p>Tailwind / Moonblast / Encore / Taunt. Prankster support.</p>
  </div>
  <div class="role-card">
    <span class="name">Garchomp</span>
    <span class="meta">Jolly · Soft Sand · 32 Atk / 32 Spe</span>
    <p>Earthquake / Dragon Claw / Rock Slide / Protect. Flexible offense.</p>
  </div>
  <div class="role-card">
    <span class="name">Hydreigon</span>
    <span class="meta">Timid · Dragon Fang · 32 SpA / 32 Spe</span>
    <p>Draco Meteor / Dark Pulse / Flash Cannon / Protect. Special secondary.</p>
  </div>
  <div class="role-card">
    <span class="name">Clefable</span>
    <span class="meta">Calm · Leftovers · 32 HP / 32 SpD</span>
    <p>Moonblast / Moonlight / Calm Mind / Follow Me. Redirection.</p>
  </div>
</div>

<h2>Lead matrix by matchup</h2>
<p>Balance has no scripted turn-1 plan. Pick the lead that counters the matchup:</p>
<table>
  <tr><th>Vs</th><th>Lead</th><th>Key tool</th></tr>
  <tr><td>Sun</td><td>Venusaur + Incineroar</td><td>Thick Fat halves Fire</td></tr>
  <tr><td>Rain</td><td>Hydreigon + Whimsicott</td><td>Tailwind + Electric resist</td></tr>
  <tr><td>Sand</td><td>Garchomp + Incineroar</td><td>EQ immunity, Intimidate</td></tr>
  <tr><td>Trick Room</td><td>Whimsicott + Incineroar</td><td>Taunt or Fake Out the setter</td></tr>
  <tr><td>Hyper Offense</td><td>Incineroar + Venusaur</td><td>Intimidate cycling</td></tr>
  <tr><td>Balance mirror</td><td>Whimsicott + wincon</td><td>Tempo race</td></tr>
</table>

<h2>Strengths vs weaknesses</h2>
<table>
  <tr><th>Strength</th><th>Weakness</th></tr>
  <tr><td>No losing matchups</td><td>No crushing matchups</td></tr>
  <tr><td>Forgiving to misplay</td><td>Slow games (15+ turns)</td></tr>
  <tr><td>Highest ladder consistency</td><td>Prediction-heavy</td></tr>
</table>

<h2>Matchup summary</h2>
<table>
  <tr><th>Vs</th><th>Outcome</th></tr>
  <tr><td>Sun</td><td>Slightly favored (Thick Fat)</td></tr>
  <tr><td>Rain</td><td>Neutral</td></tr>
  <tr><td>Sand</td><td>Neutral</td></tr>
  <tr><td>Snow</td><td>Slightly favored</td></tr>
  <tr><td>Trick Room</td><td>Slightly favored (Taunt + FO)</td></tr>
  <tr><td>Tailwind</td><td>Neutral</td></tr>
  <tr><td>Hyper Offense</td><td>Slightly favored (Intimidate)</td></tr>
  <tr><td>Balance mirror</td><td>Coin flip — skill matchup</td></tr>
</table>

<h2>Common mistakes</h2>
<ul>
  <li><strong>Treating Balance like HO.</strong> Don\'t max-damage every turn. Pivot, cycle Intimidate, build position.</li>
  <li><strong>Incineroar as pure offense.</strong> His real value is Fake Out + Parting Shot. Don\'t lose those.</li>
  <li><strong>Whimsicott trying to deal damage.</strong> She does no damage. Her job is Tailwind / Encore / Taunt.</li>
  <li><strong>Skipping a defensive Mega.</strong> Without one, Balance becomes a weak HO team.</li>
</ul>

<div class="callout tip">
  <p><span class="tag">Singles note</span>The Singles analog is covered in the dedicated <a href="/#/faq/pokemon-champions-singles-balance-archetype-guide">Singles Balance guide</a>. The two formats share the "attrition + wincon" DNA but use completely different rosters (Regenerator pivots, hazard setters, setup sweepers).</p>
</div>

<h2>Related articles</h2>
<ul>
  <li><a href="/#/faq/pokemon-champions-singles-balance-archetype-guide">Singles Balance guide</a></li>
  <li><a href="/#/faq/pokemon-champions-team-archetypes">All team archetypes overview</a></li>
  <li><a href="/#/faq/pokemon-champions-team-building-fundamentals">Team building fundamentals</a></li>
  <li><a href="/#/faq/pokemon-champions-counter-opposing-archetypes">Counter-picking opposing archetypes</a></li>
</ul>
    `,
  },
  {
    slug: 'pokemon-champions-singles-hyper-offense-archetype-guide',
    question: 'How does Singles Hyper Offense work in Pokémon Champions?',
    answer: 'Singles Hyper Offense chains setup sweepers behind a hazard lead. The lead (Glimmora, Hippowdon, or Tyranitar) sets Stealth Rock turn 1, forcing switches that chip the opponent\'s team. Your setup sweepers (Garchomp Swords Dance, Dragonite Dragon Dance, Mimikyu Swords Dance, Volcarona Quiver Dance) then clean up the weakened team. In Champions, status nerfs make paralysis and sleep weaker, directly benefiting this archetype.',
    category: 'competitive',
    tags: ['singles', 'hyper offense', 'setup sweeper', 'stealth rock', 'hazards', 'archetype', 'team comp'],
    content: `
<h2>Singles Hyper Offense — Overview</h2>

<div class="at-a-glance">
  <div><span class="label">Playstyle</span><span class="value">Hazard + setup chain</span></div>
  <div><span class="label">Lead</span><span class="value">Glimmora / Hippowdon</span></div>
  <div><span class="label">Format</span><span class="value">Singles only</span></div>
  <div><span class="label">Difficulty</span><span class="value">Medium</span></div>
</div>

<p>Singles in Champions plays nothing like Doubles — no Fake Out, no redirection, no Rage Powder. It\'s about hazard chip, pivoting, and setup sweeps. HO is the most aggressive archetype.</p>

<h3>Design principles</h3>
<ul>
  <li><strong>Hazard lead is mandatory</strong> — if it fails, HO collapses</li>
  <li><strong>Minimum 2 setup sweepers</strong> — one to sweep, one to clean up</li>
  <li><strong>No passive slots</strong> — every Pokémon pressures</li>
  <li><strong>Momentum over bulk</strong> — U-turn, Volt Switch, Parting Shot</li>
</ul>

<h2>Hazard leads</h2>
<div class="role-grid">
  <div class="role-card">
    <span class="name">Glimmora</span>
    <span class="meta">Timid · Focus Sash · 32 SpA / 32 Spe</span>
    <p>Stealth Rock / Toxic Spikes / Earth Power / Sludge Bomb. Toxic Debris auto-spikes.</p>
  </div>
  <div class="role-card">
    <span class="name">Hippowdon</span>
    <span class="meta">Impish · Leftovers · 32 HP / 32 Def</span>
    <p>Earthquake / Slack Off / Stealth Rock / Whirlwind. Sand chip bonus.</p>
  </div>
  <div class="role-card">
    <span class="name">Tyranitar</span>
    <span class="meta">Adamant · Leftovers · 32 HP / 32 Atk</span>
    <p>Rock Slide / Crunch / Stealth Rock / Whirlwind. Punishes Defoggers.</p>
  </div>
  <div class="role-card">
    <span class="name">Aerodactyl</span>
    <span class="meta">Jolly · Focus Sash · 32 Atk / 32 Spe</span>
    <p>Stone Edge / Earthquake / Stealth Rock / Taunt. Fast anti-hazard lead.</p>
  </div>
</div>

<h2>Setup sweepers</h2>
<div class="role-grid">
  <div class="role-card">
    <span class="name">Garchomp</span>
    <span class="meta">Jolly · Black Glasses · 32 Atk / 32 Spe</span>
    <p>Swords Dance / Earthquake / Dragon Claw / Stone Edge. Classic SD Chomp.</p>
  </div>
  <div class="role-card">
    <span class="name">Dragonite</span>
    <span class="meta">Adamant · Sitrus Berry · 32 Atk / 32 Spe</span>
    <p>Dragon Dance / Extreme Speed / Earthquake / Dragon Claw. Mega variant = priority Dragonize ESpeed.</p>
  </div>
  <div class="role-card">
    <span class="name">Volcarona</span>
    <span class="meta">Timid · Charcoal · 32 SpA / 32 Spe</span>
    <p>Quiver Dance / Fiery Dance / Bug Buzz / Giga Drain. Special sweeper.</p>
  </div>
  <div class="role-card">
    <span class="name">Kingambit</span>
    <span class="meta">Adamant · Silk Scarf · 32 HP / 32 Atk</span>
    <p>Swords Dance / Sucker Punch / Iron Head / Kowtow Cleave. Supreme Overlord snowball.</p>
  </div>
</div>

<h2>Example team</h2>
<pre>
Glimmora       @ Focus Sash — Timid, 32 SpA / 32 Spe / 2 HP
  Stealth Rock / Toxic Spikes / Earth Power / Sludge Bomb
Garchomp       @ Soft Sand — Jolly, 32 Atk / 32 Spe / 2 HP
  Swords Dance / Earthquake / Dragon Claw / Stone Edge
Dragonite      @ Sitrus Berry — Adamant, 32 Atk / 32 Spe / 2 HP
  Dragon Dance / Extreme Speed / Earthquake / Dragon Claw
Volcarona      @ Charcoal — Timid, 32 SpA / 32 Spe / 2 HP
  Quiver Dance / Fiery Dance / Bug Buzz / Giga Drain
Weavile        @ Black Glasses — Jolly, 32 Atk / 32 Spe / 2 HP
  Swords Dance / Icicle Crash / Knock Off / Ice Shard
Kingambit      @ Silk Scarf — Adamant, 32 HP / 32 Atk / 2 Def
  Swords Dance / Sucker Punch / Iron Head / Kowtow Cleave
</pre>

<h2>Game plan</h2>
<ol>
  <li><strong>Lead Glimmora.</strong> Click Stealth Rock turn 1. Toxic Spikes auto-fire. If opponent leads a Defogger, Taunt instead.</li>
  <li><strong>Force switches.</strong> Every incoming Pokémon eats hazard chip.</li>
  <li><strong>Pivot to a sweeper</strong> on a predicted Protect / Recover turn.</li>
  <li><strong>Set up at +2.</strong> Swords Dance or Dragon Dance on a forced switch.</li>
  <li><strong>Sweep.</strong> Boosted STAB into chipped targets.</li>
  <li><strong>Clean up.</strong> Kingambit Sucker Punch or Weavile Ice Shard closes it out.</li>
</ol>

<div class="callout tip">
  <p><span class="tag">Status nerfs help you</span>Champions weakens paralysis (1/8 chance, down from 1/4) and sleep (2-3 turns, down from 1-3). Setup sweepers survive more bad RNG — this archetype is stronger in Champions than in mainline Singles.</p>
</div>

<h2>Matchups</h2>
<table>
  <tr><th>Vs</th><th>Outcome</th><th>Plan</th></tr>
  <tr><td>Balance</td><td>Neutral</td><td>Grind with hazards until setup opportunity.</td></tr>
  <tr><td>Stall</td><td>Favored</td><td>Boosted sweepers break walls once recovery PP runs out.</td></tr>
  <tr><td>Sand Offense</td><td>Favored</td><td>Garchomp ignores chip; beats Excadrill with +2 Dragon Claw.</td></tr>
  <tr><td>Rain Offense</td><td>Neutral</td><td>Priority via ESpeed / Ice Shard matters.</td></tr>
  <tr><td>Sun Offense</td><td>Neutral</td><td>Fire hurts Volcarona\'s partners.</td></tr>
  <tr><td>Trick Room</td><td>Unfavored</td><td>Bring Kingambit (works in TR). Phaze the setter.</td></tr>
  <tr><td>HO mirror</td><td>Coin flip</td><td>Lead diff — whoever sets hazards first wins.</td></tr>
</table>

<h2>Common mistakes</h2>
<ul>
  <li><strong>Attacking at +0.</strong> HO demands +2 sweeps. Set up or you\'re playing Balance with worse bulk.</li>
  <li><strong>Skipping the hazard lead.</strong> Without chip, OHKOs don\'t happen.</li>
  <li><strong>Defensive spreads.</strong> Max offense, max Speed. Nothing else.</li>
  <li><strong>Ignoring opposing Defog.</strong> Bring Taunt or a spinblocker.</li>
</ul>

<h2>Related articles</h2>
<ul>
  <li><a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">Doubles Hyper Offense guide</a></li>
  <li><a href="/#/faq/pokemon-champions-singles-balance-archetype-guide">Singles Balance guide</a></li>
  <li><a href="/#/faq/pokemon-champions-battle-formats">Singles vs Doubles format differences</a></li>
</ul>
    `,
  },
  {
    slug: 'pokemon-champions-singles-balance-archetype-guide',
    question: 'How does Singles Balance work in Pokémon Champions?',
    answer: 'Singles Balance pairs a hazard setter, a defensive pivot, a setup sweeper, and a bulky wall into a flexible team that wins through attrition. Hippowdon or Tyranitar sets hazards, Slowking or Corviknight pivots with Regenerator, Garchomp or Volcarona sets up a sweep, and Clefable or Gliscor walls late game. It\'s the most forgiving Singles archetype — no single lead-turn determines the game.',
    category: 'competitive',
    tags: ['singles', 'balance', 'regenerator', 'hippowdon', 'corviknight', 'slowking', 'archetype', 'team comp'],
    content: `
<h2>Singles Balance — Overview</h2>

<div class="at-a-glance">
  <div><span class="label">Playstyle</span><span class="value">Attrition + wincon</span></div>
  <div><span class="label">Pivot</span><span class="value">Regenerator core</span></div>
  <div><span class="label">Format</span><span class="value">Singles only</span></div>
  <div><span class="label">Difficulty</span><span class="value">Medium</span></div>
</div>

<p>Balance is the default Singles archetype. It sits between Hyper Offense ("chain sweeps") and Stall ("outlast"). You pressure with hazards and pivoting, grind incremental advantage, and close with a setup sweeper.</p>

<h3>The four pillars</h3>
<ol>
  <li><strong>Hazard setter</strong> — Stealth Rock / Spikes / Toxic Spikes</li>
  <li><strong>Defensive pivot</strong> — Regenerator or Natural Cure + pivot move</li>
  <li><strong>Setup sweeper</strong> — late-game wincon</li>
  <li><strong>Bulky wall</strong> — recovery + phazer / status</li>
</ol>
<p>Slots 5 and 6 flex: usually a Choice Scarf revenge killer and a secondary attacker.</p>

<h2>Core members by role</h2>

<h3>Hazard setters</h3>
<div class="role-grid">
  <div class="role-card">
    <span class="name">Hippowdon</span>
    <span class="meta">Impish · Leftovers · 32 HP / 32 Def</span>
    <p>Earthquake / Slack Off / Stealth Rock / Whirlwind. Sand chip bonus.</p>
  </div>
  <div class="role-card">
    <span class="name">Skarmory</span>
    <span class="meta">Impish · Leftovers · 32 HP / 32 Def</span>
    <p>Body Press / Roost / Spikes / Whirlwind. Physical-wall Spikes layer.</p>
  </div>
  <div class="role-card">
    <span class="name">Glimmora</span>
    <span class="meta">Timid · Focus Sash · 32 SpA / 32 Spe</span>
    <p>Stealth Rock / Toxic Spikes / Earth Power / Sludge Bomb. Offensive lead.</p>
  </div>
</div>

<h3>Defensive pivots</h3>
<div class="role-grid">
  <div class="role-card">
    <span class="name">Slowking</span>
    <span class="meta">Calm · Leftovers · 32 HP / 32 SpD</span>
    <p>Surf / Psychic / Slack Off / Future Sight. Regenerator = free recovery.</p>
  </div>
  <div class="role-card">
    <span class="name">Corviknight</span>
    <span class="meta">Impish · Leftovers · 32 HP / 32 Def</span>
    <p>Body Press / Roost / U-turn / Defog. Hazard removal + pivot.</p>
  </div>
  <div class="role-card">
    <span class="name">Scizor</span>
    <span class="meta">Adamant · Leftovers · 32 HP / 32 Atk</span>
    <p>Bullet Punch / U-turn / Knock Off / Roost. Priority pivot.</p>
  </div>
</div>

<h3>Setup sweepers</h3>
<table>
  <tr><th>Pokémon</th><th>Move</th><th>Notes</th></tr>
  <tr><td>Garchomp</td><td>Swords Dance</td><td>Classic SD Chomp</td></tr>
  <tr><td>Volcarona</td><td>Quiver Dance</td><td>Special sweeper</td></tr>
  <tr><td>Dragonite</td><td>Dragon Dance</td><td>Multiscale insurance</td></tr>
  <tr><td>Kingambit</td><td>Swords Dance</td><td>Supreme Overlord snowball</td></tr>
</table>

<h3>Bulky walls / status spreaders</h3>
<div class="role-grid">
  <div class="role-card">
    <span class="name">Clefable</span>
    <span class="meta">Calm · Leftovers · 32 HP / 32 SpD</span>
    <p>Moonblast / Moonlight / Calm Mind / Thunder Wave. Magic Guard = no chip.</p>
  </div>
  <div class="role-card">
    <span class="name">Gliscor</span>
    <span class="meta">Impish · Leftovers · 32 HP / 32 Def</span>
    <p>Earthquake / Roost / Toxic / Defog. Electric + Ground immune.</p>
  </div>
  <div class="role-card">
    <span class="name">Umbreon</span>
    <span class="meta">Calm · Leftovers · 32 HP / 32 SpD</span>
    <p>Foul Play / Wish / Protect / Yawn. Wish passer.</p>
  </div>
</div>

<h2>Example team</h2>
<pre>
Hippowdon      @ Leftovers — Impish, 32 HP / 32 Def / 2 SpD
  Earthquake / Slack Off / Stealth Rock / Whirlwind
Slowking       @ Leftovers — Calm, 32 HP / 2 Def / 32 SpD
  Surf / Psychic / Slack Off / Future Sight
Corviknight    @ Leftovers — Impish, 32 HP / 32 Def / 2 SpD
  Body Press / Roost / U-turn / Defog
Garchomp       @ Black Glasses — Jolly, 32 Atk / 32 Spe / 2 HP
  Swords Dance / Earthquake / Dragon Claw / Stone Edge
Clefable       @ Leftovers — Calm, 32 HP / 2 Def / 32 SpD
  Moonblast / Moonlight / Calm Mind / Thunder Wave
Hydreigon      @ Choice Scarf — Timid, 32 SpA / 32 Spe / 2 HP
  Draco Meteor / Dark Pulse / Flash Cannon / U-turn
</pre>

<h2>Game plan</h2>
<ol>
  <li><strong>Early.</strong> Lead Hippowdon. Stealth Rock turn 1. Whirlwind opposing setup. Pivot out when bulk spent.</li>
  <li><strong>Mid.</strong> Cycle Slowking / Corviknight for Regenerator. Future Sight pressures walls.</li>
  <li><strong>Late.</strong> Walls chipped to ~50%? Bring in Garchomp / Volcarona. Swords Dance on predicted pivot. Sweep.</li>
  <li><strong>Revenge.</strong> Scarf Hydreigon or Dragapult cleans survivors.</li>
</ol>

<h2>Strengths vs weaknesses</h2>
<table>
  <tr><th>Strength</th><th>Weakness</th></tr>
  <tr><td>No hard matchups</td><td>Slow games (30+ turns)</td></tr>
  <tr><td>Forgiving to misplay</td><td>Prediction-heavy</td></tr>
  <tr><td>Highest ladder win rate</td><td>Choice Band breakers punish walls</td></tr>
</table>

<h2>Matchup summary</h2>
<table>
  <tr><th>Vs</th><th>Outcome</th></tr>
  <tr><td>Hyper Offense</td><td>Neutral</td></tr>
  <tr><td>Stall</td><td>Slightly favored</td></tr>
  <tr><td>Sand Offense</td><td>Neutral</td></tr>
  <tr><td>Rain Offense</td><td>Slightly unfavored</td></tr>
  <tr><td>Trick Room</td><td>Slightly unfavored</td></tr>
  <tr><td>Balance mirror</td><td>Coin flip</td></tr>
</table>

<h2>Common mistakes</h2>
<ul>
  <li><strong>Skipping Defog.</strong> Your own hazards help the opponent if you don\'t remove theirs.</li>
  <li><strong>Not pivoting Regenerator users.</strong> Slowking recovers 33% on every switch — don\'t leave it in.</li>
  <li><strong>Offensive Clefable.</strong> Her job is to wall. Calm Mind only if your team has a backup wall.</li>
  <li><strong>Forgetting to set up.</strong> Balance still needs a wincon — take the SD turn.</li>
</ul>

<h2>Related articles</h2>
<ul>
  <li><a href="/#/faq/pokemon-champions-intimidate-balance-archetype-guide">Doubles Balance guide</a></li>
  <li><a href="/#/faq/pokemon-champions-singles-hyper-offense-archetype-guide">Singles Hyper Offense</a></li>
  <li><a href="/#/faq/pokemon-champions-battle-formats">Singles vs Doubles format differences</a></li>
</ul>
    `,
  },
];
