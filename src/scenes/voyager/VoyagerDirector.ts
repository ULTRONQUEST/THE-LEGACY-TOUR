import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createProceduralTextures } from './textures';
import { createVoyager1Model } from './voyagerModel';
import { createTourShipModel } from './tourShipModel';
import { createDeepSpaceEnvironment } from './deepSpaceEnv';
import {
  ENCOUNTER_SHOTS,
  evaluateEncounterState,
  ShotDefinition,
  TOTAL_DURATION_SECONDS,
} from './encounterDirector';
import { DeepSpaceAudio } from './spaceAudio';

export interface VoyagerTelemetrySnapshot {
  progress: number;
  activeShot: ShotDefinition;
  relativeVelocityKms: number;
  distanceMeters: number;
  speedFactor: number;
}

export interface VoyagerDirectorCallbacks {
  onTelemetryUpdate?: (snapshot: VoyagerTelemetrySnapshot) => void;
  onPlaybackEnd?: () => void;
  onSceneReady?: () => void;
  onWebGLError?: (message: string) => void;
}

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

export class VoyagerDirector {
  private container: HTMLElement;
  private callbacks: VoyagerDirectorCallbacks;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  private textures!: ReturnType<typeof createProceduralTextures>;
  private deepSpace!: ReturnType<typeof createDeepSpaceEnvironment>;
  private voyager!: ReturnType<typeof createVoyager1Model>;
  private tourShip!: ReturnType<typeof createTourShipModel>;
  public audio = new DeepSpaceAudio();

  private isSoftwareGl = false;
  private isPlaying = true;
  private cameraMode: 'guided' | 'free' = 'guided';
  private progress = 0;
  private playbackSpeed = 1.0;
  private elapsed = 0;
  private lastTime = 0;
  private lastTelemetryReport = 0;
  private endedEmitted = false;
  private disposed = false;
  private frameId = 0;

  private onResizeBound!: () => void;

  constructor(container: HTMLElement, callbacks: VoyagerDirectorCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.init();
  }

  private init() {
    this.isSoftwareGl = detectSoftwareWebGL();

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      this.callbacks.onWebGLError?.('WebGL hardware acceleration unavailable.');
      return;
    }

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    this.container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060814);
    this.scene.fog = new THREE.FogExp2(0x080b1c, 0.0018);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = envTarget.texture;
    this.scene.environmentIntensity = 0.62;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 1400);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = true;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 160;
    this.controls.rotateSpeed = 0.72;
    this.controls.zoomSpeed = 0.85;

    this.controls.addEventListener('start', () => {
      this.cameraMode = 'free';
    });

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.25);
    keyLight.position.set(22, 16, 26);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 85;
    keyLight.shadow.camera.left = -16;
    keyLight.shadow.camera.right = 16;
    keyLight.shadow.camera.top = 16;
    keyLight.shadow.camera.bottom = -16;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const hemiFill = new THREE.HemisphereLight(0x8c7ae6, 0x1e4e79, 0.92);
    this.scene.add(hemiFill);

    const rimLight = new THREE.DirectionalLight(0x6bb8ff, 1.35);
    rimLight.position.set(-24, -10, -28);
    this.scene.add(rimLight);

    this.textures = createProceduralTextures(this.renderer);
    this.deepSpace = createDeepSpaceEnvironment(this.textures);
    this.scene.add(this.deepSpace.group);

    this.voyager = createVoyager1Model(this.textures, this.isSoftwareGl);
    this.scene.add(this.voyager.group);

    this.tourShip = createTourShipModel(this.textures, this.isSoftwareGl);
    this.scene.add(this.tourShip.group);

    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.34,
        0.55,
        0.86
      );
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }

    _goldenRecordWorld.copy(this.voyager.goldenRecordLocal);
    const initState = evaluateEncounterState(0, 0, _goldenRecordWorld);
    this.voyager.group.position.copy(initState.voyagerPos);
    this.voyager.group.rotation.copy(initState.voyagerRot);
    this.voyager.group.updateMatrixWorld(true);
    this.tourShip.group.position.copy(initState.tourPos);
    this.tourShip.group.rotation.copy(initState.tourRot);
    this.camera.position.copy(initState.cameraPos);
    this.camera.fov = initState.fov;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(initState.cameraTarget);
    this.controls.update();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.callbacks.onSceneReady?.();

    this.onResizeBound = () => this.handleResize();
    window.addEventListener('resize', this.onResizeBound);

    this.lastTime = performance.now();
    this.tick();
  }

  private handleResize() {
    if (!this.container) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer && this.bloomPass) {
      this.composer.setSize(w, h);
      this.bloomPass.resolution.set(w, h);
    }
  }

  private tick = () => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.1);
    this.elapsed += dt * this.playbackSpeed;

    if (this.isPlaying) {
      if (this.progress < 1.0) {
        this.endedEmitted = false;
        this.progress = Math.min(
          1.0,
          this.progress + (dt * this.playbackSpeed) / TOTAL_DURATION_SECONDS
        );
        if (this.progress >= 1.0 && !this.endedEmitted) {
          this.endedEmitted = true;
          this.callbacks.onPlaybackEnd?.();
        }
      }
    }

    this.voyager.goldenRecordMesh.getWorldPosition(_goldenRecordWorld);

    const state = evaluateEncounterState(
      this.progress,
      this.elapsed,
      _goldenRecordWorld
    );

    this.voyager.group.position.copy(state.voyagerPos);
    this.voyager.group.rotation.copy(state.voyagerRot);

    this.tourShip.group.position.copy(state.tourPos);
    this.tourShip.group.rotation.copy(state.tourRot);
    this.tourShip.setThrustIntensity(state.thrustIntensity, this.elapsed);
    this.tourShip.setSpotlightIntensity(state.spotlightIntensity);

    this.tourShip.spotLight.target.position.copy(
      this.tourShip.group.worldToLocal(_desiredTarget.copy(state.voyagerPos))
    );

    if (this.cameraMode === 'guided') {
      _desiredCam.copy(state.cameraPos);
      _desiredTarget.copy(state.cameraTarget);

      const dampFactor = this.isSoftwareGl ? 18 : 4.2;
      const alpha = this.isSoftwareGl ? 1 : 1 - Math.exp(-dampFactor * dt);
      this.camera.position.lerp(_desiredCam, alpha);
      this.controls.target.lerp(_desiredTarget, alpha);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, state.fov, alpha);
      this.camera.updateProjectionMatrix();
    }
    this.controls.update();

    this.deepSpace.update(dt, this.elapsed, state.speedFactor, this.camera.position);

    if (this.audio.isEnabled()) {
      this.audio.update(state.speedFactor);
    }

    if (now - this.lastTelemetryReport > 80) {
      this.lastTelemetryReport = now;
      this.callbacks.onTelemetryUpdate?.({
        progress: this.progress,
        activeShot: state.activeShot,
        relativeVelocityKms: state.relativeVelocityKms,
        distanceMeters: state.distanceMeters,
        speedFactor: state.speedFactor,
      });
    }

    if (this.composer && !this.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    this.frameId = requestAnimationFrame(this.tick);
  };

  public play() {
    this.isPlaying = true;
    this.cameraMode = 'guided';
  }

  public pause() {
    this.isPlaying = false;
  }

  public seek(progress01: number) {
    this.progress = THREE.MathUtils.clamp(progress01, 0, 1);
    this.endedEmitted = this.progress >= 1.0;
  }

  public seekToShot(shotIndex: number) {
    const shot = ENCOUNTER_SHOTS[Math.max(0, Math.min(ENCOUNTER_SHOTS.length - 1, shotIndex))];
    this.seek(shot.start);
    this.cameraMode = 'guided';
    this.play();
  }

  public setPlaybackSpeed(speed: number) {
    this.playbackSpeed = speed;
  }

  public resumeGuidedCamera() {
    this.cameraMode = 'guided';
  }

  public getProgress(): number {
    return this.progress;
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.onResizeBound);

    this.controls.dispose();
    this.audio.dispose();
    this.textures.dispose();
    this.deepSpace.dispose();
    this.voyager.dispose();
    this.tourShip.dispose();
    this.composer?.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
