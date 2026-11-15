import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { SHOTS, TimelineState } from '../scene/types';

interface DepartureOverlayProps {
  timeline: TimelineState;
  hudCollapsed: boolean;
  audioEnabled: boolean;
  onToggleCollapse: () => void;
  onTogglePlay: () => void;
  onReplay: () => void;
  onSeek: (timeSeconds: number) => void;
  onSelectShot: (shotIndex: number) => void;
  onChangeSpeed: (speed: number) => void;
  onToggleAudio: () => void;
}

export const DepartureOverlay: React.FC<DepartureOverlayProps> = ({
  timeline,
  hudCollapsed,
  audioEnabled,
  onToggleCollapse,
  onTogglePlay,
  onReplay,
  onSeek,
  onSelectShot,
  onChangeSpeed,
  onToggleAudio,
}) => {
  const speeds = [1, 1.5, 2];

  return (
    <>
      {/* Top-Left Documentary Chapter Caption (Zero-pill editorial typography with subtle scrim) */}
      <div
        className={`pointer-events-none fixed top-0 left-0 z-10 max-w-xl px-6 pt-5 pb-8 transition-opacity duration-300 ${
          hudCollapsed ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          background:
            'radial-gradient(ellipse at top left, rgba(3, 5, 8, 0.72) 0%, rgba(3, 5, 8, 0) 75%)',
        }}
      >
        <p className="text-xs font-medium tracking-wider text-slate-300">
          The Legacy Tour · Earth to Moon
        </p>
        <h1 className="font-display mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {timeline.activeShot.title}
        </h1>
        <p className="mt-0.5 text-sm text-slate-300">
          {timeline.activeShot.subtitle}
        </p>
      </div>

      {/* Unified Collapsible Bottom Control Dock */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex flex-col items-center px-3">
        <div
          className={`pointer-events-auto flex flex-col items-center transition-transform duration-300 ease-out ${
            hudCollapsed ? 'translate-y-[calc(100%-34px)]' : 'translate-y-0'
          }`}
          style={{ width: 'min(900px, 94vw)' }}
        >
          {/* Collapse / Expand Toggle Handle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={hudCollapsed ? 'Show controls' : 'Hide controls'}
            className="mb-1.5 flex items-center gap-1.5 rounded-md border border-white/15 bg-[#080c12]/90 px-3 py-1 text-xs font-medium text-slate-200 transition-colors hover:bg-[#101722] hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
          >
            {hudCollapsed ? (
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

          {/* Main Compact Control Surface */}
          <div className="w-full rounded-xl border border-white/12 bg-[#080c12]/92 px-4 py-3 shadow-2xl">
            {/* Timeline Scrubber & 9 Shot Chapter Markers */}
            <div className="mb-2.5">
              <div className="relative flex items-center">
                <input
                  type="range"
                  min={0}
                  max={timeline.duration}
                  step={0.05}
                  value={timeline.currentTime}
                  onChange={(e) => onSeek(parseFloat(e.target.value))}
                  aria-label="Mission timeline"
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-amber-400"
                />
              </div>

              {/* 9 Shot Chapter Buttons */}
              <div className="mt-2 flex items-center justify-between gap-1 overflow-x-auto pb-0.5">
                {SHOTS.map((shot) => {
                  const isActive = shot.index === timeline.activeShot.index;
                  return (
                    <button
                      key={shot.id}
                      type="button"
                      onClick={() => onSelectShot(shot.index)}
                      title={shot.title}
                      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400 ${
                        isActive
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                          : 'text-slate-400 hover:bg-white/8 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      {String(shot.index + 1).padStart(2, '0')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Playback & Tabular Telemetry Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onTogglePlay}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-white px-3.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
                >
                  {timeline.isPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      <span>Pause</span>
                    </>
                  ) : timeline.isComplete ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Replay</span>
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
                  title="Restart sequence from launchpad"
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restart</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleAudio}
                  aria-label={audioEnabled ? 'Mute sound' : 'Enable sound'}
                  className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400 ${
                    audioEnabled
                      ? 'border-amber-400/40 bg-amber-400/15 text-amber-200'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/12'
                  }`}
                >
                  {audioEnabled ? (
                    <Volume2 className="h-3.5 w-3.5" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {audioEnabled ? 'Audio On' : 'Audio Off'}
                  </span>
                </button>
              </div>

              {/* Clean Tabular Mission Clock & Altitude Readout */}
              <div className="flex items-center gap-3 text-xs text-slate-300 font-mono-tabular">
                <span>{timeline.missionClockLabel}</span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span>
                  {timeline.altitudeKm >= 1000
                    ? `${Math.round(timeline.altitudeKm).toLocaleString()} km`
                    : `${timeline.altitudeKm.toFixed(1)} km`}
                </span>
                <span className="hidden sm:inline text-slate-600" aria-hidden="true">·</span>
                <span className="hidden sm:inline">
                  {timeline.velocityKms.toFixed(1)} km/s
                </span>
              </div>

              {/* Playback Speed Segmented Selector */}
              <div className="flex items-center gap-1 rounded-lg bg-white/6 p-0.5">
                {speeds.map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => onChangeSpeed(sp)}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      timeline.playbackSpeed === sp
                        ? 'bg-white/18 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sp}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
