import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRoleDefinition } from '../data/roleDefinitions';
import { Sprite } from './Sprite';

// Role → color theme. Covers all Doubles + Singles roles.
const ROLE_STYLES: Record<string, string> = {
  'Lead Anchor': 'bg-poke-red/10 text-poke-red-light border-poke-red/20',
  'Speed Controller': 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  'Redirector': 'bg-poke-gold/10 text-poke-gold border-poke-gold/20',
  'Wallbreaker': 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  'Wincon': 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  'Pivot Wall': 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  'Hyper Offense': 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  'Trick Room Abuser': 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  'Weather Abuser': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  'Setup Sweeper': 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  'Hazard Setter': 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  'Hazard Removal': 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  'Choice Scarf': 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  'Physical Wall': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  'Special Wall': 'bg-teal-500/10 text-teal-300 border-teal-500/20',
  'Pivot': 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  'Phazer': 'bg-stone-500/10 text-stone-300 border-stone-500/20',
  'Status Spreader': 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  'Lead': 'bg-poke-red/10 text-poke-red-light border-poke-red/20',
  'Utility': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Wall': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  'Support': 'bg-poke-gold/10 text-poke-gold border-poke-gold/20',
  'Physical Sweeper': 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  'Special Sweeper': 'bg-sky-500/10 text-sky-300 border-sky-500/20',
};

interface RoleBadgeProps {
  role: string;
  /** If true, just a plain badge with no click behavior. */
  plain?: boolean;
}

export function RoleBadge({ role, plain }: RoleBadgeProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const style = ROLE_STYLES[role] ?? ROLE_STYLES['Utility'];
  const def = getRoleDefinition(role);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (plain || !def) {
    return <span className={`text-[9px] px-1.5 py-0.5 rounded border ${style}`}>{role}</span>;
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`text-[9px] px-1.5 py-0.5 rounded border cursor-pointer hover:brightness-125 transition-all ${style}`}
        title={def.short}
      >
        {role}
      </button>

      {open && (
        <div
          className="absolute z-50 w-72 mt-1.5 rounded-lg border border-poke-border shadow-xl"
          style={{ backgroundColor: '#151628', left: 0, top: '100%' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`px-3 py-2 border-b border-poke-border rounded-t-lg ${style.replace(/text-[^ ]+/, 'text-white')}`}>
            <div className="text-xs font-bold">{def.name}</div>
            <div className="text-[10px] opacity-70 mt-0.5">{def.short}</div>
          </div>

          {/* Description */}
          <div className="px-3 py-2 text-[11px] text-slate-300 leading-relaxed">
            {def.description}
          </div>

          {/* Examples */}
          {def.examples.length > 0 && (
            <div className="px-3 py-2 border-t border-poke-border/50">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Key examples</div>
              <div className="flex flex-wrap gap-1.5">
                {def.examples.map(name => (
                  <div key={name} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-poke-surface text-[10px] text-slate-300">
                    <Sprite species={name} size="sm" />
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wiki link */}
          {def.wikiPath && (
            <div className="px-3 py-2 border-t border-poke-border/50">
              <Link
                to={def.wikiPath}
                className="text-[10px] text-poke-red-light hover:text-white transition-colors flex items-center gap-1"
              >
                Read the full strategy guide <span className="text-[8px]">↗</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
