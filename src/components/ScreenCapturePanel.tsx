import { useState, useEffect, useCallback, useRef } from 'react';
import { Sprite } from './Sprite';
import { PokeballSpinner } from './PokeballSpinner';
import {
  startScreenCapture,
  stopScreenCapture,
  isCapturing,
  captureFrameAsUrl,
  detectPokemonInFrame,
  captureFrame,
  loadSpriteProfiles,
  type DetectedPokemon,
} from '../utils/screenCapture';

interface ScreenCapturePanelProps {
  onDetected: (species: string[]) => void;
}

export function ScreenCapturePanel({ onDetected }: ScreenCapturePanelProps) {
  const [capturing, setCapturing] = useState(false);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectedPokemon[]>([]);
  const [profilesReady, setProfilesReady] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-load sprite profiles on mount
  useEffect(() => {
    loadSpriteProfiles(100).then(() => setProfilesReady(true));
  }, []);

  const handleStartCapture = useCallback(async () => {
    try {
      await startScreenCapture();
      setCapturing(true);
    } catch {
      // User cancelled or error
    }
  }, []);

  const handleStopCapture = useCallback(() => {
    stopScreenCapture();
    setCapturing(false);
    setFrameUrl(null);
    setDetected([]);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setAutoScan(false);
  }, []);

  // Check if capture is still active
  useEffect(() => {
    const check = setInterval(() => {
      if (capturing && !isCapturing()) {
        setCapturing(false);
        setAutoScan(false);
      }
    }, 1000);
    return () => clearInterval(check);
  }, [capturing]);

  const handleScanFrame = useCallback(async () => {
    const result = captureFrame();
    if (!result) return;

    const url = captureFrameAsUrl();
    setFrameUrl(url);
    setDetecting(true);

    const detections = await detectPokemonInFrame(
      result.imageData,
      result.canvas.width,
      result.canvas.height,
    );

    setDetected(detections);
    setDetecting(false);

    if (detections.length > 0) {
      onDetected(detections.map(d => d.species));
    }
  }, [onDetected]);

  // Auto-scan every 3 seconds when enabled
  useEffect(() => {
    if (autoScan && capturing) {
      intervalRef.current = setInterval(handleScanFrame, 3000);
      // Initial scan
      handleScanFrame();
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoScan, capturing, handleScanFrame]);

  const handleAcceptDetections = useCallback(() => {
    if (detected.length > 0) {
      onDetected(detected.map(d => d.species));
    }
  }, [detected, onDetected]);

  return (
    <div className="poke-panel p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-violet-400 uppercase tracking-wider">
          Screen Capture
        </div>
        {!profilesReady && (
          <span className="text-[10px] text-slate-600">Loading sprite data...</span>
        )}
      </div>

      {!capturing ? (
        <div className="space-y-2">
          <button
            onClick={handleStartCapture}
            disabled={!profilesReady}
            className={`w-full py-2.5 rounded-lg border text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              profilesReady
                ? 'border-violet-500/40 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20'
                : 'border-poke-border bg-poke-surface text-slate-600 cursor-wait'
            }`}
          >
            {profilesReady ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Share Game Screen
              </>
            ) : (
              <>
                <PokeballSpinner size={16} active />
                Preparing sprite detection...
              </>
            )}
          </button>
          <div className="text-[10px] text-slate-600 text-center">
            Share your screen or game window — the tool will scan for Pokemon during team preview
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={handleScanFrame}
              disabled={detecting}
              className="flex-1 py-1.5 rounded border border-violet-500/40 bg-violet-500/10 text-violet-400 text-xs font-bold hover:bg-violet-500/20 transition-colors flex items-center justify-center gap-1.5"
            >
              {detecting ? <PokeballSpinner size={14} active /> : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              {detecting ? 'Scanning...' : 'Scan Now'}
            </button>
            <button
              onClick={() => setAutoScan(!autoScan)}
              className={`px-3 py-1.5 rounded border text-xs font-bold transition-colors ${
                autoScan
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                  : 'border-poke-border bg-poke-surface text-slate-400 hover:text-white'
              }`}
            >
              {autoScan ? 'Auto: ON' : 'Auto: OFF'}
            </button>
            <button
              onClick={handleStopCapture}
              className="px-3 py-1.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors"
            >
              Stop
            </button>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>Screen capture active</span>
            {autoScan && <span className="text-emerald-400">· Auto-scanning every 3s</span>}
          </div>

          {/* Captured frame preview */}
          {frameUrl && (
            <div className="relative rounded-lg overflow-hidden border border-poke-border/50">
              <img src={frameUrl} alt="Captured frame" className="w-full h-auto max-h-40 object-contain bg-black/50" />
              {detecting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <PokeballSpinner size={32} label="Detecting Pokemon..." active />
                </div>
              )}
            </div>
          )}

          {/* Detections */}
          {detected.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-slate-500">Detected {detected.length} Pokemon:</span>
                <button
                  onClick={handleAcceptDetections}
                  className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold hover:bg-emerald-500/25 transition-colors"
                >
                  Accept All →
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {detected.map(d => (
                  <div key={d.species} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-poke-surface border border-violet-500/20">
                    <Sprite species={d.species} size="sm" />
                    <span className="text-[11px] text-white">{d.species}</span>
                    <span className="text-[9px] text-slate-600">{Math.round(d.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detected.length === 0 && frameUrl && !detecting && (
            <div className="text-[10px] text-slate-600 text-center py-1">
              No Pokemon detected in this frame. Try scanning during team preview.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
