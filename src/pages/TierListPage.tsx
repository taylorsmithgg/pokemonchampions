import { useState, useMemo } from 'react';
import { getSpriteUrl, getSpriteFallbackUrl } from '../utils/sprites';
import { Link } from 'react-router-dom';
import {
  NORMAL_TIER_LIST,
  MEGA_TIER_LIST,
  TIER_DEFINITIONS,
  type TierEntry,
  type Tier,
} from '../data/tierlist';
import { TYPE_COLORS, STAT_IDS, STAT_LABELS, STAT_COLORS, getPokemonData, getAvailableItems, getPokemonGeneration, GENERATION_META } from '../data/champions';
import { useLiveData } from '../hooks/useLiveData';
import { suggestSpreads } from '../calc/spOptimizer';
import { discoverStrategies, type Discovery } from '../calc/metaDiscovery';
import { MetaRadarPanel } from '../components/MetaRadarPanel';
import { MetaProjectionPanel } from '../components/MetaProjectionPanel';
import { ProjectedTierListPanel } from '../components/ProjectedTierListPanel';
import { FormatSelector } from '../components/FormatSelector';
import { SINGLES_FORMAT, type FormatId } from '../calc/lineupAnalysis';
import { QuickAdd } from '../components/QuickAdd';
import { GenBadge } from '../components/GenBadge';
import type { StatID } from '@smogon/calc';

function StatBar({ stat, value, max = 200 }: { stat: StatID; value: number; max?: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] text-slate-500 w-6">{STAT_LABELS[stat]}</span>
      <div className="flex-1 h-1.5 bg-poke-surface rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: STAT_COLORS[stat] }}
        />
      </div>
      <span className="text-[9px] text-slate-400 w-6 text-right font-mono">{value}</span>
    </div>
  );
}

function PokemonDetailCard({ entry, onClose }: { entry: TierEntry; onClose: () => void }) {
  const speciesName = entry.isMega ? entry.name.replace('Mega ', '') : entry.name;
  const data = getPokemonData(speciesName);
  const { stats: liveStats } = useLiveData();
  const liveData = liveStats?.pokemon?.[speciesName];
  const spreads = useMemo(() => suggestSpreads(speciesName, 50), [speciesName]);

  if (!data) return null;

  const topMoves = liveData ? Object.entries(liveData.moves).sort((a, b) => b[1] - a[1]).slice(0, 8) : [];
  const championsItemSet = new Set(getAvailableItems());
  const topItems = liveData ? Object.entries(liveData.items).filter(([n]) => championsItemSet.has(n)).sort((a, b) => b[1] - a[1]).slice(0, 5) : [];
  const topAbilities = liveData ? Object.entries(liveData.abilities).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
  const topTeammates = liveData ? Object.entries(liveData.teammates).sort((a, b) => b[1] - a[1]).slice(0, 8) : [];

  return (
    <div className="poke-panel">
      {/* Header */}
      <div className="poke-panel-header bg-gradient-to-r from-poke-red/10 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={getSpriteUrl(speciesName)}
              alt={entry.name}
              className="w-16 h-16 object-contain"
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                e.currentTarget.src = getSpriteFallbackUrl(speciesName);
              }}
            />
            <div>
              <h3 className="text-base font-bold text-white">{entry.name}</h3>
              <div className="flex gap-1 mt-1 flex-wrap">
                {entry.types.map((t: string) => (
                  <span key={t} className="text-[9px] px-2 py-0.5 rounded-full text-white font-bold" style={{ backgroundColor: TYPE_COLORS[t] || '#666' }}>{t}</span>
                ))}
                {entry.isMega && <span className="text-[9px] px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full font-bold">Mega</span>}
                <GenBadge species={speciesName} variant="both" />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Base Stats */}
        <div>
          <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Base Stats ({Object.values(data.baseStats).reduce((a: number, b: number) => a + b, 0)} BST)</h4>
          <div className="space-y-1">
            {STAT_IDS.map((s: StatID) => <StatBar key={s} stat={s} value={data.baseStats[s]} />)}
          </div>
        </div>

        {/* Roles & Strategy */}
        <div>
          <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Roles</h4>
          <div className="flex flex-wrap gap-1 mb-2">
            {entry.roles.map((r: string) => (
              <span key={r} className="text-[9px] px-2 py-0.5 bg-poke-surface text-slate-300 rounded-full border border-poke-border">{r}</span>
            ))}
          </div>
          {entry.note && <p className="text-[10px] text-slate-400 leading-relaxed">{entry.note}</p>}
        </div>

        {/* Held Items — from live data */}
        {topItems.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-poke-gold uppercase tracking-wider mb-2">Optimal Held Items</h4>
            <div className="space-y-1.5">
              {topItems.map(([name, usage], i) => (
                <div key={name} className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold w-4 ${i === 0 ? 'text-poke-gold' : 'text-slate-500'}`}>{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-[11px] ${i === 0 ? 'text-white font-semibold' : 'text-slate-300'}`}>{name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{(usage * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1 bg-poke-surface rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${i === 0 ? 'bg-poke-gold' : 'bg-slate-600'}`} style={{ width: `${usage * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Moves — from live data */}
        {topMoves.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Move Usage</h4>
            <div className="grid grid-cols-2 gap-1.5">
              {topMoves.map(([name, usage]) => (
                <div key={name} className="flex items-center justify-between px-2 py-1 bg-poke-surface rounded border border-poke-border">
                  <span className="text-[10px] text-slate-300 truncate">{name}</span>
                  <span className="text-[9px] text-slate-500 font-mono ml-1">{(usage * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Abilities */}
        {topAbilities.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Abilities</h4>
            {topAbilities.map(([name, usage]) => (
              <div key={name} className="text-[10px] text-slate-400">{name} <span className="text-slate-600">{(usage * 100).toFixed(0)}%</span></div>
            ))}
          </div>
        )}

        {/* Optimal Spreads */}
        {spreads.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Optimal SP Spreads</h4>
            <div className="space-y-1.5">
              {spreads.slice(0, 3).map((s, i) => (
                <div key={i} className="p-2 bg-poke-surface rounded-lg border border-poke-border">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-semibold text-white">{s.name}</span>
                    <span className="text-[9px] text-poke-gold">{s.nature}</span>
                  </div>
                  <div className="text-[9px] font-mono text-amber-400/70">
                    {Object.entries(s.sps).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${STAT_LABELS[k as StatID]}`).join(' / ')}
                  </div>
                  <div className="text-[9px] text-slate-600 mt-0.5">{s.rationale[0]}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Teammates — from live data */}
        {topTeammates.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Top Teammates</h4>
            <div className="flex flex-wrap gap-1.5">
              {topTeammates.map(([name, usage]) => {
                return (
                  <div key={name} className="flex items-center gap-1 px-2 py-1 bg-poke-surface rounded-lg border border-poke-border">
                    <img src={getSpriteUrl(name)} alt="" className="w-5 h-5 object-contain" loading="lazy" onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }} />
                    <span className="text-[9px] text-slate-300">{name}</span>
                    <span className="text-[8px] text-slate-600">{(usage * 100).toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="pt-3 border-t border-poke-border flex justify-center">
          <QuickAdd species={speciesName} variant="full" />
        </div>
      </div>
    </div>
  );
}

function TierCard({ entry, onClick }: { entry: TierEntry; onClick: () => void }) {
  const speciesName = entry.isMega ? entry.name.replace('Mega ', '') : entry.name;
  const data = getPokemonData(speciesName);
  const { stats: liveStats } = useLiveData();
  const liveData = liveStats?.pokemon?.[speciesName];
  const champItemSet = new Set(getAvailableItems());
  const topItem = liveData ? Object.entries(liveData.items).filter(([n]) => champItemSet.has(n)).sort((a, b) => b[1] - a[1])[0] : null;

  return (
    <div
      className="poke-panel cursor-pointer hover:border-poke-red/30 transition-all group"
      onClick={onClick}
    >
      <div className="p-3 flex items-center gap-3">
        {/* Large sprite */}
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <img
            src={getSpriteUrl(speciesName)}
            alt={entry.name}
            className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              e.currentTarget.src = getSpriteFallbackUrl(speciesName);
            }}
            loading="lazy"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-sm font-bold text-white group-hover:text-poke-red-light transition-colors">{entry.name}</span>
            {entry.isMega && <span className="text-[8px] px-1 py-0 bg-purple-500/20 text-purple-400 rounded font-bold">M</span>}
            <GenBadge species={speciesName} />
          </div>
          <div className="flex gap-1 mb-1.5">
            {entry.types.map((t: string) => (
              <span key={t} className="text-[8px] px-1.5 py-0.5 rounded-full text-white font-bold" style={{ backgroundColor: TYPE_COLORS[t] || '#666' }}>{t}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {entry.roles.map((r: string) => (
              <span key={r} className="text-[8px] px-1 py-0 bg-poke-surface text-slate-500 rounded">{r}</span>
            ))}
          </div>
        </div>

        {/* Right side: item + stats peek */}
        <div className="shrink-0 text-right space-y-1">
          {topItem && (
            <div className="text-[9px] text-poke-gold flex items-center gap-1 justify-end">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              {topItem[0]}
            </div>
          )}
          {data && (
            <div className="text-[9px] text-slate-600 font-mono">
              {data.baseStats.atk > data.baseStats.spa
                ? `${data.baseStats.atk} Atk / ${data.baseStats.spe} Spe`
                : `${data.baseStats.spa} SpA / ${data.baseStats.spe} Spe`}
            </div>
          )}
          {liveData && (
            <div className="text-[8px] text-slate-600">
              {(liveData.usage.weighted * 100).toFixed(1)}% usage
            </div>
          )}
        </div>
      </div>

      {/* Quick add actions */}
      <div className="px-3 pb-2 pt-0 flex justify-end">
        <QuickAdd species={speciesName} />
      </div>

      {/* Note tooltip on hover */}
      {entry.note && (
        <div className="px-3 pb-2 pt-0 hidden group-hover:block">
          <p className="text-[9px] text-slate-500 leading-relaxed border-t border-poke-border pt-2">{entry.note}</p>
        </div>
      )}
    </div>
  );
}

const DISCOVERY_CATEGORY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  core: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Core' },
  threat: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Threat' },
  counter: { color: 'text-sky-400', bg: 'bg-sky-500/10', label: 'Counter' },
  archetype: { color: 'text-violet-400', bg: 'bg-violet-500/10', label: 'Strategy' },
  underrated: { color: 'text-poke-gold', bg: 'bg-poke-gold/10', label: 'Sleeper' },
  combo: { color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Combo' },
};

function MetaDiscoveriesSection() {
  const [expanded, setExpanded] = useState(false);
  const discoveries = useMemo(() => discoverStrategies(), []);

  if (discoveries.length === 0) return null;

  const shown = expanded ? discoveries.slice(0, 12) : discoveries.slice(0, 4);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white">Champions Meta Insights</h2>
          <p className="text-xs text-slate-500">Strategies unique to this metagame — discovered algorithmically</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs px-3 py-1.5 bg-poke-surface border border-poke-border text-slate-400 rounded-lg hover:text-white transition-colors"
        >
          {expanded ? 'Show Less' : `Show All (${discoveries.length})`}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {shown.map((d: Discovery) => {
          const style = DISCOVERY_CATEGORY_STYLES[d.category] || DISCOVERY_CATEGORY_STYLES.core;
          return (
            <div key={d.id} className="poke-panel p-4">
              <div className="flex items-start gap-3">
                <div className="flex -space-x-2 shrink-0">
                  {d.pokemon.slice(0, 2).map(species => (
                    <img key={species} src={getSpriteUrl(species)} alt={species} className="w-12 h-12 object-contain" loading="lazy" />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${style.bg} ${style.color} font-bold`}>{style.label}</span>
                    <span className="text-xs text-slate-500">{d.confidence}%</span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">{d.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-2">{d.description}</p>
                  <div className="space-y-1">
                    {d.pokemon.map((species, idx) => {
                      const calcName = (d as any).calcPokemon?.[idx] || species.replace(/-Mega.*$/, '');
                      return (
                        <div key={species} className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 flex-1 truncate">{species}</span>
                          <QuickAdd species={calcName} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TierListPage() {
  const [view, setView] = useState<'tiers' | 'projection' | 'radar' | 'static'>('tiers');
  // Default the tier list view to Singles — that's the ladder most
  // players queue into first. Doubles is one click away.
  const [format, setFormat] = useState<FormatId>(SINGLES_FORMAT.id);
  const [listType, setListType] = useState<'normal' | 'mega'>('normal');
  const [filterTier, setFilterTier] = useState<Tier | 'all'>('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterGens, setFilterGens] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<TierEntry | null>(null);

  const toggleGen = (gen: number) => {
    setFilterGens(prev => {
      const next = new Set(prev);
      if (next.has(gen)) next.delete(gen);
      else next.add(gen);
      return next;
    });
  };

  const list = listType === 'mega' ? MEGA_TIER_LIST : NORMAL_TIER_LIST;

  const allRoles = useMemo(() => {
    const roles = new Set<string>();
    list.forEach(e => e.roles.forEach(r => roles.add(r)));
    return Array.from(roles).sort();
  }, [list]);

  const allTypes = useMemo(() => {
    const types = new Set<string>();
    list.forEach(e => e.types.forEach(t => types.add(t)));
    return Array.from(types).sort();
  }, [list]);

  const filtered = useMemo(() => {
    let results = list;
    if (filterTier !== 'all') results = results.filter(e => e.tier === filterTier);
    if (filterRole !== 'all') results = results.filter(e => e.roles.includes(filterRole));
    if (filterType !== 'all') results = results.filter(e => e.types.includes(filterType as any));
    if (filterGens.size > 0) {
      results = results.filter(e => {
        const speciesName = e.isMega ? e.name.replace('Mega ', '').replace(/ [XY]$/, '') : e.name;
        const gen = getPokemonGeneration(speciesName);
        return gen !== undefined && filterGens.has(gen);
      });
    }
    if (search) {
      const lower = search.toLowerCase();
      results = results.filter(e => e.name.toLowerCase().includes(lower) || e.note?.toLowerCase().includes(lower));
    }
    return results;
  }, [list, filterTier, filterRole, filterType, filterGens, search]);

  const groupedByTier = useMemo(() => {
    return TIER_DEFINITIONS.map(tierDef => ({
      ...tierDef,
      entries: filtered.filter(e => e.tier === tierDef.tier),
    })).filter(g => g.entries.length > 0);
  }, [filtered]);

  return (
    <div className="min-h-screen bg-poke-darkest text-white relative z-10">
      <header className="border-b border-poke-border bg-gradient-to-r from-poke-darker via-poke-dark to-poke-darker sticky top-0 z-40">
        <div className="h-[3px] bg-gradient-to-r from-transparent via-poke-red to-transparent" />
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full border-2 border-white/80 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[45%] bg-poke-red" />
                <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-white/90" />
                <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-poke-border-light -translate-y-1/2" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border border-poke-border-light bg-poke-dark" />
              </div>
              <h1 className="text-lg font-bold"><span className="text-poke-red">Champions</span> Calc</h1>
            </Link>
          </div>
          <Link to="/" className="text-xs px-3 py-1.5 rounded-lg bg-poke-red/15 border border-poke-red/30 text-poke-red-light hover:bg-poke-red/25 transition-colors">
            Calculator
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        {/* Meta Discoveries */}
        <MetaDiscoveriesSection />

        {/* Format selector — drives both the projected tier list and
            the projection panel below. Singles vs Doubles meta is a
            context-defining switch. */}
        <div className="mb-4">
          <FormatSelector value={format} onChange={(f) => setFormat(f.id)} />
        </div>

        {/* View tabs — all views are now format-aware except the
            live Meta Radar (which still uses its own scoring) and
            the static consensus tier list (which is reference only). */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setView('tiers')}
            className={`text-sm px-4 py-2 rounded-lg border font-semibold transition-colors ${
              view === 'tiers' ? 'bg-poke-red/15 border-poke-red/40 text-poke-red-light' : 'bg-poke-surface border-poke-border text-slate-400 hover:text-white'
            }`}
          >
            Projected Tiers
            <span className="text-[9px] px-1.5 py-0 bg-poke-gold/20 text-poke-gold rounded-full font-bold ml-2 uppercase tracking-wider">
              Original
            </span>
          </button>
          <button
            onClick={() => setView('projection')}
            className={`text-sm px-4 py-2 rounded-lg border font-semibold transition-colors ${
              view === 'projection' ? 'bg-poke-red/15 border-poke-red/40 text-poke-red-light' : 'bg-poke-surface border-poke-border text-slate-400 hover:text-white'
            }`}
          >
            Deep Analysis
          </button>
          <button
            onClick={() => setView('radar')}
            className={`text-sm px-4 py-2 rounded-lg border font-semibold transition-colors ${
              view === 'radar' ? 'bg-poke-red/15 border-poke-red/40 text-poke-red-light' : 'bg-poke-surface border-poke-border text-slate-400 hover:text-white'
            }`}
          >
            Meta Radar (Live)
          </button>
          <button
            onClick={() => setView('static')}
            className={`text-sm px-4 py-2 rounded-lg border font-semibold transition-colors ${
              view === 'static' ? 'bg-poke-red/15 border-poke-red/40 text-poke-red-light' : 'bg-poke-surface border-poke-border text-slate-400 hover:text-white'
            }`}
          >
            Community Reference
          </button>
        </div>

        {/* Projected tier list — primary default view */}
        {view === 'tiers' && (
          <ProjectedTierListPanel format={format} />
        )}

        {/* Full projection panel — deeper analysis with cores,
            dark horses, role leaders, per-mon breakdown bars */}
        {view === 'projection' && (
          <MetaProjectionPanel format={format} />
        )}

        {/* Meta Radar View */}
        {view === 'radar' && (
          <MetaRadarPanel />
        )}

        {/* Static Tier List View */}
        {view === 'static' && (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white mb-1">VGC 2026 Tier List</h1>
              <p className="text-sm text-slate-500">Click any Pokemon for optimal sets, items, spreads, and teammates</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="flex gap-1">
                <button onClick={() => setListType('normal')} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${listType === 'normal' ? 'bg-poke-red/15 border-poke-red/40 text-poke-red-light' : 'bg-poke-surface border-poke-border text-slate-400'}`}>
                  Normal ({NORMAL_TIER_LIST.length})
                </button>
                <button onClick={() => setListType('mega')} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${listType === 'mega' ? 'bg-purple-500/15 border-purple-500/40 text-purple-400' : 'bg-poke-surface border-poke-border text-slate-400'}`}>
                  Mega ({MEGA_TIER_LIST.length})
                </button>
              </div>
              <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                className="bg-poke-surface border border-poke-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-poke-red/50 w-40" />
              <select value={filterTier} onChange={e => setFilterTier(e.target.value as any)} className="bg-poke-surface border border-poke-border rounded-lg text-xs text-white px-2 py-1.5">
                <option value="all">All Tiers</option>
                {TIER_DEFINITIONS.map(t => <option key={t.tier} value={t.tier}>{t.tier} Tier</option>)}
              </select>
              <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="bg-poke-surface border border-poke-border rounded-lg text-xs text-white px-2 py-1.5">
                <option value="all">All Roles</option>
                {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-poke-surface border border-poke-border rounded-lg text-xs text-white px-2 py-1.5">
                <option value="all">All Types</option>
                {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Generation filter pills — multi-select */}
            <div className="flex flex-wrap items-center gap-1.5 mb-4">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mr-1">Gen</span>
              {GENERATION_META.map(meta => {
                const isActive = filterGens.has(meta.gen);
                return (
                  <button
                    key={meta.gen}
                    onClick={() => toggleGen(meta.gen)}
                    className={`text-[10px] font-bold px-2 py-1 rounded border transition-colors ${
                      isActive
                        ? `${meta.color} ${meta.bgColor} ${meta.borderColor}`
                        : 'bg-poke-surface border-poke-border text-slate-500 hover:text-white'
                    }`}
                    title={`Filter to Gen ${meta.gen} — ${meta.region}`}
                  >
                    {meta.shortLabel} · {meta.region}
                  </button>
                );
              })}
              {filterGens.size > 0 && (
                <button
                  onClick={() => setFilterGens(new Set())}
                  className="text-[10px] text-slate-500 hover:text-white px-2 py-1 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Tier groups */}
            {groupedByTier.map(group => (
              <div key={group.tier} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-lg font-black ${group.color}`}>{group.tier}</span>
                  <span className="text-xs text-slate-600">{group.description}</span>
                  <span className="text-[10px] text-slate-700">({group.entries.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {group.entries.map((entry: TierEntry) => (
                    <TierCard key={entry.name} entry={entry} onClick={() => setSelectedEntry(entry)} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Detail panel (sticky sidebar) */}
          {selectedEntry && (
            <div className="lg:w-[380px] lg:sticky lg:top-20 lg:self-start">
              <PokemonDetailCard entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
            </div>
          )}
        </div>
        )}
      </main>
    </div>
  );
}
