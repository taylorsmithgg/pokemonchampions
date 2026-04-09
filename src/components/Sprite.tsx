// Shared Pokemon Sprite component with automatic fallback chain
// animated gif → static png → graceful placeholder
// EVERY sprite in the app should use this component

import { useState } from 'react';
import { getSpriteUrl, getSpriteFallbackUrl } from '../utils/sprites';

interface SpriteProps {
  species: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

export function Sprite({ species, size = 'md', className = '' }: SpriteProps) {
  const [useFallback, setUseFallback] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [lastSpecies, setLastSpecies] = useState(species);

  if (species !== lastSpecies) {
    setLastSpecies(species);
    setUseFallback(false);
    setHasError(false);
  }

  if (!species || hasError) {
    return (
      <div className={`${SIZES[size]} rounded-lg bg-poke-surface flex items-center justify-center ${className}`}>
        <div className="w-1/2 h-1/2 rounded-full border-2 border-poke-border opacity-30" />
      </div>
    );
  }

  const src = useFallback ? getSpriteFallbackUrl(species) : getSpriteUrl(species);

  return (
    <img
      src={src}
      alt={species}
      className={`${SIZES[size]} object-contain ${className}`}
      onError={() => {
        if (!useFallback) setUseFallback(true);
        else setHasError(true);
      }}
      loading="lazy"
    />
  );
}
