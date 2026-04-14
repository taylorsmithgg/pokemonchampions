import { useState, useEffect, useCallback } from 'react';
import { Sprite } from './Sprite';
import { exportShowdownSet } from '../utils/importExport';
import type { PokemonState } from '../types';
import {
  saveTeamToLocal,
  loadSavedTeams,
  deleteSavedTeam,
  loadSavedTeam,
  exportTeamAsJson,
  importTeamFromJson,
  exportTeamAsCode,
  importTeamFromCode,
  type SavedTeam,
} from '../utils/teamStorage';

interface TeamStoragePanelProps {
  team: PokemonState[];
  onLoadTeam: (team: PokemonState[]) => void;
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

export function TeamStoragePanel({ team, onLoadTeam }: TeamStoragePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [savedTeams, setSavedTeams] = useState<SavedTeam[]>([]);
  const [saveName, setSaveName] = useState('');
  const [saveFlash, setSaveFlash] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportSection, setShowImportSection] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Load saved teams on open
  useEffect(() => {
    if (isOpen) {
      setSavedTeams(loadSavedTeams());
    }
  }, [isOpen]);

  const hasTeam = team.some(p => p.species);

  const handleSave = useCallback(() => {
    if (!hasTeam) return;
    const name = saveName.trim() || `Team ${new Date().toLocaleDateString()}`;
    saveTeamToLocal(name, team);
    setSavedTeams(loadSavedTeams());
    setSaveName('');
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1200);
  }, [team, saveName, hasTeam]);

  const handleLoad = useCallback((id: string) => {
    const loaded = loadSavedTeam(id);
    if (loaded) onLoadTeam(loaded);
  }, [onLoadTeam]);

  const handleDelete = useCallback((id: string) => {
    if (confirmDelete === id) {
      deleteSavedTeam(id);
      setSavedTeams(loadSavedTeams());
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  }, [confirmDelete]);

  // ── Export helpers ──

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(label);
      setTimeout(() => setCopyFeedback(''), 1500);
    });
    setShowExportMenu(false);
  }, []);

  const handleExportJson = useCallback(() => {
    const json = exportTeamAsJson(team, saveName || undefined);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(saveName || 'champions-team').replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [team, saveName]);

  const handleExportCode = useCallback(() => {
    const code = exportTeamAsCode(team);
    copyToClipboard(code, 'Code copied');
  }, [team, copyToClipboard]);

  const handleExportShowdown = useCallback(() => {
    const text = team
      .filter(p => p.species)
      .map(p => exportShowdownSet(p))
      .join('\n\n');
    copyToClipboard(text, 'Showdown format copied');
  }, [team, copyToClipboard]);

  // ── Import ──

  const handleImport = useCallback(() => {
    setImportError('');
    const text = importText.trim();
    if (!text) return;

    // Try JSON first
    const fromJson = importTeamFromJson(text);
    if (fromJson) {
      onLoadTeam(fromJson);
      setImportText('');
      setShowImportSection(false);
      return;
    }

    // Try shareable code
    const fromCode = importTeamFromCode(text);
    if (fromCode) {
      onLoadTeam(fromCode);
      setImportText('');
      setShowImportSection(false);
      return;
    }

    setImportError('Could not parse input. Paste a JSON export or shareable code.');
  }, [importText, onLoadTeam]);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = () => setShowExportMenu(false);
    const t = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', handler);
    };
  }, [showExportMenu]);

  return (
    <div className="poke-panel border border-poke-border rounded-xl overflow-hidden">
      {/* Collapse header */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-poke-darkest hover:bg-poke-surface transition-colors"
      >
        <span className="text-sm font-semibold text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-poke-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Save &amp; Export
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="bg-poke-darkest border-t border-poke-border">
          {/* ── Save Section ── */}
          <div className="px-4 py-3 border-b border-poke-border/50">
            <div className="flex gap-2">
              <input
                type="text"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="Team name..."
                className="flex-1 bg-poke-surface border border-poke-border rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-poke-red/50"
                maxLength={40}
              />
              <button
                onClick={handleSave}
                disabled={!hasTeam}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  saveFlash
                    ? 'bg-green-600 text-white'
                    : hasTeam
                    ? 'bg-poke-red text-white hover:bg-poke-red-dark'
                    : 'bg-poke-surface text-slate-600 cursor-not-allowed'
                }`}
              >
                {saveFlash ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>

          {/* ── Export / Import Buttons ── */}
          <div className="px-4 py-2 flex gap-2 border-b border-poke-border/50">
            <div className="relative">
              <button
                onClick={e => { e.stopPropagation(); setShowExportMenu(v => !v); }}
                disabled={!hasTeam}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  hasTeam
                    ? 'bg-poke-surface text-poke-gold border border-poke-border hover:border-poke-gold/50'
                    : 'bg-poke-surface text-slate-600 cursor-not-allowed'
                }`}
              >
                Export ▾
              </button>
              {showExportMenu && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-poke-surface border border-poke-border rounded-lg shadow-xl z-50 overflow-hidden">
                  <button onClick={handleExportJson} className="w-full text-left px-3 py-2 text-xs text-white hover:bg-poke-darkest transition-colors">
                    Download JSON file
                  </button>
                  <button onClick={handleExportCode} className="w-full text-left px-3 py-2 text-xs text-white hover:bg-poke-darkest transition-colors border-t border-poke-border/50">
                    Copy shareable code
                  </button>
                  <button onClick={handleExportShowdown} className="w-full text-left px-3 py-2 text-xs text-white hover:bg-poke-darkest transition-colors border-t border-poke-border/50">
                    Copy Showdown format
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => { setShowImportSection(v => !v); setImportError(''); }}
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-poke-surface text-slate-300 border border-poke-border hover:border-slate-500 transition-colors"
            >
              Import
            </button>

            {copyFeedback && (
              <span className="text-xs text-green-400 self-center ml-1 animate-pulse">{copyFeedback}</span>
            )}
          </div>

          {/* ── Import Section ── */}
          {showImportSection && (
            <div className="px-4 py-3 border-b border-poke-border/50">
              <textarea
                className="w-full bg-poke-surface border border-poke-border rounded-lg px-3 py-2 text-xs text-white font-mono resize-none focus:outline-none focus:border-poke-red/50"
                rows={5}
                placeholder="Paste JSON export or shareable code..."
                value={importText}
                onChange={e => { setImportText(e.target.value); setImportError(''); }}
              />
              {importError && (
                <p className="text-xs text-poke-red mt-1">{importError}</p>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleImport}
                  className="text-xs px-3 py-1.5 bg-poke-red text-white rounded-lg hover:bg-poke-red-dark transition-colors font-medium"
                >
                  Load Team
                </button>
                <button
                  onClick={() => { setShowImportSection(false); setImportText(''); setImportError(''); }}
                  className="text-xs px-3 py-1.5 bg-poke-surface text-slate-400 rounded-lg hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Saved Teams List ── */}
          <div className="px-4 py-3">
            {savedTeams.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2">No saved teams yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {savedTeams.map(saved => (
                  <div
                    key={saved.id}
                    className="flex items-center gap-3 bg-poke-surface rounded-lg px-3 py-2 border border-poke-border/50 hover:border-poke-border transition-colors"
                  >
                    {/* Sprites */}
                    <div className="flex -space-x-1 shrink-0">
                      {saved.team.slice(0, 6).map((slot, i) =>
                        slot.species ? (
                          <div key={i} className="w-6 h-6 rounded-full bg-poke-darkest border border-poke-border/50 overflow-hidden flex items-center justify-center">
                            <Sprite species={slot.species} size="sm" className="scale-75" />
                          </div>
                        ) : (
                          <div key={i} className="w-6 h-6 rounded-full bg-poke-darkest border border-poke-border/30" />
                        )
                      )}
                    </div>

                    {/* Name + date */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium truncate">{saved.name}</p>
                      <p className="text-[10px] text-slate-500">{formatDate(saved.timestamp)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleLoad(saved.id)}
                        className="text-[10px] px-2 py-1 rounded bg-poke-darkest text-poke-gold border border-poke-border/50 hover:border-poke-gold/50 transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDelete(saved.id)}
                        className={`text-[10px] px-2 py-1 rounded transition-colors ${
                          confirmDelete === saved.id
                            ? 'bg-poke-red text-white'
                            : 'bg-poke-darkest text-slate-500 border border-poke-border/50 hover:text-poke-red hover:border-poke-red/50'
                        }`}
                      >
                        {confirmDelete === saved.id ? 'Confirm?' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
