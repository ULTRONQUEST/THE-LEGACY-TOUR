import { useCallback, useRef, useState } from 'react';
import { CinemaHud } from './components/CinemaHud';
import {
  ExperienceController,
  MoonExperienceCanvas,
} from './components/MoonExperienceCanvas';
import { ShotDefinition } from './scene/constants';

export default function App() {
  const controllerRef = useRef<ExperienceController | null>(null);

  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isManualControl, setIsManualControl] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleTogglePlay = useCallback(() => {
    if (!isPlaying && progress >= 0.995) {
      setProgress(0);
      setIsManualControl(false);
      setIsPlaying(true);
      controllerRef.current?.seekTo(0, true);
      return;
    }
    setIsPlaying((prev) => {
      const next = !prev;
      controllerRef.current?.setPlaying(next);
      if (next) {
        setIsManualControl(false);
      }
      return next;
    });
  }, [isPlaying, progress]);

  const handleSelectShot = useCallback((shot: ShotDefinition) => {
    const targetProgress =
      shot.id === 1 ? 0 : Math.min(0.995, shot.start + 0.005);
    setProgress(targetProgress);
    setIsManualControl(false);
    setIsPlaying(true);
    controllerRef.current?.seekTo(targetProgress, true);
  }, []);

  const handleScrub = useCallback((nextProgress: number) => {
    setProgress(nextProgress);
    setIsManualControl(false);
    setIsPlaying(false);
    controllerRef.current?.seekTo(nextProgress, false);
  }, []);

  const handleReplay = useCallback(() => {
    setProgress(0);
    setIsManualControl(false);
    setIsPlaying(true);
    controllerRef.current?.seekTo(0, true);
  }, []);

  const handleResumeFilm = useCallback(() => {
    setIsManualControl(false);
    setIsPlaying(true);
    if (progress >= 0.995) {
      setProgress(0);
      controllerRef.current?.seekTo(0, true);
    } else {
      controllerRef.current?.resumeAutoCamera();
    }
  }, [progress]);

  const handleManualEngage = useCallback(() => {
    setIsManualControl(true);
    setIsPlaying(false);
  }, []);

  const handleReady = useCallback(() => {
    setIsReady(true);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#020306] text-slate-100 select-none">
      {/* Full-Viewport 3D WebGL Scene */}
      {!errorMsg && (
        <MoonExperienceCanvas
          isPlaying={isPlaying}
          isManualControl={isManualControl}
          onProgressChange={setProgress}
          onManualEngage={handleManualEngage}
          onLoadProgress={setLoadProgress}
          onReady={handleReady}
          onError={setErrorMsg}
          controllerRef={controllerRef}
        />
      )}

      {/* Subtle Top Readability Scrim */}
      {isReady && !errorMsg && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 z-10 h-44 bg-gradient-to-b from-black/70 via-black/30 to-transparent"
        />
      )}

      {/* Editorial Documentary HUD & Collapsible Bottom Dock */}
      {!errorMsg && (
        <CinemaHud
          progress={progress}
          isPlaying={isPlaying}
          isManualControl={isManualControl}
          isReady={isReady}
          onTogglePlay={handleTogglePlay}
          onSelectShot={handleSelectShot}
          onScrub={handleScrub}
          onReplay={handleReplay}
          onResumeFilm={handleResumeFilm}
        />
      )}

      {/* Loading State Overlay */}
      {!isReady && !errorMsg && (
        <div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#030407] px-6 text-center transition-opacity duration-500"
          role="status"
          aria-live="polite"
        >
          <p className="font-mono-tabular text-xs tracking-widest text-amber-300/85 uppercase">
            Tranquility Base · July 1969
          </p>
          <h1 className="font-editorial mt-3 text-3xl font-medium text-white sm:text-5xl text-balance">
            Preparing Lunar Surface Reconstruction
          </h1>
          <p className="mt-3 max-w-md text-sm text-slate-400">
            Synthesizing spherical selenography, crater relief, and historical
            Apollo 11 geometry.
          </p>

          <div className="mt-8 w-full max-w-xs">
            <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/12">
              <div
                className="h-full bg-amber-400 transition-[width] duration-150"
                style={{ width: `${Math.round(loadProgress * 100)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-mono-tabular">
              <span>Generating surface maps</span>
              <span>{Math.round(loadProgress * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Graceful WebGL / Asset Fallback View */}
      {errorMsg && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#030407] p-6 text-center">
          <div className="max-w-2xl rounded-xl border border-white/12 bg-[#090c12] p-6 sm:p-8">
            <p className="font-mono-tabular text-xs text-amber-300/90">
              3D Viewport Fallback
            </p>
            <h1 className="font-editorial mt-2 text-3xl font-medium text-white">
              Lunar Odyssey — Tranquility Base 1969
            </h1>
            <p className="mt-2 text-sm text-slate-300">{errorMsg}</p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <figure className="overflow-hidden rounded-lg border border-white/10 bg-black">
                <img
                  src="/assets/aistudio/MOON_3_D_f0798ed5.jpeg"
                  alt="Full Moon lunar surface visual reference"
                  referrerPolicy="no-referrer"
                  className="h-48 w-full object-cover"
                />
                <figcaption className="px-3 py-2 text-left text-xs text-slate-400">
                  Full-disk lunar selenography reference
                </figcaption>
              </figure>
              <figure className="overflow-hidden rounded-lg border border-white/10 bg-black">
                <img
                  src="/assets/aistudio/APOLLO_6056b825.jpeg"
                  alt="Apollo 11 historical scene reference"
                  referrerPolicy="no-referrer"
                  className="h-48 w-full object-cover"
                />
                <figcaption className="px-3 py-2 text-left text-xs text-slate-400">
                  Apollo 11 surface composition reference
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
