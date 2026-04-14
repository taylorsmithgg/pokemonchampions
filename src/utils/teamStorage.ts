import type { PokemonState, NatureName } from '../types';
import { createDefaultPokemonState, CHAMPIONS_LEVEL } from '../types';

// ─── Types ────────────────────────────────────────────────────────

export interface SavedTeam {
  id: string;
  name: string;
  timestamp: number;
  team: PokemonState[];
}

interface CompactPokemon {
  s: string;   // species
  n: string;   // nature
  a: string;   // ability
  i: string;   // item
  sp: number[]; // [hp, atk, def, spa, spd, spe]
  m: string[];  // moves (non-empty only)
  mg?: boolean; // isMega
}

interface ExportedTeam {
  format: 'champions-team-v1';
  name: string;
  exported: string; // ISO date
  team: Array<{
    species: string;
    nature: string;
    ability: string;
    item: string;
    sps: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
    moves: string[];
    isMega: boolean;
  }>;
}

const STORAGE_KEY = 'champions-saved-teams';

// ─── Helpers ──────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function isValidNature(n: string): n is NatureName {
  const natures: string[] = [
    'Adamant','Bashful','Bold','Brave','Calm','Careful','Docile','Gentle',
    'Hardy','Hasty','Impish','Jolly','Lax','Lonely','Mild','Modest',
    'Naive','Naughty','Quiet','Quirky','Rash','Relaxed','Sassy','Serious','Timid',
  ];
  return natures.includes(n);
}

function clampSP(v: unknown): number {
  const n = typeof v === 'number' ? v : 0;
  return Math.max(0, Math.min(32, Math.floor(n)));
}

/** Rebuild a full PokemonState from partial/imported data, filling defaults. */
function hydratePokemon(raw: Partial<PokemonState> & { species: string }): PokemonState {
  const base = createDefaultPokemonState();
  base.species = raw.species;
  base.nature = (raw.nature && isValidNature(raw.nature)) ? raw.nature : 'Adamant';
  base.ability = typeof raw.ability === 'string' ? raw.ability : '';
  base.item = typeof raw.item === 'string' ? raw.item : '';
  base.teraType = ''; // Never set — not in Champions
  base.level = CHAMPIONS_LEVEL;
  base.isMega = !!raw.isMega;

  if (raw.sps && typeof raw.sps === 'object') {
    base.sps = {
      hp: clampSP(raw.sps.hp),
      atk: clampSP(raw.sps.atk),
      def: clampSP(raw.sps.def),
      spa: clampSP(raw.sps.spa),
      spd: clampSP(raw.sps.spd),
      spe: clampSP(raw.sps.spe),
    };
  }

  if (Array.isArray(raw.moves)) {
    base.moves = [
      typeof raw.moves[0] === 'string' ? raw.moves[0] : '',
      typeof raw.moves[1] === 'string' ? raw.moves[1] : '',
      typeof raw.moves[2] === 'string' ? raw.moves[2] : '',
      typeof raw.moves[3] === 'string' ? raw.moves[3] : '',
    ];
  }

  return base;
}

// ─── LocalStorage: Save / Load / Delete ───────────────────────────

export function saveTeamToLocal(name: string, team: PokemonState[]): SavedTeam {
  const saved: SavedTeam = {
    id: generateId(),
    name: name.trim() || 'Untitled Team',
    timestamp: Date.now(),
    team: team.slice(0, 6),
  };

  const existing = loadSavedTeams();
  existing.unshift(saved);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  return saved;
}

export function loadSavedTeams(): SavedTeam[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function deleteSavedTeam(id: string): void {
  const teams = loadSavedTeams().filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
}

export function loadSavedTeam(id: string): PokemonState[] | null {
  const teams = loadSavedTeams();
  const found = teams.find(t => t.id === id);
  if (!found) return null;
  // Rehydrate every slot to ensure full PokemonState shape
  return found.team.map(slot =>
    slot.species ? hydratePokemon(slot) : createDefaultPokemonState()
  );
}

// ─── Export as JSON ───────────────────────────────────────────────

export function exportTeamAsJson(team: PokemonState[], name?: string): string {
  const exported: ExportedTeam = {
    format: 'champions-team-v1',
    name: name || 'Exported Team',
    exported: new Date().toISOString(),
    team: team.slice(0, 6).map(p => ({
      species: p.species,
      nature: p.nature,
      ability: p.ability,
      item: p.item,
      sps: { ...p.sps },
      moves: p.moves.filter(m => m !== ''),
      isMega: p.isMega,
    })),
  };
  return JSON.stringify(exported, null, 2);
}

// ─── Import from JSON ─────────────────────────────────────────────

export function importTeamFromJson(json: string): PokemonState[] | null {
  try {
    const parsed = JSON.parse(json);

    // Accept the structured format
    if (parsed.format === 'champions-team-v1' && Array.isArray(parsed.team)) {
      return parsed.team.slice(0, 6).map((slot: Record<string, unknown>) => {
        if (!slot.species || typeof slot.species !== 'string') return createDefaultPokemonState();
        return hydratePokemon(slot as Partial<PokemonState> & { species: string });
      });
    }

    // Accept a bare array of pokemon objects
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 6).map((slot: Record<string, unknown>) => {
        if (!slot.species || typeof slot.species !== 'string') return createDefaultPokemonState();
        return hydratePokemon(slot as Partial<PokemonState> & { species: string });
      });
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Export / Import as shareable code (base64) ───────────────────

export function exportTeamAsCode(team: PokemonState[]): string {
  const compact: CompactPokemon[] = team
    .slice(0, 6)
    .filter(p => p.species)
    .map(p => {
      const entry: CompactPokemon = {
        s: p.species,
        n: p.nature,
        a: p.ability,
        i: p.item,
        sp: [p.sps.hp, p.sps.atk, p.sps.def, p.sps.spa, p.sps.spd, p.sps.spe],
        m: p.moves.filter(m => m !== ''),
      };
      if (p.isMega) entry.mg = true;
      return entry;
    });

  const jsonStr = JSON.stringify(compact);
  // Use btoa for browser-safe base64
  return btoa(encodeURIComponent(jsonStr));
}

export function importTeamFromCode(code: string): PokemonState[] | null {
  try {
    const trimmed = code.trim();
    const jsonStr = decodeURIComponent(atob(trimmed));
    const compact: CompactPokemon[] = JSON.parse(jsonStr);

    if (!Array.isArray(compact)) return null;

    const result: PokemonState[] = [];
    for (const entry of compact.slice(0, 6)) {
      if (!entry.s || typeof entry.s !== 'string') {
        result.push(createDefaultPokemonState());
        continue;
      }

      const sps = Array.isArray(entry.sp) && entry.sp.length === 6
        ? { hp: clampSP(entry.sp[0]), atk: clampSP(entry.sp[1]), def: clampSP(entry.sp[2]),
            spa: clampSP(entry.sp[3]), spd: clampSP(entry.sp[4]), spe: clampSP(entry.sp[5]) }
        : { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

      const moves = Array.isArray(entry.m)
        ? [entry.m[0] || '', entry.m[1] || '', entry.m[2] || '', entry.m[3] || '']
        : ['', '', '', ''];

      result.push(hydratePokemon({
        species: entry.s,
        nature: entry.n as NatureName,
        ability: entry.a || '',
        item: entry.i || '',
        sps,
        moves,
        isMega: !!entry.mg,
      }));
    }

    // Pad to 6 slots
    while (result.length < 6) {
      result.push(createDefaultPokemonState());
    }

    return result;
  } catch {
    return null;
  }
}
