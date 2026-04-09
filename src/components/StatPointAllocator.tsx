import { useState, useMemo } from 'react';
import type { StatID, StatsTable } from '@smogon/calc';
import { MAX_TOTAL_SP, MAX_STAT_SP, STAT_IDS, STAT_LABELS, STAT_COLORS, getNatureMod } from '../data/champions';
import { suggestSpreads, type SpreadSuggestion } from '../calc/spOptimizer';
import { analyzeForMeta, type MetaAnalysis } from '../calc/metaBenchmarks';
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
}

export function StatPointAllocator({ species, sps, baseStats, nature, level, moves, ability, item, onChange, onNatureChange, onApplySpread }: StatPointAllocatorProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const totalUsed = Object.values(sps).reduce((a, b) => a + b, 0);
  const remaining = MAX_TOTAL_SP - totalUsed;

  const suggestions = useMemo(() => {
    if (!species) return [];
    return suggestSpreads(species, level);
  }, [species, level]);

  const metaAnalysis = useMemo<MetaAnalysis | null>(() => {
    if (!species || !showMeta) return null;
    const activeMoves = moves.filter(Boolean);
    if (activeMoves.length === 0) return null;
    return analyzeForMeta(species, activeMoves, ability, item, level);
  }, [species, moves, ability, item, level, showMeta]);

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
      if (onNatureChange) onNatureChange(s.nature);
    }
    setShowSuggestions(false);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400">Stat Points</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${remaining === 0 ? 'text-emerald-400' : remaining < 0 ? 'text-red-400' : 'text-amber-400'}`}>
            {totalUsed} used / {remaining} free
          </span>
          {suggestions.length > 0 && (
            <button
              onClick={() => { setShowSuggestions(!showSuggestions); setShowMeta(false); }}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                showSuggestions
                  ? 'bg-poke-red/20 border-poke-red/50 text-poke-red-light'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-poke-red-light hover:border-poke-red/50'
              }`}
            >
              Optimize
            </button>
          )}
          {species && (
            <button
              onClick={() => { setShowMeta(!showMeta); setShowSuggestions(false); }}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                showMeta
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-amber-400 hover:border-amber-500/50'
              }`}
            >
              Meta
            </button>
          )}
        </div>
      </div>

      {/* SP Optimizer suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="mb-3 space-y-1.5 p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div className="text-[10px] text-slate-500 mb-1">Suggested spreads for {species}:</div>
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="p-2 bg-slate-900/80 rounded-lg border border-slate-700/30 hover:border-poke-red/30 cursor-pointer transition-colors group"
              onClick={() => applySuggestion(s)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-white">{s.name}</span>
                <div className="flex gap-1">
                  {s.tags.map(tag => (
                    <span key={tag} className="text-[8px] px-1 py-0 bg-poke-red/10 text-poke-red-light rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-[10px] text-slate-400 mb-1">{s.description}</div>
              <div className="text-[10px] font-mono text-amber-400/80 mb-1">
                {Object.entries(s.sps)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => `${v} ${STAT_LABELS[k as StatID]}`)
                  .join(' / ')
                } — {s.nature}
              </div>
              {/* Show first rationale point */}
              <div className="text-[9px] text-slate-600 italic">
                {s.rationale[0]}
              </div>
              {/* Show more on hover */}
              {s.rationale.length > 1 && (
                <div className="hidden group-hover:block mt-1 space-y-0.5">
                  {s.rationale.slice(1).map((r, j) => (
                    <div key={j} className="text-[9px] text-slate-600 italic">{r}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Meta Benchmarks */}
      {showMeta && metaAnalysis && (
        <div className="mb-3 p-2 bg-slate-800/50 rounded-lg border border-amber-500/20 space-y-3 max-h-[400px] overflow-y-auto">
          {/* Meta-optimized spread */}
          {metaAnalysis.suggestedSpread && (
            <div
              className="p-2 bg-amber-500/5 rounded-lg border border-amber-500/20 cursor-pointer hover:border-amber-500/40 transition-colors"
              onClick={() => {
                if (onApplySpread) {
                  onApplySpread({ ...metaAnalysis.suggestedSpread!.sps }, metaAnalysis.suggestedSpread!.nature);
                } else {
                  onChange({ ...metaAnalysis.suggestedSpread!.sps });
                  if (onNatureChange) onNatureChange(metaAnalysis.suggestedSpread!.nature);
                }
                setShowMeta(false);
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-amber-400">{metaAnalysis.suggestedSpread.name}</span>
                <span className="text-[8px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">click to apply</span>
              </div>
              <div className="text-[10px] font-mono text-amber-400/80 mb-1.5">
                {Object.entries(metaAnalysis.suggestedSpread.sps)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => `${v} ${STAT_LABELS[k as StatID]}`)
                  .join(' / ')
                } — {metaAnalysis.suggestedSpread.nature}
              </div>
              {metaAnalysis.suggestedSpread.reasoning.map((r: string, i: number) => (
                <div key={i} className="text-[9px] text-slate-400 flex gap-1 items-start">
                  <span className="text-amber-500 shrink-0">→</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}

          {/* Speed benchmarks */}
          {metaAnalysis.speedBenchmarks.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Speed Targets</h4>
              <div className="space-y-0.5">
                {metaAnalysis.speedBenchmarks.slice(0, 5).map((b, i) => (
                  <div key={i} className="text-[10px] text-slate-400 flex gap-1.5">
                    <span className="text-sky-400 font-mono shrink-0 w-6 text-right">{b.minSP}</span>
                    <span className="text-slate-600">Spe →</span>
                    <span>outspeeds <span className="text-white">{b.target}</span> ({b.targetSpeed})</span>
                    {b.withNature && <span className="text-amber-500 text-[9px]">+Spe</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Offensive benchmarks */}
          {metaAnalysis.offensiveBenchmarks.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Offensive KOs</h4>
              <div className="space-y-0.5">
                {metaAnalysis.offensiveBenchmarks.slice(0, 5).map((b, i) => (
                  <div key={i} className="text-[10px] text-slate-400 flex gap-1.5">
                    <span className={`font-mono shrink-0 w-6 text-right ${b.result === 'OHKO' ? 'text-red-400' : 'text-orange-400'}`}>{b.minSP}</span>
                    <span className="text-slate-600">→</span>
                    <span>
                      <span className={b.result === 'OHKO' ? 'text-red-400' : 'text-orange-400'}>{b.result}</span>
                      {' '}<span className="text-white">{b.target}</span> with {b.move}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Defensive benchmarks */}
          {metaAnalysis.defensiveBenchmarks.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Defensive Calcs</h4>
              <div className="space-y-0.5">
                {metaAnalysis.defensiveBenchmarks.slice(0, 5).map((b, i) => (
                  <div key={i} className="text-[10px] text-slate-400 flex gap-1.5">
                    <span className={`shrink-0 ${b.result === 'survives' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {b.result === 'survives' ? '✓' : '✗'}
                    </span>
                    <span>
                      <span className="text-white">{b.attacker}</span>'s {b.move}: {b.damageRange}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {metaAnalysis.offensiveBenchmarks.length === 0 && metaAnalysis.defensiveBenchmarks.length === 0 && (
            <div className="text-[10px] text-slate-600 text-center py-2">
              Add moves to see offensive benchmarks against meta threats
            </div>
          )}
        </div>
      )}

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
      <div className="flex gap-1.5 mt-2">
        <button
          onClick={() => onChange({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 })}
          className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition-colors"
        >
          Clear
        </button>
        <button
          onClick={() => onChange({ hp: 11, atk: 11, def: 11, spa: 11, spd: 11, spe: 11 })}
          className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition-colors"
        >
          Even
        </button>
      </div>
    </div>
  );
}
