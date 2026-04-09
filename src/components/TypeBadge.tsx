import { TYPE_COLORS } from '../data/champions';

interface TypeBadgeProps {
  type: string;
  size?: 'sm' | 'md';
}

export function TypeBadge({ type, size = 'sm' }: TypeBadgeProps) {
  const color = TYPE_COLORS[type] || '#888';
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-block rounded-full font-bold text-white uppercase tracking-wider ${sizeClasses}`}
      style={{ backgroundColor: color }}
    >
      {type}
    </span>
  );
}
