import { useState, useCallback } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { PokemonPanel } from './components/PokemonPanel';
import { FieldPanel } from './components/FieldPanel';
import { ResultsPanel } from './components/ResultsPanel';
// TierListPanel replaced by TierListPage route
import { TeamsPanel } from './components/TeamsPanel';
import { SynergyPanel } from './components/SynergyPanel';
import { TeamAuditPanel } from './components/TeamAuditPanel';
import { MatchupPanel } from './components/MatchupPanel';
import { TeamOverview } from './components/TeamOverview';
import { TeamBuilderPanel } from './components/TeamBuilderPanel';
import { FAQPage } from './pages/FAQPage';
import { TierListPage } from './pages/TierListPage';
import { getPokemonData } from './data/champions';
import { getPresetsBySpecies } from './data/presets';
import type { TeamMember } from './data/teams';
import {
  createDefaultPokemonState,
  createDefaultFieldState,
} from './types';
import type { PokemonState, FieldState } from './types';

function Calculator() {
  const [attacker, setAttacker] = useState<PokemonState>(createDefaultPokemonState());
  const [defender, setDefender] = useState<PokemonState>({
    ...createDefaultPokemonState(),
    nature: 'Bold',
  });
  const [field, setField] = useState<FieldState>(createDefaultFieldState());
  const [showField, setShowField] = useState(false);
  // Tier list is now a routed page
  const [showTeams, setShowTeams] = useState(false);
  const [showTeamBuilder, setShowTeamBuilder] = useState(false);
  // Full 6-member team state for audit
  const [team, setTeam] = useState<PokemonState[]>([
    createDefaultPokemonState(),
    createDefaultPokemonState(),
    createDefaultPokemonState(),
    createDefaultPokemonState(),
    createDefaultPokemonState(),
    createDefaultPokemonState(),
  ]);

  const handleSwap = useCallback(() => {
    setAttacker(defender);
    setDefender(attacker);
    setField(prev => ({
      ...prev,
      attackerSide: prev.defenderSide,
      defenderSide: prev.attackerSide,
    }));
  }, [attacker, defender]);

  const handleReset = useCallback(() => {
    setAttacker(createDefaultPokemonState());
    setDefender({ ...createDefaultPokemonState(), nature: 'Bold' });
    setField(createDefaultFieldState());
  }, []);

  const handleTierListSelect = useCallback((name: string, side: 'attacker' | 'defender') => {
    const data = getPokemonData(name);
    const presets = getPresetsBySpecies(name);

    // If we have a preset for this Pokemon, use it
    if (presets.length > 0) {
      const preset = presets[0];
      const newState: PokemonState = {
        ...createDefaultPokemonState(),
        species: preset.species,
        nature: preset.nature,
        ability: preset.ability,
        item: preset.item,
        teraType: '',
        sps: { ...preset.sps },
        moves: [...preset.moves],
      };
      if (side === 'attacker') setAttacker(newState);
      else setDefender(newState);
    } else {
      // Just set the species
      const newState: PokemonState = {
        ...createDefaultPokemonState(),
        species: name,
        ability: (data?.abilities?.[0] || '') as string,
        teraType: '',
      };
      if (side === 'attacker') setAttacker(newState);
      else setDefender(newState);
    }
  }, []);

  const handleTeamMemberLoad = useCallback((member: TeamMember, side: 'attacker' | 'defender') => {
    const newState: PokemonState = {
      ...createDefaultPokemonState(),
      species: member.species,
      nature: member.nature,
      ability: member.ability,
      item: member.item,
      teraType: '',
      sps: { ...member.sps },
      moves: [...member.moves],
    };
    if (side === 'attacker') setAttacker(newState);
    else setDefender(newState);
    setShowTeams(false);
  }, []);

  return (
    <div className="min-h-screen bg-poke-darkest text-white relative z-10">
      {/* Header */}
      <header className="border-b border-poke-border bg-gradient-to-r from-poke-darker via-poke-dark to-poke-darker backdrop-blur-sm sticky top-0 z-40">
        {/* Top red accent line */}
        <div className="h-[3px] bg-gradient-to-r from-transparent via-poke-red to-transparent" />
        <div className="max-w-[1920px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              {/* Pokeball icon */}
              <div className="w-7 h-7 rounded-full border-2 border-white/80 relative overflow-hidden group-hover:border-poke-gold transition-colors">
                <div className="absolute top-0 left-0 right-0 h-[45%] bg-poke-red" />
                <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-white/90" />
                <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-poke-border-light -translate-y-1/2" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-[1.5px] border-poke-border-light bg-poke-dark" />
              </div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-poke-red">Champions</span>{' '}
                <span className="text-white/90">Calc</span>
              </h1>
            </Link>
            <span className="text-[10px] px-2 py-0.5 bg-poke-gold/15 text-poke-gold border border-poke-gold/30 rounded-full font-bold tracking-wide">
              VGC 2026
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              to="/tier-list"
              className="text-xs px-3 py-1.5 rounded-lg bg-poke-surface border border-poke-border text-slate-400 hover:border-poke-gold/50 hover:text-poke-gold transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Tier List
            </Link>
            <button
              onClick={() => setShowTeams(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-poke-surface border border-poke-border text-slate-400 hover:border-poke-blue-light/50 hover:text-poke-blue-light transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Teams
            </button>
            <button
              onClick={() => setShowTeamBuilder(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-poke-surface border border-poke-border text-slate-400 hover:border-poke-red/40 hover:text-poke-red-light transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Builder
            </button>
            <Link
              to="/faq"
              className="text-xs px-3 py-1.5 rounded-lg bg-poke-surface border border-poke-border text-slate-400 hover:border-white/30 hover:text-white transition-colors"
            >
              FAQ
            </Link>
            <div className="w-px h-5 bg-poke-border mx-1" />
            <button
              onClick={() => setShowField(!showField)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                showField
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-poke-surface border-poke-border text-slate-400 hover:border-emerald-500/30'
              }`}
            >
              Field
            </button>
            <button
              onClick={handleSwap}
              className="text-xs p-1.5 rounded-lg bg-poke-surface border border-poke-border text-slate-400 hover:border-poke-red/40 hover:text-poke-red transition-colors"
              title="Swap attacker and defender"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
            <button
              onClick={handleReset}
              className="text-xs p-1.5 rounded-lg bg-poke-surface border border-poke-border text-slate-400 hover:border-poke-red/40 hover:text-poke-red transition-colors"
              title="Reset all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1920px] mx-auto px-6 py-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_480px_1fr] xl:grid-cols-[1fr_540px_1fr] gap-6">
          {/* Attacker */}
          <PokemonPanel
            state={attacker}
            onChange={setAttacker}
            side="attacker"
            teammateItems={[defender.item]}
          />

          {/* Center: Results + Field */}
          <div className="space-y-5">
            <TeamOverview attacker={attacker} defender={defender} />
            {showField && (
              <FieldPanel state={field} onChange={setField} />
            )}
            <ResultsPanel
              attacker={attacker}
              defender={defender}
              field={field}
            />
            <MatchupPanel
              attacker={attacker}
              defender={defender}
            />
            <TeamAuditPanel
              attacker={attacker}
              defender={defender}
              onLoadPokemon={handleTierListSelect}
            />
            <SynergyPanel
              attacker={attacker}
              defender={defender}
              onLoadPokemon={handleTierListSelect}
            />
          </div>

          {/* Defender */}
          <PokemonPanel
            state={defender}
            onChange={setDefender}
            side="defender"
            teammateItems={[attacker.item]}
          />
        </div>

        {/* Bottom SEO content */}
        <div className="pokeball-divider mt-12" />
        <div className="pt-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
            <div>
              <h3 className="font-semibold text-white mb-2">About This Calculator</h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                The Champions Calc is a damage calculator built specifically for Pokémon Champions
                and VGC 2026. It features the new Stat Point system (66 total SP, max 32 per stat),
                support for Mega Evolution via the Omni Ring, and all
                new abilities introduced in Champions.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">SP System</h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Pokémon Champions replaces EVs and IVs with Stat Points. Every Pokémon has perfect
                base potential (31 IVs equivalent). You allocate 66 SP total across six stats with
                a maximum of 32 per stat. At Level 50, each SP adds approximately 1 stat point.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">Popular Resources</h3>
              <ul className="space-y-1">
                <li>
                  <Link to="/faq" className="text-xs text-poke-red-light hover:text-poke-red transition-colors">
                    Pokémon Champions FAQ
                  </Link>
                </li>
                <li>
                  <Link to="/faq/how-do-stat-points-work-pokemon-champions" className="text-xs text-poke-red-light hover:text-poke-red transition-colors">
                    How SP Works
                  </Link>
                </li>
                <li>
                  <Link to="/faq/what-is-the-omni-ring-pokemon-champions" className="text-xs text-poke-red-light hover:text-poke-red transition-colors">
                    Omni Ring Explained
                  </Link>
                </li>
                <li>
                  <Link to="/faq/best-pokemon-champions-competitive-pokemon-vgc-2026" className="text-xs text-poke-red-light hover:text-poke-red transition-colors">
                    Best VGC 2026 Pokémon
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Teams Panel */}
      <TeamsPanel
        onLoadMember={handleTeamMemberLoad}
        onLoadFullTeam={(comp) => {
          const newTeam = comp.members.map(m => ({
            ...createDefaultPokemonState(),
            species: m.species,
            nature: m.nature,
            ability: m.ability,
            item: m.item,
            sps: { hp: m.sps.hp, atk: m.sps.atk, def: m.sps.def, spa: m.sps.spa, spd: m.sps.spd, spe: m.sps.spe },
            moves: [...m.moves, '', '', '', ''].slice(0, 4),
          }));
          // Pad to 6 if team has fewer members
          while (newTeam.length < 6) newTeam.push(createDefaultPokemonState());
          setTeam(newTeam);
          // Also load first two into attacker/defender
          if (newTeam[0].species) setAttacker(newTeam[0]);
          if (newTeam[1].species) setDefender(newTeam[1]);
          setShowTeams(false);
          setShowTeamBuilder(true); // Open builder to show the full team
        }}
        isOpen={showTeams}
        onClose={() => setShowTeams(false)}
      />

      {/* Team Builder */}
      <TeamBuilderPanel
        team={team}
        onChange={setTeam}
        onLoadToCalc={(pokemon, side) => {
          if (side === 'attacker') setAttacker(pokemon);
          else setDefender(pokemon);
          setShowTeamBuilder(false);
        }}
        isOpen={showTeamBuilder}
        onClose={() => setShowTeamBuilder(false)}
      />
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Calculator />} />
        <Route path="/tier-list" element={<TierListPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/faq/:slug" element={<FAQPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
