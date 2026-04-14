import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Sprite } from '../components/Sprite';
import { SearchSelect } from '../components/SearchSelect';
import { getAvailablePokemon, getPokemonData, getTypeEffectiveness } from '../data/champions';
import { getTierForPokemon, TIER_DEFINITIONS } from '../data/tierlist';
import { useTeam } from '../contexts/TeamContext';
// PokemonState used indirectly via useTeam()

// ─── Types ────────────────────────────────────────────────────────

interface MatchRecord {
  id: string;
  timestamp: number;
  myTeam: string[];
  opponentTeam: string[];
  bringList: string[];
  result: 'win' | 'loss' | null;
  notes: string;
}

interface Scoreboard {
  wins: number;
  losses: number;
}

// ─── LocalStorage helpers ─────────────────────────────────────────

const STORAGE_KEY = 'stream-companion-history';
const CHANNEL_KEY = 'stream-companion-channel';

function loadHistory(): MatchRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: MatchRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function loadChannel(): string {
  return localStorage.getItem(CHANNEL_KEY) || '';
}

function saveChannel(channel: string) {
  localStorage.setItem(CHANNEL_KEY, channel);
}

// ─── Archetype detection (shared with BattleAssistantPage) ────────

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

// ─── Matchup scoring ──────────────────────────────────────────────

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

// ─── Bring-list recommendation ────────────────────────────────────

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

// ─── Threat analysis ──────────────────────────────────────────────

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

    const bst = Object.values(oppData.baseStats).reduce((a, b) => a + b, 0);
    const tier = getTierForPokemon(opp);
    const tierBonus = tier?.tier === 'S' ? 3 : tier?.tier === 'A' ? 2 : tier?.tier === 'B' ? 1 : 0;
    totalDanger += tierBonus;

    let reason = '';
    if (weakToCount >= 3) reason = `Threatens ${weakToCount} of your team`;
    else if (bst >= 550) reason = 'High BST threat';
    else if (tierBonus >= 2) reason = `${tier!.tier}-tier meta threat`;
    else reason = 'Solid coverage threat';

    threats.push({ species: opp, danger: totalDanger, reason });
  }

  threats.sort((a, b) => b.danger - a.danger);
  return threats;
}

// ─── Lead suggestion logic ────────────────────────────────────────

function suggestLead(bringList: BringRecommendation[], opponents: string[]): { lead1: string; lead2: string; reasoning: string } | null {
  if (bringList.length < 2) return null;

  // Try all pairs of top 4, pick the pair with best combined coverage
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

      // Bonus for Fake Out / Intimidate in the lead
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

// ─── Twitch Embed ─────────────────────────────────────────────────

function TwitchEmbed({ channel }: { channel: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (!channel) return null;

  const embedUrl = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${window.location.hostname}&muted=true`;

  return (
    <div ref={containerRef} className="w-full aspect-video rounded-lg overflow-hidden border border-poke-border bg-black">
      <iframe
        src={embedUrl}
        className="w-full h-full"
        allowFullScreen
        allow="autoplay; encrypted-media"
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export function StreamCompanionPage() {
  const { team: contextTeam } = useTeam();
  const allPokemon = useMemo(() => getAvailablePokemon(), []);

  // Overlay mode
  const [isOverlay, setIsOverlay] = useState(false);

  // Twitch channel
  const [channel, setChannel] = useState(() => loadChannel());
  const [channelInput, setChannelInput] = useState(() => loadChannel());
  const [showStream, setShowStream] = useState(() => !!loadChannel());

  // Teams
  const [myTeam, setMyTeam] = useState<string[]>(() => {
    const fromContext = contextTeam.filter(t => t.species).map(t => t.species);
    return fromContext.length > 0
      ? [...fromContext, ...Array(6 - fromContext.length).fill('')]
      : ['', '', '', '', '', ''];
  });
  const [opponentTeam, setOpponentTeam] = useState<string[]>(['', '', '', '', '', '']);

  // Battle history
  const [history, setHistory] = useState<MatchRecord[]>(() => loadHistory());
  const [selectedBring, setSelectedBring] = useState<Set<string>>(new Set());
  const [matchNotes, setMatchNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Persist history
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  // Sync context team to myTeam
  useEffect(() => {
    const fromContext = contextTeam.filter(t => t.species).map(t => t.species);
    if (fromContext.length > 0) {
      setMyTeam([...fromContext, ...Array(Math.max(0, 6 - fromContext.length)).fill('')]);
    }
  }, [contextTeam]);

  // Screenshot paste support
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const url = URL.createObjectURL(file);
            setScreenshotUrl(url);
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      setScreenshotUrl(URL.createObjectURL(file));
    }
  }, []);

  const filledMyTeam = myTeam.filter(Boolean);
  const filledOpponents = opponentTeam.filter(Boolean);

  // Analysis — starts as soon as ANY opponent is entered (live updating)
  const archetypes = useMemo(() =>
    filledOpponents.length >= 1 ? detectOpponentArchetype(filledOpponents) : [],
  [filledOpponents]);

  const bringList = useMemo(() =>
    filledOpponents.length >= 1 && filledMyTeam.length >= 2
      ? recommendBringList(myTeam, filledOpponents)
      : [],
  [myTeam, filledOpponents, filledMyTeam.length]);

  const threats = useMemo(() =>
    filledOpponents.length >= 1 && filledMyTeam.length >= 1
      ? identifyKeyThreats(filledMyTeam, filledOpponents)
      : [],
  [filledMyTeam, filledOpponents]);

  const leadSuggestion = useMemo(() =>
    bringList.length >= 2 ? suggestLead(bringList, filledOpponents) : null,
  [bringList, filledOpponents]);

  // Scoreboard
  const scoreboard = useMemo<Scoreboard>(() => {
    const wins = history.filter(h => h.result === 'win').length;
    const losses = history.filter(h => h.result === 'loss').length;
    return { wins, losses };
  }, [history]);

  const winRate = scoreboard.wins + scoreboard.losses > 0
    ? Math.round((scoreboard.wins / (scoreboard.wins + scoreboard.losses)) * 100)
    : 0;

  // Handlers
  const handleConnectChannel = useCallback(() => {
    const trimmed = channelInput.trim().toLowerCase();
    setChannel(trimmed);
    saveChannel(trimmed);
    setShowStream(!!trimmed);
  }, [channelInput]);

  const setMyTeamSlot = useCallback((index: number, species: string) => {
    setMyTeam(prev => {
      const next = [...prev];
      next[index] = species;
      return next;
    });
  }, []);

  const setOpponentSlot = useCallback((index: number, species: string) => {
    setOpponentTeam(prev => {
      const next = [...prev];
      next[index] = species;
      return next;
    });
  }, []);

  const toggleBring = useCallback((species: string) => {
    setSelectedBring(prev => {
      const next = new Set(prev);
      if (next.has(species)) next.delete(species);
      else if (next.size < 4) next.add(species);
      return next;
    });
  }, []);

  const recordMatch = useCallback((result: 'win' | 'loss') => {
    const record: MatchRecord = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      myTeam: filledMyTeam,
      opponentTeam: filledOpponents,
      bringList: Array.from(selectedBring),
      result,
      notes: matchNotes,
    };
    setHistory(prev => [record, ...prev]);
    // Reset for next match
    setOpponentTeam(['', '', '', '', '', '']);
    setSelectedBring(new Set());
    setMatchNotes('');
  }, [filledMyTeam, filledOpponents, selectedBring, matchNotes]);

  const deleteMatch = useCallback((id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
  }, []);

  // Keyboard shortcuts — W for win, L for loss (only when not typing in an input)
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (filledOpponents.length === 0) return;
      if (e.key === 'w' || e.key === 'W') { e.preventDefault(); recordMatch('win'); }
      if (e.key === 'l' || e.key === 'L') { e.preventDefault(); recordMatch('loss'); }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [filledOpponents.length, recordMatch]);

  const clearHistory = useCallback(() => {
    if (confirm('Clear all match history? This cannot be undone.')) {
      setHistory([]);
    }
  }, []);

  // ─── Overlay mode (compact for OBS browser source) ─────────────
  if (isOverlay) {
    const totalGames = scoreboard.wins + scoreboard.losses;
    const currentStreak = (() => {
      let streak = 0;
      const lastResult = history[0]?.result;
      if (!lastResult) return { count: 0, type: null as string | null };
      for (const h of history) {
        if (h.result === lastResult) streak++;
        else break;
      }
      return { count: streak, type: lastResult };
    })();

    return (
      <div className="text-white min-h-screen" style={{ background: 'linear-gradient(135deg, rgba(10,10,20,0.92) 0%, rgba(15,12,30,0.88) 100%)' }}>
        {/* Top bar — scoreboard + branding */}
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
              <span className="text-emerald-400 font-black text-xl tracking-tight">{scoreboard.wins}</span>
              <span className="text-white/20 font-black">:</span>
              <span className="text-red-400 font-black text-xl tracking-tight">{scoreboard.losses}</span>
            </div>
            {totalGames > 0 && (
              <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                winRate >= 60 ? 'bg-emerald-500/20 text-emerald-400' :
                winRate >= 50 ? 'bg-amber-500/20 text-amber-300' :
                'bg-red-500/20 text-red-400'
              }`}>{winRate}%</span>
            )}
            {currentStreak.count >= 2 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                currentStreak.type === 'win' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
              }`}>{currentStreak.count}{currentStreak.type === 'win' ? 'W' : 'L'} streak</span>
            )}
          </div>
          <button onClick={() => setIsOverlay(false)} className="text-white/20 hover:text-white/60 text-xs">✕</button>
        </div>

        {/* Streak dots */}
        {history.length > 0 && (
          <div className="px-4 py-1.5 flex items-center gap-0.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            {history.slice(0, 20).map(h => (
              <div key={h.id} className={`w-2 h-2 rounded-full transition-all ${
                h.result === 'win' ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50' :
                h.result === 'loss' ? 'bg-red-400 shadow-sm shadow-red-500/50' : 'bg-white/10'
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
            <div className="text-white/10 text-[10px] mt-1">Paste screenshot or enter manually</div>
          </div>
        )}

        {/* Analysis — only shows when we have data */}
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
              {bringList.slice(0, 4).map((rec, i) => (
                <div key={rec.species} className={`flex items-center gap-2 px-2 py-1 rounded ${
                  i < 3 ? 'bg-white/[0.03]' : 'opacity-50'
                }`}>
                  <span className={`text-[10px] font-black w-4 ${
                    i === 0 ? 'text-poke-gold' : i < 3 ? 'text-white/40' : 'text-white/20'
                  }`}>{i + 1}</span>
                  <Sprite species={rec.species} size="sm" />
                  <span className="text-xs text-white/80 font-medium flex-1">{rec.species}</span>
                  <span className={`text-[10px] font-mono ${rec.score >= 3 ? 'text-emerald-400/60' : rec.score >= 0 ? 'text-white/20' : 'text-red-400/60'}`}>
                    {rec.score >= 0 ? '+' : ''}{rec.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lead */}
        {leadSuggestion && (
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="text-[9px] text-white/30 uppercase tracking-widest font-bold mb-1.5">LEAD</div>
            <div className="flex items-center gap-2">
              <Sprite species={leadSuggestion.lead1} size="md" />
              <span className="text-white/15 text-xs">+</span>
              <Sprite species={leadSuggestion.lead2} size="md" />
            </div>
          </div>
        )}

        {/* Quick W/L — always visible at bottom */}
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

  // ─── Full layout ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-poke-darkest text-white">
      {/* Header */}
      <header className="border-b border-poke-border bg-gradient-to-r from-poke-darker via-poke-dark to-poke-darker sticky top-0 z-40">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-poke-red to-transparent" />
        <div className="max-w-7xl mx-auto px-3 py-2 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-5 h-5 rounded-full border-2 border-white/80 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[45%] bg-poke-red" />
              <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-white/90" />
            </div>
            <span className="text-sm font-bold">
              <span className="text-poke-red">Stream</span> Companion
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setIsOverlay(true)}
              className="text-[10px] px-2 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded hover:text-poke-gold hover:border-poke-gold/40 transition-colors"
              title="Overlay mode for OBS browser source"
            >
              Overlay Mode
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
            <Link to="/battle" className="text-[10px] px-2 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded hover:text-white transition-colors">Battle</Link>
            <Link to="/team-builder" className="text-[10px] px-2 py-1 bg-poke-surface border border-poke-border text-slate-400 rounded hover:text-white transition-colors">Builder</Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 py-4">
        {/* Scoreboard bar */}
        <div className="poke-panel p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 uppercase tracking-wider">Session</span>
              <span className="text-emerald-400 font-black text-xl">{scoreboard.wins}</span>
              <span className="text-slate-600">-</span>
              <span className="text-red-400 font-black text-xl">{scoreboard.losses}</span>
            </div>
            <div className="w-px h-6 bg-poke-border" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Win Rate</span>
              <span className={`text-lg font-black ${
                scoreboard.wins + scoreboard.losses === 0 ? 'text-slate-600' :
                winRate >= 60 ? 'text-emerald-400' : winRate >= 50 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {scoreboard.wins + scoreboard.losses === 0 ? '--' : `${winRate}%`}
              </span>
            </div>
            <div className="w-px h-6 bg-poke-border" />
            <span className="text-xs text-slate-600">{scoreboard.wins + scoreboard.losses} games</span>
          </div>
          {/* Win streak */}
          {history.length > 0 && (
            <div className="flex items-center gap-1">
              {history.slice(0, 10).map((h) => (
                <div
                  key={h.id}
                  className={`w-2.5 h-2.5 rounded-full ${
                    h.result === 'win' ? 'bg-emerald-400' :
                    h.result === 'loss' ? 'bg-red-400' :
                    'bg-slate-600'
                  }`}
                  title={`${h.result === 'win' ? 'W' : h.result === 'loss' ? 'L' : '?'} vs ${h.opponentTeam.join(', ')}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
          {/* Left column: Stream + Teams */}
          <div className="space-y-4">
            {/* Twitch connection */}
            <div className="poke-panel p-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Twitch Stream</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={channelInput}
                  onChange={e => setChannelInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConnectChannel()}
                  placeholder="Channel name..."
                  className="flex-1 px-3 py-1.5 bg-poke-surface border border-poke-border rounded text-sm text-white placeholder:text-slate-600 focus:border-purple-500/50 focus:outline-none"
                />
                <button
                  onClick={handleConnectChannel}
                  className="px-3 py-1.5 bg-purple-600/20 border border-purple-500/40 text-purple-400 rounded text-xs font-bold hover:bg-purple-600/30 transition-colors"
                >
                  {showStream && channel ? 'Update' : 'Connect'}
                </button>
                {showStream && channel && (
                  <button
                    onClick={() => { setShowStream(false); setChannel(''); saveChannel(''); }}
                    className="px-2 py-1.5 bg-poke-surface border border-poke-border text-slate-500 rounded text-xs hover:text-red-400 transition-colors"
                  >
                    Disconnect
                  </button>
                )}
              </div>
              {showStream && channel && (
                <div className="mt-3">
                  <TwitchEmbed channel={channel} />
                </div>
              )}
            </div>

            {/* Your Team */}
            <div className="poke-panel p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Team</div>
                {filledMyTeam.length > 0 && (
                  <span className="text-[10px] text-slate-600">{filledMyTeam.length}/6</span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {myTeam.map((species, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {species && <Sprite species={species} size="sm" />}
                    <SearchSelect
                      options={allPokemon}
                      value={species}
                      onChange={v => setMyTeamSlot(i, v)}
                      placeholder={`Slot ${i + 1}`}
                    />
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-slate-600 mt-2">
                Loaded from Team Builder. Edit here for quick changes.
              </div>
            </div>

            {/* Screenshot reference */}
            <div
              className="poke-panel p-3"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-violet-400 uppercase tracking-wider">Team Preview Screenshot</div>
                {screenshotUrl && (
                  <button onClick={() => setScreenshotUrl(null)} className="text-[10px] text-slate-500 hover:text-poke-red transition-colors">Clear</button>
                )}
              </div>
              {screenshotUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-violet-500/20 mb-2">
                  <img src={screenshotUrl} alt="Team preview" className="w-full h-auto max-h-48 object-contain bg-black/50" />
                </div>
              ) : (
                <div className="border-2 border-dashed border-poke-border/50 rounded-lg p-4 text-center hover:border-violet-500/30 transition-colors cursor-pointer">
                  <div className="text-slate-500 text-xs mb-1">Paste screenshot (Ctrl+V) or drag & drop</div>
                  <div className="text-slate-600 text-[10px]">Capture team preview and paste here for reference while inputting</div>
                </div>
              )}
            </div>

            {/* Opponent Team */}
            <div className="poke-panel p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-poke-red uppercase tracking-wider">Opponent's Team</div>
                {filledOpponents.length > 0 && (
                  <button
                    onClick={() => setOpponentTeam(['', '', '', '', '', ''])}
                    className="text-[10px] text-slate-500 hover:text-poke-red transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {opponentTeam.map((species, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {species && <Sprite species={species} size="sm" />}
                    <SearchSelect
                      options={allPokemon}
                      value={species}
                      onChange={v => setOpponentSlot(i, v)}
                      placeholder={`Opp ${i + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: Analysis */}
          <div className="space-y-4">
            {/* Quick action: record match */}
            {filledOpponents.length >= 1 && (
              <div className="poke-panel p-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Record Match</div>

                {/* Bring selection */}
                {bringList.length > 0 && (
                  <div className="mb-3">
                    <div className="text-[10px] text-slate-500 mb-1">Select your bring list (tap to toggle, max 4):</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {filledMyTeam.map(species => (
                        <button
                          key={species}
                          onClick={() => toggleBring(species)}
                          className={`flex items-center gap-1 px-2 py-1 rounded border text-xs transition-colors ${
                            selectedBring.has(species)
                              ? 'border-poke-gold/50 bg-poke-gold/10 text-poke-gold'
                              : 'border-poke-border bg-poke-surface text-slate-400 hover:text-white'
                          }`}
                        >
                          <Sprite species={species} size="sm" />
                          {species}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <input
                  type="text"
                  value={matchNotes}
                  onChange={e => setMatchNotes(e.target.value)}
                  placeholder="Quick notes (optional)..."
                  className="w-full px-2 py-1.5 bg-poke-surface border border-poke-border rounded text-xs text-white placeholder:text-slate-600 focus:border-poke-border focus:outline-none mb-3"
                />

                {/* W/L buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => recordMatch('win')}
                    className="flex-1 py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-black text-sm hover:bg-emerald-500/25 transition-colors"
                  >
                    WIN
                  </button>
                  <button
                    onClick={() => recordMatch('loss')}
                    className="flex-1 py-2.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 font-black text-sm hover:bg-red-500/25 transition-colors"
                  >
                    LOSS
                  </button>
                </div>
              </div>
            )}

            {/* Archetype detection */}
            {archetypes.length > 0 && (
              <div className="poke-panel p-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Detected Archetype</div>
                <div className="space-y-3">
                  {archetypes.map((arch, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-poke-gold' : 'bg-slate-600'}`} />
                        <span className="text-sm font-bold text-white">{arch.name}</span>
                        <span className="text-[10px] text-slate-500">{Math.round(arch.confidence * 100)}%</span>
                      </div>
                      {i === 0 && arch.counterTips.length > 0 && (
                        <div className="ml-4 space-y-0.5">
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

            {/* Bring list recommendation */}
            {bringList.length > 0 && (
              <div className="poke-panel p-3">
                <div className="text-xs font-bold text-poke-gold uppercase tracking-wider mb-2">Recommended Bring</div>
                <div className="space-y-1.5">
                  {bringList.slice(0, 4).map((rec, i) => {
                    const tier = getTierForPokemon(rec.species);
                    const tierDef = tier ? TIER_DEFINITIONS.find(d => d.tier === tier.tier) : null;
                    return (
                      <div key={rec.species} className={`flex items-center gap-2 p-2 rounded-lg border ${
                        i < 3 ? 'border-poke-gold/30 bg-poke-gold/5' : 'border-poke-border bg-poke-surface/50'
                      }`}>
                        <span className={`text-sm font-black w-4 ${i < 3 ? 'text-poke-gold' : 'text-slate-600'}`}>{i + 1}</span>
                        <Sprite species={rec.species} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white">{rec.species}</span>
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
              </div>
            )}

            {/* Lead suggestion */}
            {leadSuggestion && (
              <div className="poke-panel p-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Suggested Lead</div>
                <div className="flex items-center gap-3">
                  <Sprite species={leadSuggestion.lead1} size="md" />
                  <span className="text-lg text-slate-600">+</span>
                  <Sprite species={leadSuggestion.lead2} size="md" />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-white">{leadSuggestion.lead1} + {leadSuggestion.lead2}</div>
                    <div className="text-[11px] text-slate-500">{leadSuggestion.reasoning}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Key threats */}
            {threats.length > 0 && (
              <div className="poke-panel p-3">
                <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Key Threats</div>
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

            {/* Waiting state */}
            {filledOpponents.length === 0 && (
              <div className="poke-panel p-6 text-center">
                <div className="text-slate-600 text-sm mb-1">Enter opponent Pokemon to start</div>
                <div className="text-slate-700 text-xs">Paste a screenshot (Ctrl+V) for reference, then type species names. Analysis updates live as you add.</div>
              </div>
            )}
          </div>
        </div>

        {/* Match history panel */}
        {showHistory && (
          <div className="mt-4 poke-panel p-3">
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
                  <div key={match.id} className="flex items-center gap-3 p-2 rounded-lg border border-poke-border bg-poke-surface/30">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                      match.result === 'win' ? 'bg-emerald-500/20 text-emerald-400' :
                      match.result === 'loss' ? 'bg-red-500/20 text-red-400' :
                      'bg-slate-700/30 text-slate-500'
                    }`}>
                      {match.result === 'win' ? 'W' : match.result === 'loss' ? 'L' : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-slate-500">vs</span>
                        {match.opponentTeam.map(opp => (
                          <div key={opp} className="flex items-center gap-0.5">
                            <Sprite species={opp} size="sm" />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-600">
                          {new Date(match.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {match.bringList.length > 0 && (
                          <span className="text-[10px] text-slate-600">
                            Brought: {match.bringList.join(', ')}
                          </span>
                        )}
                        {match.notes && (
                          <span className="text-[10px] text-slate-500 italic truncate">{match.notes}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteMatch(match.id)}
                      className="text-slate-700 hover:text-red-400 transition-colors p-1"
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
    </div>
  );
}
