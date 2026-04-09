import { useMemo } from 'react';
import type { UsageStats } from '../data/liveData';
import { usageToTier } from '../data/liveData';
import { getAvailablePokemon } from '../data/champions';
import type { NatureName } from '../types';
import type { StatsTable } from '@smogon/calc';

interface LiveUsagePanelProps {
  species: string;
  stats: UsageStats;
  onLoadSet: (set: { nature: NatureName; sps: StatsTable; ability: string; item: string; moves: string[] }) => void;
}

function parseSpread(spreadStr: string): { nature: NatureName; evs: number[] } | null {
  const [nature, evStr] = spreadStr.split(':');
  if (!nature || !evStr) return null;
  const evs = evStr.split('/').map(Number);
  if (evs.length !== 6) return null;
  return { nature: nature as NatureName, evs };
}

function evsToSps(evs: number[]): StatsTable {
  const sps: StatsTable = {
    hp: Math.min(32, Math.round(evs[0] / 8)),
    atk: Math.min(32, Math.round(evs[1] / 8)),
    def: Math.min(32, Math.round(evs[2] / 8)),
    spa: Math.min(32, Math.round(evs[3] / 8)),
    spd: Math.min(32, Math.round(evs[4] / 8)),
    spe: Math.min(32, Math.round(evs[5] / 8)),
  };
  // Normalize to 66
  let total = Object.values(sps).reduce((a, b) => a + b, 0);
  while (total > 66) {
    const entries = Object.entries(sps).filter(([, v]) => v > 0).sort((a, b) => a[1] - b[1]);
    if (entries.length === 0) break;
    (sps as any)[entries[0][0]]--;
    total--;
  }
  return sps;
}

export function LiveUsagePanel({ species, stats, onLoadSet }: LiveUsagePanelProps) {
  const data = useMemo(() => {
    if (!species || !stats?.pokemon) return null;
    return stats.pokemon[species] || null;
  }, [species, stats]);

  if (!data) return null;

  const usagePct = (data.usage.weighted * 100).toFixed(1);
  const tier = usageToTier(data.usage.weighted * 100);
  const tierColors: Record<string, string> = {
    S: 'text-red-400 bg-red-500/10', 'A+': 'text-orange-400 bg-orange-500/10',
    A: 'text-amber-400 bg-amber-500/10', B: 'text-emerald-400 bg-emerald-500/10',
    C: 'text-sky-400 bg-sky-500/10',
  };

  const topMoves = Object.entries(data.moves).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topItems = Object.entries(data.items).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topAbilities = Object.entries(data.abilities).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const championsPool = new Set(getAvailablePokemon());
  const topTeammates = Object.entries(data.teammates).filter(([n]) => championsPool.has(n)).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topSpreads = Object.entries(data.spreads).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="bg-slate-800/30 rounded-lg border border-slate-700/30 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Live Usage Data</span>
          <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">VGC 2026</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${tierColors[tier] || ''} font-bold`}>{tier}</span>
          <span className="text-[10px] text-slate-500">{usagePct}% usage</span>
        </div>
      </div>

      <div className="p-2.5 space-y-2.5">
        {/* Popular sets (click to load) */}
        {topSpreads.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Popular Sets</h4>
            <div className="space-y-1">
              {topSpreads.map(([spreadStr, weight], i) => {
                const parsed = parseSpread(spreadStr);
                if (!parsed) return null;
                const sps = evsToSps(parsed.evs);
                const statLabels: Record<string, string> = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
                const spStr = Object.entries(sps)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => `${v} ${statLabels[k]}`)
                  .join(' / ');

                return (
                  <div
                    key={i}
                    className="p-1.5 bg-slate-900/50 rounded border border-slate-700/30 hover:border-indigo-500/30 cursor-pointer transition-colors flex items-center justify-between gap-2"
                    onClick={() => onLoadSet({
                      nature: parsed.nature,
                      sps,
                      ability: topAbilities[0]?.[0] || '',
                      item: topItems[0]?.[0] || '',
                      moves: topMoves.slice(0, 4).map(([n]) => n),
                    })}
                  >
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono text-amber-400/80 truncate">{spStr} — {parsed.nature}</div>
                    </div>
                    <span className="text-[9px] text-slate-600 shrink-0">{(weight * 100).toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Moves */}
        <div>
          <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Moves</h4>
          <div className="flex flex-wrap gap-1">
            {topMoves.map(([name, usage]) => (
              <span key={name} className="text-[9px] px-1.5 py-0.5 bg-slate-900/80 text-slate-300 rounded flex items-center gap-1">
                {name}
                <span className="text-slate-600">{(usage * 100).toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </div>

        {/* Items + Abilities in a grid */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Items</h4>
            {topItems.slice(0, 3).map(([name, usage]) => (
              <div key={name} className="text-[9px] text-slate-400 truncate">
                {name} <span className="text-slate-600">{(usage * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <div>
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Abilities</h4>
            {topAbilities.map(([name, usage]) => (
              <div key={name} className="text-[9px] text-slate-400 truncate">
                {name} <span className="text-slate-600">{(usage * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Teammates */}
        <div>
          <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Top Teammates</h4>
          <div className="flex flex-wrap gap-1">
            {topTeammates.map(([name, usage]) => (
              <span key={name} className="text-[9px] px-1.5 py-0.5 bg-emerald-500/5 text-emerald-400/80 rounded border border-emerald-500/10">
                {name} <span className="text-slate-600">{(usage * 100).toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
