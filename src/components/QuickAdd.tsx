// Shared "add to calculator/team" button group. EVERY panel that displays
// a Pokemon and wants to offer a quick action should use this component —
// it routes through the PokemonActions context so the user gets identical
// behavior across MetaRadar, Discovery, Synergy, Audit, TierList, etc.
//
// Three visual variants:
//   'icon'  — icon only, 28px square buttons. Default. Fits in tight
//             rows without pushing species names off-screen.
//   'label' — short uppercase text labels (ATK / DEF / +TEAM). Used
//             when space allows and the action isn't obvious from
//             context.
//   'full'  — icon + full word (Attacker / Defender / Team). Used in
//             prominent surfaces like the tier list detail card.

import type { CSSProperties } from 'react';
import { usePokemonActions } from '../contexts/PokemonActions';

interface QuickAddProps {
  species: string;
  variant?: 'icon' | 'label' | 'full';
  /** Omit actions that don't make sense in a given context. */
  actions?: Array<'attacker' | 'defender' | 'team'>;
  className?: string;
}

const DEFAULT_ACTIONS: Array<'attacker' | 'defender' | 'team'> = ['attacker', 'defender', 'team'];

// ─── Themed icons ──────────────────────────────────────────────────
// Bold stroke, uniform 16x16 viewBox so they render crisp at small
// sizes. Sword + shield fit the Pokemon battle theme; the team icon
// is a stylized group-of-three with a plus indicator.

interface IconProps {
  className?: string;
  style?: CSSProperties;
}

export function SwordIcon({ className = '', style }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Blade — isoceles triangle pointing up, filled for weight */}
      <path d="M8 1.5L9.75 9.5L6.25 9.5Z" fill="currentColor" fillOpacity="0.25" />
      <path d="M8 1.5L9.75 9.5L6.25 9.5Z" />
      {/* Crossguard — horizontal bar extending past the blade */}
      <line x1="3.5" y1="9.5" x2="12.5" y2="9.5" strokeWidth={2.25} />
      {/* Handle — short vertical segment below the crossguard */}
      <line x1="8" y1="10" x2="8" y2="13.25" strokeWidth={2} />
      {/* Pommel — circle at the base */}
      <circle cx="8" cy="14.25" r="1" fill="currentColor" />
    </svg>
  );
}

export function ShieldIcon({ className = '', style }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Heater shield outline */}
      <path d="M8 1L14 3V8C14 11.5 11.5 13.5 8 15C4.5 13.5 2 11.5 2 8V3L8 1Z" fill="currentColor" fillOpacity="0.15" />
      <path d="M8 1L14 3V8C14 11.5 11.5 13.5 8 15C4.5 13.5 2 11.5 2 8V3L8 1Z" />
      {/* Horizontal bar — suggests a pokeball and gives the shield a chest */}
      <path d="M3 7.5H13" strokeWidth={1.25} />
    </svg>
  );
}

/**
 * Sparkle / star-burst for the "Optimize" action. Not used by
 * QuickAdd itself — exported for the TeamBuilderPanel's per-slot
 * auto-fill button so it shares the same visual language.
 */
export function OptimizeIcon({ className = '', style }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Four-pointed star burst */}
      <path d="M8 1L9.25 6.75L15 8L9.25 9.25L8 15L6.75 9.25L1 8L6.75 6.75L8 1Z" fill="currentColor" fillOpacity="0.2" />
      <path d="M8 1L9.25 6.75L15 8L9.25 9.25L8 15L6.75 9.25L1 8L6.75 6.75L8 1Z" />
    </svg>
  );
}

export function TeamAddIcon({ className = '', style }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Three stacked pokeball silhouettes */}
      <circle cx="4" cy="7" r="2.5" fill="currentColor" fillOpacity="0.15" />
      <circle cx="4" cy="7" r="2.5" />
      <circle cx="8.5" cy="7" r="2.5" fill="currentColor" fillOpacity="0.15" />
      <circle cx="8.5" cy="7" r="2.5" />
      {/* Plus in the third slot, showing "add" */}
      <circle cx="13" cy="7" r="2.5" fill="currentColor" fillOpacity="0.1" strokeDasharray="1.5 1.5" />
      <path d="M13 5.5V8.5M11.5 7H14.5" strokeWidth={2} />
    </svg>
  );
}

// ─── Action metadata ───────────────────────────────────────────────

interface ActionConfig {
  icon: (props: IconProps) => React.ReactElement;
  fullLabel: string;
  shortLabel: string;
  colors: string;
  fireKey: 'attacker' | 'defender' | 'team';
}

const ACTION_CONFIG: Record<'attacker' | 'defender' | 'team', ActionConfig> = {
  attacker: {
    icon: SwordIcon,
    fullLabel: 'Attacker',
    shortLabel: 'ATK',
    colors: 'bg-poke-red/15 text-poke-red-light border-poke-red/30 hover:bg-poke-red/25 hover:border-poke-red/60 hover:text-white',
    fireKey: 'attacker',
  },
  defender: {
    icon: ShieldIcon,
    fullLabel: 'Defender',
    shortLabel: 'DEF',
    colors: 'bg-poke-blue/15 text-poke-blue-light border-poke-blue/30 hover:bg-poke-blue/25 hover:border-poke-blue/60 hover:text-white',
    fireKey: 'defender',
  },
  team: {
    icon: TeamAddIcon,
    fullLabel: 'Team',
    shortLabel: '+TEAM',
    colors: 'bg-poke-gold/15 text-poke-gold border-poke-gold/30 hover:bg-poke-gold/25 hover:border-poke-gold/60 hover:text-white',
    fireKey: 'team',
  },
};

export function QuickAdd({
  species,
  variant = 'icon',
  actions = DEFAULT_ACTIONS,
  className = '',
}: QuickAddProps) {
  const { sendToAttacker, sendToDefender, addToTeam } = usePokemonActions();

  if (!species) return null;

  const fireActions: Record<'attacker' | 'defender' | 'team', () => void> = {
    attacker: () => sendToAttacker(species),
    defender: () => sendToDefender(species),
    team: () => addToTeam(species),
  };

  const handle = (e: React.MouseEvent, fn: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  // Layout varies per variant — icon-only buttons are square to
  // maintain a fixed tap target, text variants flex naturally.
  const buttonClass = variant === 'icon'
    ? 'w-7 h-7 flex items-center justify-center'
    : variant === 'label'
      ? 'px-2 py-1 flex items-center justify-center'
      : 'px-2.5 py-1.5 flex items-center gap-1.5';

  const iconSize = variant === 'full' ? 'w-4 h-4' : 'w-[14px] h-[14px]';

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      onClick={e => e.stopPropagation()}
    >
      {actions.map(key => {
        const cfg = ACTION_CONFIG[key];
        const Icon = cfg.icon;
        return (
          <button
            key={key}
            onClick={e => handle(e, fireActions[key])}
            className={`${buttonClass} rounded-md border font-bold text-[11px] transition-colors ${cfg.colors}`}
            title={`Send ${species} to ${cfg.fullLabel}`}
            aria-label={`Send ${species} to ${cfg.fullLabel}`}
          >
            {variant !== 'label' && <Icon className={iconSize} />}
            {variant === 'label' && <span className="text-[10px] font-bold">{cfg.shortLabel}</span>}
            {variant === 'full' && <span>{cfg.fullLabel}</span>}
          </button>
        );
      })}
    </div>
  );
}
