import { useState } from 'react';
import { useMetaRadar } from '../hooks/useMetaRadar';
import { Sprite } from './Sprite';
import { QuickAdd } from './QuickAdd';
import { GenBadge } from './GenBadge';
import type { MetaScore } from '../calc/metaRadar';

const TIER_COLORS: Record<string, string> = {
  S: 'text-red-400 bg-red-500/10 border-red-500/30',
  A: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  B: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  C: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  D: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

const TREND_ICONS: Record<string, { icon: string; color: string }> = {
  rising: { icon: '↑', color: 'text-emerald-400' },
  stable: { icon: '—', color: 'text-slate-500' },
  falling: { icon: '↓', color: 'text-red-400' },
  new: { icon: '★', color: 'text-poke-gold' },
};

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1.5 bg-poke-surface rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / max) * 100}%` }} />
    </div>
  );
}

function RankingCard({ score }: { score: MetaScore }) {
  const [expanded, setExpanded] = useState(false);
  const tierStyle = TIER_COLORS[score.tier] || TIER_COLORS.D;
  const trend = TREND_ICONS[score.trend] || TREND_ICONS.stable;

  return (
    <div className="poke-panel cursor-pointer hover:border-poke-red/20 transition-colors" onClick={() => setExpanded(!expanded)}>
      <div className="p-3 flex items-center gap-3">
        <div className="shrink-0"><Sprite species={score.species} size="md" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="text-sm font-bold text-white whitespace-nowrap">{score.species}</span>
            <GenBadge species={score.species} />
            <span className={`text-xs font-black px-1.5 py-0.5 rounded border whitespace-nowrap ${tierStyle}`}>{score.tier}</span>
            <span className={`text-sm font-bold ${trend.color}`}>{trend.icon}</span>
            <span className="text-xs text-slate-600 ml-auto whitespace-nowrap">{score.score} pts</span>
          </div>
          {score.insight && <p className="text-xs text-slate-500 line-clamp-2 leading-snug">{score.insight}</p>}
        </div>
        <div className="shrink-0 self-center"><QuickAdd species={score.species} /></div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 border-t border-poke-border pt-2 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Offense</span>
              <ScoreBar value={score.components.offensiveThreat} max={25} color="bg-red-500" />
            </div>
            <div>
              <span className="text-slate-500">Defense</span>
              <ScoreBar value={score.components.defensiveValue} max={25} color="bg-sky-500" />
            </div>
            <div>
              <span className="text-slate-500">Speed</span>
              <ScoreBar value={score.components.speedControl} max={15} color="bg-amber-500" />
            </div>
            <div>
              <span className="text-slate-500">Role</span>
              <ScoreBar value={score.components.roleValue} max={15} color="bg-purple-500" />
            </div>
            <div>
              <span className="text-slate-500">Usage</span>
              <ScoreBar value={score.components.usageSignal} max={10} color="bg-emerald-500" />
            </div>
            <div>
              <span className="text-slate-500">Synergy</span>
              <ScoreBar value={score.components.synergyDensity} max={10} color="bg-poke-gold" />
            </div>
          </div>
          {score.topMoves.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {score.topMoves.map(m => (
                <span key={m} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#12121F' }}>{m}</span>
              ))}
            </div>
          )}
          {score.topTeammates.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Partners:</span>
              {score.topTeammates.map(t => (
                <Sprite key={t} species={t} size="sm" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MetaRadarPanel() {
  const { report, loading, lastRefresh, refresh } = useMetaRadar();
  const [showAll, setShowAll] = useState(false);

  if (!report) return null;

  const shown = showAll ? report.rankings : report.rankings.slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="poke-panel">
        <div className="poke-panel-header bg-gradient-to-r from-poke-red/10 to-poke-blue/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Meta Radar</h2>
              <p className="text-xs text-slate-500">Dynamic rankings — re-analyzed from live data + Champions constraints</p>
            </div>
            <div className="flex items-center gap-2">
              {loading && <span className="text-xs text-poke-gold animate-pulse">Scanning...</span>}
              <button onClick={refresh} className="text-xs px-2.5 py-1.5 bg-poke-surface border border-poke-border text-slate-400 rounded-lg hover:text-white transition-colors">
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="p-4">
          {/* Insights */}
          {report.insights.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {report.insights.map((insight, i) => (
                <div key={i} className="text-sm text-slate-400 flex gap-2">
                  <span className="text-poke-gold shrink-0">→</span>
                  <span>{insight}</span>
                </div>
              ))}
            </div>
          )}

          {/* Rising / Falling */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {report.risingThreats.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">↑ Rising</h4>
                <div className="space-y-1">
                  {report.risingThreats.slice(0, 3).map(s => (
                    <div key={s.species} className="flex items-center gap-2 p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                      <div className="shrink-0"><Sprite species={s.species} size="sm" /></div>
                      <span className="text-sm text-white flex-1 min-w-0">{s.species}</span>
                      <span className="text-xs text-emerald-400">+{s.score}</span>
                      <QuickAdd species={s.species} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {report.fallingPicks.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">↓ Falling</h4>
                <div className="space-y-1">
                  {report.fallingPicks.slice(0, 3).map(s => (
                    <div key={s.species} className="flex items-center gap-2 p-2 rounded-lg border border-red-500/20 bg-red-500/5">
                      <div className="shrink-0"><Sprite species={s.species} size="sm" /></div>
                      <span className="text-sm text-white flex-1 min-w-0">{s.species}</span>
                      <span className="text-xs text-red-400">{s.score}</span>
                      <QuickAdd species={s.species} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Emerging Cores */}
          {report.emergingCores.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-bold text-poke-gold uppercase tracking-wider mb-2">Emerging Cores</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {report.emergingCores.slice(0, 4).map((core, i) => (
                  <div key={i} className="p-2 rounded-lg border border-poke-gold/20 bg-poke-gold/5">
                    <div className="flex items-start gap-2 mb-1.5">
                      <div className="shrink-0 flex items-center gap-1">
                        <Sprite species={core.pokemon[0]} size="sm" />
                        <span className="text-xs text-slate-500">+</span>
                        <Sprite species={core.pokemon[1]} size="sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white font-semibold leading-tight">{core.pokemon.join(' + ')}</div>
                        <div className="text-[10px] text-slate-500 line-clamp-2 leading-snug mt-0.5">{core.winCondition} · {core.coverage}% coverage</div>
                      </div>
                      <span className="text-xs text-poke-gold font-mono shrink-0">{core.pairing}%</span>
                    </div>
                    <div className="flex items-center gap-2 justify-between">
                      <QuickAdd species={core.pokemon[0]} actions={['attacker', 'team']} />
                      <QuickAdd species={core.pokemon[1]} actions={['defender', 'team']} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Rankings */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Dynamic Rankings</h3>
        <button onClick={() => setShowAll(!showAll)} className="text-xs text-slate-400 hover:text-white transition-colors">
          {showAll ? 'Show Top 10' : `Show All (${report.rankings.length})`}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {shown.map(score => (
          <RankingCard key={score.species} score={score} />
        ))}
      </div>

      {/* Meta timestamp */}
      <div className="text-xs text-slate-600 text-center">
        Last analyzed: {lastRefresh?.toLocaleTimeString() || 'Loading...'} · Auto-refreshes every 10 minutes
      </div>
    </div>
  );
}
