// Compact generation indicator used wherever a Pokemon is displayed.
// Reads from champions.ts's single-source GenMeta, so region names and
// colors only need to be defined once.

import { getGenMetaForPokemon } from '../data/champions';

interface GenBadgeProps {
  species: string;
  /** 'roman' = "IV", 'region' = "Sinnoh", 'both' = "IV · Sinnoh" */
  variant?: 'roman' | 'region' | 'both';
  className?: string;
}

export function GenBadge({ species, variant = 'roman', className = '' }: GenBadgeProps) {
  const meta = getGenMetaForPokemon(species);
  if (!meta) return null;

  const label =
    variant === 'roman' ? meta.shortLabel
    : variant === 'region' ? meta.region
    : `${meta.shortLabel} · ${meta.region}`;

  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0 rounded border leading-tight ${meta.color} ${meta.bgColor} ${meta.borderColor} ${className}`}
      title={`Gen ${meta.gen} — ${meta.region}`}
    >
      {label}
    </span>
  );
}
