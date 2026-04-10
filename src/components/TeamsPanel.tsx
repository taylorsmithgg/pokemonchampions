import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Sprite } from './Sprite';
import { QuickAdd } from './QuickAdd';
import { TEAMS, LEGACY_TEAMS, TEAM_ARCHETYPES, type TeamComp, type TeamMember } from '../data/teams';
import { SINGLES_FORMAT, type FormatId } from '../calc/lineupAnalysis';
import { FormatSelector } from './FormatSelector';
import { generateDoublesTeams, generateSinglesTeams, type GeneratedTeam } from '../calc/teamCompGenerator';
import { getTeamArchetypeWikiSlug, wikiPath } from '../utils/wikiLinks';

interface TeamsPanelProps {
  onLoadMember: (member: TeamMember, side: 'attacker' | 'defender') => void;
  onLoadFullTeam?: (team: TeamComp) => void;
  isOpen: boolean;
  onClose: () => void;
}

function MemberCard({ member, onLoad }: { member: TeamMember; onLoad: (side: 'attacker' | 'defender') => void }) {
  void onLoad;
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
        <Sprite species={member.species} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-white">{member.species}</span>
            {member.item && (
              <span className="text-[9px] text-slate-500 truncate">@ {member.item}</span>
            )}
          </div>
          <span className="text-[10px] text-indigo-400 block truncate">{member.role}</span>
        </div>
        <QuickAdd species={member.species} className="shrink-0" />
        <svg className={`w-4 h-4 text-slate-600 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

  const isGenerated = (team as GeneratedTeam).generated;
  const flexScore = isGenerated ? (team as GeneratedTeam).flexScore : undefined;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div
        className="p-3 sm:p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Row 1: Title + primary action. Flex-1 on the title so the
            Load Team button stays pinned to the right without fighting
            the badge row. */}
        <div className="flex items-start gap-3 mb-2">
          <h3 className="text-sm font-bold text-white flex-1 min-w-0 leading-tight">
            {team.name}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {onLoadFullTeam && (
              <button
                onClick={(e) => { e.stopPropagation(); onLoadFullTeam(team); }}
                className="text-xs px-3 py-1.5 bg-gradient-to-r from-poke-red to-poke-red-dark text-white rounded-lg font-bold hover:from-poke-red-light hover:to-poke-red transition-all whitespace-nowrap"
              >
                Load Team
              </button>
            )}
            <svg className={`w-5 h-5 text-slate-600 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Row 2: Badges (wrap freely) + flex score on the right. */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {isGenerated && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-poke-gold/15 text-poke-gold border border-poke-gold/30 font-bold uppercase tracking-wider whitespace-nowrap">
              Projected
            </span>
          )}
          {(() => {
            const archetypeSlug = team.archetype ? getTeamArchetypeWikiSlug(team.archetype) : undefined;
            const badgeClasses = `text-[9px] px-1.5 py-0.5 rounded-full ${archetype?.bg} ${archetype?.color} font-semibold whitespace-nowrap`;
            if (archetypeSlug) {
              return (
                <Link
                  to={wikiPath(archetypeSlug)}
                  onClick={(e) => e.stopPropagation()}
                  className={`${badgeClasses} hover:underline`}
                  title={`Read the ${archetype?.label} archetype deep dive`}
                >
                  {archetype?.label}
                </Link>
              );
            }
            return <span className={badgeClasses}>{archetype?.label}</span>;
          })()}
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap ${
            team.gimmick === 'Mega' ? 'bg-purple-500/10 text-purple-400' : 'bg-cyan-500/10 text-cyan-400'
          }`}>
            {team.gimmick}
          </span>
          {team.format ? (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap ${
              team.format === 'doubles'
                ? 'bg-poke-red/10 text-poke-red-light'
                : 'bg-sky-500/10 text-sky-400'
            }`}>
              {team.format === 'doubles' ? 'Doubles · pick 4' : 'Singles · pick 3'}
            </span>
          ) : (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-500/10 text-slate-400 font-semibold whitespace-nowrap">
              Legacy · untagged
            </span>
          )}
          {flexScore !== undefined && (
            <span className="text-[9px] text-slate-500 font-mono ml-auto whitespace-nowrap">
              flex {flexScore}/100
            </span>
          )}
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">{team.description}</p>

        {/* Mini team preview — bigger sprites, full names on hover via
            tooltip, no awkward truncation labels. */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {team.members.map((m: TeamMember) => (
            <div
              key={m.species}
              className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded bg-slate-800/40 border border-slate-700/40 hover:border-slate-600 transition-colors"
              title={m.species}
            >
              <Sprite species={m.species} size="md" />
              <span className="text-[9px] text-slate-400 font-medium leading-tight max-w-[72px] text-center truncate">
                {m.species}
              </span>
            </div>
          ))}
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
  // Default the team comps browser to Singles — the Tier List and
  // Team Comps are browse-focused and Singles is the broader ranked
  // ladder most players see first.
  const [filterFormat, setFilterFormat] = useState<FormatId>(SINGLES_FORMAT.id);

  // Generated comps built from the first-principles projection
  // engines — one per format. These are the PRIMARY content of the
  // format-filtered pool, not imported from VGC. Both formats use
  // parallel pipelines: projection → archetype cores → team builder.
  const generatedDoubles = useMemo<GeneratedTeam[]>(() => generateDoublesTeams(), []);
  const generatedSingles = useMemo<GeneratedTeam[]>(() => generateSinglesTeams(), []);

  // Format-filtered pool contains ONLY explicitly-tagged teams:
  //   - Generated projections for the selected format
  //   - Any future curated teams with an explicit `format` field
  // Legacy curated teams (no format tag) are shown separately below
  // so they don't pollute the format selector.
  const formatTeams: TeamComp[] = useMemo(() => {
    const generatedForFormat = filterFormat === 'doubles' ? generatedDoubles : generatedSingles;
    const taggedCurated = TEAMS.filter(t => t.format === filterFormat);
    return [...generatedForFormat, ...taggedCurated];
  }, [filterFormat, generatedDoubles, generatedSingles]);

  const filtered = formatTeams.filter(t => {
    if (filterArchetype !== 'all' && t.archetype !== filterArchetype) return false;
    if (filterGimmick !== 'all' && t.gimmick !== filterGimmick) return false;
    return true;
  });

  // Legacy teams filtered by archetype/gimmick (but NOT by format,
  // since they have no explicit format).
  const legacyFiltered = LEGACY_TEAMS.filter(t => {
    if (filterArchetype !== 'all' && t.archetype !== filterArchetype) return false;
    if (filterGimmick !== 'all' && t.gimmick !== filterGimmick) return false;
    return true;
  });

  const formatCounts: Record<FormatId, number> = {
    doubles: generatedDoubles.length + TEAMS.filter(t => t.format === 'doubles').length,
    singles: generatedSingles.length + TEAMS.filter(t => t.format === 'singles').length,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative ml-auto w-full max-w-2xl sm:border-l border-poke-border overflow-y-auto shadow-2xl" style={{ backgroundColor: '#0A0A15' }}>
        {/* Header */}
        <div className="sticky top-0 z-20 border-b border-poke-border p-3 sm:p-4" style={{ backgroundColor: '#0A0A15' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-white">Meta Team Comps</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Teams generated from our first-principles projection engines — separate models for Doubles (VGC) and Singles, each built around the archetype cores the engine identifies.
              </p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Format selector — Singles vs Doubles is a context-
              defining choice (different meta, different lead logic,
              different item priorities), so it gets card-level
              prominence at the top of the panel. */}
          <div className="mb-4">
            <FormatSelector
              value={filterFormat}
              onChange={(f) => setFilterFormat(f.id)}
              counts={formatCounts}
            />
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
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* Format-filtered pool — projection-generated + any
              explicitly-tagged curated teams */}
          {filtered.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {filterFormat === 'doubles' ? 'Doubles Projections' : 'Singles Projections'}
                <span className="ml-2 text-slate-600 font-mono normal-case">{filtered.length}</span>
              </div>
              {filtered.map(team => (
                <TeamCard key={team.id} team={team} onLoadMember={onLoadMember} onLoadFullTeam={onLoadFullTeam} />
              ))}
            </>
          )}

          {filtered.length === 0 && (
            <div className="py-10 px-6 rounded-xl border border-dashed border-poke-border bg-poke-surface/50 text-center">
              <p className="text-sm text-slate-500">No format-tagged teams match your filters.</p>
              {(filterArchetype !== 'all' || filterGimmick !== 'all') && (
                <button
                  onClick={() => { setFilterArchetype('all'); setFilterGimmick('all'); }}
                  className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-poke-surface border border-poke-border text-slate-400 hover:text-white transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Legacy reference section — curated VGC imports that
              aren't tagged with a format. Shown regardless of the
              format selector so users can still reference them, but
              clearly separated from the projection-driven content. */}
          {legacyFiltered.length > 0 && (
            <>
              <div className="pt-4 mt-4 border-t border-poke-border">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Legacy VGC Reference
                  </span>
                  <span className="text-[10px] text-slate-600">(not format-tagged — imported from mainline VGC)</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                  These curated team templates were seeded from VGC 2026 before the projection engine existed.
                  They aren&apos;t explicitly tuned for Champions Doubles or Singles — treat them as a reference
                  rather than a recommendation.
                </p>
              </div>
              {legacyFiltered.map(team => (
                <TeamCard key={team.id} team={team} onLoadMember={onLoadMember} onLoadFullTeam={onLoadFullTeam} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
