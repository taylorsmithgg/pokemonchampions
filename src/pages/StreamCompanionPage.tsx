import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sprite } from '../components/Sprite';
import { QuickTeamInput } from '../components/QuickTeamInput';
import { ScreenCapturePanel } from '../components/ScreenCapturePanel';
import { getPokemonData, getTypeEffectiveness } from '../data/champions';
import { getTierForPokemon, TIER_DEFINITIONS } from '../data/tierlist';
import { useTeam } from '../contexts/TeamContext';
import { inferOpenerStrategy, orderBringList } from '../calc/openerStrategy';


// ─── Types ────────────────────────────────────────────────────────

interface MatchRecord {
  id: string;
  timestamp: number;
  opponentTeam: string[];
  result: 'win' | 'loss';
}

type SourceMode = 'manual' | 'twitch' | 'screen';
type GamePhase = 'idle' | 'preview' | 'battle';

// ─── LocalStorage helpers ─────────────────────────────────────────

const HISTORY_KEY = 'stream-companion-history';
const CHANNEL_KEY = 'stream-companion-channel';

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

// ─── Phase config ────────────────────────────────────────────────

const PHASE_CONFIG: Record<GamePhase, { label: string; color: string; desc: string }> = {
  idle:    { label: 'Between Games', color: '#6B7280', desc: 'Ready for next match' },
  preview: { label: 'Team Preview',  color: '#F59E0B', desc: 'Enter opponent team below' },
  battle:  { label: 'In Battle',     color: '#EF4444', desc: 'Battle in progress' },
};

// ─── Twitch Embed ────────────────────────────────────────────────

function TwitchEmbed({ channel }: { channel: string }) {
  if (!channel) return null;
  const embedUrl = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${window.location.hostname}&muted=true`;

  return (
    <div className="w-full aspect-video rounded-lg overflow-hidden border border-poke-border bg-black">
      <iframe
        src={embedUrl}
        className="w-full h-full"
        allowFullScreen
        allow="autoplay; encrypted-media"
      />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export function StreamCompanionPage() {
  const { team: contextTeam } = useTeam();

  // ─── Core state ────────────────────────────────────────────────
  const [isOverlay, setIsOverlay] = useState(false);
  const [history, setHistory] = useState<MatchRecord[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [opponentTeam, setOpponentTeam] = useState<string[]>([]);
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [sessionStart] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [lastResult, setLastResult] = useState<'win' | 'loss' | null>(null);

  // Source mode
  const [sourceMode, setSourceMode] = useState<SourceMode>('manual');
  const [channel, setChannel] = useState(() => loadChannel());
  const [channelInput, setChannelInput] = useState(() => loadChannel());
  const [channelConnected, setChannelConnected] = useState(() => !!loadChannel());

  // Persist history
  useEffect(() => { saveHistory(history); }, [history]);

  // Session timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - sessionStart), 1000);
    return () => clearInterval(t);
  }, [sessionStart]);

  // ─── Derived data ──────────────────────────────────────────────
  const filledMyTeam = useMemo(
    () => contextTeam.filter(t => t.species).map(t => t.species),
    [contextTeam],
  );
  const filledOpponents = useMemo(() => opponentTeam.filter(Boolean), [opponentTeam]);

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

  const recordMatch = useCallback((result: 'win' | 'loss') => {
    const record: MatchRecord = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      opponentTeam: filledOpponents,
      result,
    };
    setHistory(prev => [record, ...prev]);
    setLastResult(result);
    setOpponentTeam([]);
    // Flash result, then reset after a moment
    setTimeout(() => setLastResult(null), 2000);
  }, [filledOpponents]);

  const deleteMatch = useCallback((id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    if (confirm('Clear all match history? This cannot be undone.')) {
      setHistory([]);
    }
  }, []);

  const handleConnectChannel = useCallback(() => {
    const trimmed = channelInput.trim().toLowerCase();
    setChannel(trimmed);
    saveChannel(trimmed);
    setChannelConnected(!!trimmed);
  }, [channelInput]);

  const handleDisconnectChannel = useCallback(() => {
    setChannel('');
    setChannelInput('');
    saveChannel('');
    setChannelConnected(false);
  }, []);

  const handleScreenDetected = useCallback((species: string[]) => {
    setOpponentTeam(species);
    if (species.length > 0) setGamePhase('preview');
  }, []);

  // Auto-set phase based on opponent input
  useEffect(() => {
    if (filledOpponents.length > 0 && gamePhase === 'idle') {
      setGamePhase('preview');
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

  if (isOverlay) {
    return (
      <div className="text-white min-h-screen" style={{ background: 'linear-gradient(135deg, rgba(10,10,20,0.92) 0%, rgba(15,12,30,0.88) 100%)' }}>
        {/* Top bar */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-white/60 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[45%] bg-poke-red" />
              <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-white/80" />
            </div>
            <span className="text-xs font-bold tracking-wide text-white/80">CHAMPIONS</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-black text-xl tracking-tight">{wins}</span>
              <span className="text-white/20 font-black">:</span>
              <span className="text-red-400 font-black text-xl tracking-tight">{losses}</span>
            </div>
            {totalGames > 0 && (
              <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                winRate >= 60 ? 'bg-emerald-500/20 text-emerald-400' :
                winRate >= 50 ? 'bg-amber-500/20 text-amber-300' :
                'bg-red-500/20 text-red-400'
              }`}>{winRate}%</span>
            )}
            {streak.count >= 2 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                streak.type === 'win' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
              }`}>{streak.count}{streak.type === 'win' ? 'W' : 'L'} streak</span>
            )}
          </div>
          <button onClick={() => setIsOverlay(false)} className="text-white/20 hover:text-white/60 text-xs">Exit</button>
        </div>

        {/* Streak dots */}
        {history.length > 0 && (
          <div className="px-4 py-1.5 flex items-center gap-0.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            {history.slice(0, 20).map(h => (
              <div key={h.id} className={`w-2 h-2 rounded-full transition-all ${
                h.result === 'win' ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50' :
                'bg-red-400 shadow-sm shadow-red-500/50'
              }`} />
            ))}
            {totalGames > 0 && <span className="text-[9px] text-white/20 ml-auto">{totalGames} games</span>}
          </div>
        )}

        {/* Opponent Team */}
        {filledOpponents.length > 0 ? (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="text-[9px] text-white/30 uppercase tracking-widest font-bold mb-2">OPPONENT</div>
            <div className="flex gap-2">
              {filledOpponents.map(opp => (
                <div key={opp} className="flex flex-col items-center gap-0.5">
                  <Sprite species={opp} size="md" />
                  <span className="text-[9px] text-white/50">{opp}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 text-center">
            <div className="text-white/15 text-xs">Waiting for opponent team...</div>
          </div>
        )}

        {/* Archetype */}
        {archetypes.length > 0 && (
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">TYPE</span>
              <span className="text-sm font-bold text-poke-gold">{archetypes[0].name}</span>
              {archetypes[0].counterTips?.[0] && <span className="text-[10px] text-white/30 ml-auto">{archetypes[0].counterTips[0]}</span>}
            </div>
          </div>
        )}

        {/* Bring List */}
        {bringList.length > 0 && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="text-[9px] text-white/30 uppercase tracking-widest font-bold mb-2">BRING LIST</div>
            <div className="space-y-1.5">
              {orderedBringList.slice(0, 4).map((rec, i) => (
                <div key={rec.species} className={`flex items-center gap-2 px-2 py-1 rounded ${
                  i < 2 ? 'bg-white/[0.03]' : 'opacity-50'
                }`}>
                  <span className={`text-[10px] font-black w-4 ${
                    i === 0 ? 'text-poke-gold' : i < 2 ? 'text-white/40' : 'text-white/20'
                  }`}>{i + 1}</span>
                  <Sprite species={rec.species} size="sm" />
                  <span className="text-xs text-white/80 font-medium flex-1">{rec.species}</span>
                  <span className="text-[8px] text-white/25 font-bold">{rec.role}</span>
                  <span className={`text-[10px] font-mono ${rec.score >= 3 ? 'text-emerald-400/60' : rec.score >= 0 ? 'text-white/20' : 'text-red-400/60'}`}>
                    {rec.score >= 0 ? '+' : ''}{rec.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opener Strategy (compact overlay version) */}
        {openerStrategy && (
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="text-[9px] text-white/30 uppercase tracking-widest font-bold mb-1.5">LEAD — {openerStrategy.archetype}</div>
            <div className="flex items-center gap-2 mb-1.5">
              <Sprite species={openerStrategy.lead[0]} size="md" />
              <span className="text-white/15 text-xs">+</span>
              <Sprite species={openerStrategy.lead[1]} size="md" />
            </div>
            <div className="text-[9px] text-sky-400/60 uppercase tracking-widest font-bold mb-1">T1</div>
            <div className="text-[10px] text-white/60 mb-0.5">{openerStrategy.lead[0]}: {openerStrategy.turn1.mon1Action}</div>
            <div className="text-[10px] text-white/60 mb-1">{openerStrategy.lead[1]}: {openerStrategy.turn1.mon2Action}</div>
            <div className="text-[9px] text-white/25 uppercase tracking-widest font-bold mb-0.5">T2</div>
            <div className="text-[10px] text-white/40">{openerStrategy.turn2.action}</div>
          </div>
        )}

        {/* Legacy Lead fallback */}
        {!openerStrategy && leadSuggestion && (
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="text-[9px] text-white/30 uppercase tracking-widest font-bold mb-1.5">LEAD</div>
            <div className="flex items-center gap-2">
              <Sprite species={leadSuggestion.lead1} size="md" />
              <span className="text-white/15 text-xs">+</span>
              <Sprite species={leadSuggestion.lead2} size="md" />
            </div>
          </div>
        )}

        {/* W/L buttons */}
        <div className="px-4 py-3 flex gap-2">
          <button
            onClick={() => recordMatch('win')}
            className="flex-1 py-2 rounded-lg font-black text-sm tracking-wider transition-all bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 hover:border-emerald-500/40 active:scale-95"
          >
            WIN
          </button>
          <button
            onClick={() => recordMatch('loss')}
            className="flex-1 py-2 rounded-lg font-black text-sm tracking-wider transition-all bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/25 hover:border-red-500/40 active:scale-95"
          >
            LOSS
          </button>
        </div>
      </div>
    );
  }

  // ─── Full Layout ───────────────────────────────────────────────

  const phaseConf = PHASE_CONFIG[gamePhase];

  return (
    <div className="min-h-screen bg-poke-darkest text-white flex flex-col">
      {/* ═══ STICKY TOP BAR: Scoreboard + Controls ═══ */}
      <header className="border-b border-poke-border bg-gradient-to-r from-poke-darker via-poke-dark to-poke-darker sticky top-0 z-40">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-poke-red to-transparent" />
        <div className="max-w-3xl mx-auto px-4 py-2">
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
                onClick={() => setIsOverlay(true)}
                className="text-[10px] px-2 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded hover:text-poke-gold hover:border-poke-gold/40 transition-colors"
                title="OBS overlay mode"
              >
                Overlay
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
              <span className="text-xs text-slate-600 font-mono">{formatElapsed(elapsed)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-4 space-y-4">

        {/* ═══ GAME PHASE INDICATOR ═══ */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all"
          style={{
            backgroundColor: `${phaseConf.color}10`,
            borderColor: `${phaseConf.color}30`,
          }}
        >
          <div className="relative">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: phaseConf.color }}
            />
            {gamePhase !== 'idle' && (
              <div
                className="absolute inset-0 w-3 h-3 rounded-full animate-ping opacity-40"
                style={{ backgroundColor: phaseConf.color }}
              />
            )}
          </div>
          <div className="flex-1">
            <span className="text-sm font-bold" style={{ color: phaseConf.color }}>{phaseConf.label}</span>
            <span className="text-xs text-slate-500 ml-2">{phaseConf.desc}</span>
          </div>
          {/* Phase toggle buttons */}
          <div className="flex gap-1">
            {(['idle', 'preview', 'battle'] as GamePhase[]).map(p => (
              <button
                key={p}
                onClick={() => setGamePhase(p)}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all border ${
                  gamePhase === p
                    ? 'text-white border-transparent'
                    : 'text-slate-500 border-poke-border bg-poke-surface hover:text-white'
                }`}
                style={gamePhase === p ? { backgroundColor: phaseConf.color, borderColor: phaseConf.color } : undefined}
              >
                {PHASE_CONFIG[p].label.split(' ').pop()}
              </button>
            ))}
          </div>
        </div>

        {/* Result flash banner */}
        {lastResult && (
          <div
            className={`text-center py-3 rounded-xl font-black text-lg animate-pulse ${
              lastResult === 'win'
                ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                : 'bg-red-900/40 text-red-300 border border-red-700/50'
            }`}
          >
            {lastResult === 'win' ? 'VICTORY' : 'DEFEAT'}
          </div>
        )}

        {/* ═══ YOUR TEAM (compact strip) ═══ */}
        <div className="poke-panel px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold shrink-0">Your Team</span>
            {filledMyTeam.length > 0 ? (
              <div className="flex items-center gap-2 flex-wrap flex-1">
                {filledMyTeam.map(species => (
                  <div key={species} className="flex items-center gap-1">
                    <Sprite species={species} size="sm" />
                    <span className="text-xs text-slate-300">{species}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Link
                to="/team-builder"
                className="text-xs text-poke-blue hover:text-poke-blue-light transition-colors"
              >
                Load team in Builder &rarr;
              </Link>
            )}
          </div>
        </div>

        {/* ═══ SOURCE PANEL (tabbed) ═══ */}
        <div className="poke-panel overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-poke-border">
            {([
              { key: 'manual' as SourceMode, label: 'Manual' },
              { key: 'twitch' as SourceMode, label: 'Twitch' },
              { key: 'screen' as SourceMode, label: 'Screen Capture' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setSourceMode(tab.key)}
                className={`flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                  sourceMode === tab.key
                    ? 'text-white bg-poke-surface border-b-2 border-poke-red'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-4">
            {sourceMode === 'twitch' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={channelInput}
                    onChange={e => setChannelInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleConnectChannel()}
                    placeholder="Twitch channel name..."
                    className="flex-1 px-3 py-2 bg-poke-surface border border-poke-border rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-purple-500/50 focus:outline-none"
                  />
                  <button
                    onClick={handleConnectChannel}
                    className="px-4 py-2 bg-purple-600/20 border border-purple-500/40 text-purple-400 rounded-lg text-xs font-bold hover:bg-purple-600/30 transition-colors"
                  >
                    {channelConnected && channel ? 'Update' : 'Connect'}
                  </button>
                  {channelConnected && channel && (
                    <button
                      onClick={handleDisconnectChannel}
                      className="px-3 py-2 bg-poke-surface border border-poke-border text-slate-500 rounded-lg text-xs hover:text-red-400 transition-colors"
                    >
                      Stop
                    </button>
                  )}
                </div>
                {channelConnected && channel && <TwitchEmbed channel={channel} />}
                {!channelConnected && (
                  <div className="text-xs text-slate-600 text-center py-2">
                    Enter a Twitch channel to embed the stream. You will still need to enter opponents manually.
                  </div>
                )}
              </div>
            )}

            {sourceMode === 'screen' && (
              <ScreenCapturePanel onDetected={handleScreenDetected} />
            )}

            {sourceMode === 'manual' && (
              <div className="text-xs text-slate-500 text-center py-2">
                Type opponent Pokemon names below. No video source needed.
              </div>
            )}
          </div>
        </div>

        {/* ═══ OPPONENT TEAM INPUT ═══ */}
        <div className="poke-panel p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-poke-red uppercase tracking-wider">Opponent Team</div>
            <div className="text-[10px] text-slate-600">Type names, Tab to accept | Paste to bulk-add</div>
          </div>
          <QuickTeamInput
            value={filledOpponents}
            onChange={setOpponentTeam}
            maxSlots={6}
          />
        </div>

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

        {/* ═══ MATCH HISTORY (collapsible) ═══ */}
        {showHistory && (
          <div className="poke-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Match History</div>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-[10px] text-slate-600 hover:text-red-400 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <div className="text-xs text-slate-600 text-center py-4">No matches recorded yet.</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {history.map(match => (
                  <div key={match.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-poke-border bg-poke-surface/30">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0 ${
                      match.result === 'win' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {match.result === 'win' ? 'W' : 'L'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-slate-500">vs</span>
                        {match.opponentTeam.map(opp => (
                          <Sprite key={opp} species={opp} size="sm" />
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-600">
                        {new Date(match.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteMatch(match.id)}
                      className="text-slate-700 hover:text-red-400 transition-colors p-1 shrink-0"
                      title="Delete match"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ STICKY BOTTOM: W/L BUTTONS ═══ */}
      <div className="sticky bottom-0 z-40 border-t border-poke-border bg-poke-darker/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-3">
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
