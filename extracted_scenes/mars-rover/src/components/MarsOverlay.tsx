import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Info,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ASSET_PATHS, OPPORTUNITY_FACTS, SHOTS } from '../mars/constants';

interface MarsOverlayProps {
  ready: boolean;
  loadProgress: number;
  contextLost: boolean;
  progress: number;
  playing: boolean;
  userOrbiting: boolean;
  audioEnabled: boolean;
  onTogglePlay: () => void;
  onJumpToShot: (shotIndex: number) => void;
  onScrub: (value: number) => void;
  onResetOrbit: () => void;
  onToggleAudio: () => void;
}

export const MarsOverlay: React.FC<MarsOverlayProps> = ({
  ready,
  loadProgress,
  contextLost,
  progress,
  playing,
  userOrbiting,
  audioEnabled,
  onTogglePlay,
  onJumpToShot,
  onScrub,
  onResetOrbit,
  onToggleAudio,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [legacyCollapsed, setLegacyCollapsed] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const activeShotIndex = Math.min(SHOTS.length - 1, Math.max(0, Math.floor(progress)));
  const activeShot = SHOTS[activeShotIndex];
  const isShot6 = progress >= 4.92;

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === ' ') {
        e.preventDefault();
        onTogglePlay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onTogglePlay]);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between select-none">
      {/* Loading Curtain */}
      {!ready && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex flex-col items-center justify-center bg-[#050608] px-6 text-center">
          <p className="font-mono text-xs tracking-widest text-[#e07a3c]">
            MARS TRANSIT &amp; OPPORTUNITY
          </p>
          <h1 className="mt-3 font-[var(--font-display)] text-2xl font-semibold tracking-tight text-stone-100 sm:text-3xl">
            Preparing Planetary &amp; Surface Systems
          </h1>
          <div className="mt-6 h-1 w-64 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-[#e07a3c] transition-transform duration-200"
              style={{
                width: '100%',
                transform: `scaleX(${Math.max(0.05, loadProgress / 100)})`,
                transformOrigin: 'left center',
              }}
            />
          </div>
          <p className="mt-3 font-mono text-xs tabular-nums text-stone-400">
            {Math.round(loadProgress)}%
          </p>
        </div>
      )}

      {/* WebGL Context Lost Fallback */}
      {contextLost && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#08090d]/95 px-6 text-center">
          <p className="font-mono text-xs text-amber-400">Graphics Context Paused</p>
          <p className="mt-2 max-w-md text-sm text-stone-300">
            The 3D viewport was temporarily suspended by the browser. Reload the page to restore the interactive Mars experience.
          </p>
        </div>
      )}

      {/* Top Minimal Header Bar */}
      <header className="flex items-start justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="pointer-events-auto max-w-xl rounded-lg border border-white/10 bg-[#080a0f]/85 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-stone-400">
            <span className="font-mono font-medium tabular-nums text-[#f09458]">
              Shot {activeShot.code} / 06
            </span>
            <span aria-hidden="true">·</span>
            <span>{activeShot.subtitle}</span>
          </div>
          <h2 className="mt-0.5 font-[var(--font-display)] text-base font-semibold tracking-tight text-stone-100 sm:text-lg">
            {activeShot.title}
          </h2>
          <p className="mt-0.5 hidden text-xs leading-relaxed text-stone-300/90 sm:block">
            {activeShot.caption}
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          {userOrbiting && (
            <button
              type="button"
              onClick={onResetOrbit}
              className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#e07a3c]/50 bg-[#1a110c]/90 px-3 py-2 text-xs font-medium text-[#f5a776] transition-colors hover:bg-[#2a1a12] focus-visible:outline-2 focus-visible:outline-[#e07a3c] whitespace-nowrap shrink-0"
              title="Return camera to guided flight path"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Resume Path</span>
            </button>
          )}

          {activeShot.interactiveOrbit && !userOrbiting && (
            <div className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-[#080a0f]/85 px-3 py-2 text-xs text-stone-300 md:flex whitespace-nowrap shrink-0">
              <Compass className="h-3.5 w-3.5 text-[#f09458]" />
              <span>Drag to rotate · Scroll to zoom</span>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleAudio}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#080a0f]/85 px-3 py-2 text-xs font-medium text-stone-200 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-2 focus-visible:outline-[#e07a3c] whitespace-nowrap shrink-0"
            aria-label={audioEnabled ? 'Mute soundscape' : 'Enable soundscape'}
          >
            {audioEnabled ? (
              <Volume2 className="h-4 w-4 text-[#f09458]" />
            ) : (
              <VolumeX className="h-4 w-4 text-stone-400" />
            )}
            <span className="hidden sm:inline">{audioEnabled ? 'Audio On' : 'Audio'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#080a0f]/85 px-3 py-2 text-xs font-medium text-stone-200 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-2 focus-visible:outline-[#e07a3c] whitespace-nowrap shrink-0"
          >
            <Info className="h-4 w-4 text-stone-300" />
            <span className="hidden sm:inline">Reconstruction Notes</span>
          </button>
        </div>
      </header>

      {/* Shot 6 Educational Legacy Panel (Clean left-aligned editorial panel leaving rover unobstructed) */}
      {isShot6 && (
        <aside
          aria-label="Opportunity Mission Legacy"
          className="pointer-events-auto mx-4 my-auto max-w-sm rounded-xl border border-white/12 bg-[#090b10]/90 p-4 text-stone-100 sm:mx-6 sm:max-w-[360px]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] tracking-wider text-[#f09458]">
                HISTORICAL MISSION RECORD · MER-B
              </p>
              <h3 className="mt-1 font-[var(--font-display)] text-lg font-semibold text-white">
                The Legacy of Opportunity
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setLegacyCollapsed((c) => !c)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-stone-300 hover:bg-white/5 hover:text-white"
              aria-label={legacyCollapsed ? 'Expand mission facts' : 'Collapse mission facts'}
            >
              {legacyCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {!legacyCollapsed && (
            <>
              <p className="mt-2 text-xs leading-relaxed text-stone-300">
                This scene is a 3D historical reconstruction of the solar-powered Opportunity rover in Meridiani Planum.
              </p>

              <dl className="mt-3 divide-y divide-white/10 border-t border-white/10">
                {OPPORTUNITY_FACTS.map((fact) => (
                  <div key={fact.label} className="py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-xs text-stone-400">{fact.label}</dt>
                      <dd className="font-mono text-xs font-medium tabular-nums text-[#f5a776]">
                        {fact.value}
                      </dd>
                    </div>
                    <dd className="mt-0.5 text-[11px] leading-snug text-stone-300/85">
                      {fact.detail}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </aside>
      )}

      {/* Unified Collapsible Bottom Control Dock */}
      <div className="pointer-events-none flex flex-col items-center px-3 pb-4">
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          className="pointer-events-auto mb-1.5 flex items-center gap-1.5 rounded-t-lg border border-b-0 border-white/12 bg-[#080a0f]/90 px-3 py-1 text-[11px] font-medium text-stone-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-[#e07a3c]"
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

        {!dockCollapsed && (
          <div className="pointer-events-auto w-full max-w-[900px] rounded-xl border border-white/12 bg-[#080a0f]/92 px-3 py-2.5 sm:px-4">
            {/* Timeline Scrubber & Playback Row */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onTogglePlay}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e07a3c] text-stone-950 transition-colors hover:bg-[#ef8c4f] focus-visible:outline-2 focus-visible:outline-white"
                aria-label={playing ? 'Pause journey' : 'Play journey'}
              >
                {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              </button>

              <div className="flex flex-1 flex-col gap-1">
                <input
                  type="range"
                  min={0}
                  max={6}
                  step={0.01}
                  value={progress}
                  onChange={(e) => onScrub(parseFloat(e.target.value))}
                  aria-label="Mission journey timeline"
                  className="mars-scrubber w-full"
                />
              </div>

              <span className="w-16 text-right font-mono text-xs tabular-nums text-stone-300 shrink-0">
                {((progress / 6) * 100).toFixed(0)}%
              </span>
            </div>

            {/* 6-Shot Chapter Selector */}
            <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {SHOTS.map((shot, idx) => {
                const isActive = idx === activeShotIndex;
                return (
                  <button
                    key={shot.id}
                    type="button"
                    onClick={() => onJumpToShot(idx)}
                    className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-[#e07a3c] ${
                      isActive
                        ? 'border-[#e07a3c]/70 bg-[#e07a3c]/18 text-white'
                        : 'border-white/8 bg-white/[0.03] text-stone-400 hover:border-white/20 hover:text-stone-200'
                    }`}
                  >
                    <span className="font-mono text-[11px] tabular-nums text-[#f09458]">
                      {shot.code}
                    </span>
                    <span className="truncate font-medium">
                      {shot.id === 1
                        ? 'Departure'
                        : shot.id === 2
                          ? 'Approach'
                          : shot.id === 3
                            ? 'Orbit'
                            : shot.id === 4
                              ? 'Descent'
                              : shot.id === 5
                                ? 'Opportunity'
                                : 'Legacy'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Reconstruction & Historical Clarification Modal */}
      {showNotes && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reconstruction Notes"
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/15 bg-[#0c0e14] p-5 text-stone-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] tracking-wider text-[#f09458]">
                  3D RECONSTRUCTION METHODOLOGY
                </p>
                <h3 className="mt-1 font-[var(--font-display)] text-lg font-semibold text-white">
                  Historical Accuracy &amp; Visual References
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNotes(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-stone-300 hover:bg-white/10 hover:text-white"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-stone-300">
              <p>
                All planetary, atmospheric, and rover sequences in this experience are interactive real-time 3D reconstructions built with Three.js—not original mission photographs.
              </p>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="font-medium text-white">
                  Opportunity (MER-B) vs. Perseverance (Mars 2020)
                </p>
                <p className="mt-1 text-stone-300">
                  The uploaded rover mechanical reference depicts <strong>Perseverance</strong>, a later nuclear-powered (MMRTG) rover. For Shots 5 and 6, this experience renders a separate, historically accurate 3D model of <strong>Opportunity (MER-B)</strong> featuring its iconic three-wing deployable solar array, gold Kapton warm electronics box, Pancam mast, and six-wheel rocker-bogie chassis.
                </p>
                <img
                  src={ASSET_PATHS.perseveranceRef}
                  alt="Perseverance rover mechanical reference study"
                  className="mt-2.5 h-32 w-full rounded-md object-cover border border-white/10"
                />
                <p className="mt-1.5 text-[11px] text-stone-400">
                  Mechanical detail reference: Perseverance (distinct from Opportunity depicted in the 3D surface scene).
                </p>
              </div>
              <p className="text-stone-400">
                This educational visualization is an independent 3D reconstruction and carries no official endorsement.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
