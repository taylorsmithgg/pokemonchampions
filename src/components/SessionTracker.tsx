import { useState, useEffect, useRef, useCallback } from 'react';
import { Sprite } from './Sprite';

// ─── Types ──────────────────────────────────────────────────────────

type BattleState = 'idle' | 'preview' | 'battle' | 'result';

interface MatchEvent {
  turn: number;
  type: 'ko_opponent' | 'ko_self' | 'switch';
  pokemon: string;
  timestamp: number;
}

interface MatchRecord {
  id: string;
  result: 'win' | 'loss';
  opponentTeam: string[];
  myBringList: string[];
  events: MatchEvent[];
  startTime: number;
  endTime: number;
}

interface SessionData {
  id: string;
  name: string;
  startTime: number;
  endTime: number | null;
  matches: MatchRecord[];
}

interface SessionTrackerProps {
  myTeam: string[];
  opponentTeam: string[];
  onStateChange: (state: BattleState) => void;
  onRecordResult: (result: 'win' | 'loss') => void;
}

// ─── localStorage helpers ───────────────────────────────────────────

const STORAGE_KEY = 'stream-sessions';

function loadSessions(): SessionData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: SessionData[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function defaultSessionName(): string {
  const now = new Date();
  return `Session ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// ─── State indicator config ─────────────────────────────────────────

const STATE_CONFIG: Record<BattleState, { label: string; color: string; bgClass: string; pulse: boolean }> = {
  idle:    { label: 'Between Games', color: '#6B7280', bgClass: 'bg-gray-600',    pulse: false },
  preview: { label: 'Team Preview',  color: '#F59E0B', bgClass: 'bg-amber-500',   pulse: true },
  battle:  { label: 'In Battle',     color: '#EF4444', bgClass: 'bg-red-500',     pulse: true },
  result:  { label: 'Match Complete', color: '#10B981', bgClass: 'bg-emerald-500', pulse: false },
};

// ─── Component ──────────────────────────────────────────────────────

export function SessionTracker({ myTeam, opponentTeam, onStateChange, onRecordResult }: SessionTrackerProps) {
  // Session state
  const [session, setSession] = useState<SessionData | null>(null);
  const [sessionName, setSessionName] = useState(defaultSessionName());
  const [battleState, setBattleState] = useState<BattleState>('idle');
  const [elapsed, setElapsed] = useState(0);

  // Current match state
  const [currentEvents, setCurrentEvents] = useState<MatchEvent[]>([]);
  const [currentTurn, setCurrentTurn] = useState(1);
  const [myRemaining, setMyRemaining] = useState(4);
  const [oppRemaining, setOppRemaining] = useState(4);
  const [matchStartTime, setMatchStartTime] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<'win' | 'loss' | null>(null);

  // History
  const [savedSessions, setSavedSessions] = useState<SessionData[]>(() => loadSessions());
  const [showHistory, setShowHistory] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Session timer ──────────────────────────────────────────────

  useEffect(() => {
    if (session && !session.endTime) {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - session.startTime);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session]);

  // ─── Keyboard shortcuts ─────────────────────────────────────────

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!session || session.endTime) return;
      // Don't capture when typing in inputs
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      switch (e.key) {
        case '1': changeBattleState('idle'); break;
        case '2': changeBattleState('preview'); break;
        case '3': changeBattleState('battle'); break;
        case 'w': if (battleState === 'battle' || battleState === 'result') recordResult('win'); break;
        case 'l': if (battleState === 'battle' || battleState === 'result') recordResult('loss'); break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [session, battleState]);

  // ─── State transitions ──────────────────────────────────────────

  const changeBattleState = useCallback((newState: BattleState) => {
    setBattleState(newState);
    onStateChange(newState);

    if (newState === 'battle' && !matchStartTime) {
      setMatchStartTime(Date.now());
      setCurrentTurn(1);
      setCurrentEvents([]);
      setMyRemaining(4);
      setOppRemaining(4);
      setLastResult(null);
    }
    if (newState === 'idle') {
      setMatchStartTime(null);
      setCurrentEvents([]);
      setCurrentTurn(1);
      setMyRemaining(4);
      setOppRemaining(4);
      setLastResult(null);
    }
  }, [matchStartTime, onStateChange]);

  // ─── Match events ──────────────────────────────────────────────

  function addEvent(type: MatchEvent['type'], pokemon: string) {
    const event: MatchEvent = {
      turn: currentTurn,
      type,
      pokemon,
      timestamp: Date.now(),
    };
    setCurrentEvents(prev => [...prev, event]);

    if (type === 'ko_opponent') {
      const next = oppRemaining - 1;
      setOppRemaining(next);
      if (next <= 0) recordResult('win');
    }
    if (type === 'ko_self') {
      const next = myRemaining - 1;
      setMyRemaining(next);
      if (next <= 0) recordResult('loss');
    }
  }

  // ─── Record result ─────────────────────────────────────────────

  function recordResult(result: 'win' | 'loss') {
    if (!session) return;

    const match: MatchRecord = {
      id: generateId(),
      result,
      opponentTeam: [...opponentTeam],
      myBringList: [...myTeam],
      events: currentEvents,
      startTime: matchStartTime || Date.now(),
      endTime: Date.now(),
    };

    const updated: SessionData = {
      ...session,
      matches: [...session.matches, match],
    };
    setSession(updated);
    setLastResult(result);
    setBattleState('result');
    onStateChange('result');
    onRecordResult(result);

    // Persist
    const all = loadSessions();
    const idx = all.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      all[idx] = updated;
    } else {
      all.push(updated);
    }
    saveSessions(all);
    setSavedSessions(all);
  }

  // ─── Session management ─────────────────────────────────────────

  function startNewSession() {
    const s: SessionData = {
      id: generateId(),
      name: sessionName || defaultSessionName(),
      startTime: Date.now(),
      endTime: null,
      matches: [],
    };
    setSession(s);
    setElapsed(0);
    setBattleState('idle');
    setCurrentEvents([]);
    setCurrentTurn(1);
    setMyRemaining(4);
    setOppRemaining(4);
    setMatchStartTime(null);
    setLastResult(null);
    onStateChange('idle');

    const all = loadSessions();
    all.push(s);
    saveSessions(all);
    setSavedSessions(all);
  }

  function endSession() {
    if (!session) return;
    const ended: SessionData = { ...session, endTime: Date.now() };
    const all = loadSessions();
    const idx = all.findIndex(s => s.id === session.id);
    if (idx >= 0) all[idx] = ended;
    saveSessions(all);
    setSavedSessions(all);
    setSession(null);
    setBattleState('idle');
    onStateChange('idle');
  }

  // ─── Computed stats ─────────────────────────────────────────────

  const matches = session?.matches || [];
  const wins = matches.filter(m => m.result === 'win').length;
  const losses = matches.filter(m => m.result === 'loss').length;
  const totalGames = matches.length;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  // Most common opponent Pokemon
  const oppCounts: Record<string, number> = {};
  matches.forEach(m => {
    m.opponentTeam.forEach(p => {
      if (p) oppCounts[p] = (oppCounts[p] || 0) + 1;
    });
  });
  const topOpponents = Object.entries(oppCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Most brought Pokemon
  const bringCounts: Record<string, number> = {};
  matches.forEach(m => {
    m.myBringList.forEach(p => {
      if (p) bringCounts[p] = (bringCounts[p] || 0) + 1;
    });
  });
  const topBrings = Object.entries(bringCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Best/worst matchup: Pokemon that appeared most in wins vs losses
  const pokemonWinLoss: Record<string, { wins: number; losses: number }> = {};
  matches.forEach(m => {
    m.opponentTeam.forEach(p => {
      if (!p) return;
      if (!pokemonWinLoss[p]) pokemonWinLoss[p] = { wins: 0, losses: 0 };
      if (m.result === 'win') pokemonWinLoss[p].wins++;
      else pokemonWinLoss[p].losses++;
    });
  });
  const matchupEntries = Object.entries(pokemonWinLoss).filter(([, v]) => v.wins + v.losses >= 2);
  const bestMatchup = matchupEntries.length > 0
    ? matchupEntries.sort((a, b) => (b[1].wins / (b[1].wins + b[1].losses)) - (a[1].wins / (a[1].wins + a[1].losses)))[0]
    : null;
  const worstMatchup = matchupEntries.length > 0
    ? matchupEntries.sort((a, b) => (a[1].wins / (a[1].wins + a[1].losses)) - (b[1].wins / (b[1].wins + b[1].losses)))[0]
    : null;

  // Average match duration
  const matchDurations = matches.filter(m => m.endTime && m.startTime).map(m => m.endTime - m.startTime);
  const avgDuration = matchDurations.length > 0
    ? Math.round(matchDurations.reduce((a, b) => a + b, 0) / matchDurations.length)
    : 0;

  // ─── State indicator ───────────────────────────────────────────

  const stateConf = STATE_CONFIG[battleState];
  const resultColor = lastResult === 'win' ? '#10B981' : lastResult === 'loss' ? '#EF4444' : stateConf.color;
  const indicatorColor = battleState === 'result' ? resultColor : stateConf.color;

  // ─── Render: No active session ──────────────────────────────────

  if (!session) {
    return (
      <div className="poke-panel">
        <div className="poke-panel-header flex items-center justify-between">
          <h3 className="text-white font-bold text-base">Session Tracker</h3>
          {savedSessions.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              {showHistory ? 'Hide History' : `History (${savedSessions.length})`}
            </button>
          )}
        </div>
        <div className="p-5">
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
              placeholder="Session name..."
              className="w-full px-3 py-2 rounded-lg bg-poke-surface border border-poke-border text-white text-sm placeholder-slate-500 focus:outline-none focus:border-poke-blue"
            />
            <button
              onClick={startNewSession}
              className="w-full px-4 py-2.5 rounded-lg bg-poke-blue hover:bg-poke-blue-dark text-white font-semibold text-sm transition-colors"
            >
              New Session
            </button>
          </div>

          {/* Session history */}
          {showHistory && savedSessions.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Past Sessions</h4>
              {savedSessions
                .filter(s => s.endTime)
                .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
                .slice(0, 10)
                .map(s => {
                  const sWins = s.matches.filter(m => m.result === 'win').length;
                  const sLosses = s.matches.filter(m => m.result === 'loss').length;
                  const sRate = s.matches.length > 0 ? Math.round((sWins / s.matches.length) * 100) : 0;
                  return (
                    <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-poke-surface border border-poke-border">
                      <div>
                        <div className="text-sm text-white font-medium">{s.name}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(s.startTime).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">
                          <span className="text-emerald-400">{sWins}W</span>
                          <span className="text-slate-500"> / </span>
                          <span className="text-red-400">{sLosses}L</span>
                        </div>
                        <div className="text-xs text-slate-500">{sRate}% WR</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Render: Active session ─────────────────────────────────────

  return (
    <div className="poke-panel">
      {/* Header */}
      <div className="poke-panel-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* State indicator dot */}
          <div className="relative flex items-center justify-center">
            <div
              className={`w-3 h-3 rounded-full ${stateConf.pulse ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: indicatorColor }}
            />
            {stateConf.pulse && (
              <div
                className="absolute w-3 h-3 rounded-full animate-ping opacity-40"
                style={{ backgroundColor: indicatorColor }}
              />
            )}
          </div>
          <div>
            <h3 className="text-white font-bold text-base leading-tight">{session.name}</h3>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span style={{ color: indicatorColor }}>{stateConf.label}</span>
              <span className="text-slate-600">|</span>
              <span className="font-mono">{formatElapsed(elapsed)}</span>
            </div>
          </div>
        </div>
        <button
          onClick={endSession}
          className="px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/70 text-red-300 text-xs font-medium transition-colors border border-red-800/50"
        >
          End Session
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* ─── Scoreboard ────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-black text-emerald-400">{wins}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Wins</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-slate-300">{winRate}%</div>
            <div className="text-xs text-slate-500">WR</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-red-400">{losses}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Losses</div>
          </div>
        </div>

        {/* ─── State controls ────────────────────────────────────── */}
        <div className="flex gap-2">
          {(['idle', 'preview', 'battle'] as BattleState[]).map(st => {
            const conf = STATE_CONFIG[st];
            const isActive = battleState === st;
            return (
              <button
                key={st}
                onClick={() => changeBattleState(st)}
                className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  isActive
                    ? 'text-white border-transparent'
                    : 'text-slate-400 border-poke-border hover:text-white hover:border-poke-border-light bg-poke-surface'
                }`}
                style={isActive ? { backgroundColor: conf.color, borderColor: conf.color } : undefined}
              >
                {conf.label}
                <span className="block text-[10px] font-normal opacity-60 mt-0.5">
                  {st === 'idle' ? '[1]' : st === 'preview' ? '[2]' : '[3]'}
                </span>
              </button>
            );
          })}
        </div>

        {/* ─── Battle interface ──────────────────────────────────── */}
        {(battleState === 'battle' || battleState === 'result') && (
          <div className="space-y-3">
            {/* Turn counter + remaining */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 uppercase tracking-wider">Turn</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentTurn(t => Math.max(1, t - 1))}
                    className="w-6 h-6 rounded bg-poke-surface border border-poke-border text-slate-400 hover:text-white text-xs flex items-center justify-center transition-colors"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-white font-bold text-lg">{currentTurn}</span>
                  <button
                    onClick={() => setCurrentTurn(t => t + 1)}
                    className="w-6 h-6 rounded bg-poke-surface border border-poke-border text-slate-400 hover:text-white text-xs flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-emerald-400 font-bold">{myRemaining} left</span>
                <span className="text-slate-600">vs</span>
                <span className="text-red-400 font-bold">{oppRemaining} left</span>
              </div>
            </div>

            {/* Quick event buttons — opponent KOs */}
            {opponentTeam.filter(Boolean).length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-1.5">KO'd opponent</div>
                <div className="flex flex-wrap gap-1.5">
                  {opponentTeam.filter(Boolean).map(mon => (
                    <button
                      key={`ko-opp-${mon}`}
                      onClick={() => addEvent('ko_opponent', mon)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-900/30 border border-emerald-800/50 hover:bg-emerald-900/60 text-emerald-300 text-xs font-medium transition-colors"
                      disabled={battleState === 'result'}
                    >
                      <Sprite species={mon} size="sm" />
                      <span>{mon}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick event buttons — my KOs */}
            {myTeam.filter(Boolean).length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-1.5">Lost my</div>
                <div className="flex flex-wrap gap-1.5">
                  {myTeam.filter(Boolean).map(mon => (
                    <button
                      key={`ko-self-${mon}`}
                      onClick={() => addEvent('ko_self', mon)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-900/30 border border-red-800/50 hover:bg-red-900/60 text-red-300 text-xs font-medium transition-colors"
                      disabled={battleState === 'result'}
                    >
                      <Sprite species={mon} size="sm" />
                      <span>{mon}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Switch button */}
            <button
              onClick={() => addEvent('switch', '')}
              className="w-full px-3 py-1.5 rounded-lg bg-poke-surface border border-poke-border hover:border-poke-border-light text-slate-300 text-xs font-medium transition-colors"
              disabled={battleState === 'result'}
            >
              Switch
            </button>

            {/* Result buttons */}
            {battleState === 'battle' && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => recordResult('win')}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors"
                >
                  WIN [W]
                </button>
                <button
                  onClick={() => recordResult('loss')}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors"
                >
                  LOSS [L]
                </button>
              </div>
            )}

            {/* Result banner */}
            {battleState === 'result' && lastResult && (
              <div
                className={`text-center py-3 rounded-lg font-black text-lg ${
                  lastResult === 'win'
                    ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                    : 'bg-red-900/40 text-red-300 border border-red-700/50'
                }`}
              >
                {lastResult === 'win' ? 'VICTORY' : 'DEFEAT'}
              </div>
            )}

            {/* Match timeline */}
            {currentEvents.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider">Timeline</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {currentEvents.map((evt, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-poke-surface text-xs"
                    >
                      <span className="text-slate-600 font-mono w-6 shrink-0">T{evt.turn}</span>
                      {evt.type === 'ko_opponent' && (
                        <>
                          <span className="text-emerald-400">KO</span>
                          {evt.pokemon && <Sprite species={evt.pokemon} size="sm" />}
                          <span className="text-slate-300">{evt.pokemon}</span>
                        </>
                      )}
                      {evt.type === 'ko_self' && (
                        <>
                          <span className="text-red-400">Lost</span>
                          {evt.pokemon && <Sprite species={evt.pokemon} size="sm" />}
                          <span className="text-slate-300">{evt.pokemon}</span>
                        </>
                      )}
                      {evt.type === 'switch' && (
                        <span className="text-amber-400">Switch</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next game button when result shown */}
            {battleState === 'result' && (
              <button
                onClick={() => changeBattleState('idle')}
                className="w-full px-3 py-2 rounded-lg bg-poke-blue hover:bg-poke-blue-dark text-white font-semibold text-sm transition-colors"
              >
                Next Game
              </button>
            )}
          </div>
        )}

        {/* ─── Session summary stats ─────────────────────────────── */}
        {totalGames > 0 && (
          <div className="space-y-3 pt-2 border-t border-poke-border">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Session Stats</h4>

            {/* Average match duration */}
            {avgDuration > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Avg Match Duration</span>
                <span className="text-slate-300 font-mono">{formatElapsed(avgDuration)}</span>
              </div>
            )}

            {/* Games count */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Total Games</span>
              <span className="text-slate-300 font-bold">{totalGames}</span>
            </div>

            {/* Most common opponents */}
            {topOpponents.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-1.5">Most Faced Opponents</div>
                <div className="flex flex-wrap gap-1.5">
                  {topOpponents.map(([mon, count]) => (
                    <div
                      key={mon}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-poke-surface border border-poke-border text-xs"
                    >
                      <Sprite species={mon} size="sm" />
                      <span className="text-slate-300">{mon}</span>
                      <span className="text-slate-600">x{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Most brought */}
            {topBrings.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-1.5">Most Brought</div>
                <div className="flex flex-wrap gap-1.5">
                  {topBrings.map(([mon, count]) => (
                    <div
                      key={mon}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-poke-surface border border-poke-border text-xs"
                    >
                      <Sprite species={mon} size="sm" />
                      <span className="text-slate-300">{mon}</span>
                      <span className="text-slate-600">x{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Best / worst matchup */}
            {(bestMatchup || worstMatchup) && (
              <div className="flex gap-3">
                {bestMatchup && (
                  <div className="flex-1 p-2 rounded-lg bg-emerald-900/20 border border-emerald-800/30">
                    <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1">Best Matchup</div>
                    <div className="flex items-center gap-1.5">
                      <Sprite species={bestMatchup[0]} size="sm" />
                      <div>
                        <div className="text-xs text-white font-medium">{bestMatchup[0]}</div>
                        <div className="text-[10px] text-emerald-400">
                          {bestMatchup[1].wins}W-{bestMatchup[1].losses}L
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {worstMatchup && (
                  <div className="flex-1 p-2 rounded-lg bg-red-900/20 border border-red-800/30">
                    <div className="text-[10px] text-red-500 uppercase tracking-wider mb-1">Worst Matchup</div>
                    <div className="flex items-center gap-1.5">
                      <Sprite species={worstMatchup[0]} size="sm" />
                      <div>
                        <div className="text-xs text-white font-medium">{worstMatchup[0]}</div>
                        <div className="text-[10px] text-red-400">
                          {worstMatchup[1].wins}W-{worstMatchup[1].losses}L
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
