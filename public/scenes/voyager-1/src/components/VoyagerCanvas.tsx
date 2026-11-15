import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createProceduralTextures } from '../scene/textures';
import { createVoyager1Model } from '../scene/voyagerModel';
import { createTourShipModel } from '../scene/tourShipModel';
import { createDeepSpaceEnvironment } from '../scene/deepSpaceEnv';
import {
  ENCOUNTER_SHOTS,
  evaluateEncounterState,
  ShotDefinition,
  TOTAL_DURATION_SECONDS,
} from '../scene/encounterDirector';
import { DeepSpaceAudio } from '../scene/spaceAudio';

export interface TelemetrySnapshot {
  progress: number;
  activeShot: ShotDefinition;
  relativeVelocityKms: number;
  distanceMeters: number;
  speedFactor: number;
}

export interface VoyagerCanvasProps {
  isPlaying: boolean;
  cameraMode: 'guided' | 'free';
  seekRequest: { progress: number; nonce: number } | null;
  audioEnabled: boolean;
  onUserOrbitStart: () => void;
  onTelemetryUpdate: (snapshot: TelemetrySnapshot) => void;
  onPlaybackEnd: () => void;
  onSceneReady: () => void;
  onWebGLError: (message: string) => void;
}

// Pre-allocated scratch vectors for zero-GC render loop
const _goldenRecordWorld = new THREE.Vector3();
const _desiredCam = new THREE.Vector3();
const _desiredTarget = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function VoyagerCanvas({
  isPlaying,
  cameraMode,
  seekRequest,
  audioEnabled,
  onUserOrbitStart,
  onTelemetryUpdate,
  onPlaybackEnd,
  onSceneReady,
  onWebGLError,
}: VoyagerCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store reactive React props in mutable refs so WebGL never tears down on UI updates
  const isPlayingRef = useRef(isPlaying);
  const cameraModeRef = useRef(cameraMode);
  const progressRef = useRef(0);
  const audioRef = useRef<DeepSpaceAudio | null>(null);
  const callbacksRef = useRef({
    onUserOrbitStart,
    onTelemetryUpdate,
    onPlaybackEnd,
    onSceneReady,
    onWebGLError,
  });

  isPlayingRef.current = isPlaying;
  cameraModeRef.current = cameraMode;
  callbacksRef.current = {
    onUserOrbitStart,
    onTelemetryUpdate,
    onPlaybackEnd,
    onSceneReady,
    onWebGLError,
  };

  // Handle seek commands cleanly without recreating scene
  const lastSeekNonceRef = useRef<number>(-1);
  useEffect(() => {
    if (seekRequest && seekRequest.nonce !== lastSeekNonceRef.current) {
      lastSeekNonceRef.current = seekRequest.nonce;
      progressRef.current = THREE.MathUtils.clamp(seekRequest.progress, 0, 1);
    }
  }, [seekRequest]);

  // Sync procedural audio toggle
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.isEnabled() !== audioEnabled) {
      audio.toggle();
    }
  }, [audioEnabled]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      callbacksRef.current.onWebGLError(
        'WebGL hardware acceleration is unavailable in this browser.'
      );
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      callbacksRef.current.onWebGLError('3D graphics context was interrupted.');
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);

    // Scene & Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060814);
    scene.fog = new THREE.FogExp2(0x080b1c, 0.0018);

    // Studio PBR reflections via RoomEnvironment on all devices
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.62;
    pmremGenerator.dispose();

    // Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 1400);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.055;
    controls.enablePan = true;
    controls.minDistance = 1.6;
    controls.maxDistance = 160;
    controls.rotateSpeed = 0.72;
    controls.zoomSpeed = 0.85;

    const handleControlStart = () => {
      if (cameraModeRef.current !== 'free') {
        cameraModeRef.current = 'free';
        callbacksRef.current.onUserOrbitStart();
      }
    };
    controls.addEventListener('start', handleControlStart);

    // 3-Point Documentary Deep-Space Lighting Rig
    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.25);
    keyLight.position.set(22, 16, 26);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 85;
    keyLight.shadow.camera.left = -16;
    keyLight.shadow.camera.right = 16;
    keyLight.shadow.camera.top = 16;
    keyLight.shadow.camera.bottom = -16;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    // Cool Violet-to-Sapphire Cosmic Fill (mirrors reference nebula bounce)
    const hemiFill = new THREE.HemisphereLight(0x8c7ae6, 0x1e4e79, 0.92);
    scene.add(hemiFill);

    // Crisp Interstellar Cyan-Blue Rim Light from behind/right
    const rimLight = new THREE.DirectionalLight(0x6bb8ff, 1.35);
    rimLight.position.set(-24, -10, -28);
    scene.add(rimLight);

    // Build Procedural Assets & Models
    const textures = createProceduralTextures(renderer);
    const deepSpace = createDeepSpaceEnvironment(textures);
    scene.add(deepSpace.group);

    const voyager = createVoyager1Model(textures, isSoftwareGl);
    scene.add(voyager.group);

    const tourShip = createTourShipModel(textures, isSoftwareGl);
    scene.add(tourShip.group);

    // Optional Post-Processing on GPU devices
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    if (!isSoftwareGl) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.34,
        0.55,
        0.86
      );
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    }

    // Audio synthesizer
    const audio = new DeepSpaceAudio();
    audioRef.current = audio;

    // Initial placement at progress = 0 so first frame is exact
    _goldenRecordWorld.copy(voyager.goldenRecordLocal);
    const initState = evaluateEncounterState(0, 0, _goldenRecordWorld);
    voyager.group.position.copy(initState.voyagerPos);
    voyager.group.rotation.copy(initState.voyagerRot);
    voyager.group.updateMatrixWorld(true);
    tourShip.group.position.copy(initState.tourPos);
    tourShip.group.rotation.copy(initState.tourRot);
    camera.position.copy(initState.cameraPos);
    camera.fov = initState.fov;
    camera.updateProjectionMatrix();
    controls.target.copy(initState.cameraTarget);
    controls.update();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    callbacksRef.current.onSceneReady();

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer && bloomPass) {
        composer.setSize(w, h);
        bloomPass.resolution.set(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop with Software-WebGL Pacing
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let elapsed = 0;
    let lastTelemetryReport = 0;
    let endedEmitted = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;

      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.1);
      elapsed += dt;

      if (isPlayingRef.current) {
        if (progressRef.current < 1.0) {
          endedEmitted = false;
          progressRef.current = Math.min(
            1.0,
            progressRef.current + dt / TOTAL_DURATION_SECONDS
          );
          if (progressRef.current >= 1.0 && !endedEmitted) {
            endedEmitted = true;
            callbacksRef.current.onPlaybackEnd();
          }
        }
      }

      // Compute Golden Record world position for Shot 5 close-up target
      voyager.goldenRecordMesh.getWorldPosition(_goldenRecordWorld);

      const state = evaluateEncounterState(
        progressRef.current,
        elapsed,
        _goldenRecordWorld
      );

      // Update spacecraft transforms independently
      voyager.group.position.copy(state.voyagerPos);
      voyager.group.rotation.copy(state.voyagerRot);

      tourShip.group.position.copy(state.tourPos);
      tourShip.group.rotation.copy(state.tourRot);
      tourShip.setThrustIntensity(state.thrustIntensity, elapsed);
      tourShip.setSpotlightIntensity(state.spotlightIntensity);

      // Aim tour ship spotlight softly toward Voyager 1
      tourShip.spotLight.target.position.copy(
        tourShip.group.worldToLocal(_desiredTarget.copy(state.voyagerPos))
      );

      // Smooth exponential camera damping in Guided mode (never fights user Free Orbit)
      if (cameraModeRef.current === 'guided') {
        _desiredCam.copy(state.cameraPos);
        _desiredTarget.copy(state.cameraTarget);

        const dampFactor = isSoftwareGl ? 18 : 4.2;
        const alpha = isSoftwareGl ? 1 : 1 - Math.exp(-dampFactor * dt);
        camera.position.lerp(_desiredCam, alpha);
        controls.target.lerp(_desiredTarget, alpha);

        const nextFov = THREE.MathUtils.lerp(camera.fov, state.fov, alpha);
        if (Math.abs(nextFov - camera.fov) > 0.01) {
          camera.fov = nextFov;
          camera.updateProjectionMatrix();
        }
      }

      controls.update();

      // Update deep-space starfield & velocity streaks
      deepSpace.update(dt, elapsed, state.speedFactor, camera.position);
      audio.update(state.speedFactor);

      // Throttle React telemetry HUD updates (~15Hz) so React never bottlenecks 60fps WebGL
      if (now - lastTelemetryReport > 66) {
        lastTelemetryReport = now;
        callbacksRef.current.onTelemetryUpdate({
          progress: state.progress,
          activeShot: state.activeShot ?? ENCOUNTER_SHOTS[0],
          relativeVelocityKms: state.relativeVelocityKms,
          distanceMeters: state.distanceMeters,
          speedFactor: state.speedFactor,
        });
      }

      if (composer && !isSoftwareGl) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      controls.removeEventListener('start', handleControlStart);
      controls.dispose();

      voyager.dispose();
      tourShip.dispose();
      deepSpace.dispose();
      textures.dispose();
      envTarget.dispose();
      audio.dispose();
      composer?.dispose();
      renderer.dispose();

      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      aria-label="Interactive 3D Voyager 1 deep space encounter viewport"
    />
  );
}
