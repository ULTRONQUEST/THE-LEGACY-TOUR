import {
  ChevronDown,
  ChevronUp,
  Info,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { SHOTS, ShotDefinition, getShotForProgress } from '../scene/constants';

interface CinemaHudProps {
  progress: number;
  isPlaying: boolean;
  isManualControl: boolean;
  isReady: boolean;
  onTogglePlay: () => void;
  onSelectShot: (shot: ShotDefinition) => void;
  onScrub: (progress01: number) => void;
  onReplay: () => void;
  onResumeFilm: () => void;
}

export function CinemaHud({
  progress,
  isPlaying,
  isManualControl,
  isReady,
  onTogglePlay,
  onSelectShot,
  onScrub,
  onReplay,
  onResumeFilm,
}: CinemaHudProps) {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const currentShot = getShotForProgress(progress);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === ' ') {
        const target = e.target as HTMLElement | null;
        if (target?.tagName !== 'BUTTON' && target?.tagName !== 'INPUT') {
          e.preventDefault();
          onTogglePlay();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onTogglePlay]);

  if (!isReady) return null;

  return (
    <>
      {/* Subtle Top-Left Editorial Documentary Title & Current Shot Narrative */}
      <header className="pointer-events-none fixed top-0 left-0 right-0 z-20 flex items-start justify-between px-6 pt-5 sm:px-8 sm:pt-7">
        <div className="max-w-lg">
          <div className="flex items-center gap-2.5 text-xs tracking-wide text-slate-400">
            <span className="font-mono-tabular text-amber-300/90">
              {currentShot.code} / 05
            </span>
            <span aria-hidden="true">·</span>
            <span>{currentShot.subtitle}</span>
          </div>
          <h1 className="font-editorial mt-1.5 text-2xl font-medium tracking-tight text-slate-100 sm:text-4xl text-balance">
            {currentShot.title}
          </h1>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-300/85 sm:text-sm">
            {currentShot.description}
          </p>
        </div>

        {/* Discreet Historical Attribution Trigger */}
        <button
          type="button"
          onClick={() => setNotesOpen((v) => !v)}
          className="pointer-events-auto flex items-center gap-2 rounded-lg border border-white/10 bg-[#080a0f]/85 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 whitespace-nowrap shrink-0"
          aria-expanded={notesOpen}
        >
          <Info className="h-3.5 w-3.5 text-amber-300/90" />
          <span>Historical Notes</span>
        </button>
      </header>

      {/* Optional Historical Context Modal / Sheet (User-triggered only, never on arrival) */}
      {notesOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="historical-notes-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-white/15 bg-[#090c12] p-6 text-slate-200 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-amber-300/90 font-mono-tabular">
                  Tranquility Base · July 20, 1969
                </p>
                <h2
                  id="historical-notes-title"
                  className="font-editorial mt-1 text-2xl font-medium text-white"
                >
                  Historically Informed 3D Reconstruction
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setNotesOpen(false)}
                className="rounded-lg border border-white/10 p-1.5 text-slate-400 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                aria-label="Close historical notes"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
              <p>
                This interactive experience is an independent, historically
                informed 3D visualization—not original archival footage or an
                official agency production.
              </p>
              <p>
                The full lunar sphere uses procedural three-dimensional
                selenography inspired by full-disk Moon observations, while the
                surface diorama recreates the compositional geometry, A7L
                pressure suits, gold-foiled Lunar Module descent stage, flag
                assembly, and low morning solar shadows of the Apollo 11 EVA.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
              <span>Controls: Drag to orbit · Scroll to zoom · H to hide HUD</span>
              <button
                type="button"
                onClick={() => setNotesOpen(false)}
                className="rounded-lg bg-amber-400/90 px-4 py-1.5 font-medium text-slate-950 transition-colors hover:bg-amber-300"
              >
                Return to Scene
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Collapsible Bottom Cinema Control Dock */}
      <div
        className={`fixed bottom-4 left-1/2 z-20 -translate-x-1/2 transition-transform duration-300 ease-out ${
          dockCollapsed ? 'translate-y-[calc(100%-34px)]' : 'translate-y-0'
        }`}
        style={{ width: 'min(920px, 94vw)' }}
      >
        {/* Collapse / Expand Tab */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-white/12 bg-[#090c12]/90 px-3.5 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 whitespace-nowrap"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>Show Controls (H)</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span>Hide Controls (H)</span>
              </>
            )}
          </button>
        </div>

        {/* Solid/Translucent Dock Body (No backdrop-filter over WebGL) */}
        <div className="rounded-xl border border-white/12 bg-[#090c12]/92 px-4 py-3 shadow-2xl">
          {/* Top Row: Playback, Scrub Bar, Interactive Status */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={isManualControl ? onResumeFilm : onTogglePlay}
                className="flex h-9 items-center gap-2 rounded-lg bg-amber-400/95 px-3.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 whitespace-nowrap shrink-0"
              >
                {isPlaying && !isManualControl ? (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    <span>Pause</span>
                  </>
                ) : isManualControl ? (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    <span>Resume Sequence</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    <span>Play</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onReplay}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 whitespace-nowrap shrink-0"
                title="Restart from Shot 1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Restart</span>
              </button>
            </div>

            {/* Interactive Timeline Scrubber */}
            <div className="flex min-w-[180px] flex-1 items-center gap-3 px-1">
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(progress * 1000)}
                onChange={(e) => onScrub(Number(e.target.value) / 1000)}
                aria-label="Sequence timeline scrubber"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-amber-400"
              />
              <span className="font-mono-tabular w-11 text-right text-xs text-slate-300 shrink-0">
                {Math.round(progress * 100)}%
              </span>
            </div>

            {/* Plain Unboxed Hint */}
            <div className="hidden md:block text-xs text-slate-400 whitespace-nowrap shrink-0">
              {isManualControl
                ? 'Free camera · Drag to orbit · Scroll to zoom'
                : currentShot.interactiveHint}
            </div>
          </div>

          {/* Bottom Row: 5-Shot Chapter Selector */}
          <nav
            aria-label="Experience Chapters"
            className="mt-2.5 grid grid-cols-5 gap-1.5 border-t border-white/8 pt-2.5"
          >
            {SHOTS.map((shot) => {
              const isActive = currentShot.id === shot.id;
              const shotSpan = shot.end - shot.start;
              const shotFill = isActive
                ? Math.max(
                    0,
                    Math.min(1, (progress - shot.start) / Math.max(0.01, shotSpan)),
                  )
                : progress > shot.end
                  ? 1
                  : 0;

              return (
                <button
                  key={shot.id}
                  type="button"
                  onClick={() => onSelectShot(shot)}
                  className={`group relative overflow-hidden rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 ${
                    isActive
                      ? 'border-amber-400/45 bg-amber-400/10 text-white'
                      : 'border-white/8 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`font-mono-tabular text-[11px] ${
                        isActive ? 'text-amber-300' : 'text-slate-500'
                      }`}
                    >
                      {shot.code}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs font-medium">
                    {shot.title.replace('The ', '').replace(' Experience', '').replace(' Historical Scene', '').replace(' Cinematic Composition', ' Horizon')}
                  </div>
                  {/* Subtle Chapter Progress Underline */}
                  <div className="mt-1.5 h-[2px] w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-amber-400 transition-[width] duration-100"
                      style={{ width: `${Math.round(shotFill * 100)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
