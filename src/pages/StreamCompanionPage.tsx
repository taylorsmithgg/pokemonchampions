import { useState, useMemo, useCallback, useEffect, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
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
  setCaptureGrabVideoElement,
  type OcrDetectionResult,
} from '../utils/ocrDetection';

// Expose detection functions for reference image testing (dev only)
if (import.meta.env.DEV) {
  Promise.all([
    import('../utils/onnxMatcher'),
    import('../utils/offlineSpriteClassifier'),
  ]).then(([onnx, offlineClassifier]) => {
    (window as unknown as Record<string, unknown>).__ocrDetection = {
      initOcrWorker,
      isOcrReady,
      detectPokemonFromFrame,
      autoDetectGameWindow,
      isModelReady: onnx.isModelReady,
      rankCanvasWithOfflineSpriteClassifier: offlineClassifier.rankCanvasWithOfflineSpriteClassifier,
      getOfflineSpriteClassifierMetadata: offlineClassifier.getOfflineSpriteClassifierMetadata,
    };
  });
}
import {
  saveFrame,
  compressFrame,
  listAllFrames,
  getFrame,
  getFramesByMatch,
  deleteFrame,
  clearAllFrames,
  downloadArchive,
  exportArchive,
  type CachedFrame,
} from '../utils/matchCache';
import type { PokemonState } from '../types';
import { createDefaultPokemonState } from '../types';
import {
  feedSnapshot as feedLineupSnapshot,
  getConsensus as getLineupConsensus,
  getConsensusSlots as getLineupConsensusSlots,
  reset as resetLineupAnalyzer,
  feedLockSnapshot,
  getLockConsensus,
  resetLockAnalyzer,
  LINEUP_ANALYZER_CONFIG,
} from '../utils/spriteDetector/lineupAnalyzer';


/**
 * Build the lock-screen matcher hints from the current SELECTION
 * consensus. The lock pipeline uses these as a candidate whitelist —
 * lock-card chibis are only scored against the species the selection
 * voter has already locked in. Returns `undefined` when the consensus
 * is empty (no lineup observed yet) so the matcher falls back to its
 * normal full-DB behavior.
 *
 * Lives at module scope (rather than inside the component) because
 * `getLineupConsensus` already reads from a singleton accumulator —
 * no React state is involved.
 */
function buildLockMatchHints(): { playerSpecies?: ReadonlySet<string>; opponentSpecies?: ReadonlySet<string> } | undefined {
  const consensus = getLineupConsensus();
  if (consensus.slots.length === 0) return undefined;
  const playerSpecies = new Set<string>();
  const opponentSpecies = new Set<string>();
  for (const slot of consensus.slots) {
    if (!slot.assignedSpecies || !slot.isConfident) continue;
    if (slot.side === 'left') playerSpecies.add(slot.assignedSpecies);
    else opponentSpecies.add(slot.assignedSpecies);
  }
  if (playerSpecies.size === 0 && opponentSpecies.size === 0) return undefined;
  return {
    playerSpecies: playerSpecies.size > 0 ? playerSpecies : undefined,
    opponentSpecies: opponentSpecies.size > 0 ? opponentSpecies : undefined,
  };
}

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
const MY_TEAM_KEY = 'stream-companion-my-team';
const DETECTED_MY_TEAM_KEY = 'stream-companion-detected-my-team';
const DETECTED_OPPONENT_TEAM_KEY = 'stream-companion-detected-opponent-team';

function loadHistory(): MatchRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadStoredSpeciesList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: MatchRecord[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
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



// ─── Match History Row with expandable thumbnails ───────────────

function MatchHistoryRow({ match, onDelete, onFlip }: { match: MatchRecord; onDelete: (id: string) => void; onFlip: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [frames, setFrames] = useState<CachedFrame[] | null>(null);

  const loadFrames = useCallback(async () => {
    if (frames) return;
    const loaded = new Map<string, CachedFrame>();
    // Pull every frame tagged with this match's id — includes the
    // primary preview/result frames AND any lineup-lock / result-
    // candidate audits captured during the match.
    const byMatchId = await getFramesByMatch(match.id);
    for (const f of byMatchId) loaded.set(f.id, f);
    // Also pull the explicit pointers (for legacy matches that didn't
    // have matchId propagated to audit frames).
    if (match.previewFrameId && !loaded.has(match.previewFrameId)) {
      const f = await getFrame(match.previewFrameId);
      if (f) loaded.set(f.id, f);
    }
    if (match.resultFrameId && !loaded.has(match.resultFrameId)) {
      const f = await getFrame(match.resultFrameId);
      if (f) loaded.set(f.id, f);
    }
    setFrames([...loaded.values()].sort((a, b) => a.timestamp - b.timestamp));
  }, [match.id, match.previewFrameId, match.resultFrameId, frames]);

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
        <button onClick={toggle} className="text-[9px] px-2 py-0.5 rounded border border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors shrink-0" title="Show cached preview/result/lineup/audit frames">
          {expanded ? 'Hide' : 'Replay'}
        </button>
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
              {frames.map(f => {
                const signals = f.metadata.resultSignals;
                const lineup = f.metadata.lineupSlots;
                const confirmedLineup = lineup?.filter(s => s.species) ?? [];
                return (
                  <div key={f.id} className="rounded border border-poke-border/30 overflow-hidden">
                    <div className="flex items-center justify-between text-[9px] text-slate-500 px-1.5 py-0.5 bg-poke-surface/50 uppercase tracking-wider font-bold">
                      <span>
                        {f.type}
                        {f.metadata.confirmed === false && <span className="ml-1 text-amber-400">candidate</span>}
                      </span>
                      <span className="text-slate-600">{new Date(f.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <img src={f.dataUrl} alt={f.type} className="w-full h-auto" />
                    {(signals || confirmedLineup.length > 0) && (
                      <div className="px-1.5 py-1 text-[9px] text-slate-400 space-y-0.5 bg-black/30">
                        {signals && (
                          <div className="font-mono">
                            centerDark {signals.centerDark.toFixed(1)}% · badgeL {(signals.badgeRedLeft ?? signals.badgeRed).toFixed(1)}% · badgeR {signals.badgeRedRight?.toFixed(1) ?? '-'}%
                            {' · '}goldL {signals.goldLeft?.toFixed(1) ?? '-'}% · silverL {signals.silverLeft?.toFixed(1) ?? '-'}%
                            {' · '}goldR {signals.goldRight?.toFixed(1) ?? '-'}% · silverR {signals.silverRight.toFixed(1)}%
                          </div>
                        )}
                        {confirmedLineup.length > 0 && (
                          <div className="text-slate-500">
                            {confirmedLineup.length} slots locked
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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

// ─── Detection Trail (always-visible audit feed) ─────────────────

function DetectionTrailCard({
  frame,
  onDelete,
  onSave,
}: {
  frame: CachedFrame;
  onDelete?: (id: string) => void;
  onSave?: (frame: CachedFrame) => void;
}) {
  const isResult = frame.type === 'result-candidate' || frame.type === 'result';
  const tone = isResult
    ? (frame.metadata.matchResult === 'win' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5')
    : 'border-sky-500/30 bg-sky-500/5';
  const signals = frame.metadata.resultSignals;
  const lineup = frame.metadata.lineupSlots;
  const sel = frame.metadata.selectionFrame;
  const slotCrops = frame.metadata.slotCrops;
  const lockFrameMeta = frame.metadata.lockFrame;
  const lockConsensus = frame.metadata.lockConsensus ?? [];
  const lockMismatches = frame.metadata.lockSelectionMismatches ?? [];
  const playerLockPicks = frame.metadata.playerLockPicks ?? [];
  const playerLockBadgeWarnings = frame.metadata.playerLockBadgeWarnings ?? [];
  const playerLockBadgeVotes = frame.metadata.playerLockBadgeVotes;
  const locked = lineup?.filter(s => s.locked) ?? [];
  const unlocked = lineup?.filter(s => !s.locked) ?? [];
  const [showCrops, setShowCrops] = useState(false);
  const playerCrops = (slotCrops ?? []).filter(c => c.side === 'left').sort((a, b) => a.slotIndex - b.slotIndex);
  const opponentCrops = (slotCrops ?? []).filter(c => c.side === 'right').sort((a, b) => a.slotIndex - b.slotIndex);
  return (
    <div className={`rounded border overflow-hidden ${tone}`}>
      <div className="flex items-center justify-between gap-2 px-1.5 py-1 bg-black/30">
        <div className="text-[9px] font-bold uppercase tracking-wider min-w-0 truncate">
          <span className={isResult ? (frame.metadata.matchResult === 'win' ? 'text-emerald-400' : 'text-red-400') : 'text-sky-400'}>
            {frame.type}
          </span>
          {isResult && (
            <span className="ml-1 text-slate-400">
              {frame.metadata.matchResult}
              {frame.metadata.confirmed === false && <span className="ml-1 text-amber-400">(candidate)</span>}
              {frame.metadata.confirmed === true && <span className="ml-1 text-emerald-400">(confirmed)</span>}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-[9px] text-slate-500 font-mono">
            {new Date(frame.timestamp).toLocaleTimeString()}
          </div>
          {onSave && (
            <button
              onClick={() => onSave(frame)}
              className="text-slate-600 hover:text-sky-400 transition-colors p-0.5"
              title="Download PNG + metadata JSON"
              aria-label="Download snapshot"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(frame.id)}
              className="text-slate-600 hover:text-red-400 transition-colors p-0.5"
              title="Delete this snapshot"
              aria-label="Delete snapshot"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <img src={frame.dataUrl} alt={frame.type} className="w-full h-auto max-h-72 object-contain bg-black/40" />
      <div className="px-1.5 py-1 text-[9px] text-slate-400 space-y-0.5">
        {signals && (
          <>
            <div className="font-mono">
              centerDark <span className="text-slate-300">{signals.centerDark.toFixed(1)}%</span>
              {' · '}badgeL <span className="text-slate-300">{(signals.badgeRedLeft ?? signals.badgeRed).toFixed(1)}%</span>
              {' · '}badgeR <span className="text-slate-300">{signals.badgeRedRight?.toFixed(1) ?? '-'}%</span>
              {' · '}goldL <span className="text-slate-300">{signals.goldLeft?.toFixed(1) ?? '-'}%</span>
              {' · '}silverL <span className="text-slate-300">{signals.silverLeft?.toFixed(1) ?? '-'}%</span>
              {' · '}goldR <span className="text-slate-300">{signals.goldRight?.toFixed(1) ?? '-'}%</span>
              {' · '}silverR <span className="text-slate-300">{signals.silverRight.toFixed(1)}%</span>
            </div>
            {signals.decision && (
              <div className="font-mono text-[9px] text-slate-500 italic">{signals.decision}</div>
            )}
          </>
        )}
        {sel && frame.type === 'lineup-lock' && (
          <div className="font-mono">
            <span className={sel.isTeamSelect ? 'text-emerald-400' : 'text-amber-400'}>
              {sel.isTeamSelect ? 'team-select' : 'rejected'}
            </span>
            {' · '}conf <span className="text-slate-300">{sel.frameConfidence.toFixed(2)}</span>
            {' · '}opp <span className="text-slate-300">{sel.opponentCardCount}/6</span>
            {' · '}plr <span className="text-slate-300">{sel.playerCardCount}/6</span>
            {' · '}panels <span className="text-slate-300">{sel.panelCount}</span>
            {sel.triggerReason && <> {' · '}<span className="text-slate-500">{sel.triggerReason}</span></>}
          </div>
        )}
        {lineup && lineup.length > 0 && (
          <div className="space-y-1">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">
              Slots — locked {locked.length}/{lineup.length}
            </div>
            {locked.map(s => (
              <div key={`${frame.id}-${s.side}-${s.slotIndex}-lk`} className="flex justify-between gap-2 font-mono">
                <span className={s.side === 'left' ? 'text-sky-300' : 'text-red-300'}>
                  [LOCK] {s.side === 'left' ? 'plr' : 'opp'} #{s.slotIndex + 1} {s.species}
                </span>
                <span className="text-emerald-400">
                  {s.winnerVotes}/{s.framesObserved} ({Math.round(s.shareOfFrames * 100)}%)
                </span>
              </div>
            ))}
            {unlocked.length > 0 && (
              <div className="text-[9px] text-slate-600 uppercase tracking-wider pt-1">
                Unlocked — this-frame best guess
              </div>
            )}
            {unlocked.map(s => (
              <div key={`${frame.id}-${s.side}-${s.slotIndex}-ul`} className="flex justify-between gap-2 font-mono">
                <span className={s.side === 'left' ? 'text-sky-300/60' : 'text-red-300/60'}>
                  {s.side === 'left' ? 'plr' : 'opp'} #{s.slotIndex + 1}{' '}
                  {s.topCandidates && s.topCandidates.length > 0
                    ? s.topCandidates.map(c => `${c.species} ${Math.round(c.confidence * 100)}%`).join(' · ')
                    : (s.species ?? '—')}
                </span>
                <span className="text-slate-600">
                  {s.winnerVotes}/{s.framesObserved}
                </span>
              </div>
            ))}
          </div>
        )}
        {frame.type === 'lineup-lock' && (!lineup || lineup.length === 0) && (
          <div className="text-[9px] text-amber-400 italic">
            HSV detector returned no slot regions — frame rejected as non-selection.
            Check the raw image above: if it clearly shows the selection screen, the
            crimson/blue panels may be off-frame or clipped by your ROI crop.
          </div>
        )}
        {playerLockPicks.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="text-[9px] text-violet-400 font-bold uppercase tracking-wider">
              Player picks — badge slots
              <span className="ml-1 text-slate-500 font-normal">
                (authoritative: selection consensus × number badges
                {playerLockBadgeVotes && (
                  <>
                    {' · '}
                    {playerLockBadgeVotes.framesObserved} frames voted
                  </>
                )}
                )
              </span>
            </div>
            {playerLockPicks
              .slice()
              .sort((a, b) => a.slotIndex - b.slotIndex)
              .map(pick => {
                const votes = playerLockBadgeVotes?.votesPerSlot[pick.slotIndex];
                const frames = playerLockBadgeVotes?.framesObserved;
                return (
                  <div
                    key={`${frame.id}-badge-pick-${pick.slotIndex}`}
                    className="flex justify-between gap-2 font-mono"
                  >
                    <span className="text-violet-300">
                      [BADGE] plr #{pick.slotIndex + 1}{' '}
                      <span className={pick.species ? 'text-violet-200' : 'text-slate-500'}>
                        {pick.species ?? '(no selection consensus for this slot yet)'}
                      </span>
                      {pick.isShiny && <span className="ml-1 text-amber-300">✨</span>}
                    </span>
                    {votes !== undefined && frames !== undefined && (
                      <span className="text-violet-400/80">
                        {votes}/{frames}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        )}
        {(lockFrameMeta?.isLockScreen || lockConsensus.length > 0) && (
          <div className="space-y-1 pt-1">
            <div className="text-[9px] text-violet-400 font-bold uppercase tracking-wider">
              Lock screen — sprite-matcher picks
              {lockFrameMeta && (
                <span className="ml-1 text-slate-500 font-normal">
                  ({lockFrameMeta.framesObserved ?? 0} frames · conf {lockFrameMeta.frameConfidence.toFixed(2)})
                </span>
              )}
            </div>
            {lockConsensus.length === 0 && (
              <div className="text-[9px] text-slate-500 italic">
                No confident lock-screen consensus yet — need more frames.
              </div>
            )}
            {lockConsensus.map(lk => (
              <div key={`${frame.id}-lk-${lk.side}-${lk.slotIndex}`} className="flex justify-between gap-2 font-mono">
                <span className={lk.side === 'left' ? 'text-violet-300' : 'text-rose-300'}>
                  [LOCK] {lk.side === 'left' ? 'plr' : 'opp'} #{lk.slotIndex + 1}{' '}
                  {lk.species}{lk.isShiny && <span className="ml-1 text-amber-300">✨</span>}
                </span>
                <span className="text-violet-400">
                  {lk.winnerVotes}/{lk.framesObserved}
                </span>
              </div>
            ))}
          </div>
        )}
        {playerLockBadgeWarnings.length > 0 && (
          <div className="space-y-1 pt-1 mt-1 border-t border-amber-500/30">
            <div className="text-[9px] text-amber-300 font-bold uppercase tracking-wider">
              ⚠ Badge vs sprite disagreement ({playerLockBadgeWarnings.length})
            </div>
            <div className="text-[9px] text-slate-500 italic">
              The number badge says the player picked this slot, but the
              sprite matcher returned a different species for the same
              slot. Badge signal is authoritative; sprite row is for
              debugging matcher quality only.
            </div>
            {playerLockBadgeWarnings.map((w, i) => (
              <div
                key={`${frame.id}-badge-warn-${w.slotIndex}-${i}`}
                className="font-mono text-[10px]"
              >
                {w.slotIndex >= 0 ? (
                  <>
                    <span className="text-violet-300">plr #{w.slotIndex + 1}</span>
                    {' badge → '}
                    <span className="text-violet-200">
                      {w.badgeSpecies ?? '(no selection consensus)'}
                    </span>
                    {', sprite → '}
                    <span className="text-amber-300">
                      {w.spriteSpecies ?? '(no match)'}
                    </span>
                  </>
                ) : (
                  <span className="text-amber-300">{w.reason}</span>
                )}
              </div>
            ))}
          </div>
        )}
        {lockMismatches.length > 0 && (
          <div className="space-y-1 pt-1 mt-1 border-t border-amber-500/30">
            <div className="text-[9px] text-amber-300 font-bold uppercase tracking-wider">
              ⚠ Lock vs selection mismatch ({lockMismatches.length})
            </div>
            <div className="text-[9px] text-slate-500 italic">
              Lock screen shows a Pokémon that the selection consensus didn't include.
              One of the two pipelines mis-identified — review the crops below.
            </div>
            {lockMismatches.map((m, i) => (
              <div key={`${frame.id}-mm-${i}`} className="font-mono text-[10px]">
                <span className={m.side === 'left' ? 'text-violet-300' : 'text-rose-300'}>
                  {m.side === 'left' ? 'plr' : 'opp'} #{m.slotIndex + 1}
                </span>
                {' '}lock saw{' '}
                <span className="text-amber-300">
                  {m.lockSpecies}{m.isShiny && <span className="ml-0.5">✨</span>}
                </span>
                {', selection had: '}
                <span className="text-slate-400">{m.selectionPool.join(', ') || '(none)'}</span>
              </div>
            ))}
          </div>
        )}
        {slotCrops && slotCrops.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => setShowCrops(v => !v)}
              className="w-full flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-500 hover:text-sky-400 transition-colors"
            >
              <span>
                Sprite crops — manual alignment review ({slotCrops.length})
              </span>
              <svg className={`w-2.5 h-2.5 transition-transform ${showCrops ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showCrops && (
              <div className="mt-1.5 space-y-2">
                {playerCrops.length > 0 && (
                  <div>
                    <div className="text-[9px] text-sky-400 font-bold uppercase tracking-wider mb-1">
                      ◄ Yours (player panel)
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {playerCrops.map(c => (
                        <SlotCropTile key={`${frame.id}-pl-${c.slotIndex}`} crop={c} accent="sky" />
                      ))}
                    </div>
                  </div>
                )}
                {opponentCrops.length > 0 && (
                  <div>
                    <div className="text-[9px] text-red-400 font-bold uppercase tracking-wider mb-1">
                      Opponent panel ►
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {opponentCrops.map(c => (
                        <SlotCropTile key={`${frame.id}-op-${c.slotIndex}`} crop={c} accent="red" />
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-[9px] text-slate-500 italic leading-tight">
                  Each tile is the EXACT pixel region the matcher fed into the
                  feature extractor. If a chibi is off-center, clipped, or
                  shows UI chrome (header / item bar / gender icon), the
                  card-row or sprite-bbox heuristics need adjustment.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SlotCropTile({
  crop,
  accent,
}: {
  crop: NonNullable<CachedFrame['metadata']['slotCrops']>[number];
  accent: 'sky' | 'red';
}) {
  const top = crop.topCandidates?.[0];
  const second = crop.topCandidates?.[1];
  const isLocked = !!crop.lockedSpecies;
  const accentBorder = accent === 'sky' ? 'border-sky-500/40' : 'border-red-500/40';
  const labelColor = isLocked
    ? 'text-emerald-300'
    : top
      ? 'text-amber-300'
      : 'text-slate-500';
  return (
    <div className={`rounded border ${accentBorder} bg-black/40 overflow-hidden`}>
      <div className="text-[8px] text-slate-400 px-1 py-0.5 bg-black/40 font-mono flex justify-between">
        <span>#{crop.slotIndex + 1}</span>
        <span className="font-mono text-slate-500">
          {crop.sprite.w}×{crop.sprite.h}
        </span>
      </div>
      <img
        src={crop.cropDataUrl}
        alt={`slot ${crop.slotIndex + 1} crop`}
        className="w-full h-auto block bg-slate-900"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="px-1 py-0.5 text-[8px] font-mono leading-tight">
        <div className={`truncate ${labelColor}`} title={crop.lockedSpecies ?? top?.species ?? 'no match'}>
          {isLocked ? '🔒 ' : ''}
          {(isLocked ? crop.lockedIsShiny : top?.isShiny) ? '✨ ' : ''}
          {crop.lockedSpecies ?? top?.species ?? 'no match'}
          {top && (
            <span className="ml-1 text-slate-500">
              {Math.round(top.confidence * 100)}%
            </span>
          )}
        </div>
        {second && (
          <div className="text-slate-600 truncate" title={second.species}>
            vs {second.isShiny ? '✨' : ''}{second.species} {Math.round(second.confidence * 100)}%
          </div>
        )}
      </div>
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

const TEAM_LOCK_CONFIDENCE = 0.4;
// Matches the matcher's `isConfident` floor (see spriteDetector/matcher.ts).
// Live 3D-rendered selection cards scored against 2D menu reference sprites
// top out around ~0.28; values above 0.22 + a non-trivial runner-up margin
// are trustworthy, so we lock on that band rather than the (now obsolete)
// 72% OCR-era threshold.
const SELECTION_SLOT_LOCK_CONFIDENCE = 0.22;
const MIN_SELECTION_CONFIRMATION_FRAMES = 2;
/** Safety net if OCR/WASM still stalls (monitor mode uses a reduced OCR path) */
const SCAN_DETECT_TIMEOUT_MS = 40000;

type PreviewSlotStability = {
  lastSeen: Array<string | null>;
  streaks: number[];
  locked: Array<string | null>;
};

const createPreviewSlotStability = (): PreviewSlotStability => ({
  lastSeen: Array.from({ length: 6 }, () => null),
  streaks: Array.from({ length: 6 }, () => 0),
  locked: Array.from({ length: 6 }, () => null),
});

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const cloneCanvas = (source: HTMLCanvasElement): HTMLCanvasElement => {
  const clone = document.createElement('canvas');
  clone.width = source.width;
  clone.height = source.height;
  clone.getContext('2d')!.drawImage(source, 0, 0);
  return clone;
};

/**
 * Stack a transparent debug-overlay canvas on top of the raw captured
 * frame and return a new canvas. Used to persist an audit snapshot —
 * the saved image shows exactly which HSV regions / sprite bounds were
 * evaluated during detection, so false positives can be diagnosed
 * offline. The output is roughly half-resolution to keep IndexedDB
 * storage manageable.
 */
const composeAuditSnapshot = (
  raw: HTMLCanvasElement,
  overlay: HTMLCanvasElement,
  maxWidth = 1600,
): HTMLCanvasElement => {
  const scale = raw.width > maxWidth ? maxWidth / raw.width : 1;
  const out = document.createElement('canvas');
  out.width = Math.round(raw.width * scale);
  out.height = Math.round(raw.height * scale);
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(raw, 0, 0, out.width, out.height);
  // Overlay is sized to raw frame; scale same factor.
  ctx.drawImage(overlay, 0, 0, out.width, out.height);
  return out;
};

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

  // Auto-detection (OCR)
  const [detecting, setDetecting] = useState(false);
  const [, setOcrReady] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [lastOcrResult, setLastOcrResult] = useState<OcrDetectionResult | null>(null);
  const [lastScanError, setLastScanError] = useState<string | null>(null);
  const [lastFrameUrl, setLastFrameUrl] = useState<string | null>(null);
  // Raw (uncropped) frame — used for region selection so user can pick from full screen
  const [lastRawFrameUrl, setLastRawFrameUrl] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const showDebugRef = useRef(false);
  useEffect(() => {
    showDebugRef.current = showDebug;
  }, [showDebug]);
  /** Fullscreen modal to compare raw capture vs analysis crop vs debug overlay (black bars / ROI alignment). */
  const [captureReviewOpen, setCaptureReviewOpen] = useState(false);
  const [captureReviewZoom, setCaptureReviewZoom] = useState(100);
  const captureReviewOpenRef = useRef(false);
  useEffect(() => {
    captureReviewOpenRef.current = captureReviewOpen;
  }, [captureReviewOpen]);
  /** Mirrors whether we have stored a raw-frame snapshot — avoids putting `lastRawFrameUrl` in `runScan` deps (would restart the scan loop mid-OCR). */
  const rawFramePrimedRef = useRef(false);
  /** One scan at a time: Tesseract has a single worker — overlapping monitor + preview runs queue and scan time grows without bound. */
  const scanInFlightRef = useRef(false);
  const [lastAnalysisCropUrl, setLastAnalysisCropUrl] = useState<string | null>(null);
  const [lastRawFrameDimensions, setLastRawFrameDimensions] = useState<{ w: number; h: number } | null>(null);
  const [lastAnalysisCropDimensions, setLastAnalysisCropDimensions] = useState<{ w: number; h: number } | null>(null);
  /** Last successful frame grab size — confirms pipeline is not stuck before OCR */
  const [scanFrameInfo, setScanFrameInfo] = useState<string | null>(null);
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
  const [lastAnalysisRegion, setLastAnalysisRegion] = useState<{
    source: 'manual' | 'auto' | 'full';
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [regionSelecting, setRegionSelecting] = useState(false);
  const [regionDragStart, setRegionDragStart] = useState<{ x: number; y: number } | null>(null);
  const [regionDragEnd, setRegionDragEnd] = useState<{ x: number; y: number } | null>(null);

  // Persist region
  useEffect(() => {
    if (captureRegion) localStorage.setItem('stream-companion-region', JSON.stringify(captureRegion));
    else localStorage.removeItem('stream-companion-region');
  }, [captureRegion]);

  useEffect(() => {
    if (!captureReviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCaptureReviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [captureReviewOpen]);

  // Live video element ref for smooth game window rendering
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const bindLiveVideo = useCallback((el: HTMLVideoElement | null) => {
    liveVideoRef.current = el;
    setCaptureGrabVideoElement(el);
  }, []);
  // Active battlers (during battle)
  const [activeYour, setActiveYour] = useState<string | null>(null);
  const [activeOpp, setActiveOpp] = useState<string | null>(null);
  const [selectedBring, setSelectedBring] = useState<string[]>([]);
  // Match ID for keyframe tagging
  const currentMatchIdRef = useRef<string>('');
  const pendingAutoResultRef = useRef<{ result: 'win' | 'loss'; seenCount: number } | null>(null);
  const previewFrameIdRef = useRef<string>('');
  const previewSelectionRef = useRef<{
    count: number | null;
    hoveredRowIndex: number | null;
    target: number | null;
    seenFrames: number;
  }>({ count: null, hoveredRowIndex: null, target: null, seenFrames: 0 });
  const opponentPreviewSlotsRef = useRef<PreviewSlotStability>(createPreviewSlotStability());
  const previewProcessingRef = useRef<{
    inFlight: boolean;
    lastQueuedKey: string;
    lastCompletedKey: string;
    lastProcessedAt: number;
  }>({ inFlight: false, lastQueuedKey: '', lastCompletedKey: '', lastProcessedAt: 0 });
  // Detection-audit dedupe. We save at most one snapshot per (result,
  // outcome-streak) and per (lineup lock signature) so IndexedDB doesn't
  // bloat with near-duplicate scans. The audit snapshots stay across
  // matches so you can scroll back through historical false positives.
  const lastResultCandidateSaveRef = useRef<{ outcome: string; timestamp: number }>({ outcome: '', timestamp: 0 });
  const lastResultCandidateIdRef = useRef<string | null>(null);
  const lastResultCandidateHadAnnotationRef = useRef<boolean>(false);
  const lastLineupLockSigRef = useRef<string>('');
  const lastLineupHeartbeatRef = useRef<number>(0);
  const lastLineupSaveIdRef = useRef<string | null>(null);
  const lastLineupSaveHadAnnotationRef = useRef<boolean>(false);
  /**
   * Per-match badge-vote accumulator for lock-screen number badges.
   *  - `votes[slotIndex]` counts how many lock frames in the current
   *    match saw a badge at that slot.
   *  - `frames` is the total lock-frame count (denominator for
   *    majority voting).
   *  - Reset on match close / new match.
   *
   * A single lock frame can mis-detect a badge under dim lighting or
   * mid-animation (e.g. the badge is fading in and hasn't crossed the
   * 0.12 white-ratio threshold yet). Majority voting across all lock
   * frames in the match smooths this out — a slot is considered
   * "badge-on" if ≥50% of lock frames saw it. */
  const lockBadgeVotesRef = useRef<{ votes: number[]; frames: number }>({
    votes: [0, 0, 0, 0, 0, 0],
    frames: 0,
  });
  const [detectionTrail, setDetectionTrail] = useState<CachedFrame[]>([]);
  // Cache stats
  const [cacheStats, setCacheStats] = useState<{ frames: number; bytes: number }>({ frames: 0, bytes: 0 });
  // Default to 'detected' so live screen capture automatically populates
  // the user's team. Switches to 'manual' when the user types/edits
  // species themselves, or when a persisted team is restored from
  // localStorage (see restore effect below).
  const myTeamSourceRef = useRef<'manual' | 'detected'>('detected');
  const suppressDetectedMyTeamRef = useRef(false);
  const [detectedMyTeamSnapshot, setDetectedMyTeamSnapshot] = useState<string[]>(
    () => loadStoredSpeciesList(DETECTED_MY_TEAM_KEY),
  );
  const [detectedOpponentSnapshot, setDetectedOpponentSnapshot] = useState<string[]>(
    () => loadStoredSpeciesList(DETECTED_OPPONENT_TEAM_KEY),
  );

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
          if (payload.opponentTeam !== undefined) setOpponentTeam(payload.opponentTeam);
          if (payload.detectedMyTeamSnapshot !== undefined) setDetectedMyTeamSnapshot(payload.detectedMyTeamSnapshot);
          if (payload.detectedOpponentSnapshot !== undefined) setDetectedOpponentSnapshot(payload.detectedOpponentSnapshot);
          if (payload.history !== undefined) setHistory(payload.history);
          if (payload.lastResult !== undefined) setLastResult(payload.lastResult);
          if (payload.matchStartTime !== undefined) setMatchStartTime(payload.matchStartTime);
          if (payload.activeYour !== undefined) setActiveYour(payload.activeYour);
          if (payload.activeOpp !== undefined) setActiveOpp(payload.activeOpp);
          if (payload.selectedBring !== undefined) setSelectedBring(payload.selectedBring);
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
              detectedMyTeamSnapshot,
              detectedOpponentSnapshot,
              history,
              lastResult,
              matchStartTime,
              activeYour,
              activeOpp,
              selectedBring,
            },
          });
        }
      };
    }
    return () => channel.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOverlayWindow, opponentTeam, detectedMyTeamSnapshot, detectedOpponentSnapshot, history, lastResult, matchStartTime, activeYour, activeOpp, selectedBring]);

  // Host: broadcast state changes to pop-out windows
  useEffect(() => {
    if (isOverlayWindow || !broadcastRef.current) return;
    broadcastRef.current.postMessage({
      type: 'state',
      payload: {
        opponentTeam,
        detectedMyTeamSnapshot,
        detectedOpponentSnapshot,
        history,
        lastResult,
        matchStartTime,
        activeYour,
        activeOpp,
        selectedBring,
      },
    });
  }, [opponentTeam, detectedMyTeamSnapshot, detectedOpponentSnapshot, history, lastResult, matchStartTime, activeYour, activeOpp, selectedBring, isOverlayWindow]);

  // Persist history
  useEffect(() => { saveHistory(history); }, [history]);

  // Refresh cache stats when history or detection changes
  useEffect(() => {
    listAllFrames().then(frames => {
      let bytes = 0;
      for (const f of frames) bytes += f.dataUrl.length * 0.75;
      setCacheStats({ frames: frames.length, bytes: Math.round(bytes) });
      // Keep a live view of the most recent detection-audit frames so
      // the debug panel shows them without waiting for a manual reload.
      // Cap by both time (last 2h) and count (20) so IndexedDB history
      // from prior sessions doesn't overwhelm the panel.
      const recentCutoff = Date.now() - 2 * 60 * 60 * 1000;
      const trail = frames
        .filter(f => (f.type === 'result-candidate' || f.type === 'lineup-lock') && f.timestamp >= recentCutoff)
        .slice(0, 20);
      setDetectionTrail(trail);
    }).catch(() => {});
  }, [history, scanCount]);

  // Track whether we've restored from localStorage to avoid the persist
  // effect from overwriting saved data on initial mount.
  const restoredRef = useRef(false);

  const applyTeamFromSpecies = useCallback((
    speciesList: string[],
    source: 'manual' | 'detected',
  ) => {
    const newTeam: PokemonState[] = Array.from({ length: 6 }, (_, i) => {
      const species = speciesList[i];
      if (!species) return createDefaultPokemonState();
      const { build } = resolveBuildWithSource(species);
      return build;
    });
    myTeamSourceRef.current = source;
    setContextTeam(newTeam);
  }, [setContextTeam]);

  // Restore user's team from localStorage on mount
  useEffect(() => {
    if (restoredRef.current) return;
    const filled = contextTeam.filter(t => t.species);
    if (filled.length > 0) { restoredRef.current = true; return; }
    try {
      const saved = localStorage.getItem(MY_TEAM_KEY);
      if (!saved) { restoredRef.current = true; return; }
      const species: string[] = JSON.parse(saved);
      const validSpecies = species.filter(Boolean);
      if (validSpecies.length === 0) { restoredRef.current = true; return; }
      applyTeamFromSpecies(validSpecies, 'manual');
      restoredRef.current = true;
    } catch { restoredRef.current = true; }
  }, [applyTeamFromSpecies, contextTeam]);

  // Persist user's team to localStorage — but only for manual teams.
  useEffect(() => {
    if (!restoredRef.current || myTeamSourceRef.current !== 'manual') return;
    const filled = contextTeam.filter(t => t.species).map(t => t.species);
    localStorage.setItem(MY_TEAM_KEY, JSON.stringify(filled));
  }, [contextTeam]);

  useEffect(() => {
    localStorage.setItem(DETECTED_MY_TEAM_KEY, JSON.stringify(detectedMyTeamSnapshot));
  }, [detectedMyTeamSnapshot]);

  useEffect(() => {
    localStorage.setItem(DETECTED_OPPONENT_TEAM_KEY, JSON.stringify(detectedOpponentSnapshot));
  }, [detectedOpponentSnapshot]);

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

  useEffect(() => {
    if (myTeamSourceRef.current === 'detected' && filledMyTeam.length > 0) {
      setDetectedMyTeamSnapshot(filledMyTeam);
    }
  }, [filledMyTeam]);

  useEffect(() => {
    if (filledOpponents.length > 0) {
      setDetectedOpponentSnapshot(filledOpponents);
    }
  }, [filledOpponents]);

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
      bringOrder: selectedBring.length > 0
        ? [...selectedBring]
        : orderedBringList.slice(0, 4).map(b => b.species),
    };
    setHistory(prev => [record, ...prev]);
    setLastResult(result);
    setOpponentTeam([]);
    setGamePhase('idle');
    setMatchStartTime(null);
    setMatchElapsed(0);

    // Cooldown: ignore detections briefly after recording.
    // Keep this short enough that quick rematches still get scanned.
    cooldownUntilRef.current = Date.now() + 5000;
    pendingAutoResultRef.current = null;
    // Clear dismissed list for fresh game
    setDismissedSpecies(new Set());
    // Reset phase machine — ready for next match's team preview

    currentMatchIdRef.current = '';
    previewFrameIdRef.current = '';
    previewSelectionRef.current = { count: null, hoveredRowIndex: null, target: null, seenFrames: 0 };
    opponentPreviewSlotsRef.current = createPreviewSlotStability();
    previewProcessingRef.current = { inFlight: false, lastQueuedKey: '', lastCompletedKey: '', lastProcessedAt: 0 };
    lastLineupLockSigRef.current = '';
    lastLineupSaveIdRef.current = null;
    lastLineupSaveHadAnnotationRef.current = false;
    lockBadgeVotesRef.current = { votes: [0, 0, 0, 0, 0, 0], frames: 0 };
    lastResultCandidateSaveRef.current = { outcome: '', timestamp: 0 };
    lastResultCandidateIdRef.current = null;
    lastResultCandidateHadAnnotationRef.current = false;
    setLastScanError(null);
    setActiveYour(null);
    setActiveOpp(null);
    setSelectedBring([]);

    setTimeout(() => setLastResult(null), 3000);
  }, [filledOpponents, filledMyTeam, archetypes, matchStartTime, orderedBringList, selectedBring]);

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

  // Full session reset — clears EVERYTHING for starting fresh.
  //
  // Must clear both in-memory React state AND every persistent store
  // (localStorage keys, IndexedDB frame cache, consensus analyzers)
  // otherwise the lineup silently rehydrates on the next page load:
  //   • `MY_TEAM_KEY` only gets overwritten when `myTeamSourceRef.current
  //     === 'manual'`, so simply zero-ing React state leaves stale
  //     entries behind — the restore effect then re-applies them on
  //     mount.
  //   • The IndexedDB lineup-lock / result-candidate entries drive the
  //     Detection Trail, which otherwise reads back the last two hours
  //     of previous-session audits after every refresh.
  const resetSession = useCallback(() => {
    setOpponentTeam([]);
    setContextTeam(Array.from({ length: 6 }, () => createDefaultPokemonState()));
    myTeamSourceRef.current = 'detected';
    suppressDetectedMyTeamRef.current = false;
    setDetectedMyTeamSnapshot([]);
    setDetectedOpponentSnapshot([]);
    setHistory([]);
    setGamePhase('idle');
    setMatchStartTime(null);
    setMatchElapsed(0);
    setLastResult(null);
    setLastOcrResult(null);
    setLastFrameUrl(null);
    setLastAnalysisRegion(null);
    setScanCount(0);
    pendingAutoResultRef.current = null;
    setDismissedSpecies(new Set());
    setSelectedBring([]);
    setActiveYour(null);
    setActiveOpp(null);
    previewSelectionRef.current = { count: null, hoveredRowIndex: null, target: null, seenFrames: 0 };
    opponentPreviewSlotsRef.current = createPreviewSlotStability();
    previewProcessingRef.current = { inFlight: false, lastQueuedKey: '', lastCompletedKey: '', lastProcessedAt: 0 };
    lockBadgeVotesRef.current = { votes: [0, 0, 0, 0, 0, 0], frames: 0 };
    lastLineupLockSigRef.current = '';
    lastLineupHeartbeatRef.current = 0;
    lastLineupSaveIdRef.current = null;
    lastLineupSaveHadAnnotationRef.current = false;
    lastResultCandidateSaveRef.current = { outcome: '', timestamp: 0 };
    lastResultCandidateIdRef.current = null;
    lastResultCandidateHadAnnotationRef.current = false;
    currentMatchIdRef.current = '';
    resetLineupAnalyzer();
    resetLockAnalyzer();
    cooldownUntilRef.current = 0;

    setCaptureRegion(null);
    saveHistory([]);

    try {
      localStorage.removeItem(MY_TEAM_KEY);
      localStorage.removeItem(DETECTED_MY_TEAM_KEY);
      localStorage.removeItem(DETECTED_OPPONENT_TEAM_KEY);
    } catch {
      // Ignore storage failures; in-memory state is already cleared.
    }

    setDetectionTrail([]);
    setCacheStats({ frames: 0, bytes: 0 });
    clearAllFrames().catch(e => console.warn('[cache] clearAllFrames failed during reset', e));
  }, [setContextTeam]);

  const handleExportArchive = useCallback(async () => {
    const bundle = await exportArchive(history);
    downloadArchive(bundle, `champions-archive-${new Date().toISOString().slice(0, 10)}.json`);
  }, [history]);

  const handleClearCache = useCallback(async () => {
    if (!confirm(`Clear ${cacheStats.frames} cached frames (${Math.round(cacheStats.bytes / 1024)} KB)? History is preserved.`)) return;
    await clearAllFrames();
    setCacheStats({ frames: 0, bytes: 0 });
    setDetectionTrail([]);
  }, [cacheStats]);

  // Delete a single detection-trail snapshot. We update local state
  // immediately for responsiveness, then the IndexedDB delete runs in
  // the background. If it fails we reconcile by refreshing from disk.
  const handleDeleteTrailFrame = useCallback(async (id: string) => {
    setDetectionTrail(prev => prev.filter(f => f.id !== id));
    try {
      await deleteFrame(id);
    } catch (e) {
      console.warn('[cache] deleteFrame failed, refreshing trail', e);
      const frames = await listAllFrames();
      const recentCutoff = Date.now() - 2 * 60 * 60 * 1000;
      setDetectionTrail(
        frames
          .filter(f => (f.type === 'result-candidate' || f.type === 'lineup-lock') && f.timestamp >= recentCutoff)
          .slice(0, 20),
      );
    }
  }, []);

  // Download a single trail snapshot as a ZIP-less bundle — one PNG
  // (the annotated screenshot) and one .json sidecar (all metadata
  // the dispatcher wrote into the cache). Written as individual
  // files so the user can drag either into a bug report without
  // needing a ZIP extractor.
  const handleSaveTrailFrame = useCallback((frame: CachedFrame) => {
    const stamp = new Date(frame.timestamp).toISOString().replace(/[:.]/g, '-');
    const base = `detection-trail-${frame.type}-${stamp}`;

    // 1) Save the PNG.
    const pngLink = document.createElement('a');
    pngLink.href = frame.dataUrl;
    pngLink.download = `${base}.png`;
    document.body.appendChild(pngLink);
    pngLink.click();
    pngLink.remove();

    // 2) Save metadata sidecar.
    const sidecar = {
      id: frame.id,
      matchId: frame.matchId,
      type: frame.type,
      timestamp: frame.timestamp,
      timestampISO: new Date(frame.timestamp).toISOString(),
      metadata: frame.metadata,
    };
    const blob = new Blob([JSON.stringify(sidecar, null, 2)], {
      type: 'application/json',
    });
    const jsonUrl = URL.createObjectURL(blob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `${base}.json`;
    document.body.appendChild(jsonLink);
    jsonLink.click();
    jsonLink.remove();
    setTimeout(() => URL.revokeObjectURL(jsonUrl), 2000);
  }, []);

  // Export the whole trail as a single JSON bundle — images are
  // base64-embedded inline so the bundle is self-contained. Useful
  // for round-tripping a diagnostic session to the assistant for
  // offline analysis.
  const handleExportDetectionTrail = useCallback(() => {
    if (detectionTrail.length === 0) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const bundle = {
      exportedAt: new Date().toISOString(),
      frameCount: detectionTrail.length,
      // Sorted oldest-first so scrolling the JSON reads like a timeline.
      frames: [...detectionTrail]
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(f => ({
          id: f.id,
          matchId: f.matchId,
          type: f.type,
          timestamp: f.timestamp,
          timestampISO: new Date(f.timestamp).toISOString(),
          metadata: f.metadata,
          dataUrl: f.dataUrl,
        })),
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `detection-trail-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, [detectionTrail]);

  // Wipe just the audit-trail types (lineup-lock + result-candidate),
  // leaving preview/result frames tied to completed matches alone so
  // Match History replay still works.
  const handleClearDetectionTrail = useCallback(async () => {
    if (!confirm(`Clear ${detectionTrail.length} audit snapshots from the Detection Trail? Match History replay frames are preserved.`)) return;
    const ids = detectionTrail.map(f => f.id);
    setDetectionTrail([]);
    await Promise.allSettled(ids.map(id => deleteFrame(id)));
  }, [detectionTrail]);

  // ─── Audit-save dispatchers (called from the scan loop) ──────────
  //
  // Wrapped in refs so the scan loop can invoke the latest version
  // without needing to re-create `runScan` every render. Each call
  // rate-limits + dedupes per-type and writes to IndexedDB.
  //
  // Upgrade protocol: the scan loop calls each dispatcher TWICE per
  // scan — once with just the raw frame (before any early return)
  // and once with the annotated overlay (after the full draw). The
  // first call writes an entry; the second call with annotation
  // OVERWRITES the same entry with a richer snapshot. This way the
  // trail always has an entry even when downstream pipeline short-
  // circuits, but gets the nicer visualization when it doesn't.
  const dispatchLineupAuditSave = useCallback((
    result: OcrDetectionResult,
    rawFrame: HTMLCanvasElement,
    annotatedOverlay?: HTMLCanvasElement | null,
    slotCrops?: Array<{
      slotIndex: number;
      side: 'left' | 'right';
      card: { x: number; y: number; w: number; h: number };
      sprite: { x: number; y: number; w: number; h: number };
      cropDataUrl: string;
      topCandidates?: Array<{ species: string; confidence: number; isShiny?: boolean }>;
      lockedSpecies?: string | null;
      lockedIsShiny?: boolean;
    }>,
  ) => {
    try {
      const consensusForLock = getLineupConsensus();
      const confirmed = consensusForLock.slots
        .filter(s => s.assignedSpecies && (s.assignedConfidence ?? 0) >= SELECTION_SLOT_LOCK_CONFIDENCE)
        .sort((a, b) => (a.side === b.side ? a.slotIndex - b.slotIndex : a.side === 'left' ? -1 : 1));
      const sig = confirmed.map(s => `${s.side}:${s.slotIndex}:${s.assignedSpecies}`).join('|');
      const now = Date.now();
      // Fire on ANY of:
      //  - a new set of confirmed species just locked (sig changed)
      //  - HSV detector flagged this frame as a selection OR lock screen
      // Gate per-trigger by a 6s heartbeat so we don't flood IndexedDB.
      //
      // We deliberately do NOT trigger on `selectionUiDetected` (the OCR
      // fallback) or on partial HSV signals. The OCR heuristic fires on
      // tokens like "pokemon" / "battle" / "select" / "send" which all
      // appear in the in-battle bottom menu and stream overlays, so
      // trusting it outside of a visual confirmation was producing a
      // steady drip of "lineup-lock" audit saves during actual combat.
      // The partial-HSV branches were also dead: the frame detector only
      // populates `panelCount` / `cardCount` once it commits to a lineup
      // mode, so these conditions would never fire independently of
      // `isTeamSelect` / `isLockScreen` anyway.
      const selectionLike =
        result.selectionFrame.isTeamSelect || result.lockFrame.isLockScreen;
      const sigChanged = confirmed.length >= 1 && sig !== lastLineupLockSigRef.current;
      const heartbeatDue = selectionLike && now - lastLineupHeartbeatRef.current > 6000;
      // Annotation-upgrade: if we previously wrote a raw entry for the
      // current heartbeat window, allow a second write to overwrite
      // it with the richer annotated version.
      const canUpgrade =
        !!annotatedOverlay &&
        !lastLineupSaveHadAnnotationRef.current &&
        lastLineupSaveIdRef.current &&
        now - lastLineupHeartbeatRef.current < 5000;
      if (!sigChanged && !heartbeatDue && !canUpgrade) return;

      let saveId: string;
      let saveTs: number;
      if (canUpgrade && !sigChanged && !heartbeatDue) {
        saveId = lastLineupSaveIdRef.current!;
        saveTs = lastLineupHeartbeatRef.current;
      } else {
        lastLineupLockSigRef.current = sig;
        lastLineupHeartbeatRef.current = now;
        saveTs = now;
        const matchId = currentMatchIdRef.current || `scan-${now}`;
        saveId = `${matchId}-lineup-${now}`;
        lastLineupSaveIdRef.current = saveId;
      }
      lastLineupSaveHadAnnotationRef.current = !!annotatedOverlay;
      const matchId = currentMatchIdRef.current || `scan-${saveTs}`;
      const audit = annotatedOverlay
        ? composeAuditSnapshot(rawFrame, annotatedOverlay)
        : rawFrame;
      const slotRows = consensusForLock.slots.map(s => {
        const frameTop = s.candidates[0] ?? null;
        return {
          slotIndex: s.slotIndex,
          side: s.side,
          species: s.assignedSpecies ?? frameTop?.species ?? null,
          winnerVotes: s.winnerVotes,
          framesObserved: s.framesObserved,
          shareOfFrames: s.framesObserved > 0 ? s.winnerVotes / s.framesObserved : 0,
          topCandidates: s.candidates.slice(0, 3).map(c => ({
            species: c.species,
            confidence: c.confidence,
          })),
          locked: !!s.assignedSpecies && (s.assignedConfidence ?? 0) >= SELECTION_SLOT_LOCK_CONFIDENCE,
        };
      });

      // ── Lock vs selection cross-reference ─────────────────────────
      // The user's intent: "figure out which selections were made. It
      // should be able to detect any errors made if there are not
      // locked matches." We capture parallel consensus from the LOCK
      // analyzer and surface every species that appears confidently in
      // the lock but is NOT present in the selection pool. Such a
      // mismatch usually means one of the two pipelines mis-identified
      // a chibi — the audit trail entry can be reviewed manually.
      const lockConsensusForXref = getLockConsensus();
      const lockConfirmed = lockConsensusForXref.slots
        .filter(s => s.isConfident && s.assignedSpecies)
        .map(s => ({
          slotIndex: s.slotIndex,
          side: s.side as 'left' | 'right',
          species: s.assignedSpecies as string,
          isShiny: s.isShinyConsensus,
          winnerVotes: s.winnerVotes,
          framesObserved: s.framesObserved,
        }));
      // Build the "available pool" from the selection consensus
      // (winners only; runner-ups are too noisy to count as a real
      // selection-screen presence).
      const selectionPoolBySide: Record<'left' | 'right', Set<string>> = {
        left: new Set(),
        right: new Set(),
      };
      for (const s of consensusForLock.slots) {
        if (s.assignedSpecies) selectionPoolBySide[s.side].add(s.assignedSpecies);
      }
      const lockSelectionMismatches = lockConfirmed
        .filter(lk => {
          const pool = selectionPoolBySide[lk.side];
          // A mismatch is meaningful only if the corresponding
          // selection panel ALSO had a confident lock for that side
          // (otherwise we just don't have the evidence yet).
          return pool.size > 0 && !pool.has(lk.species);
        })
        .map(lk => ({
          side: lk.side,
          slotIndex: lk.slotIndex,
          lockSpecies: lk.species,
          isShiny: lk.isShiny,
          /** What the selection consensus thought was on the player's
           *  team — surfaces in the UI as "expected one of: X, Y, Z". */
          selectionPool: [...selectionPoolBySide[lk.side]],
        }));

      // ── Badge-derived player picks ────────────────────────────────
      // The player-side 3D chibi matches poorly against 2D menu icons,
      // so we derive picks from the number badges instead: badge slot
      // N on the player panel → species at slot N in the selection
      // consensus. This is authoritative (independent of sprite
      // matching) and mirrors how a human reads the lock screen. The
      // shiny flag comes from the selection consensus too — the
      // sprite matcher's shiny vote on lock-screen chibis is unreliable
      // (3D renders don't reproduce the menu-sprite shiny palette).
      const selectionByPlayerSlot = new Map<
        number,
        { species: string | null; isShiny: boolean }
      >();
      for (const s of consensusForLock.slots) {
        if (s.side !== 'left') continue;
        const locked = (s.assignedConfidence ?? 0) >= SELECTION_SLOT_LOCK_CONFIDENCE;
        selectionByPlayerSlot.set(s.slotIndex, {
          species: locked ? s.assignedSpecies : null,
          isShiny: locked ? s.isShinyConsensus : false,
        });
      }
      // Prefer the per-match majority-vote badge set once we have ≥2
      // lock frames — single-frame detections can jitter. Below that
      // threshold fall back to this frame's raw slots.
      const badgeAcc = lockBadgeVotesRef.current;
      const consensusBadgeSlots: number[] = [];
      if (badgeAcc.frames >= 2) {
        const needed = Math.ceil(badgeAcc.frames / 2);
        for (let i = 0; i < badgeAcc.votes.length; i++) {
          if (badgeAcc.votes[i] >= needed) consensusBadgeSlots.push(i);
        }
      }
      const effectiveBadgeSlots =
        consensusBadgeSlots.length > 0
          ? consensusBadgeSlots
          : (result.playerLockBadgeSlots ?? []);
      const playerLockPicks = effectiveBadgeSlots.map(slotIndex => {
        const sel = selectionByPlayerSlot.get(slotIndex);
        return {
          slotIndex,
          species: sel?.species ?? null,
          isShiny: sel?.isShiny ?? false,
        };
      });

      // Badge vs sprite-matcher disagreement warnings. For each slot
      // that showed a badge, compare to whatever the sprite matcher
      // returned for the same player slot on this frame (its top
      // candidate). If they disagree, surface it. We don't use the
      // lock analyzer's consensus here because we intentionally stop
      // feeding player-side votes into it — the per-frame top is the
      // strongest sprite signal we have for the player side. Silent
      // when the sprite matcher had no top candidate.
      const spriteTopByPlayerSlot = new Map<number, string | null>();
      for (const slot of result.lockSlots) {
        if (slot.side !== 'left') continue;
        spriteTopByPlayerSlot.set(
          slot.slotIndex,
          slot.candidates[0]?.species ?? null,
        );
      }
      const playerLockBadgeWarnings: Array<{
        slotIndex: number;
        badgeSpecies: string | null;
        spriteSpecies: string | null;
        reason: string;
      }> = [];
      for (const pick of playerLockPicks) {
        const spriteSpecies = spriteTopByPlayerSlot.get(pick.slotIndex) ?? null;
        if (!pick.species && !spriteSpecies) continue;
        if (!pick.species) {
          playerLockBadgeWarnings.push({
            slotIndex: pick.slotIndex,
            badgeSpecies: null,
            spriteSpecies,
            reason: 'badge saw a pick but selection consensus has no species for this slot',
          });
          continue;
        }
        if (spriteSpecies && spriteSpecies !== pick.species) {
          playerLockBadgeWarnings.push({
            slotIndex: pick.slotIndex,
            badgeSpecies: pick.species,
            spriteSpecies,
            reason: 'badge-derived species disagrees with sprite matcher top pick for this slot',
          });
        }
      }
      // Badge-count sanity check: a true Champions lock screen always
      // shows exactly 3 selected slots (the trio sent into battle). A
      // transient 2-badge count is normal during the
      // "first → second → third pick" selection animation. Anything
      // else (1 or 4+) points at a segmentation issue — the badge
      // threshold caught stadium highlight noise, or a real badge was
      // missed under dim lighting. Use slot -1 as a sentinel meaning
      // "not tied to a specific slot".
      // Sanity-check against the effective pick count (consensus when
      // available, otherwise this frame). A true Champions lock shows
      // exactly 3 selected slots — 2 is normal mid-animation.
      const badgeCount = playerLockPicks.length;
      if (result.lockFrame.isLockScreen && badgeCount !== 0 && badgeCount !== 2 && badgeCount !== 3) {
        const source = consensusBadgeSlots.length > 0
          ? `${badgeAcc.frames}-frame consensus`
          : 'single frame';
        playerLockBadgeWarnings.push({
          slotIndex: -1,
          badgeSpecies: null,
          spriteSpecies: null,
          reason: `unexpected badge count ${badgeCount}/3 (${source}) — expected 2 (mid-animation) or 3 (fully locked). Either a real badge was missed or a false-positive snuck past the 0.12 threshold.`,
        });
      }
      saveFrame({
        id: saveId,
        matchId,
        type: 'lineup-lock',
        timestamp: saveTs,
        dataUrl: compressFrame(audit, 1200, 0.7),
        metadata: {
          myTeam: confirmed.filter(s => s.side === 'left').map(s => s.assignedSpecies as string),
          opponentTeam: confirmed.filter(s => s.side === 'right').map(s => s.assignedSpecies as string),
          sceneContext: result.screenContext,
          framesObserved: consensusForLock.snapshotsFed,
          lineupSlots: slotRows,
          // Include raw detector signals in every save so the user can
          // diagnose *why* nothing locked — e.g. "only 4/6 opp cards,
          // confidence 0.4 → HSV rejected the frame".
          selectionFrame: {
            ...result.selectionFrame,
            selectionUiDetected: result.selectionUiDetected,
            selectionUiReason: result.selectionUiReason,
            triggerReason: sigChanged ? 'sig-changed' : heartbeatDue ? 'heartbeat' : 'annotation-upgrade',
            hasAnnotation: !!annotatedOverlay,
          },
          // Lock-screen consensus: kept separate from the selection
          // consensus so the trail UI can render BOTH and highlight
          // mismatches. A confident lock for species X on the player
          // side that isn't in the selection pool means at least one
          // pipeline got it wrong; the user can compare the captured
          // crops to confirm.
          lockFrame: {
            ...result.lockFrame,
            framesObserved: lockConsensusForXref.snapshotsFed,
          },
          lockConsensus: lockConfirmed,
          lockSelectionMismatches,
          playerLockPicks: playerLockPicks.length > 0 ? playerLockPicks : undefined,
          playerLockBadgeWarnings:
            playerLockBadgeWarnings.length > 0 ? playerLockBadgeWarnings : undefined,
          playerLockBadgeVotes: badgeAcc.frames >= 2
            ? { framesObserved: badgeAcc.frames, votesPerSlot: [...badgeAcc.votes] }
            : undefined,
          slotCrops: slotCrops && slotCrops.length > 0 ? slotCrops : undefined,
        },
      }).catch(e => console.warn('[cache] lineup-lock save failed', e));
    } catch (e) {
      console.warn('[cache] lineup-lock dispatch failed', e);
    }
  }, []);

  const dispatchResultAuditSave = useCallback((
    result: OcrDetectionResult,
    rawFrame: HTMLCanvasElement,
    annotatedOverlay?: HTMLCanvasElement | null,
  ) => {
    if (!result.matchResult) return;
    const now = Date.now();
    const lastSave = lastResultCandidateSaveRef.current;
    const shouldSave =
      lastSave.outcome !== result.matchResult || now - lastSave.timestamp > 4000;
    // Annotation-upgrade: overwrite the most recent raw save if it
    // came from the same outcome and had no annotation yet.
    const canUpgrade =
      !!annotatedOverlay &&
      !lastResultCandidateHadAnnotationRef.current &&
      lastResultCandidateIdRef.current &&
      lastSave.outcome === result.matchResult &&
      now - lastSave.timestamp < 5000;
    if (!shouldSave && !canUpgrade) return;

    let saveId: string;
    let saveTs: number;
    if (canUpgrade && !shouldSave) {
      saveId = lastResultCandidateIdRef.current!;
      saveTs = lastSave.timestamp;
    } else {
      lastResultCandidateSaveRef.current = { outcome: result.matchResult, timestamp: now };
      const matchId = currentMatchIdRef.current || `scan-${now}`;
      saveId = `${matchId}-result-candidate-${now}`;
      saveTs = now;
      lastResultCandidateIdRef.current = saveId;
    }
    lastResultCandidateHadAnnotationRef.current = !!annotatedOverlay;
    const matchId = currentMatchIdRef.current || `scan-${saveTs}`;
    const audit = annotatedOverlay
      ? composeAuditSnapshot(rawFrame, annotatedOverlay)
      : rawFrame;
    saveFrame({
      id: saveId,
      matchId,
      type: 'result-candidate',
      timestamp: saveTs,
      dataUrl: compressFrame(audit, 1200, 0.7),
      metadata: {
        matchResult: result.matchResult,
        resultSignals: result.matchResultSignals,
        confirmed: false,
        opponentTeam: filledOpponents,
        myTeam: filledMyTeam,
        sceneContext: result.screenContext,
        hasAnnotation: !!annotatedOverlay,
      },
    }).catch(e => console.warn('[cache] result-candidate save failed', e));
  }, [filledOpponents, filledMyTeam]);

  // Refs keep the scan loop callback stable while still calling the
  // latest version of each dispatcher.
  const dispatchLineupAuditSaveRef = useRef(dispatchLineupAuditSave);
  const dispatchResultAuditSaveRef = useRef(dispatchResultAuditSave);
  useEffect(() => { dispatchLineupAuditSaveRef.current = dispatchLineupAuditSave; }, [dispatchLineupAuditSave]);
  useEffect(() => { dispatchResultAuditSaveRef.current = dispatchResultAuditSave; }, [dispatchResultAuditSave]);

  const clearHistory = useCallback(() => {
    if (confirm('Clear all match history? This cannot be undone.')) {
      setHistory([]);
    }
  }, []);

  const clearDetectedLineups = useCallback(() => {
    setOpponentTeam([]);
    setSelectedBring([]);
    setActiveYour(null);
    setActiveOpp(null);
    setGamePhase('idle');
    setMatchStartTime(null);
    setMatchElapsed(0);
    setDismissedSpecies(new Set());
    pendingAutoResultRef.current = null;
    previewSelectionRef.current = { count: null, hoveredRowIndex: null, target: null, seenFrames: 0 };
    opponentPreviewSlotsRef.current = createPreviewSlotStability();
    previewProcessingRef.current = { inFlight: false, lastQueuedKey: '', lastCompletedKey: '', lastProcessedAt: 0 };
    resetLineupAnalyzer();
    resetLockAnalyzer();
    lastLineupLockSigRef.current = '';
    lastLineupSaveIdRef.current = null;
    lastLineupSaveHadAnnotationRef.current = false;
    lockBadgeVotesRef.current = { votes: [0, 0, 0, 0, 0, 0], frames: 0 };
    lastResultCandidateSaveRef.current = { outcome: '', timestamp: 0 };
    lastResultCandidateIdRef.current = null;
    lastResultCandidateHadAnnotationRef.current = false;
    if (myTeamSourceRef.current === 'detected') {
      setContextTeam(Array.from({ length: 6 }, () => createDefaultPokemonState()));
    }
  }, [setContextTeam]);

  const resetLiveDetectionState = useCallback(() => {
    setLastOcrResult(null);
    setLastScanError(null);
    setLastFrameUrl(null);
    setLastRawFrameUrl(null);
    rawFramePrimedRef.current = false;
    setLastAnalysisRegion(null);
    setScanCount(0);
    clearDetectedLineups();
  }, [clearDetectedLineups]);

  const applyCaptureRegion = useCallback((region: { x: number; y: number; w: number; h: number } | null) => {
    setCaptureRegion(region);
    resetLiveDetectionState();
  }, [resetLiveDetectionState]);

  const cancelRegionSelection = useCallback(() => {
    setRegionSelecting(false);
    setRegionDragStart(null);
    setRegionDragEnd(null);
  }, []);

  const beginRegionSelection = useCallback((openFullscreenReview = false) => {
    if (openFullscreenReview) setCaptureReviewOpen(true);
    setRegionSelecting(true);
    setRegionDragStart(null);
    setRegionDragEnd(null);
  }, []);

  const getRelativeRegionPoint = useCallback((target: HTMLElement, clientX: number, clientY: number) => {
    const rect = target.getBoundingClientRect();
    const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
    return {
      x: clamp01((clientX - rect.left) / Math.max(1, rect.width)),
      y: clamp01((clientY - rect.top) / Math.max(1, rect.height)),
    };
  }, []);

  const handleRegionMouseDown = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (!regionSelecting) return;
    const point = getRelativeRegionPoint(e.currentTarget, e.clientX, e.clientY);
    setRegionDragStart(point);
    setRegionDragEnd(point);
  }, [regionSelecting, getRelativeRegionPoint]);

  const handleRegionMouseMove = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (!regionSelecting || !regionDragStart) return;
    setRegionDragEnd(getRelativeRegionPoint(e.currentTarget, e.clientX, e.clientY));
  }, [regionSelecting, regionDragStart, getRelativeRegionPoint]);

  const handleRegionMouseUp = useCallback(() => {
    if (!regionSelecting || !regionDragStart || !regionDragEnd) return;
    const x0 = Math.min(regionDragStart.x, regionDragEnd.x);
    const y0 = Math.min(regionDragStart.y, regionDragEnd.y);
    const x1 = Math.max(regionDragStart.x, regionDragEnd.x);
    const y1 = Math.max(regionDragStart.y, regionDragEnd.y);
    if ((x1 - x0) > 0.05 && (y1 - y0) > 0.05) {
      applyCaptureRegion({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
    cancelRegionSelection();
  }, [regionSelecting, regionDragStart, regionDragEnd, applyCaptureRegion, cancelRegionSelection]);


  // Set your team from species names — each gets a full resolved build
  const handleSetMyTeam = useCallback((speciesList: string[]) => {
    suppressDetectedMyTeamRef.current = true;
    if (speciesList.length === 0) {
      setDetectedMyTeamSnapshot([]);
      try {
        localStorage.setItem(MY_TEAM_KEY, JSON.stringify([]));
        localStorage.setItem(DETECTED_MY_TEAM_KEY, JSON.stringify([]));
      } catch {
        // Ignore storage failures; state update already cleared the team.
      }
    }
    applyTeamFromSpecies(speciesList, 'manual');
  }, [applyTeamFromSpecies]);

  const handleSetOpponentDisplayTeam = useCallback((speciesList: string[]) => {
    if (speciesList.length === 0) {
      setDetectedOpponentSnapshot([]);
      opponentPreviewSlotsRef.current = createPreviewSlotStability();
      try {
        localStorage.setItem(DETECTED_OPPONENT_TEAM_KEY, JSON.stringify([]));
      } catch {
        // Ignore storage failures; state update already cleared the snapshot.
      }
    }
    setOpponentTeam(speciesList);
  }, []);

  useEffect(() => {
    setSelectedBring(prev => prev.filter(species => filledMyTeam.includes(species)));
  }, [filledMyTeam]);

  // Load pHash DB on mount — instant from precomputed JSON
  useEffect(() => {
    import('../utils/perceptualHash').then(mod => mod.loadHashDB());
    import('../utils/templateMatcher').then(mod => mod.loadTemplates());
    import('../utils/onnxMatcher').then(mod => mod.loadModel().catch(() => {}));
  }, [handleSetMyTeam, resetLiveDetectionState]);

  // ─── Auto-detection (OCR) handlers ─────────────────────────────

  const handleStartDetection = useCallback(async () => {
    // OCR is optional for roster detection, so warm it up in the background.
    if (!isOcrReady()) {
      setOcrLoading(true);
      initOcrWorker()
        .then(() => setOcrReady(true))
        .catch(() => {})
        .finally(() => setOcrLoading(false));
    }

    // Start screen capture immediately even if OCR is still loading.
    try {
      if (!isCaptureActive()) await startCapture();
      suppressDetectedMyTeamRef.current = false;
      setDetecting(true);
      setScanCount(0);
      setScanFrameInfo(null);
      setLastOcrResult(null);
      setLastScanError(null);
      setLastFrameUrl(null);
      setLastAnalysisRegion(null);
      pendingAutoResultRef.current = null;
      previewSelectionRef.current = { count: null, hoveredRowIndex: null, target: null, seenFrames: 0 };
      opponentPreviewSlotsRef.current = createPreviewSlotStability();
      previewProcessingRef.current = { inFlight: false, lastQueuedKey: '', lastCompletedKey: '', lastProcessedAt: 0 };
    } catch {
      // User cancelled screen share dialog
    }
  }, []);

  const handleStopDetection = useCallback(() => {
    stopCapture();
    setDetecting(false);
    setScanFrameInfo(null);
    setLastAnalysisRegion(null);
    pendingAutoResultRef.current = null;
    previewSelectionRef.current = { count: null, hoveredRowIndex: null, target: null, seenFrames: 0 };
    opponentPreviewSlotsRef.current = createPreviewSlotStability();
    previewProcessingRef.current = { inFlight: false, lastQueuedKey: '', lastCompletedKey: '', lastProcessedAt: 0 };
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }, []);

  const applyPreviewDetectionResult = useCallback((result: OcrDetectionResult) => {
    // Feed this frame's per-slot top candidates into the voting analyzer.
    // Single-frame matcher scores on live 3D cards are noisy (0.14–0.30
    // with <0.02 margins), but votes across several frames resolve the
    // correct species reliably. See `lineupAnalyzer.ts` for the rules.
    if (result.selectionSlots.length > 0) {
      feedLineupSnapshot(result.selectionSlots);
    }
    // Feed the LOCK pipeline independently. Lock-screen votes accumulate
    // in their own analyzer so a noisy lock frame can't pollute selection
    // consensus (and vice-versa). The two are cross-referenced after the
    // lineup-lock save so we can flag mismatches in the Detection Trail.
    //
    // Player-side lock chibis are 3D renders that match poorly against
    // 2D menu icons — feeding their low-confidence votes into the lock
    // analyzer produces misleading "consensus" picks. We instead derive
    // player picks authoritatively from number badges × selection
    // consensus (see `playerLockPicks` below) and keep the lock analyzer
    // focused on the reliable opponent side only.
    if (result.lockSlots.length > 0) {
      const opponentOnly = result.lockSlots.filter(s => s.side === 'right');
      if (opponentOnly.length > 0) feedLockSnapshot(opponentOnly);
    }
    // Accumulate badge votes across every lock frame in the match.
    // Single-frame badge detection is stable in our regression data,
    // but animation transitions (badge fading in/out) or a transient
    // glare spike can produce an outlier slot set. Voting across
    // ≥N frames smooths this: a slot is "locked in" only if a
    // majority of observed lock frames saw a badge there.
    if (result.lockFrame.isLockScreen && Array.isArray(result.playerLockBadgeSlots)) {
      const acc = lockBadgeVotesRef.current;
      acc.frames += 1;
      for (const slotIdx of result.playerLockBadgeSlots) {
        if (slotIdx >= 0 && slotIdx < acc.votes.length) acc.votes[slotIdx] += 1;
      }
    }

    // Use the consensus slots (if we have any) instead of the current
    // frame's slots — this is the whole point of the analyzer. The
    // `assignedConfidence` field on consensus slots reflects voting share
    // in [0,1], so the existing lock threshold behaves sensibly.
    const consensusSlots = getLineupConsensusSlots();
    const sourceSlots = consensusSlots.length > 0 ? consensusSlots : result.selectionSlots;

    const confirmedSelectionSlots = sourceSlots.filter(
      slot => slot.assignedSpecies && (slot.assignedConfidence ?? 0) >= SELECTION_SLOT_LOCK_CONFIDENCE,
    );

    const nextMyTeam = confirmedSelectionSlots
      .filter(slot => slot.side === 'left' && slot.assignedSpecies)
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map(slot => slot.assignedSpecies as string);

    const nextOpponentTeam = confirmedSelectionSlots
      .filter(slot => slot.side === 'right' && slot.assignedSpecies)
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map(slot => slot.assignedSpecies as string);

    if (
      !suppressDetectedMyTeamRef.current &&
      nextMyTeam.length > 0 &&
      (myTeamSourceRef.current === 'detected' || filledMyTeam.length === 0)
    ) {
      applyTeamFromSpecies(nextMyTeam, 'detected');
    }

    if (nextOpponentTeam.length > 0) {
      setOpponentTeam(prev => arraysEqual(prev.filter(Boolean), nextOpponentTeam) ? prev : nextOpponentTeam);
      setGamePhase('preview');
    }
  }, [applyTeamFromSpecies, filledMyTeam.length]);

  const processPreviewFrame = useCallback(async (previewFrame: HTMLCanvasElement, captureKey: string) => {
    const processing = previewProcessingRef.current;
    if (processing.inFlight) return;
    processing.inFlight = true;
    processing.lastQueuedKey = captureKey;
    try {
      const previewResult = await detectPokemonFromFrame(previewFrame, {
        mode: 'preview',
        debugSnapshots: showDebugRef.current || captureReviewOpenRef.current,
        // Constrained matching: lock-screen frames score against the
        // 6 species the selection consensus already confirmed (per side),
        // collapsing the search space from ~250 species → 6 and removing
        // the noise that wrecks 3D chibi matches against menu-icon refs.
        // If the constrained pass fails, the matcher reprocesses against
        // the full DB so a true mismatch (locked species not in selection)
        // still surfaces.
        lockMatchHints: buildLockMatchHints(),
      });
      processing.lastCompletedKey = captureKey;
      processing.lastProcessedAt = Date.now();
      setLastOcrResult(previewResult);
      applyPreviewDetectionResult(previewResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown preview detection failure';
      console.warn('[preview] frame failed', error);
      setLastScanError(message);
    } finally {
      processing.inFlight = false;
    }
  }, [applyPreviewDetectionResult]);

  // Single scan pass — filters out your team, respects cooldown
  const runScan = useCallback(async () => {
    if (scanInFlightRef.current) return;
    scanInFlightRef.current = true;
    if (!isCaptureActive()) {
      if (!isCaptureActive()) setDetecting(false);
      scanInFlightRef.current = false;
      return;
    }

    // Skip scans during post-game cooldown — opponent sprites from
    // results screen would otherwise get re-detected for the next match.
    if (Date.now() < cooldownUntilRef.current) {
      scanInFlightRef.current = false;
      return;
    }

    try {
      // Quick pre-OCR check: if cooldown JUST ended, do a cheap scan first
      // to detect if results screen is STILL on. We check raw text below.

      const rawFrame = grabFrame();
      if (!rawFrame || rawFrame.width < 8 || rawFrame.height < 8) {
        return;
      }
      setScanFrameInfo(`${rawFrame.width}×${rawFrame.height}px`);

      // Raw snapshot: ROI picker, first frame, or while Debug / Capture review is open (fresh alignment checks).
      // Capture-review uses PNG (lossless) so downloaded frames round-trip
      // HSV pixels accurately for offline debugging; other paths stay on JPEG to keep memory bounded.
      if (regionSelecting || showDebugRef.current || captureReviewOpenRef.current) {
        setLastRawFrameUrl(
          captureReviewOpenRef.current
            ? rawFrame.toDataURL('image/png')
            : rawFrame.toDataURL('image/jpeg', 0.55),
        );
      } else if (!rawFramePrimedRef.current) {
        rawFramePrimedRef.current = true;
        setLastRawFrameUrl(rawFrame.toDataURL('image/jpeg', 0.55));
      }

      // Crop to the analyzed game window BEFORE detection.
      // Priority: 1) user-drawn ROI, 2) auto-detected letterbox/game window, 3) full frame.
      let frame = rawFrame;
      const detectedRegion = captureRegion ?? autoDetectGameWindow(rawFrame);
      const analysisRegion = captureRegion
        ? { source: 'manual' as const, ...captureRegion }
        : detectedRegion
          ? { source: 'auto' as const, ...detectedRegion }
          : { source: 'full' as const, x: 0, y: 0, w: 1, h: 1 };
      setLastAnalysisRegion(analysisRegion);

      let regionPx = { x: 0, y: 0, w: rawFrame.width, h: rawFrame.height };
      if (detectedRegion) {
        const { x, y, w, h } = detectedRegion;
        const sx = Math.round(rawFrame.width * x);
        const sy = Math.round(rawFrame.height * y);
        const sw = Math.round(rawFrame.width * w);
        const sh = Math.round(rawFrame.height * h);
        if (sw > 100 && sh > 100) {
          regionPx = { x: sx, y: sy, w: sw, h: sh };
          const cropped = document.createElement('canvas');
          cropped.width = sw; cropped.height = sh;
          cropped.getContext('2d')!.drawImage(rawFrame, sx, sy, sw, sh, 0, 0, sw, sh);
          frame = cropped;
        }
      }

      setLastRawFrameDimensions({ w: rawFrame.width, h: rawFrame.height });
      setLastAnalysisCropDimensions({ w: frame.width, h: frame.height });
      if (showDebugRef.current || captureReviewOpenRef.current) {
        setLastAnalysisCropUrl(compressFrame(frame, 1600, 0.72));
      }

      const result = await Promise.race([
        detectPokemonFromFrame(frame, {
          mode: 'monitor',
          debugSnapshots: showDebugRef.current || captureReviewOpenRef.current,
          // See note in processPreviewFrame — same constrained-matching
          // strategy applies to the live scan loop.
          lockMatchHints: buildLockMatchHints(),
        }),
        new Promise<never>((_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  `Scan timed out after ${SCAN_DETECT_TIMEOUT_MS / 1000}s (OCR/model). Try reloading or closing heavy tabs.`,
                ),
              ),
            SCAN_DETECT_TIMEOUT_MS,
          );
        }),
      ]);
      setLastOcrResult(result);
      setLastScanError(null);
      setScanCount(prev => prev + 1);

    // Audit-trail saves are dispatched BEFORE any early returns so the
    // Detection Trail reliably captures what the detector saw even on
    // frames the downstream pipeline bails out of (matchmaking menu,
    // missing selection ui text, etc). We pass the rawFrame instead of
    // a composited annotated canvas — the annotation is drawn later in
    // the scan loop and re-saved on top if a lock fires there.
    dispatchLineupAuditSaveRef.current(result, rawFrame);
    dispatchResultAuditSaveRef.current(result, rawFrame);

    const rawTextLower = (result.rawText ?? '').toLowerCase();
    const looksLikeMatchmakingMenu =
      result.screenContext === 'menu' ||
      /opponent has been found|begin matchmaking|check rules|change music|change team|quick menu|searching for an opponent|matchmaking/i.test(rawTextLower);

    if (looksLikeMatchmakingMenu) {
      clearDetectedLineups();
      return;
    }

    // Require the HSV frame detector to visually confirm a team-select
    // screen before flipping the preview UI into selection-tracking
    // mode. The OCR-only `selectionUiDetected` fallback triggers on
    // battle-menu tokens ("pokemon", "battle", "select", "send") which
    // are present the entire time the player is issuing moves in a live
    // match, so relying on it here was resetting the opponent preview
    // and churning the selection counter during actual combat.
    const isSelectionScreen =
      result.selectionFrame.isTeamSelect && result.screenContext !== 'menu';
    const previousSelection = previewSelectionRef.current;
    const nextSeenFrames = isSelectionScreen ? previousSelection.seenFrames + 1 : 0;
    const hasConfirmedSelectionScreen = isSelectionScreen && nextSeenFrames >= MIN_SELECTION_CONFIRMATION_FRAMES;

    if (isSelectionScreen) {
      if (previousSelection.seenFrames === 0) {
        opponentPreviewSlotsRef.current = createPreviewSlotStability();
        setOpponentTeam([]);
      }
      const nextCount = result.selectionCount;
      const nextTarget = result.selectionTarget ?? previousSelection.target;
      const nextHoveredRowIndex = result.hoveredRowIndex;
      const effectiveCount = nextCount ?? previousSelection.count;
      const effectiveHoveredRowIndex = nextHoveredRowIndex ?? previousSelection.hoveredRowIndex;

      if (nextTarget !== null && previousSelection.target !== null && nextTarget !== previousSelection.target) {
        setSelectedBring([]);
      }

      if (nextCount === 0 && (previousSelection.count !== 0 || selectedBring.length > 0)) {
        setSelectedBring([]);
      } else if (nextCount !== null && previousSelection.count !== null) {
        if (nextCount > previousSelection.count) {
          const committedRowIndex = previousSelection.hoveredRowIndex ?? nextHoveredRowIndex;
          const committedSpecies = committedRowIndex !== null ? filledMyTeam[committedRowIndex] : null;
          if (committedSpecies) {
            setSelectedBring(prev => {
              if (prev.includes(committedSpecies)) return prev;
              const updated = [...prev, committedSpecies];
              return nextTarget !== null ? updated.slice(0, nextTarget) : updated;
            });
          }
        } else if (nextCount < previousSelection.count) {
          setSelectedBring(prev => prev.slice(0, nextCount));
        }
      }

      previewSelectionRef.current = {
        count: effectiveCount,
        hoveredRowIndex: effectiveHoveredRowIndex,
        target: nextTarget ?? null,
        seenFrames: nextSeenFrames,
      };
    } else {
      previewSelectionRef.current = { count: null, hoveredRowIndex: null, target: null, seenFrames: 0 };
    }

    if (hasConfirmedSelectionScreen) {
      // Monitor mode now runs slot matching on confirmed selection screens.
      // Apply those assignments immediately so the UI is not blocked on a
      // separate preview pass, which may lag or miss a transient frame.
      applyPreviewDetectionResult(result);
    }

    const previewProcessing = previewProcessingRef.current;
    const previewCaptureKey = isSelectionScreen
      ? `${result.selectionTarget ?? 'x'}:${result.selectionCount ?? 'x'}`
      : '';
    const shouldQueuePreviewCapture =
      hasConfirmedSelectionScreen &&
      !previewProcessing.inFlight &&
      (
        previousSelection.seenFrames === 0 ||
        result.selectionCount !== previousSelection.count ||
        result.selectionTarget !== previousSelection.target ||
        Date.now() - previewProcessing.lastProcessedAt > 1500
      );
    if (shouldQueuePreviewCapture) {
      await processPreviewFrame(cloneCanvas(frame), previewCaptureKey);
    }

    // Debug overlay — draw in RAW frame coordinates so it stays aligned
    // with the live uncropped video preview.
    const annotated = document.createElement('canvas');
    annotated.width = rawFrame.width;
    annotated.height = rawFrame.height;
    const actx = annotated.getContext('2d')!;
    actx.clearRect(0, 0, annotated.width, annotated.height);

    const scaleX = regionPx.w / Math.max(1, frame.width);
    const scaleY = regionPx.h / Math.max(1, frame.height);
    const mapRect = (x: number, y: number, w: number, h: number) => ({
      x: regionPx.x + x * scaleX,
      y: regionPx.y + y * scaleY,
      w: w * scaleX,
      h: h * scaleY,
    });

    const myTeamViz = new Set(filledMyTeam);
    for (const species of filledMyTeam) myTeamViz.add(species.split('-')[0]);

    // X-axis split: left = yours, right = opponent
    const midX = regionPx.x + regionPx.w / 2;

    // Vertical midline guide (X-axis split for team assignment)
    actx.strokeStyle = 'rgba(255,255,255,0.2)';
    actx.lineWidth = 2;
    actx.beginPath();
    actx.moveTo(midX, regionPx.y); actx.lineTo(midX, regionPx.y + regionPx.h);
    actx.stroke();
    // Labels
    actx.fillStyle = 'rgba(0,0,0,0.6)';
    actx.fillRect(midX - 85, Math.max(4, regionPx.y + 4), 80, 16);
    actx.fillRect(midX + 5, Math.max(4, regionPx.y + 4), 80, 16);
    actx.font = 'bold 11px system-ui';
    actx.fillStyle = '#38bdf8'; actx.fillText('◄ YOURS', midX - 82, Math.max(16, regionPx.y + 16));
    actx.fillStyle = '#f97316'; actx.fillText('OPPONENT ►', midX + 8, Math.max(16, regionPx.y + 16));

    if (analysisRegion.source !== 'full') {
      actx.strokeStyle = analysisRegion.source === 'manual' ? '#10b981' : '#22c55e';
      actx.lineWidth = 2;
      actx.setLineDash([8, 4]);
      actx.strokeRect(regionPx.x, regionPx.y, regionPx.w, regionPx.h);
      actx.setLineDash([]);
      const roiLabel = analysisRegion.source === 'manual' ? 'MANUAL ROI' : 'AUTO ROI';
      actx.fillStyle = 'rgba(0,0,0,0.8)';
      actx.fillRect(regionPx.x, Math.max(0, regionPx.y - 18), 72, 16);
      actx.fillStyle = analysisRegion.source === 'manual' ? '#10b981' : '#22c55e';
      actx.fillText(roiLabel, regionPx.x + 4, Math.max(12, regionPx.y - 6));
    }

    // Sprite detection boxes — side from scan region
    for (const s of (result.spriteMatched ?? [])) {
      const isYours = myTeamViz.has(s.species);
      const color = isYours ? '#38bdf8' : s.side === 'right' ? '#f97316' : '#eab308';
      const tag = isYours ? 'YOURS' : s.side === 'right' ? 'OPP' : 'YOURS?';
      const mapped = mapRect(
        s.x,
        s.y,
        Math.max(20, Math.round(s.w ?? 80)),
        Math.max(20, Math.round(s.h ?? 80)),
      );
      actx.fillStyle = color + '20';
      actx.fillRect(mapped.x, mapped.y, mapped.w, mapped.h);
      actx.strokeStyle = color;
      actx.lineWidth = 4;
      actx.strokeRect(mapped.x, mapped.y, mapped.w, mapped.h);
      const label = `SPRITE ${s.species} ${Math.round(s.confidence * 100)}% [${tag}]`;
      actx.font = 'bold 13px system-ui';
      const lw = actx.measureText(label).width + 10;
      actx.fillStyle = 'rgba(0,0,0,0.85)';
      actx.fillRect(mapped.x, mapped.y - 22, lw, 22);
      actx.fillStyle = color;
      actx.fillText(label, mapped.x + 5, mapped.y - 5);
    }

    // OCR text listing
    for (const m of result.matched) {
      const isYours = myTeamViz.has(m.species);
      const color = isYours ? '#38bdf8' : '#22c55e';
      actx.fillStyle = 'rgba(0,0,0,0.7)';
      const y = regionPx.y + 20 + result.matched.indexOf(m) * 16;
      actx.fillRect(regionPx.x + 8, y - 12, 280, 14);
      actx.fillStyle = color;
      actx.font = 'bold 11px system-ui';
      actx.fillText(`OCR ${m.species} ${Math.round(m.confidence * 100)}% [${m.side}]`, regionPx.x + 10, y);
    }

    // Battle log
    for (const blm of (result.battleLogMatches ?? [])) {
      const color = blm.isOpponent ? '#ef4444' : '#38bdf8';
      const idx = (result.battleLogMatches ?? []).indexOf(blm);
      const y = regionPx.y + regionPx.h - 20 - idx * 16;
      actx.fillStyle = 'rgba(0,0,0,0.7)';
      actx.fillRect(regionPx.x + 8, y - 12, 300, 14);
      actx.fillStyle = color;
      actx.font = 'bold 11px system-ui';
      actx.fillText(`LOG ${blm.pattern}`, regionPx.x + 10, y);
    }

    // ── Draw all scan region boundaries — thick, bright, labeled ──
    const fw = frame.width, fh = frame.height;

    const drawRegion = (x: number, y: number, w: number, h: number, color: string, label: string, fill = true) => {
      const mapped = mapRect(x, y, w, h);
      if (fill) { actx.fillStyle = color + '15'; actx.fillRect(mapped.x, mapped.y, mapped.w, mapped.h); }
      actx.strokeStyle = color; actx.lineWidth = 3; actx.setLineDash([6, 3]);
      actx.strokeRect(mapped.x, mapped.y, mapped.w, mapped.h);
      actx.setLineDash([]);
      if (label) {
        actx.fillStyle = 'rgba(0,0,0,0.8)';
        actx.font = 'bold 11px system-ui';
        const tw = actx.measureText(label).width + 8;
        actx.fillRect(mapped.x, mapped.y, tw, 16);
        actx.fillStyle = color;
        actx.fillText(label, mapped.x + 4, mapped.y + 12);
      }
    };

    // ── LIVE DETECTOR REGIONS ──
    // These boxes are the actual output of the HSV frame detector on this
    // frame, not a static preset. Panels come from the crimson / blue
    // scan; card bounds come from valley segmentation inside each panel;
    // sprite bounds come from the mask-based crop that the matcher uses.

    // 1) HSV panel bounds — the outermost detection envelopes.
    for (const panel of (result.selectionPanels ?? [])) {
      const color = panel.side === 'left' ? '#38bdf8' : '#f43f5e';
      const label = panel.side === 'left' ? 'PANEL YOURS' : 'PANEL OPP';
      drawRegion(panel.x, panel.y, panel.w, panel.h, color, label, false);
    }

    // 2) Per-card bounds + sprite zones inside each card.
    //    The analyzer consensus (cross-frame vote winner) is drawn as the
    //    primary label when available; fall back to the current frame's
    //    top candidate otherwise.
    const consensusForDraw = getLineupConsensus();
    const consensusBySlot = new Map<string, typeof consensusForDraw.slots[number]>();
    for (const c of consensusForDraw.slots) {
      consensusBySlot.set(`${c.side}:${c.slotIndex}`, c);
    }
    // Collect actual sprite-bbox crops in raw-frame coordinates so the
    // user can audit alignment frame-by-frame without trusting the
    // burned-in annotated overlay. Each crop is the EXACT pixel region
    // the matcher fed into `buildQuerySignature`, scaled up so small
    // chibi sprites are still readable in the trail thumbnails.
    const slotCropPayload: Array<{
      slotIndex: number;
      side: 'left' | 'right';
      card: { x: number; y: number; w: number; h: number };
      sprite: { x: number; y: number; w: number; h: number };
      cropDataUrl: string;
      topCandidates?: Array<{ species: string; confidence: number; isShiny?: boolean }>;
      lockedSpecies?: string | null;
      lockedIsShiny?: boolean;
    }> = [];
    for (const slot of (result.selectionSlots ?? [])) {
      const isYours = slot.side === 'left';
      const cardColor = isYours ? '#38bdf8' : '#f43f5e';
      const spriteColor = isYours ? '#22d3ee' : '#fb923c';

      // Card rectangle — thin, no fill.
      const cardMapped = mapRect(slot.cardX, slot.cardY, slot.cardW, slot.cardH);
      actx.strokeStyle = cardColor;
      actx.lineWidth = 1.5;
      actx.setLineDash([4, 3]);
      actx.strokeRect(cardMapped.x, cardMapped.y, cardMapped.w, cardMapped.h);
      actx.setLineDash([]);

      // Sprite zone — thicker, with label.
      const spriteMapped = mapRect(slot.x, slot.y, slot.w, slot.h);
      actx.strokeStyle = spriteColor;
      actx.lineWidth = 2.5;
      actx.strokeRect(spriteMapped.x, spriteMapped.y, spriteMapped.w, spriteMapped.h);

      // Label priority: consensus winner → single-frame assignment →
      // top candidate (low conf) → "no match".
      const consensus = consensusBySlot.get(`${slot.side}:${slot.slotIndex}`);
      const top = slot.candidates[0];
      let labelText: string;
      let labelColor: string;
      const shinyMark = (isShiny: boolean) => (isShiny ? '✨' : '');
      if (consensus?.isConfident && consensus.assignedSpecies) {
        labelText = `${shinyMark(consensus.isShinyConsensus)}${consensus.assignedSpecies} ${consensus.winnerVotes}/${consensus.framesObserved}v`;
        labelColor = '#34d399'; // green for locked
      } else if (consensus && consensus.voteCandidates.length > 0) {
        const w = consensus.voteCandidates[0];
        const shiny = w.shinyVotes / Math.max(1, w.votes) >= 0.5;
        labelText = `?${shinyMark(shiny)}${w.species} ${w.votes}/${consensus.framesObserved}v`;
        labelColor = '#fbbf24'; // amber for pending
      } else if (slot.assignedSpecies) {
        labelText = `${slot.assignedSpecies} ${Math.round((slot.assignedConfidence ?? 0) * 100)}%`;
        labelColor = spriteColor;
      } else if (top) {
        labelText = `?${shinyMark(top.isShiny ?? false)}${top.species} ${Math.round(top.confidence * 100)}%`;
        labelColor = '#fbbf24';
      } else {
        labelText = 'no match';
        labelColor = '#94a3b8';
      }
      actx.font = 'bold 11px system-ui';
      const textW = actx.measureText(labelText).width + 8;
      actx.fillStyle = 'rgba(0,0,0,0.8)';
      actx.fillRect(spriteMapped.x, Math.max(0, spriteMapped.y - 15), textW, 14);
      actx.fillStyle = labelColor;
      actx.fillText(labelText, spriteMapped.x + 4, Math.max(11, spriteMapped.y - 4));

      // Extract the actual sprite-bbox crop from the raw frame for
      // manual alignment review. Clamp to frame bounds (HSV regions
      // can extend off-screen during animations).
      const sx = Math.max(0, Math.floor(spriteMapped.x));
      const sy = Math.max(0, Math.floor(spriteMapped.y));
      const sw = Math.min(rawFrame.width - sx, Math.floor(spriteMapped.w));
      const sh = Math.min(rawFrame.height - sy, Math.floor(spriteMapped.h));
      if (sw > 4 && sh > 4) {
        // Render at 2x for readability in the trail thumbnail (small
        // chibis are 50–100px in raw frame; doubling gives 100–200px
        // which scans cleanly at the inspection density we display).
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = sw * 2;
        cropCanvas.height = sh * 2;
        const cctx = cropCanvas.getContext('2d')!;
        cctx.imageSmoothingEnabled = true;
        cctx.imageSmoothingQuality = 'high';
        cctx.drawImage(rawFrame, sx, sy, sw, sh, 0, 0, sw * 2, sh * 2);
        const cropDataUrl = cropCanvas.toDataURL('image/png');
        slotCropPayload.push({
          slotIndex: slot.slotIndex,
          side: slot.side,
          card: {
            x: Math.max(0, Math.floor(cardMapped.x)),
            y: Math.max(0, Math.floor(cardMapped.y)),
            w: Math.floor(cardMapped.w),
            h: Math.floor(cardMapped.h),
          },
          sprite: { x: sx, y: sy, w: sw, h: sh },
          cropDataUrl,
          topCandidates: slot.candidates.slice(0, 3).map(c => ({
            species: c.species,
            confidence: c.confidence,
            isShiny: c.isShiny ?? false,
          })),
          lockedSpecies:
            consensus?.isConfident && consensus.assignedSpecies
              ? consensus.assignedSpecies
              : null,
          lockedIsShiny: consensus?.isConfident ? consensus.isShinyConsensus : false,
        });
      }
    }

    // ── W/L DETECTION REGIONS ──
    // Pure HSV color sampling — each box is a signal the result
    // detector measures (see `resultDetector.ts`). Only drawn when the
    // detector says "this is a result screen".
    if (result.matchResult) {
      drawRegion(fw * 0.15, fh * 0.65, fw * 0.25, fh * 0.17, '#f59e0b', 'W/L BADGE', false);
      drawRegion(fw * 0.55, fh * 0.50, fw * 0.35, fh * 0.20, '#94a3b8', 'W/L SILVER R', false);
      drawRegion(fw * 0.48, fh * 0.30, fw * 0.04, fh * 0.50, '#475569', 'W/L DIVIDER', false);
      drawRegion(fw * 0.05, fh * 0.45, fw * 0.40, fh * 0.30,
        result.matchResult === 'win' ? '#10b981' : '#ef4444',
        result.matchResult === 'win' ? 'WIN LEFT' : 'LOSS LEFT',
        false);
    }

    setLastFrameUrl(annotated.toDataURL('image/png'));

    // Re-run the audit dispatchers now that the full annotated
    // overlay is available. The earlier raw-frame saves (above the
    // matchmaking-menu early return) guarantee coverage for scans
    // that don't make it this far; here we bump the heartbeat window
    // so the annotated save usually supersedes the raw one. If the
    // rate-limit is cold (e.g. first selection-screen scan in a
    // while), this call produces the nicer version. If not, it's a
    // no-op.
    dispatchLineupAuditSaveRef.current(result, rawFrame, annotated, slotCropPayload);
    dispatchResultAuditSaveRef.current(result, rawFrame, annotated);

    if (result.matchResult) {
      const pending = pendingAutoResultRef.current;
      if (!pending || pending.result !== result.matchResult) {
        pendingAutoResultRef.current = { result: result.matchResult, seenCount: 1 };
        return;
      }
      const nextSeenCount = pending.seenCount + 1;
      if (nextSeenCount < 2) {
        pendingAutoResultRef.current = { result: result.matchResult, seenCount: nextSeenCount };
        return;
      }
      pendingAutoResultRef.current = null;
      const matchId = currentMatchIdRef.current || 'unknown';
      const frameId = `${matchId}-result-${Date.now()}`;
      const auditResult = composeAuditSnapshot(rawFrame, annotated);
      saveFrame({
        id: frameId,
        matchId,
        type: 'result',
        timestamp: Date.now(),
        dataUrl: compressFrame(auditResult, 1200, 0.7),
        metadata: {
          matchResult: result.matchResult,
          opponentTeam: filledOpponents,
          myTeam: filledMyTeam,
          ocrText: result.rawText?.slice(0, 500),
          sceneContext: result.screenContext,
          resultSignals: result.matchResultSignals,
          confirmed: true,
        },
      }).catch(e => console.warn('[cache] result save failed', e));
      recordMatch(result.matchResult, frameId);
      return;
    }
    pendingAutoResultRef.current = null;

    // Active battler tracking (during battle — use team membership as filter)
      if (filledMyTeam.length >= 2 && filledOpponents.length >= 1) {
        for (const blm of (result.battleLogMatches ?? [])) {
          if (blm.isOpponent && filledOpponents.includes(blm.species)) setActiveOpp(blm.species);
          else if (!blm.isOpponent && filledMyTeam.includes(blm.species)) setActiveYour(blm.species);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown scan failure';
      console.warn('[scan] frame failed', error);
      setLastScanError(message);
    } finally {
      scanInFlightRef.current = false;
    }
  }, [filledMyTeam, filledOpponents, recordMatch, captureRegion, selectedBring, regionSelecting, clearDetectedLineups, processPreviewFrame, applyPreviewDetectionResult]);

  // Attach capture stream to live video element for smooth preview
  useEffect(() => {
    const liveVideo = liveVideoRef.current;
    if (detecting && liveVideo) {
      const stream = getCaptureStream();
      if (stream) {
        liveVideo.srcObject = stream;
        liveVideo.play().catch(() => {});
      }
    }
    return () => {
      if (liveVideo) liveVideo.srcObject = null;
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

  const overlaySideRailWidth = isOverlay ? 92 : 84;
  const overlayScoreboardSize = isOverlay ? 144 : 132;

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

        {/* ═══ YOUR TEAM — left rail ═══ */}
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 stadium-panel stadium-panel-blue rounded-2xl px-2 py-2 z-20"
          style={{
            width: `${overlaySideRailWidth}px`,
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[8px] font-black tracking-[0.18em] champions-blue">TEAM</span>
            <span className="text-[8px] font-mono text-white/40">{filledMyTeam.length}</span>
          </div>
          {filledMyTeam.length > 0 ? (
            <div className="grid grid-cols-2 gap-1">
              {filledMyTeam.map(species => {
                const isActive = activeYour === species;
                const isSelected = selectedBring.includes(species);
                return (
                  <div key={species} className="flex flex-col items-center group">
                    <div
                      className={`relative w-8 h-8 flex items-center justify-center rounded-md transition-all ${(isActive || isSelected) ? 'scale-110' : 'opacity-70'}`}
                      style={{
                        background: isActive
                          ? 'radial-gradient(circle, rgba(0,117,190,0.6) 0%, transparent 70%)'
                          : isSelected
                            ? 'radial-gradient(circle, rgba(16,185,129,0.55) 0%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(0,117,190,0.18) 0%, transparent 70%)',
                        boxShadow: isActive
                          ? '0 0 16px rgba(0,117,190,0.7)'
                          : isSelected
                            ? '0 0 14px rgba(16,185,129,0.55)'
                            : 'none',
                      }}
                    >
                      <Sprite species={species} size="sm" />
                      {isActive && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                      )}
                      {!isActive && isSelected && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </div>
                    <span className={`text-[6px] font-semibold truncate max-w-[36px] ${isActive ? 'text-sky-300' : isSelected ? 'text-emerald-300' : 'text-white/50'}`}>{species}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-16 flex items-center justify-center">
              <span className="text-[8px] text-white/25 text-center">
                <span>Awaiting team</span><span className="animate-pulse">...</span>
              </span>
            </div>
          )}
        </div>

        {/* ═══ OPPONENT — right rail ═══ */}
        <div
          className="absolute right-3 top-1/2 -translate-y-1/2 stadium-panel stadium-panel-red rounded-2xl px-2 py-2 z-20"
          style={{
            width: `${overlaySideRailWidth}px`,
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[8px] font-black tracking-[0.14em] champions-red">OPP</span>
            <span className="text-[8px] font-mono text-white/40">{filledOpponents.length}</span>
          </div>
          {filledOpponents.length > 0 ? (
            <div className="grid grid-cols-2 gap-1">
              {filledOpponents.map(species => {
                const isActive = activeOpp === species;
                return (
                  <div key={species} className="flex flex-col items-center group">
                    <div
                      className={`relative w-8 h-8 flex items-center justify-center rounded-md transition-all ${isActive ? 'scale-110' : 'opacity-70'}`}
                      style={{
                        background: isActive
                          ? 'radial-gradient(circle, rgba(196,13,31,0.6) 0%, transparent 70%)'
                          : 'radial-gradient(circle, rgba(196,13,31,0.18) 0%, transparent 70%)',
                        boxShadow: isActive ? '0 0 16px rgba(196,13,31,0.7)' : 'none',
                      }}
                    >
                      <Sprite species={species} size="sm" />
                      {isActive && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      )}
                    </div>
                    <span className={`text-[6px] font-semibold truncate max-w-[36px] ${isActive ? 'text-red-300' : 'text-white/50'}`}>{species}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-16 flex items-center justify-center">
              <span className="text-[8px] text-white/25 text-center">
                <span>Scouting</span><span className="animate-pulse">...</span>
              </span>
            </div>
          )}
          {archetypes.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-white/10 text-center">
              <span className="text-[7px] font-bold champions-gold">{archetypes[0].name}</span>
            </div>
          )}
        </div>

        {/* ═══ CENTER POKEBALL SCOREBOARD ═══ */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1">
          <div className="stadium-panel rounded-full flex items-center justify-center" style={{ width: `${overlayScoreboardSize}px`, height: `${overlayScoreboardSize}px`, padding: '10px' }}>
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
                    <span className="font-black text-2xl tracking-tighter" style={{ color: '#4ade80', WebkitTextStroke: '1.5px #fff' }}>{wins}</span>
                    <span className="font-black text-base" style={{ color: '#ffd700', WebkitTextStroke: '0.5px #fff' }}>-</span>
                    <span className="font-black text-2xl tracking-tighter" style={{ color: '#fb7185', WebkitTextStroke: '1.5px #fff' }}>{losses}</span>
                  </div>
                  {totalGames > 0 && (
                    <div className="text-[10px] font-black mt-0.5 tracking-widest" style={{ color: '#ffd700', WebkitTextStroke: '0.5px #fff' }}>{winRate}%</div>
                  )}
                  {streak.count >= 2 && (
                    <div
                      className="text-[8px] font-black uppercase tracking-widest mt-1 px-2 py-0.5 rounded-full"
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
          <div className="stadium-panel rounded-lg px-3 py-1">
            <div className="text-sm font-black tracking-[0.22em] stadium-title">CHAMPIONS</div>
          </div>
          {matchStartTime && (
            <div className="stadium-panel rounded-full px-2.5 py-0.5">
              <div className="text-[8px] font-black tracking-widest text-white/40 uppercase text-center">Match</div>
              <div className="text-[11px] font-bold font-mono text-white text-center">{formatElapsed(matchElapsed).replace(/^00:/, '')}</div>
            </div>
          )}
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

        {/* ═══ BRING LIST — compact bottom-center ═══ */}
        {bringList.length > 0 && (
          <div className="absolute left-1/2 -translate-x-1/2 stadium-panel stadium-panel-gold rounded-xl px-3 py-2 z-20" style={{ bottom: '18px' }}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-[8px] font-black tracking-[0.18em] champions-gold">BRING</span>
            </div>
            <div className="flex gap-1">
              {orderedBringList.slice(0, 3).map((rec, i) => (
                <div key={rec.species} className={`flex flex-col items-center ${i < 2 ? '' : 'opacity-60'}`}>
                  <div
                    className="w-9 h-9 rounded-md flex items-center justify-center relative"
                    style={{
                      background: i === 0
                        ? 'radial-gradient(circle, rgba(255,215,0,0.35) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(255,215,0,0.12) 0%, transparent 70%)',
                      border: i < 2 ? '1px solid rgba(255,215,0,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <Sprite species={rec.species} size="sm" />
                    <span className={`absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black ${
                      i === 0 ? 'bg-poke-gold text-black' : 'bg-slate-700 text-white/70'
                    }`}>{i + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ LEAD CARD — top-right compact ═══ */}
        {openerStrategy && (
          <div className="absolute top-3 right-28 stadium-panel rounded-xl px-2.5 py-1.5 z-20" style={{ maxWidth: '156px' }}>
            <div className="text-[7px] font-black tracking-[0.18em] champions-gold mb-1">LEAD</div>
            <div className="flex items-center justify-center gap-1 mb-2">
              <Sprite species={openerStrategy.lead[0]} size="sm" />
              <span className="champions-gold font-black">+</span>
              <Sprite species={openerStrategy.lead[1]} size="sm" />
            </div>
            <div className="text-[8px] text-white/70 leading-tight line-clamp-2">{openerStrategy.turn1.mon1Action}</div>
          </div>
        )}

        {/* ═══ CONTROLS — stream-ok buttons, minimal ═══ */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 items-end">
          <div className="flex gap-1.5">
            <button
              onClick={() => recordMatch('win')}
              className="stadium-panel rounded-lg px-3 py-1.5 font-black text-[10px] tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors active:scale-95"
            >
              WIN
            </button>
            <button
              onClick={() => recordMatch('loss')}
              className="stadium-panel rounded-lg px-3 py-1.5 font-black text-[10px] tracking-widest text-red-400 hover:text-red-300 transition-colors active:scale-95"
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
                title="Clear saved team, opponent lineup, detection trail cache, match history, and all session state for a fresh start"
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

      {/* ═══ GAME WINDOW — always smooth video, debug overlaid ═══ */}
      {detecting && (
        <div className="rounded-xl overflow-hidden border border-poke-border">
          <div
            className="relative bg-black"
            onMouseDown={regionSelecting ? handleRegionMouseDown : undefined}
            onMouseMove={regionSelecting ? handleRegionMouseMove : undefined}
            onMouseUp={regionSelecting ? handleRegionMouseUp : undefined}
            style={{ cursor: regionSelecting ? 'crosshair' : 'default', userSelect: 'none' }}
          >
            {/* Live video — ALWAYS mounted, never unmounted */}
            <video ref={bindLiveVideo} autoPlay muted playsInline className="w-full h-auto block" style={{ pointerEvents: 'none' }} />
            {/* Debug overlay — transparent annotations on top of live video */}
            {showDebug && lastFrameUrl && !regionSelecting && (
              <img src={lastFrameUrl} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
            )}
            {/* ROI selection: semi-transparent overlay on the LIVE video — user can see what they're selecting */}
            {regionSelecting && (
              <div className="absolute inset-0 bg-black/40 pointer-events-none">
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-2 rounded-lg border border-emerald-500/30">
                  <span className="text-emerald-400 text-sm font-bold">Drag to select the game area</span>
                  <span className="text-slate-400 text-xs ml-2">(for overlay streams where the game is in a sub-window)</span>
                </div>
              </div>
            )}
            {/* Active ROI drag rectangle */}
            {regionSelecting && regionDragStart && regionDragEnd && (
              <div className="absolute border-2 border-emerald-400 bg-emerald-400/10 rounded pointer-events-none" style={{
                left: `${Math.min(regionDragStart.x, regionDragEnd.x) * 100}%`,
                top: `${Math.min(regionDragStart.y, regionDragEnd.y) * 100}%`,
                width: `${Math.abs(regionDragEnd.x - regionDragStart.x) * 100}%`,
                height: `${Math.abs(regionDragEnd.y - regionDragStart.y) * 100}%`,
              }} />
            )}
            {/* Show current ROI outline when not selecting (so user knows what area is active) */}
            {!regionSelecting && captureRegion && captureRegion.w < 0.85 && (
              <div className="absolute border-2 border-dashed border-emerald-500/40 rounded pointer-events-none" style={{
                left: `${captureRegion.x * 100}%`,
                top: `${captureRegion.y * 100}%`,
                width: `${captureRegion.w * 100}%`,
                height: `${captureRegion.h * 100}%`,
              }}>
                <span className="absolute -top-5 left-1 text-[9px] text-emerald-500/60 font-bold">ROI</span>
              </div>
            )}
          </div>
          {/* Bottom control bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-poke-darker">
            <div className="flex items-center gap-2 text-[10px]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-500">{captureRegion && captureRegion.w < 0.85 ? `ROI ${Math.round(captureRegion.w * 100)}×${Math.round(captureRegion.h * 100)}%` : 'Full screen'}</span>
              {lastOcrResult && <span className="text-slate-600">#{scanCount} · {lastOcrResult.durationMs}ms</span>}
            </div>
            <div className="flex items-center gap-1">
              {regionSelecting
                ? <button onClick={cancelRegionSelection} className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-colors">Cancel ROI</button>
                : <>
                    <button
                      onClick={() => beginRegionSelection(true)}
                      disabled={!lastRawFrameUrl}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        lastRawFrameUrl
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
                          : 'bg-poke-surface border border-poke-border text-slate-600 cursor-not-allowed'
                      }`}
                      title="Open the large fullscreen capture view and drag an ROI there"
                    >
                      {captureRegion && captureRegion.w < 0.85 ? 'Redraw ROI Fullscreen' : 'Crop Fullscreen'}
                    </button>
                    <button onClick={() => beginRegionSelection(false)} className="text-[10px] px-2 py-0.5 rounded bg-poke-surface border border-poke-border text-slate-400 hover:text-emerald-400 transition-colors">Inline ROI</button>
                  </>
              }
              {captureRegion && captureRegion.w < 0.85 && !regionSelecting && <button onClick={() => applyCaptureRegion(null)} className="text-[10px] px-2 py-0.5 rounded bg-poke-surface border border-poke-border text-slate-400 hover:text-red-400 transition-colors">Reset to Full</button>}
              <button
                type="button"
                onClick={() => setCaptureReviewOpen(true)}
                disabled={!lastRawFrameUrl}
                title="Fullscreen: raw capture, detector crop, and sprite overlay alignment"
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  lastRawFrameUrl
                    ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25'
                    : 'bg-poke-surface border border-poke-border text-slate-600 cursor-not-allowed'
                }`}
              >
                Review capture
              </button>
              <button onClick={() => setShowDebug(!showDebug)} className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${showDebug ? 'bg-violet-500/15 border-violet-500/30 text-violet-400' : 'bg-poke-surface border-poke-border text-slate-500'}`}>{showDebug ? 'Hide Debug' : 'Debug'}</button>
              <button onClick={handleStopDetection} className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors">Stop</button>
            </div>
          </div>
        </div>
      )}

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
            {filledMyTeam.length === 0 && detectedMyTeamSnapshot.length > 0 && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-2 py-1.5">
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">Last detected snapshot</div>
                  <div className="truncate text-[10px] text-slate-300">{detectedMyTeamSnapshot.join(', ')}</div>
                </div>
                <button
                  onClick={() => setDetectedMyTeamSnapshot([])}
                  className="shrink-0 text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                >
                  Dismiss
                </button>
              </div>
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
            <QuickTeamInput value={filledOpponents} onChange={handleSetOpponentDisplayTeam} maxSlots={6} />
            {filledOpponents.length === 0 && detectedOpponentSnapshot.length > 0 && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-2 py-1.5">
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">Last detected snapshot</div>
                  <div className="truncate text-[10px] text-slate-300">{detectedOpponentSnapshot.join(', ')}</div>
                </div>
                <button
                  onClick={() => setDetectedOpponentSnapshot([])}
                  className="shrink-0 text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          <div className="h-px bg-poke-border/30" />

          {/* Screen capture toggle */}
          {!detecting ? (
            <button onClick={handleStartDetection} disabled={ocrLoading} className={`w-full py-2 rounded-lg border text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
              ocrLoading ? 'border-poke-border bg-poke-surface text-slate-600 cursor-wait' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
            }`}>
              {ocrLoading ? 'OCR warming up...' : 'Share Screen to Start Detection'}
            </button>
          ) : (
            <button onClick={handleStopDetection} className="w-full py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />Stop Detection
            </button>
          )}
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
                type="button"
                onClick={() => setCaptureReviewOpen(true)}
                disabled={!lastRawFrameUrl}
                className={`text-[9px] px-1.5 py-0.5 rounded border font-bold transition-colors ${
                  lastRawFrameUrl
                    ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25'
                    : 'bg-poke-surface border border-poke-border text-slate-600 cursor-not-allowed'
                }`}
                title="Fullscreen capture alignment review"
              >
                Review
              </button>
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
        {showDebug && (detecting || lastOcrResult || lastScanError) && (
          <div className="px-3 pb-3 space-y-1">
            {detecting && lastRawFrameUrl && (
              <DebugSection title="Capture alignment — raw vs crop vs overlay" defaultOpen={false}>
                <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
                  The live preview is small; open fullscreen review to check black bars, manual ROI, auto letterbox crop, and sprite boxes against the same pixels the detector uses.
                </p>
                <button
                  type="button"
                  onClick={() => setCaptureReviewOpen(true)}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/35 text-cyan-400 font-bold hover:bg-cyan-500/25 transition-colors"
                >
                  Open fullscreen capture review
                </button>
                {lastRawFrameDimensions && lastAnalysisCropDimensions && (
                  <div className="mt-2 text-[9px] text-slate-600 font-mono">
                    Raw {lastRawFrameDimensions.w}×{lastRawFrameDimensions.h}px → analysis crop {lastAnalysisCropDimensions.w}×{lastAnalysisCropDimensions.h}px
                  </div>
                )}
              </DebugSection>
            )}
            {(() => {
              const frameSprites = lastOcrResult?.spriteMatched ?? [];
              const frameLeftSprites = frameSprites.filter(s => s.side === 'left');
              const frameRightSprites = frameSprites.filter(s => s.side === 'right');
              const framePanelMatches = (lastOcrResult?.matched ?? []).filter(m => m.method === 'panel');
              return (
                <DebugSection
                  title={lastOcrResult
                    ? `State — ${lastOcrResult.screenContext} · ${frameLeftSprites.length}L ${frameRightSprites.length}R sprites · ${framePanelMatches.length} panel OCR`
                    : 'State — waiting for scan result'}
                  defaultOpen
                >
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded border border-poke-border/30 bg-poke-surface/40 p-2">
                      <div className="text-slate-500 uppercase tracking-wider font-bold mb-1 text-[9px]">Frame</div>
                      <div className="text-white">Context: <span className="text-slate-400">{lastOcrResult?.screenContextDebug ?? 'Waiting for first successful scan...'}</span></div>
                      <div className="text-white">Grab: <span className={scanFrameInfo ? 'text-emerald-400' : 'text-amber-400'}>{scanFrameInfo ?? (detecting ? 'no frame yet (waiting for video…)' : '—')}</span></div>
                      <div className="text-white">Region: <span className="text-slate-400">{lastAnalysisRegion ? `${lastAnalysisRegion.source} ${Math.round(lastAnalysisRegion.w * 100)}x${Math.round(lastAnalysisRegion.h * 100)}% @ ${Math.round(lastAnalysisRegion.x * 100)},${Math.round(lastAnalysisRegion.y * 100)}` : 'full 100x100%'}</span></div>
                      <div className="text-white">Selection: <span className="text-slate-400">{lastOcrResult?.selectionCount ?? '-'} / {lastOcrResult?.selectionTarget ?? '-'}</span></div>
                      <div className="text-white">Selection UI: <span className={lastOcrResult?.selectionUiDetected ? 'text-emerald-400' : 'text-amber-400'}>{lastOcrResult?.selectionUiReason ?? 'not evaluated yet'}</span></div>
                      <div className="text-white">Selection Slots: <span className={lastOcrResult?.selectionSlotMatcherEnabled ? 'text-emerald-400' : 'text-amber-400'}>{lastOcrResult?.selectionSlotMatcherReason ?? 'not evaluated yet'}</span></div>
                      <div className="text-white">Hover Row: <span className="text-slate-400">{lastOcrResult?.hoveredRowIndex ?? '-'}</span></div>
                      <div className="text-white">Scan Time: <span className="text-slate-400">{lastOcrResult ? `${lastOcrResult.durationMs}ms` : 'pending'}</span></div>
                    </div>
                    <div className="rounded border border-poke-border/30 bg-poke-surface/40 p-2">
                      <div className="text-slate-500 uppercase tracking-wider font-bold mb-1 text-[9px]">Team State</div>
                      <div className="text-white">Your Team: <span className="text-slate-400">{filledMyTeam.length}/6</span></div>
                      <div className="text-white">Opponent Team: <span className="text-slate-400">{filledOpponents.length}/6</span></div>
                      <div className="text-white">Selected Bring: <span className="text-slate-400">{selectedBring.length > 0 ? selectedBring.join(', ') : '(none)'}</span></div>
                      <div className="text-white">Scan #: <span className="text-slate-400">{scanCount}</span></div>
                      <div className="text-white">Scan Status: <span className={lastScanError ? 'text-red-400' : detecting ? 'text-emerald-400' : 'text-slate-400'}>{lastScanError ?? (detecting ? 'running' : 'idle')}</span></div>
                    </div>
                  </div>
                </DebugSection>
              );
            })()}

            <DebugSection
              title={`Detection Trail (debug mirror) — canonical copy lives in the always-visible sidebar panel`}
              defaultOpen={false}
            >
              <p className="text-[10px] text-slate-500">
                This mirror exists for parity with the rest of the debug column. The full, always-visible Detection Trail is pinned directly under Match History.
              </p>
            </DebugSection>

            {lastOcrResult?.debugSnapshots && lastOcrResult.debugSnapshots.length > 0 && (
              <DebugSection title="OCR pipeline — what Tesseract reads (vs raw crop above)" defaultOpen={false}>
                <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
                  Monitor mode uses one preprocess pass; preview mode may show two. Compare to the analysis crop in fullscreen Review — if the high-contrast frame is garbage, text detection will be wrong.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {lastOcrResult.debugSnapshots.map((snap, i) => (
                    <div key={i} className="rounded border border-poke-border/30 bg-black/40 overflow-hidden">
                      <div className="px-1.5 py-1 text-[8px] text-slate-500 font-mono leading-tight line-clamp-3">{snap.label}</div>
                      <img src={snap.dataUrl} alt="" className="w-full h-auto max-h-36 object-contain object-top" />
                    </div>
                  ))}
                </div>
              </DebugSection>
            )}

            {lastOcrResult && (() => {
              const selectionSlots = lastOcrResult.selectionSlots ?? [];
              // Consensus is the real source of truth for "is this species
              // locked in?" — the per-frame `assignedSpecies` is only used
              // as a fallback before voting has accumulated.
              const consensus = getLineupConsensus();
              const consensusBySlot = new Map<string, typeof consensus.slots[number]>();
              for (const c of consensus.slots) {
                consensusBySlot.set(`${c.side}:${c.slotIndex}`, c);
              }
              const assignedSlots = consensus.slots.filter(slot => slot.assignedSpecies);
              const confirmedSlots = consensus.slots.filter(
                slot => slot.assignedSpecies && (slot.assignedConfidence ?? 0) >= SELECTION_SLOT_LOCK_CONFIDENCE,
              );
              const confirmedLeft = confirmedSlots.filter(slot => slot.side === 'left');
              const confirmedRight = confirmedSlots.filter(slot => slot.side === 'right');
              const previewProcessing = previewProcessingRef.current;
              const selectionPhase = !lastOcrResult.selectionUiDetected
                ? 'not a selection screen'
                : lastOcrResult.selectionSlotMatcherEnabled
                  ? 'selection OCR passed, slot matcher ran'
                  : 'selection OCR passed, slot matcher skipped';
              const myTeamApplyReason =
                confirmedLeft.length === 0
                  ? 'no confirmed left-side slots'
                  : suppressDetectedMyTeamRef.current
                    ? 'suppressed after manual team edit'
                    : myTeamSourceRef.current !== 'detected' && filledMyTeam.length > 0
                      ? `manual team already present (${filledMyTeam.length}/6)`
                      : 'eligible to auto-apply';
              const opponentApplyReason =
                confirmedRight.length === 0
                  ? 'no confirmed right-side slots'
                  : 'eligible to auto-apply';

              return (
                <>
                  <DebugSection title="Engine Decisions — scene gate -> slot matcher -> team apply" defaultOpen>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px]">
                      <div className="rounded border border-poke-border/30 bg-poke-surface/40 p-2">
                        <div className="text-slate-500 uppercase tracking-wider font-bold mb-1 text-[9px]">1. Scene Gate</div>
                        <div className="text-white">Context: <span className="text-slate-300">{lastOcrResult.screenContext}</span></div>
                        <div className="text-white">Selection UI: <span className={lastOcrResult.selectionUiDetected ? 'text-emerald-400' : 'text-amber-400'}>{lastOcrResult.selectionUiReason}</span></div>
                        <div className="text-white">Interpretation: <span className="text-slate-400">{selectionPhase}</span></div>
                        <div className="text-white">Hover row: <span className="text-slate-400">{lastOcrResult.hoveredRowIndex ?? '-'}</span></div>
                      </div>

                      <div className="rounded border border-poke-border/30 bg-poke-surface/40 p-2">
                        <div className="text-slate-500 uppercase tracking-wider font-bold mb-1 text-[9px]">2. Slot Matcher + Voting</div>
                        <div className="text-white">Confirmed (voted): <span className="text-slate-300">{confirmedSlots.length}/{consensus.slots.length || '0'}</span></div>
                        <div className="text-white">Pending votes: <span className="text-slate-300">{assignedSlots.length - confirmedSlots.length} slots w/ activity</span></div>
                        <div className="text-white">Snapshots fed: <span className="text-slate-400">{consensus.snapshotsFed}</span></div>
                        <div className="text-white">Votes need: <span className="text-slate-400">{LINEUP_ANALYZER_CONFIG.MIN_CONSENSUS_VOTES}+ votes · {Math.round(LINEUP_ANALYZER_CONFIG.MIN_CONSENSUS_SHARE * 100)}% share · {LINEUP_ANALYZER_CONFIG.MIN_CONSENSUS_MARGIN}× over runner-up</span></div>
                        <div className="text-white">Preview worker: <span className={previewProcessing.inFlight ? 'text-amber-400' : 'text-slate-400'}>{previewProcessing.inFlight ? `running ${previewProcessing.lastQueuedKey || '(unkeyed)'}` : `idle; last=${previewProcessing.lastCompletedKey || '(none)'}`}</span></div>
                      </div>

                      <div className="rounded border border-poke-border/30 bg-poke-surface/40 p-2">
                        <div className="text-slate-500 uppercase tracking-wider font-bold mb-1 text-[9px]">3. Team Apply</div>
                        <div className="text-white">My team source: <span className="text-slate-300">{myTeamSourceRef.current}</span></div>
                        <div className="text-white">Left apply: <span className={confirmedLeft.length > 0 ? 'text-emerald-400' : 'text-amber-400'}>{myTeamApplyReason}</span></div>
                        <div className="text-white">Right apply: <span className={confirmedRight.length > 0 ? 'text-emerald-400' : 'text-amber-400'}>{opponentApplyReason}</span></div>
                        <div className="text-white">Current state: <span className="text-slate-400">{filledMyTeam.length}/6 left, {filledOpponents.length}/6 right</span></div>
                      </div>
                    </div>
                  </DebugSection>

                  <DebugSection
                    title={`Selection Slots — ${confirmedSlots.length} confirmed · ${assignedSlots.length} voting · ${selectionSlots.length} this frame · ${consensus.snapshotsFed} snapshots fed`}
                    defaultOpen={lastOcrResult.selectionUiDetected || selectionSlots.length > 0}
                  >
                    {selectionSlots.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {selectionSlots.map((slot, index) => {
                          const consensusSlot = consensusBySlot.get(`${slot.side}:${slot.slotIndex}`);
                          const confidence = consensusSlot?.assignedConfidence ?? slot.assignedConfidence ?? 0;
                          const assignedSpecies = consensusSlot?.assignedSpecies ?? slot.assignedSpecies ?? null;
                          const isConfirmed = Boolean(assignedSpecies) && confidence >= SELECTION_SLOT_LOCK_CONFIDENCE;
                          const sideTone = slot.side === 'left'
                            ? 'border-sky-500/25 bg-sky-500/8'
                            : 'border-red-500/25 bg-red-500/8';
                          const framesObs = consensusSlot?.framesObserved ?? 0;
                          const winnerVotes = consensusSlot?.winnerVotes ?? 0;
                          return (
                            <div key={`${slot.side}-${slot.slotIndex}-${index}`} className={`rounded border p-2 ${sideTone}`}>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                  {slot.side} slot {slot.slotIndex + 1}
                                </div>
                                <div className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                  isConfirmed
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : assignedSpecies
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-slate-700/60 text-slate-300'
                                }`}>
                                  {isConfirmed ? 'CONFIRMED' : assignedSpecies ? 'PENDING' : 'VOTING'}
                                </div>
                              </div>
                              <div className="text-white">
                                Consensus: <span className="text-slate-300">
                                  {consensusSlot?.isShinyConsensus ? '✨ ' : ''}
                                  {assignedSpecies ?? '(no winner yet)'}
                                </span>
                                {assignedSpecies && framesObs > 0 && (
                                  <span className={`ml-1 ${isConfirmed ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {winnerVotes}/{framesObs} votes ({Math.round(confidence * 100)}%)
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-500 text-[9px] mb-1">
                                This-frame top: <span className="text-slate-400">{slot.candidates[0]?.species ?? '-'} {slot.candidates[0] ? Math.round(slot.candidates[0].confidence * 100) + '%' : ''}</span>
                                {' · '}Box: {Math.round(slot.x)},{Math.round(slot.y)} {Math.round(slot.w)}x{Math.round(slot.h)}
                              </div>
                              <div className="space-y-1">
                                {consensusSlot && consensusSlot.voteCandidates.length > 0 ? (
                                  consensusSlot.voteCandidates.slice(0, 3).map(candidate => {
                                    const shinyShare = candidate.shinyVotes / Math.max(1, candidate.votes);
                                    return (
                                    <div key={`${slot.side}-${slot.slotIndex}-vote-${candidate.species}`} className="flex items-center justify-between gap-2 text-[9px]">
                                      <span className="text-slate-300 truncate">
                                        {shinyShare >= 0.5 ? '✨ ' : ''}{candidate.species}
                                      </span>
                                      <span className="text-slate-500 shrink-0">
                                        {candidate.votes} votes
                                        {candidate.shinyVotes > 0 && ` (${candidate.shinyVotes}✨)`}
                                        {' · avg conf '}{Math.round(candidate.meanConfidence * 100)}%
                                      </span>
                                    </div>
                                    );
                                  })
                                ) : slot.candidates.length > 0 ? (
                                  slot.candidates.slice(0, 3).map(candidate => (
                                    <div key={`${slot.side}-${slot.slotIndex}-${candidate.species}`} className="flex items-center justify-between gap-2 text-[9px]">
                                      <span className="text-slate-400 truncate">{candidate.species}</span>
                                      <span className="text-slate-600 shrink-0">
                                        conf {Math.round(candidate.confidence * 100)}% (this frame)
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-[9px] text-slate-600">No candidates recorded</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-600">No slot debug data recorded for this frame.</div>
                    )}
                  </DebugSection>
                </>
              );
            })()}

            {lastScanError && (
              <DebugSection title="Last Scan Error" defaultOpen>
                <div className="rounded border border-red-500/20 bg-red-500/10 p-2 text-[10px] text-red-300">
                  {lastScanError}
                </div>
              </DebugSection>
            )}

            {lastOcrResult && (
              <>
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

            {/* Section: Detections — frame-local truth */}
            <DebugSection title={`Frame Detections — ${lastOcrResult.spriteMatched?.length ?? 0} sprites · ${lastOcrResult.matched.length} OCR`} defaultOpen={lastOcrResult.matched.length > 0 || (lastOcrResult.spriteMatched?.length ?? 0) > 0}>
              {/* Text matches */}
              {lastOcrResult.matched.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  {lastOcrResult.matched.map(m => {
                    const sideTone = m.side === 'left'
                      ? 'bg-sky-500/10 border-sky-500/20'
                      : m.side === 'right'
                        ? 'bg-red-500/10 border-red-500/20'
                        : 'bg-poke-gold/10 border-poke-gold/20';
                    const sideLabel = m.side === 'left' ? 'LEFT' : m.side === 'right' ? 'RIGHT' : 'UNKNOWN';
                    return (
                      <div key={`ocr-${m.species}-${m.token}`} className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${sideTone}`}>
                        <Sprite species={m.species} size="sm" />
                        <span className="text-[10px] text-white font-medium">{m.species}</span>
                        <span className="text-[8px] font-bold px-1 rounded bg-poke-surface text-slate-300">{m.method.toUpperCase()}</span>
                        <span className="text-[8px] font-bold px-1 rounded bg-poke-surface text-slate-300">{sideLabel}</span>
                        <span className="text-[9px] text-slate-600">"{m.token}" {Math.round(m.confidence * 100)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Sprite matches */}
              {(lastOcrResult.spriteMatched?.length ?? 0) > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {lastOcrResult.spriteMatched!.map(s => {
                    const lockEligible = s.confidence >= TEAM_LOCK_CONFIDENCE;
                    const trackedSide = s.side === 'left'
                      ? filledMyTeam.includes(s.species) ? 'TRACKED LEFT' : lockEligible ? 'LEFT LOCKABLE' : 'LEFT LOW'
                      : filledOpponents.includes(s.species) ? 'TRACKED RIGHT' : lockEligible ? 'RIGHT LOCKABLE' : 'RIGHT LOW';
                    const sideTone = s.side === 'left'
                      ? 'bg-sky-500/10 border-sky-500/20'
                      : 'bg-red-500/10 border-red-500/20';
                    return (
                      <div key={`spr-${s.side}-${s.species}-${Math.round(s.x)}-${Math.round(s.y)}`} className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${sideTone}`}>
                        <Sprite species={s.species} size="sm" />
                        <span className="text-[10px] text-white font-medium">{s.species}</span>
                        <span className="text-[8px] font-bold px-1 rounded bg-violet-500/20 text-violet-300">SPRITE</span>
                        <span className="text-[8px] font-bold px-1 rounded bg-poke-surface text-slate-300">{trackedSide}</span>
                        <span className="text-[9px] text-slate-600">{Math.round(s.confidence * 100)}% @ ({Math.round(s.x)},{Math.round(s.y)}) {s.w && s.h ? `${Math.round(s.w)}x${Math.round(s.h)}` : ''}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {lastOcrResult.matched.length === 0 && (lastOcrResult.spriteMatched?.length ?? 0) === 0 && (
                <div className="text-[10px] text-slate-600">No detections this frame</div>
              )}
            </DebugSection>

            {/* Section: Accumulated Teams */}
            <DebugSection title={`Tracked Teams — ${filledMyTeam.length} left · ${filledOpponents.length} right`} defaultOpen={filledMyTeam.length > 0 || filledOpponents.length > 0}>
              <div className="space-y-2">
                <div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">Your Team</div>
                  {filledMyTeam.length > 0 ? (
                    <div className="flex gap-1.5 flex-wrap">
                      {filledMyTeam.map(s => (
                        <div key={`left-${s}`} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                          <Sprite species={s} size="sm" />
                          <span className="text-[10px] text-white">{s}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-600">No left-side team accumulated yet</div>
                  )}
                </div>
                <div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">Opponent Team</div>
                  {filledOpponents.length > 0 ? (
                    <div className="flex gap-1.5 flex-wrap">
                      {filledOpponents.map(s => (
                        <div key={`right-${s}`} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20">
                          <Sprite species={s} size="sm" />
                          <span className="text-[10px] text-white">{s}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-600">No right-side team accumulated yet</div>
                  )}
                </div>
              </div>
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
              </>
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

        {/* ═══ DETECTION TRAIL — always visible audit of what the detector saw ═══ */}
        <div className="poke-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detection Trail</div>
              <div className="text-[10px] text-slate-600">
                {detectionTrail.length} cached snapshot{detectionTrail.length === 1 ? '' : 's'} · last 2h
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[10px] text-slate-600 hidden sm:block">lineup locks + W/L candidates</div>
              {detectionTrail.length > 0 && (
                <>
                  <button
                    onClick={handleExportDetectionTrail}
                    className="text-[10px] px-2 py-0.5 rounded border border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors"
                    title="Download a JSON bundle of every cached snapshot (images inline, metadata preserved)"
                  >
                    Export Trail
                  </button>
                  <button
                    onClick={handleClearDetectionTrail}
                    className="text-[10px] px-2 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    title="Delete every cached audit snapshot (lineup locks + W/L candidates)"
                  >
                    Clear Trail
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
            Every frame the matcher or result-detector fires on gets persisted here with the raw HSV signals / matcher scores / vote tallies burned into the image. Lineup snapshots fire whenever a slot locks AND on a 6s heartbeat during any selection screen so you can audit near-miss matches. W/L candidates capture every HSV trigger, including ones that never progressed to a recorded match — use these to diagnose false-positive wins caused by in-game effects. Use the download ↓ on any card to save the PNG + metadata sidecar, × to delete, or Export Trail to save the whole trail as one JSON bundle for offline review. Clear Trail wipes all audit snapshots (Match History frames are preserved).
          </p>
          {detectionTrail.length === 0 ? (
            <div className="text-xs text-slate-600 text-center py-6">
              No audit frames cached in the last 2 hours. Start scanning and sit on a selection or result screen — snapshots will appear here within ~6s.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[600px] overflow-y-auto">
              {detectionTrail.map(frame => (
                <DetectionTrailCard
                  key={frame.id}
                  frame={frame}
                  onDelete={handleDeleteTrailFrame}
                  onSave={handleSaveTrailFrame}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ CAPTURE REVIEW — fullscreen alignment (raw / crop / overlay) ═══ */}
      {captureReviewOpen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/93 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="capture-review-title"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-poke-border/40 bg-poke-darker/95 shrink-0">
            <div>
              <h2 id="capture-review-title" className="text-sm font-bold text-white tracking-tight">
                Capture alignment review
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5 max-w-xl leading-relaxed">
                Full screen share with ROI outline, the analysis crop, each OCR stage (what Tesseract actually reads), and the debug overlay. Turn on Debug or keep this open so snapshots refresh each scan. Press Esc to close.
              </p>
              {regionSelecting && (
                <p className="text-[10px] text-emerald-400 mt-1 font-medium">
                  Drag directly on section 1 below to draw the ROI on the full-size capture.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[10px] text-slate-400">
                Zoom
                <input
                  type="range"
                  min={50}
                  max={200}
                  value={captureReviewZoom}
                  onChange={e => setCaptureReviewZoom(Number(e.target.value))}
                  className="w-28 accent-cyan-500"
                />
                <span className="text-slate-300 w-9 tabular-nums">{captureReviewZoom}%</span>
              </label>
              {regionSelecting ? (
                <button
                  type="button"
                  onClick={cancelRegionSelection}
                  className="text-[10px] px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:text-amber-200 transition-colors"
                >
                  Cancel ROI
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => beginRegionSelection(true)}
                  disabled={!lastRawFrameUrl}
                  className={`text-[10px] px-3 py-1.5 rounded-lg border transition-colors ${
                    lastRawFrameUrl
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:text-emerald-200'
                      : 'bg-poke-surface border border-poke-border text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {captureRegion && captureRegion.w < 0.85 ? 'Redraw ROI Here' : 'Draw ROI Here'}
                </button>
              )}
              <a
                href={lastRawFrameUrl ?? '#'}
                download={`pc-capture-${Date.now()}.png`}
                onClick={(e) => { if (!lastRawFrameUrl) e.preventDefault(); }}
                aria-disabled={!lastRawFrameUrl}
                className={`text-[10px] px-3 py-1.5 rounded-lg border transition-colors ${
                  lastRawFrameUrl
                    ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300 hover:text-cyan-200'
                    : 'bg-poke-surface border border-poke-border text-slate-600 cursor-not-allowed pointer-events-none'
                }`}
              >
                Download frame
              </a>
              <button
                type="button"
                onClick={() => setCaptureReviewOpen(false)}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-poke-surface border border-poke-border text-slate-300 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-h-0">
            <div
              className="mx-auto max-w-[1800px] space-y-8 pb-8"
              style={{ zoom: captureReviewZoom / 100 } as CSSProperties}
            >
              <section className="rounded-xl border border-poke-border/50 bg-poke-surface/20 overflow-hidden">
                <div className="px-3 py-2 border-b border-poke-border/30 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  1 · Full capture (screen share)
                  {lastRawFrameDimensions ? ` · ${lastRawFrameDimensions.w}×${lastRawFrameDimensions.h}px` : ''}
                </div>
                <div className="p-2 bg-black/40">
                  {lastRawFrameUrl && lastRawFrameDimensions && lastAnalysisRegion ? (
                    <div
                      className="relative"
                      onMouseDown={regionSelecting ? handleRegionMouseDown : undefined}
                      onMouseMove={regionSelecting ? handleRegionMouseMove : undefined}
                      onMouseUp={regionSelecting ? handleRegionMouseUp : undefined}
                      style={{ cursor: regionSelecting ? 'crosshair' : 'default', userSelect: 'none' }}
                    >
                      <svg
                        viewBox={`0 0 ${lastRawFrameDimensions.w} ${lastRawFrameDimensions.h}`}
                        className="w-full h-auto max-h-[70vh] block"
                      >
                        <image
                          href={lastRawFrameUrl}
                          width={lastRawFrameDimensions.w}
                          height={lastRawFrameDimensions.h}
                          preserveAspectRatio="none"
                        />
                        <rect
                          x={lastAnalysisRegion.x * lastRawFrameDimensions.w}
                          y={lastAnalysisRegion.y * lastRawFrameDimensions.h}
                          width={lastAnalysisRegion.w * lastRawFrameDimensions.w}
                          height={lastAnalysisRegion.h * lastRawFrameDimensions.h}
                          fill="none"
                          stroke={lastAnalysisRegion.source === 'manual' ? '#34d399' : '#4ade80'}
                          strokeWidth={Math.max(2, lastRawFrameDimensions.w / 420)}
                          opacity={0.95}
                        />
                        <text
                          x={lastAnalysisRegion.x * lastRawFrameDimensions.w + 6}
                          y={Math.max(18, lastAnalysisRegion.y * lastRawFrameDimensions.h + 16)}
                          fill={lastAnalysisRegion.source === 'manual' ? '#6ee7b7' : '#86efac'}
                          fontSize={Math.max(12, lastRawFrameDimensions.w / 90)}
                          fontWeight="bold"
                          style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}
                        >
                          {lastAnalysisRegion.source === 'manual' ? 'MANUAL ROI' : lastAnalysisRegion.source === 'auto' ? 'AUTO ROI' : 'FULL FRAME'}
                        </text>
                      </svg>
                      {regionSelecting && (
                        <div className="absolute inset-0 bg-black/35 pointer-events-none">
                          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-lg border border-emerald-500/40">
                            <span className="text-emerald-300 text-sm font-bold">Drag a large ROI here</span>
                            <span className="text-slate-400 text-xs ml-2">release to apply</span>
                          </div>
                        </div>
                      )}
                      {regionSelecting && regionDragStart && regionDragEnd && (
                        <div
                          className="absolute border-2 border-emerald-300 bg-emerald-400/10 rounded pointer-events-none"
                          style={{
                            left: `${Math.min(regionDragStart.x, regionDragEnd.x) * 100}%`,
                            top: `${Math.min(regionDragStart.y, regionDragEnd.y) * 100}%`,
                            width: `${Math.abs(regionDragEnd.x - regionDragStart.x) * 100}%`,
                            height: `${Math.abs(regionDragEnd.y - regionDragStart.y) * 100}%`,
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 py-8 text-center">No raw frame yet — wait for the next scan.</div>
                  )}
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="rounded-xl border border-poke-border/50 bg-poke-surface/20 overflow-hidden">
                  <div className="px-3 py-2 border-b border-poke-border/30 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    2 · Analysis crop (detector input)
                    {lastAnalysisCropDimensions ? ` · ${lastAnalysisCropDimensions.w}×${lastAnalysisCropDimensions.h}px` : ''}
                  </div>
                  <div className="p-2 bg-black/40 flex justify-center">
                    {lastAnalysisCropUrl ? (
                      <img src={lastAnalysisCropUrl} alt="Analysis crop passed to detector" className="max-w-full h-auto max-h-[65vh] object-contain" />
                    ) : (
                      <div className="text-[10px] text-slate-500 py-8 text-center px-4 leading-relaxed">
                        No crop snapshot yet. Keep this dialog open or turn on Debug — snapshots refresh each scan.
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-poke-border/50 bg-poke-surface/20 overflow-hidden">
                  <div className="px-3 py-2 border-b border-poke-border/30 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    3 · Annotated overlay (sprites / guides)
                    {lastRawFrameDimensions ? ` · ${lastRawFrameDimensions.w}×${lastRawFrameDimensions.h}px` : ''}
                  </div>
                  <div className="p-2 bg-black/40 flex justify-center">
                    {lastFrameUrl ? (
                      <img src={lastFrameUrl} alt="Debug annotation overlay" className="max-w-full h-auto max-h-[65vh] object-contain" />
                    ) : (
                      <div className="text-[10px] text-slate-500 py-8 text-center px-4 leading-relaxed">
                        No overlay yet — enable Debug and wait for a scan.
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <section className="rounded-xl border border-poke-border/50 bg-poke-surface/20 overflow-hidden">
                <div className="px-3 py-2 border-b border-poke-border/30 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  4 · OCR pipeline (exact Tesseract inputs)
                </div>
                <div className="p-3 bg-black/40">
                  {lastOcrResult?.debugSnapshots && lastOcrResult.debugSnapshots.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                      {lastOcrResult.debugSnapshots.map((snap, i) => (
                        <div key={i} className="rounded-lg border border-poke-border/35 bg-black/30 overflow-hidden">
                          <div className="px-2 py-1.5 text-[9px] text-slate-400 font-mono leading-snug border-b border-poke-border/25">
                            {snap.label}
                          </div>
                          <div className="p-2 flex justify-center bg-black/20">
                            <img
                              src={snap.dataUrl}
                              alt=""
                              className="max-w-full h-auto max-h-[42vh] object-contain [image-rendering:pixelated]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 py-6 text-center px-4 leading-relaxed">
                      No OCR pipeline snapshots yet. Turn on <span className="text-slate-400 font-bold">Debug</span> or keep this dialog open, then wait for the next scan (monitor or preview).
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

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
