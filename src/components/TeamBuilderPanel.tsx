import { useState, useMemo, useCallback } from 'react';
import type { StatID } from '@smogon/calc';
import { SearchSelect } from './SearchSelect';
import { SwordIcon, ShieldIcon, OptimizeIcon } from './QuickAdd';
import { auditTeam, type TeamAudit } from '../calc/teamAudit';
import { buildOptimalTeam, suggestNextPick, suggestReplacementsForSlot } from '../calc/teamBuilder';
import { DEFAULT_FORMAT, type BattleFormat } from '../calc/lineupAnalysis';
import { FormatSelector } from './FormatSelector';
import { PRESETS, getPresetsBySpecies } from '../data/presets';
import { MEGA_STONE_MAP } from '../data/championsRoster';
import { NORMAL_TIER_LIST } from '../data/tierlist';
import { Sprite } from './Sprite';
import { GenBadge } from './GenBadge';
import { getSpriteUrl } from '../utils/sprites';
import { getRecommendations, type SynergyReason } from '../data/synergies';
import { PokeballSpinner, PokeballMini } from './PokeballSpinner';
import {
  getAvailablePokemon,
  getAvailableMoves,
  getAvailableItems,
  getAvailableAbilities,
  getPokemonData,
  NATURES,
  getNatureLabel,
  STAT_LABELS,
  STAT_COLORS,
  MAX_TOTAL_SP,
  MAX_STAT_SP,
  STAT_IDS,
  getNatureMod,
} from '../data/champions';
import { useLiveData } from '../hooks/useLiveData';
import { getLiveSet } from '../data/liveData';
import { importShowdownSet } from '../utils/importExport';
import type { PokemonState, NatureName } from '../types';
import { createDefaultPokemonState } from '../types';

interface TeamBuilderPanelProps {
  team: PokemonState[];
  onChange: (team: PokemonState[]) => void;
  onLoadToCalc: (pokemon: PokemonState, side: 'attacker' | 'defender') => void;
  isOpen: boolean;
  onClose: () => void;
  /** When true, renders as full-page content without the modal overlay. */
  fullScreen?: boolean;
}

function MiniStatBar({ stat, base, sp, nature, level }: { stat: StatID; base: number; sp: number; nature: NatureName; level: number }) {
  const natureMod = getNatureMod(nature, stat);
  let calcVal: number;
  if (stat === 'hp') {
    calcVal = base === 1 ? 1 : Math.floor(((2 * base + 31 + Math.floor(sp / 4)) * level) / 100) + level + 10;
  } else {
    calcVal = Math.floor((Math.floor(((2 * base + 31 + Math.floor(sp / 4)) * level) / 100) + 5) * natureMod);
  }
  const maxPossible = stat === 'hp' ? 300 : 250;
  const pct = Math.min(100, (calcVal / maxPossible) * 100);

  return (
    <div className="flex items-center gap-1">
      <span className="text-[8px] text-slate-500 w-5">{STAT_LABELS[stat]}</span>
      <div className="flex-1 h-1 bg-poke-surface rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: STAT_COLORS[stat] }} />
      </div>
      <span className="text-[8px] text-slate-400 w-6 text-right font-mono">{calcVal}</span>
    </div>
  );
}

function TeamSlot({
  index,
  pokemon,
  team,
  format,
  onChange,
  onLoadToCalc,
  onAutoFill,
  onReplace,
}: {
  index: number;
  pokemon: PokemonState;
  team: PokemonState[];
  format: BattleFormat;
  onReplace: (species: string) => void;
  onChange: (state: PokemonState) => void;
  onLoadToCalc: (side: 'attacker' | 'defender') => void;
  onAutoFill: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // Sort Pokemon by how well they fit the current team composition
  const allPokemon = useMemo(() => {
    const all = getAvailablePokemon();
    // Get scores from team builder for contextual ordering
    const picks = suggestNextPick(team, 50, format);
    const scoreMap = new Map(picks.map(p => [p.species, p.score]));

    const tierOrder: Record<string, number> = { S: 5, 'A+': 4, A: 3, B: 2, C: 1 };
    const presetSpecies = new Set(PRESETS.map(p => p.species));

    return [...all].sort((a, b) => {
      // Primary: team-contextual score (higher = better fit)
      const sa = scoreMap.get(a) ?? -1;
      const sb = scoreMap.get(b) ?? -1;
      if (sa > 0 || sb > 0) {
        if (sa !== sb) return sb - sa; // Higher score first
      }
      // Secondary: tier ranking
      const ta = NORMAL_TIER_LIST.find(e => e.name === a);
      const tb = NORMAL_TIER_LIST.find(e => e.name === b);
      const tierA = ta ? tierOrder[ta.tier] ?? 0 : presetSpecies.has(a) ? 2 : 0;
      const tierB = tb ? tierOrder[tb.tier] ?? 0 : presetSpecies.has(b) ? 2 : 0;
      if (tierA !== tierB) return tierB - tierA;
      return a.localeCompare(b);
    });
  }, [team, format]);

  // Role-aware replacement suggestions — if this slot has a clear
  // role (Fake Out, Hazard Setter, Tailwind, Setup Sweeper, etc.),
  // prioritize replacements that fill the same role.
  const [showReplacements, setShowReplacements] = useState(false);
  const replacements = useMemo(() => {
    if (!pokemon.species || !showReplacements) return [];
    return suggestReplacementsForSlot(team, index, 5, format);
  }, [pokemon.species, team, index, showReplacements, format]);

  const allMoves = useMemo(() => getAvailableMoves(), []);
  const allItems = useMemo(() => getAvailableItems(), []);
  const allAbilities = useMemo(() => getAvailableAbilities(), []);
  const data = pokemon.species ? getPokemonData(pokemon.species) : null;

  const update = <K extends keyof PokemonState>(key: K, value: PokemonState[K]) => {
    onChange({ ...pokemon, [key]: value });
  };

  const handleSpeciesChange = (species: string) => {
    const d = species ? getPokemonData(species) : null;
    onChange({
      ...createDefaultPokemonState(),
      species,
      ability: (d?.abilities?.[0] || '') as string,
      teraType: '',
    });
  };

  const totalSP = Object.values(pokemon.sps).reduce((a: number, b: number) => a + b, 0);

  return (
    <div className={`poke-panel ${!pokemon.species ? 'opacity-60' : ''}`}>
      <div className="p-4">
        {/* Species row */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm font-bold text-poke-gold w-5">{index + 1}</span>
          {pokemon.species && (
<Sprite species={pokemon.species} size="lg" className="shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <SearchSelect
              options={allPokemon}
              value={pokemon.species}
              onChange={handleSpeciesChange}
              placeholder={`Slot ${index + 1}...`}
            />
          </div>
          {pokemon.species && (
            <div className="flex gap-1 items-center shrink-0">
              {/* Optimize: auto-fill the slot from live data. Keeps
                  the "Optimize" semantics explicit since it mutates
                  the slot rather than routing elsewhere. */}
              <button
                onClick={onAutoFill}
                className="w-7 h-7 flex items-center justify-center rounded-md border bg-poke-gold/15 text-poke-gold border-poke-gold/30 hover:bg-poke-gold/25 hover:border-poke-gold/60 hover:text-white transition-colors"
                title="Auto-fill optimal set from live data"
                aria-label="Optimize this slot"
              >
                <OptimizeIcon className="w-[14px] h-[14px]" />
              </button>
              {/* Use-in-calc buttons: pass the exact current build
                  (moves, SPs, nature) to the calculator. Distinct
                  from QuickAdd, which pulls from the preset library
                  and would discard the user's customization. */}
              <button
                onClick={() => onLoadToCalc('attacker')}
                className="w-7 h-7 flex items-center justify-center rounded-md border bg-poke-red/15 text-poke-red-light border-poke-red/30 hover:bg-poke-red/25 hover:border-poke-red/60 hover:text-white transition-colors"
                title="Use this exact build in calculator as Attacker"
                aria-label="Use this build as Attacker"
              >
                <SwordIcon className="w-[14px] h-[14px]" />
              </button>
              <button
                onClick={() => onLoadToCalc('defender')}
                className="w-7 h-7 flex items-center justify-center rounded-md border bg-poke-blue/15 text-poke-blue-light border-poke-blue/30 hover:bg-poke-blue/25 hover:border-poke-blue/60 hover:text-white transition-colors"
                title="Use this exact build in calculator as Defender"
                aria-label="Use this build as Defender"
              >
                <ShieldIcon className="w-[14px] h-[14px]" />
              </button>
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                aria-label={expanded ? 'Collapse' : 'Expand'}
              >
                <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Mini summary when collapsed */}
        {pokemon.species && !expanded && data && (
          <div className="space-y-0.5 mt-1">
            <div className="flex items-center gap-1 text-[9px] text-slate-500">
              <GenBadge species={pokemon.species} />
              <span>{pokemon.nature}</span>
              <span>|</span>
              <span>{pokemon.ability || '—'}</span>
              <span>|</span>
              <span>{pokemon.item || '—'}</span>
              <span>|</span>
              <span className={`${totalSP === MAX_TOTAL_SP ? 'text-emerald-400' : 'text-amber-400'}`}>{totalSP}/{MAX_TOTAL_SP} SP</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {pokemon.moves.filter(Boolean).map((m: string) => (
                <span key={m} className="text-[8px] px-1 py-0 bg-poke-surface text-slate-400 rounded">{m}</span>
              ))}
            </div>
            {/* Mini stat bars */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-0 mt-1">
              {STAT_IDS.map(s => (
                <MiniStatBar key={s} stat={s} base={data.baseStats[s]} sp={pokemon.sps[s]} nature={pokemon.nature} level={pokemon.level} />
              ))}
            </div>
          </div>
        )}

        {/* Expanded form */}
        {pokemon.species && expanded && (
          <div className="space-y-4 mt-3 border-t border-poke-border pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nature</label>
                <select value={pokemon.nature} onChange={e => update('nature', e.target.value as NatureName)} className="w-full bg-poke-surface border border-poke-border rounded-lg px-3 py-2 text-sm text-white">
                  {NATURES.map(n => <option key={n.name} value={n.name}>{getNatureLabel(n.name)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Item</label>
                <SearchSelect options={allItems} value={pokemon.item} onChange={v => update('item', v)} placeholder="Item..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ability</label>
                <SearchSelect options={allAbilities} value={pokemon.ability} onChange={v => update('ability', v)} placeholder="Ability..." />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tera Type</label>
                <select value={pokemon.teraType || ''} onChange={e => update('teraType', e.target.value)} className="w-full bg-poke-surface border border-poke-border rounded-lg px-3 py-2 text-sm text-white">
                  <option value="">None</option>
                  {['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* SP allocation */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-slate-400 font-medium">Stat Points</label>
                <span className={`text-sm font-bold ${totalSP === MAX_TOTAL_SP ? 'text-emerald-400' : 'text-amber-400'}`}>{totalSP} used / {MAX_TOTAL_SP - totalSP} free</span>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {STAT_IDS.map(stat => (
                  <div key={stat} className="text-center">
                    <label className="block text-[8px] text-slate-600">{STAT_LABELS[stat]}</label>
                    <input
                      type="text" inputMode="numeric" value={pokemon.sps[stat]}
                      onChange={e => {
                        const v = Math.min(MAX_STAT_SP, Math.max(0, parseInt(e.target.value) || 0));
                        update('sps', { ...pokemon.sps, [stat]: v });
                      }}
                      className="w-full bg-poke-surface border border-poke-border rounded text-sm text-center text-white"
                      style={{ minHeight: '30px', padding: '4px' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Moves */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Moves</label>
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map(i => (
                  <SearchSelect
                    key={i}
                    options={allMoves}
                    value={pokemon.moves[i]}
                    onChange={v => {
                      const moves = [...pokemon.moves];
                      moves[i] = v;
                      update('moves', moves);
                    }}
                    placeholder={`Move ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Role-aware replacement suggestions */}
        {pokemon.species && (
          <div className="mt-3 pt-3 border-t border-poke-border">
            <button
              onClick={() => setShowReplacements(!showReplacements)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors w-full ${
                showReplacements
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-poke-surface border-poke-border text-slate-500 hover:text-amber-400 hover:border-amber-500/30'
              }`}
            >
              {showReplacements ? 'Hide Replacements' : 'Suggest Replacements'}
            </button>
            {showReplacements && replacements.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {replacements.map(pick => {
                  const isSameAsCurrent = pick.species === pokemon.species;
                  if (isSameAsCurrent) return null;
                  return (
                    <button
                      key={pick.species}
                      onClick={() => onReplace(pick.species)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-poke-border text-left transition-colors hover:border-poke-red/30"
                      style={{ backgroundColor: '#1a1b30' }}
                    >
                      <img
                        src={getSpriteUrl(pick.species)}
                        alt={pick.species}
                        className="w-10 h-10 object-contain shrink-0"
                        loading="lazy"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{pick.species}</span>
                          {pick.matchedRoles.length > 0 && (
                            <span className="text-[9px] px-1.5 py-0 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full font-bold uppercase tracking-wider whitespace-nowrap">
                              Same role
                            </span>
                          )}
                          <span className="text-xs text-poke-gold font-mono ml-auto">+{pick.score}</span>
                        </div>
                        {pick.matchedRoles.length > 0 && (
                          <div className="text-[10px] text-emerald-400/80 leading-snug mt-0.5">
                            Fills: {pick.matchedRoles.join(', ')}
                          </div>
                        )}
                        <div className="text-xs text-slate-500 leading-snug line-clamp-2 mt-0.5">
                          {pick.reasons.slice(0, 2).join(' · ')}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TeamBuilderPanel({ team, onChange, onLoadToCalc, isOpen, onClose, fullScreen = false }: TeamBuilderPanelProps) {
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [format, setFormat] = useState<BattleFormat>(DEFAULT_FORMAT);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeLog, setOptimizeLog] = useState<string[]>([]);
  const { stats: liveStats } = useLiveData();

  const audit = useMemo<TeamAudit>(() => auditTeam(team, format), [team, format]);

  const updateSlot = useCallback((index: number, state: PokemonState) => {
    const next = [...team];
    next[index] = state;
    onChange(next);
  }, [team, onChange]);

  const handleAutoFill = useCallback((index: number) => {
    const species = team[index].species;
    if (!species || !liveStats) return;
    const liveSet = getLiveSet(liveStats, species);
    if (!liveSet) return;
    updateSlot(index, {
      ...team[index],
      nature: liveSet.nature,
      sps: liveSet.sps,
      ability: liveSet.ability,
      item: liveSet.item,
      teraType: '',
      moves: [...liveSet.moves, '', '', '', ''].slice(0, 4),
    });
  }, [team, liveStats, updateSlot]);

  const handleImportTeam = useCallback(() => {
    const blocks = importText.split(/\n\n+/).filter(Boolean);
    const newTeam = [...team];
    let slot = 0;
    for (const block of blocks) {
      if (slot >= 6) break;
      const parsed = importShowdownSet(block);
      if (parsed) {
        newTeam[slot] = parsed;
        slot++;
      }
    }
    onChange(newTeam);
    setShowImport(false);
    setImportText('');
  }, [importText, team, onChange]);

  // Build a full optimal team from scratch (fills empty slots).
  const handleBuildTeam = useCallback(() => {
    const built = buildOptimalTeam(team, 6, format);
    onChange(built);
  }, [team, onChange, format]);

  // Optimize EVERY slot in one pass — fills empty slots with best
  // picks AND re-applies optimal sets to existing filled slots.
  // Now with loading feedback and audit logging.
  const handleOptimizeAll = useCallback(() => {
    setIsOptimizing(true);
    const log: string[] = [];

    // Step 1: fill empty slots with best picks for the current team
    log.push('Analyzing team gaps...');
    const emptyCount = team.filter(p => !p.species).length;
    const filled = buildOptimalTeam(team, 6, format);
    if (emptyCount > 0) {
      const newSpecies = filled.filter(p => p.species && !team.some(t => t.species === p.species)).map(p => p.species);
      log.push(`Filled ${newSpecies.length} empty slot${newSpecies.length !== 1 ? 's' : ''}: ${newSpecies.join(', ')}`);
    }

    // Step 2: re-apply the optimal set (live data → preset fallback)
    // to each filled slot, mirroring handleAutoFill's single-slot
    // logic but across the full team in one state update.
    const isMegaStone = (item: string): boolean => {
      if (!item) return false;
      for (const stones of Object.values(MEGA_STONE_MAP)) {
        if (stones.includes(item)) return true;
      }
      return false;
    };

    log.push('Optimizing builds for each slot...');
    const optimized: PokemonState[] = filled.map(slot => {
      if (!slot.species) return slot;

      // Try live VGC data first — most accurate real-world set
      if (liveStats) {
        const liveSet = getLiveSet(liveStats, slot.species);
        if (liveSet) {
          log.push(`${slot.species}: Applied VGC usage data (${liveSet.nature}, ${liveSet.item})`);
          return {
            ...slot,
            nature: liveSet.nature,
            sps: liveSet.sps,
            ability: liveSet.ability,
            item: liveSet.item,
            teraType: '',
            moves: [...liveSet.moves, '', '', '', ''].slice(0, 4),
          };
        }
      }

      // Fall back to the curated preset library
      const presets = getPresetsBySpecies(slot.species);
      if (presets.length > 0) {
        const p = presets[0];
        log.push(`${slot.species}: Applied preset "${p.label}" (${p.nature}, ${p.item})`);
        return {
          ...slot,
          nature: p.nature,
          ability: p.ability,
          item: p.item,
          sps: { ...p.sps },
          moves: [...p.moves, '', '', '', ''].slice(0, 4),
        };
      }

      log.push(`${slot.species}: No data available — kept existing build`);
      return slot;
    });

    // Step 3: enforce one-Mega-per-team + item dedup
    log.push('Resolving item conflicts...');
    const usedItems = new Set<string>();
    let hasMega = false;
    for (let i = 0; i < optimized.length; i++) {
      const slot = optimized[i];
      if (!slot.species) continue;

      // Mega enforcement
      if (isMegaStone(slot.item)) {
        if (hasMega) {
          const fallback = ['Sitrus Berry', 'Leftovers', 'Focus Sash', 'Lum Berry', 'Mental Herb', 'Shell Bell', 'Scope Lens']
            .find(x => !usedItems.has(x)) ?? '';
          log.push(`${slot.species}: Duplicate Mega Stone removed → ${fallback || 'no item'}`);
          optimized[i] = { ...slot, item: fallback };
        } else {
          hasMega = true;
          log.push(`${slot.species}: Mega slot claimed (${slot.item})`);
        }
      }

      // Item dedup
      if (optimized[i].item && usedItems.has(optimized[i].item)) {
        const oldItem = optimized[i].item;
        const fallback = ['Sitrus Berry', 'Leftovers', 'Focus Sash', 'Lum Berry', 'Mental Herb', 'Shell Bell']
          .find(x => !usedItems.has(x)) ?? '';
        log.push(`${slot.species}: ${oldItem} conflict → swapped to ${fallback || 'none'}`);
        optimized[i] = { ...optimized[i], item: fallback };
      }
      if (optimized[i].item) usedItems.add(optimized[i].item);
    }

    log.push(`Optimization complete — ${optimized.filter(p => p.species).length}/6 slots filled.`);
    setOptimizeLog(log);
    onChange(optimized);

    // Delay clearing loading state so the user sees the spinner
    setTimeout(() => setIsOptimizing(false), 600);
  }, [team, format, liveStats, onChange]);

  // Get suggestions for next pick
  const nextPicks = useMemo(() => {
    const hasEmpty = team.some(p => !p.species);
    if (!hasEmpty) return [];
    return suggestNextPick(team, 6, format);
  }, [team, format]);

  const scoreColor = audit.score >= 80 ? 'text-emerald-400' : audit.score >= 60 ? 'text-amber-400' : audit.score >= 40 ? 'text-orange-400' : 'text-red-400';
  const criticals = audit.issues.filter(i => i.severity === 'critical');
  const warnings = audit.issues.filter(i => i.severity === 'warning');
  const goods = audit.issues.filter(i => i.severity === 'good');

  if (!isOpen && !fullScreen) return null;

  if (fullScreen) {
    // Full-page mode: render the content panel directly, no modal
    return (
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4" style={{ backgroundColor: 'transparent' }}>
        {/* Reuse the same internal content */}
        <div className="sticky top-0 z-20 border-b border-poke-border mb-4 -mx-4 px-4 py-3" style={{ backgroundColor: 'rgba(10,10,21,0.9)', backdropFilter: 'blur(8px)' }}>
          <div className="flex gap-2 flex-wrap items-center">
            <FormatSelector value={format.id} onChange={setFormat} />
            <button onClick={handleBuildTeam} className="text-sm px-4 py-1.5 bg-gradient-to-r from-poke-red to-poke-red-dark text-white rounded-lg font-bold hover:from-poke-red-light hover:to-poke-red transition-all shadow-lg shadow-poke-red/20">Build Team</button>
            <button onClick={handleOptimizeAll} className="text-sm px-4 py-1.5 bg-poke-gold/15 border border-poke-gold/40 text-poke-gold rounded-lg font-bold hover:bg-poke-gold/25 transition-colors flex items-center gap-1.5">
              <OptimizeIcon className="w-4 h-4" />Optimize All
            </button>
            <button onClick={() => setShowImport(!showImport)} className="text-xs px-3 py-1.5 bg-poke-surface border border-poke-border text-slate-400 rounded-lg hover:text-white transition-colors">Import</button>
            <button onClick={() => onChange(Array.from({ length: 6 }, () => createDefaultPokemonState()))} className="text-xs px-3 py-1.5 bg-poke-surface border border-poke-border text-slate-400 rounded-lg hover:text-poke-red transition-colors">Clear</button>
            <div className="ml-auto flex items-center gap-2">
              <span className={`text-lg font-black ${scoreColor}`}>{audit.score}</span>
              <span className="text-xs text-slate-500">/100</span>
            </div>
          </div>
        </div>

        {/* Team slots — 3-column grid in full-screen */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {team.map((slot, i) => (
            <TeamSlot
              key={i}
              index={i}
              pokemon={slot}
              team={team}
              format={format}
              onChange={(state) => updateSlot(i, state)}
              onReplace={(species) => {
                const data = getPokemonData(species);
                const preset = PRESETS.find((p: any) => p.species === species);
                updateSlot(i, preset ? {
                  ...createDefaultPokemonState(),
                  species: preset.species,
                  nature: preset.nature,
                  ability: preset.ability,
                  item: preset.item,
                  sps: { ...preset.sps },
                  moves: [...preset.moves, '', '', '', ''].slice(0, 4),
                } : {
                  ...createDefaultPokemonState(),
                  species,
                  ability: (data?.abilities?.[0] || '') as string,
                });
              }}
              onAutoFill={() => handleAutoFill(i)}
              onLoadToCalc={side => onLoadToCalc(slot, side)}
            />
          ))}
        </div>

        {/* Suggested next picks */}
        {nextPicks.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-bold text-white mb-2">Suggested Next Pick</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {nextPicks.slice(0, 6).map((pick) => (
                <button
                  key={pick.species}
                  onClick={() => {
                    const emptyIdx = team.findIndex(p => !p.species);
                    if (emptyIdx === -1) return;
                    const preset = PRESETS.find((p: any) => p.species === pick.species);
                    const data = getPokemonData(pick.species);
                    const newTeam = [...team];
                    newTeam[emptyIdx] = preset ? {
                      ...createDefaultPokemonState(),
                      species: preset.species,
                      nature: preset.nature,
                      ability: preset.ability,
                      item: preset.item,
                      sps: { ...preset.sps },
                      moves: [...preset.moves, '', '', '', ''].slice(0, 4),
                    } : {
                      ...createDefaultPokemonState(),
                      species: pick.species,
                      ability: (data?.abilities?.[0] || '') as string,
                    };
                    onChange(newTeam);
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-poke-border text-left transition-colors hover:border-poke-red/30"
                  style={{ backgroundColor: '#1a1b30' }}
                >
                  <img src={getSpriteUrl(pick.species)} alt={pick.species} className="w-12 h-12 object-contain shrink-0" loading="lazy" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-white">{pick.species}</span>
                      <span className="text-xs text-poke-gold font-mono">+{pick.score}</span>
                    </div>
                    <div className="text-xs text-slate-500 leading-snug">{pick.reasons.slice(0, 2).join(' · ')}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lineup Flexibility */}
        {audit.lineupReport && audit.lineupReport.lineups.length > 0 && (
          <LineupFlexibilitySection report={audit.lineupReport} format={format} />
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative ml-auto w-full max-w-5xl sm:border-l border-poke-border overflow-y-auto shadow-2xl" style={{ backgroundColor: '#0A0A15' }}>
        {/* Header */}
        <div className="sticky top-0 z-20 border-b border-poke-border" style={{ backgroundColor: '#0A0A15' }}>
          <div className="h-[3px] bg-gradient-to-r from-poke-red via-poke-gold to-poke-blue" />
          <div className="p-3 sm:p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-white">Team Builder</h2>
                <p className="text-[10px] text-slate-500 hidden sm:block">Configure all 6 slots. Auto-fill from live tournament data. Audit analyzes gaps in real time.</p>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 shrink-0" aria-label="Close">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Format selector — drives every recommendation below.
                Prominent placement because Singles vs Doubles is a
                context-defining decision, not a side filter. */}
            <div className="mb-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">
                Battle Format
              </div>
              <FormatSelector value={format.id} onChange={setFormat} />
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleBuildTeam}
                className="text-sm px-4 py-1.5 bg-gradient-to-r from-poke-red to-poke-red-dark text-white rounded-lg font-bold hover:from-poke-red-light hover:to-poke-red transition-all shadow-lg shadow-poke-red/20"
                title="Fill any empty slots with the best candidates for the current team"
              >
                Build Team
              </button>
              <button
                onClick={handleOptimizeAll}
                disabled={isOptimizing}
                className={`text-sm px-4 py-1.5 border rounded-lg font-bold transition-colors flex items-center gap-1.5 ${
                  isOptimizing
                    ? 'bg-poke-gold/25 border-poke-gold/50 text-poke-gold cursor-wait'
                    : 'bg-poke-gold/15 border-poke-gold/40 text-poke-gold hover:bg-poke-gold/25'
                }`}
                title="Re-optimize every slot — fills empty ones and refreshes filled ones with the best available set"
              >
                {isOptimizing ? <PokeballMini /> : <OptimizeIcon className="w-4 h-4" />}
                {isOptimizing ? 'Optimizing...' : 'Optimize All'}
              </button>
              <button onClick={() => setShowImport(!showImport)} className="text-xs px-3 py-1.5 bg-poke-surface border border-poke-border text-slate-400 rounded-lg hover:text-white transition-colors">
                Import
              </button>
              <button onClick={() => onChange(Array.from({ length: 6 }, () => createDefaultPokemonState()))} className="text-xs px-3 py-1.5 bg-poke-surface border border-poke-border text-slate-400 rounded-lg hover:text-poke-red transition-colors">
                Clear
              </button>
              <div className="ml-auto flex items-center gap-2">
                <span className={`text-lg font-black ${scoreColor}`}>{audit.score}</span>
                <span className="text-xs text-slate-500">/100</span>
              </div>
            </div>
          </div>

          {/* Optimization loading overlay */}
          {isOptimizing && (
            <div className="px-4 py-6 flex flex-col items-center gap-3 border-t border-poke-border">
              <PokeballSpinner size={48} label="Analyzing team composition..." />
            </div>
          )}

          {/* Optimization audit log */}
          {optimizeLog.length > 0 && !isOptimizing && (
            <div className="mx-4 mb-3 rounded-lg border border-poke-border bg-poke-surface overflow-hidden">
              <button
                onClick={() => setOptimizeLog([])}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
              >
                <span>Optimization Log ({optimizeLog.length} steps)</span>
                <span className="text-slate-600">Dismiss</span>
              </button>
              <div className="px-3 pb-2 space-y-0.5 max-h-[150px] overflow-y-auto">
                {optimizeLog.map((entry, i) => (
                  <div key={i} className="text-[10px] leading-snug flex items-start gap-1.5">
                    <span className={`shrink-0 ${i === optimizeLog.length - 1 ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {i === optimizeLog.length - 1 ? '✓' : '·'}
                    </span>
                    <span className={i === optimizeLog.length - 1 ? 'text-emerald-300' : 'text-slate-400'}>{entry}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import area */}
          {showImport && (
            <div className="px-4 pb-3">
              <textarea
                className="w-full bg-poke-surface border border-poke-border rounded-lg px-3 py-2 text-xs text-white font-mono resize-none focus:outline-none focus:border-poke-red/50"
                rows={8}
                placeholder="Paste a full Showdown team (6 Pokemon separated by blank lines)..."
                value={importText}
                onChange={e => setImportText(e.target.value)}
              />
              <div className="flex gap-2 mt-2">
                <button onClick={handleImportTeam} className="text-xs px-3 py-1 bg-poke-red text-white rounded-lg hover:bg-poke-red-dark transition-colors">Import</button>
                <button onClick={() => { setShowImport(false); setImportText(''); }} className="text-xs px-3 py-1 bg-poke-surface text-slate-400 rounded-lg hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-3" style={{ overflow: 'visible' }}>
          {/* Team slots */}
          {team.map((pokemon, i) => (
            <TeamSlot
              key={i}
              index={i}
              pokemon={pokemon}
              team={team}
              format={format}
              onChange={state => updateSlot(i, state)}
              onLoadToCalc={side => onLoadToCalc(pokemon, side)}
              onAutoFill={() => handleAutoFill(i)}
              onReplace={(species) => {
                const preset = PRESETS.find((p: any) => p.species === species);
                const data = getPokemonData(species);
                updateSlot(i, preset ? {
                  ...createDefaultPokemonState(),
                  species: preset.species,
                  nature: preset.nature,
                  ability: preset.ability,
                  item: preset.item,
                  sps: { ...preset.sps },
                  moves: [...preset.moves, '', '', '', ''].slice(0, 4),
                } : {
                  ...createDefaultPokemonState(),
                  species,
                  ability: (data?.abilities?.[0] || '') as string,
                });
              }}
            />
          ))}
        </div>

        {/* Team combo insights — surface specific interactions the synergy engine detects */}
        {(() => {
          const filled = team.filter(p => p.species);
          if (filled.length < 2) return null;

          const combos: Array<{ a: string; b: string; reason: SynergyReason }> = [];
          const seen = new Set<string>();
          for (const member of filled) {
            const recs = getRecommendations(member.species);
            for (const rec of recs) {
              if (!filled.some(p => p.species === rec.species)) continue;
              const key = [member.species, rec.species].sort().join('+');
              if (seen.has(key)) continue;
              seen.add(key);
              // Only surface strength ≥ 3 combos (the real discoveries)
              const strongReasons = rec.reasons.filter(r => r.strength >= 3);
              for (const reason of strongReasons) {
                combos.push({ a: member.species, b: rec.species, reason });
              }
            }
          }

          if (combos.length === 0) return null;

          return (
            <div className="p-4 border-t border-poke-border">
              <h3 className="text-sm font-bold text-white mb-1">Team Synergies Detected</h3>
              <p className="text-[10px] text-slate-500 mb-3">Combo interactions between your current team members:</p>
              <div className="space-y-2">
                {combos.slice(0, 6).map((combo, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex items-center gap-1 shrink-0">
                      <Sprite species={combo.a} size="sm" />
                      <span className="text-[10px] text-emerald-400">+</span>
                      <Sprite species={combo.b} size="sm" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-emerald-300">{combo.reason.label}</div>
                      <div className="text-[10px] text-slate-400 leading-snug">{combo.reason.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Suggested next picks */}
        {nextPicks.length > 0 && (
          <div className="p-4 border-t border-poke-border">
            <h3 className="text-sm font-bold text-white mb-2">Suggested Next Pick</h3>
            <p className="text-xs text-slate-500 mb-3">Best Pokemon to fill the next empty slot based on what your team needs:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {nextPicks.slice(0, 4).map((pick) => {
                return (
                  <button
                    key={pick.species}
                    onClick={() => {
                      // Find first empty slot and fill it
                      const emptyIdx = team.findIndex(p => !p.species);
                      if (emptyIdx === -1) return;
                      const preset = PRESETS.find((p: any) => p.species === pick.species);
                      const data = getPokemonData(pick.species);
                      const newTeam = [...team];
                      newTeam[emptyIdx] = preset ? {
                        ...createDefaultPokemonState(),
                        species: preset.species,
                        nature: preset.nature,
                        ability: preset.ability,
                        item: preset.item,
                        sps: { ...preset.sps },
                        moves: [...preset.moves, '', '', '', ''].slice(0, 4),
                      } : {
                        ...createDefaultPokemonState(),
                        species: pick.species,
                        ability: (data?.abilities?.[0] || '') as string,
                      };
                      onChange(newTeam);
                    }}
                    className="flex items-center gap-3 p-3 rounded-lg border border-poke-border text-left transition-colors hover:border-poke-red/30"
                    style={{ backgroundColor: '#1a1b30' }}
                  >
                    <img
                      src={getSpriteUrl(pick.species)}
                      alt={pick.species}
                      className="w-12 h-12 object-contain shrink-0"
                      loading="lazy"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-white">{pick.species}</span>
                        <span className="text-xs text-poke-gold font-mono">+{pick.score}</span>
                      </div>
                      <div className="text-xs text-slate-500 leading-snug">
                        {pick.reasons.slice(0, 2).join(' · ')}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Audit results */}
        <div className="p-4 border-t border-poke-border">
          <h3 className="text-sm font-bold text-white mb-3">Team Analysis</h3>
          <p className="text-xs text-slate-400 mb-3">{audit.summary}</p>

          {/* Role badges */}
          <div className="flex flex-wrap gap-1 mb-3">
            {Object.entries(audit.roleReport).map(([key, value]) => {
              if (typeof value !== 'boolean') return null;
              const labels: Record<string, string> = {
                hasFakeOut: 'Fake Out', hasTailwind: 'Tailwind', hasTrickRoom: 'Trick Room',
                hasIntim: 'Intimidate', hasRedirect: 'Redirect', hasPriority: 'Priority',
                hasHazards: 'Hazards', hasStatusAbsorb: 'Status Block', hasWeatherSetter: 'Weather',
                hasTerrainSetter: 'Terrain', hasPivot: 'Pivot',
              };
              const label = labels[key];
              if (!label) return null;
              return (
                <span key={key} className={`text-[9px] px-1.5 py-0.5 rounded border ${
                  value ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-poke-surface border-poke-border text-slate-600'
                }`}>
                  {value ? '✓' : '✗'} {label}
                </span>
              );
            })}
          </div>

          {/* Issues */}
          <div className="space-y-2 ">
            {criticals.map((issue) => (
              <div key={issue.id} className="p-2 rounded-lg border border-red-500/30 bg-red-500/5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-red-400 text-xs font-bold">✗</span>
                  <span className="text-[9px] px-1 bg-poke-surface text-slate-500 rounded">{issue.category}</span>
                  <span className="text-[10px] font-semibold text-red-400">{issue.title}</span>
                </div>
                <p className="text-[9px] text-slate-400 ml-4">{issue.detail}</p>
                {issue.suggestion && <p className="text-[9px] text-slate-500 ml-4 italic mt-0.5">{issue.suggestion}</p>}
              </div>
            ))}
            {warnings.map((issue) => (
              <div key={issue.id} className="p-2 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-amber-400 text-xs font-bold">⚠</span>
                  <span className="text-[9px] px-1 bg-poke-surface text-slate-500 rounded">{issue.category}</span>
                  <span className="text-[10px] font-semibold text-amber-400">{issue.title}</span>
                </div>
                <p className="text-[9px] text-slate-400 ml-4">{issue.detail}</p>
                {issue.suggestion && <p className="text-[9px] text-slate-500 ml-4 italic mt-0.5">{issue.suggestion}</p>}
              </div>
            ))}
            {goods.map((issue) => (
              <div key={issue.id} className="p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 text-xs font-bold">✓</span>
                  <span className="text-[10px] text-emerald-400">{issue.title}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Lineup Flexibility — pick-N subset analysis */}
          {audit.lineupReport && audit.lineupReport.lineups.length > 0 && (
            <LineupFlexibilitySection report={audit.lineupReport} format={format} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Lineup Flexibility Section ────────────────────────────────────
// Surfaces the pick-3 subset evaluation: best lineups, worst lineup,
// load-bearing members, and a flexibility score. This is the piece
// that tells a player "which 3 should I bring to team preview" at a
// glance instead of just showing the whole 6.

function LineupFlexibilitySection({
  report,
  format,
}: {
  report: import('../calc/lineupAnalysis').TeamFlexibilityReport;
  format: BattleFormat;
}) {
  const topLineups = report.lineups.slice(0, 4);
  const scoreColor = report.score >= 75 ? 'text-emerald-400'
    : report.score >= 55 ? 'text-amber-400'
    : report.score >= 35 ? 'text-orange-400'
    : 'text-red-400';

  return (
    <div className="mt-4 pt-4 border-t border-poke-border">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-bold text-white">{format.label} Lineup Flexibility</h3>
          <p className="text-[10px] text-slate-500">Bring {format.rosterSize}, pick {format.battleSize} — your best {format.battleSize}-mon sub-selections</p>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-lg font-black ${scoreColor}`}>{report.score}</span>
          <span className="text-[10px] text-slate-500">/100</span>
        </div>
      </div>

      {/* Diagnostics */}
      {report.diagnostics.length > 0 && (
        <div className="space-y-1 mb-3">
          {report.diagnostics.map((d, i) => (
            <p key={i} className="text-[10px] text-slate-400 leading-relaxed">
              <span className="text-poke-gold mr-1">→</span>
              {d}
            </p>
          ))}
        </div>
      )}

      {/* Top lineups */}
      <div className="space-y-1.5 mb-3">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Best {format.battleSize}-Mon Picks</div>
        {topLineups.map((lineup, i) => {
          const rankColor = i === 0 ? 'text-emerald-400'
            : i === 1 ? 'text-amber-400'
            : 'text-slate-500';
          return (
            <div key={i} className="p-2 rounded-lg border border-poke-border bg-poke-surface">
              <div className="flex items-start gap-2 mb-1">
                <span className={`text-[10px] font-bold ${rankColor} w-4 shrink-0 pt-0.5`}>#{i + 1}</span>
                <div className="flex gap-1 flex-1 min-w-0 flex-wrap">
                  {lineup.members.map(species => (
                    <div key={species} className="flex items-center gap-1 px-1.5 py-0.5 bg-poke-panel rounded text-[10px] text-white whitespace-nowrap">
                      <Sprite species={species} size="sm" />
                      <span>{species}</span>
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-poke-gold font-mono shrink-0 pt-0.5">{lineup.total}</span>
              </div>
              {lineup.commentary.length > 0 && (
                <p className="text-[9px] text-slate-500 leading-snug ml-5">{lineup.commentary[0]}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Weakest viable subset — the team's worst-case forced pick */}
      {report.weakestLineup && report.weakestLineup.total < (report.bestLineup?.total ?? 0) - 20 && (
        <div className="p-2 rounded-lg border border-red-500/20 bg-red-500/5 mb-3">
          <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Worst Viable Lineup</div>
          <div className="flex items-center gap-1 flex-wrap">
            {report.weakestLineup.members.map(species => (
              <div key={species} className="flex items-center gap-1 px-1.5 py-0.5 bg-poke-panel rounded text-[10px] text-slate-300">
                <Sprite species={species} size="sm" />
                <span>{species}</span>
              </div>
            ))}
            <span className="text-[10px] text-red-400 font-mono ml-auto">{report.weakestLineup.total}</span>
          </div>
          <p className="text-[9px] text-slate-500 mt-1">If forced into this pick, the team is much weaker.</p>
        </div>
      )}

      {/* Load-bearing + underused callouts */}
      {(report.loadBearing.length > 0 || report.underused.length > 0) && (
        <div className="grid grid-cols-2 gap-2">
          {report.loadBearing.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-poke-gold uppercase tracking-wider mb-1">Load-bearing</div>
              <div className="flex flex-wrap gap-2">
                {report.loadBearing.map(lb => (
                  <div key={lb.species} className="flex items-center gap-1 text-[10px] text-white whitespace-nowrap">
                    <Sprite species={lb.species} size="sm" />
                    <span>{lb.species}</span>
                    <span className="text-slate-500">×{lb.appearances}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {report.underused.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Rarely picked</div>
              <div className="flex flex-wrap gap-2">
                {report.underused.map(u => (
                  <div key={u.species} className="flex items-center gap-1 text-[10px] text-slate-400 whitespace-nowrap">
                    <Sprite species={u.species} size="sm" />
                    <span>{u.species}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
