import { useState, useRef, useEffect, useMemo, useCallback } from 'react';

interface SearchSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  renderOption?: (option: string) => React.ReactNode;
}

export function SearchSelect({ options, value, onChange, placeholder = 'Select...', label, className = '', renderOption }: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search) return options.slice(0, 100);
    const lower = search.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(lower)).slice(0, 100);
  }, [options, search]);

  // Calculate dropdown position relative to viewport (fixed positioning)
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed' as const,
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Also check if click is in the fixed dropdown
        const dropdown = document.getElementById('search-select-dropdown');
        if (dropdown && dropdown.contains(e.target as Node)) return;
        setIsOpen(false);
        setSearch('');
      }
    }
    function handleScroll() {
      if (isOpen) updatePosition();
    }
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, updatePosition]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>}
      <div
        ref={triggerRef}
        className="flex items-center bg-poke-surface border border-poke-border rounded-lg px-3 py-1.5 cursor-pointer hover:border-poke-red/40 transition-colors"
        onClick={() => {
          setIsOpen(true);
          updatePosition();
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-sm text-white outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={placeholder}
            onKeyDown={e => {
              if (e.key === 'Enter' && filtered.length > 0) {
                onChange(filtered[0]);
                setIsOpen(false);
                setSearch('');
              }
              if (e.key === 'Escape') {
                setIsOpen(false);
                setSearch('');
              }
            }}
          />
        ) : (
          <span className={`text-sm truncate ${value ? 'text-white' : 'text-slate-500'}`}>
            {value || placeholder}
          </span>
        )}
        <svg className="w-4 h-4 ml-auto text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {isOpen && (
        <div
          id="search-select-dropdown"
          className="rounded-lg border-2 border-poke-border max-h-60 overflow-y-auto"
          style={{ ...dropdownStyle, backgroundColor: '#1a1b30', boxShadow: '0 10px 40px rgba(0,0,0,0.9)' }}
        >
          {value && (
            <div
              className="px-3 py-2 text-sm text-slate-400 cursor-pointer border-b border-poke-border"
              style={{ backgroundColor: '#1a1b30' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#2a2b45')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#1a1b30')}
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearch('');
              }}
            >
              Clear
            </div>
          )}
          {filtered.map(option => (
            <div
              key={option}
              className={`px-3 py-2 text-sm cursor-pointer ${
                option === value ? 'text-white' : 'text-slate-300'
              }`}
              style={{ backgroundColor: option === value ? '#E3350D' : '#1a1b30' }}
              onMouseEnter={e => { if (option !== value) e.currentTarget.style.backgroundColor = '#2a2b45'; }}
              onMouseLeave={e => { if (option !== value) e.currentTarget.style.backgroundColor = '#1a1b30'; }}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
                setSearch('');
              }}
            >
              {renderOption ? renderOption(option) : option}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-500" style={{ backgroundColor: '#1a1b30' }}>No results</div>
          )}
        </div>
      )}
    </div>
  );
}
