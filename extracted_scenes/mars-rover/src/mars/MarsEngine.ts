import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MarsSoundscape } from './audio';
import { TOTAL_DURATION_SECONDS } from './constants';
import { createOpportunityRover, OpportunityRoverHandle } from './opportunityRover';
import {
  createMarsGroup,
  createMoonGroup,
  createStarfieldSystem,
  MarsPlanetHandle,
  StarfieldHandle,
} from './planets';
import { createSpacecraft, SpacecraftHandle } from './spacecraft';
import { createSurfaceGroup, SurfaceHandle } from './surface';
import { loadAndBuildTextures } from './textures';

export interface EngineCallbacks {
  onLoadProgress: (pct: number) => void;
  onReady: () => void;
  onProgressChange: (progress: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onUserOrbitChange: (orbiting: boolean) => void;
  onContextLost: (lost: boolean) => void;
}

// Pre-allocated scratch math helpers (zero GC inside animation loop)
const _camPos = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _desiredPos = new THREE.Vector3();
const _desiredTarget = new THREE.Vector3();
const _fogColorSpace = new THREE.Color(0x050608);
const _fogColorEntry = new THREE.Color(0xa6522a);
const _fogColorSurface = new THREE.Color(0xc57242);
const _tmpColor = new THREE.Color();
const _dirLightSpacePos = new THREE.Vector3(-85, 52, 76);
const _dirLightSurfacePos = new THREE.Vector3(-28, 22, -32);

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export class MarsEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private isSoftwareGl = false;

  private starfield!: StarfieldHandle;
  private moonGroup!: THREE.Group;
  private marsHandle!: MarsPlanetHandle;
  private spacecraftHandle!: SpacecraftHandle;
  private surfaceHandle!: SurfaceHandle;
  private roverHandle!: OpportunityRoverHandle;

  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private rimLight!: THREE.DirectionalLight;
  private fog!: THREE.FogExp2;

  public soundscape = new MarsSoundscape();

  private frameId = 0;
  private disposed = false;
  private ready = false;
  private playing = true;
  private progress = 0.0; // 0.0 -> 6.0 across the 6 shots
  private targetProgress: number | null = null;
  private userControlling = false;
  private lastUserInteractionTime = -10;
  private lastTime = 0;
  private elapsed = 0;
  private travelAccum = 0;
  private lastReportedProgress = -1;
  private prefersReducedMotion = false;

  private resizeObserver: ResizeObserver | null = null;
  private onContextLostHandler: ((e: Event) => void) | null = null;
  private onContextRestoredHandler: (() => void) | null = null;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (this.prefersReducedMotion) {
      this.playing = false;
    }
    void this.init();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private async init(): Promise<void> {
    this.isSoftwareGl = this.detectSoftwareGl();

    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    this.container.appendChild(canvas);

    this.onContextLostHandler = (e: Event) => {
      e.preventDefault();
      this.callbacks.onContextLost(true);
    };
    this.onContextRestoredHandler = () => {
      this.callbacks.onContextLost(false);
    };
    canvas.addEventListener('webglcontextlost', this.onContextLostHandler);
    canvas.addEventListener('webglcontextrestored', this.onContextRestoredHandler);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050608);
    this.fog = new THREE.FogExp2(0x050608, 0.0);
    this.scene.fog = this.fog;

    // Mandatory studio environment reflection (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(44, width / height, 0.15, 2200);
    this.camera.position.set(4.5, 2.4, 8.2);

    // OrbitControls (damped on GPU; active in orbital & rover inspection shots)
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.65;
    this.controls.zoomSpeed = 0.85;
    this.controls.addEventListener('start', () => {
      this.userControlling = true;
      this.lastUserInteractionTime = this.elapsed;
      this.callbacks.onUserOrbitChange(true);
    });

    // Warm/cool 3-point planetary & surface lighting rig
    this.sunLight = new THREE.DirectionalLight(0xfff1de, 2.6);
    this.sunLight.position.copy(_dirLightSpacePos);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 95;
    const d = 14;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.hemiLight = new THREE.HemisphereLight(0x6e85ad, 0x3b1f14, 0.25);
    this.scene.add(this.hemiLight);

    this.rimLight = new THREE.DirectionalLight(0x9ec0f5, 0.45);
    this.rimLight.position.set(40, -15, -60);
    this.scene.add(this.rimLight);

    // Load uploaded assets & synthesize procedural planetary/surface maps
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const textures = await loadAndBuildTextures(maxAniso, (pct) => {
      if (!this.disposed) this.callbacks.onLoadProgress(pct);
    });

    if (this.disposed) return;

    // Build all scene systems
    this.starfield = createStarfieldSystem(textures);
    this.scene.add(this.starfield.group);

    this.moonGroup = createMoonGroup(textures);
    this.scene.add(this.moonGroup);

    this.marsHandle = createMarsGroup(textures);
    this.scene.add(this.marsHandle.group);

    this.spacecraftHandle = createSpacecraft(textures);
    this.scene.add(this.spacecraftHandle.group);

    this.surfaceHandle = createSurfaceGroup(textures);
    this.scene.add(this.surfaceHandle.group);

    this.roverHandle = createOpportunityRover(textures);
    this.roverHandle.setBasePosition(0, -0.5, this.surfaceHandle.groundHeightAt);
    this.surfaceHandle.group.add(this.roverHandle.group);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Resize listener
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    this.ready = true;
    this.callbacks.onReady();
    this.callbacks.onPlayStateChange(this.playing);

    // Initial scene evaluation before first frame
    this.evaluateJourney(0.016);
    this.lastTime = performance.now();
    this.tick();
  }

  private handleResize(): void {
    if (this.disposed || !this.renderer) return;
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public setPlaying(play: boolean): void {
    this.playing = play;
    if (play) {
      this.userControlling = false;
      this.callbacks.onUserOrbitChange(false);
    }
    this.callbacks.onPlayStateChange(this.playing);
  }

  public togglePlay(): boolean {
    this.setPlaying(!this.playing);
    return this.playing;
  }

  public jumpToShot(shotIndex: number): void {
    const clamped = THREE.MathUtils.clamp(shotIndex, 0, 5);
    // Land cleanly inside the beginning of the requested shot
    const target = clamped + (clamped === 0 ? 0.0 : 0.08);
    this.targetProgress = target;
    this.userControlling = false;
    this.callbacks.onUserOrbitChange(false);
  }

  public scrubTo(val: number): void {
    this.progress = THREE.MathUtils.clamp(val, 0, 6);
    this.targetProgress = null;
    this.userControlling = false;
    this.callbacks.onUserOrbitChange(false);
    this.callbacks.onProgressChange(this.progress);
  }

  public resetCameraToJourney(): void {
    this.userControlling = false;
    this.callbacks.onUserOrbitChange(false);
  }

  private evaluateJourney(dt: number): void {
    // Smoothly interpolate if user jumped to a specific shot
    if (this.targetProgress !== null) {
      const diff = this.targetProgress - this.progress;
      if (Math.abs(diff) < 0.004) {
        this.progress = this.targetProgress;
        this.targetProgress = null;
      } else {
        this.progress = THREE.MathUtils.damp(this.progress, this.targetProgress, 5.2, dt);
      }
    } else if (this.playing && !this.userControlling) {
      const rate = 6.0 / TOTAL_DURATION_SECONDS;
      this.progress = Math.min(6.0, this.progress + rate * dt);
      if (this.progress >= 6.0) {
        this.setPlaying(false);
      }
    }

    const p = this.progress;
    if (Math.abs(p - this.lastReportedProgress) > 0.005) {
      this.lastReportedProgress = p;
      this.callbacks.onProgressChange(p);
    }

    // ---------------------------------------------------------
    // 1. SHOT 1: Moon Departure & Spacecraft Acceleration (0..1)
    // ---------------------------------------------------------
    const t1 = THREE.MathUtils.clamp(p, 0, 1);
    const accelBell =
      p < 1.05 ? Math.sin(smoothstep(0.22, 0.88, t1) * Math.PI) * (1 - smoothstep(0.92, 1.05, p)) : 0;
    const cruiseSpeed = 1.6 + accelBell * 24.0;
    this.travelAccum += cruiseSpeed * dt;

    // Moon recedes behind spacecraft (-Z) and vanishes cleanly before Shot 2
    const moonVisible = p < 1.15;
    this.moonGroup.visible = moonVisible;
    if (moonVisible) {
      const moonRecede = smootherstep(0.0, 1.05, p);
      this.moonGroup.position.set(-7 - moonRecede * 28, -2.5 - moonRecede * 6, -34 - moonRecede * 280);
      this.moonGroup.rotation.y = -0.8 + this.elapsed * 0.015;
    }

    // Spacecraft visibility & propulsion state
    const craftVisible = p < 1.58;
    this.spacecraftHandle.group.visible = craftVisible;
    if (craftVisible) {
      // Gently glide craft forward and below camera during Shot 2 approach so Mars fills frame
      const craftExit = smootherstep(1.12, 1.58, p);
      this.spacecraftHandle.group.position.set(
        0 - craftExit * 2.2,
        0 - craftExit * 2.4,
        craftExit * 6.5
      );
      this.spacecraftHandle.group.rotation.set(
        Math.sin(this.elapsed * 0.6) * 0.008,
        Math.sin(this.elapsed * 0.35) * 0.012,
        Math.sin(this.elapsed * 0.45) * 0.015
      );
      const thrustLevel = p < 1.0 ? 0.25 + accelBell * 1.05 : 0.22 * (1 - craftExit);
      this.spacecraftHandle.setThrust(thrustLevel, this.elapsed);
    }

    // Starfield & restrained acceleration motion streaks
    const spaceFade = 1 - smootherstep(3.22, 3.68, p);
    this.starfield.group.visible = spaceFade > 0.01;
    if (this.starfield.group.visible) {
      this.starfield.update(accelBell * 0.92, this.travelAccum, this.elapsed);
    }

    // ---------------------------------------------------------
    // 2. SHOT 2 & 3 & 4: Mars Planet Approach, Orbit & Descent (1..3.8)
    // ---------------------------------------------------------
    const marsVisible = p >= 0.92 && p <= 3.72;
    this.marsHandle.group.visible = marsVisible;

    if (marsVisible) {
      // Slow natural Mars axial rotation
      this.marsHandle.sphere.rotation.y = -0.18 + this.elapsed * 0.012;

      if (p < 2.0) {
        // Shot 2: Mars starts distant & small ahead (+Z), growing smoothly into dominant view
        const app = smootherstep(1.0, 2.0, p);
        const marsZ = THREE.MathUtils.lerp(420, 92, app);
        const marsY = THREE.MathUtils.lerp(18, -12, app);
        const marsX = THREE.MathUtils.lerp(24, 0, app);
        this.marsHandle.group.position.set(marsX, marsY, marsZ);
        this.marsHandle.group.scale.setScalar(1.0);
        this.marsHandle.setAtmosphereOpacity(1.0);
      } else if (p < 3.0) {
        // Shot 3: Orbital Approach (matches MARS_VIEW_97e85c0b.png curved horizon composition)
        const orb = smootherstep(2.0, 3.0, p);
        this.marsHandle.group.position.set(0, -49.5, 42);
        this.marsHandle.group.scale.setScalar(1.0 + orb * 0.06);
        this.marsHandle.setAtmosphereOpacity(1.0);
      } else {
        // Shot 4 early dive: Mars approaches/expands as camera dives into canyons
        const dive = smootherstep(3.0, 3.72, p);
        this.marsHandle.group.position.set(0, -49.5 - dive * 28, 42 - dive * 26);
        this.marsHandle.group.scale.setScalar(1.06 + dive * 0.72);
        this.marsHandle.setAtmosphereOpacity(1.0 - smoothstep(3.38, 3.68, p));
      }
    }

    // ---------------------------------------------------------
    // 3. SHOT 4, 5, 6: Martian Surface, Valleys & Opportunity Rover (3.35..6.0)
    // ---------------------------------------------------------
    const surfaceBlend = smootherstep(3.35, 3.92, p);
    this.surfaceHandle.group.visible = surfaceBlend > 0.005;
    if (this.surfaceHandle.group.visible) {
      this.surfaceHandle.update(this.elapsed, surfaceBlend);

      // Opportunity Rover kinematics (Shot 5 restrained survey drive, Shot 6 quiet rest)
      if (p >= 4.0 && p <= 5.05) {
        const driveWindow = Math.sin(smoothstep(4.2, 4.95, p) * Math.PI);
        const roverZ = THREE.MathUtils.lerp(-0.85, 0.25, smootherstep(4.18, 4.96, p));
        this.roverHandle.group.position.z = roverZ;
        this.roverHandle.setBasePosition(0, roverZ, this.surfaceHandle.groundHeightAt);
        this.roverHandle.update(dt, this.elapsed, driveWindow * 0.22, this.surfaceHandle.groundHeightAt);
      } else if (p > 5.05) {
        this.roverHandle.setBasePosition(0, 0.25, this.surfaceHandle.groundHeightAt);
        this.roverHandle.update(dt, this.elapsed, 0, this.surfaceHandle.groundHeightAt);
      } else {
        this.roverHandle.setBasePosition(0, -0.85, this.surfaceHandle.groundHeightAt);
        this.roverHandle.update(dt, this.elapsed, 0, this.surfaceHandle.groundHeightAt);
      }
    }

    // ---------------------------------------------------------
    // 4. Unified Lighting, Background & Atmospheric Fog Blend
    // ---------------------------------------------------------
    const entryPulse = Math.sin(smoothstep(3.25, 3.92, p) * Math.PI);
    const fogDensity =
      p < 3.25
        ? 0.0
        : entryPulse * 0.016 + surfaceBlend * 0.0115;

    this.fog.density = fogDensity;
    if (p < 3.25) {
      _tmpColor.copy(_fogColorSpace);
    } else if (p < 3.92) {
      const k = smoothstep(3.25, 3.72, p);
      const k2 = smoothstep(3.62, 3.95, p);
      _tmpColor.copy(_fogColorSpace).lerp(_fogColorEntry, k).lerp(_fogColorSurface, k2);
    } else {
      _tmpColor.copy(_fogColorSurface);
    }
    this.fog.color.copy(_tmpColor);
    (this.scene.background as THREE.Color).copy(_tmpColor);

    // Smoothly transition directional sunlight & hemisphere fill from space to Mars surface
    this.sunLight.position.lerpVectors(_dirLightSpacePos, _dirLightSurfacePos, surfaceBlend);
    this.sunLight.color.setRGB(
      THREE.MathUtils.lerp(1.0, 1.0, surfaceBlend),
      THREE.MathUtils.lerp(0.95, 0.84, surfaceBlend),
      THREE.MathUtils.lerp(0.89, 0.68, surfaceBlend)
    );
    this.sunLight.intensity = THREE.MathUtils.lerp(2.65, 2.85, surfaceBlend);
    this.hemiLight.intensity = THREE.MathUtils.lerp(0.24, 0.72, surfaceBlend);
    this.hemiLight.color.setHex(surfaceBlend > 0.5 ? 0xe89c68 : 0x6e85ad);
    this.hemiLight.groundColor.setHex(surfaceBlend > 0.5 ? 0x6a311a : 0x26150e);
    this.rimLight.intensity = THREE.MathUtils.lerp(0.45, 0.25, surfaceBlend);

    // ---------------------------------------------------------
    // 5. Continuous Camera Choreography & Interactive Orbit Integration
    // ---------------------------------------------------------
    const allowOrbit = (p >= 1.95 && p <= 3.05) || p >= 4.0;
    this.controls.enabled = allowOrbit;

    if (p >= 1.95 && p <= 3.05) {
      // Orbital exploration limits around Mars horizon & globe
      this.controls.minDistance = 24;
      this.controls.maxDistance = 135;
      this.controls.minPolarAngle = 0.2;
      this.controls.maxPolarAngle = Math.PI * 0.85;
    } else if (p >= 4.0) {
      // Rover surface inspection limits
      this.controls.minDistance = 2.0;
      this.controls.maxDistance = 22.0;
      this.controls.minPolarAngle = 0.15;
      this.controls.maxPolarAngle = Math.PI * 0.47;
    }

    if (!this.userControlling) {
      this.computeScriptedCamera(p, accelBell, _desiredPos, _desiredTarget);

      // Smooth exponential camera damping (never snaps)
      const dampLambda = this.targetProgress !== null ? 4.8 : 5.5;
      _camPos.copy(this.camera.position);
      _camTarget.copy(this.controls.target);

      _camPos.x = THREE.MathUtils.damp(_camPos.x, _desiredPos.x, dampLambda, dt);
      _camPos.y = THREE.MathUtils.damp(_camPos.y, _desiredPos.y, dampLambda, dt);
      _camPos.z = THREE.MathUtils.damp(_camPos.z, _desiredPos.z, dampLambda, dt);

      _camTarget.x = THREE.MathUtils.damp(_camTarget.x, _desiredTarget.x, dampLambda, dt);
      _camTarget.y = THREE.MathUtils.damp(_camTarget.y, _desiredTarget.y, dampLambda, dt);
      _camTarget.z = THREE.MathUtils.damp(_camTarget.z, _desiredTarget.z, dampLambda, dt);

      this.camera.position.copy(_camPos);
      this.controls.target.copy(_camTarget);
      this.camera.lookAt(this.controls.target);

      // Subtle FOV widening during Shot 1 acceleration
      const desiredFov = 44 + accelBell * 8.5;
      if (Math.abs(this.camera.fov - desiredFov) > 0.05) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, desiredFov, 4.5, dt);
        this.camera.updateProjectionMatrix();
      }
    } else {
      this.controls.update();
    }

    this.soundscape.update(p, accelBell, this.elapsed);
  }

  private computeScriptedCamera(
    p: number,
    accelBell: number,
    outPos: THREE.Vector3,
    outTarget: THREE.Vector3
  ): void {
    if (p < 1.0) {
      // SHOT 1: Exterior departure looking back toward Moon, swinging smoothly into forward acceleration view
      const swing = smootherstep(0.18, 0.56, p);
      const angle = THREE.MathUtils.lerp(0.55, Math.PI * 0.86, swing);
      const radius = THREE.MathUtils.lerp(6.8, 5.6, swing);

      const shakeX = Math.sin(this.elapsed * 22.0) * 0.015 * accelBell;
      const shakeY = Math.cos(this.elapsed * 19.0) * 0.015 * accelBell;

      outPos.set(
        Math.sin(angle) * radius + shakeX,
        1.55 + Math.sin(p * Math.PI) * 0.55 + shakeY,
        Math.cos(angle) * radius
      );
      // Look smoothly from Moon-backdrop-behind-craft toward forward deep space ahead
      const lookZ = THREE.MathUtils.lerp(-18, 35, smootherstep(0.24, 0.68, p));
      outTarget.set(0, 0.1, lookZ);
    } else if (p < 2.0) {
      // SHOT 2: First View of Mars ahead against starfield
      const t2 = smootherstep(1.0, 2.0, p);
      outPos.set(
        THREE.MathUtils.lerp(-2.4, 0.0, t2),
        THREE.MathUtils.lerp(1.6, 5.5, t2),
        THREE.MathUtils.lerp(-4.8, -14.5, t2)
      );
      outTarget.set(
        THREE.MathUtils.lerp(8.0, 0.0, t2),
        THREE.MathUtils.lerp(5.0, -4.0, t2),
        THREE.MathUtils.lerp(180, 62, t2)
      );
    } else if (p < 3.0) {
      // SHOT 3: Orbital Approach (Curved horizon in lower third, crater on sunlit limb, deep starfield above)
      const t3 = smootherstep(2.0, 3.0, p);
      const sweep = (t3 - 0.5) * 0.36;
      outPos.set(Math.sin(sweep) * 32, 11.5 - t3 * 1.4, -20 + Math.cos(sweep) * 6);
      outTarget.set(0, 1.8, 36);
    } else if (p < 4.0) {
      // SHOT 4: Dramatic descent dive from orbit down into the Martian valley & spires
      const t4 = smootherstep(3.0, 4.0, p);
      if (t4 < 0.45) {
        const k = t4 / 0.45;
        outPos.set(
          THREE.MathUtils.lerp(5.5, 2.2, k),
          THREE.MathUtils.lerp(10.1, 24.0, k),
          THREE.MathUtils.lerp(-14, 34, k)
        );
        outTarget.set(0, THREE.MathUtils.lerp(1.8, 3.5, k), THREE.MathUtils.lerp(36, -12, k));
      } else {
        const k = smootherstep(0.45, 1.0, t4);
        outPos.set(
          THREE.MathUtils.lerp(2.2, 0.0, k),
          THREE.MathUtils.lerp(24.0, 5.4, k),
          THREE.MathUtils.lerp(34, 15.5, k)
        );
        outTarget.set(0, THREE.MathUtils.lerp(3.5, 1.4, k), THREE.MathUtils.lerp(-12, -16, k));
      }
    } else if (p < 5.0) {
      // SHOT 5: Wide Martian valley -> gradual cinematic approach to Opportunity's mechanical details
      const t5 = smootherstep(4.0, 5.0, p);
      outPos.set(
        THREE.MathUtils.lerp(0.0, 2.75, t5),
        THREE.MathUtils.lerp(5.4, 1.85, t5),
        THREE.MathUtils.lerp(15.5, 3.55, t5)
      );
      outTarget.set(
        THREE.MathUtils.lerp(0.0, 0.0, t5),
        THREE.MathUtils.lerp(1.4, 0.72, t5),
        THREE.MathUtils.lerp(-10.0, 0.1, t5)
      );
    } else {
      // SHOT 6: Wide legacy pull-back, framing Opportunity right-of-center leaving left space for educational panel
      const t6 = smootherstep(5.0, 6.0, p);
      outPos.set(
        THREE.MathUtils.lerp(2.75, 4.3, t6),
        THREE.MathUtils.lerp(1.85, 2.65, t6),
        THREE.MathUtils.lerp(3.55, 7.8, t6)
      );
      outTarget.set(
        THREE.MathUtils.lerp(0.0, -1.35, t6),
        THREE.MathUtils.lerp(0.72, 0.92, t6),
        THREE.MathUtils.lerp(0.1, -1.8, t6)
      );
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.08, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.elapsed += dt;

    if (this.ready) {
      this.evaluateJourney(dt);
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver?.disconnect();
    this.soundscape.dispose();

    const canvas = this.renderer?.domElement;
    if (canvas) {
      if (this.onContextLostHandler) canvas.removeEventListener('webglcontextlost', this.onContextLostHandler);
      if (this.onContextRestoredHandler) canvas.removeEventListener('webglcontextrestored', this.onContextRestoredHandler);
    }

    this.controls?.dispose();

    if (this.scene) {
      this.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            m.dispose();
          }
        }
      });
    }

    this.renderer?.dispose();
    if (canvas && canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
