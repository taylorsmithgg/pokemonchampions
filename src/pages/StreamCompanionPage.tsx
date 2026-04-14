import { Link } from 'react-router-dom';

// Placeholder — the full Stream Companion is being built.
export function StreamCompanionPage() {
  return (
    <div className="min-h-screen bg-poke-darkest text-white flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-poke-border border-t-violet-500 animate-spin" />
      <h1 className="text-xl font-bold">Stream Companion</h1>
      <p className="text-slate-500 text-sm">Coming soon — Twitch overlay with battle tracking</p>
      <div className="flex gap-2 mt-4">
        <Link to="/" className="text-xs px-3 py-1.5 bg-poke-surface border border-poke-border text-slate-400 rounded hover:text-white">Calculator</Link>
        <Link to="/battle" className="text-xs px-3 py-1.5 bg-poke-surface border border-poke-border text-slate-400 rounded hover:text-emerald-400">Battle Assistant</Link>
        <Link to="/team-builder" className="text-xs px-3 py-1.5 bg-poke-surface border border-poke-border text-slate-400 rounded hover:text-white">Team Builder</Link>
      </div>
    </div>
  );
}
