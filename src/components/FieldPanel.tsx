import type { FieldState, SideState, Weather, Terrain, GameType } from '../types';

interface FieldPanelProps {
  state: FieldState;
  onChange: (state: FieldState) => void;
}

const WEATHERS: { id: Weather | ''; label: string }[] = [
  { id: '', label: 'None' },
  { id: 'Sun', label: 'Sun' },
  { id: 'Rain', label: 'Rain' },
  { id: 'Sand', label: 'Sand' },
  { id: 'Snow', label: 'Snow' },
  { id: 'Harsh Sunshine', label: 'Harsh Sun' },
  { id: 'Heavy Rain', label: 'Heavy Rain' },
  { id: 'Strong Winds', label: 'Strong Winds' },
];

const TERRAINS: { id: Terrain | ''; label: string }[] = [
  { id: '', label: 'None' },
  { id: 'Electric', label: 'Electric' },
  { id: 'Grassy', label: 'Grassy' },
  { id: 'Misty', label: 'Misty' },
  { id: 'Psychic', label: 'Psychic' },
];

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer group">
      <div
        className={`w-3.5 h-3.5 rounded border-2 transition-colors flex items-center justify-center ${
          checked
            ? 'bg-indigo-500 border-poke-red'
            : 'border-slate-600 group-hover:border-slate-500'
        }`}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-[11px] text-slate-400 select-none">{label}</span>
    </label>
  );
}

function SidePanel({ label, side, onChange }: { label: string; side: SideState; onChange: (s: SideState) => void }) {
  const update = <K extends keyof SideState>(key: K, value: SideState[K]) => {
    onChange({ ...side, [key]: value });
  };

  return (
    <div>
      <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</h4>
      <div className="space-y-1.5">
        <Toggle label="Stealth Rock" checked={side.isSR} onChange={v => update('isSR', v)} />
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Spikes</span>
          <select
            value={side.spikes}
            onChange={e => update('spikes', parseInt(e.target.value))}
            className="bg-poke-surface border border-poke-border rounded text-[11px] text-white px-1 py-0.5"
          >
            {[0, 1, 2, 3].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <Toggle label="Reflect" checked={side.isReflect} onChange={v => update('isReflect', v)} />
        <Toggle label="Light Screen" checked={side.isLightScreen} onChange={v => update('isLightScreen', v)} />
        <Toggle label="Aurora Veil" checked={side.isAuroraVeil} onChange={v => update('isAuroraVeil', v)} />
        <Toggle label="Tailwind" checked={side.isTailwind} onChange={v => update('isTailwind', v)} />
        <Toggle label="Helping Hand" checked={side.isHelpingHand} onChange={v => update('isHelpingHand', v)} />
        <Toggle label="Friend Guard" checked={side.isFriendGuard} onChange={v => update('isFriendGuard', v)} />
        <Toggle label="Battery" checked={side.isBattery} onChange={v => update('isBattery', v)} />
        <Toggle label="Power Spot" checked={side.isPowerSpot} onChange={v => update('isPowerSpot', v)} />
      </div>
    </div>
  );
}

export function FieldPanel({ state, onChange }: FieldPanelProps) {
  const update = <K extends keyof FieldState>(key: K, value: FieldState[K]) => {
    onChange({ ...state, [key]: value });
  };

  return (
    <div className="poke-panel overflow-hidden">
      <div className="px-4 py-2.5 poke-panel-header bg-gradient-to-r from-emerald-900/20 to-transparent">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Field</h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Format */}
        <div className="flex gap-2">
          {(['Singles', 'Doubles'] as GameType[]).map(fmt => (
            <button
              key={fmt}
              onClick={() => update('format', fmt)}
              className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                state.format === fmt
                  ? 'bg-indigo-500/20 border-poke-red/50 text-indigo-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>

        {/* Weather */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Weather</label>
          <select
            value={state.weather}
            onChange={e => update('weather', e.target.value as Weather | '')}
            className="w-full bg-poke-surface border border-poke-border rounded-lg px-2 py-1.5 text-sm text-white"
          >
            {WEATHERS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
        </div>

        {/* Terrain */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Terrain</label>
          <select
            value={state.terrain}
            onChange={e => update('terrain', e.target.value as Terrain | '')}
            className="w-full bg-poke-surface border border-poke-border rounded-lg px-2 py-1.5 text-sm text-white"
          >
            {TERRAINS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        {/* Global effects */}
        <div className="space-y-1.5">
          <Toggle label="Gravity" checked={state.isGravity} onChange={v => update('isGravity', v)} />
          <Toggle label="Beads of Ruin" checked={state.isBeadsOfRuin} onChange={v => update('isBeadsOfRuin', v)} />
          <Toggle label="Sword of Ruin" checked={state.isSwordOfRuin} onChange={v => update('isSwordOfRuin', v)} />
          <Toggle label="Tablets of Ruin" checked={state.isTabletsOfRuin} onChange={v => update('isTabletsOfRuin', v)} />
          <Toggle label="Vessel of Ruin" checked={state.isVesselOfRuin} onChange={v => update('isVesselOfRuin', v)} />
        </div>

        {/* Side conditions */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
          <SidePanel
            label="Attacker Side"
            side={state.attackerSide}
            onChange={s => update('attackerSide', s)}
          />
          <SidePanel
            label="Defender Side"
            side={state.defenderSide}
            onChange={s => update('defenderSide', s)}
          />
        </div>
      </div>
    </div>
  );
}
