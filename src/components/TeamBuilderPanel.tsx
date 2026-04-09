import { useState, useMemo, useCallback } from 'react';
import type { StatID } from '@smogon/calc';
import { SearchSelect } from './SearchSelect';
import { auditTeam, type TeamAudit } from '../calc/teamAudit';
import { buildOptimalTeam, suggestNextPick } from '../calc/teamBuilder';
import { PRESETS } from '../data/presets';
import { NORMAL_TIER_LIST } from '../data/tierlist';
import { getSpriteUrl } from '../utils/sprites';
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
  onChange,
  onLoadToCalc,
  onAutoFill,
  onReplace,
}: {
  index: number;
  pokemon: PokemonState;
  team: PokemonState[];
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
    const picks = suggestNextPick(team, 50);
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
  }, [team]);

  // Replacement suggestions — what would fit better in this slot?
  const [showReplacements, setShowReplacements] = useState(false);
  const replacements = useMemo(() => {
    if (!pokemon.species || !showReplacements) return [];
    // Remove this slot from the team temporarily
    const teamWithout = team.map((p, i) => i === index ? createDefaultPokemonState() : p);
    return suggestNextPick(teamWithout, 4);
  }, [pokemon.species, team, index, showReplacements]);

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

  const spriteId = pokemon.species?.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') || '';
  const totalSP = Object.values(pokemon.sps).reduce((a: number, b: number) => a + b, 0);

  return (
    <div className={`poke-panel ${!pokemon.species ? 'opacity-60' : ''}`}>
      <div className="p-4">
        {/* Species row */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm font-bold text-poke-gold w-5">{index + 1}</span>
          {pokemon.species && (
            <img
              src={`https://play.pokemonshowdown.com/sprites/ani/${spriteId}.gif`}
              alt=""
              className="w-12 h-12 object-contain shrink-0"
              loading="lazy"
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }}
            />
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
            <div className="flex gap-0.5">
              <button
                onClick={onAutoFill}
                className="text-[8px] px-1.5 py-0.5 bg-poke-gold/15 text-poke-gold border border-poke-gold/30 rounded hover:bg-poke-gold/25 transition-colors"
                title="Auto-fill optimal set from live data"
              >
                Auto
              </button>
              <button onClick={() => onLoadToCalc('attacker')} className="text-[8px] px-1.5 py-0.5 bg-poke-red/15 text-poke-red-light border border-poke-red/30 rounded hover:bg-poke-red/25">ATK</button>
              <button onClick={() => onLoadToCalc('defender')} className="text-[8px] px-1.5 py-0.5 bg-poke-blue/15 text-poke-blue-light border border-poke-blue/30 rounded hover:bg-poke-blue/25">DEF</button>
              <button onClick={() => setExpanded(!expanded)} className="text-[8px] px-1 py-0.5 text-slate-500 hover:text-white">
                {expanded ? '−' : '+'}
              </button>
            </div>
          )}
        </div>

        {/* Mini summary when collapsed */}
        {pokemon.species && !expanded && data && (
          <div className="space-y-0.5 mt-1">
            <div className="flex gap-1 text-[9px] text-slate-500">
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

        {/* Replacement suggestions */}
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{pick.species}</span>
                          <span className="text-xs text-poke-gold font-mono">+{pick.score}</span>
                        </div>
                        <div className="text-xs text-slate-500 leading-snug truncate">
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

export function TeamBuilderPanel({ team, onChange, onLoadToCalc, isOpen, onClose }: TeamBuilderPanelProps) {
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const { stats: liveStats } = useLiveData();

  const audit = useMemo<TeamAudit>(() => auditTeam(team), [team]);

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

  // Build a full optimal team from scratch (fills empty slots)
  const handleBuildTeam = useCallback(() => {
    const built = buildOptimalTeam(team);
    onChange(built);
  }, [team, onChange]);

  // Fill all empty slots with next best picks
  const handleFillEmpty = useCallback(() => {
    const built = buildOptimalTeam(team);
    onChange(built);
  }, [team, onChange]);

  // Get suggestions for next pick
  const nextPicks = useMemo(() => {
    const hasEmpty = team.some(p => !p.species);
    if (!hasEmpty) return [];
    return suggestNextPick(team, 6);
  }, [team]);

  const scoreColor = audit.score >= 80 ? 'text-emerald-400' : audit.score >= 60 ? 'text-amber-400' : audit.score >= 40 ? 'text-orange-400' : 'text-red-400';
  const criticals = audit.issues.filter(i => i.severity === 'critical');
  const warnings = audit.issues.filter(i => i.severity === 'warning');
  const goods = audit.issues.filter(i => i.severity === 'good');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative ml-auto w-full max-w-5xl border-l border-poke-border overflow-y-auto shadow-2xl" style={{ backgroundColor: '#0A0A15' }}>
        {/* Header */}
        <div className="sticky top-0 z-20 border-b border-poke-border" style={{ backgroundColor: '#0A0A15' }}>
          <div className="h-[3px] bg-gradient-to-r from-poke-red via-poke-gold to-poke-blue" />
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-white">Team Builder</h2>
                <p className="text-[10px] text-slate-500">Configure all 6 slots. Auto-fill from live tournament data. Audit analyzes gaps in real time.</p>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleBuildTeam}
                className="text-sm px-4 py-1.5 bg-gradient-to-r from-poke-red to-poke-red-dark text-white rounded-lg font-bold hover:from-poke-red-light hover:to-poke-red transition-all shadow-lg shadow-poke-red/20"
              >
                Build Optimal Team
              </button>
              <button onClick={handleFillEmpty} className="text-xs px-3 py-1.5 bg-poke-gold/10 border border-poke-gold/30 text-poke-gold rounded-lg hover:bg-poke-gold/20 transition-colors">
                Fill Empty Slots
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

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3" style={{ overflow: 'visible' }}>
          {/* Team slots */}
          {team.map((pokemon, i) => (
            <TeamSlot
              key={i}
              index={i}
              pokemon={pokemon}
              team={team}
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
        </div>
      </div>
    </div>
  );
}
