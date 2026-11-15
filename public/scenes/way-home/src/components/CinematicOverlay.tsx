import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  LEGACY_STATEMENTS,
  MEMORY_MOMENTS,
  SHOTS,
  ShotDefinition,
  TOTAL_DURATION,
} from '../scene/types';

interface CinematicOverlayProps {
  currentTime: number;
  isPlaying: boolean;
  isMuted: boolean;
  speed: number;
  freeLook: boolean;
  dockCollapsed: boolean;
  audioUnlocked: boolean;
  onTogglePlay: () => void;
  onReplay: () => void;
  onSeek: (time: number) => void;
  onToggleMute: () => void;
  onToggleSpeed: () => void;
  onToggleFreeLook: () => void;
  onToggleDock: () => void;
  onUnlockAudio: () => void;
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

function smoothWindow(t: number, start: number, end: number, fade = 1.0): number {
  if (t < start || t > end) return 0;
  const inAlpha = Math.min(1, (t - start) / fade);
  const outAlpha = Math.min(1, (end - t) / fade);
  return Math.min(inAlpha, outAlpha);
}

export const CinematicOverlay: React.FC<CinematicOverlayProps> = ({
  currentTime,
  isPlaying,
  isMuted,
  speed,
  freeLook,
  dockCollapsed,
  audioUnlocked,
  onTogglePlay,
  onReplay,
  onSeek,
  onToggleMute,
  onToggleSpeed,
  onToggleFreeLook,
  onToggleDock,
  onUnlockAudio,
}) => {
  const activeShot: ShotDefinition =
    SHOTS.find((s) => currentTime >= s.startTime && currentTime < s.endTime) ||
    SHOTS[SHOTS.length - 1];

  // Shot 1, 3, 4 narrative captions
  let narrativeText = '';
  let narrativeOpacity = 0;
  if (currentTime >= 3 && currentTime <= 19) {
    narrativeText = SHOTS[0].narrative || '';
    narrativeOpacity = smoothWindow(currentTime, 3, 19, 1.4);
  } else if (currentTime >= 44 && currentTime <= 66.5) {
    narrativeText = SHOTS[2].narrative || '';
    narrativeOpacity = smoothWindow(currentTime, 44, 66.5, 1.5);
  } else if (currentTime >= 71.5 && currentTime <= 86.5) {
    narrativeText = SHOTS[3].narrative || '';
    narrativeOpacity = smoothWindow(currentTime, 71.5, 86.5, 1.5);
  }

  // Shot 3 active historical memory metadata
  const activeMemory = MEMORY_MOMENTS.find(
    (m) => currentTime >= m.startTime && currentTime <= m.endTime,
  );
  const memoryOpacity = activeMemory
    ? smoothWindow(currentTime, activeMemory.startTime, activeMemory.endTime, 0.7)
    : 0;

  // Shot 6 centered statements
  const activeStatement = LEGACY_STATEMENTS.find(
    (st) => currentTime >= st.startTime && currentTime <= st.endTime,
  );
  const statementOpacity = activeStatement
    ? smoothWindow(currentTime, activeStatement.startTime, activeStatement.endTime, 0.75)
    : 0;

  // Shot 7 final cosmic reveal & fade to black
  const epitaphOpacity = smoothWindow(currentTime, 147.5, 155.8, 1.4);
  const titleCardOpacity = smoothWindow(currentTime, 155.8, 160.8, 1.2);
  const fadeToBlackOpacity =
    currentTime >= 159.2 ? Math.min(1, (currentTime - 159.2) / 2.4) : 0;
  const isFinished = currentTime >= TOTAL_DURATION - 0.15;

  const progressPct = Math.min(100, Math.max(0, (currentTime / TOTAL_DURATION) * 100));

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between">
      {/* Gentle Fade-to-Black Curtain for Ending */}
      <div
        className="pointer-events-none fixed inset-0 bg-[#03050a] transition-opacity duration-500"
        style={{ opacity: fadeToBlackOpacity }}
      />

      {/* Minimal Top-Left Chapter Context (unboxed clean typography, fades gently in final reveal) */}
      <header
        className="relative z-20 flex items-start justify-between px-6 pt-5 md:px-10 md:pt-7 transition-opacity duration-700"
        style={{ opacity: currentTime > 154 ? 0.15 : 1 }}
      >
        <div className="pointer-events-auto max-w-xl">
          <div className="flex items-center gap-2.5 text-xs tracking-[0.18em] uppercase text-slate-400">
            <span>The Legacy Tour</span>
            <span aria-hidden="true">·</span>
            <span>The Way Home</span>
          </div>
          <h1 className="mt-1 font-display text-xl md:text-2xl font-medium tracking-wide text-slate-100">
            0{activeShot.id}. {activeShot.title}
          </h1>
        </div>

        {/* Unobtrusive Sound Prompt if browser hasn't unlocked audio yet */}
        {!audioUnlocked && (
          <button
            type="button"
            onClick={onUnlockAudio}
            className="pointer-events-auto flex items-center gap-2 rounded-md border border-white/15 bg-[#070a12]/85 px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-sky-400/50 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Volume2 className="h-3.5 w-3.5 text-sky-300" />
            <span>Enable Orchestral Score</span>
          </button>
        )}
      </header>

      {/* Center Stage Overlays (Shot 3 Memory Label, Shot 6 Statements, Shot 7 Final Reveal) */}
      <main className="relative z-20 flex flex-1 flex-col items-center justify-center px-6 text-center">
        {/* Shot 3 Historical Mission Label */}
        {activeMemory && (
          <div
            className="pointer-events-none absolute top-10 md:top-14 left-1/2 -translate-x-1/2 max-w-lg transition-opacity duration-300"
            style={{ opacity: memoryOpacity }}
          >
            <div className="flex items-center justify-center gap-2 text-xs font-mono-tabular tracking-widest uppercase text-sky-300/90">
              <span>{activeMemory.year}</span>
              <span aria-hidden="true">·</span>
              <span>Historical Archive</span>
            </div>
            <p className="mt-1 font-display text-2xl md:text-3xl font-medium text-white">
              {activeMemory.title}
            </p>
            <p className="mt-1 text-sm text-slate-300/90">{activeMemory.caption}</p>
          </div>
        )}

        {/* Shot 6 Statements */}
        {activeStatement && (
          <div
            className="pointer-events-none max-w-3xl px-4 transition-opacity duration-300"
            style={{ opacity: statementOpacity }}
          >
            <p className="font-display text-2xl sm:text-3xl md:text-4xl font-medium tracking-[0.06em] text-slate-50 drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)] text-balance leading-snug">
              {activeStatement.text}
            </p>
          </div>
        )}

        {/* Shot 7 Final Epitaph */}
        {epitaphOpacity > 0.01 && (
          <div
            className="pointer-events-none max-w-2xl px-4 transition-opacity duration-500"
            style={{ opacity: epitaphOpacity }}
          >
            <p className="font-display text-xl sm:text-2xl md:text-3xl font-normal tracking-[0.08em] text-slate-100 leading-relaxed drop-shadow-[0_2px_20px_rgba(0,0,0,0.9)]">
              WE EXPLORED THE MOON.
              <br />
              WE DISCOVERED MARS.
              <br />
              WE FOLLOWED VOYAGER INTO THE UNKNOWN.
            </p>
            <p className="mt-6 font-display text-2xl sm:text-3xl md:text-4xl font-medium tracking-[0.08em] text-sky-100 leading-snug drop-shadow-[0_2px_20px_rgba(0,0,0,0.9)]">
              BUT OUR GREATEST DISCOVERY
              <br />
              WAS THE BEAUTY OF OUR OWN HOME.
            </p>
          </div>
        )}

        {/* Shot 7 Final Title Card */}
        {titleCardOpacity > 0.01 && (
          <div
            className="pointer-events-none max-w-2xl px-4 transition-opacity duration-500"
            style={{ opacity: titleCardOpacity }}
          >
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold tracking-[0.18em] text-white">
              THE LEGACY TOUR
            </h2>
            <p className="mt-4 text-sm sm:text-base tracking-[0.22em] text-slate-300 uppercase">
              The universe is vast. Our curiosity is limitless.
            </p>
          </div>
        )}

        {/* Post-Completion Serene Replay Action */}
        {isFinished && (
          <div className="pointer-events-auto mt-4 flex flex-col items-center gap-5">
            <div className="text-center">
              <p className="font-display text-3xl md:text-4xl font-semibold tracking-[0.16em] text-white">
                THE LEGACY TOUR
              </p>
              <p className="mt-2 text-xs md:text-sm tracking-[0.2em] uppercase text-slate-400">
                The universe is vast. Our curiosity is limitless.
              </p>
            </div>
            <button
              type="button"
              onClick={onReplay}
              className="mt-2 flex items-center gap-2.5 rounded-lg border border-white/20 bg-[#0b1120] px-6 py-3 text-sm font-medium tracking-wide text-white transition-colors hover:border-sky-400/60 hover:bg-[#111a30] cursor-pointer"
            >
              <RotateCcw className="h-4 w-4 text-sky-300" />
              <span>Replay Journey</span>
            </button>
          </div>
        )}
      </main>

      {/* Bottom Narrative Subtitle + Collapsible Unified Control Dock */}
      <footer className="relative z-20 flex flex-col items-center px-4 pb-5">
        {/* Narrative Documentary Caption */}
        {narrativeOpacity > 0.01 && !isFinished && (
          <div
            className="pointer-events-none mb-4 max-w-2xl rounded-lg bg-[#04070e]/80 px-6 py-3 text-center transition-opacity duration-300"
            style={{ opacity: narrativeOpacity }}
          >
            <p className="font-display text-lg sm:text-xl md:text-2xl italic font-normal leading-relaxed text-slate-100 text-balance">
              “{narrativeText}”
            </p>
          </div>
        )}

        {/* Collapsible Control Dock */}
        <div className="pointer-events-auto flex flex-col items-center w-full max-w-[920px]">
          <button
            type="button"
            onClick={onToggleDock}
            aria-label={dockCollapsed ? 'Show Controls' : 'Hide Controls'}
            className="flex items-center gap-1.5 rounded-t-md border border-b-0 border-white/12 bg-[#070a12]/90 px-3.5 py-1 text-[11px] font-medium tracking-wider uppercase text-slate-300 transition-colors hover:text-white cursor-pointer"
          >
            {dockCollapsed ? (
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

          {!dockCollapsed && (
            <div className="w-full rounded-lg border border-white/12 bg-[#070a12]/90 px-4 py-3 shadow-2xl">
              {/* Chapter Progress Bar & Shot Selectors */}
              <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto pb-1">
                {SHOTS.map((shot) => {
                  const isActive = activeShot.id === shot.id;
                  return (
                    <button
                      key={shot.id}
                      type="button"
                      onClick={() => onSeek(shot.startTime)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40 font-medium'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      0{shot.id}. {shot.title}
                    </button>
                  );
                })}
              </div>

              {/* Scrubber Track */}
              <div className="mb-3 flex items-center gap-3">
                <span className="font-mono-tabular text-xs text-slate-400 w-10 shrink-0">
                  {formatClock(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={TOTAL_DURATION}
                  step={0.1}
                  value={currentTime}
                  aria-label="Timeline Scrubber"
                  onChange={(e) => onSeek(parseFloat(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-sky-400"
                  style={{
                    background: `linear-gradient(to right, #38bdf8 ${progressPct}%, #1e293b ${progressPct}%)`,
                  }}
                />
                <span className="font-mono-tabular text-xs text-slate-400 w-10 text-right shrink-0">
                  {formatClock(TOTAL_DURATION)}
                </span>
              </div>

              {/* Transport & Camera Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onTogglePlay}
                    className="flex items-center gap-1.5 rounded-md bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        <span>Pause</span>
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
                    className="flex items-center gap-1.5 rounded-md border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Replay</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleSpeed}
                    className="rounded-md border border-white/12 bg-white/5 px-2.5 py-1.5 font-mono-tabular text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {speed}x
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggleFreeLook}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      freeLook
                        ? 'border-sky-400/50 bg-sky-500/20 text-sky-200'
                        : 'border-white/12 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <Compass className="h-3.5 w-3.5" />
                    <span>{freeLook ? 'Cinematic Cam' : 'Free Orbit'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleMute}
                    className="flex items-center gap-1.5 rounded-md border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isMuted ? (
                      <>
                        <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                        <span>Muted</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5 text-sky-300" />
                        <span>Score On</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};
