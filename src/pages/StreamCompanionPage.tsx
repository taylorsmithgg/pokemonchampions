import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Sprite } from '../components/Sprite';
import { QuickTeamInput } from '../components/QuickTeamInput';
import { getPokemonData, getTypeEffectiveness } from '../data/champions';
import { getTierForPokemon, TIER_DEFINITIONS } from '../data/tierlist';
import { useTeam } from '../contexts/TeamContext';
import { inferOpenerStrategy, orderBringList } from '../calc/openerStrategy';
import { resolveBuildWithSource } from '../calc/buildResolver';
import {
  initOcrWorker,
  terminateOcrWorker,
  isOcrReady,
  startCapture,
  stopCapture,
  isCaptureActive,
  grabFrame,
  getCaptureStream,
  detectPokemonFromFrame,
  autoDetectGameWindow,
  type OcrDetectionResult,
} from '../utils/ocrDetection';
import {
  saveFrame,
  compressFrame,
  listAllFrames,
  getFrame,
  clearAllFrames,
  downloadArchive,
  exportArchive,
  type CachedFrame,
} from '../utils/matchCache';
import type { PokemonState } from '../types';
import { createDefaultPokemonState } from '../types';


// ─── Types ────────────────────────────────────────────────────────

interface MatchRecord {
  id: string;
  timestamp: number;
  opponentTeam: string[];
  result: 'win' | 'loss';
  // Extended analytics fields — optional for backwards compat
  myTeam?: string[];
  archetype?: string;
  durationMs?: number;
  previewFrameId?: string;
  resultFrameId?: string;
  bringOrder?: string[];
}

type GamePhase = 'idle' | 'preview' | 'battle';

// ─── LocalStorage helpers ─────────────────────────────────────────

const HISTORY_KEY = 'stream-companion-history';
const CHANNEL_KEY = 'stream-companion-channel';
const MY_TEAM_KEY = 'stream-companion-my-team';

function loadHistory(): MatchRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: MatchRecord[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function loadChannel(): string {
  return localStorage.getItem(CHANNEL_KEY) || '';
}

function saveChannel(channel: string) {
  localStorage.setItem(CHANNEL_KEY, channel);
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ─── Archetype detection ─────────────────────────────────────────

function detectOpponentArchetype(opponents: string[]): { name: string; confidence: number; counterTips: string[] }[] {
  const archetypes: { name: string; confidence: number; counterTips: string[] }[] = [];
  const speciesSet = new Set(opponents);

  for (const species of opponents) {
    const data = getPokemonData(species);
    if (!data?.abilities) continue;
    const ability = (data.abilities[0] || '').toLowerCase();
    if (['drought'].includes(ability) || species === 'Charizard' || species === 'Meganium') {
      archetypes.push({
        name: 'Sun',
        confidence: 0.8,
        counterTips: ['Bring a weather override (Rain setter)', 'Rock-types resist Sun-boosted Fire', 'Flash Fire absorbs boosted Fire moves'],
      });
    }
    if (['drizzle'].includes(ability) || species === 'Pelipper') {
      archetypes.push({
        name: 'Rain',
        confidence: 0.8,
        counterTips: ['Bring a weather override (Sun or Sand)', 'Grass-types resist boosted Water', 'Water Absorb / Storm Drain absorbs their Water moves'],
      });
    }
    if (['sand stream'].includes(ability)) {
      archetypes.push({
        name: 'Sand',
        confidence: 0.8,
        counterTips: ['Steel/Rock/Ground types ignore Sand chip', 'Override weather to stop SpD boost on Rock-types', 'Wide Guard blocks Rock Slide spam'],
      });
    }
    if (['snow warning'].includes(ability) || species === 'Froslass' || species === 'Abomasnow') {
      archetypes.push({
        name: 'Snow',
        confidence: 0.7,
        counterTips: ['Fire-types threaten Ice cores and clear Snow', 'Fighting coverage hits Ice/Steel cores', 'Override weather to remove Aurora Veil setup'],
      });
    }
  }

  const trSetters = ['Hatterene', 'Mimikyu', 'Reuniclus', 'Slowking', 'Slowbro', 'Dusclops'];
  const slowMons = opponents.filter(s => {
    const d = getPokemonData(s);
    return d && d.baseStats.spe <= 50;
  });
  if (opponents.some(s => trSetters.includes(s)) && slowMons.length >= 2) {
    archetypes.push({
      name: 'Trick Room',
      confidence: 0.9,
      counterTips: ['Taunt the setter before TR goes up', 'Imprison blocks Trick Room entirely', 'Fake Out + KO the setter turn 1', 'Bring your own slow mon to function under TR'],
    });
  }

  const twSetters = ['Whimsicott', 'Talonflame', 'Pelipper', 'Aerodactyl'];
  if (opponents.some(s => twSetters.includes(s))) {
    archetypes.push({
      name: 'Tailwind',
      confidence: 0.6,
      counterTips: ['Set your own speed control (TR or TW)', 'Fake Out the Tailwind setter', 'Taunt prevents setup', 'Priority moves bypass speed'],
    });
  }

  const fastOffense = opponents.filter(s => {
    const d = getPokemonData(s);
    return d && d.baseStats.spe >= 100 && Math.max(d.baseStats.atk, d.baseStats.spa) >= 100;
  });
  if (fastOffense.length >= 3) {
    archetypes.push({
      name: 'Hyper Offense',
      confidence: 0.7,
      counterTips: ['Intimidate weakens their physical side', 'Focus Sash guarantees you survive a hit', 'Priority moves like Fake Out disrupt their tempo', 'Screens (Reflect/Light Screen) cut damage significantly'],
    });
  }

  if (speciesSet.has('Gengar')) {
    archetypes.push({
      name: 'Perish Trap',
      confidence: 0.5,
      counterTips: ['Ghost-types are immune to Shadow Tag', 'Switching is key — count Perish turns carefully', 'KO Gengar before Perish Song activates'],
    });
  }

  archetypes.sort((a, b) => b.confidence - a.confidence);
  return archetypes.slice(0, 3);
}

// ─── Matchup scoring ─────────────────────────────────────────────

function scoreMatchup(mySpecies: string, theirSpecies: string): number {
  const myData = getPokemonData(mySpecies);
  const theirData = getPokemonData(theirSpecies);
  if (!myData || !theirData) return 0;

  let score = 0;
  for (const myType of myData.types) {
    for (const theirType of theirData.types) {
      const eff = getTypeEffectiveness(myType as string, theirType as string);
      if (eff > 1) score += 2;
      if (eff < 1) score -= 1;
    }
  }
  for (const theirType of theirData.types) {
    for (const myType of myData.types) {
      const eff = getTypeEffectiveness(theirType as string, myType as string);
      if (eff > 1) score -= 2;
      if (eff < 1) score += 1;
    }
  }
  if (myData.baseStats.spe > theirData.baseStats.spe + 10) score += 1;
  if (myData.baseStats.spe < theirData.baseStats.spe - 10) score -= 1;

  return score;
}

// ─── Bring-list recommendation ───────────────────────────────────

interface BringRecommendation {
  species: string;
  score: number;
  reasons: string[];
}

function recommendBringList(myTeam: string[], opponents: string[]): BringRecommendation[] {
  const recs: BringRecommendation[] = [];

  for (const species of myTeam) {
    if (!species) continue;
    let score = 0;
    const reasons: string[] = [];
    const data = getPokemonData(species);

    let seCount = 0;
    let weakCount = 0;
    for (const opp of opponents) {
      const ms = scoreMatchup(species, opp);
      score += ms;
      if (ms >= 2) seCount++;
      if (ms <= -2) weakCount++;
    }
    if (seCount >= 2) reasons.push(`Hits ${seCount} opponents super-effectively`);
    if (weakCount >= 2) reasons.push(`Weak to ${weakCount} opponents`);

    if (data) {
      const ability = (data.abilities?.[0] || '') as string;
      if (ability === 'Intimidate') { score += 3; reasons.push('Intimidate pressure'); }
    }

    recs.push({ species, score, reasons });
  }

  recs.sort((a, b) => b.score - a.score);
  return recs;
}

// ─── Threat analysis ─────────────────────────────────────────────

function identifyKeyThreats(myTeam: string[], opponents: string[]): { species: string; danger: number; reason: string }[] {
  const threats: { species: string; danger: number; reason: string }[] = [];

  for (const opp of opponents) {
    const oppData = getPokemonData(opp);
    if (!oppData) continue;

    let totalDanger = 0;
    let weakToCount = 0;

    for (const mine of myTeam) {
      if (!mine) continue;
      const ms = scoreMatchup(mine, opp);
      if (ms <= -2) {
        weakToCount++;
        totalDanger += Math.abs(ms);
      }
    }

    const tier = getTierForPokemon(opp);
    const tierBonus = tier?.tier === 'S' ? 3 : tier?.tier === 'A' ? 2 : tier?.tier === 'B' ? 1 : 0;
    totalDanger += tierBonus;

    let reason = '';
    if (weakToCount >= 3) reason = `Threatens ${weakToCount} of your team`;
    else if (tierBonus >= 2) reason = `${tier!.tier}-tier meta threat`;
    else reason = 'Solid coverage threat';

    threats.push({ species: opp, danger: totalDanger, reason });
  }

  threats.sort((a, b) => b.danger - a.danger);
  return threats;
}

// ─── Lead suggestion ─────────────────────────────────────────────

function suggestLead(bringList: BringRecommendation[], opponents: string[]): { lead1: string; lead2: string; reasoning: string } | null {
  if (bringList.length < 2) return null;

  const top = bringList.slice(0, Math.min(4, bringList.length));
  let bestPair: [string, string] = [top[0].species, top[1].species];
  let bestScore = -Infinity;
  let bestReason = '';

  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const a = top[i].species;
      const b = top[j].species;
      let pairScore = 0;
      let coverCount = 0;

      for (const opp of opponents) {
        const sa = scoreMatchup(a, opp);
        const sb = scoreMatchup(b, opp);
        const best = Math.max(sa, sb);
        pairScore += best;
        if (best >= 2) coverCount++;
      }

      const aData = getPokemonData(a);
      const bData = getPokemonData(b);
      if (aData?.abilities?.[0] === 'Intimidate' || bData?.abilities?.[0] === 'Intimidate') pairScore += 2;

      if (pairScore > bestScore) {
        bestScore = pairScore;
        bestPair = [a, b];
        bestReason = coverCount >= 3
          ? `Covers ${coverCount}/${opponents.length} opponents with favorable matchups`
          : `Best combined type coverage against their team`;
      }
    }
  }

  return { lead1: bestPair[0], lead2: bestPair[1], reasoning: bestReason };
}


// ─── Video Embed (Twitch / YouTube) ──────────────────────────────

type VideoSource = { type: 'twitch'; channel: string } | { type: 'youtube'; videoId: string } | null;

function parseVideoUrl(input: string): VideoSource {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Twitch: twitch.tv/channel or just "channel"
  const twitchMatch = trimmed.match(/(?:twitch\.tv\/)(\w+)/i);
  if (twitchMatch) return { type: 'twitch', channel: twitchMatch[1] };

  // YouTube: various URL formats
  const ytMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', videoId: ytMatch[1] };

  // YouTube embed
  const ytEmbed = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (ytEmbed) return { type: 'youtube', videoId: ytEmbed[1] };

  // Bare Twitch channel name (no URL, no dots, no slashes)
  if (/^[a-zA-Z0-9_]{3,25}$/.test(trimmed)) return { type: 'twitch', channel: trimmed.toLowerCase() };

  return null;
}

function VideoEmbed({ source }: { source: VideoSource }) {
  if (!source) return null;

  if (source.type === 'twitch') {
    const embedUrl = `https://player.twitch.tv/?channel=${encodeURIComponent(source.channel)}&parent=${window.location.hostname}&muted=true`;
    return (
      <div className="w-full aspect-video rounded-lg overflow-hidden border border-poke-border bg-black">
        <iframe src={embedUrl} className="w-full h-full" allowFullScreen allow="autoplay; encrypted-media" />
      </div>
    );
  }

  if (source.type === 'youtube') {
    const embedUrl = `https://www.youtube.com/embed/${source.videoId}?autoplay=1&mute=1`;
    return (
      <div className="w-full aspect-video rounded-lg overflow-hidden border border-poke-border bg-black">
        <iframe src={embedUrl} className="w-full h-full" allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" />
      </div>
    );
  }

  return null;
}

// ─── Match History Row with expandable thumbnails ───────────────

function MatchHistoryRow({ match, onDelete, onFlip }: { match: MatchRecord; onDelete: (id: string) => void; onFlip: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [frames, setFrames] = useState<CachedFrame[] | null>(null);

  const loadFrames = useCallback(async () => {
    if (frames) return;
    const loaded: CachedFrame[] = [];
    if (match.previewFrameId) {
      const f = await getFrame(match.previewFrameId);
      if (f) loaded.push(f);
    }
    if (match.resultFrameId) {
      const f = await getFrame(match.resultFrameId);
      if (f) loaded.push(f);
    }
    setFrames(loaded);
  }, [match.previewFrameId, match.resultFrameId, frames]);

  const toggle = () => {
    if (!expanded) loadFrames();
    setExpanded(!expanded);
  };

  const duration = match.durationMs ? `${Math.floor(match.durationMs / 60000)}:${String(Math.floor((match.durationMs % 60000) / 1000)).padStart(2, '0')}` : null;

  return (
    <div className="rounded-lg border border-poke-border bg-poke-surface/30 overflow-hidden">
      <div className="flex items-center gap-3 p-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0 ${
          match.result === 'win' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {match.result === 'win' ? 'W' : 'L'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-slate-500">vs</span>
            {match.opponentTeam.map(opp => <Sprite key={opp} species={opp} size="sm" />)}
            {match.archetype && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-poke-gold/10 text-poke-gold/70 border border-poke-gold/20 font-bold ml-1">
                {match.archetype}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-600">
              {new Date(match.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
            {duration && <span className="text-[10px] text-slate-600 font-mono">· {duration}</span>}
          </div>
        </div>
        {(match.previewFrameId || match.resultFrameId) && (
          <button onClick={toggle} className="text-[9px] px-2 py-0.5 rounded border border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors shrink-0">
            {expanded ? 'Hide' : 'Replay'}
          </button>
        )}
        <button
          onClick={() => onFlip(match.id)}
          className="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors shrink-0"
          title={`Flip result (currently ${match.result})`}
        >
          Flip→{match.result === 'win' ? 'L' : 'W'}
        </button>
        <button onClick={() => onDelete(match.id)} className="text-slate-700 hover:text-red-400 transition-colors p-1 shrink-0" title="Delete match">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {expanded && (
        <div className="border-t border-poke-border/50 p-2 space-y-2">
          {match.myTeam && match.myTeam.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold w-12">Team</span>
              <div className="flex gap-1">
                {match.myTeam.map(s => <Sprite key={s} species={s} size="sm" />)}
              </div>
            </div>
          )}
          {match.bringOrder && match.bringOrder.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold w-12">Brought</span>
              <div className="flex gap-1">
                {match.bringOrder.map(s => <Sprite key={s} species={s} size="sm" />)}
              </div>
            </div>
          )}
          {frames && frames.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {frames.map(f => (
                <div key={f.id} className="rounded border border-poke-border/30 overflow-hidden">
                  <div className="text-[9px] text-slate-500 px-1.5 py-0.5 bg-poke-surface/50 uppercase tracking-wider font-bold">
                    {f.type}
                  </div>
                  <img src={f.dataUrl} alt={f.type} className="w-full h-auto" />
                </div>
              ))}
            </div>
          )}
          {frames && frames.length === 0 && (
            <div className="text-[10px] text-slate-600 italic">No frames cached for this match.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Debug Section (toggleable) ──────────────────────────────────

function DebugSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded border border-poke-border/30 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 bg-poke-surface/20 hover:bg-poke-surface/40 transition-colors"
      >
        <span>{title}</span>
        <svg className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-2 py-1.5">{children}</div>}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export function StreamCompanionPage() {
  const { team: contextTeam, setTeam: setContextTeam } = useTeam();

  // ─── Core state ────────────────────────────────────────────────
  const [isOverlay, setIsOverlay] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('overlay')
      || window.location.hash.includes('?overlay=1')
      || window.location.hash.includes('&overlay=1');
  });
  // Embedded preview of the overlay inside companion view — keeps detection running
  const [showOverlayPreview, setShowOverlayPreview] = useState(false);
  // Pop-out overlay window mode — set via ?overlay=1 query
  const isOverlayWindow = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('overlay')
      || window.location.hash.includes('?overlay=1')
      || window.location.hash.includes('&overlay=1');
  }, []);
  // BroadcastChannel for cross-window state sync (host ↔ pop-out overlay)
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const [history, setHistory] = useState<MatchRecord[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [opponentTeam, setOpponentTeam] = useState<string[]>([]);
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [sessionStart] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [lastResult, setLastResult] = useState<'win' | 'loss' | null>(null);

  // Per-match timer
  const [matchStartTime, setMatchStartTime] = useState<number | null>(null);
  const [matchElapsed, setMatchElapsed] = useState(0);

  // Collapsible team
  const [teamExpanded, setTeamExpanded] = useState(false);

  // Session stats expanded
  const [showSessionStats, setShowSessionStats] = useState(false);

  // Video source
  const [videoUrl, setVideoUrl] = useState(() => loadChannel());
  const [videoUrlInput, setVideoUrlInput] = useState(() => loadChannel());
  const videoSource = useMemo(() => parseVideoUrl(videoUrl), [videoUrl]);

  // Auto-detection (OCR)
  const [detecting, setDetecting] = useState(false);
  const [, setOcrReady] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [lastOcrResult, setLastOcrResult] = useState<OcrDetectionResult | null>(null);
  const [lastFrameUrl, setLastFrameUrl] = useState<string | null>(null);
  // Raw (uncropped) frame — used for region selection so user can pick from full screen
  const [lastRawFrameUrl, setLastRawFrameUrl] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [showDebug, setShowDebug] = useState(true);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Cooldown after W/L to avoid re-detecting stale screen data
  const cooldownUntilRef = useRef<number>(0);
  // Species dismissed by the user — won't be re-added by auto-detect this game
  const [dismissedSpecies, setDismissedSpecies] = useState<Set<string>>(new Set());
  // User-defined capture region (percentages 0-1). Null = full frame.
  const [captureRegion, setCaptureRegion] = useState<{ x: number; y: number; w: number; h: number } | null>(() => {
    try {
      const saved = localStorage.getItem('stream-companion-region');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [regionSelecting, setRegionSelecting] = useState(false);
  const [regionDragStart, setRegionDragStart] = useState<{ x: number; y: number } | null>(null);
  const [regionDragEnd, setRegionDragEnd] = useState<{ x: number; y: number } | null>(null);

  // Persist region
  useEffect(() => {
    if (captureRegion) localStorage.setItem('stream-companion-region', JSON.stringify(captureRegion));
    else localStorage.removeItem('stream-companion-region');
  }, [captureRegion]);
  // Live video element ref for smooth game window rendering
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  // Active battlers (during battle)
  const [activeYour, setActiveYour] = useState<string | null>(null);
  const [activeOpp, setActiveOpp] = useState<string | null>(null);
  // Match ID for keyframe tagging
  const currentMatchIdRef = useRef<string>('');
  const previewFrameIdRef = useRef<string>('');
  // Cache stats
  const [cacheStats, setCacheStats] = useState<{ frames: number; bytes: number }>({ frames: 0, bytes: 0 });

  // Set up cross-window BroadcastChannel
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('champions-companion-state');
    broadcastRef.current = channel;
    if (isOverlayWindow) {
      // Pop-out window: receive state updates from host
      channel.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'state') {
          if (payload.opponentTeam) setOpponentTeam(payload.opponentTeam);
          if (payload.history) setHistory(payload.history);
          if (payload.lastResult !== undefined) setLastResult(payload.lastResult);
          if (payload.matchStartTime !== undefined) setMatchStartTime(payload.matchStartTime);
          if (payload.activeYour !== undefined) setActiveYour(payload.activeYour);
          if (payload.activeOpp !== undefined) setActiveOpp(payload.activeOpp);
        }
      };
      // Request initial state
      channel.postMessage({ type: 'request-state' });
    } else {
      // Host: respond to state requests
      channel.onmessage = (e) => {
        if (e.data?.type === 'request-state') {
          channel.postMessage({
            type: 'state',
            payload: {
              opponentTeam,
              history,
              lastResult,
              matchStartTime,
              activeYour,
              activeOpp,
            },
          });
        }
      };
    }
    return () => channel.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOverlayWindow]);

  // Host: broadcast state changes to pop-out windows
  useEffect(() => {
    if (isOverlayWindow || !broadcastRef.current) return;
    broadcastRef.current.postMessage({
      type: 'state',
      payload: {
        opponentTeam,
        history,
        lastResult,
        matchStartTime,
        activeYour,
        activeOpp,
      },
    });
  }, [opponentTeam, history, lastResult, matchStartTime, activeYour, activeOpp, isOverlayWindow]);

  // Persist history
  useEffect(() => { saveHistory(history); }, [history]);

  // Refresh cache stats when history or detection changes
  useEffect(() => {
    listAllFrames().then(frames => {
      let bytes = 0;
      for (const f of frames) bytes += f.dataUrl.length * 0.75;
      setCacheStats({ frames: frames.length, bytes: Math.round(bytes) });
    }).catch(() => {});
  }, [history, scanCount]);

  // Track whether we've restored from localStorage to avoid the persist
  // effect from overwriting saved data on initial mount.
  const restoredRef = useRef(false);

  // Restore user's team from localStorage on mount
  useEffect(() => {
    const filled = contextTeam.filter(t => t.species);
    if (filled.length > 0) { restoredRef.current = true; return; }
    try {
      const saved = localStorage.getItem(MY_TEAM_KEY);
      if (!saved) { restoredRef.current = true; return; }
      const species: string[] = JSON.parse(saved);
      const validSpecies = species.filter(Boolean);
      if (validSpecies.length === 0) { restoredRef.current = true; return; }
      const newTeam: PokemonState[] = Array.from({ length: 6 }, (_, i) => {
        const s = validSpecies[i];
        if (!s) return createDefaultPokemonState();
        const { build } = resolveBuildWithSource(s);
        return build;
      });
      setContextTeam(newTeam);
      restoredRef.current = true;
    } catch { restoredRef.current = true; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist user's team to localStorage — but only after initial restore
  useEffect(() => {
    if (!restoredRef.current) return;
    const filled = contextTeam.filter(t => t.species).map(t => t.species);
    localStorage.setItem(MY_TEAM_KEY, JSON.stringify(filled));
  }, [contextTeam]);

  // Session timer + match timer
  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Date.now() - sessionStart);
      if (matchStartTime) {
        setMatchElapsed(Date.now() - matchStartTime);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [sessionStart, matchStartTime]);

  // ─── Derived data ──────────────────────────────────────────────
  const filledMyTeam = useMemo(
    () => contextTeam.filter(t => t.species).map(t => t.species),
    [contextTeam],
  );
  const filledOpponents = useMemo(() => opponentTeam.filter(Boolean), [opponentTeam]);

  // Dedup: same species can't be on both teams. Your team wins.
  useEffect(() => {
    const myTeamSet = new Set(filledMyTeam);
    const dupes = filledOpponents.filter(s => myTeamSet.has(s));
    if (dupes.length > 0) {
      setOpponentTeam(prev => prev.filter(s => !myTeamSet.has(s)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filledMyTeam, filledOpponents]);

  const archetypes = useMemo(
    () => filledOpponents.length >= 1 ? detectOpponentArchetype(filledOpponents) : [],
    [filledOpponents],
  );
  const bringList = useMemo(
    () => filledOpponents.length >= 1 && filledMyTeam.length >= 2 ? recommendBringList(filledMyTeam, filledOpponents) : [],
    [filledMyTeam, filledOpponents],
  );
  const threats = useMemo(
    () => filledOpponents.length >= 1 && filledMyTeam.length >= 1 ? identifyKeyThreats(filledMyTeam, filledOpponents) : [],
    [filledMyTeam, filledOpponents],
  );
  const leadSuggestion = useMemo(
    () => bringList.length >= 2 ? suggestLead(bringList, filledOpponents) : null,
    [bringList, filledOpponents],
  );
  const openerStrategy = useMemo(
    () => filledMyTeam.length >= 2 && filledOpponents.length >= 1
      ? inferOpenerStrategy(contextTeam.filter(t => t.species), filledOpponents)
      : null,
    [contextTeam, filledMyTeam.length, filledOpponents],
  );
  const orderedBringList = useMemo(
    () => bringList.length >= 2
      ? orderBringList(bringList, contextTeam.filter(t => t.species), filledOpponents)
      : bringList.map(b => ({ ...b, role: 'Lead' })),
    [bringList, contextTeam, filledOpponents],
  );

  // Scoreboard
  const wins = useMemo(() => history.filter(h => h.result === 'win').length, [history]);
  const losses = useMemo(() => history.filter(h => h.result === 'loss').length, [history]);
  const totalGames = wins + losses;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  // Current streak
  const streak = useMemo(() => {
    if (history.length === 0) return { count: 0, type: null as string | null };
    const first = history[0]?.result;
    if (!first) return { count: 0, type: null };
    let count = 0;
    for (const h of history) {
      if (h.result === first) count++;
      else break;
    }
    return { count, type: first };
  }, [history]);

  // ─── Handlers ──────────────────────────────────────────────────

  const recordMatch = useCallback((result: 'win' | 'loss', resultFrameId?: string) => {
    const matchId = currentMatchIdRef.current || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const record: MatchRecord = {
      id: matchId,
      timestamp: Date.now(),
      opponentTeam: filledOpponents,
      result,
      myTeam: [...filledMyTeam],
      archetype: archetypes[0]?.name,
      durationMs: matchStartTime ? Date.now() - matchStartTime : undefined,
      previewFrameId: previewFrameIdRef.current || undefined,
      resultFrameId,
      bringOrder: orderedBringList.slice(0, 4).map(b => b.species),
    };
    setHistory(prev => [record, ...prev]);
    setLastResult(result);
    setOpponentTeam([]);
    setGamePhase('idle');
    setMatchStartTime(null);
    setMatchElapsed(0);

    // Cooldown: ignore detections for 12 seconds after recording.
    // Results screens linger and would otherwise leak sprites/votes
    // into the next match's preview accumulation.
    cooldownUntilRef.current = Date.now() + 12000;
    // Clear dismissed list for fresh game
    setDismissedSpecies(new Set());
    // Reset phase machine — ready for next match's team preview
    
    
    
    
    currentMatchIdRef.current = '';
    previewFrameIdRef.current = '';
    setActiveYour(null);
    setActiveOpp(null);

    setTimeout(() => setLastResult(null), 3000);
  }, [filledOpponents, filledMyTeam, archetypes, matchStartTime, orderedBringList]);

  const deleteMatch = useCallback((id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
  }, []);

  // Replay/rollback — flip a recorded result (W↔L) for correction
  const flipMatchResult = useCallback((id: string) => {
    setHistory(prev => prev.map(m => m.id === id ? { ...m, result: m.result === 'win' ? 'loss' : 'win' } : m));
  }, []);

  // Undo most recent match record entirely
  const undoLastMatch = useCallback(() => {
    setHistory(prev => prev.slice(1));
  }, []);

  // Full session reset — clears EVERYTHING for starting fresh
  const resetSession = useCallback(() => {
    setOpponentTeam([]);
    handleSetMyTeam([]);
    setHistory([]);
    setGamePhase('idle');
    setMatchStartTime(null);
    setMatchElapsed(0);
    setLastResult(null);
    setLastOcrResult(null);
    setLastFrameUrl(null);
    setScanCount(0);
    setDismissedSpecies(new Set());
    cooldownUntilRef.current = 0;
    
    
    
    
    setCaptureRegion(null);
    saveHistory([]);
  }, []);

  const handleExportArchive = useCallback(async () => {
    const bundle = await exportArchive(history);
    downloadArchive(bundle, `champions-archive-${new Date().toISOString().slice(0, 10)}.json`);
  }, [history]);

  const handleClearCache = useCallback(async () => {
    if (!confirm(`Clear ${cacheStats.frames} cached frames (${Math.round(cacheStats.bytes / 1024)} KB)? History is preserved.`)) return;
    await clearAllFrames();
    setCacheStats({ frames: 0, bytes: 0 });
  }, [cacheStats]);

  const clearHistory = useCallback(() => {
    if (confirm('Clear all match history? This cannot be undone.')) {
      setHistory([]);
    }
  }, []);

  const handleConnectVideo = useCallback(() => {
    const trimmed = videoUrlInput.trim();
    setVideoUrl(trimmed);
    saveChannel(trimmed);
  }, [videoUrlInput]);

  const handleDisconnectVideo = useCallback(() => {
    setVideoUrl('');
    setVideoUrlInput('');
    saveChannel('');
  }, []);

  // Set your team from species names — each gets a full resolved build
  const handleSetMyTeam = useCallback((speciesList: string[]) => {
    const newTeam: PokemonState[] = Array.from({ length: 6 }, (_, i) => {
      const species = speciesList[i];
      if (!species) return createDefaultPokemonState();
      const { build } = resolveBuildWithSource(species);
      return build;
    });
    setContextTeam(newTeam);
  }, [setContextTeam]);

  // ─── Auto-detection (OCR) handlers ─────────────────────────────

  const handleStartDetection = useCallback(async () => {
    // Step 1: Init OCR if needed
    if (!isOcrReady()) {
      setOcrLoading(true);
      await initOcrWorker();
      setOcrReady(true);
      setOcrLoading(false);
    }

    // Step 2: Start screen capture (skip if already active)
    try {
      if (!isCaptureActive()) await startCapture();
      setDetecting(true);
      setScanCount(0);
      setLastOcrResult(null);
      setLastFrameUrl(null);
    } catch {
      // User cancelled screen share dialog
    }
  }, []);

  const handleStopDetection = useCallback(() => {
    stopCapture();
    setDetecting(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }, []);

  // Single scan pass — filters out your team, respects cooldown
  const runScan = useCallback(async () => {
    if (!isCaptureActive() || !isOcrReady()) {
      if (!isCaptureActive()) setDetecting(false);
      return;
    }

    // Skip scans during post-game cooldown — opponent sprites from
    // results screen would otherwise get re-detected for the next match.
    if (Date.now() < cooldownUntilRef.current) return;

    // Quick pre-OCR check: if cooldown JUST ended, do a cheap scan first
    // to detect if results screen is STILL on. We check raw text below.

    const rawFrame = grabFrame();
    if (!rawFrame) return;

    // Save raw frame URL once a scan so region selector has full view
    if (regionSelecting || !lastRawFrameUrl) {
      setLastRawFrameUrl(rawFrame.toDataURL('image/jpeg', 0.55));
    }

    // Crop to game window BEFORE analysis.
    // Priority: 1) user-drawn ROI, 2) auto-detected game window, 3) full frame
    let frame = rawFrame;
    const region = captureRegion ?? autoDetectGameWindow(rawFrame);
    if (region) {
      const { x, y, w, h } = region;
      const sx = Math.round(rawFrame.width * x);
      const sy = Math.round(rawFrame.height * y);
      const sw = Math.round(rawFrame.width * w);
      const sh = Math.round(rawFrame.height * h);
      if (sw > 100 && sh > 100) {
        const cropped = document.createElement('canvas');
        cropped.width = sw; cropped.height = sh;
        cropped.getContext('2d')!.drawImage(rawFrame, sx, sy, sw, sh, 0, 0, sw, sh);
        frame = cropped;
      }
    }

    const result = await detectPokemonFromFrame(frame);
    setLastOcrResult(result);
    setScanCount(prev => prev + 1);

    // Annotated preview
    const annotated = document.createElement('canvas');
    annotated.width = frame.width;
    annotated.height = frame.height;
    const actx = annotated.getContext('2d')!;
    actx.drawImage(frame, 0, 0);

    const myTeamViz = new Set(filledMyTeam);
    for (const species of filledMyTeam) myTeamViz.add(species.split('-')[0]);

    // X-axis split: left = yours, right = opponent
    const midX = frame.width / 2;

    // Vertical midline guide (X-axis split for team assignment)
    actx.strokeStyle = 'rgba(255,255,255,0.2)';
    actx.lineWidth = 2;
    actx.beginPath();
    actx.moveTo(midX, 0); actx.lineTo(midX, frame.height);
    actx.stroke();
    // Labels
    actx.fillStyle = 'rgba(0,0,0,0.6)';
    actx.fillRect(midX - 85, 4, 80, 16);
    actx.fillRect(midX + 5, 4, 80, 16);
    actx.font = 'bold 11px system-ui';
    actx.fillStyle = '#38bdf8'; actx.fillText('◄ YOURS', midX - 82, 16);
    actx.fillStyle = '#f97316'; actx.fillText('OPPONENT ►', midX + 8, 16);

    // Sprite detection boxes — side from scan region
    for (const s of (result.spriteMatched ?? [])) {
      const isYours = myTeamViz.has(s.species);
      const color = isYours ? '#38bdf8' : s.side === 'right' ? '#f97316' : '#eab308';
      const tag = isYours ? 'YOURS' : s.side === 'right' ? 'OPP' : 'YOURS?';
      // Glow fill
      actx.fillStyle = color + '20';
      actx.fillRect(s.x, s.y, 80, 80);
      // Thick border
      actx.strokeStyle = color; actx.lineWidth = 4;
      actx.strokeRect(s.x, s.y, 80, 80);
      // Label with background
      const label = `${s.species} ${Math.round(s.confidence * 100)}% [${tag}]`;
      actx.font = 'bold 13px system-ui';
      const lw = actx.measureText(label).width + 10;
      actx.fillStyle = 'rgba(0,0,0,0.85)';
      actx.fillRect(s.x, s.y - 22, lw, 22);
      actx.fillStyle = color;
      actx.fillText(label, s.x + 5, s.y - 5);
    }

    // OCR text listing
    for (const m of result.matched) {
      const isYours = myTeamViz.has(m.species);
      const color = isYours ? '#38bdf8' : '#22c55e';
      actx.fillStyle = 'rgba(0,0,0,0.7)';
      const y = 20 + result.matched.indexOf(m) * 16;
      actx.fillRect(8, y - 12, 280, 14);
      actx.fillStyle = color;
      actx.font = 'bold 11px system-ui';
      actx.fillText(`OCR ${m.species} ${Math.round(m.confidence * 100)}% [${m.side}]`, 10, y);
    }

    // Battle log
    for (const blm of (result.battleLogMatches ?? [])) {
      const color = blm.isOpponent ? '#ef4444' : '#38bdf8';
      const idx = (result.battleLogMatches ?? []).indexOf(blm);
      const y = frame.height - 20 - idx * 16;
      actx.fillStyle = 'rgba(0,0,0,0.7)';
      actx.fillRect(8, y - 12, 300, 14);
      actx.fillStyle = color;
      actx.font = 'bold 11px system-ui';
      actx.fillText(`LOG ${blm.pattern}`, 10, y);
    }

    // ── Draw all scan region boundaries — thick, bright, labeled ──
    const fw = frame.width, fh = frame.height;

    const drawRegion = (x: number, y: number, w: number, h: number, color: string, label: string, fill = true) => {
      if (fill) { actx.fillStyle = color + '15'; actx.fillRect(x, y, w, h); }
      actx.strokeStyle = color; actx.lineWidth = 3; actx.setLineDash([6, 3]);
      actx.strokeRect(x, y, w, h);
      actx.setLineDash([]);
      if (label) {
        actx.fillStyle = 'rgba(0,0,0,0.8)';
        actx.font = 'bold 11px system-ui';
        const tw = actx.measureText(label).width + 8;
        actx.fillRect(x, y, tw, 16);
        actx.fillStyle = color;
        actx.fillText(label, x + 4, y + 12);
      }
    };

    // Battle HP panels
    drawRegion(fw * 0.00, fh * 0.82, fw * 0.25, fh * 0.18, '#a855f7', 'YOUR HP');
    drawRegion(fw * 0.55, fh * 0.00, fw * 0.45, fh * 0.18, '#f97316', 'OPP HP');

    // Battle icon sprites
    drawRegion(0, fh * 0.85, fw * 0.08, fh * 0.10, '#a855f7', 'Icon', false);
    drawRegion(fw * 0.88, 0, fw * 0.10, fh * 0.10, '#f97316', 'Icon', false);

    // Selection YOUR column
    drawRegion(fw * 0.00, fh * 0.07, fw * 0.23, fh * 0.88, '#06b6d4', 'YOUR TEXT');

    // Selection OPP sprites (wider scan)
    for (let i = 0; i < 6; i++) {
      drawRegion(fw * 0.58, fh * (0.05 + i * 0.14), fw * 0.40, fh * 0.13, '#f43f5e', i === 0 ? 'OPP SPRITES' : '', false);
    }

    // YOUR icon sprites
    for (let i = 0; i < 6; i++) {
      drawRegion(fw * 0.01, fh * (0.08 + i * 0.145), fw * 0.07, fh * 0.11, '#06b6d4', '', false);
    }

    // Auto-detected game window (if applicable)
    if (!captureRegion) {
      const autoWin = autoDetectGameWindow(rawFrame);
      if (autoWin) {
        // Draw on raw frame coordinates scaled to cropped frame
        actx.strokeStyle = '#fbbf24';
        actx.lineWidth = 2;
        actx.setLineDash([8, 4]);
        // autoWin is pct of rawFrame, but we're drawing on cropped frame
        // Just show a label instead
        actx.fillStyle = 'rgba(0,0,0,0.7)';
        actx.fillRect(4, fh - 18, 220, 16);
        actx.fillStyle = '#fbbf24';
        actx.font = 'bold 10px system-ui';
        actx.fillText(`Auto-window: ${Math.round(autoWin.x*100)},${Math.round(autoWin.y*100)} ${Math.round(autoWin.w*100)}×${Math.round(autoWin.h*100)}%`, 6, fh - 6);
        actx.setLineDash([]);
      }
    }

    // Legend
    actx.fillStyle = 'rgba(0,0,0,0.7)';
    actx.fillRect(fw - 230, 5, 225, 90);
    actx.font = 'bold 10px system-ui';
    actx.fillStyle = '#38bdf8'; actx.fillText('■ Your team (bottom)', fw - 220, 18);
    actx.fillStyle = '#f97316'; actx.fillText('■ Opponent (top)', fw - 220, 32);
    actx.fillStyle = '#a855f7'; actx.fillText('┈ Battle HP panels', fw - 220, 46);
    actx.fillStyle = '#06b6d4'; actx.fillText('┈ Selection YOUR slots', fw - 220, 60);
    actx.fillStyle = '#f43f5e'; actx.fillText('┈ Selection OPP slots', fw - 220, 74);
    actx.fillStyle = '#fbbf24'; actx.fillText('┈ Auto game window', fw - 220, 88);

    setLastFrameUrl(annotated.toDataURL('image/jpeg', 0.6));

    // Auto-record match result — results screen is authoritative,
    // takes precedence over screen-context classification.
    if (result.matchResult) {
      const matchId = currentMatchIdRef.current || 'unknown';
      const frameId = `${matchId}-result-${Date.now()}`;
      saveFrame({
        id: frameId,
        matchId,
        type: 'result',
        timestamp: Date.now(),
        dataUrl: compressFrame(frame, 960, 0.65),
        metadata: {
          matchResult: result.matchResult,
          opponentTeam: filledOpponents,
          myTeam: filledMyTeam,
          ocrText: result.rawText?.slice(0, 500),
          sceneContext: result.screenContext,
        },
      }).catch(e => console.warn('[cache] result save failed', e));
      recordMatch(result.matchResult, frameId);
      return;
    }

    // Skip menu frames AFTER W/L check (results screen wins)
    if (result.screenContext === 'menu') return;

    if (result.species.length < 1 && (!result.spriteMatched || result.spriteMatched.length < 1)) return;

    // ── SIMPLE APPEND-ONLY DETECTION ──
    // No votes, no weights, no phase machine. Just:
    // 1. Found species on left → add to yours
    // 2. Found species on right → add to opponents
    // 3. Dismissed species → skip
    // 4. Already on the other team → skip (no duplicates)

    const myTeamSet = new Set(filledMyTeam);
    for (const sp of filledMyTeam) myTeamSet.add(sp.split('-')[0]);
    const oppTeamSet = new Set(filledOpponents);

    // Collect new detections from ALL sources this frame
    const newYours: string[] = [];
    const newOpps: string[] = [];

    // Sprites (pHash) — side comes from scan region
    for (const s of (result.spriteMatched ?? [])) {
      if (s.confidence < 0.2) continue;
      if (dismissedSpecies.has(s.species)) continue;
      if (s.side === 'left' && !myTeamSet.has(s.species) && !oppTeamSet.has(s.species)) {
        newYours.push(s.species);
      } else if (s.side === 'right' && !oppTeamSet.has(s.species) && !myTeamSet.has(s.species)) {
        newOpps.push(s.species);
      }
    }

    // OCR text — side from word position
    for (const m of result.matched) {
      if (m.confidence < 0.6 || m.side === 'unknown') continue;
      if (dismissedSpecies.has(m.species)) continue;
      if (m.side === 'left' && !myTeamSet.has(m.species) && !oppTeamSet.has(m.species)) {
        newYours.push(m.species);
      } else if (m.side === 'right' && !oppTeamSet.has(m.species) && !myTeamSet.has(m.species)) {
        newOpps.push(m.species);
      }
    }

    // Battle log — "Opposing X" = opponent, "Go! X" = yours
    for (const blm of (result.battleLogMatches ?? [])) {
      if (dismissedSpecies.has(blm.species)) continue;
      if (blm.isOpponent && !oppTeamSet.has(blm.species) && !myTeamSet.has(blm.species)) {
        newOpps.push(blm.species);
      } else if (!blm.isOpponent && !myTeamSet.has(blm.species) && !oppTeamSet.has(blm.species)) {
        newYours.push(blm.species);
      }
    }

    // Dedupe within this frame
    const uniqYours = [...new Set(newYours)];
    const uniqOpps = [...new Set(newOpps)];

    // Apply — append-only, never remove
    if (uniqYours.length > 0 && filledMyTeam.length < 6) {
      const toAdd = uniqYours.filter(s => !myTeamSet.has(s)).slice(0, 6 - filledMyTeam.length);
      if (toAdd.length > 0) handleSetMyTeam([...filledMyTeam, ...toAdd]);
    }

    if (uniqOpps.length > 0) {
      setOpponentTeam(prev => {
        const existing = new Set(prev.filter(Boolean));
        let changed = false;
        for (const s of uniqOpps) {
          if (!existing.has(s) && existing.size < 6 && !dismissedSpecies.has(s)) {
            existing.add(s);
            changed = true;
          }
        }
        if (!changed) return prev;
        setGamePhase('preview');
        return [...existing];
      });
    }

    // Active battler tracking (during battle — use team membership as filter)
    if (filledMyTeam.length >= 2 && filledOpponents.length >= 1) {
      for (const blm of (result.battleLogMatches ?? [])) {
        if (blm.isOpponent && filledOpponents.includes(blm.species)) setActiveOpp(blm.species);
        else if (!blm.isOpponent && filledMyTeam.includes(blm.species)) setActiveYour(blm.species);
      }
    }
  }, [filledMyTeam, filledOpponents, recordMatch, handleSetMyTeam, dismissedSpecies, captureRegion]);

  // Attach capture stream to live video element for smooth preview
  useEffect(() => {
    if (detecting && liveVideoRef.current) {
      const stream = getCaptureStream();
      if (stream) {
        liveVideoRef.current.srcObject = stream;
        liveVideoRef.current.play().catch(() => {});
      }
    }
    return () => {
      if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
    };
  }, [detecting]);

  // Sequential scan loop — each scan finishes, then waits 200ms, then
  // next scan starts. No interval pileup. If a scan takes 3s, next one
  // starts at 3.2s, not 0.6s (which would pile up 5 concurrent scans).
  useEffect(() => {
    if (isOverlayWindow || !detecting) return;
    let cancelled = false;
    const loop = async () => {
      while (!cancelled) {
        await runScan();
        // Short pause between scans — keeps UI responsive
        await new Promise(r => setTimeout(r, 200));
      }
    };
    loop();
    return () => { cancelled = true; };
  }, [detecting, runScan, isOverlayWindow]);

  // Monitor screen capture liveness
  useEffect(() => {
    if (!detecting) return;
    const check = setInterval(() => {
      if (!isCaptureActive()) {
        setDetecting(false);
      }
    }, 2000);
    return () => clearInterval(check);
  }, [detecting]);

  // Cleanup OCR worker on unmount
  useEffect(() => {
    return () => { terminateOcrWorker(); };
  }, []);

  // Auto-set phase based on opponent input
  useEffect(() => {
    if (filledOpponents.length > 0 && gamePhase === 'idle') {
      setGamePhase('preview');
      setMatchStartTime(Date.now());
      setMatchElapsed(0);
    }
    if (filledOpponents.length === 0 && gamePhase === 'preview') {
      setGamePhase('idle');
    }
  }, [filledOpponents.length, gamePhase]);

  // Keyboard shortcuts: W/L for recording
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (filledOpponents.length === 0) return;
      if (e.key === 'w' || e.key === 'W') { e.preventDefault(); recordMatch('win'); }
      if (e.key === 'l' || e.key === 'L') { e.preventDefault(); recordMatch('loss'); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [filledOpponents.length, recordMatch]);


  // ─── Overlay mode ──────────────────────────────────────────────

  // Shared overlay render — used full-screen AND embedded preview
  const overlayJSX = (
    <div className={isOverlay ? 'fixed inset-0 overflow-hidden text-white' : 'absolute inset-0 overflow-hidden text-white rounded-lg'} style={{ background: 'transparent' }}>
        <style>{`
          html, body { background: transparent !important; }
          @keyframes pokeballSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes metallicShine {
            0%, 100% { background-position: -200% 0; }
            50% { background-position: 200% 0; }
          }
          @keyframes trainerGlow {
            0%, 100% { box-shadow: 0 0 25px rgba(255,215,0,0.35), inset 0 0 20px rgba(255,215,0,0.15); }
            50% { box-shadow: 0 0 45px rgba(255,215,0,0.55), inset 0 0 30px rgba(255,215,0,0.25); }
          }
          .stadium-panel {
            isolation: isolate;
            background: linear-gradient(135deg, rgba(15,18,40,0.88) 0%, rgba(25,15,50,0.82) 100%);
            border: 2px solid rgba(255,215,0,0.35);
            box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(196,13,31,0.2), inset 0 1px 0 rgba(255,255,255,0.08);
            backdrop-filter: blur(12px);
          }
          .stadium-panel-red { border-color: rgba(196,13,31,0.45) !important; }
          .stadium-panel-blue { border-color: rgba(0,117,190,0.45) !important; }
          .stadium-panel-gold { border-color: rgba(255,215,0,0.5) !important; }
          .stadium-title {
            background: linear-gradient(90deg, #fde68a 0%, #ffd700 40%, #fff 50%, #ffd700 60%, #fde68a 100%);
            background-size: 200% 100%;
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            animation: metallicShine 4s ease-in-out infinite;
          }
          .champions-red { color: #c40d1f; }
          .champions-blue { color: #0075be; }
          .champions-gold { color: #ffd700; }
        `}</style>

        {/* ═══ YOUR TEAM — bottom-left ═══ */}
        <div className="absolute bottom-6 left-6 stadium-panel stadium-panel-blue rounded-2xl px-4 py-3 z-20" style={{ minWidth: '380px' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded" style={{ background: 'linear-gradient(180deg,#0075be,#003d7a)' }} />
              <span className="text-[10px] font-black tracking-[0.25em] champions-blue">TRAINER</span>
            </div>
            <span className="text-[9px] font-mono text-white/40">{filledMyTeam.length}/6</span>
          </div>
          {filledMyTeam.length > 0 ? (
            <div className="flex gap-1">
              {filledMyTeam.map(species => {
                const isActive = activeYour === species;
                return (
                  <div key={species} className="flex flex-col items-center group">
                    <div
                      className={`relative w-14 h-14 flex items-center justify-center rounded-lg transition-all ${isActive ? 'scale-110' : 'opacity-60'}`}
                      style={{
                        background: isActive
                          ? 'radial-gradient(circle, rgba(0,117,190,0.6) 0%, transparent 70%)'
                          : 'radial-gradient(circle, rgba(0,117,190,0.18) 0%, transparent 70%)',
                        boxShadow: isActive ? '0 0 16px rgba(0,117,190,0.7)' : 'none',
                      }}
                    >
                      <Sprite species={species} size="lg" />
                      {isActive && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                      )}
                    </div>
                    <span className={`text-[8px] font-semibold truncate max-w-[60px] ${isActive ? 'text-sky-300' : 'text-white/50'}`}>{species}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-14 flex items-center justify-center">
              <span className="text-[10px] text-white/25">
                <span>Awaiting team</span><span className="animate-pulse">...</span>
              </span>
            </div>
          )}
        </div>

        {/* ═══ OPPONENT — top-right ═══ */}
        <div className="absolute top-6 right-6 stadium-panel stadium-panel-red rounded-2xl px-4 py-3 z-20" style={{ minWidth: '380px' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono text-white/40">{filledOpponents.length}/6</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-[0.25em] champions-red">OPPONENT</span>
              <div className="w-1 h-4 rounded" style={{ background: 'linear-gradient(180deg,#c40d1f,#7a0410)' }} />
            </div>
          </div>
          {filledOpponents.length > 0 ? (
            <div className="flex gap-1 flex-row-reverse">
              {filledOpponents.map(species => {
                const isActive = activeOpp === species;
                return (
                  <div key={species} className="flex flex-col items-center group">
                    <div
                      className={`relative w-14 h-14 flex items-center justify-center rounded-lg transition-all ${isActive ? 'scale-110' : 'opacity-60'}`}
                      style={{
                        background: isActive
                          ? 'radial-gradient(circle, rgba(196,13,31,0.6) 0%, transparent 70%)'
                          : 'radial-gradient(circle, rgba(196,13,31,0.18) 0%, transparent 70%)',
                        boxShadow: isActive ? '0 0 16px rgba(196,13,31,0.7)' : 'none',
                      }}
                    >
                      <Sprite species={species} size="lg" />
                      {isActive && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      )}
                    </div>
                    <span className={`text-[8px] font-semibold truncate max-w-[60px] ${isActive ? 'text-red-300' : 'text-white/50'}`}>{species}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-14 flex items-center justify-center">
              <span className="text-[10px] text-white/25">
                <span>Scouting</span><span className="animate-pulse">...</span>
              </span>
            </div>
          )}
          {archetypes.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2">
              <span className="text-[8px] font-bold tracking-widest text-white/40 uppercase">Type</span>
              <span className="text-[11px] font-bold champions-gold">{archetypes[0].name}</span>
            </div>
          )}
        </div>

        {/* ═══ CENTER POKEBALL SCOREBOARD ═══ */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
          <div className="stadium-panel rounded-full flex items-center justify-center" style={{ width: '240px', height: '240px', padding: '12px' }}>
            {/* Outer pokeball ring */}
            <div
              className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center"
              style={{
                animation: streak.count >= 3 ? 'trainerGlow 1.8s ease-in-out infinite' : undefined,
                border: '4px solid #0b0b16',
              }}
            >
              {/* Top red half */}
              <div className="absolute top-0 left-0 right-0 h-1/2" style={{ background: 'linear-gradient(180deg, #e3142a 0%, #c40d1f 100%)' }} />
              {/* Bottom white half */}
              <div className="absolute bottom-0 left-0 right-0 h-1/2" style={{ background: 'linear-gradient(180deg, #f5f5f5 0%, #d8d8d8 100%)' }} />
              {/* Middle band */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[10px] bg-black" />
              {/* Center button */}
              <div
                className="relative z-10 rounded-full flex items-center justify-center"
                style={{
                  width: '55%', height: '55%',
                  background: 'radial-gradient(circle, #1e1e32 0%, #0e0e1a 100%)',
                  border: '5px solid #000',
                  boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.1), inset 0 0 20px rgba(0,0,0,0.5)',
                }}
              >
                <div className="flex flex-col items-center justify-center leading-none">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-black text-3xl tracking-tighter" style={{ color: '#4ade80', WebkitTextStroke: '1.5px #fff' }}>{wins}</span>
                    <span className="font-black text-lg" style={{ color: '#ffd700', WebkitTextStroke: '0.5px #fff' }}>-</span>
                    <span className="font-black text-3xl tracking-tighter" style={{ color: '#fb7185', WebkitTextStroke: '1.5px #fff' }}>{losses}</span>
                  </div>
                  {totalGames > 0 && (
                    <div className="text-[11px] font-black mt-0.5 tracking-widest" style={{ color: '#ffd700', WebkitTextStroke: '0.5px #fff' }}>{winRate}%</div>
                  )}
                  {streak.count >= 2 && (
                    <div
                      className="text-[9px] font-black uppercase tracking-widest mt-1 px-2 py-0.5 rounded-full"
                      style={{
                        color: streak.type === 'win' ? '#4ade80' : '#fb7185',
                        background: 'rgba(0,0,0,0.7)',
                      }}
                    >
                      {streak.count}{streak.type === 'win' ? 'W' : 'L'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Title banner */}
          <div className="stadium-panel rounded-lg px-5 py-1.5">
            <div className="text-lg font-black tracking-[0.3em] stadium-title">CHAMPIONS</div>
          </div>
          {/* Recent streak dots */}
          {history.length > 0 && (
            <div className="stadium-panel rounded-full px-3 py-1 flex items-center gap-1">
              {history.slice(0, 15).map(h => (
                <div
                  key={h.id}
                  className={`w-1.5 h-1.5 rounded-full ${
                    h.result === 'win' ? 'bg-emerald-400' : 'bg-red-500'
                  }`}
                  style={{ boxShadow: `0 0 4px ${h.result === 'win' ? 'rgba(74,222,128,0.6)' : 'rgba(239,68,68,0.6)'}` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ═══ BRING LIST — bottom-center ═══ */}
        {bringList.length > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 stadium-panel stadium-panel-gold rounded-xl px-4 py-2.5 z-20">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-1 h-3 rounded" style={{ background: 'linear-gradient(180deg,#ffd700,#b8860b)' }} />
              <span className="text-[9px] font-black tracking-[0.25em] champions-gold">BRING ORDER</span>
            </div>
            <div className="flex gap-1.5">
              {orderedBringList.slice(0, 4).map((rec, i) => (
                <div key={rec.species} className={`flex flex-col items-center ${i < 2 ? '' : 'opacity-60'}`}>
                  <div
                    className="w-11 h-11 rounded-md flex items-center justify-center relative"
                    style={{
                      background: i === 0
                        ? 'radial-gradient(circle, rgba(255,215,0,0.35) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(255,215,0,0.12) 0%, transparent 70%)',
                      border: i < 2 ? '1px solid rgba(255,215,0,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <Sprite species={rec.species} size="md" />
                    <span className={`absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                      i === 0 ? 'bg-poke-gold text-black' : 'bg-slate-700 text-white/70'
                    }`}>{i + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ LEAD CARD — right side, if opener strategy ═══ */}
        {openerStrategy && (
          <div className="absolute top-1/2 -translate-y-1/2 right-6 stadium-panel rounded-xl px-3 py-2.5 z-20" style={{ maxWidth: '220px' }}>
            <div className="text-[8px] font-black tracking-[0.25em] champions-gold mb-1">LEAD PAIR</div>
            <div className="flex items-center justify-center gap-1 mb-2">
              <Sprite species={openerStrategy.lead[0]} size="lg" />
              <span className="champions-gold font-black">+</span>
              <Sprite species={openerStrategy.lead[1]} size="lg" />
            </div>
            <div className="text-[8px] font-bold tracking-widest text-sky-400/70 mb-0.5">TURN 1</div>
            <div className="text-[9px] text-white/70 leading-tight line-clamp-2 mb-1">{openerStrategy.turn1.mon1Action}</div>
            <div className="text-[9px] text-white/70 leading-tight line-clamp-2">{openerStrategy.turn1.mon2Action}</div>
          </div>
        )}

        {/* ═══ MATCH TIMER — top-left subtle ═══ */}
        {matchStartTime && (
          <div className="absolute top-6 left-6 stadium-panel rounded-lg px-3 py-1.5 z-20">
            <div className="text-[8px] font-black tracking-widest text-white/40 uppercase">Match</div>
            <div className="text-sm font-bold font-mono text-white">{formatElapsed(matchElapsed).replace(/^00:/, '')}</div>
          </div>
        )}

        {/* ═══ CONTROLS — stream-ok buttons, minimal ═══ */}
        <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <button
              onClick={() => recordMatch('win')}
              className="stadium-panel rounded-lg px-4 py-2 font-black text-xs tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors active:scale-95"
            >
              WIN
            </button>
            <button
              onClick={() => recordMatch('loss')}
              className="stadium-panel rounded-lg px-4 py-2 font-black text-xs tracking-widest text-red-400 hover:text-red-300 transition-colors active:scale-95"
            >
              LOSS
            </button>
          </div>
          <button
            onClick={() => setIsOverlay(false)}
            className="text-[9px] text-white/25 hover:text-white/60 transition-colors font-bold tracking-widest text-right"
          >
            EXIT OVERLAY
          </button>
        </div>

        {/* Flash banner on recent result */}
        {lastResult && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
            style={{ animation: 'resultFlash 3s ease-out forwards' }}>
            <div
              className="stadium-panel rounded-2xl px-16 py-6"
              style={{
                border: `3px solid ${lastResult === 'win' ? '#22c55e' : '#ef4444'}`,
                boxShadow: `0 0 60px ${lastResult === 'win' ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)'}`,
              }}
            >
              <div className={`text-6xl font-black tracking-widest ${lastResult === 'win' ? 'text-emerald-400' : 'text-red-400'}`}>
                {lastResult === 'win' ? 'VICTORY' : 'DEFEAT'}
              </div>
            </div>
          </div>
        )}
      </div>
  );

  if (isOverlay) return overlayJSX;

  // ─── Full Layout ───────────────────────────────────────────────


  return (
    <div className="min-h-screen bg-poke-darkest text-white flex flex-col">
      <style>{`
        @keyframes resultFlash {
          0% { transform: scale(0.8); opacity: 0; }
          15% { transform: scale(1.05); opacity: 1; }
          30% { transform: scale(1); }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes scanLine {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
      {/* ═══ STICKY TOP BAR: Scoreboard + Controls ═══ */}
      <header className="border-b border-poke-border bg-gradient-to-r from-poke-darker via-poke-dark to-poke-darker sticky top-0 z-40">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-poke-red to-transparent" />
        <div className="max-w-6xl mx-auto px-4 py-2">
          {/* Row 1: Brand + nav */}
          <div className="flex items-center justify-between mb-2">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="w-5 h-5 rounded-full border-2 border-white/80 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[45%] bg-poke-red" />
                <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-white/90" />
              </div>
              <span className="text-sm font-bold">
                <span className="text-poke-red">Live</span> Companion
              </span>
            </Link>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowOverlayPreview(v => !v)}
                className={`text-[10px] px-2 py-1 border rounded transition-colors ${
                  showOverlayPreview
                    ? 'bg-poke-gold/15 border-poke-gold/40 text-poke-gold'
                    : 'bg-poke-surface border-poke-border text-slate-400 hover:text-poke-gold hover:border-poke-gold/40'
                }`}
                title="Embedded overlay preview (detection keeps running)"
              >
                Preview
              </button>
              <button
                onClick={() => setIsOverlay(true)}
                className="text-[10px] px-2 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded hover:text-poke-gold hover:border-poke-gold/40 transition-colors"
                title="Fullscreen OBS overlay (same state, same detection)"
              >
                Overlay
              </button>
              <button
                onClick={() => {
                  const url = `${window.location.pathname}#/stream?overlay=1`;
                  window.open(url, 'champions-overlay', 'width=1280,height=720,resizable=yes');
                }}
                className="text-[10px] px-2 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded hover:text-poke-gold hover:border-poke-gold/40 transition-colors"
                title="Pop out overlay to a new window — receives live state from this tab"
              >
                Pop Out
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                  showHistory
                    ? 'bg-poke-gold/15 border-poke-gold/40 text-poke-gold'
                    : 'bg-poke-surface border-poke-border text-slate-400 hover:text-white'
                }`}
              >
                History ({history.length})
              </button>
              {history.length > 0 && (
                <button
                  onClick={undoLastMatch}
                  className="text-[10px] px-2 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded hover:bg-amber-500/20 transition-colors"
                  title="Remove the most recent match record (last W/L)"
                >
                  Undo Last
                </button>
              )}
              <button
                onClick={resetSession}
                className="text-[10px] px-2 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded hover:text-red-400 hover:border-red-500/30 transition-colors"
                title="Clear all detection data, opponents, and history for a fresh session"
              >
                Reset
              </button>
              <Link to="/" className="text-[10px] px-2 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded hover:text-white transition-colors">Calc</Link>
              <Link to="/team-builder" className="text-[10px] px-2 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded hover:text-white transition-colors">Builder</Link>
            </div>
          </div>

          {/* Row 2: Scoreboard */}
          <div className="flex items-center justify-between">
            {/* Score */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-black text-2xl leading-none">{wins}</span>
                <span className="text-slate-600 font-bold text-lg">:</span>
                <span className="text-red-400 font-black text-2xl leading-none">{losses}</span>
              </div>
              <div className="w-px h-6 bg-poke-border" />
              <span className={`text-lg font-black ${
                totalGames === 0 ? 'text-slate-600' :
                winRate >= 60 ? 'text-emerald-400' : winRate >= 50 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {totalGames === 0 ? '--' : `${winRate}%`}
              </span>
              {streak.count >= 2 && (
                <>
                  <div className="w-px h-6 bg-poke-border" />
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    streak.type === 'win' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                  }`}>{streak.count}{streak.type === 'win' ? 'W' : 'L'}</span>
                </>
              )}
            </div>

            {/* Timer + streak dots */}
            <div className="flex items-center gap-3">
              {history.length > 0 && (
                <div className="flex items-center gap-0.5">
                  {history.slice(0, 15).map((h) => (
                    <div
                      key={h.id}
                      className={`w-2 h-2 rounded-full ${
                        h.result === 'win' ? 'bg-emerald-400' : 'bg-red-400'
                      }`}
                      title={`${h.result === 'win' ? 'W' : 'L'} vs ${h.opponentTeam.join(', ')}`}
                    />
                  ))}
                </div>
              )}
              {matchStartTime && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-poke-red/10 text-poke-red border border-poke-red/20">
                  Match {formatElapsed(matchElapsed).replace(/^00:/, '')}
                </span>
              )}
              <span className="text-xs text-slate-600 font-mono">{formatElapsed(elapsed)}</span>
            </div>
          </div>
        </div>
        {/* Session Stats Row */}
        {totalGames >= 1 && (
          <div className="border-t border-poke-border/50">
            <div className="max-w-6xl mx-auto px-4">
              <button
                onClick={() => setShowSessionStats(!showSessionStats)}
                className="w-full flex items-center justify-center gap-2 py-1 text-[9px] text-slate-600 hover:text-slate-400 transition-colors"
              >
                <span>Session Stats</span>
                <svg className={`w-2.5 h-2.5 transition-transform ${showSessionStats ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showSessionStats && (
                <div className="flex items-center justify-center gap-3 pb-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-poke-surface border border-poke-border">
                    <span className="text-[9px] text-slate-500 uppercase">Pace</span>
                    <span className="text-[11px] font-bold text-white">
                      {elapsed > 60000 ? (totalGames / (elapsed / 3600000)).toFixed(1) : '--'}/hr
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-poke-surface border border-poke-border">
                    <span className="text-[9px] text-slate-500 uppercase">Streak</span>
                    <span className={`text-[11px] font-bold ${
                      streak.type === 'win' ? 'text-emerald-400' : streak.type === 'loss' ? 'text-red-400' : 'text-slate-400'
                    }`}>
                      {streak.count > 0 ? `${streak.count}${streak.type === 'win' ? 'W' : 'L'}` : '--'}
                    </span>
                    {streak.count >= 3 && streak.type === 'win' && <span className="text-[9px]">🔥</span>}
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-poke-surface border border-poke-border">
                    <span className="text-[9px] text-slate-500 uppercase">Trend</span>
                    {(() => {
                      if (totalGames < 4) return <span className="text-[11px] text-slate-500">--</span>;
                      const half = Math.floor(history.length / 2);
                      const recentWins = history.slice(0, half).filter(h => h.result === 'win').length;
                      const earlyWins = history.slice(half).filter(h => h.result === 'win').length;
                      const recentRate = recentWins / half;
                      const earlyRate = earlyWins / (history.length - half);
                      const trending = recentRate > earlyRate + 0.05 ? 'up' : recentRate < earlyRate - 0.05 ? 'down' : 'flat';
                      return (
                        <span className={`text-[11px] font-bold ${
                          trending === 'up' ? 'text-emerald-400' : trending === 'down' ? 'text-red-400' : 'text-amber-400'
                        }`}>
                          {trending === 'up' ? '▲' : trending === 'down' ? '▼' : '—'}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ═══ MAIN CONTENT — 2-column on wide screens ═══ */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-4 space-y-4">

      {/* Full-width overlay preview when toggled */}
      {showOverlayPreview && (
        <div className="poke-panel overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-poke-border">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overlay Preview · Live</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsOverlay(true)}
                className="text-[9px] px-2 py-0.5 rounded bg-poke-gold/15 border border-poke-gold/30 text-poke-gold hover:bg-poke-gold/25 transition-colors"
              >
                Fullscreen
              </button>
              <button
                onClick={() => {
                  const url = `${window.location.pathname}#/stream?overlay=1`;
                  window.open(url, 'champions-overlay', 'width=1280,height=720,resizable=yes');
                }}
                className="text-[9px] px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-400 hover:bg-sky-500/25 transition-colors"
              >
                Pop Out Window
              </button>
              <button
                onClick={() => setShowOverlayPreview(false)}
                className="text-[9px] text-slate-600 hover:text-red-400 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
          <div className="relative bg-slate-950/50 w-full" style={{ aspectRatio: '16 / 9' }}>
            {overlayJSX}
          </div>
        </div>
      )}

      {/* ═══ FRAME CAPTURE ═══ */}
      {detecting && (() => {
        // ROI covering >85% of frame = useless (whole screen). Treat as no ROI.
        const hasValidROI = captureRegion && (captureRegion.w < 0.85 || captureRegion.h < 0.85);
        // Auto-enter region select when no valid ROI and frame available
        const needsROI = !hasValidROI && !regionSelecting;

        return (
          <div className="poke-panel overflow-hidden">
            {/* ROI prompt — prominent when needed */}
            {needsROI && lastFrameUrl && (
              <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/30 text-center">
                <div className="text-sm font-bold text-amber-300 mb-1">Select your game window</div>
                <div className="text-xs text-amber-400/70 mb-2">Overlay streams need a region drawn around the game capture. Click below then drag on the image.</div>
                <button
                  onClick={() => { setRegionSelecting(true); setRegionDragStart(null); setRegionDragEnd(null); }}
                  className="px-4 py-1.5 rounded-lg bg-amber-500/25 border border-amber-500/50 text-amber-200 text-sm font-bold hover:bg-amber-500/35 transition-colors"
                >
                  Draw Game Region
                </button>
              </div>
            )}
            {regionSelecting && (
              <div className="px-4 py-2 bg-violet-500/10 border-b border-violet-500/30 text-center">
                <span className="text-sm text-violet-300 font-bold">Click and drag on the image below to select the game area</span>
                <button
                  onClick={() => { setRegionSelecting(false); setRegionDragStart(null); setRegionDragEnd(null); }}
                  className="ml-3 px-3 py-0.5 rounded bg-poke-surface border border-poke-border text-slate-400 text-xs hover:text-red-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
            {/* Header — compact when ROI set */}
            {hasValidROI && !regionSelecting && (
              <div className="flex items-center justify-between px-3 py-1 border-b border-poke-border/30">
                <span className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-wider">
                  Game Window · {Math.round((captureRegion?.w ?? 0) * 100)}×{Math.round((captureRegion?.h ?? 0) * 100)}%
                </span>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button onClick={() => { setRegionSelecting(true); setRegionDragStart(null); setRegionDragEnd(null); }} className="px-2 py-0.5 rounded bg-poke-surface border border-poke-border text-slate-400 hover:text-violet-400 transition-colors">Redraw</button>
                  <button onClick={() => setCaptureRegion(null)} className="px-2 py-0.5 rounded bg-poke-surface border border-poke-border text-slate-400 hover:text-red-400 transition-colors">Clear</button>
                </div>
              </div>
            )}
            {/* Live game window — video for smooth streaming, img for region select */}
            {(lastFrameUrl || detecting) && (
              <div
                className="relative overflow-hidden"
                onMouseDown={regionSelecting ? (e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const pos = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
                  setRegionDragStart(pos); setRegionDragEnd(pos);
                } : undefined}
                onMouseMove={regionSelecting && regionDragStart ? (e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setRegionDragEnd({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
                } : undefined}
                onMouseUp={regionSelecting && regionDragStart && regionDragEnd ? () => {
                  const x0 = Math.min(regionDragStart!.x, regionDragEnd!.x), y0 = Math.min(regionDragStart!.y, regionDragEnd!.y);
                  const x1 = Math.max(regionDragStart!.x, regionDragEnd!.x), y1 = Math.max(regionDragStart!.y, regionDragEnd!.y);
                  if ((x1-x0) > 0.05 && (y1-y0) > 0.05) setCaptureRegion({ x: x0, y: y0, w: x1-x0, h: y1-y0 });
                  setRegionSelecting(false); setRegionDragStart(null); setRegionDragEnd(null);
                } : undefined}
                style={{ cursor: regionSelecting ? 'crosshair' : 'default', userSelect: 'none' }}
              >
                {/* Live video stream (smooth) — shown when not region-selecting */}
                {detecting && !regionSelecting && !showDebug && (
                  <video ref={liveVideoRef} autoPlay muted playsInline className="w-full h-auto block" style={{ pointerEvents: 'none' }} />
                )}
                {/* Annotated frame (debug overlays) or raw frame for region select */}
                {(regionSelecting || showDebug || !detecting) && (
                  <img
                    src={(regionSelecting ? (lastRawFrameUrl ?? lastFrameUrl) : lastFrameUrl) ?? undefined}
                    alt="Captured frame"
                    className="w-full h-auto block"
                    draggable={false}
                  style={{ pointerEvents: 'none' }}
                />
                )}
                {regionSelecting && regionDragStart && regionDragEnd && (
                  <div className="absolute border-2 border-violet-400 bg-violet-400/10 pointer-events-none" style={{
                    left: `${Math.min(regionDragStart.x, regionDragEnd.x)*100}%`, top: `${Math.min(regionDragStart.y, regionDragEnd.y)*100}%`,
                    width: `${Math.abs(regionDragEnd.x-regionDragStart.x)*100}%`, height: `${Math.abs(regionDragEnd.y-regionDragStart.y)*100}%`,
                  }} />
                )}
              </div>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
      {/* Left column: stream, debug, opponent input */}
      <div className="space-y-4">

        {/* Result flash */}
        {lastResult && (
          <div className={`text-center py-3 rounded-xl font-black text-lg ${
            lastResult === 'win' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/40' : 'bg-red-900/40 text-red-300 border border-red-500/40'
          }`} style={{ animation: 'resultFlash 3s ease-out forwards' }}>
            {lastResult === 'win' ? 'VICTORY' : 'DEFEAT'}
          </div>
        )}

        {/* ═══ TEAMS + CONTROLS — single compact panel ═══ */}
        <div className="poke-panel p-3 space-y-3">
          {/* Your Team */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Your Team</span>
                <span className="text-[10px] text-slate-600">{filledMyTeam.length}/6</span>
              </div>
              <div className="flex items-center gap-1.5">
                {filledMyTeam.length >= 2 && !teamExpanded && (
                  <button onClick={() => setTeamExpanded(true)} className="text-[10px] text-poke-blue hover:text-poke-blue-light transition-colors">Edit</button>
                )}
                {filledMyTeam.length >= 2 && teamExpanded && (
                  <button onClick={() => setTeamExpanded(false)} className="text-[10px] text-poke-blue hover:text-poke-blue-light transition-colors">Done</button>
                )}
                {filledMyTeam.length > 0 && (
                  <button onClick={() => handleSetMyTeam([])} className="text-[10px] text-slate-600 hover:text-red-400 transition-colors">Clear</button>
                )}
              </div>
            </div>
            {filledMyTeam.length >= 2 && !teamExpanded ? (
              <div className="flex items-center gap-1 flex-wrap">
                {filledMyTeam.map(species => (
                  <div key={species} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-poke-surface border border-poke-border/40 shrink-0">
                    <Sprite species={species} size="sm" />
                    <span className="text-[10px] text-slate-400">{species}</span>
                  </div>
                ))}
              </div>
            ) : (
              <QuickTeamInput value={filledMyTeam} onChange={handleSetMyTeam} maxSlots={6} />
            )}
          </div>

          <div className="h-px bg-poke-border/30" />

          {/* Opponent Team */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-poke-red uppercase tracking-wider font-bold">Opponent</span>
              <span className="text-[10px] text-slate-600">{filledOpponents.length}/6 · Tab to accept</span>
            </div>
            {filledOpponents.length > 0 && detecting && (
              <div className="flex gap-1 flex-wrap mb-1.5">
                {filledOpponents.map(species => (
                  <div key={species} className="flex items-center gap-1 pl-1.5 pr-0.5 py-0.5 rounded bg-poke-surface border border-poke-border group">
                    <Sprite species={species} size="sm" />
                    <span className="text-[10px] text-white">{species}</span>
                    <button
                      onClick={() => {
                        setOpponentTeam(prev => prev.filter(s => s !== species));
                        setDismissedSpecies(prev => new Set([...prev, species]));
                      }}
                      className="w-4 h-4 flex items-center justify-center rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <QuickTeamInput value={filledOpponents} onChange={setOpponentTeam} maxSlots={6} />
          </div>

          <div className="h-px bg-poke-border/30" />

          {/* Stream + Detection controls — inline */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={videoUrlInput}
              onChange={e => setVideoUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnectVideo()}
              placeholder="Stream URL or channel..."
              className="flex-1 px-2 py-1.5 bg-poke-surface border border-poke-border rounded text-xs text-white placeholder:text-slate-600 focus:border-purple-500/50 focus:outline-none"
            />
            {!videoSource ? (
              <button onClick={handleConnectVideo} className="px-3 py-1.5 bg-purple-600/20 border border-purple-500/40 text-purple-400 rounded text-xs font-bold hover:bg-purple-600/30 transition-colors shrink-0">
                Watch
              </button>
            ) : (
              <button onClick={handleDisconnectVideo} className="px-2 py-1.5 bg-poke-surface border border-poke-border text-slate-600 rounded text-xs hover:text-red-400 transition-colors shrink-0">
                Close
              </button>
            )}
            {!detecting ? (
              <button onClick={handleStartDetection} disabled={ocrLoading} className={`px-3 py-1.5 rounded border text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 ${
                ocrLoading ? 'border-poke-border bg-poke-surface text-slate-600 cursor-wait' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
              }`}>
                {ocrLoading ? 'Loading...' : 'Detect'}
              </button>
            ) : (
              <button onClick={handleStopDetection} className="px-3 py-1.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors shrink-0 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Stop
              </button>
            )}
          </div>

          {/* Video embed — only when not detecting */}
          {videoSource && !detecting && <VideoEmbed source={videoSource} />}
        </div>

        {/* ═══ COMPACT STATUS BAR — inline under frame capture ═══ */}
        {(detecting || lastOcrResult) && (
          <div className="flex items-center gap-2 px-3 py-1.5 text-[10px]">
            {detecting && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
            {lastOcrResult && (
              <>
                <span className={`font-bold shrink-0 ${
                  lastOcrResult.screenContext === 'menu' ? 'text-slate-400' :
                  lastOcrResult.screenContext === 'battle' ? 'text-emerald-400' : 'text-slate-500'
                }`}>
                  {lastOcrResult.screenContext === 'menu' ? 'MENU' : lastOcrResult.screenContext === 'battle' ? 'BATTLE' : 'SCANNING'}
                </span>
                {lastOcrResult.matchResult && (
                  <>
                    <span className="text-slate-700">|</span>
                    <span className={`font-bold shrink-0 ${lastOcrResult.matchResult === 'win' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {lastOcrResult.matchResult === 'win' ? 'WIN' : 'LOSS'}
                    </span>
                  </>
                )}
                <span className="text-slate-700">|</span>
                <span className="text-slate-600 truncate">
                  {lastOcrResult.matched.length}T {lastOcrResult.spriteMatched?.length ?? 0}I | {filledMyTeam.length}L {filledOpponents.length}R | #{scanCount} | {lastOcrResult.durationMs}ms
                </span>
              </>
            )}
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {detecting && (
                <button onClick={runScan} className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-500/30 text-violet-400 font-bold hover:bg-violet-500/25 transition-colors">
                  Scan
                </button>
              )}
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="text-[9px] px-1.5 py-0.5 rounded bg-poke-surface border border-poke-border text-slate-500 hover:text-white transition-colors font-bold"
              >
                {showDebug ? 'Hide' : 'Debug'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ DEBUG SECTIONS — collapsible details ═══ */}
        {showDebug && lastOcrResult && (detecting || lastOcrResult) && (
          <div className="px-3 pb-3 space-y-1">

            {/* Section: Battle Log Matches — highest confidence */}
            {(lastOcrResult.battleLogMatches?.length ?? 0) > 0 && (
              <DebugSection title={`Battle Log — ${lastOcrResult.battleLogMatches!.length} found`} defaultOpen>
                <div className="space-y-1">
                  {lastOcrResult.battleLogMatches!.map((blm, i) => (
                    <div key={i} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded border text-[10px] ${
                      blm.isOpponent ? 'bg-red-500/10 border-red-500/20' : 'bg-sky-500/10 border-sky-500/20'
                    }`}>
                      <Sprite species={blm.species} size="sm" />
                      <span className="text-white font-medium">{blm.species}</span>
                      <span className={`text-[8px] font-bold px-1 rounded ${blm.isOpponent ? 'bg-red-500/20 text-red-400' : 'bg-sky-500/20 text-sky-400'}`}>
                        {blm.isOpponent ? 'OPPONENT' : 'YOURS'}
                      </span>
                      <span className="text-slate-600">"{blm.pattern}"</span>
                    </div>
                  ))}
                </div>
              </DebugSection>
            )}

            {/* Section: Detections — merged text + sprite matches */}
            <DebugSection title={`Detections — ${lastOcrResult.matched.length}T ${lastOcrResult.spriteMatched?.length ?? 0}I`} defaultOpen={lastOcrResult.matched.length > 0 || (lastOcrResult.spriteMatched?.length ?? 0) > 0}>
              {/* Text matches */}
              {lastOcrResult.matched.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  {lastOcrResult.matched.map(m => {
                    const isMyTeam = filledMyTeam.includes(m.species);
                    const isTracked = filledOpponents.includes(m.species);
                    return (
                      <div key={`ocr-${m.species}`} className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${
                        isMyTeam ? 'bg-sky-500/10 border-sky-500/20' : isTracked ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-poke-gold/10 border-poke-gold/20'
                      }`}>
                        <Sprite species={m.species} size="sm" />
                        <span className="text-[10px] text-white font-medium">{m.species}</span>
                        <span className={`text-[8px] font-bold px-1 rounded ${
                          isMyTeam ? 'bg-sky-500/20 text-sky-400' : isTracked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-poke-gold/20 text-poke-gold'
                        }`}>{isMyTeam ? 'YOURS' : isTracked ? 'TRACKED' : 'NEW'}</span>
                        <span className="text-[9px] text-slate-600">"{m.token}" {Math.round(m.confidence * 100)}%{m.side !== 'unknown' ? ` [${m.side}]` : ''}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Sprite matches */}
              {(lastOcrResult.spriteMatched?.length ?? 0) > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {lastOcrResult.spriteMatched!.map(s => {
                    const isMyTeam = filledMyTeam.includes(s.species);
                    const fromOcr = lastOcrResult.matched.some(m => m.species === s.species);
                    return (
                      <div key={`spr-${s.species}`} className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${
                        isMyTeam ? 'bg-sky-500/10 border-sky-500/20' : fromOcr ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-violet-500/10 border-violet-500/20'
                      }`}>
                        <Sprite species={s.species} size="sm" />
                        <span className="text-[10px] text-white font-medium">{s.species}</span>
                        <span className={`text-[8px] font-bold px-1 rounded ${
                          isMyTeam ? 'bg-sky-500/20 text-sky-400' : fromOcr ? 'bg-emerald-500/20 text-emerald-400' : 'bg-violet-500/20 text-violet-400'
                        }`}>{isMyTeam ? 'YOURS' : fromOcr ? 'OCR+ICON' : 'ICON'}</span>
                        <span className="text-[9px] text-slate-600">{Math.round(s.confidence * 100)}% @ ({Math.round(s.x)},{Math.round(s.y)})</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {lastOcrResult.matched.length === 0 && (lastOcrResult.spriteMatched?.length ?? 0) === 0 && (
                <div className="text-[10px] text-slate-600">No detections this frame</div>
              )}
            </DebugSection>

            {/* Section: Accumulated Opponents */}
            <DebugSection title={`Opponent Accumulator — ${filledOpponents.length}/6`} defaultOpen={filledOpponents.length > 0}>
              {filledOpponents.length > 0 ? (
                <div className="flex gap-1.5 flex-wrap">
                  {filledOpponents.map(s => (
                    <div key={s} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20">
                      <Sprite species={s} size="sm" />
                      <span className="text-[10px] text-white">{s}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-slate-600">No opponents accumulated yet</div>
              )}
            </DebugSection>

            {/* Section: Raw Data — merged near misses + raw OCR */}
            <DebugSection title={`Raw Data — ${lastOcrResult.rejected?.length ?? 0} near misses · ${lastOcrResult.tokens.length} tokens · pass: ${lastOcrResult.bestPass}`} defaultOpen={false}>
              {/* Near misses */}
              {(lastOcrResult.rejected?.length ?? 0) > 0 && (
                <div className="mb-2">
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">Near Misses</div>
                  <div className="flex gap-1 flex-wrap">
                    {lastOcrResult.rejected!.map((r, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-poke-surface border border-poke-border/30 text-slate-500">
                        "{r.token}" <span className="text-slate-700">-- {r.reason}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Raw OCR text */}
              <div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">Raw OCR</div>
                <pre className="p-2 rounded bg-poke-surface/50 border border-poke-border/30 text-slate-500 text-[9px] max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono">
                  {lastOcrResult.rawText || '(empty)'}
                </pre>
              </div>
            </DebugSection>

            {/* Cooldown indicator */}
            {detecting && Date.now() < cooldownUntilRef.current && (
              <div className="text-[10px] text-amber-400 flex items-center gap-1.5 pt-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Post-game cooldown — ignoring scans until next match starts
              </div>
            )}
          </div>
        )}

        {/* Dismissed species tracker */}
        {dismissedSpecies.size > 0 && (
          <div className="flex items-center gap-1.5 px-3 text-[9px] text-slate-600">
            <span>Dismissed:</span>
            {[...dismissedSpecies].map(s => <span key={s} className="px-1 py-0.5 rounded bg-poke-surface border border-poke-border/30 line-through">{s}</span>)}
            <button onClick={() => setDismissedSpecies(new Set())} className="text-slate-500 hover:text-white transition-colors">Reset</button>
          </div>
        )}
      </div>{/* end left column */}

        {/* Right column: analysis */}
        <div className="space-y-4">

        {/* ═══ LIVE ANALYSIS (appears with 1+ opponents) ═══ */}
        {filledOpponents.length >= 1 && (
          <div className="space-y-3">
            {/* Archetype + Counter Tips */}
            {archetypes.length > 0 && (
              <div className="poke-panel p-4">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Detected Archetype</div>
                <div className="space-y-3">
                  {archetypes.map((arch, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-poke-gold' : 'bg-slate-600'}`} />
                        <span className={`font-bold ${i === 0 ? 'text-base text-white' : 'text-sm text-slate-400'}`}>{arch.name}</span>
                        <span className="text-[10px] text-slate-600">{Math.round(arch.confidence * 100)}%</span>
                      </div>
                      {i === 0 && arch.counterTips.length > 0 && (
                        <div className="ml-5 space-y-0.5">
                          {arch.counterTips.slice(0, 3).map((tip, j) => (
                            <div key={j} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                              <span className="text-poke-gold mt-0.5 shrink-0">-</span>
                              <span>{tip}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing team notice */}
            {filledMyTeam.length < 2 && (
              <div className="poke-panel p-3 border-amber-500/20">
                <div className="flex items-center gap-2 text-xs text-amber-400">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Enter your team above to see bring list, threats, and opener strategy
                </div>
              </div>
            )}

            {/* Bring List + Lead — combined panel */}
            {bringList.length > 0 && (
              <div className="poke-panel p-4">
                <div className="text-[10px] text-poke-gold uppercase tracking-wider font-bold mb-3">Recommended Bring</div>
                <div className="space-y-1.5 mb-4">
                  {orderedBringList.slice(0, 4).map((rec, i) => {
                    const tier = getTierForPokemon(rec.species);
                    const tierDef = tier ? TIER_DEFINITIONS.find(d => d.tier === tier.tier) : null;
                    const medal = i === 0 ? 'text-poke-gold' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-700' : 'text-slate-600';
                    const roleColors: Record<string, string> = {
                      Lead: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
                      Pivot: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                      Closer: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
                      Flex: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
                    };
                    return (
                      <div key={rec.species} className={`flex items-center gap-2 p-2 rounded-lg border ${
                        i < 2 ? 'border-poke-gold/20 bg-poke-gold/5' : 'border-poke-border bg-poke-surface/30'
                      }`}>
                        <span className={`text-sm font-black w-5 text-center ${medal}`}>{i + 1}</span>
                        <Sprite species={rec.species} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white">{rec.species}</span>
                            <span className={`text-[8px] font-bold px-1 py-0.5 rounded border ${roleColors[rec.role] ?? roleColors.Flex}`}>
                              {rec.role}
                            </span>
                            {tierDef && (
                              <span className={`text-[8px] font-black px-1 rounded ${tierDef.bgColor} ${tierDef.color} border ${tierDef.borderColor}`}>
                                {tier!.tier}
                              </span>
                            )}
                            <span className={`text-[10px] font-mono ml-auto ${
                              rec.score >= 5 ? 'text-emerald-400' : rec.score >= 0 ? 'text-amber-400' : 'text-red-400'
                            }`}>
                              {rec.score >= 0 ? '+' : ''}{rec.score}
                            </span>
                          </div>
                          {rec.reasons.length > 0 && (
                            <div className="text-[10px] text-slate-500 truncate">{rec.reasons[0]}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Opener Strategy — turn-by-turn actions */}
                {openerStrategy && (
                  <div className="pt-3 border-t border-poke-border mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="text-[10px] text-sky-400 uppercase tracking-wider font-bold">Opening Play</div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400/70 border border-sky-500/20 font-bold">
                        {openerStrategy.archetype}
                      </span>
                    </div>

                    {/* Lead pair */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-poke-surface border border-sky-500/20">
                        <Sprite species={openerStrategy.lead[0]} size="md" />
                        <span className="text-slate-600 font-bold">+</span>
                        <Sprite species={openerStrategy.lead[1]} size="md" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white">{openerStrategy.lead[0]} + {openerStrategy.lead[1]}</div>
                        <div className="text-[11px] text-slate-500">{openerStrategy.reasoning}</div>
                      </div>
                    </div>

                    {/* Turn 1 actions */}
                    <div className="rounded-lg border border-sky-500/15 bg-sky-500/5 p-3 mb-2">
                      <div className="text-[9px] text-sky-400/60 uppercase tracking-widest font-bold mb-2">Turn 1</div>
                      <div className="space-y-1.5">
                        <div className="flex items-start gap-2">
                          <Sprite species={openerStrategy.lead[0]} size="sm" />
                          <span className="text-[11px] text-white/90 leading-snug">{openerStrategy.turn1.mon1Action}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Sprite species={openerStrategy.lead[1]} size="sm" />
                          <span className="text-[11px] text-white/90 leading-snug">{openerStrategy.turn1.mon2Action}</span>
                        </div>
                      </div>
                    </div>

                    {/* Turn 2 follow-up */}
                    <div className="rounded-lg border border-poke-border bg-poke-surface/30 p-3 mb-2">
                      <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Turn 2</div>
                      <div className="text-[11px] text-slate-400 leading-snug">{openerStrategy.turn2.action}</div>
                    </div>

                    {/* Counter-play note */}
                    <div className="text-[10px] text-emerald-400/70 mt-2 flex items-start gap-1.5">
                      <span className="shrink-0 mt-0.5">-</span>
                      <span>{openerStrategy.counterPlay}</span>
                    </div>
                  </div>
                )}

                {/* Legacy lead suggestion as fallback when no opener strategy */}
                {!openerStrategy && leadSuggestion && (
                  <div className="pt-3 border-t border-poke-border">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Suggested Lead</div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-poke-surface border border-poke-border">
                        <Sprite species={leadSuggestion.lead1} size="md" />
                        <span className="text-slate-600 font-bold">+</span>
                        <Sprite species={leadSuggestion.lead2} size="md" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white">{leadSuggestion.lead1} + {leadSuggestion.lead2}</div>
                        <div className="text-[11px] text-slate-500">{leadSuggestion.reasoning}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Key Threats */}
            {threats.length > 0 && (
              <div className="poke-panel p-4">
                <div className="text-[10px] text-red-400 uppercase tracking-wider font-bold mb-2">Key Threats</div>
                <div className="space-y-1.5">
                  {threats.slice(0, 3).map(threat => (
                    <div key={threat.species} className="flex items-center gap-2 p-2 rounded-lg border border-red-500/20 bg-red-500/5">
                      <Sprite species={threat.species} size="sm" />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-white">{threat.species}</span>
                        <div className="text-[10px] text-red-300/70">{threat.reason}</div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: Math.min(5, Math.max(1, Math.ceil(threat.danger / 2))) }).map((_, i) => (
                          <div key={i} className="w-1.5 h-3 rounded-sm bg-red-400/60" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state when no opponents entered */}
        {filledOpponents.length === 0 && !lastResult && (
          <div className="poke-panel p-8 text-center">
            <div className="text-slate-500 text-sm mb-1">Enter opponent Pokemon to get live analysis</div>
            <div className="text-slate-600 text-xs">
              Type names above, use screen capture to auto-detect, or watch a Twitch stream and enter manually.
              <br />
              Analysis updates live as you add each Pokemon.
            </div>
          </div>
        )}

      </div>{/* end right column */}
      </div>{/* end grid */}

        {/* ═══ MATCH HISTORY (collapsible) ═══ */}
        {showHistory && (
          <div className="poke-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Match History</div>
                <div className="text-[10px] text-slate-600">
                  {cacheStats.frames} frames · {Math.round(cacheStats.bytes / 1024)} KB cached
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportArchive}
                  className="text-[10px] px-2 py-1 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-colors"
                  title="Download JSON with all matches + cached keyframes"
                >
                  Export
                </button>
                <button
                  onClick={handleClearCache}
                  className="text-[10px] text-slate-600 hover:text-amber-400 transition-colors"
                >
                  Clear Cache
                </button>
                {history.length > 0 && (
                  <button onClick={clearHistory} className="text-[10px] text-slate-600 hover:text-red-400 transition-colors">
                    Clear History
                  </button>
                )}
              </div>
            </div>
            {history.length === 0 ? (
              <div className="text-xs text-slate-600 text-center py-4">No matches recorded yet.</div>
            ) : (
              <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
                {history.map(match => (
                  <MatchHistoryRow key={match.id} match={match} onDelete={deleteMatch} onFlip={flipMatchResult} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ STICKY BOTTOM: W/L BUTTONS ═══ */}
      <div className="sticky bottom-0 z-40 border-t border-poke-border bg-poke-darker/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex gap-3">
          <button
            onClick={() => recordMatch('win')}
            disabled={filledOpponents.length === 0}
            className={`flex-1 py-3 rounded-xl font-black text-base tracking-wider transition-all active:scale-[0.97] ${
              filledOpponents.length > 0
                ? 'bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-400/60'
                : 'bg-poke-surface border-2 border-poke-border text-slate-600 cursor-not-allowed'
            }`}
          >
            WIN
            <span className="text-[10px] font-normal opacity-50 ml-1.5">[W]</span>
          </button>
          <button
            onClick={() => recordMatch('loss')}
            disabled={filledOpponents.length === 0}
            className={`flex-1 py-3 rounded-xl font-black text-base tracking-wider transition-all active:scale-[0.97] ${
              filledOpponents.length > 0
                ? 'bg-red-500/15 border-2 border-red-500/40 text-red-400 hover:bg-red-500/25 hover:border-red-400/60'
                : 'bg-poke-surface border-2 border-poke-border text-slate-600 cursor-not-allowed'
            }`}
          >
            LOSS
            <span className="text-[10px] font-normal opacity-50 ml-1.5">[L]</span>
          </button>
        </div>
      </div>
    </div>
  );
}
