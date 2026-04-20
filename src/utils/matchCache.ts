// ─── Match keyframe cache (IndexedDB) ───────────────────────────
// Stores captured keyframes (team preview, match results) with
// detection metadata for later review and analytics. Survives
// browser refresh. Can be exported as JSON for long-term archiving.

const DB_NAME = 'champions-companion';
const DB_VERSION = 1;
const STORE = 'frames';

export type KeyframeType =
  | 'preview'
  | 'result'
  /** Every scan where the HSV result-detector fires, pre-debounce.
   *  These exist to audit false positives — if we never promote one
   *  to `result`, it's an animation/effect that tripped the detector. */
  | 'result-candidate'
  /** Snapshot when the lineup analyzer locks in a new set of species.
   *  Lets the user audit what the matcher actually saw. */
  | 'lineup-lock'
  | 'manual';

export interface CachedFrame {
  /** Unique frame id — `${matchId}-${type}-${timestamp}` */
  id: string;
  /** Match this frame belongs to */
  matchId: string;
  type: KeyframeType;
  timestamp: number;
  /** JPEG data URL (compressed) */
  dataUrl: string;
  /** Detection metadata at time of capture */
  metadata: {
    myTeam?: string[];
    opponentTeam?: string[];
    archetype?: string;
    matchResult?: 'win' | 'loss';
    leftVotes?: Record<string, number>;
    rightVotes?: Record<string, number>;
    ocrText?: string;
    spritesDetected?: number;
    sceneContext?: string;
    /** Raw HSV signal percentages from the result detector (for audits).
     *  Symmetric signal set — both banner sides and both text sides are
     *  always recorded so we can post-hoc reclassify a frame as win or
     *  loss without re-running the detector. `badgeRed` is a legacy
     *  alias for `badgeRedLeft`, kept so older cached entries still
     *  parse against this shape. */
    resultSignals?: {
      badgeRed: number;
      silverRight: number;
      centerDark: number;
      badgeRedLeft?: number;
      badgeRedRight?: number;
      goldLeft?: number;
      silverLeft?: number;
      goldRight?: number;
      decision?: string;
    };
    /** Did this candidate detection survive debounce → `recordMatch`? */
    confirmed?: boolean;
    /** For `lineup-lock`: how many frames the analyzer had seen. */
    framesObserved?: number;
    /** For `lineup-lock`: array of per-slot consensus rows. */
    lineupSlots?: Array<{
      slotIndex: number;
      side: 'left' | 'right';
      species: string | null;
      winnerVotes: number;
      framesObserved: number;
      shareOfFrames: number;
      /** Top single-frame candidates from this scan. */
      topCandidates?: Array<{ species: string; confidence: number }>;
      /** Did this slot clear the UI lock threshold? */
      locked?: boolean;
    }>;
    /** Raw HSV selection-frame detector signals, always attached on
     *  lineup-lock saves so the user can diagnose why nothing locked. */
    selectionFrame?: {
      isTeamSelect: boolean;
      frameConfidence: number;
      opponentCardCount: number;
      playerCardCount: number;
      panelCount: number;
      selectionUiDetected?: boolean;
      selectionUiReason?: string;
      triggerReason?: string;
      hasAnnotation?: boolean;
    };
    /** Raw HSV LOCK-frame detector signals — separate from
     *  `selectionFrame` because the lock screen has its own panel mask
     *  (type-tinted player cards) and own consensus pipeline. */
    lockFrame?: {
      isLockScreen: boolean;
      frameConfidence: number;
      opponentCardCount: number;
      playerCardCount: number;
      panelCount: number;
      framesObserved?: number;
    };
    /** Confident LOCK-screen consensus rows, captured at save time so
     *  the trail UI can render the locked picks alongside the selection
     *  consensus without recomputing. */
    lockConsensus?: Array<{
      slotIndex: number;
      side: 'left' | 'right';
      species: string;
      isShiny: boolean;
      winnerVotes: number;
      framesObserved: number;
    }>;
    /** Cross-reference anomalies: confident lock-screen picks that
     *  don't appear in the selection-screen pool for the same side.
     *  Surfaces detector errors (one of the two pipelines must be
     *  wrong) so the user can review crops manually. */
    lockSelectionMismatches?: Array<{
      side: 'left' | 'right';
      slotIndex: number;
      lockSpecies: string;
      isShiny: boolean;
      selectionPool: string[];
    }>;
    /**
     * Badge-derived player picks: the 2–3 slot indices (0-based,
     * top-to-bottom) whose player cards carried a visible
     * selection-order number badge (1/2/3), paired with the species
     * resolved via the selection consensus for that slot. This is the
     * authoritative "who did the player send into battle" signal —
     * independent of sprite matching — and is present only on lock-
     * screen frames where the selection consensus was already known. */
    playerLockPicks?: Array<{
      slotIndex: number;
      /** Species pulled from the selection consensus for this slot.
       *  Null when the selection consensus didn't have a confident
       *  species for that slot (rare; means we know the player picked
       *  slot N but not which Pokémon was on it). */
      species: string | null;
      /** Shiny-variant flag from the selection consensus for this
       *  slot (voting-share ≥ 0.5 of shiny candidates). False when
       *  species is null or the shiny signal didn't cross the
       *  majority threshold. */
      isShiny: boolean;
    }>;
    /** Badge-vote health snapshot: how many lock frames we observed
     *  in the current match and the per-slot vote counts. Lets the
     *  UI show "3/3 frames saw slot 0" vs "1/3 frames saw slot 4 —
     *  probably noise". Present only when the consensus pathway was
     *  actually used (≥2 frames). */
    playerLockBadgeVotes?: {
      framesObserved: number;
      votesPerSlot: number[];
    };
    /** Warnings surfaced when the badge-derived pick for a player slot
     *  disagrees with the sprite-matched lock consensus for the same
     *  slot. Populated only when BOTH signals are present. Non-empty
     *  array means "something is off — review manually". */
    playerLockBadgeWarnings?: Array<{
      slotIndex: number;
      /** Species the number-badge pipeline trusts (from selection
       *  consensus). Null when the selection consensus didn't lock
       *  that slot yet — still flagged so the user knows the badge
       *  saw a pick we can't yet name. */
      badgeSpecies: string | null;
      /** Species the sprite matcher returned for the same player
       *  slot on this lock frame (low-confidence territory). */
      spriteSpecies: string | null;
      /** Free-form description of the disagreement. */
      reason: string;
    }>;
    /** Whether this snapshot was composited with the debug overlay
     *  canvas (true) or is the raw captured frame only (false). */
    hasAnnotation?: boolean;
    /** Per-slot sprite crop thumbnails — exactly the pixels the matcher
     *  fed into the feature extractor. Lets the user manually verify
     *  alignment of cards / sprite bboxes without trusting the burned-in
     *  overlay. */
    slotCrops?: Array<{
      slotIndex: number;
      side: 'left' | 'right';
      /** Card outer bounds (x, y, w, h in raw-frame coords) */
      card: { x: number; y: number; w: number; h: number };
      /** Sprite inner bbox (x, y, w, h in raw-frame coords) */
      sprite: { x: number; y: number; w: number; h: number };
      /** PNG data URL of the sprite-bbox crop only */
      cropDataUrl: string;
      /** Top match candidates for this slot at capture time */
      topCandidates?: Array<{ species: string; confidence: number; isShiny?: boolean }>;
      /** Locked species (consensus winner) if any */
      lockedSpecies?: string | null;
      /** True when the consensus winner was the shiny colour variant. */
      lockedIsShiny?: boolean;
    }>;
    [k: string]: unknown;
  };
}

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('matchId', 'matchId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDB().then(db => db.transaction(STORE, mode).objectStore(STORE));
}

export async function saveFrame(frame: CachedFrame): Promise<void> {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(frame);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getFrame(id: string): Promise<CachedFrame | null> {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getFramesByMatch(matchId: string): Promise<CachedFrame[]> {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const idx = store.index('matchId');
    const req = idx.getAll(matchId);
    req.onsuccess = () => resolve((req.result ?? []).sort((a, b) => a.timestamp - b.timestamp));
    req.onerror = () => reject(req.error);
  });
}

export async function listAllFrames(): Promise<CachedFrame[]> {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result ?? []).sort((a, b) => b.timestamp - a.timestamp));
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFrame(id: string): Promise<void> {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMatchFrames(matchId: string): Promise<number> {
  const frames = await getFramesByMatch(matchId);
  await Promise.all(frames.map(f => deleteFrame(f.id)));
  return frames.length;
}

export async function clearAllFrames(): Promise<void> {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Evict frames older than given ms. Returns count deleted. */
export async function evictOlderThan(ageMs: number): Promise<number> {
  const cutoff = Date.now() - ageMs;
  const all = await listAllFrames();
  const toDelete = all.filter(f => f.timestamp < cutoff);
  await Promise.all(toDelete.map(f => deleteFrame(f.id)));
  return toDelete.length;
}

/** Rough storage usage estimate (bytes). */
export async function estimateSize(): Promise<{ frames: number; bytes: number }> {
  const all = await listAllFrames();
  let bytes = 0;
  for (const f of all) {
    bytes += f.dataUrl.length * 0.75; // base64 → bytes approx
    bytes += JSON.stringify(f.metadata).length;
  }
  return { frames: all.length, bytes };
}

/** Downscale a canvas to a max dimension for storage efficiency. */
export function compressFrame(canvas: HTMLCanvasElement, maxWidth = 800, quality = 0.6): string {
  if (canvas.width <= maxWidth) return canvas.toDataURL('image/jpeg', quality);
  const scale = maxWidth / canvas.width;
  const small = document.createElement('canvas');
  small.width = maxWidth;
  small.height = Math.round(canvas.height * scale);
  const ctx = small.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  return small.toDataURL('image/jpeg', quality);
}

// ─── Export / Import for long-term archive ─────────────────────

export interface ArchiveBundle {
  version: 1;
  exportedAt: number;
  frames: CachedFrame[];
  history: unknown[]; // match records, injected from caller
}

export async function exportArchive(history: unknown[]): Promise<ArchiveBundle> {
  const frames = await listAllFrames();
  return {
    version: 1,
    exportedAt: Date.now(),
    frames,
    history,
  };
}

export async function importArchive(bundle: ArchiveBundle): Promise<void> {
  if (bundle.version !== 1) throw new Error(`Unsupported archive version: ${bundle.version}`);
  for (const frame of bundle.frames) {
    await saveFrame(frame);
  }
}

/** Trigger a browser download of the archive JSON. */
export function downloadArchive(bundle: ArchiveBundle, filename = 'champions-archive.json') {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
