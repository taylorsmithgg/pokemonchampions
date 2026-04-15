// Meta Discovery Engine
// Deep algorithmic analysis of the Champions metagame
// Finds strategies that DON'T exist in VGC 2026 data


import { getAvailablePokemon, getPokemonData, getDefensiveMultiplier } from '../data/champions';
import { NORMAL_TIER_LIST, MEGA_TIER_LIST } from '../data/tierlist';
import { PRESETS } from '../data/presets';
import { getMetaUsage, getTopMeta, getArchetypeUsage } from '../data/pikalyticsMeta';

const ALL_TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

export interface Discovery {
  id: string;
  category: 'core' | 'threat' | 'counter' | 'archetype' | 'underrated' | 'combo' | 'wall';
  title: string;
  description: string;
  pokemon: string[];       // species names for sprites
  calcPokemon: string[];   // base species names for loading into calc
  reasoning: string[];
  confidence: number;
}

// Helper: get base species for calc loading (strip Mega form)

// Pikalytics tournament usage is the strongest viability signal — a
// Pokemon showing up in any top-team submission is by definition viable.
// Tier list + presets remain a fallback for picks that haven't yet
// registered tournament results (new releases, theorymon).
function isViable(name: string): boolean {
  if (getMetaUsage(name) > 0) return true;
  return NORMAL_TIER_LIST.some(e => e.name === name) ||
    MEGA_TIER_LIST.some(e => e.name === name) ||
    PRESETS.some(p => p.species === name);
}

// Boost confidence by how proven a pick is in tournaments. 30%+ usage
// adds +12, 15-30% adds +8, 5-15% adds +4. Suppresses noise from
// theorycrafted picks while letting real meta picks bubble up.
function metaConfidenceBoost(species: string): number {
  const usage = getMetaUsage(species);
  if (usage >= 30) return 12;
  if (usage >= 15) return 8;
  if (usage >= 5) return 4;
  return 0;
}

// ─── 1. Offensive Cores — type coverage combos ─────────────────────
function findOffensiveCores(): Discovery[] {
  const discoveries: Discovery[] = [];
  const pool = getAvailablePokemon().filter(n => !n.includes('-') || ['-Alola', '-Galar', '-Wash', '-Heat', '-Mow'].some(s => n.includes(s)));
  const viable = pool.filter(isViable);

  // Check every pair of viable Pokemon for combined STAB coverage
  for (let i = 0; i < viable.length; i++) {
    const a = getPokemonData(viable[i]);
    if (!a) continue;
    for (let j = i + 1; j < viable.length; j++) {
      const b = getPokemonData(viable[j]);
      if (!b) continue;

      const combinedTypes = new Set([...a.types, ...b.types]);
      let hitsSE = 0;
      let total = 0;

      for (const target of pool.slice(0, 80)) {
        const t = getPokemonData(target);
        if (!t) continue;
        total++;
        for (const atkType of combinedTypes) {
          if (getDefensiveMultiplier(atkType as string, [...t.types] as string[]) > 1) { hitsSE++; break; }
        }
      }

      const coverage = total > 0 ? (hitsSE / total) * 100 : 0;
      if (coverage >= 80) {
        const usageA = getMetaUsage(viable[i]);
        const usageB = getMetaUsage(viable[j]);
        const avgUsage = (usageA + usageB) / 2;
        const metaBoost = (metaConfidenceBoost(viable[i]) + metaConfidenceBoost(viable[j])) / 2;
        const reasoning = [`${coverage.toFixed(0)}% coverage`, `Only ${total - hitsSE} Pokemon resist both`];
        if (avgUsage > 0) {
          reasoning.push(`Tournament usage: ${viable[i]} ${usageA.toFixed(1)}%, ${viable[j]} ${usageB.toFixed(1)}%`);
        }
        discoveries.push({
          id: `core-${viable[i]}-${viable[j]}`,
          category: 'core',
          title: `${viable[i]} + ${viable[j]}`,
          description: `${[...combinedTypes].join('/')} STAB covers ${coverage.toFixed(0)}% of the Champions meta super-effectively.`,
          pokemon: [viable[i], viable[j]],
          calcPokemon: [viable[i], viable[j]],
          reasoning,
          confidence: Math.min(95, Math.round(coverage) + metaBoost),
        });
      }
    }
  }
  discoveries.sort((a, b) => b.confidence - a.confidence);
  return discoveries.slice(0, 6);
}

// ─── 2. Unchecked Threats — few walls in the pool ──────────────────
function findUncheckedThreats(): Discovery[] {
  const discoveries: Discovery[] = [];
  const pool = getAvailablePokemon().filter(n => !n.includes('-') || ['-Alola', '-Galar', '-Wash', '-Heat'].some(s => n.includes(s)));

  for (const species of pool) {
    const data = getPokemonData(species);
    if (!data) continue;
    if (data.baseStats.atk < 85 && data.baseStats.spa < 85) continue;

    const types = [...data.types] as string[];
    let wallCount = 0;

    for (const target of pool) {
      if (target === species) continue;
      const t = getPokemonData(target);
      if (!t) continue;
      let resistsAll = true;
      for (const atkType of types) {
        if (getDefensiveMultiplier(atkType, [...t.types] as string[]) >= 1) { resistsAll = false; break; }
      }
      if (resistsAll) wallCount++;
    }

    if (wallCount <= 6 && (data.baseStats.atk >= 100 || data.baseStats.spa >= 100)) {
      // Tournament usage is the source of truth for "established vs sleeper".
      // Tier list lags behind real results — pikalytics reflects what's
      // actually winning right now.
      const usage = getMetaUsage(species);
      const isEstablished = usage >= 15;            // A+ or higher tournament presence
      const isSleeper = usage < 5;                  // barely seen but theoretically strong
      const category = isSleeper ? 'underrated' : 'threat';
      const title = isSleeper
        ? `Sleeper: ${species}`
        : `${species} — hard to wall`;
      const usageNote = usage > 0
        ? `${usage.toFixed(1)}% of tournament teams`
        : 'No tournament presence yet';
      const sleeperBonus = isSleeper && data.baseStats.spe >= 90 ? 10 : 0;

      discoveries.push({
        id: `threat-${species}`,
        category,
        title,
        description: `Only ${wallCount} Pokemon resist ${types.join('/')} STAB. ${data.baseStats.atk >= data.baseStats.spa ? data.baseStats.atk + ' Atk' : data.baseStats.spa + ' SpA'}, ${data.baseStats.spe} Speed.${isSleeper ? ' Underused — opponents won\'t prep for it.' : ''}`,
        pokemon: [species],
        calcPokemon: [species],
        reasoning: [
          `${types.join('/')} walled by only ${wallCount} Pokemon`,
          usageNote,
          isEstablished ? 'Proven tournament threat — must-prep' : isSleeper ? 'Off-meta — surprise factor' : 'Mid-usage pick',
        ],
        confidence: Math.min(95, 85 - wallCount * 5 + sleeperBonus + metaConfidenceBoost(species)),
      });
    }
  }
  discoveries.sort((a, b) => b.confidence - a.confidence);
  return discoveries.slice(0, 5);
}

// ─── 3. Unkillable Walls — Pokemon with insane bulk + few weaknesses ─
function findUnkillableWalls(): Discovery[] {
  const discoveries: Discovery[] = [];
  const pool = getAvailablePokemon().filter(n => !n.includes('-') || ['-Alola', '-Galar', '-Wash', '-Heat'].some(s => n.includes(s)));

  for (const species of pool) {
    const data = getPokemonData(species);
    if (!data) continue;
    const bs = data.baseStats;
    const types = [...data.types] as string[];

    // Calculate bulk index
    const physBulk = bs.hp * bs.def;
    const specBulk = bs.hp * bs.spd;
    const totalBulk = physBulk + specBulk;
    if (totalBulk < 25000) continue; // Must be genuinely bulky

    // Count weaknesses and resistances
    let weaknesses = 0;
    let resistances = 0;
    let immunities = 0;
    for (const atkType of ALL_TYPES) {
      const mult = getDefensiveMultiplier(atkType, types);
      if (mult > 1) weaknesses++;
      else if (mult < 1 && mult > 0) resistances++;
      else if (mult === 0) immunities++;
    }

    // Count how many meta attackers can actually hit it SE
    let threatenedBy = 0;
    const metaThreats = pool.filter(n => {
      const d = getPokemonData(n);
      return d && (d.baseStats.atk >= 90 || d.baseStats.spa >= 90);
    }).slice(0, 50);

    for (const threat of metaThreats) {
      const tData = getPokemonData(threat);
      if (!tData) continue;
      for (const tType of tData.types) {
        if (getDefensiveMultiplier(tType as string, types) > 1) { threatenedBy++; break; }
      }
    }

    const survivalRate = ((metaThreats.length - threatenedBy) / metaThreats.length) * 100;
    if (survivalRate >= 65 && weaknesses <= 3) {
      // Re-score survival against actual top-tournament attackers, not the
      // stat-filtered theoretical pool. A wall that survives Sneasler +
      // Garchomp + Kingambit (the top picks) matters more than one that
      // survives every 90+ Atk mon abstractly.
      const topThreats = getTopMeta(15);
      let topThreatenedBy = 0;
      for (const threat of topThreats) {
        const tData = getPokemonData(threat);
        if (!tData) continue;
        for (const tType of tData.types) {
          if (getDefensiveMultiplier(tType as string, types) > 1) { topThreatenedBy++; break; }
        }
      }
      const topSurvivalRate = topThreats.length > 0
        ? ((topThreats.length - topThreatenedBy) / topThreats.length) * 100
        : survivalRate;

      discoveries.push({
        id: `wall-${species}`,
        category: 'wall',
        title: `${species} — defensive fortress`,
        description: `${resistances} resistances, ${immunities} immunities, only ${weaknesses} weaknesses. Walls ${topSurvivalRate.toFixed(0)}% of top-15 tournament attackers. Bulk: ${bs.hp}/${bs.def}/${bs.spd}.`,
        pokemon: [species],
        calcPokemon: [species],
        reasoning: [
          `Only ${topThreatenedBy}/${topThreats.length} top tournament attackers threaten it`,
          `${resistances + immunities} favorable type matchups`,
          `Recovery options make it extremely hard to break`,
        ],
        // Weight by tournament-relevant survival, not abstract survival
        confidence: Math.min(90, Math.round(topSurvivalRate * 0.9) + metaConfidenceBoost(species)),
      });
    }
  }
  discoveries.sort((a, b) => b.confidence - a.confidence);
  return discoveries.slice(0, 4);
}

// ─── 4. Speed Tier Dominators ──────────────────────────────────────
function findSpeedDominators(): Discovery[] {
  const discoveries: Discovery[] = [];
  const pool = getAvailablePokemon().filter(n => !n.includes('-') || ['-Alola', '-Galar', '-Wash', '-Heat'].some(s => n.includes(s)));

  // Build speed distribution of offensive Pokemon
  const speedTiers: { species: string; spe: number; power: number }[] = [];
  for (const name of pool) {
    const data = getPokemonData(name);
    if (!data) continue;
    if (data.baseStats.atk < 75 && data.baseStats.spa < 75) continue;
    speedTiers.push({
      species: name,
      spe: data.baseStats.spe,
      power: Math.max(data.baseStats.atk, data.baseStats.spa),
    });
  }
  speedTiers.sort((a, b) => b.spe - a.spe);

  // Top 5 fastest offensive Pokemon
  const top5 = speedTiers.slice(0, 5);
  if (top5.length >= 3) {
    discoveries.push({
      id: 'speed-kings',
      category: 'archetype',
      title: 'Speed kings of Champions',
      description: `The fastest offensive threats: ${top5.map(p => `${p.species} (${p.spe})`).join(', ')}. Without Flutter Mane and Dragapult dominating, these control the speed game.`,
      pokemon: top5.slice(0, 3).map(p => p.species),
      calcPokemon: top5.slice(0, 3).map(p => p.species),
      reasoning: top5.map(p => `${p.species}: ${p.spe} Spe, ${p.power} offensive`),
      confidence: 85,
    });
  }

  // Choice Scarf breakpoint: who outspeeds the fastest with Scarf?
  const fastest = top5[0]?.spe || 130;
  const scarfViable = speedTiers.filter(p => {
    // At Lv50, 32 Spe SP, +Spe nature, Scarf: stat = floor((floor((2*base+31+8)*50/100)+5)*1.1)*1.5
    const stat = Math.floor(Math.floor((Math.floor(((2 * p.spe + 31 + 8) * 50) / 100) + 5) * 1.1) * 1.5);
    const targetStat = Math.floor(((2 * fastest + 31 + 8) * 50 / 100) + 5) * 1.1;
    return stat > targetStat && p.spe < fastest && p.power >= 90;
  });

  if (scarfViable.length > 0) {
    discoveries.push({
      id: 'scarf-tech',
      category: 'archetype',
      title: 'Choice Scarf dominators',
      description: `With Scarf, these outspeed the entire meta: ${scarfViable.slice(0, 3).map(s => s.species).join(', ')}. In a meta without 130+ speed legends, Scarf on 80-100 speed Pokemon is devastating.`,
      pokemon: scarfViable.slice(0, 3).map(s => s.species),
      calcPokemon: scarfViable.slice(0, 3).map(s => s.species),
      reasoning: scarfViable.slice(0, 3).map(s => `${s.species}: ${s.spe} → Scarf outspeeds everything`),
      confidence: 80,
    });
  }

  // Trick Room: slowest powerhouses
  const slowPower = speedTiers.filter(p => p.spe <= 50 && p.power >= 100);
  if (slowPower.length >= 2) {
    discoveries.push({
      id: 'tr-threats',
      category: 'archetype',
      title: 'Trick Room terrors',
      description: `Under Trick Room, these become the fastest and hardest hitting: ${slowPower.slice(0, 3).map(s => `${s.species} (${s.spe} Spe, ${s.power} power)`).join(', ')}. With fewer fast legends to break TR, setup is easier.`,
      pokemon: slowPower.slice(0, 3).map(s => s.species),
      calcPokemon: slowPower.slice(0, 3).map(s => s.species),
      reasoning: [`${slowPower.length} viable TR abusers in the pool`, 'Fewer disruption threats means TR stays up longer'],
      confidence: 78,
    });
  }

  return discoveries;
}

// ─── 5. Mega Niche Fills ───────────────────────────────────────────
function findMegaNiches(): Discovery[] {
  return [
    {
      id: 'mega-kangaskhan',
      category: 'combo',
      title: 'Mega Kangaskhan fills Urshifu\'s niche',
      description: 'Parental Bond Fake Out + priority Sucker Punch provides the same immediate pressure Urshifu had. Power-Up Punch gives +2 Attack in one turn.',
      pokemon: ['Kangaskhan-Mega'],
      calcPokemon: ['Kangaskhan'],
      reasoning: ['Parental Bond doubles Power-Up Punch boosts', 'Fake Out + Sucker Punch priority control', 'No Urshifu competition for this role'],
      confidence: 82,
    },
    {
      id: 'mega-gengar',
      category: 'combo',
      title: 'Mega Gengar — uncounterable trapping',
      description: 'Shadow Tag prevents switching. In a meta with fewer U-turn/Volt Switch pivots, trapping is even more devastating. Will-O-Wisp + high SpA.',
      pokemon: ['Gengar-Mega'],
      calcPokemon: ['Gengar'],
      reasoning: ['Shadow Tag has no counter once active', 'Fewer pivot moves in Champions meta', 'Can trap and KO key threats one by one'],
      confidence: 85,
    },
    {
      id: 'mega-charizard-y',
      category: 'combo',
      title: 'Mega Charizard Y — uncontested sun',
      description: 'Drought + massive SpA with no weather competition from Raging Bolt or other legends. Solar Beam provides instant Grass coverage in sun.',
      pokemon: ['Charizard-Mega-Y'],
      calcPokemon: ['Charizard'],
      reasoning: ['Drought sets sun automatically', 'No legendary sun competition', 'Solar Beam has no charge in sun'],
      confidence: 80,
    },
    {
      id: 'mega-gyarados',
      category: 'combo',
      title: 'Mega Gyarados — Intimidate into Mold Breaker sweep',
      description: 'Pre-Mega Intimidate drops Attack, then Mega Evolution gives Mold Breaker + Dragon Dance. No Landorus competing for this niche.',
      pokemon: ['Gyarados-Mega'],
      calcPokemon: ['Gyarados'],
      reasoning: ['Intimidate before Mega, Mold Breaker after', 'Dragon Dance setup into sweep', 'Water/Dark coverage hits most of the meta'],
      confidence: 78,
    },
    {
      id: 'mega-lopunny',
      category: 'combo',
      title: 'Mega Lopunny — Scrappy Fighting',
      description: 'Scrappy Close Combat hits Ghost-types that would normally be immune to Fighting. With no Urshifu, this is the fastest Fighting priority in the meta.',
      pokemon: ['Lopunny-Mega'],
      calcPokemon: ['Lopunny'],
      reasoning: ['Scrappy ignores Ghost immunity', 'Fake Out + Close Combat combo', '135 base Speed outspeeds most threats'],
      confidence: 76,
    },
  ];
}

// ─── 6. Weather/Terrain Advantages ─────────────────────────────────
function findWeatherAdvantages(): Discovery[] {
  const discoveries: Discovery[] = [];
  const pool = getAvailablePokemon();

  const weatherSetters: Record<string, string[]> = { Sun: [], Rain: [], Sand: [], Snow: [] };
  const abilityToWeather: Record<string, string> = {
    'Drought': 'Sun', 'Drizzle': 'Rain', 'Sand Stream': 'Sand', 'Snow Warning': 'Snow',
  };

  for (const name of pool) {
    const data = getPokemonData(name);
    if (!data) continue;
    const ability = (data.abilities?.[0] || '') as string;
    const weather = abilityToWeather[ability];
    if (weather) weatherSetters[weather].push(name);
  }

  // Pull tournament archetype frequency to weight which weathers are
  // actually winning. Pikalytics tags "sun"/"rain"/"sand"/"snow" per team.
  const archetypePercents: Record<string, number> = {};
  for (const a of getArchetypeUsage()) archetypePercents[a.archetype] = a.percent;

  for (const [weather, setters] of Object.entries(weatherSetters)) {
    if (setters.length <= 2 && setters.length > 0) {
      const tag = weather.toLowerCase();
      const tournamentPercent = archetypePercents[tag] || 0;
      const reasoning = [
        `${setters.length} setter(s) — opponents can't easily overwrite`,
        tournamentPercent > 0
          ? `${tournamentPercent}% of top tournament teams use ${weather}`
          : 'Underexplored archetype — surprise factor',
      ];
      // High tournament adoption = proven; low = sleeper opportunity
      const baseConfidence = tournamentPercent >= 20 ? 85 : tournamentPercent >= 10 ? 78 : 70;
      discoveries.push({
        id: `weather-${tag}`,
        category: 'archetype',
        title: tournamentPercent >= 15
          ? `${weather} — top tournament archetype`
          : `${weather} teams have less competition`,
        description: tournamentPercent >= 15
          ? `${tournamentPercent}% of top tournament teams run ${weather}. Setters: ${setters.join(', ')}.`
          : `Only ${setters.length} Pokemon set ${weather}: ${setters.join(', ')}. Underexplored at the tournament level.`,
        pokemon: setters.slice(0, 2),
        calcPokemon: setters.slice(0, 2),
        reasoning,
        confidence: baseConfidence,
      });
    }
  }

  return discoveries;
}

// ─── 7. Tournament-Validated Cores ─────────────────────────────────
// Pure pikalytics-driven: surface the highest-usage Pokemon as proven
// must-prep threats. This is a direct counter to discovery engines that
// over-index on theoretical analysis and miss "what's actually winning".
function findTournamentTopPicks(): Discovery[] {
  const discoveries: Discovery[] = [];
  const top = getTopMeta(8);

  for (const species of top) {
    const usage = getMetaUsage(species);
    if (usage < 20) continue;  // S-tier threshold only
    const data = getPokemonData(species);
    if (!data) continue;

    discoveries.push({
      id: `top-pick-${species}`,
      category: 'threat',
      title: `${species} — ${usage.toFixed(0)}% of top teams`,
      description: `Tournament-proven core. Run by ${usage.toFixed(1)}% of top-200 Champions tournament teams. If your team can't handle it, you'll lose to the field.`,
      pokemon: [species],
      calcPokemon: [species],
      reasoning: [
        `${usage.toFixed(1)}% tournament usage`,
        `Base stats: ${data.baseStats.hp}/${data.baseStats.atk}/${data.baseStats.def}/${data.baseStats.spa}/${data.baseStats.spd}/${data.baseStats.spe}`,
        'Must-prep — opponents will bring it',
      ],
      confidence: Math.min(98, 80 + Math.round(usage / 2)),
    });
  }

  return discoveries;
}

// ─── Main ──────────────────────────────────────────────────────────

export function discoverStrategies(): Discovery[] {
  const all: Discovery[] = [
    ...findTournamentTopPicks(),
    ...findMegaNiches(),
    ...findUncheckedThreats(),
    ...findUnkillableWalls(),
    ...findSpeedDominators(),
    ...findOffensiveCores(),
    ...findWeatherAdvantages(),
  ];

  // Dedupe by id, then by primary species — prefer the higher-confidence
  // discovery so a single Pokemon doesn't appear three times in the feed.
  const seen = new Set<string>();
  const speciesSeen = new Map<string, number>();  // species → best confidence so far

  for (const d of all) {
    const primary = d.pokemon[0];
    if (!primary) continue;
    const prev = speciesSeen.get(primary);
    if (prev === undefined || d.confidence > prev) speciesSeen.set(primary, d.confidence);
  }

  return all.filter(d => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    const primary = d.pokemon[0];
    // Allow multi-Pokemon discoveries (cores) through unconditionally
    if (!primary || d.pokemon.length > 1) return true;
    // Single-species: only keep the best discovery per species
    return d.confidence === speciesSeen.get(primary);
  })
    .sort((a, b) => {
      // Boost meta-validated picks within equal confidence buckets
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      const aUsage = a.pokemon[0] ? getMetaUsage(a.pokemon[0]) : 0;
      const bUsage = b.pokemon[0] ? getMetaUsage(b.pokemon[0]) : 0;
      return bUsage - aUsage;
    });
}
