// ─── Projection-Derived Tier List ──────────────────────────────────
//
// Replaces the static community tier list with dynamically-generated
// rankings from our Doubles + Singles projection engines. Every
// Champions-legal Pokemon is scored, and the tier assignment is
// derived from the score — not from Game8 or community consensus.
//
// The static community list is kept as COMMUNITY_TIER_LIST for
// reference and dark-horse delta comparison, but the PRIMARY tier
// list surfaced to the UI is this one.

import { getAvailablePokemon, getPokemonData, hasChampionsMega } from './champions';
import { MEGA_STONE_MAP } from './championsRoster';
import { generateDoublesProjection } from '../calc/doublesMetaProjection';
import { generateSinglesProjection } from '../calc/singlesMetaProjection';
import type { Tier, TierEntry } from './tierlist';

// ─── Cached projection output ──────────────────────────────────────

let _projectedNormal: TierEntry[] | null = null;
let _projectedMega: TierEntry[] | null = null;

function ensureProjected() {
  if (_projectedNormal) return;

  const doublesReport = generateDoublesProjection();
  const singlesReport = generateSinglesProjection();

  // Build a score map: species → best score across both formats.
  // A Pokemon that's S-tier in Singles but B-tier in Doubles should
  // show its best tier, not the average.
  const scoreMap = new Map<string, { score: number; tier: Tier; roles: string[]; reasoning: string[] }>();

  for (const entry of doublesReport.rankings) {
    scoreMap.set(entry.species, {
      score: entry.score,
      tier: entry.tier,
      roles: [...entry.roles],
      reasoning: entry.reasoning,
    });
  }

  for (const entry of singlesReport.rankings) {
    const existing = scoreMap.get(entry.species);
    if (!existing || entry.score > existing.score) {
      // Merge roles from both formats
      const mergedRoles = existing
        ? [...new Set([...existing.roles, ...entry.roles])]
        : [...entry.roles];
      scoreMap.set(entry.species, {
        score: entry.score,
        tier: entry.tier,
        roles: mergedRoles.slice(0, 4),
        reasoning: entry.reasoning,
      });
    } else if (existing) {
      // Merge roles even if score isn't higher
      const mergedRoles = [...new Set([...existing.roles, ...entry.roles])];
      existing.roles = mergedRoles.slice(0, 4);
    }
  }

  const normalEntries: TierEntry[] = [];
  const megaEntries: TierEntry[] = [];

  for (const species of getAvailablePokemon()) {
    const data = getPokemonData(species);
    if (!data) continue;

    const projected = scoreMap.get(species);
    if (!projected) continue;

    const types = [...data.types] as [string] | [string, string];
    const isMega = hasChampionsMega(species);

    // Build a note from the top reasoning point
    const note = projected.reasoning[0] || '';

    const entry: TierEntry = {
      name: species,
      tier: projected.tier,
      roles: projected.roles,
      types,
      note,
    };

    // Megas get duplicated into the Mega list with their stone info
    if (isMega) {
      const stones = MEGA_STONE_MAP[species];
      if (stones) {
        for (const stone of stones) {
          megaEntries.push({
            ...entry,
            name: `Mega ${species}${stones.length > 1 ? ` ${stone.replace(/.*ite /, '')}` : ''}`,
            isMega: true,
            note: `${stone} · ${note}`,
          });
        }
      }
    }

    normalEntries.push(entry);
  }

  // Sort by score descending within each tier
  const tierOrder: Record<Tier, number> = { S: 0, 'A+': 1, A: 2, B: 3, C: 4 };
  normalEntries.sort((a, b) => (tierOrder[a.tier] ?? 5) - (tierOrder[b.tier] ?? 5));
  megaEntries.sort((a, b) => (tierOrder[a.tier] ?? 5) - (tierOrder[b.tier] ?? 5));

  _projectedNormal = normalEntries;
  _projectedMega = megaEntries;
}

/** Projection-derived tier list for normal Pokemon. */
export function getProjectedNormalTierList(): TierEntry[] {
  ensureProjected();
  return _projectedNormal!;
}

/** Projection-derived tier list for Mega Pokemon. */
export function getProjectedMegaTierList(): TierEntry[] {
  ensureProjected();
  return _projectedMega!;
}

/** Get the projected tier for a specific species. */
export function getProjectedTier(species: string): TierEntry | undefined {
  ensureProjected();
  return _projectedNormal!.find(e => e.name === species)
    || _projectedMega!.find(e => e.name === species);
}
