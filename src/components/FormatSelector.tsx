// Shared Singles / Doubles format selector. Format choice is a
// context-defining decision — not a side filter — so this component
// gives it real visual weight: dedicated cards with icons, pick
// counts, color-coded accents, and a clear active state.
//
// Two visual variants:
//   'full'    — large prominent cards, for the top of a panel
//   'compact' — pill-style, for tight toolbars

import { ALL_FORMATS, type BattleFormat, type FormatId } from '../calc/lineupAnalysis';

interface FormatSelectorProps {
  value: FormatId;
  onChange: (format: BattleFormat) => void;
  /** Optional per-format item counts (e.g., team-comp counts per format). */
  counts?: Partial<Record<FormatId, number>>;
  variant?: 'full' | 'compact';
  className?: string;
}

// Color themes per format. Doubles leans into VGC red; Singles uses
// sky blue to feel distinct at a glance.
const FORMAT_THEMES: Record<FormatId, {
  activeBg: string;
  activeBorder: string;
  activeText: string;
  activeGlow: string;
  iconColor: string;
  accent: string;
}> = {
  doubles: {
    activeBg: 'bg-gradient-to-br from-poke-red/25 via-poke-red/10 to-poke-red/5',
    activeBorder: 'border-poke-red/60',
    activeText: 'text-poke-red-light',
    activeGlow: 'shadow-[0_0_24px_rgba(227,53,13,0.25)]',
    iconColor: 'text-poke-red-light',
    accent: 'bg-poke-red',
  },
  singles: {
    activeBg: 'bg-gradient-to-br from-sky-500/25 via-sky-500/10 to-sky-500/5',
    activeBorder: 'border-sky-500/60',
    activeText: 'text-sky-300',
    activeGlow: 'shadow-[0_0_24px_rgba(14,165,233,0.25)]',
    iconColor: 'text-sky-300',
    accent: 'bg-sky-500',
  },
};

// Visual glyph for each format — two facing Pokemon for Doubles,
// one Pokemon for Singles. Plain SVG circles for maximum clarity
// at small sizes.
function DoublesIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 24" className={className} fill="none">
      <circle cx="10" cy="12" r="6" fill="currentColor" opacity="0.9" />
      <circle cx="22" cy="12" r="6" fill="currentColor" opacity="0.9" />
      <line x1="28" y1="12" x2="32" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" strokeDasharray="2 2" />
      <circle cx="38" cy="12" r="6" fill="currentColor" opacity="0.4" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function SinglesIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 24" className={className} fill="none">
      <circle cx="12" cy="12" r="7" fill="currentColor" opacity="0.9" />
      <line x1="20" y1="12" x2="28" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" strokeDasharray="2 2" />
      <circle cx="36" cy="12" r="7" fill="currentColor" opacity="0.4" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function IconForFormat({ format, className }: { format: FormatId; className?: string }) {
  return format === 'doubles'
    ? <DoublesIcon className={className} />
    : <SinglesIcon className={className} />;
}

export function FormatSelector({
  value,
  onChange,
  counts,
  variant = 'full',
  className = '',
}: FormatSelectorProps) {
  if (variant === 'compact') {
    return <CompactSelector value={value} onChange={onChange} counts={counts} className={className} />;
  }
  return <FullSelector value={value} onChange={onChange} counts={counts} className={className} />;
}

// ─── Full variant: big prominent cards ─────────────────────────────
function FullSelector({
  value,
  onChange,
  counts,
  className,
}: { value: FormatId; onChange: (f: BattleFormat) => void; counts?: Partial<Record<FormatId, number>>; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      {ALL_FORMATS.map(f => {
        const isActive = f.id === value;
        const theme = FORMAT_THEMES[f.id];
        const count = counts?.[f.id];
        // Zero-count formats used to be disabled, but that made the
        // selector feel broken — users clicked Singles and nothing
        // happened. We now always allow the switch so the caller can
        // render an empty state (and so Doubles stays clickable even
        // if its count is briefly 0 during loading).
        const isEmpty = count === 0;

        return (
          <button
            key={f.id}
            onClick={() => onChange(f)}
            aria-pressed={isActive}
            className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all duration-200 ${
              isActive
                ? `${theme.activeBg} ${theme.activeBorder} ${theme.activeGlow}`
                : isEmpty
                  ? 'border-poke-border bg-poke-surface opacity-60 hover:opacity-90 hover:border-poke-border-light'
                  : 'border-poke-border bg-poke-surface hover:border-poke-border-light hover:bg-poke-panel'
            }`}
          >
            {/* Accent stripe on the left when active */}
            {isActive && (
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${theme.accent}`} />
            )}

            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className={`shrink-0 w-12 h-6 mt-1 transition-colors ${
                isActive ? theme.iconColor : 'text-slate-500 group-hover:text-slate-300'
              }`}>
                <IconForFormat format={f.id} className="w-full h-full" />
              </div>

              {/* Label stack */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className={`text-base font-bold tracking-tight transition-colors ${
                    isActive ? 'text-white' : 'text-slate-300'
                  }`}>
                    {f.label}
                  </h3>
                  {isActive && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${theme.activeText} bg-white/5 border border-current`}>
                      Active
                    </span>
                  )}
                </div>

                {/* Pick count + active slots — the thing that actually matters */}
                <div className={`flex items-center gap-2 text-xs font-mono mb-2 transition-colors ${
                  isActive ? theme.activeText : 'text-slate-500'
                }`}>
                  <span>bring {f.rosterSize}</span>
                  <span className="opacity-40">·</span>
                  <span className="font-bold">pick {f.battleSize}</span>
                  <span className="opacity-40">·</span>
                  <span>{f.activeSlots}v{f.activeSlots}</span>
                </div>

                {/* Description */}
                <p className={`text-[11px] leading-snug transition-colors ${
                  isActive ? 'text-slate-300' : 'text-slate-500'
                }`}>
                  {f.description.split('. ')[0]}.
                </p>

                {/* Optional count */}
                {typeof count === 'number' && (
                  <div className={`mt-2 text-[10px] ${count === 0 ? 'text-slate-600' : 'text-slate-400'}`}>
                    {count === 0 ? 'No teams yet' : `${count} ${count === 1 ? 'team' : 'teams'}`}
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Compact variant: medium pills for tight contexts ──────────────
function CompactSelector({
  value,
  onChange,
  counts,
  className,
}: { value: FormatId; onChange: (f: BattleFormat) => void; counts?: Partial<Record<FormatId, number>>; className?: string }) {
  return (
    <div className={`inline-flex rounded-lg border border-poke-border bg-poke-surface p-1 ${className}`}>
      {ALL_FORMATS.map(f => {
        const isActive = f.id === value;
        const theme = FORMAT_THEMES[f.id];
        const count = counts?.[f.id];
        const isEmpty = count === 0;

        return (
          <button
            key={f.id}
            onClick={() => onChange(f)}
            aria-pressed={isActive}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              isActive
                ? `${theme.activeBg} ${theme.activeText} ${theme.activeGlow}`
                : isEmpty
                  ? 'text-slate-500 hover:text-white hover:bg-poke-panel'
                  : 'text-slate-400 hover:text-white hover:bg-poke-panel'
            }`}
            title={f.description}
          >
            <div className={`w-6 h-3 ${isActive ? theme.iconColor : 'text-slate-500'}`}>
              <IconForFormat format={f.id} className="w-full h-full" />
            </div>
            <span className="uppercase tracking-wide">{f.label}</span>
            <span className={`text-[9px] font-mono font-normal ${isActive ? 'opacity-80' : 'opacity-50'}`}>
              {f.activeSlots}v{f.activeSlots} · pick {f.battleSize}
            </span>
            {typeof count === 'number' && (
              <span className={`text-[9px] font-normal ${count === 0 ? 'opacity-40' : 'opacity-70'}`}>
                ({count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
