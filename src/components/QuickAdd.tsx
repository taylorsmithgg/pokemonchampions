// Shared "add to calculator/team" button group. EVERY panel that displays
// a Pokemon and wants to offer a quick action should use this component —
// it routes through the PokemonActions context so the user gets identical
// behavior across MetaRadar, Discovery, Synergy, Audit, TierList, etc.

import { usePokemonActions } from '../contexts/PokemonActions';

interface QuickAddProps {
  species: string;
  /** Compact uses three letter labels; full shows words. */
  variant?: 'compact' | 'full';
  /** Omit actions that don't make sense in a given context. */
  actions?: Array<'attacker' | 'defender' | 'team'>;
  className?: string;
}

const DEFAULT_ACTIONS: Array<'attacker' | 'defender' | 'team'> = ['attacker', 'defender', 'team'];

export function QuickAdd({
  species,
  variant = 'compact',
  actions = DEFAULT_ACTIONS,
  className = '',
}: QuickAddProps) {
  const { sendToAttacker, sendToDefender, addToTeam } = usePokemonActions();

  if (!species) return null;

  const padding = variant === 'compact' ? 'px-2 py-1' : 'px-2.5 py-1.5';
  const labels = variant === 'compact'
    ? { attacker: 'ATK', defender: 'DEF', team: '+ TEAM' }
    : { attacker: '→ Attacker', defender: '→ Defender', team: '+ Team' };

  const handle = (e: React.MouseEvent, fn: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      onClick={e => e.stopPropagation()}
    >
      {actions.includes('attacker') && (
        <button
          onClick={e => handle(e, () => sendToAttacker(species))}
          className={`${padding} text-xs font-bold bg-poke-red/15 text-poke-red-light border border-poke-red/30 rounded hover:bg-poke-red/25 hover:border-poke-red/50 transition-colors`}
          title={`Send ${species} to Attacker slot`}
        >
          {labels.attacker}
        </button>
      )}
      {actions.includes('defender') && (
        <button
          onClick={e => handle(e, () => sendToDefender(species))}
          className={`${padding} text-xs font-bold bg-poke-blue/15 text-poke-blue-light border border-poke-blue/30 rounded hover:bg-poke-blue/25 hover:border-poke-blue/50 transition-colors`}
          title={`Send ${species} to Defender slot`}
        >
          {labels.defender}
        </button>
      )}
      {actions.includes('team') && (
        <button
          onClick={e => handle(e, () => addToTeam(species))}
          className={`${padding} text-xs font-bold bg-poke-gold/15 text-poke-gold border border-poke-gold/30 rounded hover:bg-poke-gold/25 hover:border-poke-gold/50 transition-colors`}
          title={`Add ${species} to Team`}
        >
          {labels.team}
        </button>
      )}
    </div>
  );
}
