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
  <li><a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun (Charizard Y / Mega Meganium)</a> — both formats</li>
  <li><a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand (Hippowdon + Excadrill)</a> — both formats</li>
  <li><a href="/#/faq/pokemon-champions-snow-archetype-guide">Snow (Mega Froslass + Aurora Veil)</a> — both formats</li>
  <li><a href="/#/faq/pokemon-champions-rain-archetype-guide">Rain (Pelipper + Swift Swim)</a> — both formats</li>
  <li><a href="/#/faq/pokemon-champions-trick-room-archetype-guide">Trick Room (Hatterene + slow wallbreakers)</a> — both formats</li>
  <li><a href="/#/faq/pokemon-champions-tailwind-archetype-guide">Tailwind (Whimsicott + fast Megas)</a> — Doubles only</li>
  <li><a href="/#/faq/pokemon-champions-shadow-tag-perish-trap-archetype-guide">Shadow Tag Perish Trap (Mega Gengar)</a> — Doubles only</li>
  <li><a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">Doubles Hyper Offense</a></li>
  <li><a href="/#/faq/pokemon-champions-intimidate-balance-archetype-guide">Intimidate Balance (goodstuff)</a> — Doubles</li>
  <li><a href="/#/faq/pokemon-champions-singles-hyper-offense-archetype-guide">Singles Hyper Offense</a></li>
  <li><a href="/#/faq/pokemon-champions-singles-balance-archetype-guide">Singles Balance</a></li>
  <li><a href="/#/faq/pokemon-champions-singles-volt-turn-archetype-guide">Singles Volt-Turn</a></li>
  <li><a href="/#/faq/pokemon-champions-singles-stall-archetype-guide">Singles Stall</a></li>
</ul>

<h3>Archetype quick reference</h3>
<p>Each card links to the full deep dive. <strong>Important:</strong> archetypes flagged "Both formats" have separate Doubles and Singles team rosters in their deep-dive article — the lineups are meaningfully different and not interchangeable.</p>

<div class="role-grid">
  <div class="role-card">
    <span class="name"><a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun</a></span>
    <span class="meta">Both formats · Mega Charizard Y / Meganium</span>
    <p>Drought or Mega Sol boosts Fire STAB and skips Solar Beam\'s charge turn. Doubles runs Whimsicott + Incineroar support; Singles runs Hippowdon hazard lead + SD sweepers.</p>
  </div>
  <div class="role-card">
    <span class="name"><a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand</a></span>
    <span class="meta">Both formats · Hippowdon / Tyranitar</span>
    <p>Sand Rush Excadrill is the win condition in both formats, but Doubles uses Protect-based support builds and Singles swaps to SD + hazard lead with Tyranitar.</p>
  </div>
  <div class="role-card">
    <span class="name"><a href="/#/faq/pokemon-champions-snow-archetype-guide">Snow</a></span>
    <span class="meta">Both formats · very different rosters</span>
    <p>Doubles is Mega Froslass + Aurora Veil; Singles drops the Mega entirely for Spikes suicide Froslass + Choice Band Slush Rush Beartic.</p>
  </div>
  <div class="role-card">
    <span class="name"><a href="/#/faq/pokemon-champions-rain-archetype-guide">Rain</a></span>
    <span class="meta">Both formats · Pelipper Drizzle</span>
    <p>Doubles abuses Swift Swim Kingdra + Mega Greninja; Singles runs DD physical Kingdra + Archaludon Electro Shot + Glimmora hazards.</p>
  </div>
  <div class="role-card">
    <span class="name"><a href="/#/faq/pokemon-champions-trick-room-archetype-guide">Trick Room</a></span>
    <span class="meta">Both formats · Hatterene / Reuniclus</span>
    <p>Doubles uses two setters + Torkoal spread; Singles leans on Reuniclus Magic Guard lead + Bulk Up Conkeldurr.</p>
  </div>
  <div class="role-card">
    <span class="name"><a href="/#/faq/pokemon-champions-tailwind-archetype-guide">Tailwind</a></span>
    <span class="meta">Doubles only</span>
    <p>Whimsicott Prankster Tailwind + mid-speed Mega abusers. Not viable in Singles because 4 turns is too short 1v1 — Singles uses Choice Scarf instead.</p>
  </div>
  <div class="role-card">
    <span class="name"><a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">Doubles Hyper Offense</a></span>
    <span class="meta">Doubles only</span>
    <p>Mega Delphox / Greninja / Gengar nukes behind Whimsicott Tailwind and Incineroar Fake Out glue.</p>
  </div>
  <div class="role-card">
    <span class="name"><a href="/#/faq/pokemon-champions-intimidate-balance-archetype-guide">Intimidate Balance</a></span>
    <span class="meta">Doubles only</span>
    <p>Goodstuff team with Incineroar + Mega Venusaur + Whimsicott. No hard matchups, no crushing ones.</p>
  </div>
  <div class="role-card">
    <span class="name"><a href="/#/faq/pokemon-champions-shadow-tag-perish-trap-archetype-guide">Shadow Tag Perish Trap</a></span>
    <span class="meta">Doubles only</span>
    <p>Mega Gengar traps a target while Alcremie clicks Perish Song — forces KOs through the 3-turn counter.</p>
  </div>
  <div class="role-card">
    <span class="name"><a href="/#/faq/pokemon-champions-singles-hyper-offense-archetype-guide">Singles Hyper Offense</a></span>
    <span class="meta">Singles only</span>
    <p>Hazard lead (Glimmora) + setup sweepers (SD Garchomp, DD Dragonite, Quiver Volcarona) + Kingambit closer.</p>
  </div>
  <div class="role-card">
    <span class="name"><a href="/#/faq/pokemon-champions-singles-balance-archetype-guide">Singles Balance</a></span>
    <span class="meta">Singles only</span>
    <p>Four pillars: hazard setter + Regenerator pivot + setup sweeper + bulky wall. Highest ladder win rate.</p>
  </div>
  <div class="role-card">
    <span class="name"><a href="/#/faq/pokemon-champions-singles-volt-turn-archetype-guide">Singles Volt-Turn</a></span>
    <span class="meta">Singles only</span>
    <p>Rotom-W + Corviknight + Scizor pivot chain. Momentum-based hazard grind into a Dragonite close.</p>
  </div>
  <div class="role-card">
    <span class="name"><a href="/#/faq/pokemon-champions-singles-stall-archetype-guide">Singles Stall</a></span>
    <span class="meta">Singles only</span>
    <p>Full walls, reliable recovery, Toxic attrition. Highest skill ceiling, longest games in the format.</p>
  </div>
</div>

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

<h3>Archetype summary table</h3>

<p>This article gives you the format-aware overview. Click through to each deep dive for the full 6-slot roster, builds, and game plans — Doubles and Singles rosters are <strong>different teams</strong>, not shared lineups.</p>

<table>
  <tr><th>Archetype</th><th>Formats</th><th>Doubles lead</th><th>Singles lead</th></tr>
  <tr>
    <td><a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">Hyper Offense</a></td>
    <td>Both (separate guides)</td>
    <td>Mega Delphox + Whimsicott Tailwind</td>
    <td>Glimmora + SD sweepers</td>
  </tr>
  <tr>
    <td><a href="/#/faq/pokemon-champions-intimidate-balance-archetype-guide">Balance</a></td>
    <td>Both (separate guides)</td>
    <td>Incineroar + Mega Venusaur goodstuff</td>
    <td>Hippowdon + Regenerator pivot core</td>
  </tr>
  <tr>
    <td><a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand</a></td>
    <td>Both</td>
    <td>Hippowdon + Excadrill + Whimsicott</td>
    <td>Tyranitar + SD Excadrill + SD Garchomp</td>
  </tr>
  <tr>
    <td><a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun</a></td>
    <td>Both</td>
    <td>Charizard Y + Whimsicott + Venusaur</td>
    <td>Hippowdon + Charizard Y + Growth Venusaur</td>
  </tr>
  <tr>
    <td><a href="/#/faq/pokemon-champions-rain-archetype-guide">Rain</a></td>
    <td>Both</td>
    <td>Pelipper + Mega Greninja + Kingdra (special)</td>
    <td>Glimmora + Pelipper + DD Kingdra (physical)</td>
  </tr>
  <tr>
    <td><a href="/#/faq/pokemon-champions-snow-archetype-guide">Snow</a></td>
    <td>Both</td>
    <td>Mega Froslass Veil + Weavile</td>
    <td>Glimmora + SD Weavile + Band Beartic</td>
  </tr>
  <tr>
    <td><a href="/#/faq/pokemon-champions-trick-room-archetype-guide">Trick Room</a></td>
    <td>Both</td>
    <td>Hatterene + Kangaskhan / Rhyperior</td>
    <td>Reuniclus + Bulk Up Conkeldurr + SD Rhyperior</td>
  </tr>
  <tr>
    <td><a href="/#/faq/pokemon-champions-tailwind-archetype-guide">Tailwind</a></td>
    <td>Doubles only</td>
    <td>Whimsicott + Mega Delphox</td>
    <td>— (use Choice Scarf instead)</td>
  </tr>
  <tr>
    <td><a href="/#/faq/pokemon-champions-shadow-tag-perish-trap-archetype-guide">Perish Trap</a></td>
    <td>Doubles only</td>
    <td>Mega Gengar + Alcremie Perish Song</td>
    <td>— (no 1v1 trap synergy)</td>
  </tr>
  <tr>
    <td><a href="/#/faq/pokemon-champions-singles-volt-turn-archetype-guide">Volt-Turn</a></td>
    <td>Singles only</td>
    <td>—</td>
    <td>Rotom-W + Corviknight + Scizor pivot chain</td>
  </tr>
  <tr>
    <td><a href="/#/faq/pokemon-champions-singles-stall-archetype-guide">Stall</a></td>
    <td>Singles only</td>
    <td>—</td>
    <td>Full walls + Toxic + recovery + Clefable close</td>
  </tr>
</table>

<h3>Doubles-primary archetypes</h3>
<p>These archetypes are built around format-specific mechanics (Fake Out, redirection, Follow Me, partner protection) that don\'t translate cleanly to Singles.</p>
<ul>
  <li><strong><a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">Doubles Hyper Offense</a>:</strong> Mega Delphox / Mega Greninja / Mega Gengar behind Whimsicott Tailwind + Incineroar Fake Out glue. Priority cleanup via Weavile / Sneasler.</li>
  <li><strong><a href="/#/faq/pokemon-champions-intimidate-balance-archetype-guide">Doubles Intimidate Balance</a>:</strong> Incineroar pivot + Mega Venusaur Thick Fat wall + Whimsicott support. No crushing matchups, no losing ones.</li>
  <li><strong><a href="/#/faq/pokemon-champions-tailwind-archetype-guide">Doubles Tailwind</a>:</strong> Whimsicott Prankster setter amplifies a mid-speed Mega core. Strictly a Doubles support layer.</li>
  <li><strong><a href="/#/faq/pokemon-champions-shadow-tag-perish-trap-archetype-guide">Doubles Perish Trap</a>:</strong> Mega Gengar Shadow Tag locks in a target while Alcremie Perish Songs. Forces KOs on the 3-turn counter.</li>
</ul>

<h3>Singles-primary archetypes</h3>
<p>These rely on pivot chains, hazard stacking, or wall attrition that only exist in 6v6 Singles where individual Pokémon face off 1v1 without Fake Out or redirection.</p>
<ul>
  <li><strong><a href="/#/faq/pokemon-champions-singles-hyper-offense-archetype-guide">Singles Hyper Offense</a>:</strong> Glimmora hazard lead → SD Garchomp / DD Dragonite / Quiver Volcarona sweep chain → Kingambit close.</li>
  <li><strong><a href="/#/faq/pokemon-champions-singles-balance-archetype-guide">Singles Balance</a>:</strong> Four pillars — hazard setter, Regenerator pivot, setup sweeper, bulky wall. The default Singles ladder pick.</li>
  <li><strong><a href="/#/faq/pokemon-champions-singles-volt-turn-archetype-guide">Singles Volt-Turn</a>:</strong> Rotom-W + Corviknight + Scizor momentum chain with Scarf Hydreigon revenge killer and Dragonite close.</li>
  <li><strong><a href="/#/faq/pokemon-champions-singles-stall-archetype-guide">Singles Stall</a>:</strong> Full walls + Toxic + recovery + Clefable Calm Mind wincon. The highest-skill archetype in the format.</li>
</ul>

<h3>Cross-format archetypes</h3>
<p>These work in both formats, but the Doubles and Singles <strong>rosters are different teams</strong>. Click through for the per-format builds:</p>
<ul>
  <li><strong><a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand</a>:</strong> Excadrill Sand Rush is the win condition in both formats. Doubles uses Protect + Whimsicott support; Singles swaps to SD + hazard lead with Tyranitar.</li>
  <li><strong><a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun</a>:</strong> Charizard Y Drought in both formats. Doubles adds Whimsicott + Incineroar + Clefable; Singles replaces the entire support half with Hippowdon hazards + SD sweepers.</li>
  <li><strong><a href="/#/faq/pokemon-champions-rain-archetype-guide">Rain</a>:</strong> Pelipper Drizzle core. Doubles runs special Swift Swim Kingdra; Singles uses DD <em>physical</em> Kingdra + Archaludon Electro Shot.</li>
  <li><strong><a href="/#/faq/pokemon-champions-snow-archetype-guide">Snow</a>:</strong> Doubles is Mega Froslass + Aurora Veil; Singles drops the Mega entirely for Spikes suicide Froslass + Choice Band Beartic.</li>
  <li><strong><a href="/#/faq/pokemon-champions-trick-room-archetype-guide">Trick Room</a>:</strong> Doubles uses two setters + Torkoal spread; Singles uses Reuniclus Magic Guard lead + Bulk Up wallbreakers.</li>
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

<div class="callout">
  <p><span class="tag">Format matters</span>The mons you bring to counter an opposing archetype differ between Doubles and Singles. Each section below splits the counter plan per format — pick the one matching your format, not the other.</p>
</div>

<h3>Vs. <a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun</a></h3>
<p><strong>Their game plan:</strong> Drought or Mega Sol boosts Fire STAB and skips Solar Beam\'s charge turn. Chlorophyll partners (Venusaur / Victreebel) double Speed in real Sun.</p>

<h4>Doubles counter plan</h4>
<ul>
  <li><strong>Lead Tyranitar + Excadrill</strong> — Sand overwrites Drought on switch-in.</li>
  <li><strong>Mega Venusaur Sleep Powder</strong> shuts down Chlorophyll abusers; Thick Fat halves Fire damage.</li>
  <li><strong>Rotom-Wash</strong> gives you Electric coverage into Charizard Y and a Water resist.</li>
  <li><strong>Whimsicott Taunt</strong> the Charizard before it Mega Evolves — Prankster resolves first.</li>
  <li><strong>Don\'t bring:</strong> Ice sweepers (die to boosted Heat Wave), Water sweepers in Mega Sol matchups (Meganium ignores Rain).</li>
</ul>

<h4>Singles counter plan</h4>
<ul>
  <li><strong>Tyranitar + Stealth Rock</strong> — Sand overwrites Drought and chips Venusaur on every switch.</li>
  <li><strong>Choice Scarf Garchomp / Hydreigon</strong> revenge-kills +2 Venusaur before it OHKOs you.</li>
  <li><strong>Dragonite Extreme Speed</strong> priority closes chipped Sun sweepers.</li>
  <li><strong>Archaludon Electro Shot</strong> in Sand — 1-turn charge + Electric into Charizard Y.</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand</a></h3>
<p><strong>Their game plan:</strong> Sand Stream → Sand Rush Excadrill doubles Speed → Earthquake + Iron Head sweep. Sand chip compounds.</p>

<h4>Doubles counter plan</h4>
<ul>
  <li><strong>Pelipper Drizzle lead</strong> overwrites Sand on switch-in; disables Sand Rush.</li>
  <li><strong>Primarina Moonblast + Surf</strong> hits both Tyranitar (4× Water) and Excadrill (2× Water).</li>
  <li><strong>Whimsicott Prankster Tailwind</strong> matches Excadrill\'s doubled Speed.</li>
  <li><strong>Mega Scizor Bullet Punch</strong> priority ignores Sand Rush.</li>
</ul>

<h4>Singles counter plan</h4>
<ul>
  <li><strong>Choice Scarf Dragapult</strong> outspeeds Sand Rush Excadrill at base 142 → 213 with Scarf.</li>
  <li><strong>Bulk Up / SD Conkeldurr</strong> walls Tyranitar and Excadrill simultaneously with Fighting STAB.</li>
  <li><strong>Mega Greninja Hydro Pump</strong> OHKOs both anchors.</li>
  <li><strong>Corviknight Defog</strong> removes their Stealth Rock so you can pivot safely.</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-snow-archetype-guide">Snow</a></h3>
<p><strong>Their game plan:</strong> Doubles — Mega Froslass Aurora Veil + Slush Rush sweepers. Singles — Glimmora hazard lead + Weavile SD + Choice Band Beartic.</p>

<h4>Doubles counter plan</h4>
<ul>
  <li><strong>Whimsicott Prankster Taunt</strong> turn 1 shuts down Froslass\'s Aurora Veil.</li>
  <li><strong>Mega Charizard Y / Delphox</strong> — Fire STAB punches through Veil chip.</li>
  <li><strong>Archaludon</strong> walls Ice STAB with Steel typing.</li>
  <li><strong>Defog Corviknight</strong> removes Aurora Veil if it lands.</li>
</ul>

<h4>Singles counter plan</h4>
<ul>
  <li><strong>Corviknight / Scizor</strong> walls Ice STAB and removes hazards with Defog.</li>
  <li><strong>Volcarona Quiver Dance</strong> Sun-less Fire sweeper breaks the core.</li>
  <li><strong>Taunt Gliscor</strong> shuts down Glimmora hazard lead.</li>
  <li><strong>Rotom-Wash Will-O-Wisp</strong> cripples Choice Band Beartic.</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-rain-archetype-guide">Rain</a></h3>
<p><strong>Their game plan:</strong> Pelipper Drizzle → Swift Swim or Mega Greninja nukes with Rain-boosted Water.</p>

<h4>Doubles counter plan</h4>
<ul>
  <li><strong>Rotom-Wash Thunderbolt</strong> OHKOs Pelipper (4× Electric).</li>
  <li><strong>Tyranitar lead</strong> — Sand overwrites Rain on switch-in.</li>
  <li><strong>Mega Venusaur</strong> walls Rain-boosted Water STAB with Grass resistance.</li>
  <li><strong>Incineroar Intimidate</strong> softens Mega Greninja\'s physical partner if any.</li>
</ul>

<h4>Singles counter plan</h4>
<ul>
  <li><strong>Archaludon Electro Shot</strong> is the hardest Rain counter — 1-turn charge + Electric into Pelipper + Water.</li>
  <li><strong>Mega Venusaur Giga Drain</strong> walls every Water attacker.</li>
  <li><strong>Tyranitar + Excadrill</strong> weather war overwrites Rain.</li>
  <li><strong>Weavile Ice Shard</strong> priority bypasses Swift Swim.</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-trick-room-archetype-guide">Trick Room</a></h3>
<p><strong>Their game plan:</strong> Reverse Speed tier for 5 turns → slow wallbreakers sweep.</p>

<h4>Doubles counter plan</h4>
<ul>
  <li><strong>Whimsicott Prankster Taunt</strong> turn 1 shuts down Hatterene / Mimikyu setup.</li>
  <li><strong>Hatterene Magic Bounce mirror</strong> reflects the opposing TR attempt.</li>
  <li><strong>Protect + stall</strong> the 4-turn window with Incineroar and Clefable, then close after.</li>
  <li><strong>Fake Out Incineroar</strong> on the setter turn 1 to force a failed TR click.</li>
</ul>

<h4>Singles counter plan</h4>
<ul>
  <li><strong>Taunt Gliscor or Sableye</strong> prevents Reuniclus from setting TR.</li>
  <li><strong>Skarmory Whirlwind</strong> phazes the setter out.</li>
  <li><strong>Kingambit Sucker Punch</strong> priority works regardless of TR state.</li>
  <li><strong>Choice Scarf Hydreigon U-turn</strong> maintains tempo across the 4-turn window.</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-tailwind-archetype-guide">Tailwind</a> <span class="meta" style="color:#8a8fa0;font-size:11px;">(Doubles only)</span></h3>
<p><strong>Their game plan:</strong> Prankster Tailwind → 3 turns of doubled-Speed offense. Doubles-exclusive archetype.</p>
<ul>
  <li><strong>Whimsicott mirror</strong> forces them to set first; you Taunt or Encore to disrupt.</li>
  <li><strong>Priority moves</strong> bypass Tailwind entirely (Bullet Punch, Extreme Speed, Ice Shard).</li>
  <li><strong>Hatterene Trick Room insurance</strong> inverts their Speed mechanic.</li>
  <li><strong>Stall 4 turns</strong> with Protect + Substitute; Tailwind runs out.</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">Hyper Offense</a></h3>
<p><strong>Their game plan:</strong> Turn-1 hazards → force switches → setup sweep weakened switch-ins.</p>

<h4>Doubles counter plan</h4>
<ul>
  <li><strong>Incineroar Intimidate + Fake Out</strong> disrupts the Mega wallbreaker turn 1.</li>
  <li><strong>Mega Venusaur</strong> walls physical sweepers and Sleep Powders setup attempts.</li>
  <li><strong>Rotom-Wash Will-O-Wisp</strong> cripples Mega Delphox or Garchomp.</li>
  <li><strong>Focus Sash Whimsicott</strong> guarantees Taunt on the opposing setup turn.</li>
</ul>

<h4>Singles counter plan</h4>
<ul>
  <li><strong>Corviknight Defog + Roost</strong> clears hazards and absorbs setup sweeps.</li>
  <li><strong>Dragonite Multiscale + Extreme Speed</strong> priority KOs weakened setup sweepers.</li>
  <li><strong>Clefable Magic Guard</strong> ignores all hazard chip and walls Calm Mind sweepers.</li>
  <li><strong>Hippowdon Whirlwind</strong> phazes out boosted Dragonite / Garchomp.</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-intimidate-balance-archetype-guide">Balance</a></h3>
<p><strong>Their game plan:</strong> Attrition. Hazards + pivots + late-game setup wincon.</p>

<h4>Doubles counter plan</h4>
<ul>
  <li><strong>Mega Delphox Pyro Break</strong> — special nuke breaks Mega Venusaur and Corviknight walls.</li>
  <li><strong>Mega Gengar Shadow Tag</strong> traps their pivot and forces a trade.</li>
  <li><strong>Tailwind speed advantage</strong> outpaces the Intimidate cycle.</li>
  <li><strong>Aggressive wallbreakers</strong> — commit to KOs, don\'t trade pivots.</li>
</ul>

<h4>Singles counter plan</h4>
<ul>
  <li><strong>Choice Band Dragonite</strong> breaks Corviknight / Clefable walls.</li>
  <li><strong>Choice Specs Hydreigon Draco Meteor</strong> punches through Slowking.</li>
  <li><strong>Kingambit Supreme Overlord</strong> snowballs as their pivots fall.</li>
  <li><strong>Setup sweeper with Substitute</strong> (SD Garchomp behind Sub) evades Will-O-Wisp / Thunder Wave.</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-shadow-tag-perish-trap-archetype-guide">Perish Trap</a> <span class="meta" style="color:#8a8fa0;font-size:11px;">(Doubles only)</span></h3>
<p><strong>Their game plan:</strong> Mega Gengar Shadow Tag + partner Perish Song → forced 3-turn KO.</p>
<ul>
  <li><strong>Ghost-type leads</strong> (Dragapult, Mimikyu) ignore Shadow Tag.</li>
  <li><strong>Taunt Gengar</strong> before it Mega Evolves.</li>
  <li><strong>Soundproof users</strong> (Voltorb line — not in Champions) bypass Perish Song entirely.</li>
  <li><strong>Encore the Perish Song user</strong> — Whimsicott Prankster locks Alcremie into a useless move.</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-singles-volt-turn-archetype-guide">Volt-Turn</a> <span class="meta" style="color:#8a8fa0;font-size:11px;">(Singles only)</span></h3>
<p><strong>Their game plan:</strong> Pivot chain with Rotom-Wash + Corviknight + Scizor maintains favorable matchups while hazards chip.</p>
<ul>
  <li><strong>Gliscor</strong> walls Rotom-Wash\'s Volt Switch with Ground immunity.</li>
  <li><strong>Kingambit</strong> punishes U-turn with Sucker Punch.</li>
  <li><strong>Taunt hazard setters</strong> to shut down the chip game.</li>
  <li><strong>Fast setup sweepers</strong> (Volcarona Quiver Dance) outrun the pivot cycle.</li>
</ul>

<h3>Vs. <a href="/#/faq/pokemon-champions-singles-stall-archetype-guide">Stall</a> <span class="meta" style="color:#8a8fa0;font-size:11px;">(Singles only)</span></h3>
<p><strong>Their game plan:</strong> Outlast you with walls + Toxic + recovery. 50+ turn matches.</p>
<ul>
  <li><strong>Wallbreakers with boosting items.</strong> Choice Band Dragonite, Choice Specs Hydreigon.</li>
  <li><strong>Taunt Prankster users</strong> (Whimsicott, Sableye) shut down Toxic + Recover cycles.</li>
  <li><strong>Magic Guard Clefable</strong> ignores hazard + Toxic chip and out-walls their walls with Calm Mind.</li>
  <li><strong>Substitute</strong> blocks Toxic and forces actual offense from their walls.</li>
  <li><strong>Kingambit Supreme Overlord</strong> breaks stall as their walls fall.</li>
</ul>

<h3>General principles</h3>
<ul>
  <li><strong>Every archetype has a Taunt weakness.</strong> Prankster Taunt users disrupt setup, hazards, and stall simultaneously.</li>
  <li><strong>Speed control is the highest-impact tech.</strong> Tailwind beats Trick Room beats raw speed beats nothing.</li>
  <li><strong>Your Mega is your answer.</strong> One Mega per battle — save it for the matchup where it\'s the key piece.</li>
  <li><strong>Don\'t import Doubles counters into Singles.</strong> Fake Out + Intimidate + redirection don\'t exist in Singles; Singles counters rely on hazards, pivots, and priority instead.</li>
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
<p>Once you\'ve picked your wincon, identify the "cover" — the 1-2 mons that directly enable it. <strong>Core members differ between Doubles and Singles</strong> — each archetype guide lists both rosters separately.</p>

<h4>Doubles cores</h4>
<ul>
  <li><strong><a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun</a>:</strong> Charizard Y + Venusaur (Chlorophyll) + Whimsicott Tailwind + Incineroar Fake Out.</li>
  <li><strong><a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand</a>:</strong> Hippowdon + Excadrill (Sand Rush) + Whimsicott backup + Incineroar glue.</li>
  <li><strong><a href="/#/faq/pokemon-champions-rain-archetype-guide">Rain</a>:</strong> Pelipper + Mega Greninja + special Swift Swim Kingdra + Whimsicott Tailwind.</li>
  <li><strong><a href="/#/faq/pokemon-champions-snow-archetype-guide">Snow</a>:</strong> Mega Froslass + Aurora Veil + Weavile + Mamoswine.</li>
  <li><strong><a href="/#/faq/pokemon-champions-trick-room-archetype-guide">Trick Room</a>:</strong> Hatterene + Rhyperior / Mega Kangaskhan / Torkoal.</li>
  <li><strong><a href="/#/faq/pokemon-champions-tailwind-archetype-guide">Tailwind</a>:</strong> Whimsicott Prankster + Mega Delphox + Garchomp.</li>
  <li><strong><a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">Hyper Offense</a>:</strong> Mega Mega (Delphox / Greninja / Gengar) + Incineroar + Whimsicott + priority cleaner.</li>
  <li><strong><a href="/#/faq/pokemon-champions-intimidate-balance-archetype-guide">Balance</a>:</strong> Incineroar + Mega Venusaur + Whimsicott + Clefable redirect.</li>
  <li><strong><a href="/#/faq/pokemon-champions-shadow-tag-perish-trap-archetype-guide">Perish Trap</a>:</strong> Mega Gengar + Alcremie (Perish Song + Follow Me).</li>
</ul>

<h4>Singles cores</h4>
<ul>
  <li><strong><a href="/#/faq/pokemon-champions-sun-archetype-guide">Sun</a>:</strong> Hippowdon Rocks + Charizard Y + Growth Venusaur + SD Garchomp + Dragonite ESpeed.</li>
  <li><strong><a href="/#/faq/pokemon-champions-sand-archetype-guide">Sand</a>:</strong> Tyranitar Rocks + SD Excadrill + SD Garchomp + Gliscor pivot.</li>
  <li><strong><a href="/#/faq/pokemon-champions-rain-archetype-guide">Rain</a>:</strong> Glimmora hazards + Pelipper pivot + DD physical Kingdra + Archaludon Electro Shot.</li>
  <li><strong><a href="/#/faq/pokemon-champions-snow-archetype-guide">Snow</a>:</strong> Glimmora hazards + SD Weavile + Spikes Froslass (not Mega) + Choice Band Beartic.</li>
  <li><strong><a href="/#/faq/pokemon-champions-trick-room-archetype-guide">Trick Room</a>:</strong> Reuniclus Magic Guard + Bulk Up Conkeldurr + SD Rhyperior + Kingambit close.</li>
  <li><strong><a href="/#/faq/pokemon-champions-singles-hyper-offense-archetype-guide">Hyper Offense</a>:</strong> Glimmora + SD Garchomp + DD Dragonite + Quiver Volcarona + Kingambit.</li>
  <li><strong><a href="/#/faq/pokemon-champions-singles-balance-archetype-guide">Balance</a>:</strong> Hippowdon + Slowking Regen + Corviknight Defog + SD Garchomp + Clefable.</li>
  <li><strong><a href="/#/faq/pokemon-champions-singles-volt-turn-archetype-guide">Volt-Turn</a>:</strong> Rotom-W + Corviknight + Scizor pivot chain + Scarf Hydreigon.</li>
  <li><strong><a href="/#/faq/pokemon-champions-singles-stall-archetype-guide">Stall</a>:</strong> Hippowdon + Clefable Magic Guard + Umbreon Wish + Corviknight Defog.</li>
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

<h2>Doubles team</h2>

<p>Speed-controlled hyper-offense with Tailwind speed control, redirection support, and Intimidate glue. Meganiumite is a valid swap for Charizardite Y if you want weather-immune Mega Sol math (drop Venusaur when you do — Chlorophyll requires real weather).</p>

<pre>
Mega Charizard Y @ Charizardite Y — Timid, 32 SpA / 32 Spe / 2 HP
  Heat Wave / Solar Beam / Air Slash / Protect
Venusaur         @ Miracle Seed  — Modest, 32 HP / 32 SpA / 2 Def
  Giga Drain / Sludge Bomb / Earth Power / Protect
Whimsicott       @ Focus Sash    — Timid, 32 HP / 32 Spe / 2 SpA
  Tailwind / Moonblast / Encore / Taunt
Incineroar       @ Sitrus Berry  — Adamant, 32 HP / 32 Atk / 2 Def
  Fake Out / Flare Blitz / Parting Shot / Knock Off
Clefable         @ Leftovers     — Calm, 32 HP / 2 Def / 32 SpD
  Moonblast / Follow Me / Moonlight / Protect
Garchomp         @ Soft Sand     — Jolly, 32 Atk / 32 Spe / 2 HP
  Earthquake / Dragon Claw / Rock Slide / Protect
</pre>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Mega Charizard Y</span>
    <span class="meta">Weather setter + nuke</span>
    <p>Drought sets real Sun on Mega Evolve. Solar Beam skips its charge turn under Sun. Heat Wave spreads 1.5× Fire damage across both slots.</p>
  </div>
  <div class="role-card">
    <span class="name">Venusaur</span>
    <span class="meta">Chlorophyll sweeper</span>
    <p>Doubled Speed under real Sun outspeeds the unboosted meta. Sludge Bomb hits Fairy walls Charizard can\'t.</p>
  </div>
  <div class="role-card">
    <span class="name">Whimsicott</span>
    <span class="meta">Prankster Tailwind</span>
    <p>Mandatory speed control. Encore locks opposing setup, Taunt shuts down Trick Room attempts.</p>
  </div>
  <div class="role-card">
    <span class="name">Incineroar</span>
    <span class="meta">Intimidate glue</span>
    <p>Turn-1 Fake Out flinches while Parting Shot cycles position. Universal Doubles support package.</p>
  </div>
  <div class="role-card">
    <span class="name">Clefable</span>
    <span class="meta">Follow Me redirector</span>
    <p>Fills the Amoonguss-shaped gap in Champions\' support roster. Magic Guard ignores hazard chip.</p>
  </div>
  <div class="role-card">
    <span class="name">Garchomp</span>
    <span class="meta">Flex physical threat</span>
    <p>Answers Rock / Ground threats that Fire attackers fear. Rock Slide doubles as spread damage.</p>
  </div>
</div>

<h3>Doubles game plan</h3>
<ol>
  <li><strong>Turn 1.</strong> Lead Whimsicott + Charizard Y. Prankster Tailwind. Charizard Mega Evolves → Drought → Heat Wave.</li>
  <li><strong>Turns 2–4.</strong> Outspeeding the field. Boosted Fire STAB breaks soft walls. Incineroar rotates in for Intimidate cycling.</li>
  <li><strong>Turn 5+.</strong> Real Sun expires. Reset via Charizard switch-in, or lean on Garchomp Earthquake cleanup.</li>
</ol>

<h2>Singles team</h2>

<p>The Singles build is a <strong>completely different roster</strong>. No Whimsicott (Tailwind is too short for 1v1). No Incineroar (Fake Out / Parting Shot are Doubles tools). No Clefable Follow Me (no partner to redirect for). Instead: hazard lead + Chlorophyll wallbreaker + setup sweeper + priority closer.</p>

<pre>
Mega Charizard Y @ Charizardite Y — Timid, 32 SpA / 32 Spe / 2 HP
  Fire Blast / Solar Beam / Focus Blast / Roost
Venusaur         @ Miracle Seed  — Modest, 32 HP / 32 SpA / 2 Def
  Growth / Giga Drain / Sludge Bomb / Weather Ball
Hippowdon        @ Leftovers     — Impish, 32 HP / 32 Def / 2 SpD
  Earthquake / Slack Off / Stealth Rock / Whirlwind
Garchomp         @ Black Glasses — Jolly, 32 Atk / 32 Spe / 2 HP
  Swords Dance / Earthquake / Dragon Claw / Stone Edge
Dragonite        @ Sitrus Berry  — Adamant, 32 Atk / 32 Spe / 2 HP
  Dragon Dance / Extreme Speed / Earthquake / Dragon Claw
Gliscor          @ Leftovers     — Impish, 32 HP / 32 Def / 2 SpD
  Earthquake / Roost / Toxic / Defog
</pre>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Mega Charizard Y</span>
    <span class="meta">Solo Sun wallbreaker</span>
    <p>Roost replaces Protect — no partner to stall for. Fire Blast beats Heat Wave in 1v1 damage math. Focus Blast handles Heatran-style resists.</p>
  </div>
  <div class="role-card">
    <span class="name">Venusaur</span>
    <span class="meta">Growth +2 sweeper</span>
    <p>Growth is +2 Atk / SpA in Sun. Weather Ball becomes a 100 BP Fire move. Chlorophyll doubles Speed.</p>
  </div>
  <div class="role-card">
    <span class="name">Hippowdon</span>
    <span class="meta">Hazard lead</span>
    <p>Stealth Rock enables the Sun win condition by chipping incoming Rock / Water answers. Whirlwind phases opposing setup.</p>
  </div>
  <div class="role-card">
    <span class="name">Garchomp</span>
    <span class="meta">Swords Dance sweeper</span>
    <p>Singles-specific build: SD instead of Protect, Stone Edge over Rock Slide for 1v1 precision.</p>
  </div>
  <div class="role-card">
    <span class="name">Dragonite</span>
    <span class="meta">Priority cleaner</span>
    <p>Multiscale + Extreme Speed finishes chipped threats. Works outside the Sun window.</p>
  </div>
  <div class="role-card">
    <span class="name">Gliscor</span>
    <span class="meta">Defensive pivot + Defog</span>
    <p>Removes opposing hazards and spreads Toxic. Replaces the Doubles support slot.</p>
  </div>
</div>

<h3>Singles game plan</h3>
<ol>
  <li><strong>Lead Hippowdon.</strong> Stealth Rock turn 1. Pivot out when bulk is spent.</li>
  <li><strong>Bring Charizard Y</strong> on a forced switch. Drought sets, Fire Blast OHKOs the predicted incoming wall.</li>
  <li><strong>Pivot to Venusaur</strong> for Growth → Chlorophyll sweep. Growth is +2 under Sun, not +1.</li>
  <li><strong>Late game:</strong> Garchomp SD or Dragonite DD cleans survivors. ESpeed priority closes chipped targets.</li>
  <li><strong>Reset Drought</strong> via Charizard Y switch-in if Sun expires mid-sweep.</li>
</ol>

<div class="callout warn">
  <p><span class="tag">Don\'t swap rosters</span>The Doubles and Singles builds share only Charizard Y and Venusaur. Every other slot is different — do not bring the Doubles team into a Singles ladder or vice versa.</p>
</div>

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

<h2>Doubles team</h2>

<p>Doubles Sand runs Hippowdon (or Tyranitar) + Excadrill as the mandatory core, Whimsicott for Tailwind backup, and Incineroar for Intimidate glue. Garchomp fills the flex wallbreaker slot.</p>

<pre>
Hippowdon        @ Leftovers     — Impish, 32 HP / 32 Def / 2 SpD
  Earthquake / Slack Off / Stealth Rock / Protect
Excadrill        @ Soft Sand     — Jolly, 32 Atk / 32 Spe / 2 HP
  Earthquake / Iron Head / Rock Slide / Protect
Garchomp         @ Soft Sand     — Jolly, 32 Atk / 32 Spe / 2 HP
  Earthquake / Rock Slide / Dragon Claw / Protect
Whimsicott       @ Focus Sash    — Timid, 32 HP / 32 Spe / 2 SpA
  Tailwind / Moonblast / Encore / Taunt
Incineroar       @ Sitrus Berry  — Adamant, 32 HP / 32 Atk / 2 Def
  Fake Out / Flare Blitz / Parting Shot / Knock Off
Rotom-Wash       @ Sitrus Berry  — Modest, 32 HP / 32 SpA / 2 SpD
  Hydro Pump / Thunderbolt / Will-O-Wisp / Protect
</pre>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Hippowdon</span>
    <span class="meta">Sand setter + Ground immune</span>
    <p>Sets Sand on switch-in. Ground immunity enables Excadrill spread Earthquake spam.</p>
  </div>
  <div class="role-card">
    <span class="name">Excadrill</span>
    <span class="meta">Sand Rush cleaner</span>
    <p>Doubled Speed in Sand → outspeeds the field. Earthquake hits both slots safely when partnered with Hippowdon.</p>
  </div>
  <div class="role-card">
    <span class="name">Garchomp</span>
    <span class="meta">Sand Force wallbreaker</span>
    <p>+30% Rock / Ground moves under Sand. Protect instead of SD in Doubles — you need the defensive option for the 2v2 dance.</p>
  </div>
  <div class="role-card">
    <span class="name">Whimsicott</span>
    <span class="meta">Tailwind backup</span>
    <p>Tailwind stacks with Sand Rush for 4× Speed Excadrill when you need a nuke turn.</p>
  </div>
  <div class="role-card">
    <span class="name">Incineroar</span>
    <span class="meta">Intimidate glue</span>
    <p>Cushions physical attackers and pivots with Parting Shot. Universal Doubles support.</p>
  </div>
  <div class="role-card">
    <span class="name">Rotom-Wash</span>
    <span class="meta">Water coverage</span>
    <p>Covers Sand\'s Water weakness (Pelipper / Primarina leads). Will-O-Wisp disrupts Fighting threats.</p>
  </div>
</div>

<h3>Doubles game plan</h3>
<ol>
  <li><strong>Turn 1.</strong> Lead Hippowdon + Excadrill. Sand sets on switch-in. Excadrill is already faster than the unboosted meta.</li>
  <li><strong>Turn 2.</strong> Spam Earthquake — Hippowdon is Ground-immune, everything else takes full damage.</li>
  <li><strong>Turns 3–5.</strong> Cycle Incineroar for Intimidate, Garchomp for Dragon STAB. Sand chip compounds across the board.</li>
  <li><strong>Turn 6+.</strong> Reset Sand via Hippowdon switch-in. Leftovers + Slack Off = immortal wall.</li>
</ol>

<h2>Singles team</h2>

<p>Singles Sand swaps Doubles support (Whimsicott, Incineroar, Rotom-Wash) for a hazard lead, a setup sweeper, and a pivot. The Excadrill Sand Rush win condition stays — everything else changes.</p>

<pre>
Tyranitar        @ Leftovers     — Adamant, 32 HP / 32 Atk / 2 SpD
  Stealth Rock / Rock Slide / Crunch / Whirlwind
Excadrill        @ Life-equivalent · Soft Sand — Jolly, 32 Atk / 32 Spe / 2 HP
  Swords Dance / Earthquake / Iron Head / Rock Slide
Garchomp         @ Black Glasses — Jolly, 32 Atk / 32 Spe / 2 HP
  Swords Dance / Earthquake / Dragon Claw / Stone Edge
Gliscor          @ Leftovers     — Impish, 32 HP / 32 Def / 2 SpD
  Earthquake / Roost / Toxic / Defog
Rotom-Wash       @ Leftovers     — Bold, 32 HP / 32 Def / 2 SpA
  Hydro Pump / Volt Switch / Will-O-Wisp / Pain Split
Dragonite        @ Sitrus Berry  — Adamant, 32 Atk / 32 Spe / 2 HP
  Dragon Dance / Extreme Speed / Earthquake / Dragon Claw
</pre>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Tyranitar</span>
    <span class="meta">Sand lead + Rocks</span>
    <p>Singles T-Tar runs Stealth Rock instead of Ice Punch. Whirlwind phazes opposing setup.</p>
  </div>
  <div class="role-card">
    <span class="name">Excadrill</span>
    <span class="meta">SD Sand Rush sweeper</span>
    <p>Singles-specific: Swords Dance replaces Protect. +2 Earthquake under Sand Rush Speed cleans the field.</p>
  </div>
  <div class="role-card">
    <span class="name">Garchomp</span>
    <span class="meta">SD secondary sweeper</span>
    <p>Stone Edge over Rock Slide for 1v1 precision. Swords Dance over Protect.</p>
  </div>
  <div class="role-card">
    <span class="name">Gliscor</span>
    <span class="meta">Defensive pivot + Defog</span>
    <p>Sand Veil evasion + Toxic + Defog. Replaces the Doubles-only Whimsicott / Incineroar slot.</p>
  </div>
  <div class="role-card">
    <span class="name">Rotom-Wash</span>
    <span class="meta">Volt-Turn pivot</span>
    <p>Volt Switch momentum + Will-O-Wisp disruption. Handles opposing Water leads.</p>
  </div>
  <div class="role-card">
    <span class="name">Dragonite</span>
    <span class="meta">Priority closer</span>
    <p>Secondary DD sweeper. Extreme Speed closes chipped targets regardless of Sand state.</p>
  </div>
</div>

<h3>Singles game plan</h3>
<ol>
  <li><strong>Lead Tyranitar.</strong> Stealth Rock turn 1. Sand sets on entry. Whirlwind opposing setup attempts.</li>
  <li><strong>Pivot to Excadrill</strong> on a forced switch. Sand Rush + SD → boosted Earthquake sweep.</li>
  <li><strong>Secondary sweep</strong> with Garchomp if Excadrill goes down. Stone Edge handles Flying threats.</li>
  <li><strong>Defensive cycle</strong> via Gliscor + Rotom-Wash when you need to reset the pace.</li>
  <li><strong>Dragonite closes</strong> with Extreme Speed priority on chipped targets.</li>
</ol>

<div class="callout warn">
  <p><span class="tag">Don\'t swap rosters</span>Doubles and Singles share Excadrill, Garchomp, and Rotom-Wash as species — but Excadrill and Garchomp run SD instead of Protect, and the lead flips from Hippowdon to Tyranitar. Do not mix the teams.</p>
</div>

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

<h2>Doubles team</h2>

<p>Doubles Snow is a coin-flip archetype: if Aurora Veil lands turn 1, you\'re favored in every matchup; if Froslass gets Taunted or Fake Out\'d, the team collapses. Mandatory speed control via Tailwind backup.</p>

<pre>
Mega Froslass    @ Froslassite   — Timid, 32 SpA / 32 Spe / 2 HP
  Blizzard / Ice Beam / Shadow Ball / Aurora Veil
Weavile          @ Black Glasses — Jolly, 32 Atk / 32 Spe / 2 HP
  Ice Shard / Icicle Crash / Knock Off / Protect
Mamoswine        @ Never-Melt Ice — Adamant, 32 HP / 32 Atk / 2 Def
  Ice Shard / Icicle Crash / Earthquake / Rock Slide
Arcanine         @ Sitrus Berry  — Adamant, 32 HP / 32 Atk / 2 Def
  Flare Blitz / Extreme Speed / Snarl / Protect
Whimsicott       @ Focus Sash    — Timid, 32 HP / 32 Spe / 2 SpA
  Tailwind / Moonblast / Encore / Taunt
Dragonite        @ Lum Berry     — Adamant, 32 HP / 32 Atk / 2 Def
  Extreme Speed / Dragon Claw / Earthquake / Protect
</pre>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Mega Froslass</span>
    <span class="meta">Veil setter</span>
    <p>Snow Warning on Mega Evolve enables Aurora Veil turn 1. Expect her to die turn 2 — her only job is the Veil.</p>
  </div>
  <div class="role-card">
    <span class="name">Weavile</span>
    <span class="meta">Ice Shard cleanup</span>
    <p>Priority cleanup after Veil comes down. Knock Off removes opposing Sitrus Berry / Leftovers.</p>
  </div>
  <div class="role-card">
    <span class="name">Mamoswine</span>
    <span class="meta">Bulky wallbreaker</span>
    <p>Dual STAB coverage + Earthquake hits both opposing slots under Veil.</p>
  </div>
  <div class="role-card">
    <span class="name">Arcanine</span>
    <span class="meta">Intimidate + ESpeed</span>
    <p>Intimidate softens physical mirrors. Snarl drops SpA for the back half of the game.</p>
  </div>
  <div class="role-card">
    <span class="name">Whimsicott</span>
    <span class="meta">Tailwind backup</span>
    <p>Once Veil drops, Whimsicott Tailwind keeps the tempo alive. Prankster Encore disrupts opposing setup.</p>
  </div>
  <div class="role-card">
    <span class="name">Dragonite</span>
    <span class="meta">Priority closer</span>
    <p>Multiscale insurance + Extreme Speed cleans chipped targets. Not weak to Ice mirrors.</p>
  </div>
</div>

<h3>Doubles game plan</h3>
<ol>
  <li><strong>Turn 1.</strong> Lead Froslass + Weavile. Mega Evolve (Snow sets) → Aurora Veil. Weavile Ice Shards or Knock Offs the bigger threat.</li>
  <li><strong>Turn 2.</strong> Froslass usually dies. Bring Mamoswine. Veil still up → incoming attackers take half damage.</li>
  <li><strong>Turns 3–5.</strong> Spam Ice STAB. Blizzard is 100% accurate under Snow. Weavile cleans weakened targets.</li>
  <li><strong>Turn 6+.</strong> Armor phase ends. Close via Dragonite Extreme Speed or concede the pace.</li>
</ol>

<div class="callout">
  <p><span class="tag">Core rule</span>Aurora Veil is your <em>entire</em> defensive plan. If Froslass dies before setting it, the archetype collapses. Click Veil turn 1 no matter what.</p>
</div>

<h2>Singles team</h2>

<p>Snow in Singles is <strong>fundamentally different</strong> — Froslass is not the lead, Aurora Veil is not the game plan. Singles Snow is a Weavile Swords Dance hyper-offense with a hazard stack lead; Froslass only comes in mid-game as a Speed enabler for Slush Rush Beartic.</p>

<pre>
Glimmora         @ Focus Sash    — Timid, 32 SpA / 32 Spe / 2 HP
  Stealth Rock / Toxic Spikes / Earth Power / Sludge Bomb
Weavile          @ Black Glasses — Jolly, 32 Atk / 32 Spe / 2 HP
  Swords Dance / Icicle Crash / Knock Off / Ice Shard
Mamoswine        @ Never-Melt Ice — Adamant, 32 Atk / 32 Spe / 2 HP
  Icicle Crash / Earthquake / Stealth Rock / Ice Shard
Froslass         @ Focus Sash    — Timid, 32 SpA / 32 Spe / 2 HP
  Spikes / Taunt / Destiny Bond / Ice Beam
Beartic          @ Choice Band   — Adamant, 32 Atk / 32 Spe / 2 HP
  Icicle Crash / Close Combat / Liquidation / Ice Shard
Dragonite        @ Lum Berry     — Adamant, 32 Atk / 32 Spe / 2 HP
  Dragon Dance / Extreme Speed / Earthquake / Dragon Claw
</pre>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Glimmora</span>
    <span class="meta">Primary hazard lead</span>
    <p>Stealth Rock + Toxic Spikes compound damage. Toxic Debris auto-spikes on physical contact.</p>
  </div>
  <div class="role-card">
    <span class="name">Weavile</span>
    <span class="meta">SD wallbreaker</span>
    <p>Swords Dance replaces Protect. +2 Icicle Crash / Knock Off OHKOs most neutral targets.</p>
  </div>
  <div class="role-card">
    <span class="name">Mamoswine</span>
    <span class="meta">Anti-lead hazards</span>
    <p>Ice Shard + Stealth Rock dual role. Beats opposing Glimmora leads with Icicle Crash.</p>
  </div>
  <div class="role-card">
    <span class="name">Froslass</span>
    <span class="meta">Spikes + suicide lead alt</span>
    <p>Non-Mega Froslass here — Spikes layer, then Destiny Bond or Taunt trade. Completely different set from the Doubles Mega.</p>
  </div>
  <div class="role-card">
    <span class="name">Beartic</span>
    <span class="meta">Slush Rush Choice Band</span>
    <p>Needs Froslass or Abomasnow to set Snow first. Doubled Speed + Choice Band Icicle Crash OHKOs almost anything.</p>
  </div>
  <div class="role-card">
    <span class="name">Dragonite</span>
    <span class="meta">Priority closer</span>
    <p>DD + ESpeed closes chipped targets. Multiscale insurance lets it set up even at 50% HP.</p>
  </div>
</div>

<h3>Singles game plan</h3>
<ol>
  <li><strong>Lead Glimmora.</strong> Stealth Rock turn 1 on a predicted switch. Toxic Debris on physical contact.</li>
  <li><strong>Layer Spikes with Froslass</strong> later in the game — she\'s a Spikes suicide lead, not a Veil setter in Singles.</li>
  <li><strong>Bring Weavile</strong> on a forced switch. Swords Dance → +2 Ice Shard priority sweeps.</li>
  <li><strong>Set Snow via Froslass</strong> if you need Beartic to go off. Choice Band Beartic at 2× Speed is a Singles nuke.</li>
  <li><strong>Dragonite closes.</strong> Priority Extreme Speed finishes chipped threats regardless of Snow state.</li>
</ol>

<div class="callout warn">
  <p><span class="tag">Don\'t swap rosters</span>The Doubles and Singles builds share Weavile, Mamoswine, Froslass, Dragonite, and Beartic as species — but Froslass runs an entirely different role (Spikes suicide lead, not Mega Veil setter) and every other slot has a different item / move set. Do not mix the teams.</p>
</div>

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

<div class="callout warn">
  <p><span class="tag">Heads up</span>Scald is <strong>removed</strong> in Champions. Use Surf, Hydro Pump, or Muddy Water instead. See <a href="/#/faq/pokemon-champions-move-changes">move changes</a>.</p>
</div>

<h2>Doubles team</h2>

<p>Doubles Rain centers on Pelipper\'s Drizzle paired with Swift Swim abusers, a Tailwind backup, and Intimidate glue.</p>

<pre>
Pelipper         @ Mystic Water  — Modest, 32 HP / 32 SpA / 2 Def
  Hurricane / Surf / Ice Beam / Protect
Mega Greninja    @ Greninjaite   — Timid, 32 SpA / 32 Spe / 2 HP
  Hydro Pump / Ice Beam / Dark Pulse / Protect
Kingdra          @ Dragon Fang   — Modest, 32 SpA / 32 Spe / 2 HP
  Muddy Water / Draco Meteor / Ice Beam / Protect
Whimsicott       @ Focus Sash    — Timid, 32 HP / 32 Spe / 2 SpA
  Tailwind / Moonblast / Encore / Taunt
Incineroar       @ Sitrus Berry  — Adamant, 32 HP / 32 Atk / 2 Def
  Fake Out / Flare Blitz / Parting Shot / Knock Off
Rotom-Wash       @ Sitrus Berry  — Modest, 32 HP / 32 SpA / 2 SpD
  Hydro Pump / Thunderbolt / Will-O-Wisp / Protect
</pre>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Pelipper</span>
    <span class="meta">Drizzle setter</span>
    <p>Muddy Water / Hurricane for spread damage. Drizzle on switch-in enables the entire core.</p>
  </div>
  <div class="role-card">
    <span class="name">Mega Greninja</span>
    <span class="meta">Protean cleaner</span>
    <p>Every move becomes STAB. Rain-boosted Hydro Pump is a nuke on switch-in.</p>
  </div>
  <div class="role-card">
    <span class="name">Kingdra</span>
    <span class="meta">Swift Swim wallbreaker</span>
    <p>Muddy Water is your primary spread move — lowers opposing Accuracy. Draco Meteor for single-target nukes.</p>
  </div>
  <div class="role-card">
    <span class="name">Whimsicott</span>
    <span class="meta">Tailwind backup</span>
    <p>Tailwind stacks with Swift Swim for 4× Speed. Prankster Encore disrupts opposing setup.</p>
  </div>
  <div class="role-card">
    <span class="name">Incineroar</span>
    <span class="meta">Intimidate glue</span>
    <p>Cushions the Electric moves opposing Rain teams like to spam. Cycles Intimidate on opposing physical cores.</p>
  </div>
  <div class="role-card">
    <span class="name">Rotom-Wash</span>
    <span class="meta">Levitate + Electric coverage</span>
    <p>Handles opposing Water walls. Will-O-Wisp disrupts physical threats that resist Water.</p>
  </div>
</div>

<h3>Doubles game plan</h3>
<ol>
  <li><strong>Turn 1.</strong> Lead Pelipper + Mega Greninja. Drizzle sets. Greninja Mega Evolves and clicks Hydro Pump at the biggest threat.</li>
  <li><strong>Turn 2.</strong> Full-power Rain offense. Pelipper Protects or attacks based on threats. Muddy Water spreads damage + accuracy drops.</li>
  <li><strong>Turns 3–4.</strong> Swap Pelipper out (she\'s dead weight after setting weather) for Kingdra or Whimsicott.</li>
  <li><strong>Turn 5+.</strong> Rain expires. Reset via Pelipper switch-in, or Whimsicott Tailwind for speed backup.</li>
</ol>

<h2>Singles team</h2>

<p>Singles Rain drops Whimsicott and Incineroar (Doubles-only tools) and adds a hazard lead + Dragon Dance Kingdra. The win condition shifts from "turn-2 Hydro Pump nuke" to "pivot → chip → boosted sweep."</p>

<pre>
Pelipper         @ Mystic Water  — Modest, 32 HP / 32 SpA / 2 Def
  Hurricane / Surf / U-turn / Roost
Mega Greninja    @ Greninjaite   — Timid, 32 SpA / 32 Spe / 2 HP
  Hydro Pump / Ice Beam / Dark Pulse / U-turn
Kingdra          @ Dragon Fang   — Adamant, 32 Atk / 32 Spe / 2 HP
  Rain Dance / Dragon Dance / Waterfall / Outrage
Glimmora         @ Focus Sash    — Timid, 32 SpA / 32 Spe / 2 HP
  Stealth Rock / Toxic Spikes / Earth Power / Sludge Bomb
Archaludon       @ Leftovers     — Modest, 32 HP / 32 SpA / 2 SpD
  Electro Shot / Draco Meteor / Flash Cannon / Body Press
Dragonite        @ Sitrus Berry  — Adamant, 32 Atk / 32 Spe / 2 HP
  Dragon Dance / Extreme Speed / Earthquake / Dragon Claw
</pre>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Pelipper</span>
    <span class="meta">Singles pivot</span>
    <p>U-turn + Roost replaces Protect — momentum instead of stall. Drizzle sets on entry.</p>
  </div>
  <div class="role-card">
    <span class="name">Mega Greninja</span>
    <span class="meta">Protean pivot cleaner</span>
    <p>U-turn for Singles momentum. Protean makes every attack STAB even outside Rain.</p>
  </div>
  <div class="role-card">
    <span class="name">Kingdra</span>
    <span class="meta">DD wincon</span>
    <p>Singles DD Kingdra: Rain Dance resets weather if Pelipper is gone. Dragon Dance then sweeps with Waterfall / Outrage.</p>
  </div>
  <div class="role-card">
    <span class="name">Glimmora</span>
    <span class="meta">Hazard lead</span>
    <p>Stealth Rock + Toxic Spikes compound with Rain-boosted damage. Chip enables Swift Swim OHKOs.</p>
  </div>
  <div class="role-card">
    <span class="name">Archaludon</span>
    <span class="meta">Electro Shot nuke</span>
    <p>Electro Shot charges in 1 turn under Rain — a Rain-locked special nuke. Body Press for Normal / Ice coverage.</p>
  </div>
  <div class="role-card">
    <span class="name">Dragonite</span>
    <span class="meta">Priority closer</span>
    <p>Multiscale DD cleaner. Extreme Speed finishes chipped targets after Rain expires.</p>
  </div>
</div>

<h3>Singles game plan</h3>
<ol>
  <li><strong>Lead Glimmora.</strong> Stealth Rock turn 1. Toxic Spikes auto-fire. Die on Focus Sash if needed.</li>
  <li><strong>Pivot to Pelipper</strong> to set Drizzle. U-turn out on a predicted Electric move.</li>
  <li><strong>Bring Archaludon</strong> or <strong>Mega Greninja</strong> to nuke with Rain-boosted STAB / 1-turn Electro Shot.</li>
  <li><strong>Late game:</strong> DD Kingdra or DD Dragonite sweeps survivors. Use Rain Dance if Pelipper is dead and weather expired.</li>
  <li><strong>Extreme Speed</strong> closes chipped threats regardless of weather state.</li>
</ol>

<div class="callout warn">
  <p><span class="tag">Don\'t swap rosters</span>Doubles and Singles share only Pelipper / Mega Greninja / Kingdra as species — and Kingdra runs a completely different set (DD physical in Singles vs Swift Swim special in Doubles). Do not mix the teams.</p>
</div>

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

<h2>Doubles team</h2>

<p>Doubles TR runs two setters (one lead, one back-half reset) and four slow wallbreakers. Hatterene is the default lead because Magic Bounce walls Taunt; Mimikyu is the backup for Disguise absorption.</p>

<pre>
Hatterene        @ Leftovers     — Quiet, 32 HP / 2 Def / 32 SpA · 0 Spe
  Dazzling Gleam / Psyshock / Trick Room / Protect
Mimikyu          @ Sitrus Berry  — Brave, 32 HP / 32 Atk / 2 Def · 0 Spe
  Play Rough / Shadow Sneak / Trick Room / Protect
Rhyperior        @ Weakness Policy — Brave, 32 HP / 32 Atk / 2 Def · 0 Spe
  Rock Slide / High Horsepower / Heat Crash / Protect
Conkeldurr       @ Flame Orb     — Brave, 32 HP / 32 Atk / 2 Def · 0 Spe
  Drain Punch / Mach Punch / Knock Off / Protect
Mega Kangaskhan  @ Kangaskhanite — Adamant, 32 HP / 32 Atk / 2 Def
  Double-Edge / Power-Up Punch / Sucker Punch / Protect
Torkoal          @ Charcoal      — Quiet, 32 HP / 2 Def / 32 SpA · 0 Spe
  Eruption / Earth Power / Heat Wave / Protect
</pre>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Hatterene</span>
    <span class="meta">Primary TR setter</span>
    <p>Magic Bounce reflects Taunt and hazards. Dazzling Gleam spreads damage both slots.</p>
  </div>
  <div class="role-card">
    <span class="name">Mimikyu</span>
    <span class="meta">Backup TR setter</span>
    <p>Disguise guarantees one free turn — brought as secondary lead vs Fake Out cores.</p>
  </div>
  <div class="role-card">
    <span class="name">Rhyperior</span>
    <span class="meta">TR wallbreaker</span>
    <p>Rock Slide + High Horsepower covers most threats. Solid Rock + Sand SpD makes it a TR tank.</p>
  </div>
  <div class="role-card">
    <span class="name">Conkeldurr</span>
    <span class="meta">Guts abuser</span>
    <p>Flame Orb activates Guts → 1.5× Attack. Mach Punch works when TR runs out.</p>
  </div>
  <div class="role-card">
    <span class="name">Mega Kangaskhan</span>
    <span class="meta">Parental Bond nuke</span>
    <p>Double-Edge hits twice at full power under TR. Sucker Punch priority closes endgames.</p>
  </div>
  <div class="role-card">
    <span class="name">Torkoal</span>
    <span class="meta">Eruption spreader</span>
    <p>Eruption at 100% HP is 150 BP spread. Pairs with TR to outspeed the field and dump damage.</p>
  </div>
</div>

<h3>Doubles game plan</h3>
<ol>
  <li><strong>Turn 1 · Setup.</strong> Lead Hatterene + wallbreaker. Hatterene clicks TR. Partner Protects or attacks. Partner <em>must</em> survive.</li>
  <li><strong>Turn 2 · Active, 4 remaining.</strong> Slow wallbreaker outspeeds and OHKOs. Swap Hatterene for a second wallbreaker.</li>
  <li><strong>Turns 3–5.</strong> Keep breaking. Plan OHKOs; anything that survives is a problem.</li>
  <li><strong>Turn 6 · Expired.</strong> Priority (Mach Punch / Sucker Punch) or a second TR setup from Mimikyu.</li>
</ol>

<div class="callout tip">
  <p><span class="tag">Track your turns</span>You have exactly <strong>4 turns of abuse</strong>. Count them from the setup click — don\'t commit your wallbreaker on turn 6 thinking you still have Speed.</p>
</div>

<h2>Singles team</h2>

<p>Singles TR drops the second setter and the spread-damage slots (Torkoal, Hatterene-as-support). Every slot needs to function 1v1. Reuniclus replaces Hatterene as lead because Magic Guard lets it eat hazards while setting TR, and the wallbreakers pick up setup moves instead of Protect.</p>

<pre>
Reuniclus        @ Leftovers     — Quiet, 32 HP / 2 Def / 32 SpA · 0 Spe
  Psyshock / Focus Blast / Trick Room / Recover
Slowking         @ Leftovers     — Sassy, 32 HP / 2 Def / 32 SpD · 0 Spe
  Surf / Psychic / Trick Room / Slack Off
Rhyperior        @ Weakness Policy — Brave, 32 HP / 32 Atk / 2 Def · 0 Spe
  Rock Slide / Earthquake / Swords Dance / Megahorn
Conkeldurr       @ Flame Orb     — Brave, 32 HP / 32 Atk / 2 Def · 0 Spe
  Drain Punch / Mach Punch / Bulk Up / Knock Off
Mamoswine        @ Never-Melt Ice — Brave, 32 HP / 32 Atk / 2 Def · 0 Spe
  Icicle Crash / Earthquake / Ice Shard / Stealth Rock
Kingambit        @ Silk Scarf    — Brave, 32 HP / 32 Atk / 2 Def · 0 Spe
  Swords Dance / Sucker Punch / Iron Head / Kowtow Cleave
</pre>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Reuniclus</span>
    <span class="meta">Magic Guard setter</span>
    <p>Ignores hazards / status / Life Orb chip while clicking TR. Recover for longevity — no partner to stall with Protect.</p>
  </div>
  <div class="role-card">
    <span class="name">Slowking</span>
    <span class="meta">Regenerator backup setter</span>
    <p>Second TR reset. Regenerator recovers 33% on every switch, so it can reset TR multiple times over a long game.</p>
  </div>
  <div class="role-card">
    <span class="name">Rhyperior</span>
    <span class="meta">Swords Dance sweeper</span>
    <p>Singles build gets SD over Protect. Megahorn covers Grass walls that shrug off Earthquake.</p>
  </div>
  <div class="role-card">
    <span class="name">Conkeldurr</span>
    <span class="meta">Bulk Up sweeper</span>
    <p>Bulk Up replaces Protect in Singles — accumulates +Atk/+Def while TR is up. Guts flame boost kicks in naturally.</p>
  </div>
  <div class="role-card">
    <span class="name">Mamoswine</span>
    <span class="meta">Hazard + priority</span>
    <p>Stealth Rock enables the TR win condition by chipping opposing walls. Ice Shard works outside TR.</p>
  </div>
  <div class="role-card">
    <span class="name">Kingambit</span>
    <span class="meta">SD closer</span>
    <p>Supreme Overlord snowballs as your team falls. Sucker Punch priority closes games regardless of TR state.</p>
  </div>
</div>

<h3>Singles game plan</h3>
<ol>
  <li><strong>Lead Mamoswine.</strong> Stealth Rock turn 1. Take the chip damage on Focus Sash if needed.</li>
  <li><strong>Pivot to Reuniclus</strong> on a predicted switch. Click Trick Room. Magic Guard lets you take hazard damage safely.</li>
  <li><strong>Bring Rhyperior or Conkeldurr</strong> to set up (SD / Bulk Up) while TR is active. +2 OHKO math with hazard chip.</li>
  <li><strong>Slowking second TR</strong> if the first window expires and the opponent still has a check left.</li>
  <li><strong>Kingambit closes.</strong> SD + Sucker Punch finishes any survivors regardless of weather / TR state.</li>
</ol>

<div class="callout warn">
  <p><span class="tag">Don\'t swap rosters</span>Doubles and Singles share Rhyperior, Conkeldurr, and Mamoswine as species — but all three run completely different sets (SD / Bulk Up / hazard instead of Protect). Do not mix the teams.</p>
</div>

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

<div class="callout warn">
  <p><span class="tag">Doubles only</span>Tailwind is a <strong>Doubles-only archetype</strong>. In Singles, the 4-turn window and single-partner-at-a-time structure make it strictly worse than Choice Scarf or priority. If you\'re building for Singles, see the <a href="/#/faq/pokemon-champions-singles-hyper-offense-archetype-guide">Singles HO guide</a> or <a href="/#/faq/pokemon-champions-singles-balance-archetype-guide">Singles Balance guide</a> instead.</p>
</div>

<p>Tailwind isn\'t really a standalone archetype — it\'s a speed layer you bolt onto any offensive core. Most top Doubles teams run it as default support, whether or not they call themselves "Tailwind teams."</p>

<h3>How Tailwind works</h3>
<ul>
  <li>Doubles your side\'s Speed for <strong>4 turns</strong> (setup turn counted)</li>
  <li>Affects the <em>entire</em> side, not just the setter</li>
  <li>Does NOT stack with Choice Scarf</li>
  <li>DOES stack with Swift Swim, Chlorophyll, Unburden</li>
</ul>

<h2>Doubles team</h2>

<p>The canonical Doubles Tailwind build: Whimsicott Prankster setter, Mega Delphox as the speed-starved nuke, Incineroar glue, and priority backup for when the window closes.</p>

<pre>
Mega Delphox     @ Delphoxite    — Timid, 32 SpA / 32 Spe / 2 HP
  Pyro Break / Psychic / Dazzling Gleam / Protect
Whimsicott       @ Focus Sash    — Timid, 32 HP / 32 Spe / 2 SpA
  Tailwind / Moonblast / Encore / Taunt
Incineroar       @ Sitrus Berry  — Adamant, 32 HP / 32 Atk / 2 Def
  Fake Out / Flare Blitz / Parting Shot / Knock Off
Garchomp         @ Soft Sand     — Jolly, 32 Atk / 32 Spe / 2 HP
  Earthquake / Rock Slide / Dragon Claw / Protect
Weavile          @ Black Glasses — Jolly, 32 Atk / 32 Spe / 2 HP
  Ice Shard / Icicle Crash / Knock Off / Protect
Talonflame       @ Sharp Beak    — Jolly, 32 Atk / 32 Spe / 2 HP
  Tailwind / Brave Bird / Flare Blitz / U-turn
</pre>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Mega Delphox</span>
    <span class="meta">Speed-starved nuke</span>
    <p>Base 104 Speed → 208 under Tailwind. Hardest-hitting special attacker in Champions once it gets the speed tier.</p>
  </div>
  <div class="role-card">
    <span class="name">Whimsicott</span>
    <span class="meta">Prankster setter</span>
    <p>Gold-standard Tailwind setter. Prankster = +1 priority, resolves first regardless of Speed.</p>
  </div>
  <div class="role-card">
    <span class="name">Incineroar</span>
    <span class="meta">Intimidate glue</span>
    <p>Cycles Intimidate + Fake Out + Parting Shot. Universal support.</p>
  </div>
  <div class="role-card">
    <span class="name">Garchomp</span>
    <span class="meta">Scarf-less cleaner</span>
    <p>Base 102 Speed → 204 under Tailwind. Rock Slide doubles as spread damage.</p>
  </div>
  <div class="role-card">
    <span class="name">Weavile</span>
    <span class="meta">Priority backup</span>
    <p>Ice Shard priority covers when Tailwind drops. Closes games with chipped Dragons.</p>
  </div>
  <div class="role-card">
    <span class="name">Talonflame</span>
    <span class="meta">Backup Tailwind</span>
    <p>Gale Wings priority Tailwind + Brave Bird. Second setter for long games.</p>
  </div>
</div>

<h2>Fast abusers (Speed tier reference)</h2>
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

<h2>Doubles game plan</h2>
<ol>
  <li><strong>Turn 1 · Setup.</strong> Lead Whimsicott + Mega Delphox. Prankster Tailwind resolves first. Delphox Mega Evolves and nukes.</li>
  <li><strong>Turn 2 · Window turn 1.</strong> Outspeeding the entire opposing team. Spam damage.</li>
  <li><strong>Turn 3 · Window turn 2.</strong> Whimsicott Taunts TR setters or Encores Protects. Incineroar rotates in.</li>
  <li><strong>Turn 4 · Last window turn.</strong> Commit to KOs that require the speed tier.</li>
  <li><strong>Turn 5+.</strong> Tailwind over. Weavile priority or Talonflame second Tailwind keeps pressure alive.</li>
</ol>

<div class="callout">
  <p><span class="tag">Math check</span>4 turns total includes the setup turn → you only get <strong>3 turns of real abuse</strong>. Plan your KOs around that window.</p>
</div>

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
<h2>Doubles Hyper Offense — Overview</h2>

<div class="at-a-glance">
  <div><span class="label">Playstyle</span><span class="value">All-in offense</span></div>
  <div><span class="label">Goal</span><span class="value">OHKO before they move</span></div>
  <div><span class="label">Format</span><span class="value">Doubles</span></div>
  <div><span class="label">Difficulty</span><span class="value">Medium-Hard</span></div>
</div>

<div class="callout">
  <p><span class="tag">Looking for Singles?</span>Singles HO is a completely different roster — hazard stacking + setup sweepers instead of Fake Out pivots. See the <a href="/#/faq/pokemon-champions-singles-hyper-offense-archetype-guide">Singles Hyper Offense guide</a> for the Singles team template.</p>
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
<h2>Doubles Intimidate Balance — Overview</h2>

<div class="at-a-glance">
  <div><span class="label">Playstyle</span><span class="value">Flexible goodstuff</span></div>
  <div><span class="label">Anchor</span><span class="value">Incineroar</span></div>
  <div><span class="label">Format</span><span class="value">Doubles</span></div>
  <div><span class="label">Difficulty</span><span class="value">Medium</span></div>
</div>

<div class="callout">
  <p><span class="tag">Looking for Singles?</span>Singles Balance uses a completely different roster — Regenerator pivots, hazard setters, setup sweepers. See the <a href="/#/faq/pokemon-champions-singles-balance-archetype-guide">Singles Balance guide</a> for the Singles team template.</p>
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
  {
    slug: 'pokemon-champions-shadow-tag-perish-trap-archetype-guide',
    question: 'How do Shadow Tag Perish Trap teams work in Pokémon Champions?',
    answer: 'Perish Trap pairs Mega Gengar (Shadow Tag) with Perish Song to force KOs on trapped opponents. Gengar locks a target in for 3 turns, Perish Song counts down, and the trapped Pokémon faints on turn 3 unless the opponent sacrifices it. It\'s a Doubles-specific trap archetype — Singles has no equivalent because switching out in 1v1 is less punishing.',
    category: 'competitive',
    tags: ['perish song', 'mega gengar', 'shadow tag', 'trap', 'archetype', 'team comp'],
    content: `
<h2>Shadow Tag Perish Trap — Overview</h2>

<div class="at-a-glance">
  <div><span class="label">Playstyle</span><span class="value">Forced trades</span></div>
  <div><span class="label">Trapper</span><span class="value">Mega Gengar</span></div>
  <div><span class="label">Format</span><span class="value">Doubles only</span></div>
  <div><span class="label">Difficulty</span><span class="value">Hard</span></div>
</div>

<div class="callout warn">
  <p><span class="tag">Doubles only</span>Perish Trap is <strong>not viable in Singles</strong> — Singles has no partner to click Perish Song while Gengar traps the target, and Shadow Tag alone doesn\'t force KOs. Singles trappers use Taunt + Will-O-Wisp instead.</p>
</div>

<p>Perish Trap is the <strong>trade-forcing archetype</strong>. Mega Gengar\'s Shadow Tag prevents the opponent from switching; a partner clicks Perish Song; Gengar runs out the 3-turn counter. The trapped Pokémon dies at the end of turn 3 unless the opponent sacrifices it by Protecting or trading.</p>

<h3>How Perish Song works</h3>
<ul>
  <li><strong>Perish Song</strong> puts a 3-turn counter on every Pokémon on the field that isn\'t Soundproof</li>
  <li><strong>Shadow Tag</strong> prevents trapped Pokémon from switching (ignores immunity on Ghost types)</li>
  <li>The turn you click Perish Song is turn 3 on the counter — dies at end of turn 3</li>
  <li>Your own Gengar gets the counter too, so you switch out turn 2 to avoid dying</li>
</ul>

<h2>Doubles team</h2>

<p>Perish Trap needs a Perish Song user <em>alongside</em> Gengar. Gengar traps, the partner sings, Gengar pivots out turn 2 before its own counter kills it.</p>

<pre>
Mega Gengar      @ Gengarite     — Timid, 32 SpA / 32 Spe / 2 HP
  Shadow Ball / Sludge Bomb / Taunt / Protect
Whimsicott       @ Focus Sash    — Timid, 32 HP / 32 Spe / 2 SpA
  Tailwind / Encore / Taunt / Moonblast
Alcremie         @ Leftovers     — Calm, 32 HP / 2 Def / 32 SpD
  Perish Song / Follow Me / Protect / Moonblast
Incineroar       @ Sitrus Berry  — Adamant, 32 HP / 32 Atk / 2 Def
  Fake Out / Flare Blitz / Parting Shot / Knock Off
Garchomp         @ Soft Sand     — Jolly, 32 Atk / 32 Spe / 2 HP
  Earthquake / Rock Slide / Dragon Claw / Protect
Clefable         @ Leftovers     — Calm, 32 HP / 2 Def / 32 SpD
  Moonblast / Follow Me / Moonlight / Protect
</pre>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Mega Gengar</span>
    <span class="meta">Shadow Tag trapper</span>
    <p>Traps a target, then Taunts to prevent them from status / setup. Must pivot out turn 2 to dodge its own Perish counter.</p>
  </div>
  <div class="role-card">
    <span class="name">Alcremie</span>
    <span class="meta">Perish Song partner</span>
    <p>Clicks Perish Song while Gengar traps. Follow Me redirects attacks away from Gengar.</p>
  </div>
  <div class="role-card">
    <span class="name">Whimsicott</span>
    <span class="meta">Prankster support</span>
    <p>Taunt + Encore disrupts opposing Taunt attempts that would shut off Perish Song.</p>
  </div>
  <div class="role-card">
    <span class="name">Incineroar</span>
    <span class="meta">Intimidate glue</span>
    <p>Swaps in on turn 2 when Gengar pivots out. Absorbs the opposing attacker\'s hit.</p>
  </div>
  <div class="role-card">
    <span class="name">Garchomp</span>
    <span class="meta">Backup offense</span>
    <p>Standard physical attacker for when the Perish trap fails to land.</p>
  </div>
  <div class="role-card">
    <span class="name">Clefable</span>
    <span class="meta">Backup redirector</span>
    <p>Second Follow Me source. Magic Guard ignores hazards / burn chip.</p>
  </div>
</div>

<h3>Doubles game plan</h3>
<ol>
  <li><strong>Turn 1.</strong> Lead Gengar + Alcremie. Gengar Mega Evolves (Shadow Tag active), Taunts the biggest threat. Alcremie Follow Me\'s to redirect damage.</li>
  <li><strong>Turn 2.</strong> Alcremie clicks Perish Song. Gengar Protects to survive the counter-attack.</li>
  <li><strong>Turn 3.</strong> Pivot Gengar OUT (to Incineroar or Clefable) — its Perish counter is at 1. Alcremie stays in for Follow Me protection.</li>
  <li><strong>Turn 4 · Counter 0.</strong> The trapped opponent Pokémon faints. Alcremie pivots out too (she also had the counter). You\'re now up a KO without taking damage.</li>
  <li><strong>Endgame.</strong> Repeat with the second trapped target, or close with Garchomp / Incineroar offense.</li>
</ol>

<div class="callout warn">
  <p><span class="tag">Perish counter math</span>You and the opponent both get the counter — Gengar and Alcremie MUST switch out before turn 4 or they die too. Plan the swap in advance.</p>
</div>

<h2>Matchups</h2>
<table>
  <tr><th>Vs</th><th>Outcome</th><th>Plan</th></tr>
  <tr><td>Sun / Sand / Snow</td><td>Neutral</td><td>Weather doesn\'t affect the trap. Play it as a standard offensive matchup.</td></tr>
  <tr><td>Trick Room</td><td>Unfavored</td><td>Gengar outsped by slow wallbreakers. Taunt the setter before TR goes up.</td></tr>
  <tr><td>Tailwind</td><td>Neutral</td><td>Their speed doesn\'t help because Perish Song ignores speed tier.</td></tr>
  <tr><td>Hyper Offense</td><td>Favored</td><td>Glass cannons die to Shadow Ball or get trapped for Perish KOs.</td></tr>
  <tr><td>Balance</td><td>Favored</td><td>Their walls don\'t help — Perish Song ignores bulk.</td></tr>
</table>

<h2>Common mistakes</h2>
<ul>
  <li><strong>Not swapping Gengar turn 3.</strong> Gengar dies to its own Perish counter. Pivot out to preserve it.</li>
  <li><strong>Leading Perish Song turn 1.</strong> Without Taunt + redirection, the opponent just switches Gengar\'s target out.</li>
  <li><strong>No Follow Me backup.</strong> Alcremie is fragile; if she dies before clicking Perish Song, the trap collapses.</li>
  <li><strong>Trapping a Ghost type.</strong> Ghost types ignore Shadow Tag. Check opposing leads before committing Mega.</li>
</ul>

<h2>Related articles</h2>
<ul>
  <li><a href="/#/faq/pokemon-champions-hyper-offense-archetype-guide">Doubles Hyper Offense guide</a></li>
  <li><a href="/#/faq/pokemon-champions-team-archetypes">All team archetypes overview</a></li>
</ul>
    `,
  },
  {
    slug: 'pokemon-champions-singles-volt-turn-archetype-guide',
    question: 'How do Singles Volt-Turn teams work in Pokémon Champions?',
    answer: 'Singles Volt-Turn is a momentum-based archetype built on Volt Switch, U-turn, and Parting Shot. Every pivot move forces a favorable matchup on the field while chipping the opponent with hazards. The core pairs 3+ pivot users (Rotom-Wash, Corviknight, Scizor, Hydreigon) with a Stealth Rock layer and a setup sweeper endgame. It\'s the Singles answer to Doubles\' Intimidate Balance.',
    category: 'competitive',
    tags: ['singles', 'volt-turn', 'u-turn', 'volt switch', 'pivot', 'rotom', 'corviknight', 'archetype', 'team comp'],
    content: `
<h2>Singles Volt-Turn — Overview</h2>

<div class="at-a-glance">
  <div><span class="label">Playstyle</span><span class="value">Momentum pivoting</span></div>
  <div><span class="label">Core move</span><span class="value">Volt Switch + U-turn</span></div>
  <div><span class="label">Format</span><span class="value">Singles only</span></div>
  <div><span class="label">Difficulty</span><span class="value">Medium</span></div>
</div>

<p>Volt-Turn weaponizes <strong>momentum</strong>. Every attack is also a switch. You force the opponent into bad matchups over and over, chipping with hazards on every entry, until their wincon is too hurt to threaten yours.</p>

<h3>How Volt-Turn works</h3>
<ul>
  <li><strong>Volt Switch / U-turn / Flip Turn / Parting Shot</strong> — attack, then switch to a teammate</li>
  <li>The opponent picks their switch <em>first</em>, then you react with your pivot</li>
  <li>Combine with <strong>Stealth Rock</strong> so every opposing switch takes chip damage</li>
  <li>Win by grinding their wincon below its setup-HP threshold, then sweeping</li>
</ul>

<h2>Singles team</h2>

<pre>
Corviknight      @ Leftovers     — Impish, 32 HP / 32 Def / 2 SpD
  Body Press / U-turn / Roost / Defog
Rotom-Wash       @ Leftovers     — Bold, 32 HP / 32 Def / 2 SpA
  Volt Switch / Hydro Pump / Will-O-Wisp / Pain Split
Scizor           @ Leftovers     — Adamant, 32 HP / 32 Atk / 2 Def
  U-turn / Bullet Punch / Knock Off / Roost
Hydreigon        @ Choice Scarf  — Timid, 32 SpA / 32 Spe / 2 HP
  Draco Meteor / Dark Pulse / Flash Cannon / U-turn
Glimmora         @ Focus Sash    — Timid, 32 SpA / 32 Spe / 2 HP
  Stealth Rock / Toxic Spikes / Earth Power / Sludge Bomb
Dragonite        @ Sitrus Berry  — Adamant, 32 Atk / 32 Spe / 2 HP
  Dragon Dance / Extreme Speed / Earthquake / Dragon Claw
</pre>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Corviknight</span>
    <span class="meta">Physical pivot + Defog</span>
    <p>U-turn + Roost sustain. Defog removes opposing hazards while Glimmora keeps yours up.</p>
  </div>
  <div class="role-card">
    <span class="name">Rotom-Wash</span>
    <span class="meta">Volt Switch core</span>
    <p>Volt Switch + Hydro Pump covers Water / Electric neutrally. Will-O-Wisp cripples physical switch-ins.</p>
  </div>
  <div class="role-card">
    <span class="name">Scizor</span>
    <span class="meta">Priority pivot</span>
    <p>Bullet Punch priority + U-turn momentum. Knock Off removes opposing Choice items and Leftovers.</p>
  </div>
  <div class="role-card">
    <span class="name">Hydreigon</span>
    <span class="meta">Scarf revenge killer</span>
    <p>Choice Scarf U-turn extends the pivot chain. Draco Meteor nukes chipped threats.</p>
  </div>
  <div class="role-card">
    <span class="name">Glimmora</span>
    <span class="meta">Hazard layer</span>
    <p>Stealth Rock + Toxic Spikes enable the whole archetype by chipping every opposing switch.</p>
  </div>
  <div class="role-card">
    <span class="name">Dragonite</span>
    <span class="meta">Setup wincon</span>
    <p>Dragon Dance closes games once the opponent\'s checks are chipped below priority ESpeed\'s OHKO range.</p>
  </div>
</div>

<h3>Singles game plan</h3>
<ol>
  <li><strong>Lead Glimmora.</strong> Stealth Rock turn 1 on a predicted switch. Toxic Debris auto-layers.</li>
  <li><strong>Pivot chain.</strong> Rotom-Wash Volt Switch into Corviknight U-turn into Scizor U-turn. Every switch chips the opponent\'s side.</li>
  <li><strong>Force mispicks.</strong> The pivot chain forces bad switches. Choice Scarf Hydreigon U-turns into the right matchup.</li>
  <li><strong>Chip phase.</strong> Will-O-Wisp + Stealth Rock + Toxic Spikes + Leech cumulative damage wears down the opposing wincon.</li>
  <li><strong>Close with Dragonite.</strong> Dragon Dance when the opponent\'s priority checks are gone. Extreme Speed OHKOs chipped targets.</li>
</ol>

<div class="callout tip">
  <p><span class="tag">Pivot priority order</span>When deciding which pivot to click, ask: "which teammate has the best 1v1 against the opponent\'s <em>most likely switch-in</em>?" Volt-Turn is about reading the switch, not the immediate matchup.</p>
</div>

<h2>Matchups</h2>
<table>
  <tr><th>Vs</th><th>Outcome</th><th>Plan</th></tr>
  <tr><td>Hyper Offense</td><td>Neutral</td><td>Pivot to your bulky checks on their setup turn.</td></tr>
  <tr><td>Balance</td><td>Favored</td><td>You out-pivot the pivot core. They can\'t keep up with Scarf Hydreigon momentum.</td></tr>
  <tr><td>Stall</td><td>Slightly unfavored</td><td>Stall out-recovers your chip damage. Bring Dragonite early for a setup win.</td></tr>
  <tr><td>Sand / Sun / Rain</td><td>Neutral</td><td>Weather helps them more than you. Keep pivoting around weather setters.</td></tr>
  <tr><td>Trick Room</td><td>Unfavored</td><td>Your Speed advantage inverts. Taunt the setter or concede in preview.</td></tr>
</table>

<h2>Common mistakes</h2>
<ul>
  <li><strong>Pivoting into a bad matchup.</strong> If your pivot resolves before the opponent\'s attack, you control the next slot. Read carefully.</li>
  <li><strong>Skipping hazards.</strong> Volt-Turn without Stealth Rock is just random switching. Hazards are the damage source.</li>
  <li><strong>No wincon.</strong> Pivoting alone doesn\'t win games — you need Dragonite / Kingambit / setup sweeper to close.</li>
  <li><strong>U-turning into a resist.</strong> If the opponent\'s likely switch-in resists your U-turn, don\'t pivot — attack instead.</li>
</ul>

<h2>Related articles</h2>
<ul>
  <li><a href="/#/faq/pokemon-champions-singles-balance-archetype-guide">Singles Balance guide</a></li>
  <li><a href="/#/faq/pokemon-champions-singles-hyper-offense-archetype-guide">Singles Hyper Offense guide</a></li>
  <li><a href="/#/faq/pokemon-champions-battle-formats">Singles vs Doubles format differences</a></li>
</ul>
    `,
  },
  {
    slug: 'pokemon-champions-singles-stall-archetype-guide',
    question: 'How do Singles Stall teams work in Pokémon Champions?',
    answer: 'Singles Stall wins through attrition. The team runs full walls with reliable recovery, Toxic for passive damage, and hazards for chip. You don\'t kill the opponent — you outlast them. Core members: Hippowdon (Sand chip + Rocks), Clefable (Magic Guard wincon), Corviknight (Defog + U-turn), plus Umbreon, Slowking, or Gliscor for matchup coverage. Stall is the highest-skill, longest-games archetype in Champions.',
    category: 'competitive',
    tags: ['singles', 'stall', 'toxic', 'recovery', 'walls', 'attrition', 'archetype', 'team comp'],
    content: `
<h2>Singles Stall — Overview</h2>

<div class="at-a-glance">
  <div><span class="label">Playstyle</span><span class="value">Attrition / outlast</span></div>
  <div><span class="label">Core</span><span class="value">Full walls + Toxic</span></div>
  <div><span class="label">Format</span><span class="value">Singles only</span></div>
  <div><span class="label">Difficulty</span><span class="value">Very hard</span></div>
</div>

<div class="callout warn">
  <p><span class="tag">Not viable in Doubles</span>Stall is a <strong>Singles-only archetype</strong>. Doubles has too much spread damage and too few turns per match for walls to out-recover offensive pressure. In Doubles, use <a href="/#/faq/pokemon-champions-intimidate-balance-archetype-guide">Intimidate Balance</a> instead.</p>
</div>

<p>Stall wins by <strong>not losing</strong>. Every wall has reliable recovery. Toxic spreads passive damage. Hazards chip every switch. You never KO the opponent directly — you outlast them until they time out or their wallbreaker\'s PP runs dry.</p>

<h3>How Stall works</h3>
<ul>
  <li><strong>Toxic</strong> ticks 1/16 → 2/16 → 3/16 → ... over 5+ turns</li>
  <li><strong>Reliable recovery</strong> (Recover, Roost, Slack Off, Soft-Boiled) regenerates 50% HP per click</li>
  <li><strong>Stealth Rock</strong> chips every opposing switch</li>
  <li><strong>Hazard control</strong> (Defog / Rapid Spin) keeps opposing chip off your side</li>
  <li><strong>Win condition:</strong> outlast the wallbreaker until its PP depletes or your setup sweeper cleans the shell</li>
</ul>

<h2>Singles team</h2>

<pre>
Hippowdon        @ Leftovers     — Impish, 32 HP / 32 Def / 2 SpD
  Earthquake / Slack Off / Stealth Rock / Whirlwind
Clefable         @ Leftovers     — Calm, 32 HP / 2 Def / 32 SpD
  Moonblast / Moonlight / Calm Mind / Thunder Wave
Corviknight      @ Leftovers     — Impish, 32 HP / 32 Def / 2 SpD
  Body Press / Roost / U-turn / Defog
Umbreon          @ Leftovers     — Calm, 32 HP / 2 Def / 32 SpD
  Foul Play / Wish / Protect / Yawn
Slowking         @ Leftovers     — Calm, 32 HP / 2 Def / 32 SpD
  Scald-alt: Surf / Slack Off / Toxic / Future Sight
Gliscor          @ Leftovers     — Impish, 32 HP / 32 Def / 2 SpD
  Earthquake / Roost / Toxic / Protect
</pre>

<div class="role-grid">
  <div class="role-card">
    <span class="name">Hippowdon</span>
    <span class="meta">Physical wall + Rocks</span>
    <p>Stealth Rock lead. Sand Stream chip compounds with Toxic. Whirlwind phases opposing setup.</p>
  </div>
  <div class="role-card">
    <span class="name">Clefable</span>
    <span class="meta">Magic Guard wincon</span>
    <p>Magic Guard ignores ALL indirect damage — hazards, burn, Toxic, Life Orb. Calm Mind eventually walls everything.</p>
  </div>
  <div class="role-card">
    <span class="name">Corviknight</span>
    <span class="meta">Defogger + backup wall</span>
    <p>Removes opposing hazards with Defog. Body Press scales off its massive Defense.</p>
  </div>
  <div class="role-card">
    <span class="name">Umbreon</span>
    <span class="meta">Wish passer</span>
    <p>Wish heals your other walls when their recovery PP runs low. Yawn forces switches.</p>
  </div>
  <div class="role-card">
    <span class="name">Slowking</span>
    <span class="meta">Regenerator pivot</span>
    <p>Future Sight pressures walls from a pivot slot. Regenerator recovers 33% on every switch.</p>
  </div>
  <div class="role-card">
    <span class="name">Gliscor</span>
    <span class="meta">Toxic spreader</span>
    <p>Toxic + Protect stall + Roost. Ground immunity handles Electric-type attackers that threaten your Water core.</p>
  </div>
</div>

<h3>Singles game plan</h3>
<ol>
  <li><strong>Lead Hippowdon.</strong> Stealth Rock turn 1. Pivot out when bulk is spent.</li>
  <li><strong>Spread Toxic.</strong> Gliscor or Slowking (via Toxic) puts the Toxic counter on their main attacker.</li>
  <li><strong>Pivot cycle.</strong> Rotate Clefable, Umbreon, Corviknight based on the matchup. Each one has recovery + role.</li>
  <li><strong>Wish pass.</strong> Umbreon passes Wishes to walls that are low on recovery PP.</li>
  <li><strong>Close with Clefable.</strong> Once the opposing wallbreaker is dead or PP-stalled, Clefable Calm Mind sweeps the rest of their team.</li>
</ol>

<div class="callout tip">
  <p><span class="tag">PP economy</span>Stall matches go 50+ turns. Every Recover / Slack Off click costs PP. Track your recovery PP carefully — if you run out before the opponent\'s wallbreaker dies, you lose.</p>
</div>

<h2>Matchups</h2>
<table>
  <tr><th>Vs</th><th>Outcome</th><th>Plan</th></tr>
  <tr><td>Hyper Offense</td><td>Favored</td><td>Walls absorb boosted sweeps. Toxic kills them over 6 turns.</td></tr>
  <tr><td>Balance</td><td>Neutral</td><td>Long grindy match. Whoever runs out of recovery PP first loses.</td></tr>
  <tr><td>Sand</td><td>Favored</td><td>You outlast Sand chip with recovery. Excadrill can\'t break Clefable.</td></tr>
  <tr><td>Rain</td><td>Slightly unfavored</td><td>Archaludon / Mega Greninja punch through with Rain-boosted nukes.</td></tr>
  <tr><td>Trick Room</td><td>Slightly unfavored</td><td>Wallbreakers OHKO your walls under TR. Play around the 4-turn window.</td></tr>
  <tr><td>Stall mirror</td><td>Skill matchup</td><td>Whoever\'s Clefable sets up Calm Mind first wins.</td></tr>
</table>

<h2>Common mistakes</h2>
<ul>
  <li><strong>No wincon.</strong> Pure walling ends in timeouts that go to the opponent. You need Clefable Calm Mind or Umbreon Wish pass to actually close games.</li>
  <li><strong>Skipping Defog.</strong> Opposing hazards compound against you too. Remove them.</li>
  <li><strong>Not tracking recovery PP.</strong> Recover has 8 PP. In a 50-turn match you\'ll burn through it — plan when to swap.</li>
  <li><strong>Running offensive spreads.</strong> Stall walls need max HP + max Def / max SpD. No offense investment.</li>
</ul>

<h2>Related articles</h2>
<ul>
  <li><a href="/#/faq/pokemon-champions-singles-balance-archetype-guide">Singles Balance guide</a> (middle ground between Stall and HO)</li>
  <li><a href="/#/faq/pokemon-champions-counter-opposing-archetypes">Counter-picking opposing archetypes</a></li>
  <li><a href="/#/faq/pokemon-champions-battle-formats">Singles vs Doubles format differences</a></li>
</ul>
    `,
  },
];
