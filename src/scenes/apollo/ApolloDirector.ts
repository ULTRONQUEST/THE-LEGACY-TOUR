import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { createApolloSiteAssets } from './apolloModels';
import {
  EvaluatedChoreography,
  evaluateChoreography,
} from './cameraChoreography';
import {
  MOON_CENTER,
  MOON_RADIUS,
  TOTAL_FILM_DURATION_SEC,
  SHOTS,
} from './constants';
import { createLunarTerrain } from './lunarTerrain';
import {
  createRegolithTextures,
  generateLunarSphereMaps,
} from './lunarTextures';
import { createStarfield } from './starfield';

export interface ApolloDirectorCallbacks {
  onProgressChange?: (progress01: number) => void;
  onLoadProgress?: (pct: number) => void;
  onReady?: () => void;
  onError?: (msg: string) => void;
  onComplete?: () => void;
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

export class ApolloDirector {
  private container: HTMLElement;
  private callbacks: ApolloDirectorCallbacks;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  private starfield!: ReturnType<typeof createStarfield>;
  private sunLight!: THREE.DirectionalLight;
  private moonMesh: THREE.Mesh | null = null;
  private moonGeo: THREE.SphereGeometry | null = null;
  private moonMat: THREE.MeshStandardMaterial | null = null;
  private terrainHandle: ReturnType<typeof createLunarTerrain> | null = null;
  private apolloHandle: ReturnType<typeof createApolloSiteAssets> | null = null;
  private lunarMapsDisposables: Array<{ dispose: () => void }> = [];
  private envTarget!: THREE.WebGLRenderTarget;

  private isSoftwareGl = false;
  private disposed = false;
  private frameId = 0;
  private isPlaying = true;
  private isManualControl = false;
  private progress = 0;
  private smoothProgress = 0;
  private needsCameraSnap = true;
  private lastTime = 0;
  private lastReportedUiProgress = -1;
  private playbackSpeed = 1.0;
  private completedFired = false;

  private onResizeBound!: () => void;

  constructor(container: HTMLElement, callbacks: ApolloDirectorCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.init();
  }

  private init() {
    this.isSoftwareGl = detectSoftwareWebGL();
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x020306, 1);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020306);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 0.24;
    roomEnv.dispose();
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(42, width / height, 10, 45000);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.65;
    this.controls.zoomSpeed = 0.85;

    this.starfield = createStarfield(3400);
    this.scene.add(this.starfield.points);

    this.sunLight = new THREE.DirectionalLight(0xfff7ec, 3.35);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 40;
    this.sunLight.shadow.camera.far = 220;
    this.sunLight.shadow.camera.left = -20;
    this.sunLight.shadow.camera.right = 20;
    this.sunLight.shadow.camera.top = 20;
    this.sunLight.shadow.camera.bottom = -20;
    this.sunLight.shadow.bias = -0.00035;
    this.sunLight.shadow.normalBias = 0.016;
    this.sunLight.target.position.set(-0.8, 0, -2.5);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const bounceFill = new THREE.HemisphereLight(0x070a12, 0x3f434a, 0.32);
    this.scene.add(bounceFill);

    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.16,
        0.35,
        0.92
      );
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }

    evaluateChoreography(0, _choreo);
    this.camera.position.copy(_choreo.position);
    this.controls.target.copy(_choreo.target);
    this.camera.fov = _choreo.fov;
    this.camera.updateProjectionMatrix();
    this.controls.update();

    this.controls.addEventListener('start', () => {
      this.isManualControl = true;
      this.isPlaying = false;
    });

    this.onResizeBound = () => this.handleResize();
    window.addEventListener('resize', this.onResizeBound);

    this.loadAssets();
  }

  private async loadAssets() {
    try {
      const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
      this.callbacks.onLoadProgress?.(0.05);

      const sphereMaps = await generateLunarSphereMaps(maxAniso, (p) => {
        if (!this.disposed) {
          this.callbacks.onLoadProgress?.(0.05 + p * 0.72);
        }
      });

      if (this.disposed) {
        sphereMaps.albedoMap.dispose();
        sphereMaps.bumpMap.dispose();
        sphereMaps.roughnessMap.dispose();
        return;
      }

      this.lunarMapsDisposables = [
        sphereMaps.albedoMap,
        sphereMaps.bumpMap,
        sphereMaps.roughnessMap,
      ];

      this.moonGeo = new THREE.SphereGeometry(MOON_RADIUS, 128, 96);
      this.moonMat = new THREE.MeshStandardMaterial({
        map: sphereMaps.albedoMap,
        bumpMap: sphereMaps.bumpMap,
        bumpScale: 16,
        roughnessMap: sphereMaps.roughnessMap,
        roughness: 0.95,
        metalness: 0.0,
        envMapIntensity: 0.08,
      });
      this.moonMesh = new THREE.Mesh(this.moonGeo, this.moonMat);
      this.moonMesh.position.copy(MOON_CENTER);
      this.scene.add(this.moonMesh);

      this.callbacks.onLoadProgress?.(0.84);

      const regolithMaps = createRegolithTextures(maxAniso);
      this.lunarMapsDisposables.push(
        regolithMaps.albedoMap,
        regolithMaps.normalMap,
        regolithMaps.roughnessMap
      );
      this.terrainHandle = createLunarTerrain(regolithMaps);
      this.scene.add(this.terrainHandle.group);

      this.callbacks.onLoadProgress?.(0.93);

      this.apolloHandle = createApolloSiteAssets(maxAniso);
      this.scene.add(this.apolloHandle.group);

      if (!this.isSoftwareGl) {
        this.renderer.compile(this.scene, this.camera);
      }

      this.callbacks.onLoadProgress?.(1.0);
      this.callbacks.onReady?.();
      this.lastTime = performance.now();
      this.tick();
    } catch (err) {
      if (!this.disposed) {
        this.callbacks.onError?.(
          err instanceof Error ? err.message : 'Failed to initialize Apollo 11 scene.'
        );
      }
    }
  }

  private handleResize() {
    if (!this.container) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) this.composer.setSize(w, h);
    if (this.bloomPass) this.bloomPass.resolution.set(w, h);
  }

  private updateScene(dt: number) {
    if (this.isPlaying && !this.isManualControl) {
      this.progress += (dt * this.playbackSpeed) / TOTAL_FILM_DURATION_SEC;
      if (this.progress >= 1) {
        this.progress = 1;
        this.isPlaying = false;
        if (!this.completedFired) {
          this.completedFired = true;
          this.callbacks.onComplete?.();
        }
      }
    }

    this.smoothProgress = THREE.MathUtils.damp(this.smoothProgress, this.progress, 7.5, dt);
    evaluateChoreography(this.smoothProgress, _choreo);

    this.sunLight.position.copy(_choreo.sunDirection).multiplyScalar(120);
    if (this.moonMesh) {
      this.moonMesh.rotation.y = _choreo.moonRotationY;
    }

    const surfaceProximity = THREE.MathUtils.smoothstep(this.smoothProgress, 0.58, 0.72);
    this.starfield.setExposureFactor(THREE.MathUtils.lerp(1.0, 0.24, surfaceProximity));

    if (!this.isManualControl) {
      if (this.needsCameraSnap) {
        this.camera.position.copy(_choreo.position);
        this.controls.target.copy(_choreo.target);
        this.camera.fov = _choreo.fov;
        this.needsCameraSnap = false;
      } else {
        const dampLambda = 6.5;
        const alpha = 1 - Math.exp(-dampLambda * dt);
        this.camera.position.lerp(_choreo.position, alpha);
        this.controls.target.lerp(_choreo.target, alpha);
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, _choreo.fov, 6.0, dt);
      }
      this.controls.minDistance = 1.5;
      this.controls.maxDistance = 30000;
      this.controls.maxPolarAngle = Math.PI;
      this.controls.update();
    } else {
      const isOrbital = this.smoothProgress < 0.52;
      if (isOrbital) {
        this.controls.target.lerp(MOON_CENTER, 1 - Math.exp(-5.0 * dt));
        this.controls.minDistance = MOON_RADIUS * 1.18;
        this.controls.maxDistance = 24000;
        this.controls.maxPolarAngle = Math.PI;
      } else {
        this.controls.minDistance = 1.6;
        this.controls.maxDistance = 280;
        this.controls.maxPolarAngle = Math.PI * 0.492;
      }
      this.controls.update();
    }

    const distToSurface = Math.max(
      0.5,
      this.camera.position.distanceTo(_scratchVec.copy(MOON_CENTER)) - MOON_RADIUS
    );

    if (this.terrainHandle && this.apolloHandle) {
      if (distToSurface > 950) {
        this.terrainHandle.group.visible = false;
        this.apolloHandle.group.visible = false;
      } else {
        this.terrainHandle.group.visible = true;
        this.apolloHandle.group.visible = true;
        const tFade = 1 - THREE.MathUtils.smoothstep(distToSurface, 380, 950);
        const needTransparent = tFade < 0.995;
        if (this.terrainHandle.terrainMaterial.transparent !== needTransparent) {
          this.terrainHandle.terrainMaterial.transparent = needTransparent;
          this.terrainHandle.terrainMaterial.needsUpdate = true;
        }
        this.terrainHandle.terrainMaterial.opacity = tFade;
      }
    }

    const desiredNear = THREE.MathUtils.clamp(distToSurface * 0.03, 0.14, 90);
    const desiredFar = distToSurface > 400 ? 45000 : 12000;
    if (
      Math.abs(this.camera.near - desiredNear) / this.camera.near > 0.08 ||
      Math.abs(this.camera.far - desiredFar) > 500 ||
      !this.isManualControl
    ) {
      this.camera.near = desiredNear;
      this.camera.far = desiredFar;
      this.camera.updateProjectionMatrix();
    }

    if (Math.abs(this.progress - this.lastReportedUiProgress) > 0.0025) {
      this.lastReportedUiProgress = this.progress;
      this.callbacks.onProgressChange?.(this.progress);
    }
  }

  private tick = () => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    this.updateScene(dt);

    if (this.composer && !this.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    this.frameId = requestAnimationFrame(this.tick);
  };

  public play() {
    this.isPlaying = true;
    this.isManualControl = false;
    if (this.progress >= 0.995) {
      this.seekTo(0, true);
    }
  }

  public pause() {
    this.isPlaying = false;
  }

  public seekTo(progress01: number, autoPlay = true) {
    const clamped = THREE.MathUtils.clamp(progress01, 0, 1);
    const jumpDelta = Math.abs(clamped - this.progress);
    this.progress = clamped;
    this.smoothProgress = clamped;
    this.isManualControl = false;
    this.isPlaying = autoPlay;
    evaluateChoreography(clamped, _choreo);
    if (jumpDelta > 0.22 || this.camera.position.distanceTo(_choreo.position) > 900) {
      this.needsCameraSnap = true;
    }
    this.callbacks.onProgressChange?.(clamped);
  }

  public seekToShot(shotIndex: number) {
    const shot = SHOTS[Math.max(0, Math.min(SHOTS.length - 1, shotIndex))];
    const targetProgress = shot.id === 1 ? 0 : Math.min(0.995, shot.start + 0.005);
    this.seekTo(targetProgress, true);
  }

  public setPlaybackSpeed(speed: number) {
    this.playbackSpeed = speed;
  }

  public resumeAutoCamera() {
    this.isManualControl = false;
    this.isPlaying = true;
  }

  public getProgress(): number {
    return this.progress;
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.onResizeBound);

    this.controls.dispose();
    this.starfield.dispose();
    this.terrainHandle?.dispose();
    this.apolloHandle?.dispose();
    this.moonGeo?.dispose();
    this.moonMat?.dispose();
    this.lunarMapsDisposables.forEach((d) => d.dispose());
    this.envTarget.dispose();
    this.composer?.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
