// ─── Champions Doubles Projection Panel ───────────────────────────
//
// Surfaces the first-principles Doubles meta projection. No live
// Smogon data — everything shown here is derived from Champions
// mechanics, new Z-A Mega abilities, and roster absences.
//
// This is the panel that makes the calculator a meta leader rather
// than a VGC-data rehash.

import { useMemo, useState } from 'react';
import { generateDoublesProjection, type DoublesProjection, type DoublesRole } from '../calc/doublesMetaProjection';
import { Sprite } from './Sprite';
import { QuickAdd } from './QuickAdd';
import { GenBadge } from './GenBadge';

const TIER_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  S: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40' },
  'A+': { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/40' },
  A: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/40' },
  B: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/40' },
  C: { color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/40' },
};

const ROLE_STYLES: Record<DoublesRole, string> = {
  'Lead Anchor': 'bg-poke-red/10 text-poke-red-light border-poke-red/20',
  'Speed Controller': 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  'Redirector': 'bg-poke-gold/10 text-poke-gold border-poke-gold/20',
  'Wallbreaker': 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  'Wincon': 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  'Pivot Wall': 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  'Hyper Offense': 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  'Trick Room Abuser': 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  'Weather Abuser': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  'Utility': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

function RoleBadge({ role }: { role: DoublesRole }) {
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${ROLE_STYLES[role]}`}>
      {role}
    </span>
  );
}

function ProjectionRow({ entry, rank }: { entry: DoublesProjection; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const tierStyle = TIER_STYLES[entry.tier] ?? TIER_STYLES.C;

  return (
    <div className="poke-panel cursor-pointer hover:border-poke-red/30 transition-colors" onClick={() => setExpanded(!expanded)}>
      <div className="p-3 flex items-center gap-3">
        <span className="text-xs text-slate-600 font-mono w-6 text-right">#{rank}</span>
        <Sprite species={entry.species} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-bold text-white">{entry.species}</span>
            <GenBadge species={entry.species} />
            <span className={`text-[11px] font-black px-1.5 py-0.5 rounded border ${tierStyle.bg} ${tierStyle.border} ${tierStyle.color}`}>
              {entry.tier}
            </span>
            {entry.hasMega && entry.megaStone && (
              <span className="text-[9px] px-1.5 py-0 bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded-full font-bold">
                MEGA
              </span>
            )}
            <span className="text-xs text-slate-500 ml-auto font-mono">{entry.score}</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap mb-1">
            {entry.roles.slice(0, 3).map(r => <RoleBadge key={r} role={r} />)}
          </div>
          {entry.reasoning[0] && (
            <p className="text-xs text-slate-500 leading-snug truncate">
              {entry.reasoning[0]}
            </p>
          )}
        </div>
        <QuickAdd species={entry.species} className="shrink-0" />
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-poke-border space-y-2">
          {/* Score breakdown */}
          <div className="grid grid-cols-5 gap-2 text-[10px] pt-2">
            <BreakdownBar label="Lead" value={entry.breakdown.leadValue} max={25} color="bg-poke-red" />
            <BreakdownBar label="Support" value={entry.breakdown.supportValue} max={20} color="bg-amber-500" />
            <BreakdownBar label="Offense" value={entry.breakdown.offensivePressure} max={20} color="bg-orange-500" />
            <BreakdownBar label="Defense" value={entry.breakdown.defensiveValue} max={15} color="bg-sky-500" />
            <BreakdownBar label="Champions" value={entry.breakdown.championsAdjust} max={15} color="bg-purple-500" />
          </div>

          {/* Full reasoning */}
          {entry.reasoning.length > 0 && (
            <div className="space-y-0.5">
              {entry.reasoning.map((r, i) => (
                <div key={i} className="text-[11px] text-slate-400 flex gap-1.5">
                  <span className="text-poke-gold shrink-0">→</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}

          {/* Champions-specific factors */}
          {entry.championsFactors.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-600 mb-1">Champions Factors</div>
              <div className="space-y-0.5">
                {entry.championsFactors.map((f, i) => (
                  <div key={i} className="text-[10px] text-slate-500 italic">• {f}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BreakdownBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, ((value + (max < 0 ? 10 : 0)) / (max < 0 ? max * 2 : max)) * 100)) : 0;
  const displayValue = value >= 0 ? `+${value}` : `${value}`;
  return (
    <div>
      <div className="flex items-baseline gap-1 mb-0.5">
        <span className="text-slate-500 truncate flex-1">{label}</span>
        <span className="text-slate-400 font-mono text-[9px]">{displayValue}</span>
      </div>
      <div className="h-1 bg-poke-surface rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function DoublesProjectionPanel() {
  const report = useMemo(() => generateDoublesProjection(), []);
  const [filterRole, setFilterRole] = useState<DoublesRole | 'all'>('all');
  const [showCount, setShowCount] = useState(15);

  const filtered = useMemo(() => {
    if (filterRole === 'all') return report.rankings;
    return report.rankings.filter(r => r.roles.includes(filterRole));
  }, [report.rankings, filterRole]);

  const allRoles: (DoublesRole | 'all')[] = [
    'all', 'Lead Anchor', 'Speed Controller', 'Redirector',
    'Wincon', 'Wallbreaker', 'Pivot Wall', 'Hyper Offense',
    'Trick Room Abuser', 'Weather Abuser',
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="poke-panel">
        <div className="poke-panel-header bg-gradient-to-r from-poke-red/15 via-purple-500/10 to-poke-blue/10">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Champions Doubles Projection
              <span className="text-[9px] px-2 py-0.5 bg-poke-gold/15 text-poke-gold border border-poke-gold/30 rounded-full font-bold uppercase tracking-wider">
                Original Analysis
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Projected VGC 2026 Doubles meta built from first principles — no Smogon data, no mainline VGC usage.
              Each Pokemon is scored on Doubles fundamentals (Fake Out, redirection, spread offense, speed control)
              plus Champions-specific adjustments (Z-A Mega abilities, move nerfs, status changes, roster vacancies).
            </p>
          </div>
        </div>

        {/* Insights — the "we did analysis nobody else has" section */}
        {report.insights.length > 0 && (
          <div className="p-4 border-t border-poke-border">
            <div className="text-[10px] font-bold uppercase tracking-wider text-poke-gold mb-2">Key Meta Projections</div>
            <div className="space-y-1.5">
              {report.insights.map((insight, i) => (
                <div key={i} className="text-xs text-slate-300 leading-relaxed flex gap-2">
                  <span className="text-poke-gold shrink-0">→</span>
                  <span>{insight}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Predicted Archetype Cores */}
      {report.cores.length > 0 && (
        <div className="poke-panel">
          <div className="poke-panel-header">
            <h3 className="text-sm font-bold text-white">Predicted Archetype Cores</h3>
            <p className="text-[10px] text-slate-500">Emerging Doubles archetypes derived from ability synergies and role availability</p>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {report.cores.map((core, i) => (
              <div key={i} className="rounded-lg border border-poke-border bg-poke-surface p-3">
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex -space-x-2">
                    {core.anchors.slice(0, 2).map(s => <Sprite key={s} species={s} size="md" />)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white">{core.name}</h4>
                    <p className="text-[10px] text-poke-gold">{core.winCondition}</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug mb-2">{core.description}</p>
                {core.partners.length > 0 && (
                  <div className="pt-2 border-t border-poke-border/50">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Partners</div>
                    <div className="flex flex-wrap gap-1">
                      {core.partners.map(p => (
                        <div key={p} className="flex items-center gap-1 px-1.5 py-0.5 bg-poke-panel rounded text-[10px] text-slate-300">
                          <Sprite species={p} size="sm" />
                          <span>{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dark Horses */}
      {report.darkHorses.length > 0 && (
        <div className="poke-panel">
          <div className="poke-panel-header bg-gradient-to-r from-poke-gold/10 to-transparent">
            <h3 className="text-sm font-bold text-white">Dark Horses</h3>
            <p className="text-[10px] text-slate-500">High-scoring Pokemon the community isn't talking about yet</p>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {report.darkHorses.map(dh => (
              <div key={dh.species} className="flex items-center gap-2 p-2 rounded-lg border border-poke-gold/20 bg-poke-gold/5">
                <Sprite species={dh.species} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold text-white truncate">{dh.species}</span>
                    <span className="text-[10px] text-poke-gold font-mono ml-auto">{dh.score}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug truncate">{dh.reasoning[0]}</p>
                </div>
                <QuickAdd species={dh.species} className="shrink-0" actions={['attacker', 'team']} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Rankings */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Projected Rankings</h3>
        <div className="flex items-center gap-1 flex-wrap">
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value as DoublesRole | 'all')}
            className="text-xs bg-poke-surface border border-poke-border rounded px-2 py-1 text-slate-300"
          >
            {allRoles.map(r => (
              <option key={r} value={r}>{r === 'all' ? 'All Roles' : r}</option>
            ))}
          </select>
          <button
            onClick={() => setShowCount(showCount === 15 ? filtered.length : 15)}
            className="text-xs px-2 py-1 text-slate-400 hover:text-white transition-colors"
          >
            {showCount === 15 ? `Show all (${filtered.length})` : 'Show top 15'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {filtered.slice(0, showCount).map((entry, i) => (
          <ProjectionRow key={entry.species} entry={entry} rank={i + 1} />
        ))}
      </div>

      {/* Role Leaders quick-reference */}
      <div className="poke-panel">
        <div className="poke-panel-header">
          <h3 className="text-sm font-bold text-white">Role Leaders</h3>
          <p className="text-[10px] text-slate-500">Top picks by Doubles role — quick reference for team slot planning</p>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
          {Object.entries(report.roleLeaders)
            .filter(([, leaders]) => leaders.length > 0)
            .map(([role, leaders]) => (
              <div key={role} className="flex items-center gap-2 text-xs">
                <RoleBadge role={role as DoublesRole} />
                <div className="flex gap-1 flex-wrap flex-1 min-w-0">
                  {leaders.slice(0, 4).map(s => (
                    <div key={s} className="flex items-center gap-1">
                      <Sprite species={s} size="sm" />
                      <span className="text-slate-300 truncate">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Methodology footer */}
      <div className="text-[10px] text-slate-600 p-3 border border-poke-border rounded-lg bg-poke-surface/50 leading-relaxed">
        <strong className="text-slate-500">Methodology:</strong> Each Pokemon is scored across 5 dimensions
        — Lead Value, Support Value, Offensive Pressure, Defensive Value, and a Champions Adjustment
        factor. The Champions Adjustment encodes new Z-A Mega abilities (Piercing Drill, Mega Sol,
        Dragonize, Huge Power Starmie, Snow Warning Froslass), Fake Out nerf impact, status condition
        nerf beneficiaries, and role vacancies from absent VGC staples (Amoonguss, Rillaboom,
        Gholdengo, Kingdra). No Smogon usage data is used as input — this is purely predictive.
      </div>
    </div>
  );
}
