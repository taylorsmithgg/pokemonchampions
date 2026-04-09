import { useMemo } from 'react';
import { Sprite } from './Sprite';
import { getPokemonData, TYPE_COLORS } from '../data/champions';
import { getTierForPokemon, TIER_DEFINITIONS } from '../data/tierlist';
import { suggestItems, findDuplicateItems } from '../calc/itemOptimizer';
import { auditTeam } from '../calc/teamAudit';
import type { PokemonState } from '../types';

interface TeamOverviewProps {
  attacker: PokemonState;
  defender: PokemonState;
}

function MiniPokemonCard({ pokemon, otherItem }: { pokemon: PokemonState; otherItem: string }) {
  if (!pokemon.species) return null;

  const data = getPokemonData(pokemon.species);
  const tier = getTierForPokemon(pokemon.species);
  const tierDef = tier ? TIER_DEFINITIONS.find(d => d.tier === tier.tier) : null;
  const spTotal = Object.values(pokemon.sps).reduce((a: number, b: number) => a + b, 0);
  const hasDupeItem = pokemon.item && pokemon.item === otherItem;

  // Get item suggestions
  const takenItems = new Set<string>();
  if (otherItem) takenItems.add(otherItem);
  const itemSuggestions = useMemo(() => suggestItems(pokemon, takenItems), [pokemon, otherItem]);

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: '#12121F' }}>
      {/* Sprite */}
<Sprite species={pokemon.species} size="lg" className="shrink-0" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-white">{pokemon.species}</span>
          {tierDef && (
            <span className={`text-xs font-black px-1.5 py-0.5 rounded ${tierDef.bgColor} ${tierDef.color} border ${tierDef.borderColor}`}>
              {tier!.tier}
            </span>
          )}
          {data && data.types.map((t: string) => (
            <span key={t} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[t] || '#666' }} />
          ))}
        </div>

        {/* Key stats row */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
          <span>{pokemon.nature}</span>
          <span className={hasDupeItem ? 'text-red-400 font-bold' : ''}>
            {pokemon.item || 'No item'}{hasDupeItem ? ' (DUPLICATE)' : ''}
          </span>
          <span>{pokemon.ability || '—'}</span>
          <span className={spTotal === 66 ? 'text-emerald-400' : 'text-amber-400'}>{spTotal}/66 SP</span>
        </div>

        {/* Moves */}
        <div className="flex flex-wrap gap-1 mt-1">
          {pokemon.moves.filter(Boolean).map((m: string) => (
            <span key={m} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#1a1b30' }}>
              {m}
            </span>
          ))}
          {pokemon.moves.filter(Boolean).length === 0 && (
            <span className="text-xs text-slate-600 italic">No moves set</span>
          )}
        </div>

        {/* Item suggestion if duplicate or missing */}
        {(hasDupeItem || !pokemon.item) && itemSuggestions.length > 0 && (
          <div className="mt-1.5 text-xs">
            <span className="text-poke-gold">Suggested: </span>
            {itemSuggestions.slice(0, 3).map((s, i) => (
              <span key={s.item}>
                {i > 0 && <span className="text-slate-600"> · </span>}
                <span className="text-slate-300" title={s.reason}>{s.item}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TeamOverview({ attacker, defender }: TeamOverviewProps) {
  const hasTeam = attacker.species || defender.species;
  if (!hasTeam) return null;

  const audit = useMemo(() => auditTeam([attacker, defender]), [attacker, defender]);
  const scoreColor = audit.score >= 80 ? 'text-emerald-400' : audit.score >= 60 ? 'text-amber-400' : audit.score >= 40 ? 'text-orange-400' : 'text-red-400';

  const duplicates = useMemo(() => findDuplicateItems([attacker, defender]), [attacker, defender]);

  return (
    <div className="poke-panel">
      <div className="poke-panel-header bg-gradient-to-r from-poke-gold/8 to-transparent">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Team Overview</h3>
          <div className="flex items-center gap-3">
            {/* Role badges */}
            <div className="flex gap-1">
              {Object.entries(audit.roleReport).map(([key, value]) => {
                if (typeof value !== 'boolean') return null;
                const labels: Record<string, string> = {
                  hasFakeOut: 'FO', hasTailwind: 'TW', hasTrickRoom: 'TR',
                  hasIntim: 'Intim', hasRedirect: 'Redir', hasPriority: 'Prio',
                };
                const label = labels[key];
                if (!label) return null;
                return (
                  <span key={key} className={`text-xs px-1.5 py-0.5 rounded ${
                    value ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-600 border border-poke-border'
                  }`}>
                    {value ? '✓' : '✗'}{label}
                  </span>
                );
              })}
            </div>
            <span className={`text-lg font-black ${scoreColor}`}>{audit.score}</span>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {/* Pokemon cards */}
        <MiniPokemonCard pokemon={attacker} otherItem={defender.item} />
        <MiniPokemonCard pokemon={defender} otherItem={attacker.item} />

        {/* Duplicate item warning */}
        {duplicates.length > 0 && (
          <div className="p-2 rounded-lg border border-red-500/30 bg-red-500/5">
            <div className="text-sm text-red-400 font-semibold">Item Clause Violation</div>
            {duplicates.map(d => (
              <div key={d.item} className="text-xs text-red-400/80 mt-0.5">
                {d.item} is held by {d.holders.join(' and ')} — only 1 of each item per team
              </div>
            ))}
          </div>
        )}

        {/* Critical audit issues */}
        {audit.issues.filter(i => i.severity === 'critical').slice(0, 2).map(issue => (
          <div key={issue.id} className="text-xs text-red-400/80 flex gap-1.5">
            <span className="shrink-0">✗</span>
            <span>{issue.title}</span>
          </div>
        ))}

        {/* Shared weaknesses */}
        {audit.typeChart.sharedWeaknesses.length > 0 && (
          <div className="text-xs text-amber-400/80 flex gap-1.5">
            <span className="shrink-0">⚠</span>
            <span>Shared weakness: {audit.typeChart.sharedWeaknesses.map(w => w.type).join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
