import { useState, useMemo, useRef } from 'react';
import { Move } from '@smogon/calc';
import type { StatID, StatsTable } from '@smogon/calc';
import { SearchSelect } from './SearchSelect';
import { StatPointAllocator } from './StatPointAllocator';
import { TypeBadge } from './TypeBadge';
import { GenBadge } from './GenBadge';
import {
  getAvailablePokemon,
  getAvailableMoves,
  getAvailableItems,
  getAvailableAbilities,
  getPokemonData,
  resolveForm,
  NATURES,
  getNatureLabel,
  STATUS_CONDITIONS,
  STAT_LABELS,
  TYPE_COLORS,
} from '../data/champions';
import { getPresetsBySpecies } from '../data/presets';
import { getTierForPokemon, TIER_DEFINITIONS } from '../data/tierlist';
import { getSpriteUrl, getSpriteFallbackUrl } from '../utils/sprites';
import { importShowdownSet, exportShowdownSet } from '../utils/importExport';
import { LiveUsagePanel } from './LiveUsagePanel';
import { useLiveData } from '../hooks/useLiveData';
import { suggestItems } from '../calc/itemOptimizer';
import { getArchetypes } from '../calc/archetypes';
import type { PokemonState, NatureName } from '../types';
import { createDefaultPokemonState } from '../types';

function getMoveInfo(moveName: string): { type: string; category: string; bp: number } | null {
  if (!moveName) return null;
  try {
    const move = new Move(9 as any, moveName);
    return { type: move.type, category: move.category, bp: move.bp };
  } catch { return null; }
}

interface PokemonPanelProps {
  state: PokemonState;
  onChange: (state: PokemonState) => void;
  side: 'attacker' | 'defender';
  teammateItems?: string[];
}

function PokemonSprite({ species }: { species: string }) {
  const [useFallback, setUseFallback] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [lastSpecies, setLastSpecies] = useState(species);
  if (species !== lastSpecies) {
    setLastSpecies(species);
    setUseFallback(false);
    setHasError(false);
  }

  if (!species || hasError) {
    return (
      <div className="w-24 h-24 rounded-lg bg-slate-800/50 flex items-center justify-center">
        <svg className="w-8 h-8 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </div>
    );
  }

  const src = useFallback ? getSpriteFallbackUrl(species) : getSpriteUrl(species);

  return (
    <div className="w-24 h-24 rounded-lg bg-slate-800/30 flex items-center justify-center overflow-hidden">
      <img
        src={src}
        alt={species}
        className="max-w-full max-h-full object-contain"
        onError={() => {
          if (!useFallback) setUseFallback(true);
          else setHasError(true);
        }}
        loading="lazy"
      />
    </div>
  );
}

// Build optimized state — uses the SAME archetype system shown in the UI.
// When the archetype engine can't source moves from live Smogon stats
// (e.g., Z-A-exclusive forms like Floette-Eternal aren't in the VGC 2026
// dataset), fall back to the curated preset library for moves so the
// Optimize button always produces a usable set.
function buildOptimizedState(species: string, level: number): PokemonState {
  const base = createDefaultPokemonState();
  base.species = species;
  base.level = level;

  const data = getPokemonData(species);
  if (!data) return base;

  base.ability = (data.abilities?.[0] || '') as string;

  const archetypes = getArchetypes(species);
  const presets = getPresetsBySpecies(species);

  if (archetypes.length > 0) {
    const arch = archetypes[0];
    // If the archetype couldn't populate moves (no live data),
    // borrow them from the first preset for this species.
    const archMoves = arch.moves.length > 0
      ? [...arch.moves, '', '', '', ''].slice(0, 4)
      : presets.length > 0
        ? [...presets[0].moves, '', '', '', ''].slice(0, 4)
        : base.moves;
    return {
      ...base,
      nature: arch.nature,
      ability: base.ability,
      item: arch.item || (presets[0]?.item ?? ''),
      sps: { hp: arch.sps.hp, atk: arch.sps.atk, def: arch.sps.def, spa: arch.sps.spa, spd: arch.sps.spd, spe: arch.sps.spe },
      moves: archMoves,
    };
  }

  // No archetypes at all — fall back to preset in full.
  if (presets.length > 0) {
    const p = presets[0];
    return {
      ...base,
      nature: p.nature,
      ability: p.ability,
      item: p.item,
      sps: { ...p.sps },
      moves: [...p.moves, '', '', '', ''].slice(0, 4),
    };
  }

  return base;
}

export function PokemonPanel({ state, onChange, side, teammateItems = [] }: PokemonPanelProps) {
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const { stats: liveStats } = useLiveData();
  const panelRef = useRef<HTMLDivElement>(null);

  const pokemon = getAvailablePokemon();
  const allMoves = useMemo(() => getAvailableMoves(), []);
  const allItems = useMemo(() => getAvailableItems(), []);
  const allAbilities = useMemo(() => getAvailableAbilities(), []);

  // Resolve the effective form (base or Mega based on held item)
  const resolved = useMemo(() => {
    if (!state.species) return { data: null, formName: '', isMega: false };
    return resolveForm(state.species, state.item);
  }, [state.species, state.item]);

  const speciesData = resolved.data;
  const effectiveFormName = resolved.formName;
  const isMega = resolved.isMega;

  const presets = useMemo(() => {
    if (!state.species) return [];
    return getPresetsBySpecies(state.species);
  }, [state.species]);

  const baseStats: StatsTable = speciesData
    ? speciesData.baseStats
    : { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  // Simple state updater — always uses current state from props
  const set = (partial: Partial<PokemonState>) => {
    onChange({ ...state, ...partial });
  };

  return (
    <div ref={panelRef} className="poke-panel">
      {/* Header */}
      <div className={`px-4 py-3 poke-panel-header bg-gradient-to-r ${
        side === 'attacker' ? 'from-poke-red/10 to-transparent' : 'from-poke-blue/10 to-transparent'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide">
            {side === 'attacker' ? 'Attacker' : 'Defender'}
          </h2>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowImport(!showImport)} className="text-xs px-2 py-1 bg-poke-surface text-slate-400 rounded hover:text-white transition-colors">Import</button>
            {state.species && <button onClick={() => { navigator.clipboard.writeText(exportShowdownSet(state)); }} className="text-xs px-2 py-1 bg-poke-surface text-slate-400 rounded hover:text-white transition-colors">Export</button>}
          </div>
        </div>
        {state.species && speciesData && (() => {
          const tier = getTierForPokemon(state.species);
          const tierDef = tier ? TIER_DEFINITIONS.find(d => d.tier === tier.tier) : null;
          const liveData = liveStats?.pokemon?.[state.species];
          const champItemSet = new Set(getAvailableItems());
          const topItem = liveData ? Object.entries(liveData.items).filter(([n]: any) => champItemSet.has(n)).sort((a: any, b: any) => b[1] - a[1])[0] : null;
          return (
            <div className="flex items-center gap-2 flex-wrap">
              {isMega && <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full font-bold">Mega</span>}
              {speciesData.types.map((t: string) => <TypeBadge key={t} type={t} />)}
              {tierDef && <span className={`text-xs font-black px-1.5 py-0.5 rounded ${tierDef.bgColor} ${tierDef.color} border ${tierDef.borderColor}`}>{tier!.tier} Tier</span>}
              {liveData && <span className="text-xs text-slate-500">{(liveData.usage.weighted * 100).toFixed(1)}% usage</span>}
              {topItem && <span className="text-xs text-poke-gold">{topItem[0]}</span>}
            </div>
          );
        })()}
      </div>

      {/* Import modal */}
      {showImport && (
        <div className="p-4 border-b border-poke-border" style={{ backgroundColor: '#12121F' }}>
          <textarea
            className="w-full rounded-lg px-3 py-2 text-sm text-white font-mono resize-none focus:outline-none focus:border-poke-red"
            style={{ backgroundColor: '#1E1F36', border: '1px solid #2A2B45' }}
            rows={6}
            placeholder={`Paste a Showdown-format set:\n\nGarchomp @ Life Orb\nAbility: Rough Skin\nSPs: 32 Atk / 32 Spe / 2 SpD\nJolly Nature\n- Earthquake\n- Dragon Claw`}
            value={importText}
            onChange={e => setImportText(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <button onClick={() => { const r = importShowdownSet(importText); if (r) { onChange(r); setShowImport(false); setImportText(''); }}} className="text-sm px-4 py-1.5 bg-poke-red text-white rounded-lg font-semibold hover:bg-poke-red-dark transition-colors">Import</button>
            <button onClick={() => { setShowImport(false); setImportText(''); }} className="text-sm px-4 py-1.5 bg-poke-surface text-slate-400 rounded-lg hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="p-5 space-y-5">
        {/* Species + Sprite + Optimize */}
        <div className="flex gap-4">
          <div className="relative shrink-0">
            <PokemonSprite species={effectiveFormName || state.species} />
            {isMega && (
              <div className="absolute -bottom-1 left-0 right-0 text-center">
                <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full font-bold">MEGA</span>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <SearchSelect
              options={pokemon}
              value={state.species}
              onChange={(species) => {
                const data = species ? getPokemonData(species) : null;
                onChange({
                  ...createDefaultPokemonState(),
                  species,
                  ability: (data?.abilities?.[0] || '') as string,
                });
              }}
              placeholder="Choose Pokemon..."
              label="Pokemon"
              renderOption={(name) => {
                const d = getPokemonData(name);
                const t = getTierForPokemon(name);
                const td = t ? TIER_DEFINITIONS.find(x => x.tier === t.tier) : null;
                return (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate">{name}</span>
                    <GenBadge species={name} />
                    {d && d.types.map((tp: string) => (
                      <span key={tp} className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[tp] || '#666' }} />
                    ))}
                    {td && <span className={`text-[10px] font-bold shrink-0 ${td.color}`}>{t!.tier}</span>}
                  </div>
                );
              }}
            />
            {state.species && (() => {
              const archs = getArchetypes(state.species);
              const topArch = archs[0];
              return (
                <button
                  onClick={() => {
                    const optimized = buildOptimizedState(state.species, state.level);
                    onChange(optimized);
                  }}
                  className="w-full py-3 rounded-lg bg-gradient-to-r from-poke-red to-poke-red-dark text-white hover:from-poke-red-light hover:to-poke-red transition-all shadow-lg shadow-poke-red/20 hover:shadow-poke-red/40 text-left px-4"
                >
                  <div className="text-sm font-bold">Optimize → {topArch?.name || 'Best Build'}</div>
                  {topArch && (
                    <div className="text-xs text-white/70 mt-0.5">
                      {topArch.nature} · {topArch.item || 'auto item'} · {topArch.moves.filter(Boolean).join(', ') || 'auto moves'}
                    </div>
                  )}
                </button>
              );
            })()}
            {presets.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {presets.map((preset, i) => (
                  <button key={i} onClick={() => {
                    onChange({
                      ...createDefaultPokemonState(),
                      species: state.species,
                      nature: preset.nature,
                      ability: preset.ability,
                      item: preset.item,
                      sps: { hp: preset.sps.hp, atk: preset.sps.atk, def: preset.sps.def, spa: preset.sps.spa, spd: preset.sps.spd, spe: preset.sps.spe },
                      moves: [...preset.moves, '', '', '', ''].slice(0, 4),
                    });
                  }} className="text-xs px-2.5 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded hover:border-poke-red/50 hover:text-poke-red-light transition-colors" title={preset.name}>
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Level + Nature row */}
        <div className="grid grid-cols-[70px_1fr] gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Level</label>
            <input
              type="text"
              inputMode="numeric"
              value={state.level}
              onChange={e => set({ level: Math.max(1, Math.min(100, parseInt(e.target.value) || 50)) })}
              className="w-full bg-poke-surface border border-poke-border rounded-lg px-2 py-1.5 text-sm text-white text-center"
              style={{ minHeight: '28px' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Nature</label>
            <select
              value={state.nature}
              onChange={e => set({ nature: e.target.value as NatureName })}
              className="w-full bg-poke-surface border border-poke-border rounded-lg px-2 py-1.5 text-sm text-white"
            >
              {NATURES.map(n => (
                <option key={n.name} value={n.name}>{getNatureLabel(n.name)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ability + Item */}
        <div className="grid grid-cols-2 gap-2">
          <SearchSelect
            options={allAbilities}
            value={state.ability}
            onChange={v => set({ ability: v })}
            placeholder="Ability..."
            label="Ability"
          />
          <SearchSelect
            options={allItems}
            value={state.item}
            onChange={v => set({ item: v })}
            placeholder="Item..."
            label="Item"
          />
        </div>

        {/* Smart item recommendations */}
        {state.species && (() => {
          const takenItems = new Set(teammateItems.filter(Boolean));
          const isDupe = state.item && takenItems.has(state.item);
          const items = suggestItems(state, takenItems);
          if (items.length === 0 && !isDupe) return null;

          const primary = items[0];
          const secondary = items[1];

          return (
            <div className="rounded-lg border border-poke-border p-3 space-y-2" style={{ backgroundColor: '#12121F' }}>
              {isDupe && (
                <div className="text-sm text-red-400 font-semibold flex items-center gap-1.5">
                  <span>⚠</span> {state.item} is already held by a teammate
                </div>
              )}

              {/* Primary + Secondary recommendations */}
              <div className="grid grid-cols-2 gap-2">
                {primary && (
                  <button
                    onClick={() => set({ item: primary.item })}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      state.item === primary.item
                        ? 'bg-poke-gold/15 border-poke-gold/40'
                        : 'border-poke-border hover:border-poke-gold/30'
                    }`}
                    style={{ backgroundColor: state.item === primary.item ? undefined : '#1a1b30' }}
                  >
                    <div className="text-xs text-poke-gold font-bold mb-0.5">Best Item</div>
                    <div className="text-sm text-white font-semibold">{primary.item}</div>
                    <div className="text-xs text-slate-500 mt-0.5 leading-snug">{primary.reason}</div>
                  </button>
                )}
                {secondary && (
                  <button
                    onClick={() => set({ item: secondary.item })}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      state.item === secondary.item
                        ? 'bg-poke-blue/15 border-poke-blue/40'
                        : 'border-poke-border hover:border-poke-blue/30'
                    }`}
                    style={{ backgroundColor: state.item === secondary.item ? undefined : '#1a1b30' }}
                  >
                    <div className="text-xs text-poke-blue-light font-bold mb-0.5">Alternate</div>
                    <div className="text-sm text-white font-semibold">{secondary.item}</div>
                    <div className="text-xs text-slate-500 mt-0.5 leading-snug">{secondary.reason}</div>
                  </button>
                )}
              </div>

              {/* Additional options */}
              {items.length > 2 && (
                <div className="flex flex-wrap gap-1">
                  {items.slice(2, 6).map(s => (
                    <button
                      key={s.item}
                      onClick={() => set({ item: s.item })}
                      className="text-xs px-2 py-1 rounded border border-poke-border text-slate-500 hover:text-poke-gold hover:border-poke-gold/30 transition-colors"
                      style={{ backgroundColor: '#1a1b30' }}
                      title={s.reason}
                    >
                      {s.item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
          <select
            value={state.status}
            onChange={e => set({ status: e.target.value as any })}
            className="w-full bg-poke-surface border border-poke-border rounded-lg px-2 py-1.5 text-sm text-white"
          >
            {STATUS_CONDITIONS.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Current HP */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-400">Current HP</label>
            <span className="text-xs text-slate-500">{state.currentHp}%</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={state.currentHp}
            onChange={e => set({ currentHp: parseInt(e.target.value) })}
            className="w-full"
            style={{
              background: `linear-gradient(to right, ${state.currentHp > 50 ? '#10b981' : state.currentHp > 25 ? '#f59e0b' : '#ef4444'}80 0%, ${state.currentHp > 50 ? '#10b981' : state.currentHp > 25 ? '#f59e0b' : '#ef4444'}80 ${state.currentHp}%, #334155 ${state.currentHp}%)`,
            }}
          />
        </div>

        {/* Stat Points */}
        {speciesData && (
          <StatPointAllocator
            species={state.species}
            sps={state.sps}
            baseStats={baseStats}
            nature={state.nature}
            level={state.level}
            moves={state.moves}
            ability={state.ability}
            item={state.item}
            onChange={sps => set({ sps })}
            onNatureChange={nature => set({ nature })}
            onApplySpread={(newSps, newNature) => {
              onChange({
                ...createDefaultPokemonState(),
                species: state.species,
                level: state.level,
                ability: state.ability,
                item: state.item,
                status: state.status,
                currentHp: state.currentHp,
                moves: state.moves,
                moveOptions: state.moveOptions,
                nature: newNature,
                sps: { hp: newSps.hp, atk: newSps.atk, def: newSps.def, spa: newSps.spa, spd: newSps.spd, spe: newSps.spe },
              });
            }}
            onApplyArchetype={(arch) => {
              onChange({
                ...createDefaultPokemonState(),
                species: state.species,
                level: state.level,
                ability: state.ability,
                status: state.status,
                currentHp: state.currentHp,
                nature: arch.nature,
                sps: { hp: arch.sps.hp, atk: arch.sps.atk, def: arch.sps.def, spa: arch.sps.spa, spd: arch.sps.spd, spe: arch.sps.spe },
                moves: arch.moves.length > 0 ? [...arch.moves, '', '', '', ''].slice(0, 4) : state.moves,
                item: arch.item || state.item,
              });
            }}
          />
        )}

        {/* Boosts */}
        <details className="group">
          <summary className="text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-300 transition-colors">
            Stat Boosts
          </summary>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {(['atk', 'def', 'spa', 'spd', 'spe'] as StatID[]).map(stat => (
              <div key={stat} className="text-center">
                <label className="block text-[10px] text-slate-500 mb-0.5">{STAT_LABELS[stat]}</label>
                <select
                  value={state.boosts[stat]}
                  onChange={e => set({ boosts: { ...state.boosts, [stat]: parseInt(e.target.value) } })}
                  className="w-full bg-poke-surface border border-poke-border rounded text-xs text-white py-0.5 text-center"
                >
                  {[-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map(v => (
                    <option key={v} value={v}>{v > 0 ? `+${v}` : v}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </details>

        {/* Moves — CSS grid with fixed column widths so the type
            indicator, move name, type pill, BP, and Crit button all
            line up cleanly across every row. Empty cells preserve
            alignment regardless of which moves are populated. */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Moves</label>
          <div className="space-y-2">
            {[0, 1, 2, 3].map(i => {
              const moveInfo = getMoveInfo(state.moves[i]);
              const hasMove = !!state.moves[i];
              return (
                <div
                  key={i}
                  className="grid items-center gap-2"
                  style={{ gridTemplateColumns: '12px minmax(0, 1fr) 62px 32px 44px' }}
                >
                  {/* Type indicator dot */}
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: moveInfo ? (TYPE_COLORS[moveInfo.type] || '#666') : '#2A2B45' }}
                    title={moveInfo?.type || ''}
                  />

                  {/* Move picker */}
                  <SearchSelect
                    options={allMoves}
                    value={state.moves[i]}
                    onChange={v => {
                      const moves = [...state.moves];
                      moves[i] = v;
                      set({ moves });
                    }}
                    placeholder={`Move ${i + 1}...`}
                    renderOption={(name) => {
                      const info = getMoveInfo(name);
                      return (
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: info ? (TYPE_COLORS[info.type] || '#666') : '#444' }} />
                          <span className="flex-1 truncate">{name}</span>
                          {info && info.category !== 'Status' && (
                            <span className="text-xs text-slate-500 shrink-0">{info.bp} BP</span>
                          )}
                          {info && (
                            <span className="text-xs shrink-0" style={{ color: info.category === 'Physical' ? '#F5AC78' : info.category === 'Special' ? '#9DB7F5' : '#A7DB8D' }}>
                              {info.category === 'Physical' ? 'Phys' : info.category === 'Special' ? 'Spec' : 'Stat'}
                            </span>
                          )}
                        </div>
                      );
                    }}
                  />

                  {/* Type pill (fixed 62px column) */}
                  <div className="flex justify-center">
                    {moveInfo ? (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold w-full text-center"
                        style={{
                          backgroundColor: TYPE_COLORS[moveInfo.type] + '25',
                          color: TYPE_COLORS[moveInfo.type],
                        }}
                      >
                        {moveInfo.type}
                      </span>
                    ) : null}
                  </div>

                  {/* Base power (fixed 32px column, right-aligned) */}
                  <div className="text-xs text-slate-500 font-mono text-right tabular-nums">
                    {moveInfo && moveInfo.category !== 'Status' ? moveInfo.bp : ''}
                  </div>

                  {/* Crit toggle (fixed 44px column) */}
                  <div>
                    {hasMove ? (
                      <button
                        onClick={() => set({
                          moveOptions: {
                            ...state.moveOptions,
                            [i]: { ...state.moveOptions[i], isCrit: !state.moveOptions[i]?.isCrit },
                          },
                        })}
                        className={`text-[10px] w-full px-1 py-1 rounded border font-bold transition-colors ${
                          state.moveOptions[i]?.isCrit
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                            : 'bg-poke-surface border-poke-border text-slate-500 hover:text-slate-300'
                        }`}
                        title="Toggle critical hit"
                        aria-pressed={state.moveOptions[i]?.isCrit ?? false}
                      >
                        Crit
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Usage Data */}
        {liveStats && state.species && (
          <LiveUsagePanel
            species={state.species}
            stats={liveStats}
            onLoadSet={(loadedSet) => {
              onChange({
                ...createDefaultPokemonState(),
                species: state.species,
                level: state.level,
                nature: loadedSet.nature,
                sps: { hp: loadedSet.sps.hp, atk: loadedSet.sps.atk, def: loadedSet.sps.def, spa: loadedSet.sps.spa, spd: loadedSet.sps.spd, spe: loadedSet.sps.spe },
                ability: loadedSet.ability || state.ability,
                item: loadedSet.item || state.item,
                moves: loadedSet.moves.length > 0 ? [...loadedSet.moves, '', '', '', ''].slice(0, 4) : state.moves,
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
