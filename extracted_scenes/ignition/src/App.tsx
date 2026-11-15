import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createLegacyDepartureScene,
  DepartureSceneHandle,
  SHOTS,
  TimelineState,
  TOTAL_DURATION,
} from './scene';
import { DepartureOverlay } from './components/DepartureOverlay';

const INITIAL_TIMELINE: TimelineState = {
  currentTime: 0,
  duration: TOTAL_DURATION,
  progress: 0,
  isPlaying: true,
  isComplete: false,
  playbackSpeed: 1,
  activeShot: SHOTS[0],
  altitudeKm: 0,
  velocityKms: 0,
  missionClockLabel: 'T-00:24',
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneHandleRef = useRef<DepartureSceneHandle | null>(null);

  const [timeline, setTimeline] = useState<TimelineState>(INITIAL_TIMELINE);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    try {
      const handle = createLegacyDepartureScene(container, {
        onTimelineUpdate: (nextState) => {
          setTimeline(nextState);
        },
        onHandoverReady: (pose) => {
          // Expose canonical lunar handover pose on window for seamless host integration
          (window as unknown as { __LEGACY_TOUR_MOON_HANDOVER__?: unknown }).__LEGACY_TOUR_MOON_HANDOVER__ =
            pose;
        },
      });
      sceneHandleRef.current = handle;
      return () => {
        handle.dispose();
        sceneHandleRef.current = null;
      };
    } catch (err) {
      setWebglError(
        err instanceof Error ? err.message : 'Unable to initialize 3D WebGL viewport.'
      );
    }
  }, []);

  // Keyboard shortcuts: Space (Play/Pause), R (Restart), H (Hide/Show Controls)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        const h = sceneHandleRef.current;
        if (!h) return;
        if (timeline.isPlaying) h.pause();
        else h.play();
      } else if (e.key === 'h' || e.key === 'H') {
        setHudCollapsed((prev) => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        sceneHandleRef.current?.replay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [timeline.isPlaying]);

  const handleTogglePlay = useCallback(() => {
    const h = sceneHandleRef.current;
    if (!h) return;
    if (timeline.isPlaying) {
      h.pause();
    } else if (timeline.isComplete) {
      h.replay();
    } else {
      h.play();
    }
  }, [timeline.isPlaying, timeline.isComplete]);

  const handleReplay = useCallback(() => {
    sceneHandleRef.current?.replay();
  }, []);

  const handleSeek = useCallback((timeSec: number) => {
    sceneHandleRef.current?.seek(timeSec);
  }, []);

  const handleSelectShot = useCallback((shotIndex: number) => {
    sceneHandleRef.current?.seekToShot(shotIndex);
  }, []);

  const handleChangeSpeed = useCallback((speed: number) => {
    sceneHandleRef.current?.setPlaybackSpeed(speed);
  }, []);

  const handleToggleAudio = useCallback(() => {
    setAudioEnabled((prev) => {
      const next = !prev;
      sceneHandleRef.current?.setAudioEnabled(next);
      return next;
    });
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#030508]">
      {/* Isolated WebGL mount container */}
      <div ref={canvasMountRef} className="h-full w-full" />

      {webglError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#030508] p-6 text-center">
          <div className="max-w-md rounded-xl border border-white/15 bg-[#0c1118] p-6">
            <h2 className="font-display text-lg font-semibold text-white">
              3D Graphics Context Unavailable
            </h2>
            <p className="mt-2 text-sm text-slate-300">{webglError}</p>
          </div>
        </div>
      ) : (
        <DepartureOverlay
          timeline={timeline}
          hudCollapsed={hudCollapsed}
          audioEnabled={audioEnabled}
          onToggleCollapse={() => setHudCollapsed((p) => !p)}
          onTogglePlay={handleTogglePlay}
          onReplay={handleReplay}
          onSeek={handleSeek}
          onSelectShot={handleSelectShot}
          onChangeSpeed={handleChangeSpeed}
          onToggleAudio={handleToggleAudio}
        />
      )}
    </main>
  );
}
