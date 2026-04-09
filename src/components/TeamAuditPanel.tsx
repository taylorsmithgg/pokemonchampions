import { useMemo } from 'react';
import { auditTeam, type TeamAudit, type AuditIssue, type Severity } from '../calc/teamAudit';
import type { PokemonState } from '../types';

interface TeamAuditPanelProps {
  attacker: PokemonState;
  defender: PokemonState;
  onLoadPokemon: (species: string, side: 'attacker' | 'defender') => void;
}

const SEVERITY_STYLES: Record<Severity, { border: string; bg: string; icon: string; text: string }> = {
  critical: { border: 'border-red-500/30', bg: 'bg-red-500/5', icon: '✗', text: 'text-red-400' },
  warning: { border: 'border-amber-500/30', bg: 'bg-amber-500/5', icon: '⚠', text: 'text-amber-400' },
  info: { border: 'border-sky-500/20', bg: 'bg-sky-500/5', icon: 'i', text: 'text-sky-400' },
  good: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', icon: '✓', text: 'text-emerald-400' },
};

function IssueCard({ issue, onLoadPokemon }: { issue: AuditIssue; onLoadPokemon: (species: string, side: 'attacker' | 'defender') => void }) {
  const style = SEVERITY_STYLES[issue.severity];

  return (
    <div className={`rounded-lg border ${style.border} ${style.bg} p-2.5`}>
      <div className="flex items-start gap-2">
        <span className={`${style.text} text-xs font-bold shrink-0 w-4 text-center`}>{style.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[9px] px-1.5 py-0 bg-poke-surface text-slate-500 rounded">{issue.category}</span>
            <span className={`text-[11px] font-semibold ${style.text}`}>{issue.title}</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">{issue.detail}</p>
          {issue.suggestion && (
            <p className="text-[10px] text-slate-500 mt-1 italic">{issue.suggestion}</p>
          )}
          {issue.suggestedPokemon && issue.suggestedPokemon.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {issue.suggestedPokemon.map((name: string) => {
                const spriteId = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
                return (
                  <button
                    key={name}
                    className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 bg-poke-surface border border-poke-border/50 text-slate-300 rounded hover:border-poke-red/50 hover:text-poke-red-light transition-colors"
                    onClick={() => onLoadPokemon(name, 'attacker')}
                    title={`Load ${name}`}
                  >
                    <img
                      src={`https://play.pokemonshowdown.com/sprites/ani/${spriteId}.gif`}
                      alt=""
                      className="w-6 h-6 object-contain"
                      loading="lazy"
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }}
                    />
                    {name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
  const circumference = 2 * Math.PI * 20;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-14 h-14">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="#1e293b" strokeWidth="3" />
        <circle
          cx="24" cy="24" r="20" fill="none"
          stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-white">{score}</span>
      </div>
    </div>
  );
}

export function TeamAuditPanel({ attacker, defender, onLoadPokemon }: TeamAuditPanelProps) {
  const audit = useMemo<TeamAudit>(() => {
    return auditTeam([attacker, defender]);
  }, [attacker, defender]);

  if (!attacker.species && !defender.species) return null;

  const criticals = audit.issues.filter(i => i.severity === 'critical');
  const warnings = audit.issues.filter(i => i.severity === 'warning');
  const infos = audit.issues.filter(i => i.severity === 'info');
  const goods = audit.issues.filter(i => i.severity === 'good');

  return (
    <div className="poke-panel overflow-hidden">
      <div className="px-3 py-2 poke-panel-header bg-gradient-to-r from-poke-red/8 to-transparent">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Team Audit</h3>
          <div className="flex items-center gap-2">
            {criticals.length > 0 && <span className="text-[9px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded-full font-bold">{criticals.length} critical</span>}
            {warnings.length > 0 && <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded-full font-bold">{warnings.length} warning</span>}
          </div>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Score + Summary */}
        <div className="flex items-center gap-3">
          <ScoreRing score={audit.score} />
          <div className="flex-1">
            <p className="text-xs text-slate-300">{audit.summary}</p>
            <div className="flex gap-2 mt-1.5">
              <RoleBadge label="Fake Out" has={audit.roleReport.hasFakeOut} />
              <RoleBadge label="Tailwind" has={audit.roleReport.hasTailwind} />
              <RoleBadge label="Intim" has={audit.roleReport.hasIntim} />
              <RoleBadge label="Priority" has={audit.roleReport.hasPriority} />
              <RoleBadge label="Redirect" has={audit.roleReport.hasRedirect} />
              <RoleBadge label="Pivot" has={audit.roleReport.hasPivot} />
            </div>
          </div>
        </div>

        {/* Issues */}
        <div className="space-y-1.5 ">
          {criticals.map(i => <IssueCard key={i.id} issue={i} onLoadPokemon={onLoadPokemon} />)}
          {warnings.map(i => <IssueCard key={i.id} issue={i} onLoadPokemon={onLoadPokemon} />)}
          {goods.map(i => <IssueCard key={i.id} issue={i} onLoadPokemon={onLoadPokemon} />)}
          {infos.map(i => <IssueCard key={i.id} issue={i} onLoadPokemon={onLoadPokemon} />)}
        </div>

        {/* Speed profile */}
        {audit.speedProfile.fastest && (
          <div className="text-[10px] text-slate-500 border-t border-slate-800 pt-2">
            Speed: {audit.speedProfile.fastest.species} ({audit.speedProfile.fastest.speed})
            {audit.speedProfile.slowest && ` → ${audit.speedProfile.slowest.species} (${audit.speedProfile.slowest.speed})`}
            {audit.speedProfile.trickRoomViable && ' • TR viable'}
            {audit.speedProfile.tailwindDependent && ' • needs Tailwind'}
          </div>
        )}
      </div>
    </div>
  );
}

function RoleBadge({ label, has }: { label: string; has: boolean }) {
  return (
    <span className={`text-[8px] px-1.5 py-0.5 rounded border ${
      has
        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        : 'bg-poke-surface border-poke-border/50 text-slate-600'
    }`}>
      {has ? '✓' : '✗'} {label}
    </span>
  );
}
