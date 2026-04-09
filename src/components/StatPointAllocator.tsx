import { useState, useMemo } from 'react';
import type { StatID, StatsTable } from '@smogon/calc';
import { MAX_TOTAL_SP, MAX_STAT_SP, STAT_IDS, STAT_LABELS, STAT_COLORS, getNatureMod } from '../data/champions';
import { suggestSpreads, type SpreadSuggestion } from '../calc/spOptimizer';
import { getArchetypes, detectArchetype, type Archetype } from '../calc/archetypes';
import type { NatureName } from '../types';

interface StatPointAllocatorProps {
  species: string;
  sps: StatsTable;
  baseStats: StatsTable;
  nature: NatureName;
  level: number;
  moves: string[];
  ability: string;
  item: string;
  onChange: (sps: StatsTable) => void;
  onNatureChange?: (nature: NatureName) => void;
  onApplySpread?: (sps: StatsTable, nature: NatureName) => void;
  onApplyArchetype?: (arch: Archetype) => void;
}

export function StatPointAllocator({ species, sps, baseStats, nature, level, onChange, onApplySpread, onApplyArchetype }: StatPointAllocatorProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const totalUsed = Object.values(sps).reduce((a, b) => a + b, 0);
  const remaining = MAX_TOTAL_SP - totalUsed;

  const suggestions = useMemo(() => {
    if (!species) return [];
    return suggestSpreads(species, level);
  }, [species, level]);

  const archetypes = useMemo(() => {
    if (!species) return [];
    return getArchetypes(species);
  }, [species]);

  const currentArchetype = useMemo(() => {
    if (!species) return '';
    return detectArchetype(species, sps, nature);
  }, [species, sps, nature]);

  function handleChange(stat: StatID, value: number) {
    const currentOther = totalUsed - sps[stat];
    const maxAllowed = Math.min(MAX_STAT_SP, MAX_TOTAL_SP - currentOther);
    const clamped = Math.max(0, Math.min(value, maxAllowed));
    onChange({ ...sps, [stat]: clamped });
  }

  function calcStat(stat: StatID): number {
    const base = baseStats[stat];
    const sp = sps[stat];
    const natureMod = getNatureMod(nature, stat);
    if (stat === 'hp') {
      if (base === 1) return 1;
      return Math.floor(((2 * base + 31 + Math.floor(sp / 4)) * level) / 100) + level + 10;
    }
    return Math.floor(
      (Math.floor(((2 * base + 31 + Math.floor(sp / 4)) * level) / 100) + 5) * natureMod
    );
  }

  function applySuggestion(s: SpreadSuggestion) {
    if (onApplySpread) {
      onApplySpread({ ...s.sps }, s.nature);
    } else {
      onChange({ ...s.sps });
    }
    setShowSuggestions(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-400">Stat Points</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${remaining === 0 ? 'text-emerald-400' : remaining < 0 ? 'text-red-400' : 'text-amber-400'}`}>
            {totalUsed} used / {remaining} free
          </span>
          {currentArchetype && (
            <span className="text-xs text-poke-gold px-2 py-0.5 rounded bg-poke-gold/10 border border-poke-gold/20">
              {currentArchetype}
            </span>
          )}
          {(archetypes.length > 0 || suggestions.length > 0) && (
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                showSuggestions
                  ? 'bg-poke-red/20 border-poke-red/50 text-poke-red-light'
                  : 'bg-poke-surface border-poke-border text-slate-500 hover:text-poke-red-light hover:border-poke-red/50'
              }`}
            >
              Archetypes
            </button>
          )}
        </div>
      </div>

      {/* Archetypes + Spread suggestions */}
      {showSuggestions && (
        <div className="mb-3 space-y-2 p-3 rounded-lg border border-poke-border" style={{ backgroundColor: '#12121F' }}>
          {/* Archetypes (full sets with moves + items) */}
          {archetypes.length > 0 && (
            <>
              <div className="text-sm font-semibold text-white">Archetypes</div>
              <div className="text-xs text-slate-500 mb-1">Full competitive sets — click to apply SP spread, moves, and item</div>
              {archetypes.map((arch, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg border border-poke-border cursor-pointer hover:border-poke-red/30 transition-colors"
                  style={{ backgroundColor: '#1a1b30' }}
                  onClick={() => {
                    if (onApplyArchetype) {
                      onApplyArchetype(arch);
                    } else if (onApplySpread) {
                      onApplySpread({ ...arch.sps }, arch.nature);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-white">{arch.name}</span>
                    <div className="flex gap-1">
                      {arch.tags.map(tag => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 bg-poke-red/10 text-poke-red-light rounded">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mb-2">{arch.description}</div>
                  <div className="text-sm font-mono text-amber-400/80 mb-1">
                    {Object.entries(arch.sps).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${STAT_LABELS[k as StatID]}`).join(' / ')} — {arch.nature}
                  </div>
                  {arch.moves.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {arch.moves.map(m => (
                        <span key={m} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#12121F' }}>{m}</span>
                      ))}
                    </div>
                  )}
                  {arch.item && (
                    <div className="text-xs text-poke-gold">Item: {arch.item}</div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* SP-only spreads (secondary) */}
          {suggestions.length > 0 && (
            <>
              <div className="text-sm font-semibold text-white mt-3 pt-3 border-t border-poke-border">SP-Only Spreads</div>
              <div className="text-xs text-slate-500 mb-1">Stat allocation only — keeps your current moves and item</div>
              {suggestions.slice(0, 3).map((s, i) => (
                <div
                  key={i}
                  className="p-2 rounded-lg border border-poke-border cursor-pointer hover:border-poke-red/30 transition-colors"
                  style={{ backgroundColor: '#1a1b30' }}
                  onClick={() => applySuggestion(s)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{s.name}</span>
                    <span className="text-xs text-slate-600">{s.nature}</span>
                  </div>
                  <div className="text-xs font-mono text-amber-400/80">
                    {Object.entries(s.sps).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${STAT_LABELS[k as StatID]}`).join(' / ')}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Stat sliders */}
      {STAT_IDS.map(stat => {
        const base = baseStats[stat];
        const calculated = calcStat(stat);
        const natureMod = getNatureMod(nature, stat);
        const natureIndicator = natureMod > 1 ? '+' : natureMod < 1 ? '-' : '';
        const natureColor = natureMod > 1 ? 'text-red-400' : natureMod < 1 ? 'text-blue-400' : 'text-slate-500';

        return (
          <div key={stat} className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-semibold w-10 ${natureColor}`}>
              {natureIndicator}{STAT_LABELS[stat]}
            </span>
            <span className="text-sm text-slate-600 w-8 text-right">{base}</span>
            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={MAX_STAT_SP}
                value={sps[stat]}
                onChange={e => handleChange(stat, parseInt(e.target.value))}
                className="w-full"
                style={{
                  background: `linear-gradient(to right, ${STAT_COLORS[stat]}80 0%, ${STAT_COLORS[stat]}80 ${(sps[stat] / MAX_STAT_SP) * 100}%, #334155 ${(sps[stat] / MAX_STAT_SP) * 100}%)`,
                }}
              />
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={sps[stat]}
              onChange={e => handleChange(stat, parseInt(e.target.value) || 0)}
              className="w-12 bg-poke-surface border border-poke-border rounded text-sm text-center text-white"
              style={{ minHeight: '28px', fontSize: '14px', padding: '2px 4px' }}
            />
            <span className="text-sm font-mono text-white w-10 text-right font-bold">
              {calculated}
            </span>
          </div>
        );
      })}

      {/* Quick actions */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => onChange({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 })}
          className="text-xs px-3 py-1 bg-poke-surface hover:bg-poke-border text-slate-400 rounded transition-colors"
        >
          Clear
        </button>
        <button
          onClick={() => onChange({ hp: 11, atk: 11, def: 11, spa: 11, spd: 11, spe: 11 })}
          className="text-xs px-3 py-1 bg-poke-surface hover:bg-poke-border text-slate-400 rounded transition-colors"
        >
          Even
        </button>
      </div>
    </div>
  );
}
