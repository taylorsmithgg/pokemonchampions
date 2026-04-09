import { useState } from 'react';
import { getSpriteUrl } from '../utils/sprites';
import { TEAMS, TEAM_ARCHETYPES, type TeamComp, type TeamMember } from '../data/teams';

interface TeamsPanelProps {
  onLoadMember: (member: TeamMember, side: 'attacker' | 'defender') => void;
  onLoadFullTeam?: (team: TeamComp) => void;
  isOpen: boolean;
  onClose: () => void;
}

function MemberCard({ member, onLoad }: { member: TeamMember; onLoad: (side: 'attacker' | 'defender') => void }) {
  const [expanded, setExpanded] = useState(false);

  // Format SP spread
  const spLabels: Record<string, string> = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
  const spParts = Object.entries(member.sps)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v} ${spLabels[k]}`)
    .join(' / ');

  return (
    <div className="bg-slate-800/60 rounded-lg border border-slate-700/50 overflow-hidden">
      <div
        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <img
          src={getSpriteUrl(member.species)}
          alt={member.species}
          className="w-10 h-10 object-contain"
          loading="lazy"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-white">{member.species}</span>
            <span className="text-[9px] text-slate-500">@ {member.item}</span>
          </div>
          <span className="text-[10px] text-indigo-400">{member.role}</span>
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
          <button
            onClick={e => { e.stopPropagation(); onLoad('attacker'); }}
            className="text-[8px] px-1.5 py-0.5 bg-indigo-500/80 text-white rounded hover:bg-indigo-500"
            title="Set as attacker"
          >
            ATK
          </button>
          <button
            onClick={e => { e.stopPropagation(); onLoad('defender'); }}
            className="text-[8px] px-1.5 py-0.5 bg-rose-500/80 text-white rounded hover:bg-rose-500"
            title="Set as defender"
          >
            DEF
          </button>
        </div>
        <svg className={`w-4 h-4 text-slate-600 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {expanded && (
        <div className="px-3 pb-2 space-y-1.5 border-t border-slate-700/30 pt-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
            <div><span className="text-slate-500">Ability:</span> <span className="text-slate-300">{member.ability}</span></div>
            <div><span className="text-slate-500">Nature:</span> <span className="text-slate-300">{member.nature}</span></div>
            <div><span className="text-slate-500">Item:</span> <span className="text-slate-300">{member.item}</span></div>
          </div>
          <div className="text-[10px]">
            <span className="text-slate-500">SPs:</span>{' '}
            <span className="text-amber-400 font-mono">{spParts}</span>
          </div>
          <div className="text-[10px]">
            <span className="text-slate-500">Moves:</span>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {member.moves.map(m => (
                <span key={m} className="px-1.5 py-0.5 bg-slate-900 text-slate-300 rounded">{m}</span>
              ))}
            </div>
          </div>
          <div className="flex gap-1 mt-1">
            <button
              onClick={() => onLoad('attacker')}
              className="flex-1 text-[10px] py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded hover:bg-indigo-500/30 transition-colors"
            >
              Load as Attacker
            </button>
            <button
              onClick={() => onLoad('defender')}
              className="flex-1 text-[10px] py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded hover:bg-rose-500/30 transition-colors"
            >
              Load as Defender
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamCard({ team, onLoadMember, onLoadFullTeam }: { team: TeamComp; onLoadMember: (member: TeamMember, side: 'attacker' | 'defender') => void; onLoadFullTeam?: (team: TeamComp) => void }) {
  const [expanded, setExpanded] = useState(false);
  const archetype = TEAM_ARCHETYPES.find(a => a.id === team.archetype);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">{team.name}</h3>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${archetype?.bg} ${archetype?.color} font-semibold`}>
              {archetype?.label}
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
              team.gimmick === 'Mega' ? 'bg-purple-500/10 text-purple-400' : 'bg-cyan-500/10 text-cyan-400'
            } font-semibold`}>
              {team.gimmick}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onLoadFullTeam && (
              <button
                onClick={(e) => { e.stopPropagation(); onLoadFullTeam(team); }}
                className="text-xs px-3 py-1.5 bg-gradient-to-r from-poke-red to-poke-red-dark text-white rounded-lg font-bold hover:from-poke-red-light hover:to-poke-red transition-all"
              >
                Load Team
              </button>
            )}
            <svg className={`w-5 h-5 text-slate-600 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">{team.description}</p>

        {/* Mini team preview */}
        <div className="flex gap-1 mt-3">
          {team.members.map((m: TeamMember) => {
            return (
              <div key={m.species} className="flex flex-col items-center gap-0.5">
                <img
                  src={getSpriteUrl(m.species)}
                  alt={m.species}
                  className="w-8 h-8 object-contain"
                  loading="lazy"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="text-[8px] text-slate-600 truncate max-w-[48px]">{m.species}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-slate-800">
          {/* Strategy */}
          <div className="p-4 space-y-3">
            <div>
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Game Plan</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{team.strategy}</p>
            </div>

            {/* Lead options */}
            <div>
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Common Leads</h4>
              <div className="flex flex-wrap gap-1">
                {team.leadOptions.map((lead: string) => (
                  <span key={lead} className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                    {lead}
                  </span>
                ))}
              </div>
            </div>

            {/* Key synergies */}
            <div>
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Key Synergies</h4>
              <ul className="space-y-0.5">
                {team.keyInteractions.map((ki: string, i: number) => (
                  <li key={i} className="text-[10px] text-slate-400 flex gap-1.5">
                    <span className="text-emerald-500 shrink-0">+</span>
                    {ki}
                  </li>
                ))}
              </ul>
            </div>

            {/* Threats */}
            <div>
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Watch Out For</h4>
              <ul className="space-y-0.5">
                {team.threats.map((t: string, i: number) => (
                  <li key={i} className="text-[10px] text-slate-400 flex gap-1.5">
                    <span className="text-red-500 shrink-0">!</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Team members */}
          <div className="p-4 pt-0">
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Team Members</h4>
            <div className="space-y-1.5 group">
              {team.members.map((member: TeamMember) => (
                <MemberCard
                  key={member.species}
                  member={member}
                  onLoad={side => onLoadMember(member, side)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TeamsPanel({ onLoadMember, onLoadFullTeam, isOpen, onClose }: TeamsPanelProps) {
  const [filterArchetype, setFilterArchetype] = useState<string>('all');
  const [filterGimmick, setFilterGimmick] = useState<string>('all');

  const filtered = TEAMS.filter(t => {
    if (filterArchetype !== 'all' && t.archetype !== filterArchetype) return false;
    if (filterGimmick !== 'all' && t.gimmick !== filterGimmick) return false;
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative ml-auto w-full max-w-2xl border-l border-poke-border overflow-y-auto shadow-2xl" style={{ backgroundColor: '#0A0A15' }}>
        {/* Header */}
        <div className="sticky top-0 z-20 border-b border-poke-border p-4" style={{ backgroundColor: '#0A0A15' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-white">Meta Team Comps</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Full teams with optimal SP spreads, items, and strategy breakdowns</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterArchetype}
              onChange={e => setFilterArchetype(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg text-xs text-white px-2 py-1.5"
            >
              <option value="all">All Archetypes</option>
              {TEAM_ARCHETYPES.map(a => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
            <select
              value={filterGimmick}
              onChange={e => setFilterGimmick(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg text-xs text-white px-2 py-1.5"
            >
              <option value="all">All Gimmicks</option>
              <option value="Mega">Mega Evolution</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {filtered.map(team => (
            <TeamCard key={team.id} team={team} onLoadMember={onLoadMember} onLoadFullTeam={onLoadFullTeam} />
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-600">
              No teams match your filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
