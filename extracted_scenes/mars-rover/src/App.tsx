import { useCallback, useEffect, useRef, useState } from 'react';
import { MarsOverlay } from './components/MarsOverlay';
import { MarsEngine } from './mars/MarsEngine';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<MarsEngine | null>(null);

  const [ready, setReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [contextLost, setContextLost] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [userOrbiting, setUserOrbiting] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new MarsEngine(mountEl, {
      onLoadProgress: (pct) => setLoadProgress(pct),
      onReady: () => setReady(true),
      onProgressChange: (p) => setProgress(p),
      onPlayStateChange: (isPlaying) => setPlaying(isPlaying),
      onUserOrbitChange: (orbiting) => setUserOrbiting(orbiting),
      onContextLost: (lost) => setContextLost(lost),
    });

    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleTogglePlay = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (progress >= 5.98 && !playing) {
      engine.scrubTo(0);
      engine.setPlaying(true);
    } else {
      engine.togglePlay();
    }
  }, [progress, playing]);

  const handleJumpToShot = useCallback((shotIndex: number) => {
    engineRef.current?.jumpToShot(shotIndex);
  }, []);

  const handleScrub = useCallback((value: number) => {
    engineRef.current?.scrubTo(value);
  }, []);

  const handleResetOrbit = useCallback(() => {
    engineRef.current?.resetCameraToJourney();
  }, []);

  const handleToggleAudio = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = engine.soundscape.toggle();
    setAudioEnabled(next);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#050608]">
      {/* Dedicated WebGL Mount Container isolated from React HUD re-renders */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 h-full w-full"
        aria-label="Interactive 3D Mars Exploration Viewport"
      />

      <MarsOverlay
        ready={ready}
        loadProgress={loadProgress}
        contextLost={contextLost}
        progress={progress}
        playing={playing}
        userOrbiting={userOrbiting}
        audioEnabled={audioEnabled}
        onTogglePlay={handleTogglePlay}
        onJumpToShot={handleJumpToShot}
        onScrub={handleScrub}
        onResetOrbit={handleResetOrbit}
        onToggleAudio={handleToggleAudio}
      />
    </main>
  );
}
