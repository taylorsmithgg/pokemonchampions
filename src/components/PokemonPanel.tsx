import { useState, useMemo } from 'react';
import type { StatID, StatsTable } from '@smogon/calc';
import { SearchSelect } from './SearchSelect';
import { StatPointAllocator } from './StatPointAllocator';
import { TypeBadge } from './TypeBadge';
import {
  getAvailablePokemon,
  getAvailableMoves,
  getAvailableItems,
  getAvailableAbilities,
  getPokemonData,
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
import { getLiveSet } from '../data/liveData';
import { analyzeForMeta } from '../calc/metaBenchmarks';
import type { PokemonState, NatureName } from '../types';

interface PokemonPanelProps {
  state: PokemonState;
  onChange: (state: PokemonState) => void;
  side: 'attacker' | 'defender';
}

function PokemonSprite({ species }: { species: string }) {
  const [useFallback, setUseFallback] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Reset state when species changes
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
        className="max-w-full max-h-full object-contain image-rendering-pixelated"
        onError={() => {
          if (!useFallback) setUseFallback(true);
          else setHasError(true);
        }}
        loading="lazy"
      />
    </div>
  );
}

export function PokemonPanel({ state, onChange, side }: PokemonPanelProps) {
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const { stats: liveStats } = useLiveData();

  const pokemon = getAvailablePokemon();
  const allMoves = useMemo(() => getAvailableMoves(), []);
  const allItems = useMemo(() => getAvailableItems(), []);
  const allAbilities = useMemo(() => getAvailableAbilities(), []);

  const speciesData = useMemo(() => {
    if (!state.species) return null;
    return getPokemonData(state.species);
  }, [state.species]);

  const presets = useMemo(() => {
    if (!state.species) return [];
    return getPresetsBySpecies(state.species);
  }, [state.species]);

  const baseStats: StatsTable = speciesData
    ? speciesData.baseStats
    : { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  const update = <K extends keyof PokemonState>(key: K, value: PokemonState[K]) => {
    onChange({ ...state, [key]: value });
  };

  const handleSpeciesChange = (species: string) => {
    const data = species ? getPokemonData(species) : null;
    const ability = data?.abilities?.[0] || '';
    onChange({
      ...state,
      species,
      ability: ability as string,
      teraType: '',
    });
  };

  const handleMoveChange = (index: number, move: string) => {
    const moves = [...state.moves];
    moves[index] = move;
    update('moves', moves);
  };

  const handleMoveOptionChange = (index: number, key: 'isCrit' | 'hits', value: boolean | number) => {
    update('moveOptions', {
      ...state.moveOptions,
      [index]: { ...state.moveOptions[index], [key]: value },
    });
  };

  const handlePresetLoad = (preset: typeof presets[number]) => {
    onChange({
      ...state,
      species: preset.species,
      nature: preset.nature,
      ability: preset.ability,
      item: preset.item,
      teraType: '',
      sps: { ...preset.sps },
      moves: [...preset.moves],
    });
  };

  const handleImport = () => {
    const imported = importShowdownSet(importText);
    if (imported) {
      onChange(imported);
      setShowImport(false);
      setImportText('');
    }
  };

  const handleExport = () => {
    const text = exportShowdownSet(state);
    navigator.clipboard.writeText(text);
  };

  const handleOptimize = () => {
    if (!state.species) return;

    const speciesData = getPokemonData(state.species);
    if (!speciesData) return;
    const bs = speciesData.baseStats;
    const isPhys = bs.atk > bs.spa;

    // Collect the best data from all sources
    let bestNature = state.nature;
    let bestSps = { ...state.sps };
    let bestAbility = state.ability || (speciesData.abilities?.[0] || '') as string;
    let bestItem = state.item;
    let bestTera = '';
    let bestMoves = [...state.moves];
    let applied = false;

    // 1. Presets first — they're curated for Champions meta (especially Megas)
    if (presets.length > 0) {
      const p = presets[0];
      bestNature = p.nature;
      bestSps = { ...p.sps };
      bestAbility = p.ability;
      bestItem = p.item;
      bestTera = '';
      bestMoves = [...p.moves, '', '', '', ''].slice(0, 4);
      applied = true;
    }

    // 2. If no preset, try live tournament data
    if (!applied && liveStats) {
      const liveSet = getLiveSet(liveStats, state.species);
      if (liveSet) {
        bestNature = liveSet.nature;
        bestSps = { ...liveSet.sps };
        bestAbility = liveSet.ability || bestAbility;
        bestItem = liveSet.item || bestItem;
        bestMoves = [...liveSet.moves, '', '', '', ''].slice(0, 4);
        applied = true;
      }
    }

    // 3. If still nothing, generate from base stats
    if (!applied) {
      bestNature = isPhys ? 'Jolly' : 'Timid';
      bestSps = isPhys
        ? { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 }
        : { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 };
    }

    // 4. Run meta benchmarks to refine the SP spread ONLY (keep the preset nature)
    //    Presets have curated natures — Adamant Garchomp, Modest Gholdengo, etc.
    //    The meta engine tends to always pick Jolly/Timid for speed benchmarks,
    //    which isn't always correct.
    if (!applied) {
      const activeMoves = bestMoves.filter(Boolean);
      if (activeMoves.length > 0) {
        try {
          const metaResult = analyzeForMeta(state.species, activeMoves, bestAbility, bestItem, state.level);
          if (metaResult?.suggestedSpread) {
            const metaSps = metaResult.suggestedSpread.sps;
            const metaTotal = Object.values(metaSps).reduce((a, b) => a + b, 0);
            if (metaTotal >= 60 && metaTotal <= 66) {
              // Only take the SPs, NOT the nature — preset/live data nature is better
              bestSps = { ...metaSps };
            }
          }
        } catch { /* use existing spread */ }
      }
    }

    // Final validation: ensure SPs sum to 66
    let spTotal = Object.values(bestSps).reduce((a, b) => a + b, 0);
    if (spTotal < 66) {
      // Distribute remaining to HP
      bestSps.hp = Math.min(32, bestSps.hp + (66 - spTotal));
      spTotal = Object.values(bestSps).reduce((a, b) => a + b, 0);
      if (spTotal < 66) bestSps.def += (66 - spTotal);
    }

    onChange({
      ...state,
      nature: bestNature,
      sps: bestSps,
      ability: bestAbility,
      item: bestItem,
      teraType: bestTera,
      moves: bestMoves,
    });
  };

  return (
    <div className="poke-panel">
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
            {state.species && <button onClick={handleExport} className="text-xs px-2 py-1 bg-poke-surface text-slate-400 rounded hover:text-white transition-colors">Export</button>}
          </div>
        </div>
        {/* Inline metadata bar when Pokemon is selected */}
        {state.species && speciesData && (() => {
          const tier = getTierForPokemon(state.species);
          const tierDef = tier ? TIER_DEFINITIONS.find(d => d.tier === tier.tier) : null;
          const liveData = liveStats?.pokemon?.[state.species];
          const topItem = liveData ? Object.entries(liveData.items).sort((a, b) => b[1] - a[1])[0] : null;
          return (
            <div className="flex items-center gap-2 flex-wrap">
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
            <button onClick={handleImport} className="text-sm px-4 py-1.5 bg-poke-red text-white rounded-lg font-semibold hover:bg-poke-red-dark transition-colors">Import</button>
            <button onClick={() => { setShowImport(false); setImportText(''); }} className="text-sm px-4 py-1.5 bg-poke-surface text-slate-400 rounded-lg hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Species + Sprite + Optimize */}
        <div className="flex gap-4">
          <PokemonSprite species={state.species} />
          <div className="flex-1 space-y-2">
            <SearchSelect
              options={pokemon}
              value={state.species}
              onChange={handleSpeciesChange}
              placeholder="Choose Pokemon..."
              label="Pokemon"
              renderOption={(name) => {
                const d = getPokemonData(name);
                const t = getTierForPokemon(name);
                const td = t ? TIER_DEFINITIONS.find(x => x.tier === t.tier) : null;
                return (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate">{name}</span>
                    {d && d.types.map((tp: string) => (
                      <span key={tp} className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[tp] || '#666' }} />
                    ))}
                    {td && <span className={`text-[10px] font-bold shrink-0 ${td.color}`}>{t!.tier}</span>}
                  </div>
                );
              }}
            />
            {state.species && (
              <button
                onClick={handleOptimize}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-poke-red to-poke-red-dark text-white text-sm font-bold tracking-wide hover:from-poke-red-light hover:to-poke-red transition-all shadow-lg shadow-poke-red/20 hover:shadow-poke-red/40"
              >
                Optimize for Meta
              </button>
            )}
            {presets.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {presets.map((preset, i) => (
                  <button key={i} onClick={() => handlePresetLoad(preset)} className="text-xs px-2.5 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded hover:border-poke-red/50 hover:text-poke-red-light transition-colors" title={preset.name}>
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
              type="number"
              min={1}
              max={100}
              value={state.level}
              onChange={e => update('level', Math.max(1, Math.min(100, parseInt(e.target.value) || 50)))}
              className="w-full bg-poke-surface border border-poke-border rounded-lg px-2 py-1.5 text-sm text-white text-center"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Nature</label>
            <select
              value={state.nature}
              onChange={e => update('nature', e.target.value as NatureName)}
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
            onChange={v => update('ability', v)}
            placeholder="Ability..."
            label="Ability"
          />
          <SearchSelect
            options={allItems}
            value={state.item}
            onChange={v => update('item', v)}
            placeholder="Item..."
            label="Item"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
          <select
            value={state.status}
            onChange={e => update('status', e.target.value as any)}
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
            onChange={e => update('currentHp', parseInt(e.target.value))}
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
            onChange={sps => update('sps', sps)}
            onNatureChange={n => update('nature', n)}
            onApplySpread={(newSps, newNature) => {
              // Atomic update — set both SPs and nature in one call to avoid stale state
              onChange({
                species: state.species,
                level: state.level,
                nature: newNature,
                ability: state.ability,
                item: state.item,
                teraType: '',
                sps: { hp: newSps.hp, atk: newSps.atk, def: newSps.def, spa: newSps.spa, spd: newSps.spd, spe: newSps.spe },
                boosts: state.boosts,
                status: state.status,
                currentHp: state.currentHp,
                moves: state.moves,
                isMega: state.isMega,
                moveOptions: state.moveOptions,
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
                  onChange={e => update('boosts', { ...state.boosts, [stat]: parseInt(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded text-xs text-white py-0.5 text-center"
                >
                  {[-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map(v => (
                    <option key={v} value={v}>{v > 0 ? `+${v}` : v}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </details>

        {/* Moves */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Moves</label>
          <div className="space-y-1.5">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex gap-1.5 items-center">
                <div className="flex-1">
                  <SearchSelect
                    options={allMoves}
                    value={state.moves[i]}
                    onChange={v => handleMoveChange(i, v)}
                    placeholder={`Move ${i + 1}...`}
                  />
                </div>
                {state.moves[i] && (
                  <button
                    onClick={() => handleMoveOptionChange(i, 'isCrit', !state.moveOptions[i]?.isCrit)}
                    className={`text-[10px] px-1.5 py-1.5 rounded border transition-colors shrink-0 ${
                      state.moveOptions[i]?.isCrit
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-400'
                    }`}
                    title="Critical Hit"
                  >
                    Crit
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Live Usage Data */}
        {liveStats && state.species && (
          <LiveUsagePanel
            species={state.species}
            stats={liveStats}
            onLoadSet={(set) => {
              onChange({
                ...state,
                nature: set.nature,
                sps: set.sps,
                ability: set.ability || state.ability,
                item: set.item || state.item,
                teraType: '',
                moves: set.moves.length > 0 ? [...set.moves, '', '', '', ''].slice(0, 4) : state.moves,
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
