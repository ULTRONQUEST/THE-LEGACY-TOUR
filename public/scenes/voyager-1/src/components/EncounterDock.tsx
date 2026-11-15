import {
  ChevronDown,
  ChevronUp,
  Compass,
  Pause,
  Play,
  RotateCcw,
  Video,
} from 'lucide-react';
import { ENCOUNTER_SHOTS, ShotDefinition } from '../scene/encounterDirector';
import { TelemetrySnapshot } from './VoyagerCanvas';

interface EncounterDockProps {
  telemetry: TelemetrySnapshot;
  isPlaying: boolean;
  cameraMode: 'guided' | 'free';
  collapsed: boolean;
  onToggleCollapse: () => void;
  onTogglePlay: () => void;
  onReplay: () => void;
  onSeek: (progress: number) => void;
  onSelectShot: (shot: ShotDefinition) => void;
  onResumeGuided: () => void;
}

export function EncounterDock({
  telemetry,
  isPlaying,
  cameraMode,
  collapsed,
  onToggleCollapse,
  onTogglePlay,
  onReplay,
  onSeek,
  onSelectShot,
  onResumeGuided,
}: EncounterDockProps) {
  const isFinished = telemetry.progress >= 0.998 && !isPlaying;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex flex-col items-center px-3">
      {/* Collapse / Expand toggle tab */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Show encounter controls' : 'Hide encounter controls'}
        className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 border-slate-300/15 bg-[#080b16]/88 px-3 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
      >
        {collapsed ? (
          <>
            <ChevronUp className="h-3.5 w-3.5" />
            <span>Show Controls</span>
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5" />
            <span>Hide Controls</span>
          </>
        )}
      </button>

      {!collapsed && (
        <div className="pointer-events-auto w-full max-w-[920px] rounded-xl border border-slate-300/15 bg-[#080b16]/90 px-4 py-3 text-slate-200 shadow-2xl">
          {/* Top Row: Play/Pause, Scrubber, Telemetry */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={isFinished ? onReplay : onTogglePlay}
                aria-label={isFinished ? 'Replay encounter' : isPlaying ? 'Pause' : 'Play'}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/90 text-white transition-colors hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300"
              >
                {isFinished ? (
                  <RotateCcw className="h-4 w-4" />
                ) : isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 translate-x-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={onReplay}
                title="Restart Sequence"
                aria-label="Restart sequence"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300/15 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Timeline Scrubber */}
            <div className="flex min-w-[160px] flex-1 items-center gap-2.5">
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(telemetry.progress * 1000)}
                onChange={(e) => onSeek(Number(e.target.value) / 1000)}
                aria-label="Encounter timeline progress"
                className="encounter-scrubber w-full"
              />
            </div>

            {/* Compact Tabular Telemetry */}
            <div className="hidden md:flex items-center gap-4 border-l border-slate-300/10 pl-4 text-xs">
              <div>
                <span className="text-slate-400 mr-1.5">Rel. Speed</span>
                <span className="font-mono-tabular font-medium text-slate-100">
                  {telemetry.relativeVelocityKms.toFixed(1)} km/s
                </span>
              </div>
              <div>
                <span className="text-slate-400 mr-1.5">Range</span>
                <span className="font-mono-tabular font-medium text-slate-100">
                  {telemetry.distanceMeters.toFixed(1)} m
                </span>
              </div>
            </div>

            {/* Camera Mode Toggle */}
            <div className="flex items-center shrink-0">
              {cameraMode === 'free' ? (
                <button
                  type="button"
                  onClick={onResumeGuided}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/35 bg-indigo-500/20 px-2.5 py-1.5 text-xs font-medium text-indigo-200 transition-colors hover:bg-indigo-500/30 whitespace-nowrap"
                >
                  <Video className="h-3.5 w-3.5" />
                  <span>Resume Guided</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] text-slate-400 whitespace-nowrap">
                  <Compass className="h-3.5 w-3.5 text-indigo-300/80" />
                  <span>Drag to orbit · Scroll to zoom</span>
                </span>
              )}
            </div>
          </div>

          {/* Bottom Row: 6 Shot Chapter Selector */}
          <div className="mt-2.5 grid grid-cols-3 gap-1.5 border-t border-slate-300/10 pt-2.5 sm:grid-cols-6">
            {ENCOUNTER_SHOTS.map((shot) => {
              const active = telemetry.activeShot.id === shot.id;
              return (
                <button
                  key={shot.id}
                  type="button"
                  onClick={() => onSelectShot(shot)}
                  className={`flex items-center justify-center sm:justify-start gap-1.5 rounded-md px-2 py-1 text-left text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 ${
                    active
                      ? 'bg-indigo-500/25 text-white border border-indigo-400/30'
                      : 'bg-white/[0.03] text-slate-400 border border-transparent hover:bg-white/[0.08] hover:text-slate-200'
                  }`}
                >
                  <span className="font-mono-tabular text-[10px] text-indigo-300/90 shrink-0">
                    {shot.code}
                  </span>
                  <span className="truncate font-medium">
                    {shot.id === 1 && 'Cruise'}
                    {shot.id === 2 && 'Discovery'}
                    {shot.id === 3 && 'Encounter'}
                    {shot.id === 4 && 'Drift'}
                    {shot.id === 5 && 'Legacy'}
                    {shot.id === 6 && 'Wide Shot'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
