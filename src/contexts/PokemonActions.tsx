import { createContext, useContext, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getPokemonData } from '../data/champions';
import { getPresetsBySpecies } from '../data/presets';
import { createDefaultPokemonState } from '../types';
import type { PokemonState } from '../types';

/**
 * Builds a fully-populated PokemonState from a species name. If a curated
 * preset exists the preset is used; otherwise we fall back to the first
 * legal ability and an empty set.
 */
export function buildPokemonFromSpecies(species: string): PokemonState {
  if (!species) return createDefaultPokemonState();
  const presets = getPresetsBySpecies(species);
  if (presets.length > 0) {
    const preset = presets[0];
    return {
      ...createDefaultPokemonState(),
      species: preset.species,
      nature: preset.nature,
      ability: preset.ability,
      item: preset.item,
      teraType: '',
      sps: { ...preset.sps },
      moves: [...preset.moves, '', '', '', ''].slice(0, 4),
    };
  }
  const data = getPokemonData(species);
  return {
    ...createDefaultPokemonState(),
    species,
    ability: (data?.abilities?.[0] || '') as string,
    teraType: '',
  };
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
