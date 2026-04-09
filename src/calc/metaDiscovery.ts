// Meta Discovery Engine
// Deep algorithmic analysis of the Champions metagame
// Finds strategies that DON'T exist in VGC 2026 data


import { getAvailablePokemon, getPokemonData, getDefensiveMultiplier } from '../data/champions';
import { NORMAL_TIER_LIST, MEGA_TIER_LIST } from '../data/tierlist';
import { PRESETS } from '../data/presets';

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

// Helper: check if a Pokemon is competitively viable
function isViable(name: string): boolean {
  return NORMAL_TIER_LIST.some(e => e.name === name) ||
    MEGA_TIER_LIST.some(e => e.name === name) ||
    PRESETS.some(p => p.species === name);
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
        discoveries.push({
          id: `core-${viable[i]}-${viable[j]}`,
          category: 'core',
          title: `${viable[i]} + ${viable[j]}`,
          description: `${[...combinedTypes].join('/')} STAB covers ${coverage.toFixed(0)}% of the Champions meta super-effectively.`,
          pokemon: [viable[i], viable[j]],
          calcPokemon: [viable[i], viable[j]],
          reasoning: [`${coverage.toFixed(0)}% coverage`, `Only ${total - hitsSE} Pokemon resist both`],
          confidence: Math.min(95, Math.round(coverage)),
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
      const tier = NORMAL_TIER_LIST.find(e => e.name === species);
      const isUnderrated = !tier || tier.tier === 'B' || tier.tier === 'C';

      discoveries.push({
        id: `threat-${species}`,
        category: isUnderrated ? 'underrated' : 'threat',
        title: isUnderrated ? `Sleeper: ${species}` : `${species} — hard to wall`,
        description: `Only ${wallCount} Pokemon resist ${types.join('/')} STAB. ${data.baseStats.atk >= data.baseStats.spa ? data.baseStats.atk + ' Atk' : data.baseStats.spa + ' SpA'}, ${data.baseStats.spe} Speed.${isUnderrated ? ' Currently underranked.' : ''}`,
        pokemon: [species],
        calcPokemon: [species],
        reasoning: [
          `${types.join('/')} walled by only ${wallCount} Pokemon`,
          `${isUnderrated ? (tier?.tier || 'Unranked') + ' tier — fewer players running it' : 'Established meta threat'}`,
        ],
        confidence: Math.min(90, 85 - wallCount * 5 + (isUnderrated ? 10 : 0)),
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
      discoveries.push({
        id: `wall-${species}`,
        category: 'wall',
        title: `${species} — defensive fortress`,
        description: `${resistances} resistances, ${immunities} immunities, only ${weaknesses} weaknesses. ${survivalRate.toFixed(0)}% of meta attackers can't hit it SE. Bulk: ${bs.hp}/${bs.def}/${bs.spd}.`,
        pokemon: [species],
        calcPokemon: [species],
        reasoning: [
          `Only ${threatenedBy}/${metaThreats.length} attackers threaten it`,
          `${resistances + immunities} favorable type matchups`,
          `Recovery options make it extremely hard to break`,
        ],
        confidence: Math.min(90, Math.round(survivalRate * 0.9)),
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

  for (const [weather, setters] of Object.entries(weatherSetters)) {
    if (setters.length <= 2 && setters.length > 0) {
      discoveries.push({
        id: `weather-${weather.toLowerCase()}`,
        category: 'archetype',
        title: `${weather} teams have less competition`,
        description: `Only ${setters.length} Pokemon set ${weather}: ${setters.join(', ')}. Fewer weather wars means ${weather} stays up longer and is harder to counter.`,
        pokemon: setters.slice(0, 2),
        calcPokemon: setters.slice(0, 2),
        reasoning: [`${setters.length} setter(s) — opponents can't easily overwrite`, 'Build around weather with confidence'],
        confidence: 72,
      });
    }
  }

  return discoveries;
}

// ─── Main ──────────────────────────────────────────────────────────

export function discoverStrategies(): Discovery[] {
  const all: Discovery[] = [
    ...findMegaNiches(),
    ...findUncheckedThreats(),
    ...findUnkillableWalls(),
    ...findSpeedDominators(),
    ...findOffensiveCores(),
    ...findWeatherAdvantages(),
  ];

  const seen = new Set<string>();
  return all.filter(d => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  }).sort((a, b) => b.confidence - a.confidence);
}
