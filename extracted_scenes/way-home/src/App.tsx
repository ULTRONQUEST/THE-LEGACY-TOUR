import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TheWayHomeDirector } from './scene/TheWayHomeDirector';
import { CinematicScoreEngine } from './scene/audio/cinematicAudio';
import { CinematicOverlay } from './components/CinematicOverlay';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const directorRef = useRef<TheWayHomeDirector | null>(null);
  const audioRef = useRef<CinematicScoreEngine | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [freeLook, setFreeLook] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const unlockAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new CinematicScoreEngine();
    }
    const ok = audioRef.current.initAndStart();
    if (ok) {
      setAudioUnlocked(true);
      audioRef.current.setMuted(isMuted);
      audioRef.current.update(directorRef.current?.getTime() || 0, isPlayingRef.current);
    }
  }, [isMuted]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const audio = new CinematicScoreEngine();
    audioRef.current = audio;

    // Throttle React UI time updates slightly (~20Hz) while WebGL runs at native 60fps
    let lastUiUpdate = 0;

    const director = new TheWayHomeDirector(container, {
      onTimeUpdate: (t) => {
        audio.update(t, isPlayingRef.current);
        const now = performance.now();
        if (now - lastUiUpdate > 50 || t === 0) {
          lastUiUpdate = now;
          setCurrentTime(t);
        }
      },
      onComplete: () => {
        setIsPlaying(false);
        setCurrentTime(162);
      },
      onWebGLContextLost: (lost) => {
        setContextLost(lost);
      },
    });

    directorRef.current = director;

    // Unlock audio gracefully on first user pointer interaction anywhere
    const handleFirstGesture = () => {
      if (audioRef.current) {
        const started = audioRef.current.initAndStart();
        if (started) {
          setAudioUnlocked(true);
        }
      }
      window.removeEventListener('pointerdown', handleFirstGesture);
    };
    window.addEventListener('pointerdown', handleFirstGesture, { passive: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((prev) => {
          const next = !prev;
          director.setPlaying(next);
          return next;
        });
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMuted((prev) => {
          const next = !prev;
          audio.setMuted(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleKeyDown);
      director.dispose();
      audio.dispose();
      directorRef.current = null;
      audioRef.current = null;
    };
  }, []);

  const handleTogglePlay = useCallback(() => {
    unlockAudio();
    setIsPlaying((prev) => {
      const next = !prev;
      directorRef.current?.setPlaying(next);
      return next;
    });
  }, [unlockAudio]);

  const handleReplay = useCallback(() => {
    unlockAudio();
    directorRef.current?.seek(0);
    directorRef.current?.setFreeLook(false);
    setFreeLook(false);
    directorRef.current?.setPlaying(true);
    setIsPlaying(true);
    setCurrentTime(0);
  }, [unlockAudio]);

  const handleSeek = useCallback(
    (time: number) => {
      unlockAudio();
      directorRef.current?.seek(time);
      setCurrentTime(time);
    },
    [unlockAudio],
  );

  const handleToggleMute = useCallback(() => {
    unlockAudio();
    setIsMuted((prev) => {
      const next = !prev;
      audioRef.current?.setMuted(next);
      return next;
    });
  }, [unlockAudio]);

  const handleToggleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const next = prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1;
      directorRef.current?.setSpeed(next);
      return next;
    });
  }, []);

  const handleToggleFreeLook = useCallback(() => {
    setFreeLook((prev) => {
      const next = !prev;
      directorRef.current?.setFreeLook(next);
      return next;
    });
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#03050a]">
      {/* Isolated Full-Bleed WebGL Canvas Container */}
      <div
        ref={mountRef}
        className="absolute inset-0 h-full w-full"
        aria-label="3D Space Journey Viewport"
      />

      {/* Graceful WebGL Context Loss Fallback */}
      {contextLost && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#03050a] p-6 text-center">
          <img
            src="/assets/aistudio/EARTH_VIEW_39c5af0f.png"
            alt="Orbital view of Earth"
            className="mb-6 max-h-[55vh] rounded-lg object-cover opacity-85"
            referrerPolicy="no-referrer"
          />
          <p className="font-display text-2xl text-slate-100">
            Restoring 3D Space Rendering Context
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Your graphics context was paused. Reload or wait a moment to resume.
          </p>
        </div>
      )}

      {/* Semantic Cinema HUD Overlay */}
      <CinematicOverlay
        currentTime={currentTime}
        isPlaying={isPlaying}
        isMuted={isMuted}
        speed={speed}
        freeLook={freeLook}
        dockCollapsed={dockCollapsed}
        audioUnlocked={audioUnlocked}
        onTogglePlay={handleTogglePlay}
        onReplay={handleReplay}
        onSeek={handleSeek}
        onToggleMute={handleToggleMute}
        onToggleSpeed={handleToggleSpeed}
        onToggleFreeLook={handleToggleFreeLook}
        onToggleDock={() => setDockCollapsed((p) => !p)}
        onUnlockAudio={unlockAudio}
      />
    </div>
  );
}
