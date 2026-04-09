import { useMemo, useState } from 'react';
import { getRecommendations, type SynergyRecommendation, type SynergyReason } from '../data/synergies';
import { suggestLeadPartners, type LeadScore } from '../calc/openerAnalysis';
import type { PokemonState } from '../types';

interface SynergyPanelProps {
  attacker: PokemonState;
  defender: PokemonState;
  onLoadPokemon: (species: string, side: 'attacker' | 'defender') => void;
}

const TYPE_COLORS: Record<string, string> = {
  weather: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  'speed-control': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  ability: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  'type-coverage': 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  core: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  support: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  terrain: 'text-green-400 bg-green-500/10 border-green-500/20',
};

function StrengthDots({ strength }: { strength: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className={`w-1 h-1 rounded-full ${i <= strength ? 'bg-amber-400' : 'bg-slate-700'}`}
        />
      ))}
    </div>
  );
}

function RecommendationCard({
  rec,
  onLoad,
}: {
  rec: SynergyRecommendation;
  onLoad: (species: string, side: 'attacker' | 'defender') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const spriteId = rec.species.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

  // Group reasons by type and show the strongest
  const topReason = rec.reasons.reduce((best, r) => r.strength > best.strength ? r : best, rec.reasons[0]);

  return (
    <div
      className="bg-slate-800/40 rounded-lg border border-poke-border/40 hover:border-slate-600/60 transition-all cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 p-2">
        <img
          src={`https://play.pokemonshowdown.com/sprites/ani/${spriteId}.gif`}
          alt={rec.species}
          className="w-12 h-12 object-contain shrink-0"
          loading="lazy"
          onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-white truncate">{rec.species}</span>
            <StrengthDots strength={Math.min(topReason.strength, 3)} />
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`text-[9px] px-1.5 py-0 rounded border ${TYPE_COLORS[topReason.type] || 'text-slate-400 bg-slate-500/10 border-slate-500/20'}`}>
              {topReason.label}
            </span>
            {rec.reasons.length > 1 && (
              <span className="text-[9px] text-slate-600">+{rec.reasons.length - 1} more</span>
            )}
          </div>
        </div>
        <div className="flex gap-0.5 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onLoad(rec.species, 'attacker'); }}
            className="text-[8px] px-1.5 py-0.5 bg-poke-red/60 text-white rounded hover:bg-indigo-500 transition-colors"
          >
            ATK
          </button>
          <button
            onClick={e => { e.stopPropagation(); onLoad(rec.species, 'defender'); }}
            className="text-[8px] px-1.5 py-0.5 bg-rose-500/60 text-white rounded hover:bg-rose-500 transition-colors"
          >
            DEF
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-2 pb-2 space-y-1 border-t border-poke-border/30 pt-1.5 mt-0.5">
          {rec.reasons.map((reason: SynergyReason, i: number) => (
            <div key={i} className="flex gap-1.5 items-start">
              <span className={`text-[9px] px-1.5 py-0 rounded border shrink-0 mt-0.5 ${TYPE_COLORS[reason.type] || ''}`}>
                {reason.label}
              </span>
              <span className="text-[10px] text-slate-400 leading-relaxed">{reason.description}</span>
            </div>
          ))}
          {rec.preset && (
            <div className="mt-1 pt-1 border-t border-poke-border/30 text-[10px] text-slate-500">
              Preset available: <span className="text-poke-red-light">{rec.preset.label}</span> ({rec.preset.nature}, {rec.preset.item})
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SynergyPanel({ attacker, defender, onLoadPokemon }: SynergyPanelProps) {
  const [activeTab, setActiveTab] = useState<'synergy' | 'openers'>('synergy');
  const [synergyFor, setSynergyFor] = useState<'attacker' | 'defender'>('attacker');

  const attackerRecs = useMemo(() => {
    if (!attacker.species) return [];
    return getRecommendations(attacker.species, defender.species);
  }, [attacker.species, defender.species]);

  const defenderRecs = useMemo(() => {
    if (!defender.species) return [];
    return getRecommendations(defender.species, attacker.species);
  }, [defender.species, attacker.species]);

  const activeSpecies = synergyFor === 'attacker' ? attacker.species : defender.species;
  const activeRecs = synergyFor === 'attacker' ? attackerRecs : defenderRecs;

  // Opener analysis for the currently selected Pokemon
  const openerSuggestions = useMemo(() => {
    const target = synergyFor === 'attacker' ? attacker : defender;
    if (!target.species) return [];
    return suggestLeadPartners(target);
  }, [attacker, defender, synergyFor]);

  if (!attacker.species && !defender.species) return null;

  return (
    <div className="poke-panel overflow-hidden">
      <div className="px-3 py-2 poke-panel-header bg-gradient-to-r from-poke-gold/8 to-transparent space-y-2">
        {/* Tab selector */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveTab('synergy')}
            className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${
              activeTab === 'synergy'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-slate-500 hover:text-slate-400 border border-transparent'
            }`}
          >
            Partners
          </button>
          <button
            onClick={() => setActiveTab('openers')}
            className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${
              activeTab === 'openers'
                ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                : 'text-slate-500 hover:text-slate-400 border border-transparent'
            }`}
          >
            Best Leads
          </button>
          <div className="ml-auto flex gap-1">
            {attacker.species && (
              <button
                onClick={() => setSynergyFor('attacker')}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                  synergyFor === 'attacker'
                    ? 'bg-poke-red/20 text-poke-red-light border border-poke-red/30'
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                {attacker.species}
              </button>
            )}
            {defender.species && (
              <button
                onClick={() => setSynergyFor('defender')}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                  synergyFor === 'defender'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                {defender.species}
              </button>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'synergy' && (
        activeRecs.length > 0 ? (
          <div className="p-2 space-y-1.5 ">
            <p className="text-[10px] text-slate-600 px-1">
              Partners for <span className="text-white font-medium">{activeSpecies}</span> — click to expand, ATK/DEF to load
            </p>
            {activeRecs.map((rec: SynergyRecommendation) => (
              <RecommendationCard
                key={rec.species}
                rec={rec}
                onLoad={onLoadPokemon}
              />
            ))}
          </div>
        ) : activeSpecies ? (
          <div className="p-4 text-center">
            <p className="text-xs text-slate-600">No synergy data for {activeSpecies} yet</p>
          </div>
        ) : (
          <div className="p-4 text-center">
            <p className="text-xs text-slate-600">Select a Pokemon to see partner suggestions</p>
          </div>
        )
      )}

      {activeTab === 'openers' && (
        openerSuggestions.length > 0 ? (
          <div className="p-2 space-y-1.5 ">
            <p className="text-[10px] text-slate-600 px-1">
              Best lead partners for <span className="text-white font-medium">{activeSpecies}</span> in Doubles
            </p>
            {openerSuggestions.map((lead: LeadScore, i: number) => {
              const partner = lead.pokemon[0] === activeSpecies ? lead.pokemon[1] : lead.pokemon[0];
              const spriteId = partner.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
              return (
                <div key={i} className="bg-slate-800/40 rounded-lg border border-poke-border/40 p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <img
                      src={`https://play.pokemonshowdown.com/sprites/ani/${spriteId}.gif`}
                      alt={partner}
                      className="w-12 h-12 object-contain"
                      loading="lazy"
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{activeSpecies} + {partner}</span>
                        <span className="text-[9px] font-mono text-amber-400">{lead.totalScore} pts</span>
                      </div>
                      {/* Score bar */}
                      <div className="h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${lead.totalScore >= 40 ? 'bg-emerald-500' : lead.totalScore >= 25 ? 'bg-amber-500' : 'bg-slate-500'}`}
                          style={{ width: `${Math.min(100, (lead.totalScore / 60) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <button
                        onClick={() => onLoadPokemon(partner, 'attacker')}
                        className="text-[8px] px-1.5 py-0.5 bg-poke-red/60 text-white rounded hover:bg-indigo-500"
                      >
                        ATK
                      </button>
                      <button
                        onClick={() => onLoadPokemon(partner, 'defender')}
                        className="text-[8px] px-1.5 py-0.5 bg-rose-500/60 text-white rounded hover:bg-rose-500"
                      >
                        DEF
                      </button>
                    </div>
                  </div>
                  {/* Commentary */}
                  <div className="space-y-0.5">
                    {lead.commentary.map((c: string, j: number) => (
                      <div key={j} className="text-[9px] text-slate-500 flex gap-1 items-start">
                        <span className="text-violet-400 shrink-0">•</span>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                  {/* Score breakdown mini */}
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-poke-border/30">
                    {lead.breakdown.fakeOutPressure > 0 && <span className="text-[8px] px-1 py-0 bg-blue-500/10 text-blue-400 rounded">Fake Out +{lead.breakdown.fakeOutPressure}</span>}
                    {lead.breakdown.speedControl > 0 && <span className="text-[8px] px-1 py-0 bg-yellow-500/10 text-yellow-400 rounded">Speed +{lead.breakdown.speedControl}</span>}
                    {lead.breakdown.offensivePressure > 0 && <span className="text-[8px] px-1 py-0 bg-red-500/10 text-red-400 rounded">Offense +{lead.breakdown.offensivePressure}</span>}
                    {lead.breakdown.intimidatePivot > 0 && <span className="text-[8px] px-1 py-0 bg-purple-500/10 text-purple-400 rounded">Intimidate +{lead.breakdown.intimidatePivot}</span>}
                    {lead.breakdown.synergyBonus > 0 && <span className="text-[8px] px-1 py-0 bg-emerald-500/10 text-emerald-400 rounded">Synergy +{lead.breakdown.synergyBonus}</span>}
                    {lead.breakdown.weaknessOverlap < 0 && <span className="text-[8px] px-1 py-0 bg-red-500/10 text-red-500 rounded">Weak {lead.breakdown.weaknessOverlap}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 text-center">
            <p className="text-xs text-slate-600">Select a Pokemon with moves to analyze lead combinations</p>
          </div>
        )
      )}
    </div>
  );
}
