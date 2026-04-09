import { useMemo, useState, useCallback } from 'react';
import type { CalcResult } from '../calc/championsCalc';
import { calculateAllMoves, compareSpeed } from '../calc/championsCalc';
import { analyzePair } from '../data/synergies';
import type { PokemonState, FieldState } from '../types';

interface ResultsPanelProps {
  attacker: PokemonState;
  defender: PokemonState;
  field: FieldState;
}

function DamageBar({ result, onCopy }: { result: CalcResult; onCopy: (text: string) => void }) {
  const { minPercent, maxPercent, koChance } = result;
  const [showDesc, setShowDesc] = useState(false);

  let barColor = '#6366f1';
  if (maxPercent >= 100) barColor = '#ef4444';
  else if (maxPercent >= 50) barColor = '#f97316';
  else if (maxPercent >= 33) barColor = '#eab308';

  let koText = '';
  let koColor = 'text-slate-500';
  if (koChance.n > 0) {
    const pct = koChance.chance !== undefined && koChance.chance < 1
      ? `${(koChance.chance * 100).toFixed(1)}%`
      : 'Guaranteed';

    if (koChance.n === 1) { koText = `${pct} OHKO`; koColor = 'text-red-400'; }
    else if (koChance.n === 2) { koText = `${pct} 2HKO`; koColor = 'text-orange-400'; }
    else if (koChance.n === 3) { koText = `${pct} 3HKO`; koColor = 'text-yellow-400'; }
    else { koText = `${koChance.n}HKO`; koColor = 'text-blue-400'; }
  }

  return (
    <div className="bg-poke-surface/50 rounded-lg p-3 border border-poke-border/50 hover:border-slate-600/50 transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-white">{result.moveName}</span>
        <div className="flex items-center gap-2">
          {koText && <span className={`text-xs font-bold ${koColor}`}>{koText}</span>}
          <button
            onClick={() => onCopy(result.description)}
            className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
            title="Copy calc string"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Damage bar */}
      <div className="relative h-2.5 bg-slate-700 rounded-full overflow-hidden mb-1.5">
        <div
          className="absolute h-full rounded-full opacity-60"
          style={{
            width: `${Math.min(minPercent, 100)}%`,
            backgroundColor: barColor,
          }}
        />
        <div
          className="absolute h-full rounded-full"
          style={{
            left: `${Math.min(minPercent, 100)}%`,
            width: `${Math.min(maxPercent - minPercent, 100 - Math.min(minPercent, 100))}%`,
            backgroundColor: barColor,
            opacity: 0.35,
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {result.minDamage}-{result.maxDamage} ({minPercent.toFixed(1)}-{maxPercent.toFixed(1)}%)
        </span>
        <button
          onClick={() => setShowDesc(!showDesc)}
          className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          {showDesc ? 'hide' : 'details'}
        </button>
      </div>

      {/* Full description */}
      {showDesc && (
        <div className="mt-2 p-2 bg-poke-panel/80 rounded text-[11px] text-slate-400 font-mono leading-relaxed break-all">
          {result.description}
        </div>
      )}

      {result.recoil && result.recoil.text && (
        <div className="mt-1 text-[10px] text-red-400/70">{result.recoil.text}</div>
      )}
      {result.recovery && result.recovery.text && (
        <div className="mt-1 text-[10px] text-emerald-400/70">{result.recovery.text}</div>
      )}
    </div>
  );
}

function SpeedComparison({ attacker, defender, field }: ResultsPanelProps) {
  const speed = useMemo(() => {
    if (!attacker.species || !defender.species) return null;
    try {
      return compareSpeed(attacker, defender, field);
    } catch {
      return null;
    }
  }, [attacker, defender, field]);

  if (!speed) return null;

  const faster = speed.speedTie ? null : speed.aFirst ? 'attacker' : 'defender';

  return (
    <div className="bg-poke-surface/30 rounded-lg p-3 border border-poke-border/30">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Speed</span>
        {speed.speedTie && (
          <span className="text-[10px] font-bold text-amber-400 animate-pulse">SPEED TIE</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-medium ${faster === 'attacker' ? 'text-emerald-400' : 'text-slate-500'}`}>
              {attacker.species}
            </span>
            <span className={`text-xs font-mono ${faster === 'attacker' ? 'text-emerald-400' : 'text-slate-500'}`}>
              {speed.aSpeed}
            </span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${faster === 'attacker' ? 'bg-emerald-500' : 'bg-slate-600'}`}
              style={{ width: `${(speed.aSpeed / Math.max(speed.aSpeed, speed.bSpeed)) * 100}%` }}
            />
          </div>
        </div>
        <span className="text-slate-700 text-xs font-bold px-1">vs</span>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-medium ${faster === 'defender' ? 'text-emerald-400' : 'text-slate-500'}`}>
              {defender.species}
            </span>
            <span className={`text-xs font-mono ${faster === 'defender' ? 'text-emerald-400' : 'text-slate-500'}`}>
              {speed.bSpeed}
            </span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${faster === 'defender' ? 'bg-emerald-500' : 'bg-slate-600'}`}
              style={{ width: `${(speed.bSpeed / Math.max(speed.aSpeed, speed.bSpeed)) * 100}%` }}
            />
          </div>
        </div>
      </div>
      {!speed.speedTie && (
        <div className="text-center text-[10px] text-slate-600 mt-1.5">
          <span className="text-emerald-500">{faster === 'attacker' ? attacker.species : defender.species}</span> moves first
        </div>
      )}
    </div>
  );
}

function PairAnalysisCard({ attacker, defender }: { attacker: PokemonState; defender: PokemonState }) {
  const analysis = useMemo(() => {
    if (!attacker.species || !defender.species) return null;
    try { return analyzePair(attacker.species, defender.species); }
    catch { return null; }
  }, [attacker.species, defender.species]);

  if (!analysis) return null;

  const defColor = analysis.defensiveSynergy >= 7 ? 'text-emerald-400' : analysis.defensiveSynergy >= 4 ? 'text-amber-400' : 'text-red-400';
  const offColor = analysis.offensivePressure >= 7 ? 'text-emerald-400' : analysis.offensivePressure >= 4 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="bg-poke-surface/30 rounded-lg p-3 border border-poke-border/30 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Pair Analysis</span>
      </div>

      {/* Score bars */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500">Defensive</span>
            <span className={`text-[10px] font-bold ${defColor}`}>{analysis.defensiveSynergy}/10</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${analysis.defensiveSynergy >= 7 ? 'bg-emerald-500' : analysis.defensiveSynergy >= 4 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${analysis.defensiveSynergy * 10}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500">Offensive</span>
            <span className={`text-[10px] font-bold ${offColor}`}>{analysis.offensivePressure}/10</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${analysis.offensivePressure >= 7 ? 'bg-emerald-500' : analysis.offensivePressure >= 4 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${analysis.offensivePressure * 10}%` }}
            />
          </div>
        </div>
      </div>

      {/* Speed dynamic */}
      <div className="text-[10px] text-slate-400">
        <span className="text-slate-600">Speed: </span>{analysis.speedDynamic}
      </div>

      {/* Shared weaknesses warning */}
      {analysis.weaknessOverlap.length > 0 && (
        <div className="text-[10px] text-red-400/80 flex items-start gap-1">
          <span className="shrink-0">⚠</span>
          <span>Shared weakness to {analysis.weaknessOverlap.join(', ')} — both vulnerable to the same attackers</span>
        </div>
      )}

      {/* Suggestions */}
      {analysis.suggestions.length > 0 && (
        <div className="space-y-0.5 pt-1 border-t border-poke-border/30">
          {analysis.suggestions.map((s: string, i: number) => (
            <div key={i} className="text-[10px] text-slate-500 flex items-start gap-1.5">
              <span className="text-poke-red-light shrink-0">→</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ResultsPanel({ attacker, defender, field }: ResultsPanelProps) {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  }, []);

  const attackerResults = useMemo(() => {
    if (!attacker.species || !defender.species) return [];
    try {
      return calculateAllMoves(attacker, defender, field, attacker.moveOptions);
    } catch {
      return [];
    }
  }, [attacker, defender, field]);

  const defenderResults = useMemo(() => {
    if (!attacker.species || !defender.species) return [];
    try {
      const swappedField = {
        ...field,
        attackerSide: field.defenderSide,
        defenderSide: field.attackerSide,
      };
      return calculateAllMoves(defender, attacker, swappedField, defender.moveOptions);
    } catch {
      return [];
    }
  }, [attacker, defender, field]);

  const hasAttackerResults = attackerResults.some(r => r !== null);
  const hasDefenderResults = defenderResults.some(r => r !== null);

  if (!attacker.species || !defender.species) {
    return (
      <div className="bg-poke-panel rounded-xl border border-slate-800 p-8 flex flex-col items-center justify-center gap-3">
        <svg className="w-12 h-12 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-slate-600 text-center">Select Pokémon on both sides to see damage calculations</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 relative">
      {/* Copy toast */}
      {copiedText !== null && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-50 text-[10px] px-2 py-1 bg-emerald-500 text-white rounded shadow-lg animate-pulse">
          Copied!
        </div>
      )}

      {/* Speed comparison */}
      <SpeedComparison attacker={attacker} defender={defender} field={field} />

      {/* Pair analysis */}
      <PairAnalysisCard attacker={attacker} defender={defender} />

      {/* Attacker -> Defender */}
      {hasAttackerResults && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-poke-red-light">{attacker.species}</span>
            <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span className="text-xs font-semibold text-rose-400">{defender.species}</span>
          </div>
          <div className="space-y-1.5">
            {attackerResults.map((result, i) => (
              result && <DamageBar key={`a-${i}`} result={result} onCopy={handleCopy} />
            ))}
          </div>
        </div>
      )}

      {/* Defender -> Attacker */}
      {hasDefenderResults && (
        <div className={hasAttackerResults ? 'pt-2 border-t border-slate-800' : ''}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-rose-400">{defender.species}</span>
            <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span className="text-xs font-semibold text-poke-red-light">{attacker.species}</span>
          </div>
          <div className="space-y-1.5">
            {defenderResults.map((result, i) => (
              result && <DamageBar key={`d-${i}`} result={result} onCopy={handleCopy} />
            ))}
          </div>
        </div>
      )}

      {!hasAttackerResults && !hasDefenderResults && (
        <div className="bg-poke-panel rounded-xl border border-slate-800 p-6 text-center">
          <p className="text-sm text-slate-600">Add moves to see damage calculations</p>
        </div>
      )}

      {/* Copy all results */}
      {(hasAttackerResults || hasDefenderResults) && (
        <button
          onClick={() => {
            const allDescs = [
              ...attackerResults.filter(Boolean).map(r => r!.description),
              ...defenderResults.filter(Boolean).map(r => r!.description),
            ].join('\n');
            handleCopy(allDescs);
          }}
          className="w-full text-[10px] py-1.5 text-slate-600 hover:text-slate-400 transition-colors border border-slate-800 rounded-lg hover:border-poke-border"
        >
          Copy all results
        </button>
      )}
    </div>
  );
}
