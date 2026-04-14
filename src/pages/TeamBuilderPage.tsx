import { Link, useNavigate } from 'react-router-dom';
import { TeamBuilderPanel } from '../components/TeamBuilderPanel';
import { useTeam } from '../contexts/TeamContext';

export function TeamBuilderPage() {
  const { team, setTeam, loadToCalc } = useTeam();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-poke-darkest text-white relative z-10">
      {/* Header */}
      <header className="border-b border-poke-border bg-gradient-to-r from-poke-darker via-poke-dark to-poke-darker backdrop-blur-sm sticky top-0 z-40">
        <div className="h-[3px] bg-gradient-to-r from-transparent via-poke-red to-transparent" />
        <div className="max-w-[1920px] mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-6 h-6 rounded-full border-2 border-white/80 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[45%] bg-poke-red" />
              <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-white/90" />
              <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-poke-border-light -translate-y-1/2" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border border-poke-border-light bg-poke-dark" />
            </div>
            <h1 className="text-base font-bold tracking-tight hidden sm:block">
              <span className="text-poke-red">Champions</span> Team Builder
            </h1>
          </Link>

          <nav className="flex items-center gap-1 ml-auto shrink-0">
            <Link
              to="/"
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors bg-poke-surface border-poke-border text-slate-400 hover:text-white hidden sm:block"
            >
              Calculator
            </Link>
            <Link to="/tier-list" className="text-xs px-3 py-1.5 rounded-lg border transition-colors bg-poke-surface border-poke-border text-slate-400 hover:text-white hidden sm:block">Tier List</Link>
            <Link to="/battle" className="text-xs px-3 py-1.5 rounded-lg border transition-colors bg-poke-surface border-poke-border text-slate-400 hover:text-emerald-400 hidden sm:block">Live</Link>
            <Link to="/faq" className="text-xs px-3 py-1.5 rounded-lg border transition-colors bg-poke-surface border-poke-border text-slate-400 hover:text-white hidden sm:block">Wiki</Link>
          </nav>
        </div>
      </header>

      {/* Full-screen team builder */}
      <TeamBuilderPanel
        team={team}
        onChange={setTeam}
        onLoadToCalc={(pokemon, side) => {
          loadToCalc(pokemon, side);
          navigate('/');
        }}
        isOpen={true}
        onClose={() => navigate('/')}
        fullScreen
      />
    </div>
  );
}
