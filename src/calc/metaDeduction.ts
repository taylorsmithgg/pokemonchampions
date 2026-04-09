// Champions Meta Deduction Engine
// Derives what the Champions meta should look like by analyzing the
// available roster in context of what's removed (legendaries, paradox, UBs)
//
// Approach:
// 1. Take raw Smogon VGC usage data
// 2. Filter to Champions-legal Pokemon only
// 3. Analyze which Pokemon gain value when their predators/competition are removed
// 4. Factor in Mega Evolution access (unique to Champions)
// 5. Compute adjusted tier rankings

import { Generations } from '@smogon/calc';
import { getAvailablePokemon, getPokemonData } from '../data/champions';
import type { UsageStats } from '../data/liveData';

const gen9 = Generations.get(9);

// Type effectiveness used via gen9.types

function getEffectiveness(atkType: string, defType: string): number {
  const typeData = gen9.types.get(atkType.toLowerCase() as any);
  if (!typeData) return 1;
  return (typeData.effectiveness as any)[defType] ?? 1;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface DeducedTierEntry {
  species: string;
  rawUsage: number;           // from Smogon data (0-1, or 0 if not in data)
  adjustedScore: number;      // deduced Champions relevance (0-100)
  tier: 'S' | 'A+' | 'A' | 'B' | 'C';
  reasons: string[];          // why this Pokemon is ranked here
  gainedFrom: string[];       // threats removed that this Pokemon benefits from
  lostTo: string[];           // new threats in Champions (Megas etc)
  bestRole: string;
  hasMega: boolean;
}

// ─── Key Removed Threats ────────────────────────────────────────────
// Pokemon that dominated VGC 2026 but are banned in Champions
// This is what shapes the deduced meta

const REMOVED_THREATS: { name: string; role: string; types: string[] }[] = [
  { name: 'Flutter Mane', role: 'Special Sweeper', types: ['Ghost', 'Fairy'] },
  { name: 'Urshifu-Rapid-Strike', role: 'Physical Sweeper', types: ['Water', 'Fighting'] },
  { name: 'Raging Bolt', role: 'Special Tank', types: ['Electric', 'Dragon'] },
  { name: 'Tornadus', role: 'Tailwind Setter', types: ['Flying'] },
  { name: 'Ogerpon-Hearthflame', role: 'Physical Sweeper', types: ['Grass', 'Fire'] },
  { name: 'Ogerpon-Wellspring', role: 'Redirector', types: ['Grass', 'Water'] },
  { name: 'Chien-Pao', role: 'Physical Sweeper', types: ['Dark', 'Ice'] },
  { name: 'Landorus', role: 'Special Attacker', types: ['Ground', 'Flying'] },
  { name: 'Iron Hands', role: 'Bulk Attacker', types: ['Fighting', 'Electric'] },
  { name: 'Iron Crown', role: 'Special Sweeper', types: ['Steel', 'Psychic'] },
  { name: 'Chi-Yu', role: 'Special Sweeper', types: ['Dark', 'Fire'] },
  { name: 'Urshifu', role: 'Physical Sweeper', types: ['Water', 'Dark'] },
];

// ─── Deduction Logic ────────────────────────────────────────────────

export function deduceChampionsMeta(rawStats: UsageStats | null): DeducedTierEntry[] {
  const championsPool = getAvailablePokemon();
  const results: DeducedTierEntry[] = [];

  for (const species of championsPool) {
    const data = getPokemonData(species);
    if (!data) continue;

    const bs = data.baseStats;
    const bst = bs.hp + bs.atk + bs.def + bs.spa + bs.spd + bs.spe;
    const types = [...data.types] as string[];
    const reasons: string[] = [];
    const gainedFrom: string[] = [];
    const lostTo: string[] = [];

    // Base score from stats
    let score = 0;

    // 1. Raw BST contribution (normalized)
    score += Math.min(20, (bst - 400) / 10);

    // 2. Raw usage from Smogon (if available and legal in Champions)
    const rawUsage = rawStats?.pokemon?.[species]?.usage?.weighted || 0;
    if (rawUsage > 0) {
      score += rawUsage * 40; // Up to ~16 points for top usage
      reasons.push(`${(rawUsage * 100).toFixed(1)}% VGC usage (transferable skills/sets)`);
    }

    // 3. Threat removal analysis — does this Pokemon benefit from removed threats?
    for (const removed of REMOVED_THREATS) {
      // Did the removed threat check/counter this Pokemon?
      let wasChecked = false;
      for (const removedType of removed.types) {
        for (const myType of types) {
          if (getEffectiveness(removedType, myType) > 1) {
            wasChecked = true;
            break;
          }
        }
      }

      // Did this Pokemon previously compete with the removed threat for the same role?
      const isPhys = bs.atk > bs.spa;
      const sameRole = (removed.role.includes('Physical') && isPhys) ||
                       (removed.role.includes('Special') && !isPhys);

      if (wasChecked) {
        // This Pokemon was kept in check by the removed threat — it gains value
        score += 3;
        gainedFrom.push(`${removed.name} removed (no longer checked by ${removed.types.join('/')}-type pressure)`);
      }

      if (sameRole) {
        // Less competition for this role
        score += 2;
        if (gainedFrom.length < 3) {
          gainedFrom.push(`Fills ${removed.name}'s role as ${removed.role}`);
        }
      }

      // Does this Pokemon counter what the removed threat USED to counter?
      // If so, the Pokemon that were previously handled by the removed threat are now free,
      // making counters to THOSE Pokemon more valuable
      for (const myType of types) {
        for (const removedType of removed.types) {
          if (getEffectiveness(myType, removedType) > 1) {
            // We hit the removed threat SE — but it's gone, so this is less valuable
            score -= 1;
          }
        }
      }
    }

    // 4. Type coverage value — how many Champions-legal Pokemon does this threaten?
    let threatenCount = 0;
    let resistCount = 0;
    const samplePool = championsPool.slice(0, 100); // Sample for performance
    for (const targetName of samplePool) {
      const targetData = getPokemonData(targetName);
      if (!targetData || targetName === species) continue;
      const targetTypes = [...targetData.types] as string[];

      // Offensive coverage
      for (const myType of types) {
        let mult = 1;
        for (const tt of targetTypes) mult *= getEffectiveness(myType, tt);
        if (mult > 1) { threatenCount++; break; }
      }

      // Defensive resilience
      let isResistant = true;
      for (const targetType of targetTypes) {
        let mult = 1;
        for (const mt of types) mult *= getEffectiveness(targetType, mt);
        if (mult > 1) { isResistant = false; break; }
      }
      if (isResistant) resistCount++;
    }

    score += (threatenCount / samplePool.length) * 10; // offensive coverage bonus
    score += (resistCount / samplePool.length) * 5;    // defensive resilience bonus

    if (threatenCount > samplePool.length * 0.4) {
      reasons.push(`Threatens ${Math.round(threatenCount / samplePool.length * 100)}% of Champions roster with STAB`);
    }
    if (resistCount > samplePool.length * 0.3) {
      reasons.push(`Resists ${Math.round(resistCount / samplePool.length * 100)}% of Champions roster's STAB`);
    }

    // 5. Speed tier value — in a meta without Flutter Mane (135) and Dragapult (142),
    //    speed benchmarks shift
    if (bs.spe >= 120) {
      score += 5;
      reasons.push(`Elite speed tier (${bs.spe}) — fewer Pokemon outspeed in Champions`);
    } else if (bs.spe >= 100) {
      score += 3;
      reasons.push(`Strong speed tier (${bs.spe})`);
    }

    // 6. Key ability bonuses
    const ability = (data.abilities?.[0] || '') as string;
    const abilityLower = ability.toLowerCase();
    if (abilityLower === 'intimidate') { score += 8; reasons.push('Intimidate is even more valuable with fewer broken attackers'); }
    if (abilityLower === 'prankster') { score += 5; reasons.push('Prankster Tailwind fills Tornadus\'s removed role'); }
    if (abilityLower === 'regenerator') { score += 4; reasons.push('Regenerator sustain is premium in slower meta'); }
    if (abilityLower === 'good as gold') { score += 5; reasons.push('Status immunity blocks Spore/Will-O-Wisp meta'); }
    if (['drought', 'drizzle', 'sand stream', 'snow warning'].includes(abilityLower)) {
      score += 4;
      reasons.push(`Weather setting (${ability}) enables team archetypes`);
    }
    if (['grassy surge', 'electric surge', 'psychic surge', 'misty surge'].includes(abilityLower)) {
      score += 3;
      reasons.push(`Terrain setting (${ability})`);
    }

    // 7. Mega Evolution potential
    const hasMega = false; // Would check Mega data — placeholder for future

    // Determine role
    const bestRole = bs.atk > bs.spa + 20 ? 'Physical Attacker'
      : bs.spa > bs.atk + 20 ? 'Special Attacker'
      : bs.hp + bs.def + bs.spd > bs.atk + bs.spa + bs.spe ? 'Defensive'
      : 'Versatile';

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // Determine tier from score
    let tier: DeducedTierEntry['tier'];
    if (score >= 45) tier = 'S';
    else if (score >= 35) tier = 'A+';
    else if (score >= 25) tier = 'A';
    else if (score >= 15) tier = 'B';
    else tier = 'C';

    // Only include Pokemon with some relevance
    if (score < 8) continue;

    results.push({
      species,
      rawUsage,
      adjustedScore: Math.round(score),
      tier,
      reasons: reasons.slice(0, 4),
      gainedFrom: gainedFrom.slice(0, 3),
      lostTo,
      bestRole,
      hasMega,
    });
  }

  results.sort((a, b) => b.adjustedScore - a.adjustedScore);
  return results;
}

// ─── Quick access helpers ───────────────────────────────────────────

export function getDeducedTier(species: string, allEntries: DeducedTierEntry[]): DeducedTierEntry | undefined {
  return allEntries.find(e => e.species === species);
}

export function getDeducedTierLabel(species: string, allEntries: DeducedTierEntry[]): string {
  const entry = getDeducedTier(species, allEntries);
  return entry?.tier || '';
}
