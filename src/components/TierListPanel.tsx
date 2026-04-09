import { useState, useMemo } from 'react';
import { getSpriteUrl, getSpriteFallbackUrl } from '../utils/sprites';
import {
  NORMAL_TIER_LIST,
  MEGA_TIER_LIST,
  TIER_DEFINITIONS,
  type TierEntry,
  type Tier,
} from '../data/tierlist';
import { TYPE_COLORS } from '../data/champions';
// Sprites loaded inline below

interface TierListPanelProps {
  onSelectPokemon: (name: string, side: 'attacker' | 'defender') => void;
  isOpen: boolean;
  onClose: () => void;
}

function MiniSprite({ species }: { species: string }) {
  const [useFallback, setUseFallback] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (hasError) return null;

  const src = useFallback
    ? getSpriteFallbackUrl(species)
    : getSpriteUrl(species);

  return (
    <img
      src={src}
      alt=""
      className="w-8 h-8 object-contain"
      onError={() => {
        if (!useFallback) setUseFallback(true);
        else setHasError(true);
      }}
      loading="lazy"
    />
  );
}

function PokemonCard({ entry, onSelect }: { entry: TierEntry; onSelect: (name: string, side: 'attacker' | 'defender') => void }) {
  const [hovered, setHovered] = useState(false);
  const tierDef = TIER_DEFINITIONS.find(d => d.tier === entry.tier);

  // Get base species name for sprite (strip "Mega " prefix)
  const spriteSpecies = entry.name.replace('Mega ', '').replace('-Mega', '');

  return (
    <div
      className={`relative group rounded-lg border transition-all cursor-pointer ${tierDef?.borderColor} ${tierDef?.bgColor} hover:scale-[1.02] hover:shadow-lg`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="p-2">
        <div className="flex items-center gap-2">
          <MiniSprite species={spriteSpecies} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white truncate">{entry.name}</span>
              {entry.isMega && (
                <span className="text-[8px] px-1 py-0 bg-purple-500/30 text-purple-400 rounded font-bold">M</span>
              )}
            </div>
            <div className="flex gap-0.5 mt-0.5">
              {entry.types.map(t => (
                <span
                  key={t}
                  className="text-[8px] px-1.5 rounded-full text-white font-bold"
                  style={{ backgroundColor: TYPE_COLORS[t] || '#666' }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Roles */}
        <div className="flex flex-wrap gap-0.5 mt-1.5">
          {entry.roles.map(role => (
            <span key={role} className="text-[9px] px-1 py-0 bg-slate-800/80 text-slate-500 rounded">
              {role}
            </span>
          ))}
        </div>
      </div>

      {/* Hover tooltip with note + action buttons */}
      {hovered && entry.note && (
        <div className="absolute bottom-full left-0 right-0 mb-1 z-50 p-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl text-[10px] text-slate-400 leading-relaxed">
          {entry.note}
        </div>
      )}

      {/* Quick-add buttons */}
      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(entry.isMega ? entry.name.replace('Mega ', '') : entry.name, 'attacker'); }}
          className="text-[8px] px-1.5 py-0.5 bg-indigo-500/80 text-white rounded hover:bg-indigo-500 transition-colors"
          title="Set as attacker"
        >
          ATK
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(entry.isMega ? entry.name.replace('Mega ', '') : entry.name, 'defender'); }}
          className="text-[8px] px-1.5 py-0.5 bg-rose-500/80 text-white rounded hover:bg-rose-500 transition-colors"
          title="Set as defender"
        >
          DEF
        </button>
      </div>
    </div>
  );
}

function TierRow({ tier, entries, onSelect }: { tier: typeof TIER_DEFINITIONS[number]; entries: TierEntry[]; onSelect: (name: string, side: 'attacker' | 'defender') => void }) {
  if (entries.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-sm font-bold ${tier.color} w-8`}>{tier.tier}</span>
        <span className="text-[10px] text-slate-600">{tier.description}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-1.5">
        {entries.map(entry => (
          <PokemonCard key={entry.name} entry={entry} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

export function TierListPanel({ onSelectPokemon, isOpen, onClose }: TierListPanelProps) {
  const [listType, setListType] = useState<'normal' | 'mega'>('normal');
  const [filterTier, setFilterTier] = useState<Tier | 'all'>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');

  const list = listType === 'mega' ? MEGA_TIER_LIST : NORMAL_TIER_LIST;

  // Get all unique roles
  const allRoles = useMemo(() => {
    const roles = new Set<string>();
    list.forEach(e => e.roles.forEach(r => roles.add(r)));
    return Array.from(roles).sort();
  }, [list]);

  // Get all unique types
  const allTypes = useMemo(() => {
    const types = new Set<string>();
    list.forEach(e => e.types.forEach(t => types.add(t)));
    return Array.from(types).sort();
  }, [list]);

  // Filter
  const filtered = useMemo(() => {
    let results = list;
    if (filterTier !== 'all') results = results.filter(e => e.tier === filterTier);
    if (filterRole !== 'all') results = results.filter(e => e.roles.includes(filterRole));
    if (filterType !== 'all') results = results.filter(e => e.types.includes(filterType as any));
    if (search) {
      const lower = search.toLowerCase();
      results = results.filter(e =>
        e.name.toLowerCase().includes(lower) ||
        e.roles.some(r => r.toLowerCase().includes(lower)) ||
        e.note?.toLowerCase().includes(lower)
      );
    }
    return results;
  }, [list, filterTier, filterRole, filterType, search]);

  // Group by tier
  const groupedByTier = useMemo(() => {
    return TIER_DEFINITIONS.map(tierDef => ({
      ...tierDef,
      entries: filtered.filter(e => e.tier === tierDef.tier),
    }));
  }, [filtered]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-slate-900 border-l border-slate-800 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">
              VGC 2026 Tier List
            </h2>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Type toggle */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setListType('normal')}
              className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                listType === 'normal'
                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              Normal ({NORMAL_TIER_LIST.length})
            </button>
            <button
              onClick={() => setListType('mega')}
              className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                listType === 'mega'
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              Mega ({MEGA_TIER_LIST.length})
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search Pokemon, roles, notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 mb-2"
          />

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterTier}
              onChange={e => setFilterTier(e.target.value as Tier | 'all')}
              className="bg-slate-800 border border-slate-700 rounded text-xs text-white px-2 py-1"
            >
              <option value="all">All Tiers</option>
              {TIER_DEFINITIONS.map(t => (
                <option key={t.tier} value={t.tier}>{t.tier} Tier</option>
              ))}
            </select>
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded text-xs text-white px-2 py-1"
            >
              <option value="all">All Roles</option>
              {allRoles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded text-xs text-white px-2 py-1"
            >
              <option value="all">All Types</option>
              {allTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-[10px] text-slate-600 mb-4">
            Hover for details. Click <span className="text-indigo-400">ATK</span> or <span className="text-rose-400">DEF</span> to load into calculator.
          </p>

          {groupedByTier.map(group => (
            <TierRow
              key={group.tier}
              tier={group}
              entries={group.entries}
              onSelect={onSelectPokemon}
            />
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-600">
              No Pokemon match your filters.
            </div>
          )}

          {/* Stats summary */}
          <div className="mt-6 pt-4 border-t border-slate-800">
            <div className="grid grid-cols-5 gap-2 text-center">
              {TIER_DEFINITIONS.map(t => {
                const count = list.filter(e => e.tier === t.tier).length;
                return (
                  <div key={t.tier} className={`rounded-lg p-2 ${t.bgColor} border ${t.borderColor}`}>
                    <div className={`text-lg font-bold ${t.color}`}>{count}</div>
                    <div className="text-[9px] text-slate-500">{t.tier} Tier</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
