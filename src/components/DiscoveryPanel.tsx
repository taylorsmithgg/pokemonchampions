import { useMemo } from 'react';
import { discoverStrategies, type Discovery } from '../calc/metaDiscovery';
import { getSpriteUrl } from '../utils/sprites';

const CATEGORY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  core: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Core' },
  threat: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Threat' },
  counter: { color: 'text-sky-400', bg: 'bg-sky-500/10', label: 'Counter' },
  archetype: { color: 'text-violet-400', bg: 'bg-violet-500/10', label: 'Strategy' },
  underrated: { color: 'text-poke-gold', bg: 'bg-poke-gold/10', label: 'Sleeper' },
  combo: { color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Combo' },
};

function DiscoveryCard({ discovery, onLoadPokemon }: {
  discovery: Discovery;
  onLoadPokemon: (species: string, side: 'attacker' | 'defender') => void;
}) {
  const style = CATEGORY_STYLES[discovery.category] || CATEGORY_STYLES.core;

  return (
    <div className="poke-panel">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Pokemon sprites */}
          <div className="flex -space-x-2 shrink-0">
            {discovery.pokemon.slice(0, 3).map(species => (
              <img
                key={species}
                src={getSpriteUrl(species)}
                alt={species}
                className="w-12 h-12 object-contain"
                loading="lazy"
              />
            ))}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded ${style.bg} ${style.color} font-bold`}>
                {style.label}
              </span>
              <span className="text-xs text-slate-500">{discovery.confidence}% confidence</span>
            </div>
            <h4 className="text-sm font-bold text-white mb-1">{discovery.title}</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-2">{discovery.description}</p>

            {/* Reasoning */}
            <div className="space-y-0.5 mb-2">
              {discovery.reasoning.map((r: string, i: number) => (
                <div key={i} className="text-xs text-slate-500 flex gap-1.5">
                  <span className={`shrink-0 ${style.color}`}>→</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>

            {/* Quick load buttons */}
            <div className="flex flex-wrap gap-1">
              {discovery.pokemon.map(species => (
                <button
                  key={species}
                  onClick={() => onLoadPokemon(species, 'attacker')}
                  className="text-xs px-2 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded hover:border-poke-red/30 hover:text-poke-red-light transition-colors"
                >
                  {species}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DiscoveryPanelProps {
  onLoadPokemon: (species: string, side: 'attacker' | 'defender') => void;
}

export function DiscoveryPanel({ onLoadPokemon }: DiscoveryPanelProps) {
  const discoveries = useMemo(() => discoverStrategies(), []);

  if (discoveries.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Meta Discoveries</h3>
          <p className="text-xs text-slate-500">Strategies unique to the Champions metagame — not found in VGC 2026 data</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {discoveries.slice(0, 8).map(d => (
          <DiscoveryCard key={d.id} discovery={d} onLoadPokemon={onLoadPokemon} />
        ))}
      </div>
    </div>
  );
}
