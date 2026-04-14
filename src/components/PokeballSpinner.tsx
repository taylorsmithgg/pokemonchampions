import { useState, useEffect } from 'react';

// Ball type color schemes — cycles through during loading
const BALL_TYPES = [
  { name: 'Poke', top: '#E3350D', bottom: '#fff', band: '#333', center: '#fff' },
  { name: 'Great', top: '#3B82F6', bottom: '#fff', band: '#333', center: '#E3350D' },
  { name: 'Ultra', top: '#222', bottom: '#EAB308', band: '#333', center: '#fff' },
  { name: 'Premier', top: '#fff', bottom: '#fff', band: '#E3350D', center: '#E3350D' },
  { name: 'Master', top: '#7C3AED', bottom: '#fff', band: '#333', center: '#D946EF' },
];

interface PokeballSpinnerProps {
  /** Size in pixels. Default 32. */
  size?: number;
  /** Status text shown below the spinner. */
  label?: string;
  /** If true, plays the open/close animation. */
  active?: boolean;
}

export function PokeballSpinner({ size = 32, label, active = true }: PokeballSpinnerProps) {
  const [ballIdx, setBallIdx] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!active) return;
    // Cycle through ball types
    const ballTimer = setInterval(() => {
      setBallIdx(i => (i + 1) % BALL_TYPES.length);
    }, 800);
    // Open/close animation
    const openTimer = setInterval(() => {
      setIsOpen(o => !o);
    }, 400);
    return () => { clearInterval(ballTimer); clearInterval(openTimer); };
  }, [active]);

  const ball = BALL_TYPES[ballIdx];
  const r = size / 2;
  const bandH = Math.max(2, size * 0.08);
  const centerR = size * 0.15;
  const openOffset = isOpen ? size * 0.06 : 0;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`relative ${active ? 'animate-spin' : ''}`}
        style={{
          width: size,
          height: size,
          animationDuration: '1.2s',
        }}
      >
        {/* Top half */}
        <div
          className="absolute left-0 right-0 overflow-hidden transition-transform duration-200"
          style={{
            top: 0,
            height: r,
            transform: `translateY(-${openOffset}px)`,
          }}
        >
          <div
            className="w-full h-full rounded-t-full"
            style={{ backgroundColor: ball.top }}
          />
        </div>

        {/* Bottom half */}
        <div
          className="absolute left-0 right-0 overflow-hidden transition-transform duration-200"
          style={{
            bottom: 0,
            height: r,
            transform: `translateY(${openOffset}px)`,
          }}
        >
          <div
            className="w-full h-full rounded-b-full"
            style={{ backgroundColor: ball.bottom }}
          />
        </div>

        {/* Center band */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: r - bandH / 2,
            height: bandH,
            backgroundColor: ball.band,
            zIndex: 2,
          }}
        />

        {/* Center button */}
        <div
          className="absolute rounded-full border-2 transition-colors duration-200"
          style={{
            width: centerR * 2,
            height: centerR * 2,
            top: r - centerR,
            left: r - centerR,
            backgroundColor: ball.center,
            borderColor: ball.band,
            zIndex: 3,
          }}
        />
      </div>

      {label && (
        <span className="text-[10px] text-slate-400 text-center leading-tight max-w-[120px]">
          {label}
        </span>
      )}
    </div>
  );
}

/** Inline small spinner for button states */
export function PokeballMini({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-block ${className}`}>
      <div className="w-4 h-4 rounded-full border-2 border-poke-border relative overflow-hidden animate-spin" style={{ animationDuration: '0.8s' }}>
        <div className="absolute top-0 left-0 right-0 h-[45%] bg-poke-red" />
        <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-white/90" />
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-poke-border -translate-y-1/2" />
      </div>
    </div>
  );
}
