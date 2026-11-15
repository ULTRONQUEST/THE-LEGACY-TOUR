import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Volume2, VolumeX } from 'lucide-react';
import { TelemetrySnapshot, VoyagerCanvas } from './components/VoyagerCanvas';
import { EncounterDock } from './components/EncounterDock';
import { LegacyPanel } from './components/LegacyPanel';
import { ENCOUNTER_SHOTS, ShotDefinition } from './scene/encounterDirector';

export default function App() {
  const [sceneReady, setSceneReady] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [cameraMode, setCameraMode] = useState<'guided' | 'free'>('guided');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  // Manual toggle vs automatic Shot 5 reveal for the Golden Legacy panel
  const [legacyManualOpen, setLegacyManualOpen] = useState<boolean | null>(null);
  const [seekRequest, setSeekRequest] = useState<{ progress: number; nonce: number } | null>(
    null
  );

  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    progress: 0,
    activeShot: ENCOUNTER_SHOTS[0],
    relativeVelocityKms: 480,
    distanceMeters: 175,
    speedFactor: 1,
  });

  const handleSeek = useCallback((progress: number) => {
    setSeekRequest((prev) => ({
      progress,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  }, []);

  const handleSelectShot = useCallback(
    (shot: ShotDefinition) => {
      setCameraMode('guided');
      setLegacyManualOpen(null);
      handleSeek(shot.start + 0.002);
      setIsPlaying(true);
    },
    [handleSeek]
  );

  const handleReplay = useCallback(() => {
    setCameraMode('guided');
    setLegacyManualOpen(null);
    handleSeek(0);
    setIsPlaying(true);
  }, [handleSeek]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleResumeGuided = useCallback(() => {
    setCameraMode('guided');
  }, []);

  const handleUserOrbitStart = useCallback(() => {
    setCameraMode('free');
  }, []);

  const handlePlaybackEnd = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const isLegacyShot = telemetry.activeShot.id === 5;
  const showLegacyPanel =
    legacyManualOpen !== null ? legacyManualOpen : isLegacyShot && !dockCollapsed;

  // Keyboard shortcuts: Space (Play/Pause), H (Hide/Show Controls), 1-6 (Jump to shot)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (telemetry.progress >= 0.998 && !isPlaying) {
          handleReplay();
        } else {
          handleTogglePlay();
        }
      } else if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key >= '1' && e.key <= '6') {
        const shot = ENCOUNTER_SHOTS[Number(e.key) - 1];
        if (shot) handleSelectShot(shot);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleReplay, handleSelectShot, handleTogglePlay, isPlaying, telemetry.progress]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#05060d] text-slate-100 select-none">
      {/* 3D WebGL Viewport or Graceful Fallback */}
      {webglError ? (
        <div className="relative flex h-full w-full items-center justify-center bg-[#060814]">
          <img
            src="/assets/aistudio/VOYAGER_1_9a9c9e26.jpeg"
            alt="Voyager 1 in interstellar space"
            className="h-full w-full object-cover opacity-60"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#05060d] via-[#05060d]/55 to-transparent" />
          <div className="relative z-10 max-w-md rounded-xl border border-slate-300/15 bg-[#080b16]/90 p-6 text-center">
            <h1 className="font-display text-xl font-medium text-white">
              Voyager 1 · Deep Space Encounter
            </h1>
            <p className="mt-2 text-sm text-slate-300">{webglError}</p>
          </div>
        </div>
      ) : (
        <VoyagerCanvas
          isPlaying={isPlaying}
          cameraMode={cameraMode}
          seekRequest={seekRequest}
          audioEnabled={audioEnabled}
          onUserOrbitStart={handleUserOrbitStart}
          onTelemetryUpdate={setTelemetry}
          onPlaybackEnd={handlePlaybackEnd}
          onSceneReady={() => setSceneReady(true)}
          onWebGLError={setWebglError}
        />
      )}

      {/* Initial Shader / Asset Load Fade Curtain */}
      {!sceneReady && !webglError && (
        <div className="pointer-events-none fixed inset-0 z-30 flex flex-col items-center justify-center bg-[#05060d] transition-opacity duration-500">
          <div className="font-display text-xl font-light tracking-wide text-slate-200">
            Voyager 1
          </div>
          <p className="mt-2 text-xs tracking-wider text-slate-400">
            Preparing interstellar encounter
          </p>
        </div>
      )}

      {/* Top Documentary Header (Non-intrusive, zero pills, zero NASA logos) */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-6 px-5 pt-5 sm:px-7">
        <div className="pointer-events-auto">
          <h1 className="font-display text-base font-medium tracking-tight text-white sm:text-lg">
            Voyager 1
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>Interstellar Space</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">~24.5 Billion km from Earth</span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setLegacyManualOpen((prev) => !(prev ?? showLegacyPanel))}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 ${
              showLegacyPanel
                ? 'border-amber-300/35 bg-amber-400/15 text-amber-100'
                : 'border-slate-300/15 bg-[#080b16]/80 text-slate-300 hover:bg-[#080b16] hover:text-white'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Golden Legacy</span>
          </button>

          <button
            type="button"
            onClick={() => setAudioEnabled((prev) => !prev)}
            aria-label={audioEnabled ? 'Mute ambient audio' : 'Enable ambient audio'}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 ${
              audioEnabled
                ? 'border-indigo-400/40 bg-indigo-500/20 text-indigo-100'
                : 'border-slate-300/15 bg-[#080b16]/80 text-slate-300 hover:bg-[#080b16] hover:text-white'
            }`}
          >
            {audioEnabled ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{audioEnabled ? 'Sound On' : 'Sound Off'}</span>
          </button>
        </div>
      </header>

      {/* Golden Legacy Panel (Positioned cleanly in right margin for Shot 5 & manual read) */}
      <LegacyPanel
        visible={showLegacyPanel}
        onClose={() => setLegacyManualOpen(false)}
      />

      {/* Documentary Shot Narration Caption (Sits cleanly above bottom dock) */}
      {!dockCollapsed && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-[126px] z-10 flex flex-col items-center px-6 text-center transition-opacity duration-300"
        >
          <div className="max-w-xl">
            <div className="font-mono-tabular text-[11px] tracking-widest text-indigo-300/90 uppercase">
              Chapter {telemetry.activeShot.code}
            </div>
            <div className="font-display mt-0.5 text-lg font-normal tracking-tight text-white sm:text-xl">
              {telemetry.activeShot.title}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-300/90 sm:text-sm">
              {telemetry.activeShot.subtitle}
            </p>
          </div>
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock */}
      {!webglError && (
        <EncounterDock
          telemetry={telemetry}
          isPlaying={isPlaying}
          cameraMode={cameraMode}
          collapsed={dockCollapsed}
          onToggleCollapse={() => setDockCollapsed((prev) => !prev)}
          onTogglePlay={handleTogglePlay}
          onReplay={handleReplay}
          onSeek={handleSeek}
          onSelectShot={handleSelectShot}
          onResumeGuided={handleResumeGuided}
        />
      )}
    </main>
  );
}
