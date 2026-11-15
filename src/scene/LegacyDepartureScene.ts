import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import {
  DepartureSceneCallbacks,
  DepartureSceneHandle,
  MoonHandoverPose,
  SHOTS,
  TOTAL_DURATION,
  WORLD_CONSTANTS,
} from './types';
import {
  createEarthTextures,
  createMoonTextures,
  createSurfaceAndSpriteTextures,
  EarthTextureBundle,
  MoonTextureBundle,
  SpriteAndSurfaceTextures,
} from './textures';
import { LaunchComplex } from './LaunchComplex';
import { LaunchRocket } from './LaunchRocket';
import { SpacecraftOrbiter } from './SpacecraftOrbiter';
import { EarthSystem } from './EarthSystem';
import { MoonSystem } from './MoonSystem';
import { SkyAtmosphere } from './SkyAtmosphere';
import { SpaceBackdrop } from './SpaceBackdrop';
import { ParticleEffects } from './ParticleEffects';
import { TimelineController } from './TimelineController';
import { AudioEngine } from './AudioEngine';

const _fogColor = new THREE.Color('#8ab6de');
const _dayFogColor = new THREE.Color('#95bee4');
const _spaceFogColor = new THREE.Color('#020408');
const _camGoal = new THREE.Vector3();
const _targetGoal = new THREE.Vector3();
const _rocketUp = new THREE.Vector3();

function formatMissionClock(t: number): string {
  // T-00:24 at t=0 -> T-00:00 at liftoff (t=24) -> T+00:54 at end (t=78)
  const rel = Math.round(t - 24);
  const sign = rel < 0 ? '-' : '+';
  const abs = Math.abs(rel);
  const mins = Math.floor(abs / 60);
  const secs = abs % 60;
  return `T${sign}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function createLegacyDepartureScene(
  container: HTMLElement,
  callbacks: DepartureSceneCallbacks = {}
): DepartureSceneHandle {
  // Detect software WebGL (SwiftShader/llvmpipe) to pace render cost appropriately
  const isSoftwareGl = (() => {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  })();

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#020408');
  const fog = new THREE.FogExp2('#95bee4', 0.00042);
  scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(48, width / height, 1.0, 58000);

  // Studio / atmospheric environment reflections for metals & cockpit glass
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envRenderTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRenderTarget.texture;
  scene.environmentIntensity = 0.55;
  pmremGenerator.dispose();

  // Warm directional solar key light + cool sky/ground HemisphereLight fill
  const sunLight = new THREE.DirectionalLight('#fff4de', 2.7);
  sunLight.position.copy(WORLD_CONSTANTS.SUN_DIRECTION).multiplyScalar(420);
  sunLight.castShadow = !isSoftwareGl;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 20;
  sunLight.shadow.camera.far = 900;
  const d = 155;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.03;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const hemiLight = new THREE.HemisphereLight('#9ec8f5', '#2a332b', 0.85);
  scene.add(hemiLight);

  // Generate procedural textures
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const earthTextures: EarthTextureBundle = createEarthTextures(maxAniso);
  const moonTextures: MoonTextureBundle = createMoonTextures(maxAniso);
  const surfaceTextures: SpriteAndSurfaceTextures = createSurfaceAndSpriteTextures(maxAniso);

  // Instantiate modular 3D sub-systems
  const skyAtmosphere = new SkyAtmosphere();
  const spaceBackdrop = new SpaceBackdrop();
  const earthSystem = new EarthSystem(earthTextures);
  const moonSystem = new MoonSystem(moonTextures);
  const launchComplex = new LaunchComplex(surfaceTextures);
  const launchRocket = new LaunchRocket(surfaceTextures);
  const orbiter = new SpacecraftOrbiter(surfaceTextures);
  const particles = new ParticleEffects(surfaceTextures);
  const timeline = new TimelineController();
  const audio = new AudioEngine();

  scene.add(
    skyAtmosphere.mesh,
    spaceBackdrop.group,
    earthSystem.group,
    moonSystem.mesh,
    launchComplex.group,
    launchRocket.root,
    orbiter.root,
    particles.group
  );

  // Optional pause-mode OrbitControls so visitors can inspect any stage if paused
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 12;
  controls.maxDistance = 3500;
  controls.enabled = false;

  // Pre-compile shaders on hardware GPUs
  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  let currentTime = 0;
  let isPlaying = true;
  let isComplete = false;
  let playbackSpeed = 1.0;
  let userInspectingWhilePaused = false;
  let lastCallbackTime = -1;
  let handoverNotified = false;
  let disposed = false;
  let frameId = 0;
  let lastFrameMs = performance.now();

  controls.addEventListener('start', () => {
    if (!isPlaying) {
      userInspectingWhilePaused = true;
    }
  });

  // Initialize camera immediately at t = 0
  const initFrame = timeline.evaluate(0);
  camera.position.copy(initFrame.cameraPosition);
  camera.lookAt(initFrame.cameraTarget);
  controls.target.copy(initFrame.cameraTarget);

  const emitTimeline = (force = false) => {
    const now = performance.now();
    if (!force && now - lastCallbackTime < 50) return;
    lastCallbackTime = now;
    const f = timeline.state;
    callbacks.onTimelineUpdate?.({
      currentTime,
      duration: TOTAL_DURATION,
      progress: currentTime / TOTAL_DURATION,
      isPlaying,
      isComplete,
      playbackSpeed,
      activeShot: f.activeShot,
      altitudeKm: f.altitudeKm,
      velocityKms: f.velocityKms,
      missionClockLabel: formatMissionClock(currentTime),
    });
  };

  const applyFrameToScene = (dt: number, realElapsed: number) => {
    const f = timeline.evaluate(currentTime);

    // 1. Update Rocket & Stage Separation
    launchRocket.root.visible = f.rocketVisible;
    if (f.rocketVisible) {
      launchRocket.root.position.copy(f.rocketPosition);
      launchRocket.root.quaternion.copy(f.rocketQuaternion);

      if (f.stage1Separated) {
        launchRocket.stage1Group.position.copy(f.stage1Offset);
        launchRocket.stage1Group.rotation.copy(f.stage1Rotation);
      } else {
        launchRocket.stage1Group.position.set(0, 0, 0);
        launchRocket.stage1Group.rotation.set(0, 0, 0);
      }

      const altFactor = Math.min(1, f.rocketPosition.y / 900);
      launchRocket.updateThrustVisuals(realElapsed, f.f1Intensity, f.j2Intensity, altFactor);
    }

    // 2. Update Orbital Spacecraft (Image 2 reference)
    orbiter.root.visible = f.orbiterVisible;
    if (f.orbiterVisible) {
      orbiter.root.position.copy(f.orbiterPosition);
      orbiter.root.quaternion.copy(f.orbiterQuaternion);
      orbiter.update(realElapsed, f.orbiterBurnIntensity, f.orbiterRcsPulse);
    }

    // 3. Update Launch Complex, Earth, Moon, Sky, Stars
    launchComplex.update(f.armRetraction, f.padVisibility);
    earthSystem.update(realElapsed, f.earthVisibility);
    moonSystem.update(realElapsed);

    // 4. Update Camera smoothly (or yield to OrbitControls when paused & orbiting)
    if (!userInspectingWhilePaused) {
      _camGoal.copy(f.cameraPosition);
      _targetGoal.copy(f.cameraTarget);

      if (f.cameraShake > 0.001 && isPlaying) {
        _camGoal.x += Math.sin(realElapsed * 41) * f.cameraShake;
        _camGoal.y += Math.cos(realElapsed * 33) * f.cameraShake * 0.7;
      }

      if (isPlaying) {
        const dampAlpha = 1 - Math.exp(-9.5 * Math.min(0.1, dt));
        camera.position.lerp(_camGoal, dampAlpha);
        controls.target.lerp(_targetGoal, dampAlpha);
      } else {
        camera.position.copy(_camGoal);
        controls.target.copy(_targetGoal);
      }
      camera.lookAt(controls.target);

      if (Math.abs(camera.fov - f.cameraFov) > 0.05) {
        camera.fov = THREE.MathUtils.damp(camera.fov, f.cameraFov, 7, dt);
        camera.updateProjectionMatrix();
      }
    } else {
      controls.update();
    }

    // Adjust near plane softly in deep space for rock-solid depth precision
    const targetNear = f.starVisibility > 0.5 ? 2.5 : 1.0;
    if (Math.abs(camera.near - targetNear) > 0.1) {
      camera.near = targetNear;
      camera.updateProjectionMatrix();
    }

    // 5. Update Atmosphere, Starfield & Fog
    skyAtmosphere.update(camera.position, f.skyDensity, f.upperSkyDarkness);
    spaceBackdrop.update(realElapsed, f.starVisibility, camera.position);

    _fogColor.copy(_spaceFogColor).lerp(_dayFogColor, f.skyDensity);
    fog.color.copy(_fogColor);
    fog.density = f.fogDensity;

    // 6. Lighting follows Sun direction; shadow frustum tracks rocket near launchpad
    sunLight.intensity = f.sunIntensity;
    hemiLight.intensity = f.hemiIntensity;
    scene.environmentIntensity = 0.55 * (1 - f.starVisibility * 0.65);

    if (f.padVisibility > 0.1) {
      const focusY = Math.min(180, f.rocketPosition.y);
      sunLight.target.position.set(0, focusY * 0.5, 0);
      sunLight.position
        .copy(WORLD_CONSTANTS.SUN_DIRECTION)
        .multiplyScalar(420)
        .add(sunLight.target.position);
    } else {
      sunLight.position.copy(WORLD_CONSTANTS.SUN_DIRECTION).multiplyScalar(15000);
      sunLight.target.position.set(0, 0, -4000);
    }

    // 7. Particles & Procedural Audio
    _rocketUp.set(0, 1, 0).applyQuaternion(f.rocketQuaternion).normalize();
    particles.update(
      realElapsed,
      f.padSmokeIntensity > f.f1Intensity ? f.padSmokeIntensity : f.f1Intensity,
      f.ventIntensity,
      f.rocketPosition,
      _rocketUp,
      f.padVisibility,
      f.cloudDeckOpacity
    );

    const totalThrust = Math.max(f.f1Intensity, f.j2Intensity * 0.65, f.orbiterBurnIntensity * 0.3);
    audio.update(totalThrust, f.ventIntensity, f.starVisibility);

    // 8. Notify lunar handover trigger slightly before end of Shot 9
    if (!handoverNotified && currentTime >= TOTAL_DURATION - 0.2) {
      handoverNotified = true;
      const pose = timeline.getHandoverPose();
      callbacks.onHandoverReady?.(pose);
      callbacks.onComplete?.(pose);
    }
  };

  function afterDraw(cb: () => void) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
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

  function tick() {
    if (disposed) return;
    const now = performance.now();
    const rawDt = Math.min(0.1, (now - lastFrameMs) / 1000);
    lastFrameMs = now;

    if (isPlaying && !isComplete) {
      currentTime += rawDt * playbackSpeed;
      if (currentTime >= TOTAL_DURATION) {
        currentTime = TOTAL_DURATION;
        isComplete = true;
        isPlaying = false;
        controls.enabled = true;
        emitTimeline(true);
      }
    }

    applyFrameToScene(rawDt, now / 1000);
    renderer.render(scene, camera);
    emitTimeline(false);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  const onResize = () => {
    if (disposed) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  const onContextLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(frameId);
    clearTimeout(frameId);
  };

  const onContextRestored = () => {
    lastFrameMs = performance.now();
    tick();
  };

  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

  emitTimeline(true);
  frameId = requestAnimationFrame(tick);

  return {
    play: () => {
      if (isComplete) {
        currentTime = 0;
        isComplete = false;
        handoverNotified = false;
      }
      isPlaying = true;
      userInspectingWhilePaused = false;
      controls.enabled = false;
      emitTimeline(true);
    },
    pause: () => {
      isPlaying = false;
      controls.enabled = true;
      emitTimeline(true);
    },
    replay: () => {
      currentTime = 0;
      isComplete = false;
      isPlaying = true;
      handoverNotified = false;
      userInspectingWhilePaused = false;
      controls.enabled = false;
      const startF = timeline.evaluate(0);
      camera.position.copy(startF.cameraPosition);
      controls.target.copy(startF.cameraTarget);
      camera.lookAt(startF.cameraTarget);
      emitTimeline(true);
    },
    seek: (timeSeconds: number) => {
      currentTime = Math.max(0, Math.min(TOTAL_DURATION, timeSeconds));
      isComplete = currentTime >= TOTAL_DURATION;
      if (!isComplete) handoverNotified = false;
      userInspectingWhilePaused = false;
      const f = timeline.evaluate(currentTime);
      camera.position.copy(f.cameraPosition);
      controls.target.copy(f.cameraTarget);
      camera.fov = f.cameraFov;
      camera.updateProjectionMatrix();
      camera.lookAt(f.cameraTarget);
      emitTimeline(true);
    },
    seekToShot: (shotIndex: number) => {
      const targetShot = SHOTS[Math.max(0, Math.min(SHOTS.length - 1, shotIndex))];
      currentTime = targetShot.startTime + 0.05;
      isComplete = false;
      handoverNotified = false;
      userInspectingWhilePaused = false;
      const f = timeline.evaluate(currentTime);
      camera.position.copy(f.cameraPosition);
      controls.target.copy(f.cameraTarget);
      camera.fov = f.cameraFov;
      camera.updateProjectionMatrix();
      camera.lookAt(f.cameraTarget);
      emitTimeline(true);
    },
    setPlaybackSpeed: (speed: number) => {
      playbackSpeed = speed;
      emitTimeline(true);
    },
    setAudioEnabled: (enabled: boolean) => {
      audio.setEnabled(enabled);
    },
    getHandoverPose: (): MoonHandoverPose => timeline.getHandoverPose(),
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      controls.dispose();
      launchComplex.dispose();
      launchRocket.dispose();
      orbiter.dispose();
      earthSystem.dispose();
      moonSystem.dispose();
      skyAtmosphere.dispose();
      spaceBackdrop.dispose();
      particles.dispose();
      earthTextures.dispose();
      moonTextures.dispose();
      surfaceTextures.dispose();
      envRenderTarget.dispose();
      audio.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
