/**
 * Sprite database — runtime container for pre-computed reference
 * signatures. Analogous to `pokemon_detector/core/sprite_db.py`.
 *
 * The offline build step writes a JSON-encoded array of `SerializedEntry`
 * records (see `scripts/build-sprite-detector-db.mjs`). At runtime we
 * decode them back into typed arrays via `loadSpriteDatabase`.
 */

import type { SpriteSignature } from './features.ts';

export interface SerializedEntry {
  dex: number;
  species: string;      // canonical Champions species id (e.g. "Victreebel", "Charizard-Mega-X")
  name: string;         // display name
  form: string;         // "default" or the form suffix
  panelType: 'opponent' | 'player' | '';
  /** True if this entry is the shiny colour variant of `species`. */
  isShiny?: boolean;
  templateWidth: number;
  templateHeight: number;
  /** base64-encoded grayscale buffer */
  templateB64: string;
  /** base64-encoded binary mask (0 or 255) */
  maskB64: string;
  /** 8×8 perceptual hash as base64 bits packed into bytes */
  phashB64: string;
  /** length 7 */
  huMoments: number[];
  /** HIST_H_BINS × HIST_S_BINS values, row major */
  hsHist: number[];
}

export interface SpriteEntry {
  dex: number;
  species: string;
  name: string;
  form: string;
  panelType: 'opponent' | 'player' | '';
  isShiny: boolean;
  signature: SpriteSignature;
}

export interface SpriteDatabase {
  entries: SpriteEntry[];
  /** Lookup key is `species` for normal variant, `species|shiny` for shiny. */
  bySpecies: Map<string, SpriteEntry>;
}

// ─── Base64 helpers that work both in Node and in the browser ─────────
// We support both envs so build scripts (Node) and the React runtime
// (browser) share the same loader.

// We intentionally avoid `@types/node` here — the browser build
// shouldn't depend on it. Access Node's Buffer only through the global
// bag so the symbol is untyped from TypeScript's perspective.
type BufferLike = {
  from(input: Uint8Array | string, encoding?: string): BufferLike;
  toString(encoding: string): string;
};
const maybeBuffer = (globalThis as { Buffer?: BufferLike }).Buffer;

function bytesToBase64(bytes: Uint8Array): string {
  if (maybeBuffer) return maybeBuffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  if (maybeBuffer) return new Uint8Array(maybeBuffer.from(b64, 'base64') as unknown as ArrayBufferLike);
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// ─── Serialize / deserialize ──────────────────────────────────────────

export function serializeEntry(
  meta: Omit<SpriteEntry, 'signature'>,
  signature: SpriteSignature,
): SerializedEntry {
  return {
    dex: meta.dex,
    species: meta.species,
    name: meta.name,
    form: meta.form,
    panelType: meta.panelType,
    isShiny: meta.isShiny || undefined,
    templateWidth: signature.templateWidth,
    templateHeight: signature.templateHeight,
    templateB64: bytesToBase64(signature.template),
    maskB64: bytesToBase64(signature.maskBytes),
    phashB64: bytesToBase64(signature.phash),
    huMoments: Array.from(signature.huMoments),
    hsHist: Array.from(signature.hsHist),
  };
}

export function deserializeEntry(entry: SerializedEntry): SpriteEntry {
  const template = base64ToBytes(entry.templateB64);
  const maskBytes = base64ToBytes(entry.maskB64);
  const phash = base64ToBytes(entry.phashB64);
  return {
    dex: entry.dex,
    species: entry.species,
    name: entry.name,
    form: entry.form,
    panelType: entry.panelType,
    isShiny: entry.isShiny === true,
    signature: {
      template,
      templateWidth: entry.templateWidth,
      templateHeight: entry.templateHeight,
      maskBytes,
      phash,
      huMoments: new Float64Array(entry.huMoments),
      hsHist: new Float32Array(entry.hsHist),
    },
  };
}

export function loadSpriteDatabase(serialized: SerializedEntry[]): SpriteDatabase {
  const entries = serialized.map(deserializeEntry);
  const bySpecies = new Map<string, SpriteEntry>();
  for (const e of entries) {
    // Index normal vs shiny separately so shiny entries don't shadow normals
    // and vice versa. Lookup key: `species` for normal, `species|shiny` for shiny.
    const key = e.isShiny ? `${e.species}|shiny` : e.species;
    const existing = bySpecies.get(key);
    if (!existing || (e.panelType && !existing.panelType)) {
      bySpecies.set(key, e);
    }
  }
  return { entries, bySpecies };
}
