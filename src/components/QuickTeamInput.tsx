import { useState, useRef, useMemo, useEffect } from 'react';
import { Sprite } from './Sprite';
import { getPokemonSelectPool } from '../data/pokemonSelect';

interface QuickTeamInputProps {
  value: string[];
  onChange: (species: string[]) => void;
  maxSlots?: number;
}

export function QuickTeamInput({ value, onChange, maxSlots = 6 }: QuickTeamInputProps) {
  const [input, setInput] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const allPokemon = useMemo(() => getPokemonSelectPool(), []);

  // Build a lowercase lookup once
  const pokemonLower = useMemo(
    () => allPokemon.map(p => ({ name: p, lower: p.toLowerCase() })),
    [allPokemon]
  );

  const suggestions = useMemo(() => {
    if (!input.trim() || value.length >= maxSlots) return [];
    const query = input.trim().toLowerCase();
    const results: { name: string; priority: number }[] = [];

    for (const p of pokemonLower) {
      // Skip already-selected Pokemon
      if (value.includes(p.name)) continue;

      if (p.lower === query) {
        results.push({ name: p.name, priority: 0 });
      } else if (p.lower.startsWith(query)) {
        results.push({ name: p.name, priority: 1 });
      } else if (p.lower.includes(query)) {
        results.push({ name: p.name, priority: 2 });
      }
      if (results.length >= 8) break;
    }

    results.sort((a, b) => a.priority - b.priority);
    return results.map(r => r.name);
  }, [input, pokemonLower, value, maxSlots]);

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightIndex(0);
  }, [suggestions.length, input]);

  // Scroll highlighted suggestion into view
  useEffect(() => {
    if (suggestionsRef.current) {
      const highlighted = suggestionsRef.current.children[highlightIndex] as HTMLElement;
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIndex]);

  function addPokemon(species: string) {
    if (value.length >= maxSlots) return;
    if (value.includes(species)) return;
    onChange([...value, species]);
    setInput('');
    inputRef.current?.focus();
  }

  function removePokemon(index: number) {
    const next = [...value];
    next.splice(index, 1);
    onChange(next);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.key === 'Tab' || e.key === 'Enter') && suggestions.length > 0 && input.trim()) {
      e.preventDefault();
      addPokemon(suggestions[highlightIndex]);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(i => Math.min(i + 1, suggestions.length - 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(i => Math.max(i - 1, 0));
      return;
    }

    if (e.key === 'Backspace' && !input && value.length > 0) {
      removePokemon(value.length - 1);
      return;
    }

    // Handle comma/space as delimiters to accept current suggestion
    if ((e.key === ',' || e.key === ' ') && suggestions.length > 0 && input.trim()) {
      e.preventDefault();
      addPokemon(suggestions[highlightIndex]);
      return;
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    // Split by commas, newlines, or multiple spaces
    const names = text.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);

    const newValue = [...value];
    for (const raw of names) {
      if (newValue.length >= maxSlots) break;
      const lower = raw.toLowerCase();
      const match = allPokemon.find(p => p.toLowerCase() === lower)
        || allPokemon.find(p => p.toLowerCase().startsWith(lower));
      if (match && !newValue.includes(match)) {
        newValue.push(match);
      }
    }
    onChange(newValue);
    setInput('');
  }

  const isFull = value.length >= maxSlots;

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">
          Quick Team Input
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono ${isFull ? 'text-green-400' : 'text-slate-500'}`}>
            {value.length}/{maxSlots}
          </span>
          {value.length > 0 && (
            <button
              onClick={() => { onChange([]); setInput(''); inputRef.current?.focus(); }}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="relative">
        <div
          className={`flex flex-wrap items-center gap-1.5 border rounded-lg px-3 py-2 transition-all cursor-text
            bg-poke-surface ${
              isFocused
                ? 'border-poke-red/60 ring-1 ring-poke-red/20'
                : 'border-poke-border hover:border-poke-border-light'
            }`}
          onClick={() => inputRef.current?.focus()}
        >
          {/* Selected Pokemon chips */}
          {value.map((species, i) => (
            <div
              key={species}
              className="flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-md bg-poke-dark border border-poke-border text-sm text-white"
            >
              <Sprite species={species} size="sm" className="w-5 h-5" />
              <span className="text-xs">{species}</span>
              <button
                onClick={(e) => { e.stopPropagation(); removePokemon(i); }}
                className="ml-0.5 text-slate-500 hover:text-red-400 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Text input */}
          {!isFull && (
            <input
              ref={inputRef}
              type="text"
              className="flex-1 min-w-[120px] bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => setIsFocused(true)}
              onBlur={() => { setTimeout(() => setIsFocused(false), 150); }}
              placeholder={value.length === 0 ? 'Type Pokemon names...' : `${maxSlots - value.length} slots remaining...`}
              autoComplete="off"
              spellCheck={false}
            />
          )}
          {isFull && (
            <span className="text-xs text-green-400 py-0.5">Team complete</span>
          )}
        </div>

        {/* Suggestions dropdown */}
        {isFocused && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 left-0 right-0 mt-1 rounded-lg border-2 border-poke-border max-h-[240px] overflow-y-auto"
            style={{ backgroundColor: '#1a1b30', boxShadow: '0 10px 40px rgba(0,0,0,0.9)' }}
          >
            {suggestions.map((species, i) => (
              <div
                key={species}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer ${
                  i === highlightIndex ? 'text-white' : 'text-slate-300'
                }`}
                style={{ backgroundColor: i === highlightIndex ? '#E3350D' : '#1a1b30' }}
                onMouseEnter={(e) => {
                  setHighlightIndex(i);
                  if (i !== highlightIndex) e.currentTarget.style.backgroundColor = '#2a2b45';
                }}
                onMouseLeave={(e) => {
                  if (i !== highlightIndex) e.currentTarget.style.backgroundColor = '#1a1b30';
                }}
                onMouseDown={(e) => { e.preventDefault(); addPokemon(species); }}
              >
                <Sprite species={species} size="sm" className="w-6 h-6" />
                <span>{species}</span>
                {i === 0 && input.trim() && (
                  <span className="ml-auto text-[10px] text-slate-500 font-mono">Tab/Enter</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hint text */}
      {value.length === 0 && (
        <p className="text-[11px] text-slate-600">
          Type names separated by comma or space. Paste full teams. Backspace to remove last.
        </p>
      )}
    </div>
  );
}
