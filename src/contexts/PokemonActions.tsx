import { createContext, useContext, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createDefaultPokemonState } from '../types';
import { resolveBuild } from '../calc/buildResolver';
import type { PokemonState } from '../types';

/**
 * Builds a fully-populated PokemonState from a species name.
 * Uses the unified build resolver (live data → preset → auto → default)
 * so every entry point produces the same build.
 */
export function buildPokemonFromSpecies(species: string): PokemonState {
  if (!species) return createDefaultPokemonState();
  return resolveBuild(species);
}

interface Handlers {
  sendToAttacker?: (species: string) => void;
  sendToDefender?: (species: string) => void;
  addToTeam?: (species: string) => void;
}

interface PokemonActions {
  /** Load species into the attacker slot. */
  sendToAttacker: (species: string) => void;
  /** Load species into the defender slot. */
  sendToDefender: (species: string) => void;
  /** Drop species into the next empty team slot (opens the builder). */
  addToTeam: (species: string) => void;
  /** Calculator registers its live setters; TierListPage leaves them unset. */
  registerHandlers: (handlers: Handlers) => void;
}

const PokemonActionsContext = createContext<PokemonActions | null>(null);

export const PENDING_ACTION_KEY = 'pendingPokemonAction';
export const PENDING_SPECIES_KEY = 'pendingPokemonSpecies';

export function PokemonActionsProvider({ children }: { children: React.ReactNode }) {
  const handlers = useRef<Handlers>({});
  const navigate = useNavigate();
  const location = useLocation();

  const queueAction = useCallback((action: 'attacker' | 'defender' | 'team', species: string) => {
    sessionStorage.setItem(PENDING_ACTION_KEY, action);
    sessionStorage.setItem(PENDING_SPECIES_KEY, species);
    // Navigate to the Calculator route. HashRouter uses '/'.
    if (location.pathname !== '/') navigate('/');
  }, [navigate, location.pathname]);

  const sendToAttacker = useCallback((species: string) => {
    if (handlers.current.sendToAttacker) handlers.current.sendToAttacker(species);
    else queueAction('attacker', species);
  }, [queueAction]);

  const sendToDefender = useCallback((species: string) => {
    if (handlers.current.sendToDefender) handlers.current.sendToDefender(species);
    else queueAction('defender', species);
  }, [queueAction]);

  const addToTeam = useCallback((species: string) => {
    if (handlers.current.addToTeam) handlers.current.addToTeam(species);
    else queueAction('team', species);
  }, [queueAction]);

  const registerHandlers = useCallback((h: Handlers) => {
    handlers.current = h;
  }, []);

  return (
    <PokemonActionsContext.Provider value={{ sendToAttacker, sendToDefender, addToTeam, registerHandlers }}>
      {children}
    </PokemonActionsContext.Provider>
  );
}

export function usePokemonActions(): PokemonActions {
  const ctx = useContext(PokemonActionsContext);
  if (!ctx) throw new Error('usePokemonActions must be used within PokemonActionsProvider');
  return ctx;
}
