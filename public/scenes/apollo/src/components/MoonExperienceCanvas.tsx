import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { createApolloSiteAssets } from '../scene/apolloModels';
import {
  EvaluatedChoreography,
  evaluateChoreography,
} from '../scene/cameraChoreography';
import {
  MOON_CENTER,
  MOON_RADIUS,
  TOTAL_FILM_DURATION_SEC,
} from '../scene/constants';
import { createLunarTerrain } from '../scene/lunarTerrain';
import {
  createRegolithTextures,
  generateLunarSphereMaps,
} from '../scene/lunarTextures';
import { createStarfield } from '../scene/starfield';

export interface ExperienceController {
  seekTo: (progress01: number, autoPlay?: boolean) => void;
  setPlaying: (playing: boolean) => void;
  resumeAutoCamera: () => void;
}

interface MoonExperienceCanvasProps {
  isPlaying: boolean;
  isManualControl: boolean;
  onProgressChange: (progress01: number) => void;
  onManualEngage: () => void;
  onLoadProgress: (pct: number) => void;
  onReady: () => void;
  onError: (msg: string) => void;
  controllerRef: React.MutableRefObject<ExperienceController | null>;
}

const _choreo: EvaluatedChoreography = {
  position: new THREE.Vector3(),
  target: new THREE.Vector3(),
  fov: 42,
  sunDirection: new THREE.Vector3(-0.24, 0.78, 0.58),
  moonRotationY: 0,
  starExposure: 1.0,
};

const _scratchVec = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function MoonExperienceCanvas({
  isPlaying,
  isManualControl,
  onProgressChange,
  onManualEngage,
  onLoadProgress,
  onReady,
  onError,
  controllerRef,
}: MoonExperienceCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const isManualRef = useRef(isManualControl);
  isManualRef.current = isManualControl;

  const callbacksRef = useRef({
    onProgressChange,
    onManualEngage,
    onLoadProgress,
    onReady,
    onError,
  });
  callbacksRef.current = {
    onProgressChange,
    onManualEngage,
    onLoadProgress,
    onReady,
    onError,
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    let frameId = 0;

    // Check WebGL2 support cleanly
    const testCanvas = document.createElement('canvas');
    const testGl =
      testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
    if (!testGl) {
      callbacksRef.current.onError(
        'WebGL is unavailable in this browser. Viewing historical reference stills.',
      );
      return;
    }

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x020306, 1);

    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
    };
    const handleContextRestored = () => {
      scheduleNextFrame();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      handleContextRestored,
    );

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020306);

    // Mandatory studio environment map for metallic Kapton foil & gold visor reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.24;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 10, 45000);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.85;

    // Subtle deep-space background stars
    const starfield = createStarfield(3400);
    scene.add(starfield.points);

    // Solar Key Light + Lunar Regolith Bounce Hemisphere Fill
    const sunLight = new THREE.DirectionalLight(0xfff7ec, 3.35);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 40;
    sunLight.shadow.camera.far = 220;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -20;
    sunLight.shadow.bias = -0.00035;
    sunLight.shadow.normalBias = 0.016;
    sunLight.target.position.set(-0.8, 0, -2.5);
    scene.add(sunLight);
    scene.add(sunLight.target);

    // Subtle regolith ground-bounce fill (keeps Apollo suit shadows legible, never flat black)
    const bounceFill = new THREE.HemisphereLight(0x070a12, 0x3f434a, 0.32);
    scene.add(bounceFill);

    // Post-processing on GPU only (skipped on software WebGL for smooth responsiveness)
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    if (!isSoftwareGl) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.16,
        0.35,
        0.92,
      );
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    }

    // Track disposable scene resources
    let moonGeo: THREE.SphereGeometry | null = null;
    let moonMat: THREE.MeshStandardMaterial | null = null;
    let moonMesh: THREE.Mesh | null = null;
    let lunarMapsDisposables: Array<{ dispose: () => void }> = [];
    let terrainHandle: ReturnType<typeof createLunarTerrain> | null = null;
    let apolloHandle: ReturnType<typeof createApolloSiteAssets> | null = null;

    // Progress & camera state
    let progress = 0;
    let needsCameraSnap = true;
    let smoothProgress = 0;
    let lastReportedUiProgress = -1;

    evaluateChoreography(0, _choreo);
    camera.position.copy(_choreo.position);
    controls.target.copy(_choreo.target);
    camera.fov = _choreo.fov;
    camera.updateProjectionMatrix();
    controls.update();

    const onControlsStart = () => {
      if (!isManualRef.current) {
        isManualRef.current = true;
        isPlayingRef.current = false;
        callbacksRef.current.onManualEngage();
      }
    };
    controls.addEventListener('start', onControlsStart);

    controllerRef.current = {
      seekTo(nextProgress: number, autoPlay = true) {
        const clamped = THREE.MathUtils.clamp(nextProgress, 0, 1);
        const jumpDelta = Math.abs(clamped - progress);
        progress = clamped;
        smoothProgress = clamped;
        isManualRef.current = false;
        isPlayingRef.current = autoPlay;
        evaluateChoreography(clamped, _choreo);
        if (jumpDelta > 0.22 || camera.position.distanceTo(_choreo.position) > 900) {
          needsCameraSnap = true;
        }
        callbacksRef.current.onProgressChange(clamped);
      },
      setPlaying(playing: boolean) {
        isPlayingRef.current = playing;
        if (playing) {
          isManualRef.current = false;
        }
      },
      resumeAutoCamera() {
        isManualRef.current = false;
        isPlayingRef.current = true;
      },
    };

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
      if (bloomPass) bloomPass.resolution.set(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Software WebGL GPU fence pacer
    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl.fenceSync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    let lastTime = performance.now();

    function updateSceneForProgress(dt: number) {
      if (isPlayingRef.current && !isManualRef.current) {
        progress += dt / TOTAL_FILM_DURATION_SEC;
        if (progress >= 1) {
          progress = 1;
          isPlayingRef.current = false;
          isManualRef.current = true;
          callbacksRef.current.onProgressChange(1);
          callbacksRef.current.onManualEngage();
        }
      }

      smoothProgress = THREE.MathUtils.damp(smoothProgress, progress, 7.5, dt);
      evaluateChoreography(smoothProgress, _choreo);

      // Update Sun & Moon axial rotation
      sunLight.position.copy(_choreo.sunDirection).multiplyScalar(120);
      if (moonMesh) {
        moonMesh.rotation.y = _choreo.moonRotationY;
      }

      // Altitude-aware star exposure
      const surfaceProximity = THREE.MathUtils.smoothstep(
        smoothProgress,
        0.58,
        0.72,
      );
      starfield.setExposureFactor(THREE.MathUtils.lerp(1.0, 0.24, surfaceProximity));

      if (!isManualRef.current) {
        if (needsCameraSnap) {
          camera.position.copy(_choreo.position);
          controls.target.copy(_choreo.target);
          camera.fov = _choreo.fov;
          needsCameraSnap = false;
        } else {
          const dampLambda = 6.5;
          const alpha = 1 - Math.exp(-dampLambda * dt);
          camera.position.lerp(_choreo.position, alpha);
          controls.target.lerp(_choreo.target, alpha);
          camera.fov = THREE.MathUtils.damp(camera.fov, _choreo.fov, 6.0, dt);
        }
        controls.minDistance = 1.5;
        controls.maxDistance = 30000;
        controls.maxPolarAngle = Math.PI;
        controls.update();
      } else {
        // Manual interactive exploration bounds adapt smoothly to orbital vs. surface scale
        const isOrbital = smoothProgress < 0.52;
        if (isOrbital) {
          controls.target.lerp(MOON_CENTER, 1 - Math.exp(-5.0 * dt));
          controls.minDistance = MOON_RADIUS * 1.18;
          controls.maxDistance = 24000;
          controls.maxPolarAngle = Math.PI;
        } else {
          controls.minDistance = 1.6;
          controls.maxDistance = 280;
          controls.maxPolarAngle = Math.PI * 0.492;
        }
        controls.update();
      }

      // Dynamic near/far clipping prevents depth precision artifacts across 16,000m -> 1.5m scale
      const distToSurface = Math.max(
        0.5,
        camera.position.distanceTo(_scratchVec.copy(MOON_CENTER)) - MOON_RADIUS,
      );

      // Seamless cross-fade of high-detail Tranquility Base terrain between 950m and 380m altitude
      if (terrainHandle && apolloHandle) {
        if (distToSurface > 950) {
          terrainHandle.group.visible = false;
          apolloHandle.group.visible = false;
        } else {
          terrainHandle.group.visible = true;
          apolloHandle.group.visible = true;
          const tFade = 1 - THREE.MathUtils.smoothstep(distToSurface, 380, 950);
          const needTransparent = tFade < 0.995;
          if (terrainHandle.terrainMaterial.transparent !== needTransparent) {
            terrainHandle.terrainMaterial.transparent = needTransparent;
            terrainHandle.terrainMaterial.needsUpdate = true;
          }
          terrainHandle.terrainMaterial.opacity = tFade;
        }
      }

      const desiredNear = THREE.MathUtils.clamp(distToSurface * 0.03, 0.14, 90);
      const desiredFar = distToSurface > 400 ? 45000 : 12000;
      if (
        Math.abs(camera.near - desiredNear) / camera.near > 0.08 ||
        Math.abs(camera.far - desiredFar) > 500 ||
        !isManualRef.current
      ) {
        camera.near = desiredNear;
        camera.far = desiredFar;
        camera.updateProjectionMatrix();
      }

      // Throttle React UI progress updates to ~20Hz so React never slows down WebGL
      if (Math.abs(progress - lastReportedUiProgress) > 0.0025) {
        lastReportedUiProgress = progress;
        callbacksRef.current.onProgressChange(progress);
      }
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      updateSceneForProgress(dt);

      if (composer && !isSoftwareGl) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      scheduleNextFrame();
    }

    function scheduleNextFrame() {
      if (disposed) return;
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    // Async asset synthesis & scene assembly
    (async () => {
      try {
        const maxAniso = renderer.capabilities.getMaxAnisotropy();
        callbacksRef.current.onLoadProgress(0.05);

        const sphereMaps = await generateLunarSphereMaps(maxAniso, (p) => {
          if (!disposed) {
            callbacksRef.current.onLoadProgress(0.05 + p * 0.72);
          }
        });
        if (disposed) {
          sphereMaps.albedoMap.dispose();
          sphereMaps.bumpMap.dispose();
          sphereMaps.roughnessMap.dispose();
          return;
        }
        lunarMapsDisposables = [
          sphereMaps.albedoMap,
          sphereMaps.bumpMap,
          sphereMaps.roughnessMap,
        ];

        // Spherical Moon mesh centered at (0, -MOON_RADIUS, 0)
        moonGeo = new THREE.SphereGeometry(MOON_RADIUS, 128, 96);
        moonMat = new THREE.MeshStandardMaterial({
          map: sphereMaps.albedoMap,
          bumpMap: sphereMaps.bumpMap,
          bumpScale: 16,
          roughnessMap: sphereMaps.roughnessMap,
          roughness: 0.95,
          metalness: 0.0,
          envMapIntensity: 0.08,
        });
        moonMesh = new THREE.Mesh(moonGeo, moonMat);
        moonMesh.position.copy(MOON_CENTER);
        scene.add(moonMesh);

        callbacksRef.current.onLoadProgress(0.84);

        // Local high-detail Tranquility Base terrain seamlessly hugging sphere curvature
        const regolithMaps = createRegolithTextures(maxAniso);
        lunarMapsDisposables.push(
          regolithMaps.albedoMap,
          regolithMaps.normalMap,
          regolithMaps.roughnessMap,
        );
        terrainHandle = createLunarTerrain(regolithMaps);
        scene.add(terrainHandle.group);

        callbacksRef.current.onLoadProgress(0.93);

        // Apollo 11 historical site models (Lunar Module, 2 Astronauts, American Flag)
        apolloHandle = createApolloSiteAssets(maxAniso);
        scene.add(apolloHandle.group);

        if (!isSoftwareGl) {
          renderer.compile(scene, camera);
        }

        callbacksRef.current.onLoadProgress(1.0);
        callbacksRef.current.onReady();
        lastTime = performance.now();
        scheduleNextFrame();
      } catch (err) {
        if (!disposed) {
          callbacksRef.current.onError(
            err instanceof Error
              ? err.message
              : 'Failed to initialize 3D lunar scene.',
          );
        }
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', onControlsStart);
      controls.dispose();

      renderer.domElement.removeEventListener(
        'webglcontextlost',
        handleContextLost,
      );
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        handleContextRestored,
      );

      starfield.dispose();
      terrainHandle?.dispose();
      apolloHandle?.dispose();
      moonGeo?.dispose();
      moonMat?.dispose();
      lunarMapsDisposables.forEach((d) => d.dispose());
      envTarget.dispose();
      composer?.dispose();
      renderer.dispose();

      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [controllerRef]);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      aria-label="Interactive 3D Moon and Apollo 11 Exploration Viewport"
    />
  );
}
