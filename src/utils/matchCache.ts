// ─── Match keyframe cache (IndexedDB) ───────────────────────────
// Stores captured keyframes (team preview, match results) with
// detection metadata for later review and analytics. Survives
// browser refresh. Can be exported as JSON for long-term archiving.

const DB_NAME = 'champions-companion';
const DB_VERSION = 1;
const STORE = 'frames';

export type KeyframeType = 'preview' | 'result' | 'manual';

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
