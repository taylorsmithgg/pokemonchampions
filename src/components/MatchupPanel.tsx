import { useMemo } from 'react';
import { analyzeMatchup } from '../calc/matchupAnalysis';
import { getPokemonData } from '../data/champions';
import type { PokemonState } from '../types';

interface MatchupPanelProps {
  attacker: PokemonState;
  defender: PokemonState;
}

const DANGER_STYLES = {
  safe: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Safe' },
  manageable: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Manageable' },
  dangerous: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'Dangerous' },
  critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Critical' },
};

function ScoreBar({ score, type }: { score: number; type: 'offense' | 'defense' }) {
  const color = type === 'offense'
    ? (score >= 8 ? '#22c55e' : score >= 5 ? '#eab308' : '#ef4444')
    : (score >= 7 ? '#22c55e' : score >= 5 ? '#eab308' : '#ef4444');

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-slate-500 w-8">{type === 'offense' ? 'Atk' : 'Def'}</span>
      <div className="flex-1 h-2 bg-poke-surface rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score * 10}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-mono w-4 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

export function MatchupPanel({ attacker, defender }: MatchupPanelProps) {
  // Analyze attacker's matchup vs defender and vice versa
  const attackerVsDefender = useMemo(() => {
    if (!attacker.species || !defender.species) return null;
    return analyzeMatchup([attacker], defender.species);
  }, [attacker, defender]);

  const defenderVsAttacker = useMemo(() => {
    if (!attacker.species || !defender.species) return null;
    return analyzeMatchup([defender], attacker.species);
  }, [attacker, defender]);

  if (!attackerVsDefender || !defenderVsAttacker) return null;

  const aScore = attackerVsDefender.scores[0];
  const dScore = defenderVsAttacker.scores[0];
  if (!aScore || !dScore) return null;

  // Who wins this matchup?
  const attackerAdvantage = aScore.overallScore - dScore.overallScore;
  const winner = attackerAdvantage > 1 ? attacker.species
    : attackerAdvantage < -1 ? defender.species
    : 'Even';

  const aStyle = DANGER_STYLES[attackerVsDefender.dangerLevel];
  const dStyle = DANGER_STYLES[defenderVsAttacker.dangerLevel];

  return (
    <div className="poke-panel">
      <div className="poke-panel-header bg-gradient-to-r from-poke-blue/10 to-poke-red/10">
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">Matchup Analysis</h3>
          <span className={`text-[11px] font-bold ${winner === 'Even' ? 'text-amber-400' : winner === attacker.species ? 'text-poke-red-light' : 'text-poke-blue-light'}`}>
            {winner === 'Even' ? 'Even Matchup' : `${winner} Favored`}
          </span>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Head to head comparison */}
        <div className="grid grid-cols-2 gap-3">
          {/* Attacker vs Defender */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[11px] font-semibold text-poke-red-light">{attacker.species}</span>
              <span className="text-[10px] text-slate-600">vs</span>
              <span className="text-[11px] text-slate-400">{defender.species}</span>
            </div>
            <div className="space-y-1">
              <ScoreBar score={aScore.offensiveScore} type="offense" />
              <ScoreBar score={aScore.defensiveScore} type="defense" />
            </div>
            <div className={`mt-1.5 text-[10px] px-2 py-0.5 rounded ${aStyle.bg} ${aStyle.color} ${aStyle.border} border inline-block`}>
              {aStyle.label}
            </div>
          </div>

          {/* Defender vs Attacker */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[11px] font-semibold text-poke-blue-light">{defender.species}</span>
              <span className="text-[10px] text-slate-600">vs</span>
              <span className="text-[11px] text-slate-400">{attacker.species}</span>
            </div>
            <div className="space-y-1">
              <ScoreBar score={dScore.offensiveScore} type="offense" />
              <ScoreBar score={dScore.defensiveScore} type="defense" />
            </div>
            <div className={`mt-1.5 text-[10px] px-2 py-0.5 rounded ${dStyle.bg} ${dStyle.color} ${dStyle.border} border inline-block`}>
              {dStyle.label}
            </div>
          </div>
        </div>

        {/* Key details */}
        <div className="space-y-1 pt-2 border-t border-poke-border">
          {aScore.threatens.length > 0 && (
            <div className="text-[11px] text-slate-400">
              <span className="text-poke-red-light font-medium">{attacker.species}</span> hits {defender.species} super-effectively with <span className="text-emerald-400">{aScore.threatens.join(', ')}</span>
            </div>
          )}
          {dScore.threatens.length > 0 && (
            <div className="text-[11px] text-slate-400">
              <span className="text-poke-blue-light font-medium">{defender.species}</span> hits {attacker.species} super-effectively with <span className="text-emerald-400">{dScore.threatens.join(', ')}</span>
            </div>
          )}
          {aScore.threatens.length === 0 && dScore.threatens.length === 0 && (
            <div className="text-[11px] text-slate-500">Neither Pokemon has super-effective STAB against the other</div>
          )}

          {/* Speed check */}
          {(() => {
            const aData = getPokemonData(attacker.species);
            const dData = getPokemonData(defender.species);
            if (!aData || !dData) return null;
            const faster = aData.baseStats.spe > dData.baseStats.spe ? attacker.species : dData.baseStats.spe > aData.baseStats.spe ? defender.species : 'tied';
            return (
              <div className="text-[11px] text-slate-500">
                Speed: {faster === 'tied' ? 'Speed tie' : `${faster} is faster (${Math.max(aData.baseStats.spe, dData.baseStats.spe)} vs ${Math.min(aData.baseStats.spe, dData.baseStats.spe)})`}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
