import { useState, useEffect, useCallback, useRef } from 'react';
import { Sprite } from './Sprite';
import { PokeballSpinner, PokeballMini } from './PokeballSpinner';
import {
  startScreenCapture,
  stopScreenCapture,
  isCapturing,
  captureFrame,
  loadSpriteProfiles,
  scanFrame,
  drawScanOverlay,
  getProfileLoadProgress,
  type ScanResult,
} from '../utils/screenCapture';

interface ScreenCapturePanelProps {
  onDetected: (species: string[]) => void;
}

export function ScreenCapturePanel({ onDetected }: ScreenCapturePanelProps) {
  const [capturing, setCapturing] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [profilesReady, setProfilesReady] = useState(false);
  const [profileProgress, setProfileProgress] = useState(0);
  const [autoScan, setAutoScan] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showRejected, setShowRejected] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [acceptedSpecies, setAcceptedSpecies] = useState<Set<string>>(new Set());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pre-load sprite profiles with progress tracking
  useEffect(() => {
    const trackProgress = setInterval(() => {
      setProfileProgress(getProfileLoadProgress());
    }, 200);
    loadSpriteProfiles(150).then(() => {
      setProfilesReady(true);
      clearInterval(trackProgress);
      setProfileProgress(100);
    });
    return () => clearInterval(trackProgress);
  }, []);

  const handleStartCapture = useCallback(async () => {
    try {
      await startScreenCapture();
      setCapturing(true);
      setScanResult(null);
      setScanCount(0);
      setAcceptedSpecies(new Set());
    } catch {
      // User cancelled
    }
  }, []);

  const handleStopCapture = useCallback(() => {
    stopScreenCapture();
    setCapturing(false);
    setScanResult(null);
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

  // Draw frame + overlay on canvas
  const drawFrame = useCallback((result: ScanResult, frameCanvas: HTMLCanvasElement) => {
    const displayCanvas = canvasRef.current;
    if (!displayCanvas) return;

    const ctx = displayCanvas.getContext('2d');
    if (!ctx) return;

    // Size the display canvas to match frame aspect ratio
    const maxW = displayCanvas.parentElement?.clientWidth || 600;
    const scale = maxW / result.frameWidth;
    displayCanvas.width = maxW;
    displayCanvas.height = Math.round(result.frameHeight * scale);

    // Draw the captured frame
    ctx.drawImage(frameCanvas, 0, 0, displayCanvas.width, displayCanvas.height);

    // Scale context for overlay drawing
    ctx.save();
    ctx.scale(scale, scale);

    // Draw the scan overlay
    drawScanOverlay(ctx, result, { showGrid, showRejected, showLabels: true });

    ctx.restore();
  }, [showGrid, showRejected]);

  // Redraw overlay when toggles change
  useEffect(() => {
    if (scanResult && frameCanvasRef.current) {
      drawFrame(scanResult, frameCanvasRef.current);
    }
  }, [showGrid, showRejected, scanResult, drawFrame]);

  const handleScanFrame = useCallback(async () => {
    const result = captureFrame();
    if (!result) return;

    setDetecting(true);

    // Keep a reference to the raw frame canvas for redrawing
    frameCanvasRef.current = result.canvas;

    const scan = await scanFrame(
      result.imageData,
      result.canvas.width,
      result.canvas.height,
    );

    setScanResult(scan);
    setScanCount(prev => prev + 1);
    setDetecting(false);

    // Draw frame with overlay
    drawFrame(scan, result.canvas);

    // Auto-accept high-confidence detections
    if (scan.detections.length > 0) {
      const highConf = scan.detections.filter(d => d.confidence >= 0.3);
      if (highConf.length > 0) {
        setAcceptedSpecies(prev => {
          const next = new Set(prev);
          for (const d of highConf) next.add(d.species);
          return next;
        });
      }
    }
  }, [drawFrame]);

  // Auto-scan interval
  useEffect(() => {
    if (autoScan && capturing) {
      intervalRef.current = setInterval(handleScanFrame, 3000);
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

  const handleAcceptAll = useCallback(() => {
    if (scanResult && scanResult.detections.length > 0) {
      const species = scanResult.detections.map(d => d.species);
      onDetected(species);
      setAcceptedSpecies(new Set(species));
    }
  }, [scanResult, onDetected]);

  const handleAcceptSingle = useCallback((species: string) => {
    setAcceptedSpecies(prev => {
      const next = new Set(prev);
      next.add(species);
      const all = [...next];
      onDetected(all);
      return next;
    });
  }, [onDetected]);

  const handleRejectSingle = useCallback((species: string) => {
    setAcceptedSpecies(prev => {
      const next = new Set(prev);
      next.delete(species);
      onDetected([...next]);
      return next;
    });
  }, [onDetected]);

  const handleSendAccepted = useCallback(() => {
    if (acceptedSpecies.size > 0) {
      onDetected([...acceptedSpecies]);
    }
  }, [acceptedSpecies, onDetected]);

  return (
    <div className="space-y-3">
      {/* Profile loading progress */}
      {!profilesReady && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <PokeballMini />
            <span>Loading sprite profiles... {profileProgress}%</span>
          </div>
          <div className="h-1.5 bg-poke-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${profileProgress}%` }}
            />
          </div>
        </div>
      )}

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
            Share your screen or game window. The scanner will look for Pokemon sprites and highlight what it finds.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Controls row */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={handleScanFrame}
              disabled={detecting}
              className="flex-1 py-1.5 rounded border border-violet-500/40 bg-violet-500/10 text-violet-400 text-xs font-bold hover:bg-violet-500/20 transition-colors flex items-center justify-center gap-1.5 min-w-[80px]"
            >
              {detecting ? <PokeballMini /> : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              {detecting ? 'Scanning...' : 'Scan'}
            </button>
            <button
              onClick={() => setAutoScan(!autoScan)}
              className={`px-3 py-1.5 rounded border text-xs font-bold transition-colors ${
                autoScan
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                  : 'border-poke-border bg-poke-surface text-slate-400 hover:text-white'
              }`}
            >
              {autoScan ? 'Auto ON' : 'Auto'}
            </button>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`px-2 py-1.5 rounded border text-xs transition-colors ${
                showGrid
                  ? 'border-violet-500/40 bg-violet-500/15 text-violet-400'
                  : 'border-poke-border bg-poke-surface text-slate-600 hover:text-slate-400'
              }`}
              title="Show scan grid"
            >
              Grid
            </button>
            <button
              onClick={() => setShowRejected(!showRejected)}
              className={`px-2 py-1.5 rounded border text-xs transition-colors ${
                showRejected
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                  : 'border-poke-border bg-poke-surface text-slate-600 hover:text-slate-400'
              }`}
              title="Show rejected regions"
            >
              Misses
            </button>
            <button
              onClick={handleStopCapture}
              className="px-3 py-1.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors"
            >
              Stop
            </button>
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${autoScan ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
              <span>{autoScan ? 'Auto-scanning every 3s' : 'Live capture active'}</span>
            </div>
            {scanCount > 0 && (
              <span className="text-slate-600">Scans: {scanCount}</span>
            )}
            {scanResult && (
              <>
                <span className="text-slate-600">{scanResult.regions.length} regions</span>
                <span className={scanResult.detections.length > 0 ? 'text-emerald-400' : 'text-slate-600'}>
                  {scanResult.detections.length} found
                </span>
                <span className="text-slate-700">{scanResult.durationMs}ms</span>
              </>
            )}
          </div>

          {/* Canvas with overlay */}
          <div className="relative rounded-lg overflow-hidden border border-poke-border/50 bg-black/50">
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
              style={{ minHeight: '120px', maxHeight: '300px' }}
            />
            {detecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                <div className="flex flex-col items-center gap-2">
                  <PokeballSpinner size={32} active />
                  <span className="text-xs text-violet-400 font-bold">Scanning frame...</span>
                </div>
              </div>
            )}
            {!scanResult && !detecting && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-slate-600">Click Scan or enable Auto to start detection</span>
              </div>
            )}
          </div>

          {/* Detection results */}
          {scanResult && scanResult.detections.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Detections ({scanResult.detections.length})
                </span>
                <div className="flex gap-1.5">
                  {acceptedSpecies.size > 0 && (
                    <button
                      onClick={handleSendAccepted}
                      className="text-[10px] px-2 py-0.5 rounded bg-poke-blue/15 border border-poke-blue/30 text-poke-blue font-bold hover:bg-poke-blue/25 transition-colors"
                    >
                      Use {acceptedSpecies.size} Selected
                    </button>
                  )}
                  <button
                    onClick={handleAcceptAll}
                    className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold hover:bg-emerald-500/25 transition-colors"
                  >
                    Accept All
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                {scanResult.detections.map(d => {
                  const isAccepted = acceptedSpecies.has(d.species);
                  const confColor = d.confidence >= 0.6 ? 'text-emerald-400' : d.confidence >= 0.35 ? 'text-amber-400' : 'text-orange-400';
                  const confBg = d.confidence >= 0.6 ? 'bg-emerald-500' : d.confidence >= 0.35 ? 'bg-amber-500' : 'bg-orange-500';
                  return (
                    <div
                      key={d.species}
                      className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                        isAccepted
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : 'border-poke-border bg-poke-surface/30 hover:border-poke-border-light'
                      }`}
                    >
                      <Sprite species={d.species} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">{d.species}</span>
                          <span className={`text-[10px] font-mono ${confColor}`}>{Math.round(d.confidence * 100)}%</span>
                        </div>
                        {/* Confidence bar */}
                        <div className="h-1 bg-poke-surface rounded-full overflow-hidden mt-0.5" style={{ width: '60px' }}>
                          <div className={`h-full rounded-full ${confBg}`} style={{ width: `${d.confidence * 100}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-600">
                          ({Math.round(d.x)},{Math.round(d.y)})
                        </span>
                        {isAccepted ? (
                          <button
                            onClick={() => handleRejectSingle(d.species)}
                            className="w-5 h-5 rounded flex items-center justify-center bg-emerald-500/20 text-emerald-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                            title="Remove"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAcceptSingle(d.species)}
                            className="w-5 h-5 rounded flex items-center justify-center bg-poke-surface text-slate-500 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors"
                            title="Accept"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No detections message */}
          {scanResult && scanResult.detections.length === 0 && !detecting && (
            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="text-xs text-amber-400 font-bold mb-0.5">No Pokemon detected</div>
                  <div className="text-[10px] text-slate-500 leading-relaxed">
                    Scanned {scanResult.regions.length} regions in {scanResult.durationMs}ms.
                    Try scanning during team preview when sprites are large and visible.
                    Toggle "Grid" and "Misses" to see what regions were analyzed.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Accepted species summary (sticky across scans) */}
          {acceptedSpecies.size > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
              <span className="text-[10px] text-emerald-400 font-bold shrink-0">Selected:</span>
              <div className="flex items-center gap-1.5 flex-wrap flex-1">
                {[...acceptedSpecies].map(species => (
                  <div key={species} className="flex items-center gap-0.5 px-1 py-0.5 bg-poke-surface rounded border border-emerald-500/20">
                    <Sprite species={species} size="sm" />
                    <span className="text-[10px] text-white">{species}</span>
                    <button
                      onClick={() => handleRejectSingle(species)}
                      className="text-slate-600 hover:text-red-400 transition-colors ml-0.5"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleSendAccepted}
                className="text-[10px] px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold hover:bg-emerald-500/25 transition-colors shrink-0"
              >
                Use These
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
