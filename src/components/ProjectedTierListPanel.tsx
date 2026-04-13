// ─── Projected Tier List ──────────────────────────────────────────
//
// Generates a tier list view directly from the projection engines
// (Doubles or Singles). Groups Pokemon by projected tier and shows
// delta indicators vs. the static community consensus tier list.
//
// This is the tier list view that actually reflects Champions-
// specific meta analysis — not a hand-curated Game8 import. When
// our projection disagrees with the static list, we show the
// disagreement explicitly so users can see why we think a pick is
// rising or falling.

import { useMemo, useState } from 'react';
import { generateDoublesProjection, type DoublesProjection } from '../calc/doublesMetaProjection';
import { generateSinglesProjection, type SinglesProjection } from '../calc/singlesMetaProjection';
import { NORMAL_TIER_LIST, MEGA_TIER_LIST, type Tier } from '../data/tierlist';
import type { FormatId } from '../calc/lineupAnalysis';
import { Sprite } from './Sprite';
import { QuickAdd } from './QuickAdd';
import { GenBadge } from './GenBadge';
import { RoleBadge } from './RoleBadge';

// ─── Types ─────────────────────────────────────────────────────────

type ProjectedTier = 'S' | 'A+' | 'A' | 'B' | 'C';

interface ProjectedTierEntry {
  species: string;
  score: number;
  projectedTier: ProjectedTier;
  staticTier?: Tier;
  /** Movement delta vs static: positive = rising, negative = falling. */
  delta: number;
  trend: 'rising' | 'falling' | 'stable' | 'new' | 'cut';
  roles: string[];
  topReason: string;
  hasMega: boolean;
  /** Type pair for the quick coverage check. */
  types: string[];
}

// Numeric tier ordering so we can compute deltas. Higher = stronger.
const TIER_RANK: Record<string, number> = {
  S: 5, 'A+': 4, A: 3, B: 2, C: 1,
};

const TIER_COLORS: Record<ProjectedTier, { text: string; bg: string; border: string; solid: string }> = {
  S:    { text: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/40',     solid: 'bg-red-500' },
  'A+': { text: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/40',  solid: 'bg-orange-500' },
  A:    { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/40',   solid: 'bg-amber-500' },
  B:    { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', solid: 'bg-emerald-500' },
  C:    { text: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/40',     solid: 'bg-sky-500' },
};

const TIER_DESCRIPTIONS: Record<ProjectedTier, string> = {
  S:    'Meta-defining — top projected scores, centerpiece of winning strategies',
  'A+': 'Core meta — slightly below S, strong in every matchup',
  A:    'Reliable picks — viable across multiple team builds',
  B:    'Situational — strong in the right matchup but can be countered',
  C:    'Niche — off-meta or specialized answer',
};

const TREND_ICONS: Record<ProjectedTierEntry['trend'], { icon: string; color: string; label: string }> = {
  rising:  { icon: '↑', color: 'text-emerald-400', label: 'Rising' },
  falling: { icon: '↓', color: 'text-red-400',     label: 'Falling' },
  stable:  { icon: '=', color: 'text-slate-500',   label: 'Stable' },
  new:     { icon: '★', color: 'text-poke-gold',   label: 'New' },
  cut:     { icon: '✕', color: 'text-slate-600',   label: 'Cut' },
};

// ─── Build projected entries from either engine ───────────────────

function buildEntries(format: FormatId): ProjectedTierEntry[] {
  // Run the correct projection engine
  const projections: Array<DoublesProjection | SinglesProjection> = format === 'doubles'
    ? generateDoublesProjection().rankings
    : generateSinglesProjection().rankings;

  // Build a lookup from the hand-curated static tier list. We accept
  // both base and mega entries — if a Pokemon's base form has a
  // static tier, we use it as the consensus baseline.
  const staticLookup = new Map<string, Tier>();
  for (const e of [...NORMAL_TIER_LIST, ...MEGA_TIER_LIST]) {
    const base = e.isMega ? e.name.replace('Mega ', '').replace(/ [XY]$/, '') : e.name;
    // Keep the highest static tier we've seen for each species (a
    // species might appear as both a normal and a mega entry).
    const existing = staticLookup.get(base);
    if (!existing || (TIER_RANK[e.tier] ?? 0) > (TIER_RANK[existing] ?? 0)) {
      staticLookup.set(base, e.tier);
    }
  }

  // Also keep a set of all static entries so we can detect "cut"
  // species (present in static but missing from projection).
  const projectedSet = new Set(projections.map(p => p.species));

  const entries: ProjectedTierEntry[] = projections.map(p => {
    const staticTier = staticLookup.get(p.species);
    const projectedRank = TIER_RANK[p.tier];
    const staticRank = staticTier ? TIER_RANK[staticTier] : 0;
    const delta = staticTier ? projectedRank - staticRank : 0;
    const trend: ProjectedTierEntry['trend'] =
      !staticTier ? 'new'
      : delta > 0 ? 'rising'
      : delta < 0 ? 'falling'
      : 'stable';

    // Fetch types via the tier-list entry or smogon data
    const staticEntry = NORMAL_TIER_LIST.find(e => e.name === p.species);
    const types = staticEntry ? [...staticEntry.types] : [];

    return {
      species: p.species,
      score: p.score,
      projectedTier: p.tier,
      staticTier,
      delta,
      trend,
      roles: p.roles,
      topReason: p.reasoning[0] ?? '',
      hasMega: p.hasMega,
      types,
    };
  });

  // Add "cut" entries — species in the static list that don't
  // appear in the projection at all. These are the community's
  // top picks that our engine thinks are overrated.
  for (const staticEntry of NORMAL_TIER_LIST) {
    if (staticEntry.isMega) continue;
    if (projectedSet.has(staticEntry.name)) continue;
    if (!['S', 'A+', 'A'].includes(staticEntry.tier)) continue;
    entries.push({
      species: staticEntry.name,
      score: 0,
      projectedTier: 'C',
      staticTier: staticEntry.tier,
      delta: 1 - TIER_RANK[staticEntry.tier],
      trend: 'cut',
      roles: staticEntry.roles,
      topReason: `Static tier list ranks ${staticEntry.tier} but our projection excludes it`,
      hasMega: false,
      types: [...staticEntry.types],
    });
  }

  return entries;
}

// ─── Row component ─────────────────────────────────────────────────

function TierRow({ entry }: { entry: ProjectedTierEntry }) {
  const tierStyle = TIER_COLORS[entry.projectedTier];
  const trendStyle = TREND_ICONS[entry.trend];

  // Fixed-width columns so every row lines up the same way —
  //   sprite | title+meta | tier pill | trend arrow | score | quickadd
  //
  // The title block wraps its own sub-rows (name line, role line)
  // but the right-side columns stay pinned at predictable widths,
  // which gives the whole tier list a table-like feel instead of
  // a jagged flex layout.
  return (
    <div
      className="grid items-center gap-1.5 sm:gap-2 p-2 rounded-lg border border-poke-border bg-poke-surface hover:border-poke-red/30 transition-colors"
      style={{ gridTemplateColumns: '40px minmax(0, 1fr) 32px 16px 28px auto' }}
    >
      {/* Sprite */}
      <Sprite species={entry.species} size="md" />

      {/* Name + meta block */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-white whitespace-nowrap">{entry.species}</span>
          <GenBadge species={entry.species} />
          {entry.hasMega && (
            <span className="text-[8px] px-1 py-0 bg-purple-500/20 text-purple-300 rounded font-bold whitespace-nowrap">M</span>
          )}
          {entry.staticTier && entry.staticTier !== entry.projectedTier && (
            <span
              className="text-[9px] text-slate-600 font-mono whitespace-nowrap"
              title={`Community consensus: ${entry.staticTier}`}
            >
              was {entry.staticTier}
            </span>
          )}
        </div>
        {entry.roles.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mt-0.5">
            {entry.roles.slice(0, 3).map(r => <RoleBadge key={r} role={r} />)}
          </div>
        )}
      </div>

      {/* Tier pill — fixed 36px column, centered */}
      <div
        className={`text-[11px] font-black h-5 flex items-center justify-center rounded border ${tierStyle.bg} ${tierStyle.border} ${tierStyle.text}`}
        title={`Projected tier: ${entry.projectedTier}`}
      >
        {entry.projectedTier}
      </div>

      {/* Trend arrow — fixed 20px column */}
      <div
        className={`text-sm font-bold text-center ${trendStyle.color}`}
        title={`${trendStyle.label}${entry.delta !== 0 ? ` (${entry.delta > 0 ? '+' : ''}${entry.delta} tiers)` : ''}`}
      >
        {trendStyle.icon}
      </div>

      {/* Score — fixed 32px column, right-aligned tabular */}
      <div className="text-[10px] text-slate-500 font-mono text-right tabular-nums">
        {entry.score > 0 ? entry.score : ''}
      </div>

      {/* Quick-add actions — consistent width per-row */}
      <div className="justify-self-end">
        {entry.trend !== 'cut' ? <QuickAdd species={entry.species} /> : <div className="w-[92px]" />}
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────

interface ProjectedTierListPanelProps {
  format: FormatId;
}

export function ProjectedTierListPanel({ format }: ProjectedTierListPanelProps) {
  const entries = useMemo(() => buildEntries(format), [format]);
  const [highlightTrend, setHighlightTrend] = useState<ProjectedTierEntry['trend'] | 'all'>('all');

  // Group by projected tier, preserving sort within each tier
  const byTier = useMemo(() => {
    const groups: Record<ProjectedTier, ProjectedTierEntry[]> = {
      S: [], 'A+': [], A: [], B: [], C: [],
    };
    for (const e of entries) groups[e.projectedTier].push(e);
    // Sort each tier by score descending
    (Object.keys(groups) as ProjectedTier[]).forEach(k => {
      groups[k].sort((a, b) => b.score - a.score);
    });
    return groups;
  }, [entries]);

  const filtered = useMemo(() => {
    if (highlightTrend === 'all') return byTier;
    const result: Record<ProjectedTier, ProjectedTierEntry[]> = {
      S: [], 'A+': [], A: [], B: [], C: [],
    };
    (Object.keys(byTier) as ProjectedTier[]).forEach(k => {
      result[k] = byTier[k].filter(e => e.trend === highlightTrend);
    });
    return result;
  }, [byTier, highlightTrend]);

  // Count trends for the filter pills
  const trendCounts = useMemo(() => {
    const counts: Record<ProjectedTierEntry['trend'], number> = {
      rising: 0, falling: 0, stable: 0, new: 0, cut: 0,
    };
    for (const e of entries) counts[e.trend]++;
    return counts;
  }, [entries]);

  const orderedTiers: ProjectedTier[] = ['S', 'A+', 'A', 'B', 'C'];

  return (
    <div className="space-y-4">
      {/* Header + methodology */}
      <div className="poke-panel">
        <div className="poke-panel-header bg-gradient-to-r from-poke-red/10 via-purple-500/5 to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
                Projected {format === 'doubles' ? 'Doubles' : 'Singles'} Tier List
                <span className="text-[9px] px-2 py-0.5 bg-poke-gold/15 text-poke-gold border border-poke-gold/30 rounded-full font-bold uppercase tracking-wider">
                  Derived Analysis
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Generated from the first-principles projection engine, grouped by tier. Arrows show where our
                projection disagrees with the static community tier list (↑ rising, ↓ falling, ★ new, ✕ cut).
              </p>
            </div>
          </div>
        </div>

        {/* Trend filter pills */}
        <div className="p-3 border-t border-poke-border flex flex-wrap gap-1.5">
          <TrendPill label="All" count={entries.length} active={highlightTrend === 'all'} onClick={() => setHighlightTrend('all')} />
          <TrendPill label="★ New" count={trendCounts.new} active={highlightTrend === 'new'} onClick={() => setHighlightTrend('new')} color="text-poke-gold" />
          <TrendPill label="↑ Rising" count={trendCounts.rising} active={highlightTrend === 'rising'} onClick={() => setHighlightTrend('rising')} color="text-emerald-400" />
          <TrendPill label="↓ Falling" count={trendCounts.falling} active={highlightTrend === 'falling'} onClick={() => setHighlightTrend('falling')} color="text-red-400" />
          <TrendPill label="= Stable" count={trendCounts.stable} active={highlightTrend === 'stable'} onClick={() => setHighlightTrend('stable')} color="text-slate-400" />
          {trendCounts.cut > 0 && (
            <TrendPill label="✕ Cut" count={trendCounts.cut} active={highlightTrend === 'cut'} onClick={() => setHighlightTrend('cut')} color="text-slate-500" />
          )}
        </div>
      </div>

      {/* Tier groups */}
      {orderedTiers.map(tier => {
        const group = filtered[tier];
        if (group.length === 0) return null;
        const style = TIER_COLORS[tier];
        return (
          <div key={tier} className="poke-panel">
            <div className="poke-panel-header flex items-center gap-3">
              {/* Tier letter — fixed-width badge keeps headers aligned
                  across groups regardless of 1/2/3-char tier labels */}
              <div
                className={`w-10 h-10 flex items-center justify-center rounded-lg border-2 ${style.bg} ${style.border}`}
              >
                <span className={`text-xl font-black leading-none ${style.text}`}>{tier}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white leading-tight">{tier} Tier</div>
                <div className="text-[10px] text-slate-500 leading-snug">{TIER_DESCRIPTIONS[tier]}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold text-slate-300 font-mono tabular-nums">{group.length}</div>
                <div className="text-[9px] text-slate-600 uppercase tracking-wider">picks</div>
              </div>
            </div>
            <div className="p-2 sm:p-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
              {group.map(entry => (
                <TierRow key={entry.species} entry={entry} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Methodology footer */}
      <div className="text-[10px] text-slate-600 p-3 border border-poke-border rounded-lg bg-poke-surface/50 leading-relaxed">
        <strong className="text-slate-500">How the tiers are computed:</strong> The projection engine scores
        every Champions-legal Pokemon on format-specific fundamentals plus a Champions adjustment factor
        (new Z-A Mega abilities, move nerfs, status condition nerfs, roster vacancies). Tier thresholds are
        S ≥ 80, A+ ≥ 66, A ≥ 50, B ≥ 35, C below. Movement indicators compare against the hand-curated
        community tier list — disagreements are our engine's bet against consensus.
      </div>
    </div>
  );
}

function TrendPill({
  label, count, active, onClick, color,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors whitespace-nowrap ${
        active
          ? 'bg-poke-red/15 border-poke-red/40 text-white'
          : 'bg-poke-surface border-poke-border text-slate-400 hover:text-white'
      }`}
    >
      <span className={color ?? ''}>{label}</span>
      <span className="text-[10px] text-slate-600 font-mono tabular-nums">{count}</span>
    </button>
  );
}
