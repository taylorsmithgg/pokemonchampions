import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Sprite } from '../components/Sprite';
import { SearchSelect } from '../components/SearchSelect';
import { getAvailablePokemon, getPokemonData, getTypeEffectiveness } from '../data/champions';
import { getTierForPokemon, TIER_DEFINITIONS } from '../data/tierlist';
import { useTeam } from '../contexts/TeamContext';
import { wikiPath } from '../utils/wikiLinks';
import type { PokemonState } from '../types';

// ─── Archetype detection from opponent team ────────────────────────

function detectOpponentArchetype(opponents: string[]): { name: string; confidence: number; wikiSlug?: string }[] {
  const archetypes: { name: string; confidence: number; wikiSlug?: string }[] = [];
  const speciesSet = new Set(opponents);

  // Weather detection via abilities
  for (const species of opponents) {
    const data = getPokemonData(species);
    if (!data?.abilities) continue;
    const ability = (data.abilities[0] || '').toLowerCase();
    if (['drought'].includes(ability) || species === 'Charizard' || species === 'Meganium') {
      archetypes.push({ name: 'Sun', confidence: 0.8, wikiSlug: 'pokemon-champions-sun-archetype-guide' });
    }
    if (['drizzle'].includes(ability) || species === 'Pelipper') {
      archetypes.push({ name: 'Rain', confidence: 0.8, wikiSlug: 'pokemon-champions-rain-archetype-guide' });
    }
    if (['sand stream'].includes(ability)) {
      archetypes.push({ name: 'Sand', confidence: 0.8, wikiSlug: 'pokemon-champions-sand-archetype-guide' });
    }
    if (['snow warning'].includes(ability) || species === 'Froslass' || species === 'Abomasnow') {
      archetypes.push({ name: 'Snow', confidence: 0.7, wikiSlug: 'pokemon-champions-snow-archetype-guide' });
    }
  }

  // Trick Room detection
  const trSetters = ['Hatterene', 'Mimikyu', 'Reuniclus', 'Slowking', 'Slowbro', 'Dusclops'];
  const slowMons = opponents.filter(s => {
    const d = getPokemonData(s);
    return d && d.baseStats.spe <= 50;
  });
  if (opponents.some(s => trSetters.includes(s)) && slowMons.length >= 2) {
    archetypes.push({ name: 'Trick Room', confidence: 0.9, wikiSlug: 'pokemon-champions-trick-room-archetype-guide' });
  }

  // Tailwind detection
  const twSetters = ['Whimsicott', 'Talonflame', 'Pelipper', 'Aerodactyl'];
  if (opponents.some(s => twSetters.includes(s))) {
    archetypes.push({ name: 'Tailwind', confidence: 0.6, wikiSlug: 'pokemon-champions-tailwind-archetype-guide' });
  }

  // Hyper Offense detection
  const fastOffense = opponents.filter(s => {
    const d = getPokemonData(s);
    return d && d.baseStats.spe >= 100 && Math.max(d.baseStats.atk, d.baseStats.spa) >= 100;
  });
  if (fastOffense.length >= 3) {
    archetypes.push({ name: 'Hyper Offense', confidence: 0.7, wikiSlug: 'pokemon-champions-hyper-offense-archetype-guide' });
  }

  // Shadow Tag trap
  if (speciesSet.has('Gengar')) {
    archetypes.push({ name: 'Perish Trap', confidence: 0.5, wikiSlug: 'pokemon-champions-shadow-tag-perish-trap-archetype-guide' });
  }

  archetypes.sort((a, b) => b.confidence - a.confidence);
  return archetypes.slice(0, 3);
}

// ─── Matchup scoring ───────────────────────────────────────────────

function scoreMatchup(mySpecies: string, theirSpecies: string): number {
  const myData = getPokemonData(mySpecies);
  const theirData = getPokemonData(theirSpecies);
  if (!myData || !theirData) return 0;

  let score = 0;
  // Can I hit them SE?
  for (const myType of myData.types) {
    for (const theirType of theirData.types) {
      const eff = getTypeEffectiveness(myType as string, theirType as string);
      if (eff > 1) score += 2;
      if (eff < 1) score -= 1;
    }
  }
  // Can they hit me SE?
  for (const theirType of theirData.types) {
    for (const myType of myData.types) {
      const eff = getTypeEffectiveness(theirType as string, myType as string);
      if (eff > 1) score -= 2;
      if (eff < 1) score += 1;
    }
  }
  // Speed advantage
  if (myData.baseStats.spe > theirData.baseStats.spe + 10) score += 1;
  if (myData.baseStats.spe < theirData.baseStats.spe - 10) score -= 1;

  return score;
}

// ─── Bring-list recommendation ─────────────────────────────────────

interface BringRecommendation {
  species: string;
  score: number;
  reasons: string[];
}

function recommendBringList(myTeam: PokemonState[], opponents: string[]): BringRecommendation[] {
  const recs: BringRecommendation[] = [];

  for (const member of myTeam) {
    if (!member.species) continue;
    let score = 0;
    const reasons: string[] = [];

    // Score against each opponent
    let seCount = 0;
    let weakCount = 0;
    for (const opp of opponents) {
      const ms = scoreMatchup(member.species, opp);
      score += ms;
      if (ms >= 2) seCount++;
      if (ms <= -2) weakCount++;
    }
    if (seCount >= 2) reasons.push(`Hits ${seCount} opponents super-effectively`);
    if (weakCount >= 2) reasons.push(`Weak to ${weakCount} opponents — risky`);

    // Bonus for Intimidate/Fake Out
    const data = getPokemonData(member.species);
    if (data) {
      const ability = (data.abilities?.[0] || '') as string;
      if (ability === 'Intimidate') { score += 3; reasons.push('Intimidate weakens their physical attackers'); }
    }
    if (member.moves.includes('Fake Out')) { score += 2; reasons.push('Fake Out controls turn 1'); }
    if (member.moves.includes('Protect')) { score += 1; }

    recs.push({ species: member.species, score, reasons });
  }

  recs.sort((a, b) => b.score - a.score);
  return recs;
}

// ─── Page Component ────────────────────────────────────────────────

export function BattleAssistantPage() {
  const { team } = useTeam();
  const [opponents, setOpponents] = useState<string[]>(['', '', '', '', '', '']);
  const [isCompact, setIsCompact] = useState(false);
  const allPokemon = useMemo(() => getAvailablePokemon(), []);

  const filledOpponents = opponents.filter(Boolean);
  const filledTeam = team.filter(t => t.species);

  // Analysis
  const archetype = useMemo(() =>
    filledOpponents.length >= 3 ? detectOpponentArchetype(filledOpponents) : [],
  [filledOpponents]);

  const bringList = useMemo(() =>
    filledOpponents.length >= 3 && filledTeam.length >= 4
      ? recommendBringList(team, filledOpponents)
      : [],
  [team, filledOpponents, filledTeam.length]);

  // Matchup matrix
  const matchupMatrix = useMemo(() => {
    if (filledOpponents.length === 0 || filledTeam.length === 0) return null;
    return filledTeam.map(member => ({
      species: member.species,
      scores: filledOpponents.map(opp => ({
        opponent: opp,
        score: scoreMatchup(member.species, opp),
      })),
    }));
  }, [filledTeam, filledOpponents]);

  const setOpponent = useCallback((index: number, species: string) => {
    setOpponents(prev => {
      const next = [...prev];
      next[index] = species;
      return next;
    });
  }, []);

  // Pop-out as overlay window
  const handlePopout = useCallback(() => {
    const w = window.open(window.location.href, 'BattleAssistant', 'width=480,height=700,menubar=no,toolbar=no,location=no,status=no');
    if (w) w.focus();
  }, []);

  return (
    <div className={`min-h-screen bg-poke-darkest text-white ${isCompact ? 'text-sm' : ''}`}>
      {/* Header */}
      <header className="border-b border-poke-border bg-gradient-to-r from-poke-darker via-poke-dark to-poke-darker sticky top-0 z-40">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-poke-red to-transparent" />
        <div className="max-w-4xl mx-auto px-3 py-2 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-5 h-5 rounded-full border-2 border-white/80 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[45%] bg-poke-red" />
              <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-white/90" />
            </div>
            <span className="text-sm font-bold"><span className="text-poke-red">Battle</span> Assistant</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setIsCompact(!isCompact)} className="text-[10px] px-2 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded hover:text-white transition-colors">
              {isCompact ? 'Expand' : 'Compact'}
            </button>
            <button onClick={handlePopout} className="text-[10px] px-2 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded hover:text-white transition-colors" title="Open in overlay window">
              Pop Out ↗
            </button>
            <Link to="/" className="text-[10px] px-2 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded hover:text-white transition-colors">Calc</Link>
            <Link to="/team-builder" className="text-[10px] px-2 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded hover:text-white transition-colors">Builder</Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-3 py-4 space-y-4">
        {/* Your team summary */}
        <div className="poke-panel p-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Your Team</div>
          {filledTeam.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {filledTeam.map(m => (
                <div key={m.species} className="flex items-center gap-1 px-2 py-1 bg-poke-surface rounded border border-poke-border">
                  <Sprite species={m.species} size="sm" />
                  <span className="text-xs text-white">{m.species}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No team loaded. <Link to="/team-builder" className="text-poke-red-light hover:underline">Build one first →</Link></p>
          )}
        </div>

        {/* Opponent team input */}
        <div className="poke-panel p-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Opponent's Team (from team preview)</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {opponents.map((opp, i) => (
              <div key={i} className="flex items-center gap-2">
                {opp && <Sprite species={opp} size="sm" />}
                <SearchSelect
                  options={allPokemon}
                  value={opp}
                  onChange={v => setOpponent(i, v)}
                  placeholder={`Slot ${i + 1}`}
                />
              </div>
            ))}
          </div>
          {filledOpponents.length > 0 && (
            <button onClick={() => setOpponents(['', '', '', '', '', ''])} className="text-[10px] text-slate-500 hover:text-poke-red mt-2 transition-colors">
              Clear opponents
            </button>
          )}
        </div>

        {/* Archetype detection */}
        {archetype.length > 0 && (
          <div className="poke-panel p-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Detected Archetype</div>
            <div className="space-y-2">
              {archetype.map((arch, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-poke-red' : 'bg-slate-600'}`} />
                  <span className="text-sm font-bold text-white">{arch.name}</span>
                  <span className="text-[10px] text-slate-500">{Math.round(arch.confidence * 100)}% likely</span>
                  {arch.wikiSlug && (
                    <Link to={wikiPath(arch.wikiSlug)} className="text-[10px] text-poke-red-light hover:underline ml-auto">
                      Counter guide →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bring list recommendation */}
        {bringList.length > 0 && (
          <div className="poke-panel p-3">
            <div className="text-xs font-bold text-poke-gold uppercase tracking-wider mb-2">Recommended Bring List</div>
            <div className="space-y-2">
              {bringList.map((rec, i) => {
                const tier = getTierForPokemon(rec.species);
                const tierDef = tier ? TIER_DEFINITIONS.find(d => d.tier === tier.tier) : null;
                return (
                  <div key={rec.species} className={`flex items-center gap-3 p-2 rounded-lg border ${i < 3 ? 'border-poke-gold/30 bg-poke-gold/5' : 'border-poke-border bg-poke-surface/50'}`}>
                    <span className={`text-sm font-black w-5 ${i < 3 ? 'text-poke-gold' : 'text-slate-600'}`}>{i + 1}</span>
                    <Sprite species={rec.species} size="md" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{rec.species}</span>
                        {tierDef && <span className={`text-[9px] font-black px-1 py-0 rounded ${tierDef.bgColor} ${tierDef.color} border ${tierDef.borderColor}`}>{tier!.tier}</span>}
                        <span className={`text-xs font-mono ml-auto ${rec.score >= 5 ? 'text-emerald-400' : rec.score >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                          {rec.score >= 0 ? '+' : ''}{rec.score}
                        </span>
                      </div>
                      {rec.reasons.length > 0 && (
                        <div className="text-[11px] text-slate-500 mt-0.5">{rec.reasons[0]}</div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="text-[10px] text-slate-600 mt-1">
                Top {Math.min(3, bringList.length)} recommended. Gold = must bring. Score based on type matchups, role coverage, and support value.
              </div>
            </div>
          </div>
        )}

        {/* Matchup matrix */}
        {matchupMatrix && matchupMatrix.length > 0 && filledOpponents.length > 0 && (
          <div className="poke-panel p-3 overflow-x-auto">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Matchup Matrix</div>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left text-slate-500 pb-1 pr-2">Your Mon</th>
                  {filledOpponents.map(opp => (
                    <th key={opp} className="text-center pb-1 px-1">
                      <Sprite species={opp} size="sm" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matchupMatrix.map(row => (
                  <tr key={row.species} className="border-t border-poke-border/30">
                    <td className="py-1.5 pr-2 flex items-center gap-1">
                      <Sprite species={row.species} size="sm" />
                      <span className="text-white font-medium">{row.species}</span>
                    </td>
                    {row.scores.map(cell => (
                      <td key={cell.opponent} className="text-center py-1.5 px-1">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          cell.score >= 3 ? 'bg-emerald-500/20 text-emerald-400' :
                          cell.score >= 1 ? 'bg-emerald-500/10 text-emerald-300' :
                          cell.score <= -3 ? 'bg-red-500/20 text-red-400' :
                          cell.score <= -1 ? 'bg-red-500/10 text-red-300' :
                          'bg-slate-700/30 text-slate-500'
                        }`}>
                          {cell.score >= 0 ? '+' : ''}{cell.score}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Lead suggestion */}
        {bringList.length >= 2 && (
          <div className="poke-panel p-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Suggested Lead</div>
            <div className="flex items-center gap-3">
              <Sprite species={bringList[0].species} size="lg" />
              <span className="text-lg text-slate-600">+</span>
              <Sprite species={bringList[1].species} size="lg" />
              <div className="flex-1">
                <div className="text-sm font-bold text-white">{bringList[0].species} + {bringList[1].species}</div>
                <div className="text-xs text-slate-500">Highest combined matchup score against their likely lead.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
