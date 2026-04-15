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

import { getAvailablePokemon, getPokemonData, getTypeEffectiveness} from '../data/champions';
import type { UsageStats } from '../data/liveData';
import { getMetaUsage } from '../data/pikalyticsMeta';




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

    // 2a. Raw usage from Smogon VGC (if available and legal in Champions).
    // Lower weight — VGC is a different format; signal is "transferable",
    // not authoritative. Pikalytics tournament data below is ground truth.
    const rawUsage = rawStats?.pokemon?.[species]?.usage?.weighted || 0;
    if (rawUsage > 0) {
      score += rawUsage * 20;
      reasons.push(`${(rawUsage * 100).toFixed(1)}% VGC ladder usage (transferable signal)`);
    }

    // 2b. Pikalytics Champions tournament usage — direct evidence of
    // what's winning. Weighted heavily because the format matches.
    // Top picks (Sneasler 56%, Incineroar 54%) get up to ~28 points here.
    const metaUsage = getMetaUsage(species);
    if (metaUsage > 0) {
      score += Math.min(28, metaUsage * 0.5);
      reasons.push(`${metaUsage.toFixed(1)}% of top Champions tournament teams`);
    }

    // 3. Threat removal analysis — does this Pokemon benefit from removed threats?
    for (const removed of REMOVED_THREATS) {
      // Did the removed threat check/counter this Pokemon?
      let wasChecked = false;
      for (const removedType of removed.types) {
        for (const myType of types) {
          if (getTypeEffectiveness(removedType, myType) > 1) {
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
          if (getTypeEffectiveness(myType, removedType) > 1) {
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
        for (const tt of targetTypes) mult *= getTypeEffectiveness(myType, tt);
        if (mult > 1) { threatenCount++; break; }
      }

      // Defensive resilience
      let isResistant = true;
      for (const targetType of targetTypes) {
        let mult = 1;
        for (const mt of types) mult *= getTypeEffectiveness(targetType, mt);
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

    // Tournament-data tier floor — empirical results override theory.
    // If 30%+ of tournament teams run this, it's S regardless of what
    // the heuristic score says. Prevents the engine from underranking
    // proven picks (e.g. Sneasler when tier list lags behind results).
    if (metaUsage >= 30 && tier !== 'S') tier = 'S';
    else if (metaUsage >= 15 && tier !== 'S' && tier !== 'A+') tier = 'A+';
    else if (metaUsage >= 5 && tier === 'B') tier = 'A';
    else if (metaUsage >= 5 && tier === 'C') tier = 'A';

    // Tournament-confirmed picks always pass the relevance gate, even if
    // the theoretical score is low (e.g. Floette is a support pick that
    // doesn't score well on raw stats but appears in 26% of top teams).
    if (score < 8 && metaUsage < 5) continue;

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
