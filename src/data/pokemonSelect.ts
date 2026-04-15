import { getAvailablePokemon } from './champions';

let cachedPokemonSelectPool: string[] | null = null;

/**
 * Shared UI source of truth for Pokemon selection widgets.
 * Every picker should start from this exact Champions-legal pool.
 */
export function getPokemonSelectPool(): string[] {
  if (!cachedPokemonSelectPool) {
    cachedPokemonSelectPool = getAvailablePokemon();
  }
  return [...cachedPokemonSelectPool];
}
