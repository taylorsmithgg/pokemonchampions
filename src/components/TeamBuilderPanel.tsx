import { useState, useMemo, useCallback } from 'react';
import type { StatID } from '@smogon/calc';
import { SearchSelect } from './SearchSelect';
import { auditTeam, type TeamAudit } from '../calc/teamAudit';
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
  onChange,
  onLoadToCalc,
  onAutoFill,
}: {
  index: number;
  pokemon: PokemonState;
  onChange: (state: PokemonState) => void;
  onLoadToCalc: (side: 'attacker' | 'defender') => void;
  onAutoFill: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const allPokemon = getAvailablePokemon();
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
      <div className="p-3">
        {/* Species row */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold text-poke-gold w-4">{index + 1}</span>
          {pokemon.species && (
            <img
              src={`https://play.pokemonshowdown.com/sprites/ani/${spriteId}.gif`}
              alt=""
              className="w-8 h-8 object-contain"
              loading="lazy"
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <div className="flex-1">
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
          <div className="space-y-2 mt-2 border-t border-poke-border pt-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] text-slate-500 mb-0.5">Nature</label>
                <select value={pokemon.nature} onChange={e => update('nature', e.target.value as NatureName)} className="w-full bg-poke-surface border border-poke-border rounded px-1.5 py-1 text-[10px] text-white">
                  {NATURES.map(n => <option key={n.name} value={n.name}>{getNatureLabel(n.name)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 mb-0.5">Item</label>
                <SearchSelect options={allItems} value={pokemon.item} onChange={v => update('item', v)} placeholder="Item..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] text-slate-500 mb-0.5">Ability</label>
                <SearchSelect options={allAbilities} value={pokemon.ability} onChange={v => update('ability', v)} placeholder="Ability..." />
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 mb-0.5">Level</label>
                <input type="number" min={1} max={100} value={pokemon.level} onChange={e => update('level', Math.max(1, Math.min(100, parseInt(e.target.value) || 50)))} className="w-full bg-poke-surface border border-poke-border rounded px-1.5 py-1 text-[10px] text-white text-center" />
              </div>
            </div>

            {/* SP allocation */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[9px] text-slate-500">Stat Points</label>
                <span className={`text-[9px] font-bold ${totalSP === MAX_TOTAL_SP ? 'text-emerald-400' : 'text-amber-400'}`}>{totalSP}/{MAX_TOTAL_SP}</span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {STAT_IDS.map(stat => (
                  <div key={stat} className="text-center">
                    <label className="block text-[8px] text-slate-600">{STAT_LABELS[stat]}</label>
                    <input
                      type="number" min={0} max={MAX_STAT_SP} value={pokemon.sps[stat]}
                      onChange={e => {
                        const v = Math.min(MAX_STAT_SP, Math.max(0, parseInt(e.target.value) || 0));
                        update('sps', { ...pokemon.sps, [stat]: v });
                      }}
                      className="w-full bg-poke-surface border border-poke-border rounded text-[10px] text-center text-white py-0.5"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Moves */}
            <div>
              <label className="block text-[9px] text-slate-500 mb-0.5">Moves</label>
              <div className="grid grid-cols-2 gap-1">
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

  const handleAutoFillAll = useCallback(() => {
    const newTeam = team.map((p) => {
      if (!p.species || !liveStats) return p;
      const liveSet = getLiveSet(liveStats, p.species);
      if (!liveSet) return p;
      return {
        ...p,
        nature: liveSet.nature,
        sps: liveSet.sps,
        ability: liveSet.ability,
        item: liveSet.item,
        teraType: '',
        moves: [...liveSet.moves, '', '', '', ''].slice(0, 4),
      };
    });
    onChange(newTeam);
  }, [team, liveStats, onChange]);

  const scoreColor = audit.score >= 80 ? 'text-emerald-400' : audit.score >= 60 ? 'text-amber-400' : audit.score >= 40 ? 'text-orange-400' : 'text-red-400';
  const criticals = audit.issues.filter(i => i.severity === 'critical');
  const warnings = audit.issues.filter(i => i.severity === 'warning');
  const goods = audit.issues.filter(i => i.severity === 'good');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative ml-auto w-full max-w-3xl border-l border-poke-border overflow-y-auto shadow-2xl" style={{ backgroundColor: '#0A0A15' }}>
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
              <button onClick={() => setShowImport(!showImport)} className="text-[10px] px-2.5 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded-lg hover:text-white transition-colors">
                Import Team
              </button>
              <button onClick={handleAutoFillAll} className="text-[10px] px-2.5 py-1 bg-poke-gold/10 border border-poke-gold/30 text-poke-gold rounded-lg hover:bg-poke-gold/20 transition-colors">
                Auto-fill All (Live Data)
              </button>
              <button onClick={() => onChange(Array.from({ length: 6 }, () => createDefaultPokemonState()))} className="text-[10px] px-2.5 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded-lg hover:text-poke-red transition-colors">
                Clear All
              </button>
              <div className="ml-auto flex items-center gap-2">
                <span className={`text-sm font-bold ${scoreColor}`}>{audit.score}</span>
                <span className="text-[10px] text-slate-500">/100</span>
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
              onChange={state => updateSlot(i, state)}
              onLoadToCalc={side => onLoadToCalc(pokemon, side)}
              onAutoFill={() => handleAutoFill(i)}
            />
          ))}
        </div>

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
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
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
