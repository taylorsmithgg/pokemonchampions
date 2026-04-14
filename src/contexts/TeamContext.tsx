import { createContext, useContext, useState, useCallback } from 'react';
import type { PokemonState } from '../types';
import { createDefaultPokemonState } from '../types';

interface TeamContextValue {
  team: PokemonState[];
  setTeam: (team: PokemonState[]) => void;
  /** Load a Pokemon to the calc attacker or defender slot. */
  loadToCalc: (pokemon: PokemonState, side: 'attacker' | 'defender') => void;
  /** Register the calc's attacker/defender setters so loadToCalc works across routes. */
  registerCalcHandlers: (handlers: { setAttacker: (p: PokemonState) => void; setDefender: (p: PokemonState) => void }) => void;
}

const TeamCtx = createContext<TeamContextValue | null>(null);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [team, setTeam] = useState<PokemonState[]>(() =>
    Array.from({ length: 6 }, () => createDefaultPokemonState())
  );
  const [calcHandlers, setCalcHandlers] = useState<{ setAttacker: (p: PokemonState) => void; setDefender: (p: PokemonState) => void } | null>(null);

  const registerCalcHandlers = useCallback((h: { setAttacker: (p: PokemonState) => void; setDefender: (p: PokemonState) => void }) => {
    setCalcHandlers(h);
  }, []);

  const loadToCalc = useCallback((pokemon: PokemonState, side: 'attacker' | 'defender') => {
    if (calcHandlers) {
      if (side === 'attacker') calcHandlers.setAttacker(pokemon);
      else calcHandlers.setDefender(pokemon);
    }
  }, [calcHandlers]);

  return (
    <TeamCtx.Provider value={{ team, setTeam, loadToCalc, registerCalcHandlers }}>
      {children}
    </TeamCtx.Provider>
  );
}

export function useTeam() {
  const ctx = useContext(TeamCtx);
  if (!ctx) throw new Error('useTeam must be used within TeamProvider');
  return ctx;
}
