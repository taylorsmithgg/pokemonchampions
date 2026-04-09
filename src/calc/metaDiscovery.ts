// Meta Discovery Engine
// Finds underexplored strategies unique to the Champions metagame
// by analyzing the roster algorithmically — not derivative of Smogon data

import { getAvailablePokemon, getPokemonData, getTypeEffectiveness} from '../data/champions';
import { NORMAL_TIER_LIST } from '../data/tierlist';
import { PRESETS } from '../data/presets';



// ─── Types ──────────────────────────────────────────────────────────

export interface Discovery {
  id: string;
  category: 'core' | 'threat' | 'counter' | 'archetype' | 'underrated' | 'combo';
  title: string;
  description: string;
  pokemon: string[];
  reasoning: string[];
  confidence: number; // 0-100
}

// ─── 1. Find Unresisted Offensive Cores ─────────────────────────────
// Two Pokemon whose combined STAB types hit the entire Champions pool SE

function findUnresistedCores(): Discovery[] {
  const discoveries: Discovery[] = [];
  const pool = getAvailablePokemon().filter(n => !n.includes('-') || n.includes('-Alola') || n.includes('-Galar') || n.includes('-Wash') || n.includes('-Heat'));
  const viable = pool.filter(n => NORMAL_TIER_LIST.some(e => e.name === n) || PRESETS.some(p => p.species === n));

  // Analyze each pair of viable Pokemon
  for (let i = 0; i < viable.length; i++) {
    const a = getPokemonData(viable[i]);
    if (!a) continue;
    for (let j = i + 1; j < viable.length; j++) {
      const b = getPokemonData(viable[j]);
      if (!b) continue;

      // Combined STAB types
      const combinedTypes = new Set([...a.types, ...b.types]);

      // How many Pokemon in the pool can they NOT hit SE?
      let unresisted = 0;
      let total = 0;
      for (const target of pool.slice(0, 100)) {
        const tData = getPokemonData(target);
        if (!tData) continue;
        total++;
        let canHit = false;
        for (const atkType of combinedTypes) {
          let mult = 1;
          for (const defType of tData.types) mult *= getTypeEffectiveness(atkType as string, defType as string);
          if (mult > 1) { canHit = true; break; }
        }
        if (!canHit) unresisted++;
      }

      const coverage = ((total - unresisted) / total) * 100;
      if (coverage >= 85) {
        discoveries.push({
          id: `core-${viable[i]}-${viable[j]}`,
          category: 'core',
          title: `${viable[i]} + ${viable[j]} offensive core`,
          description: `Combined ${[...combinedTypes].join('/')} STAB hits ${coverage.toFixed(0)}% of the Champions roster super-effectively. Only ${unresisted} Pokemon resist both.`,
          pokemon: [viable[i], viable[j]],
          reasoning: [
            `${[...combinedTypes].join('/')} type coverage`,
            `${coverage.toFixed(0)}% super-effective coverage`,
            `${unresisted} Pokemon in the pool can wall this core`,
          ],
          confidence: Math.min(95, Math.round(coverage)),
        });
      }
    }
  }

  discoveries.sort((a, b) => b.confidence - a.confidence);
  return discoveries.slice(0, 10);
}

// ─── 2. Find Unchecked Threats ──────────────────────────────────────
// Pokemon that have very few counters in the Champions pool

function findUncheckedThreats(): Discovery[] {
  const discoveries: Discovery[] = [];
  const pool = getAvailablePokemon().filter(n => !n.includes('-') || n.includes('-Alola') || n.includes('-Galar') || n.includes('-Wash') || n.includes('-Heat'));

  for (const species of pool) {
    const data = getPokemonData(species);
    if (!data) continue;
    const bs = data.baseStats;
    if (bs.atk < 80 && bs.spa < 80) continue; // Skip non-threats

    const types = [...data.types] as string[];

    // Count how many Pokemon in the pool resist ALL of this Pokemon's STAB types
    let wallCount = 0;
    let checkCount = 0; // Can hit it SE
    for (const target of pool) {
      if (target === species) continue;
      const tData = getPokemonData(target);
      if (!tData) continue;
      const tTypes = [...tData.types] as string[];

      // Does target resist all our STABs?
      let resistsAll = true;
      for (const atkType of types) {
        let mult = 1;
        for (const defType of tTypes) mult *= getTypeEffectiveness(atkType, defType);
        if (mult >= 1) { resistsAll = false; break; }
      }
      if (resistsAll) wallCount++;

      // Can target hit us SE?
      for (const targetType of tTypes) {
        let mult = 1;
        for (const myType of types) mult *= getTypeEffectiveness(targetType, myType);
        if (mult > 1) { checkCount++; break; }
      }
    }

    // Low wall count + decent stats = unchecked threat
    if (wallCount <= 5 && (bs.atk >= 100 || bs.spa >= 100)) {
      const tier = NORMAL_TIER_LIST.find(e => e.name === species);
      // Bonus for Pokemon not already S/A+ tier — these are underrated threats
      const isUnderrated = !tier || tier.tier === 'B' || tier.tier === 'C';

      discoveries.push({
        id: `threat-${species}`,
        category: isUnderrated ? 'underrated' : 'threat',
        title: isUnderrated ? `${species} — underrated threat` : `${species} — hard to wall`,
        description: `Only ${wallCount} Pokemon in Champions resist ${types.join('/')} STAB. ${checkCount} can hit it back SE. ${isUnderrated ? 'Currently ranked low but has few answers.' : ''}`,
        pokemon: [species],
        reasoning: [
          `${types.join('/')} STAB walled by only ${wallCount} Pokemon`,
          `${bs.atk >= bs.spa ? bs.atk + ' Atk' : bs.spa + ' SpA'} — ${bs.spe} Spe`,
          isUnderrated ? `Currently ${tier?.tier || 'unranked'} — may be undervalued` : `${tier?.tier} tier — established threat`,
        ],
        confidence: Math.min(90, 90 - wallCount * 10 + (isUnderrated ? 10 : 0)),
      });
    }
  }

  discoveries.sort((a, b) => b.confidence - a.confidence);
  return discoveries.slice(0, 10);
}

// ─── 3. Find Speed Tier Gaps ────────────────────────────────────────
// With legendaries/paradox removed, which speed tiers are empty?

function findSpeedTierGaps(): Discovery[] {
  const discoveries: Discovery[] = [];
  const pool = getAvailablePokemon();

  // Build speed distribution
  const speedTiers: { species: string; spe: number; atk: number; spa: number }[] = [];
  for (const name of pool) {
    const data = getPokemonData(name);
    if (!data) continue;
    if (data.baseStats.atk < 70 && data.baseStats.spa < 70) continue;
    speedTiers.push({
      species: name,
      spe: data.baseStats.spe,
      atk: data.baseStats.atk,
      spa: data.baseStats.spa,
    });
  }
  speedTiers.sort((a, b) => b.spe - a.spe);

  // Find the fastest viable Pokemon
  const fastest = speedTiers.slice(0, 5);
  if (fastest.length > 0) {
    discoveries.push({
      id: 'speed-kings',
      category: 'archetype',
      title: 'Fastest threats in Champions',
      description: `Without Flutter Mane (135), Dragapult (142), or Meowscarada (123) dominating, the speed meta shifts. The fastest offensive Pokemon are now: ${fastest.map(f => `${f.species} (${f.spe})`).join(', ')}. Anything above ${fastest[2]?.spe || 100} outspeeds the meta with +Spe nature.`,
      pokemon: fastest.map(f => f.species),
      reasoning: fastest.map(f => `${f.species}: ${f.spe} base Spe, ${Math.max(f.atk, f.spa)} offensive`),
      confidence: 85,
    });
  }

  // Find Pokemon that newly outspeed everything with Choice Scarf
  // Scarf = 1.5x speed. At Lv50 with 32 Spe SP and +Spe: stat * 1.5
  const scarfThreshold = fastest[0]?.spe || 130;
  const scarfViable = speedTiers.filter(p => {
    const scarfSpeed = Math.floor(Math.floor(((2 * p.spe + 31 + 8) * 50) / 100 + 5) * 1.1 * 1.5);
    return p.spe < scarfThreshold && scarfSpeed > Math.floor(((2 * scarfThreshold + 31 + 8) * 50) / 100 + 5) * 1.1;
  }).filter(p => p.atk >= 90 || p.spa >= 90);

  if (scarfViable.length > 0) {
    discoveries.push({
      id: 'scarf-sweepers',
      category: 'archetype',
      title: 'Choice Scarf dominators',
      description: `These Pokemon become the fastest in the game with Choice Scarf: ${scarfViable.slice(0, 4).map(s => s.species).join(', ')}. With the top speedsters removed from Champions, Scarf users control the speed game.`,
      pokemon: scarfViable.slice(0, 4).map(s => s.species),
      reasoning: scarfViable.slice(0, 4).map(s => `${s.species}: ${s.spe} base → Scarf outspeeds everything`),
      confidence: 80,
    });
  }

  return discoveries;
}

// ─── 4. Find Mega Evolution Advantages ──────────────────────────────
// Which Megas are uniquely powerful in Champions (no legendary competition)?

function findMegaAdvantages(): Discovery[] {
  const discoveries: Discovery[] = [];

  // Megas that fill roles previously held by banned legendaries
  // species = actual species name for sprite/data lookup
  const megaRoleFills: { mega: string; species: string; replaces: string; role: string; why: string }[] = [
    { mega: 'Mega Kangaskhan', species: 'Kangaskhan-Mega', replaces: 'Urshifu', role: 'Physical priority attacker', why: 'Parental Bond Fake Out + Sucker Punch fills Urshifu\'s immediate pressure role' },
    { mega: 'Mega Gengar', species: 'Gengar-Mega', replaces: 'Flutter Mane', role: 'Fast special Ghost', why: 'Shadow Tag trapping + high SpA replaces Flutter Mane\'s offensive Ghost presence' },
    { mega: 'Mega Charizard Y', species: 'Charizard-Mega-Y', replaces: 'Raging Bolt + Sun', role: 'Weather-boosted special attacker', why: 'Drought + huge SpA fills the sun attacker role with no competition' },
    { mega: 'Mega Lopunny', species: 'Lopunny-Mega', replaces: 'Urshifu-Rapid-Strike', role: 'Fast Fighting sweeper', why: 'Scrappy Close Combat hits everything including Ghosts — unique in Champions' },
    { mega: 'Mega Gyarados', species: 'Gyarados-Mega', replaces: 'Landorus', role: 'Intimidate + physical sweeper', why: 'Pre-Mega Intimidate into Mold Breaker DD sweeper — no Lando competition' },
  ];

  for (const fill of megaRoleFills) {
    discoveries.push({
      id: `mega-${fill.mega.replace(/\s/g, '')}`,
      category: 'combo',
      title: `${fill.mega} fills ${fill.replaces}'s niche`,
      description: fill.why,
      pokemon: [fill.species],
      reasoning: [
        `Replaces: ${fill.replaces} (banned in Champions)`,
        `Role: ${fill.role}`,
        fill.why,
      ],
      confidence: 75,
    });
  }

  return discoveries;
}

// ─── 5. Find Ability-Based Combos ───────────────────────────────────
// Abilities that are stronger in Champions because their counters are gone

function findAbilityCombos(): Discovery[] {
  const discoveries: Discovery[] = [];
  const pool = getAvailablePokemon();

  // Count Intimidate users in pool
  const intimidateUsers: string[] = [];
  const weatherSetters: Record<string, string[]> = { Sun: [], Rain: [], Sand: [], Snow: [] };

  for (const name of pool) {
    const data = getPokemonData(name);
    if (!data) continue;
    const ability = (data.abilities?.[0] || '') as string;
    if (ability === 'Intimidate') intimidateUsers.push(name);
    if (ability === 'Drought') weatherSetters.Sun.push(name);
    if (ability === 'Drizzle') weatherSetters.Rain.push(name);
    if (ability === 'Sand Stream') weatherSetters.Sand.push(name);
    if (ability === 'Snow Warning') weatherSetters.Snow.push(name);
  }

  // Identify which weather is least contested
  for (const [weather, setters] of Object.entries(weatherSetters)) {
    if (setters.length <= 2) {
      discoveries.push({
        id: `weather-${weather}`,
        category: 'archetype',
        title: `${weather} is undercontested`,
        description: `Only ${setters.length} Pokemon set ${weather} in Champions: ${setters.join(', ')}. With fewer weather wars, ${weather} teams can dominate unchallenged.`,
        pokemon: setters,
        reasoning: [
          `${setters.length} setter(s) — low competition for weather control`,
          `Fewer weather overwrite threats than in VGC 2026`,
        ],
        confidence: 70,
      });
    }
  }

  return discoveries;
}

// ─── Main Discovery Function ────────────────────────────────────────

export function discoverStrategies(): Discovery[] {
  const all: Discovery[] = [
    ...findUncheckedThreats(),
    ...findUnresistedCores(),
    ...findSpeedTierGaps(),
    ...findMegaAdvantages(),
    ...findAbilityCombos(),
  ];

  // Deduplicate and sort by confidence
  const seen = new Set<string>();
  return all.filter(d => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  }).sort((a, b) => b.confidence - a.confidence);
}
