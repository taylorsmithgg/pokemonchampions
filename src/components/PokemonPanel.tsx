import { useState, useMemo, useRef } from 'react';
import { Move } from '@smogon/calc';
import type { StatID, StatsTable } from '@smogon/calc';
import { SearchSelect } from './SearchSelect';
import { StatPointAllocator } from './StatPointAllocator';
import { TypeBadge } from './TypeBadge';
import { GenBadge } from './GenBadge';
import {
  getAvailableMoves,
  getAvailableItems,
  getAvailableAbilities,
  getPokemonAbilities,
  getPokemonData,
  resolveForm,
  getAlternateForms,
  NATURES,
  getNatureLabel,
  STATUS_CONDITIONS,
  STAT_LABELS,
  TYPE_COLORS,
} from '../data/champions';
import { getPresetsBySpecies } from '../data/presets';
import { getTierForPokemon, TIER_DEFINITIONS, NORMAL_TIER_LIST } from '../data/tierlist';
import { getSpriteUrl, getSpriteFallbackUrl } from '../utils/sprites';
import { Sprite } from './Sprite';
import { importShowdownSet, exportShowdownSet } from '../utils/importExport';
import { LiveUsagePanel } from './LiveUsagePanel';
import { useLiveData } from '../hooks/useLiveData';
import { suggestItems } from '../calc/itemOptimizer';
import { getArchetypes } from '../calc/archetypes';
import type { PokemonState, NatureName } from '../types';
import { createDefaultPokemonState, CHAMPIONS_LEVEL } from '../types';
import { usePokemonActions } from '../contexts/PokemonActions';
import { PokeballMini } from './PokeballSpinner';
import { getPokemonSelectPool } from '../data/pokemonSelect';

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
  /** Full team context for team-aware optimization. */
  teammates?: PokemonState[];
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

// Build optimized state — team-aware when teammates are provided.
//
// When optimizing in isolation (no teammates), uses the top archetype
// build. When teammates are present, adjusts move selection to fill
// the team's coverage gaps rather than running the generic "best"
// set. Example: Dragapult on a Sun team picks Shadow Ball + Draco
// Meteor to complement Fire coverage, not the generic Tailwind set.
function buildOptimizedState(species: string, teammates?: PokemonState[]): PokemonState {
  const base = createDefaultPokemonState();
  base.species = species;

  const data = getPokemonData(species);
  if (!data) return base;

  base.ability = (data.abilities?.[0] || '') as string;

  const archetypes = getArchetypes(species);
  const presets = getPresetsBySpecies(species);

  // Build the base optimized state from archetype / preset
  let optimized: PokemonState;
  if (archetypes.length > 0) {
    const arch = archetypes[0];
    const archMoves = arch.moves.length > 0
      ? [...arch.moves, '', '', '', ''].slice(0, 4)
      : presets.length > 0
        ? [...presets[0].moves, '', '', '', ''].slice(0, 4)
        : base.moves;
    optimized = {
      ...base,
      nature: arch.nature,
      ability: base.ability,
      item: arch.item || (presets[0]?.item ?? ''),
      sps: { hp: arch.sps.hp, atk: arch.sps.atk, def: arch.sps.def, spa: arch.sps.spa, spd: arch.sps.spd, spe: arch.sps.spe },
      moves: archMoves,
    };
  } else if (presets.length > 0) {
    const p = presets[0];
    optimized = {
      ...base,
      nature: p.nature,
      ability: p.ability,
      item: p.item,
      sps: { ...p.sps },
      moves: [...p.moves, '', '', '', ''].slice(0, 4),
    };
  } else {
    return base;
  }

  // ─── Team-aware adjustments ───────────────────────────────────
  if (!teammates || teammates.filter(t => t.species).length === 0) return optimized;

  const teamTypes = new Set<string>();
  const teamMoveTypes = new Set<string>();
  const teamItems = new Set<string>();

  for (const t of teammates) {
    if (!t.species || t.species === species) continue;
    const td = getPokemonData(t.species);
    if (td) for (const tp of td.types) teamTypes.add(tp as string);
    for (const m of t.moves) {
      if (!m) continue;
      const mi = getMoveInfo(m);
      if (mi && mi.category !== 'Status') teamMoveTypes.add(mi.type);
    }
    if (t.item) teamItems.add(t.item);
  }

  // Item dedup — if our item is already taken, swap to best available
  if (teamItems.has(optimized.item)) {
    const suggestions = suggestItems(optimized, teamItems);
    if (suggestions.length > 0) {
      optimized = { ...optimized, item: suggestions[0].item };
    }
  }

  // Coverage adjustment — if the team is missing offensive coverage
  // against common types, and this Pokemon has a preset with a move
  // that covers the gap, swap one move to fill it.
  const ALL_OFF_TYPES = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
    'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
    'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
  const uncoveredTypes = ALL_OFF_TYPES.filter(t => !teamMoveTypes.has(t));

  if (uncoveredTypes.length > 0 && presets.length > 0) {
    // Check if any preset move covers an uncovered type
    for (const preset of presets) {
      for (const presetMove of preset.moves) {
        if (!presetMove) continue;
        const mi = getMoveInfo(presetMove);
        if (mi && mi.category !== 'Status' && uncoveredTypes.includes(mi.type)) {
          // Check if we already have this move
          if (!optimized.moves.includes(presetMove)) {
            // Replace the least impactful offensive move (lowest BP)
            let worstIdx = -1;
            let worstBP = Infinity;
            for (let i = 0; i < 4; i++) {
              const m = optimized.moves[i];
              if (!m) { worstIdx = i; break; }
              const info = getMoveInfo(m);
              if (info && info.category !== 'Status' && info.bp < worstBP) {
                // Don't replace STAB moves
                const myTypes = data.types.map((t: any) => t as string);
                if (!myTypes.includes(info.type)) {
                  worstBP = info.bp;
                  worstIdx = i;
                }
              }
            }
            if (worstIdx >= 0) {
              const newMoves = [...optimized.moves];
              newMoves[worstIdx] = presetMove;
              optimized = { ...optimized, moves: newMoves };
              break; // only swap one move per optimization
            }
          }
        }
      }
    }
  }

  return optimized;
}

// ─── Alternate form comparison ──────────────────────────────────────
// When a species has alternate forms (Arcanine vs Arcanine-Hisui),
// compare stats and suggest the better form for the team context.

interface FormComparison {
  species: string;
  types: string[];
  bst: number;
  advantage: string;
}

function getFormAlternatives(selectedSpecies: string): FormComparison[] {
  const forms = getAlternateForms(selectedSpecies);
  if (forms.length <= 1) return [];

  const selectedData = getPokemonData(selectedSpecies);
  if (!selectedData) return [];
  const selectedBST = Object.values(selectedData.baseStats).reduce((a, b) => a + b, 0);

  const alts: FormComparison[] = [];
  for (const form of forms) {
    if (form === selectedSpecies) continue;
    const data = getPokemonData(form);
    if (!data) continue;
    const bst = Object.values(data.baseStats).reduce((a, b) => a + b, 0);
    const types = [...data.types] as string[];

    // Build advantage description
    const advantages: string[] = [];
    if (bst > selectedBST) advantages.push(`+${bst - selectedBST} BST`);

    // Different typing
    const selectedTypes = new Set(selectedData.types.map((t: any) => t as string));
    const newTypes = types.filter(t => !selectedTypes.has(t));
    if (newTypes.length > 0) advantages.push(`gains ${newTypes.join('/')} typing`);

    // Higher offensive stat
    const selMaxOff = Math.max(selectedData.baseStats.atk, selectedData.baseStats.spa);
    const altMaxOff = Math.max(data.baseStats.atk, data.baseStats.spa);
    if (altMaxOff > selMaxOff + 10) advantages.push(`+${altMaxOff - selMaxOff} offense`);

    // Different ability
    const selAbility = (selectedData.abilities?.[0] || '') as string;
    const altAbility = (data.abilities?.[0] || '') as string;
    if (selAbility !== altAbility) advantages.push(altAbility);

    if (advantages.length > 0) {
      alts.push({
        species: form,
        types,
        bst,
        advantage: advantages.join(' · '),
      });
    }
  }
  return alts;
}

// ─── Meta upgrade suggestion ────────────────────────────────────────
// When a B or C tier Pokemon is selected, suggest higher-tier
// alternatives that share a role or type coverage. Derived from the
// tier list data — no hardcoded recommendations.

interface MetaUpgrade {
  species: string;
  tier: string;
  reason: string;
}

function getMetaUpgrades(selectedSpecies: string): MetaUpgrade[] {
  const entry = getTierForPokemon(selectedSpecies);
  if (!entry) return [];
  // Only suggest upgrades for B/C tier picks
  if (entry.tier === 'S' || entry.tier === 'A+' || entry.tier === 'A') return [];

  const selectedData = getPokemonData(selectedSpecies);
  if (!selectedData) return [];

  const selectedTypes = new Set(selectedData.types.map((t: any) => t as string));
  const selectedRoles = new Set(entry.roles || []);
  const isPhys = selectedData.baseStats.atk > selectedData.baseStats.spa;

  const upgrades: MetaUpgrade[] = [];

  for (const candidate of NORMAL_TIER_LIST) {
    if (candidate.name === selectedSpecies) continue;
    if (candidate.tier !== 'S' && candidate.tier !== 'A+' && candidate.tier !== 'A') continue;

    const candData = getPokemonData(candidate.name);
    if (!candData) continue;
    const candTypes = new Set(candData.types.map((t: any) => t as string));
    const candIsPhys = candData.baseStats.atk > candData.baseStats.spa;

    // Score relevance: shared type, shared role, same offensive profile
    let score = 0;
    const reasons: string[] = [];

    // Shared type
    for (const t of selectedTypes) {
      if (candTypes.has(t)) { score += 2; reasons.push(`same ${t} STAB`); break; }
    }

    // Shared role
    const candRoles = new Set(candidate.roles || []);
    for (const r of selectedRoles) {
      if (candRoles.has(r)) { score += 3; reasons.push(`fills the same ${r} role`); break; }
    }

    // Same offensive profile
    if (isPhys === candIsPhys) { score += 1; reasons.push(isPhys ? 'physical attacker' : 'special attacker'); }

    if (score >= 3 && reasons.length > 0) {
      upgrades.push({
        species: candidate.name,
        tier: candidate.tier,
        reason: `${candidate.tier} tier — ${reasons[0]}`,
      });
    }
  }

  // Sort by tier (S > A+ > A) then by relevance
  const tierOrder: Record<string, number> = { S: 0, 'A+': 1, A: 2 };
  upgrades.sort((a, b) => (tierOrder[a.tier] ?? 3) - (tierOrder[b.tier] ?? 3));
  return upgrades.slice(0, 3);
}

export function PokemonPanel({ state, onChange, side, teammateItems = [], teammates = [] }: PokemonPanelProps) {
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [isOptimizingCalc, setIsOptimizingCalc] = useState(false);
  const { stats: liveStats } = useLiveData();
  const { addToTeam } = usePokemonActions();
  const panelRef = useRef<HTMLDivElement>(null);

  const pokemon = useMemo(() => getPokemonSelectPool(), []);
  const allMoves = useMemo(() => getAvailableMoves(), []);
  const allItems = useMemo(() => getAvailableItems(), []);
  const speciesAbilities = useMemo(() => {
    if (!state.species) return getAvailableAbilities();
    return getPokemonAbilities(state.species);
  }, [state.species]);

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
            {state.species && (
              <button
                onClick={() => addToTeam(state.species)}
                className="text-xs px-2 py-1 bg-poke-red/15 text-poke-red-light border border-poke-red/30 rounded hover:bg-poke-red/25 transition-colors font-semibold"
                title="Add this Pokemon to your team"
              >
                + Team
              </button>
            )}
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
              sortFn={(a, b) => {
                const tierOrder: Record<string, number> = { S: 0, 'A+': 1, A: 2, B: 3, C: 4 };
                const ta = getTierForPokemon(a);
                const tb = getTierForPokemon(b);
                const ra = ta ? (tierOrder[ta.tier] ?? 5) : 5;
                const rb = tb ? (tierOrder[tb.tier] ?? 5) : 5;
                if (ra !== rb) return ra - rb;
                return a.localeCompare(b);
              }}
              renderOption={(name) => {
                const d = getPokemonData(name);
                const t = getTierForPokemon(name);
                const td = t ? TIER_DEFINITIONS.find(x => x.tier === t.tier) : null;
                return (
                  <div className="flex items-center gap-2">
                    {td ? (
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${td.bgColor} ${td.color} border ${td.borderColor} shrink-0 w-7 text-center`}>{t!.tier}</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/30 text-slate-600 border border-slate-700/30 shrink-0 w-7 text-center">—</span>
                    )}
                    <span className="flex-1 truncate">{name}</span>
                    <GenBadge species={name} />
                    {d && d.types.map((tp: string) => (
                      <span key={tp} className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[tp] || '#666' }} />
                    ))}
                  </div>
                );
              }}
            />
            {state.species && (() => {
              const archs = getArchetypes(state.species);
              const topArch = archs[0];
              return (
                <button
                  disabled={isOptimizingCalc}
                  onClick={() => {
                    setIsOptimizingCalc(true);
                    requestAnimationFrame(() => {
                      const optimized = buildOptimizedState(state.species, teammates);
                      onChange(optimized);
                      setTimeout(() => setIsOptimizingCalc(false), 400);
                    });
                  }}
                  className={`w-full py-3 rounded-lg text-white text-left px-4 transition-all duration-200 ${
                    isOptimizingCalc
                      ? 'bg-poke-red/50 cursor-wait'
                      : 'bg-gradient-to-r from-poke-red to-poke-red-dark hover:from-poke-red-light hover:to-poke-red shadow-lg shadow-poke-red/20 hover:shadow-poke-red/40'
                  }`}
                >
                  <div className="text-sm font-bold flex items-center gap-2">
                    {isOptimizingCalc && <PokeballMini />}
                    {isOptimizingCalc ? 'Optimizing...' : `Optimize → ${topArch?.name || 'Best Build'}`}
                  </div>
                  {topArch && (
                    <div className="text-xs text-white/70 mt-0.5">
                      {topArch.nature} · {topArch.item || 'auto item'} · {topArch.moves.filter(Boolean).join(', ') || 'auto moves'}
                    </div>
                  )}
                </button>
              );
            })()}
            {/* Alternate form comparison — shown when other forms exist */}
            {state.species && (() => {
              const formAlts = getFormAlternatives(state.species);
              if (formAlts.length === 0) return null;
              return (
                <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-violet-400 mb-2">
                    Alternate forms available
                  </div>
                  <div className="space-y-1.5">
                    {formAlts.map(alt => (
                      <button
                        key={alt.species}
                        onClick={() => {
                          const data = getPokemonData(alt.species);
                          onChange({
                            ...createDefaultPokemonState(),
                            species: alt.species,
                            ability: (data?.abilities?.[0] || '') as string,
                          });
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-poke-surface border border-poke-border hover:border-violet-500/40 transition-colors text-left"
                      >
                        <Sprite species={alt.species} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-white">{alt.species}</div>
                          <div className="text-[10px] text-slate-500 truncate">{alt.advantage}</div>
                        </div>
                        <span className="text-[10px] text-violet-400 shrink-0">Switch →</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            {/* Meta upgrade suggestion — shown for B/C tier picks */}
            {state.species && (() => {
              const upgrades = getMetaUpgrades(state.species);
              if (upgrades.length === 0) return null;
              const currentTier = getTierForPokemon(state.species);
              return (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-2">
                    {currentTier?.tier} Tier — consider a meta upgrade
                  </div>
                  <div className="space-y-1.5">
                    {upgrades.map(u => {
                      const td = TIER_DEFINITIONS.find(d => d.tier === u.tier);
                      return (
                        <button
                          key={u.species}
                          onClick={() => {
                            const data = getPokemonData(u.species);
                            onChange({
                              ...createDefaultPokemonState(),
                              species: u.species,
                              ability: (data?.abilities?.[0] || '') as string,
                            });
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-poke-surface border border-poke-border hover:border-amber-500/40 transition-colors text-left"
                        >
                          <Sprite species={u.species} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white">{u.species}</span>
                              {td && <span className={`text-[9px] font-black px-1 py-0 rounded ${td.bgColor} ${td.color} border ${td.borderColor}`}>{u.tier}</span>}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">{u.reason}</div>
                          </div>
                          <span className="text-[10px] text-amber-400 shrink-0">Swap →</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
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

        {/* Nature (Level is fixed in Champions — pinned to CHAMPIONS_LEVEL) */}
        <div>
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
            options={speciesAbilities}
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
            level={CHAMPIONS_LEVEL}
            moves={state.moves}
            ability={state.ability}
            item={state.item}
            onChange={sps => set({ sps })}
            onNatureChange={nature => set({ nature })}
            onApplySpread={(newSps, newNature) => {
              onChange({
                ...createDefaultPokemonState(),
                species: state.species,
                level: CHAMPIONS_LEVEL,
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
                level: CHAMPIONS_LEVEL,
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
                level: CHAMPIONS_LEVEL,
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
