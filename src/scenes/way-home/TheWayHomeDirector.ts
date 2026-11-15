import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  createEarthTextures,
  createFoilBumpTexture,
  createGoldenRecordTexture,
  createRadialGlowTexture,
  createSolarPanelTexture,
} from './textures';
import { createVoyager1 } from './models/voyagerModel';
import { createVisitorSpacecraft } from './models/visitorSpacecraft';
import { createEarthSystem } from './models/earthSystem';
import { createDeepSpaceEnv } from './models/deepSpaceEnv';
import { createMemoryVignettes } from './models/memoryVignettes';
import { TOTAL_DURATION } from './types';

// Pre-allocated scratch objects for zero GC inside animation loop
const _camTargetPos = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();
const _currentLook = new THREE.Vector3();
const _craftTargetPos = new THREE.Vector3();
const _sunDir = new THREE.Vector3();
const _earthCenter = new THREE.Vector3(0, -4, 480);
const _voyagerPos = new THREE.Vector3();
const _dirVec = new THREE.Vector3();

export interface DirectorCallbacks {
  onTimeUpdate: (time: number) => void;
  onComplete: () => void;
  onWebGLContextLost: (lost: boolean) => void;
}

export class TheWayHomeDirector {
  private container: HTMLElement;
  private callbacks: DirectorCallbacks;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private isSoftwareGl = false;

  private voyager!: ReturnType<typeof createVoyager1>;
  private visitor!: ReturnType<typeof createVisitorSpacecraft>;
  private earthSys!: ReturnType<typeof createEarthSystem>;
  private deepSpace!: ReturnType<typeof createDeepSpaceEnv>;
  private memories!: ReturnType<typeof createMemoryVignettes>;
  private paleBlueDotSprite!: THREE.Sprite;

  private keySunLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  private frameId = 0;
  private lastNow = 0;
  private sceneTime = 0;
  private isPlaying = true;
  private playbackSpeed = 1.0;
  private freeLook = false;
  private disposed = false;
  private completedFired = false;

  private disposables: Array<{ dispose: () => void }> = [];

  constructor(container: HTMLElement, callbacks: DirectorCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.init();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param) || '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return false;
    }
  }

  private init() {
    this.isSoftwareGl = this.detectSoftwareGl();

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    this.container.appendChild(canvas);

    canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03050a);

    // Studio PBR reflection environment (vital for gold Kapton foil, Golden Record, titanium)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = envRT.texture;
    this.scene.environmentIntensity = 0.55;
    pmremGenerator.dispose();
    this.disposables.push(envRT);

    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 3000);
    this.camera.position.set(5.2, 2.2, 6.2);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.05;
    this.controls.enabled = false;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 420;

    // Warm/cool 3-point space lighting rig
    this.keySunLight = new THREE.DirectionalLight(0xfff4e4, 2.9);
    this.keySunLight.position.set(80, 45, 90);
    this.keySunLight.castShadow = !this.isSoftwareGl;
    this.keySunLight.shadow.mapSize.set(1024, 1024);
    this.keySunLight.shadow.bias = -0.0005;
    this.keySunLight.shadow.normalBias = 0.02;
    this.scene.add(this.keySunLight);

    this.rimLight = new THREE.DirectionalLight(0x7aa8ff, 0.85);
    this.rimLight.position.set(-40, -15, -60);
    this.scene.add(this.rimLight);

    this.hemiLight = new THREE.HemisphereLight(0x5274b8, 0x161224, 0.42);
    this.scene.add(this.hemiLight);

    // Generate procedural high-res textures
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const glowTex = createRadialGlowTexture();
    const foilBumpTex = createFoilBumpTexture(maxAniso);
    const solarTex = createSolarPanelTexture(maxAniso);
    const goldenRecordTex = createGoldenRecordTexture(maxAniso);
    const earthTextures = createEarthTextures(maxAniso, this.isSoftwareGl);

    this.disposables.push(
      glowTex,
      foilBumpTex,
      solarTex,
      goldenRecordTex,
      earthTextures.dayMap,
      earthTextures.nightMap,
      earthTextures.specularMap,
      earthTextures.bumpMap,
      earthTextures.cloudsMap,
    );

    // Build 3D Assets
    this.deepSpace = createDeepSpaceEnv(glowTex);
    this.scene.add(this.deepSpace.group);

    this.voyager = createVoyager1(goldenRecordTex, foilBumpTex);
    this.voyager.group.rotation.set(0.18, Math.PI * 0.86, -0.08);
    this.scene.add(this.voyager.group);

    this.visitor = createVisitorSpacecraft(foilBumpTex, solarTex, glowTex);
    this.visitor.group.position.set(-4.5, -0.35, 2.0);
    this.visitor.group.rotation.set(0, Math.PI, 0);
    this.scene.add(this.visitor.group);

    this.earthSys = createEarthSystem(earthTextures, glowTex, 36);
    this.earthSys.group.position.copy(_earthCenter);
    this.scene.add(this.earthSys.group);
    this.scene.add(this.earthSys.sunGroup);

    // Pale Blue Dot glint sprite when Earth is far away (Shot 4 opening)
    this.paleBlueDotSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0x8fd0ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.paleBlueDotSprite.position.copy(_earthCenter);
    this.paleBlueDotSprite.scale.set(16, 16, 1);
    this.scene.add(this.paleBlueDotSprite);

    this.memories = createMemoryVignettes(maxAniso, solarTex, foilBumpTex);
    this.scene.add(this.memories.group);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
    this.applyChoreography(0, 1.0);
    this.lastNow = performance.now();
    this.scheduleNextTick();
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onWebGLContextLost(true);
  };

  private handleContextRestored = () => {
    this.callbacks.onWebGLContextLost(false);
  };

  private handleResize = () => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public setPlaying(playing: boolean) {
    this.isPlaying = playing;
    if (playing && this.sceneTime >= TOTAL_DURATION) {
      this.seek(0);
    }
  }

  public setSpeed(speed: number) {
    this.playbackSpeed = speed;
  }

  public setFreeLook(enabled: boolean) {
    this.freeLook = enabled;
    this.controls.enabled = enabled;
    if (enabled) {
      this.controls.target.copy(_currentLook);
      this.controls.update();
    }
  }

  public seek(timeSec: number) {
    this.sceneTime = THREE.MathUtils.clamp(timeSec, 0, TOTAL_DURATION);
    this.completedFired = this.sceneTime >= TOTAL_DURATION;
    this.applyChoreography(this.sceneTime, 1.0); // Immediate snap on explicit seek
    this.callbacks.onTimeUpdate(this.sceneTime);
  }

  public getTime(): number {
    return this.sceneTime;
  }

  // Smooth step helper
  private ss(edge0: number, edge1: number, x: number): number {
    const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  private applyChoreography(t: number, dampAlpha: number) {
    // Sun direction evolves smoothly from interstellar side-key to dramatic Earth crescent/glint angle
    const sunShift = this.ss(65, 150, t);
    _sunDir.set(
      THREE.MathUtils.lerp(0.55, -0.58, sunShift),
      THREE.MathUtils.lerp(0.32, 0.34, sunShift),
      THREE.MathUtils.lerp(0.76, -0.74, this.ss(85, 146, t)),
    ).normalize();

    this.keySunLight.position.copy(_sunDir).multiplyScalar(220);
    this.earthSys.sunGroup.position.copy(_earthCenter).addScaledVector(_sunDir, 580);
    this.earthSys.sunGroup.visible = t >= 82;

    // Nebula intensity: vivid indigo-violet interstellar sky in Shots 1-2, fading gracefully near Earth
    const nebulaStrength = 1.0 - this.ss(36, 86, t) * 0.92;
    this.deepSpace.setNebulaPresence(nebulaStrength, t);

    // Update Earth rotation & clouds
    this.earthSys.update(t, _sunDir);

    // --- VOYAGER 1 MOTION ---
    // Travels steadily outward along -Z (never turns back!)
    const voyagerDrift = Math.max(0, t - 6) * 1.15;
    _voyagerPos.set(0.8, 0.25, -voyagerDrift);
    this.voyager.group.position.copy(_voyagerPos);
    this.voyager.group.visible = t < 30; // Far out of range after Shot 1

    // --- VISITOR SPACECRAFT MOTION & ORIENTATION ---
    let craftYaw = Math.PI; // Initially aligned with Voyager heading outward (-Z)
    let craftPitch = 0;
    let craftRoll = 0;
    let thrusterPower = 0.15;
    let targetFov = 46;

    if (t < 22) {
      // SHOT 1: Farewell to Voyager 1
      const p = t / 22;
      const turnStart = this.ss(7.5, 15.5, t);
      const depart = this.ss(13.5, 22, t);
      craftYaw = Math.PI * (1 - turnStart); // Smooth 180-deg turn toward Earth (+Z)
      craftRoll = Math.sin(turnStart * Math.PI) * 0.32;
      _craftTargetPos.set(
        THREE.MathUtils.lerp(-4.2, -1.8, depart),
        THREE.MathUtils.lerp(-0.3, 0.1, depart),
        THREE.MathUtils.lerp(2.2, 22.0, depart * depart),
      );
      thrusterPower = 0.15 + turnStart * 0.55 + depart * 0.45;

      // Camera orbits gently around Voyager's Golden Record & Visitor Spacecraft,
      // then holds briefly on Voyager receding into the dark
      if (t < 11) {
        const orbitT = t / 11;
        _camTargetPos.set(
          THREE.MathUtils.lerp(5.2, 1.4, orbitT),
          THREE.MathUtils.lerp(2.1, 0.55, orbitT),
          THREE.MathUtils.lerp(6.4, 4.3, orbitT),
        );
        _camTargetLook.set(
          THREE.MathUtils.lerp(-1.2, 0.2, orbitT),
          THREE.MathUtils.lerp(0.0, -0.05, orbitT),
          THREE.MathUtils.lerp(0.6, 0.2, orbitT),
        );
      } else {
        const holdT = (t - 11) / 11;
        _camTargetPos.set(
          THREE.MathUtils.lerp(1.4, 3.2, holdT),
          THREE.MathUtils.lerp(0.55, 1.1, holdT),
          THREE.MathUtils.lerp(4.3, 7.5, holdT),
        );
        // Gaze lingers warmly on Voyager 1 shrinking into the darkness
        _camTargetLook.set(
          THREE.MathUtils.lerp(0.2, _voyagerPos.x, this.ss(0, 0.5, holdT)),
          THREE.MathUtils.lerp(-0.05, _voyagerPos.y, this.ss(0, 0.5, holdT)),
          THREE.MathUtils.lerp(0.2, _voyagerPos.z, this.ss(0, 0.65, holdT)),
        );
      }
      targetFov = THREE.MathUtils.lerp(44, 48, p);
    } else if (t < 42) {
      // SHOT 2: The Journey Back (wide deep-space cruise)
      const p = (t - 22) / 20;
      const z = THREE.MathUtils.lerp(22, 120, p);
      _craftTargetPos.set(Math.sin(p * Math.PI) * 1.4, Math.sin(p * Math.PI * 0.5) * 0.6, z);
      craftYaw = 0;
      craftRoll = Math.sin(p * Math.PI) * 0.08;
      thrusterPower = 0.9;

      // Sweeping wide-angle camera emphasizing enormous cosmic scale
      const widePull = this.ss(0.3, 0.9, p);
      _camTargetPos.set(
        _craftTargetPos.x + THREE.MathUtils.lerp(-5.2, 11.5, p),
        _craftTargetPos.y + THREE.MathUtils.lerp(2.4, 4.6, widePull),
        _craftTargetPos.z + THREE.MathUtils.lerp(-8.5, -15.5, widePull),
      );
      _camTargetLook.set(
        _craftTargetPos.x + THREE.MathUtils.lerp(0, -1.5, widePull),
        _craftTargetPos.y + 0.3,
        _craftTargetPos.z + 18,
      );
      targetFov = THREE.MathUtils.lerp(48, 54, Math.sin(p * Math.PI));
    } else if (t < 68) {
      // SHOT 3: Remembering Humanity's Exploration
      const p = (t - 42) / 26;
      const z = THREE.MathUtils.lerp(120, 215, p);
      _craftTargetPos.set(0, Math.sin(p * Math.PI * 2) * 0.35, z);
      craftYaw = 0;
      thrusterPower = 0.72;

      _camTargetPos.set(
        _craftTargetPos.x - 4.2 + Math.sin(p * Math.PI) * 1.6,
        _craftTargetPos.y + 1.45,
        _craftTargetPos.z - 6.8,
      );
      _camTargetLook.set(_craftTargetPos.x, _craftTargetPos.y + 0.5, _craftTargetPos.z + 14);
      targetFov = 46;
    } else if (t < 88) {
      // SHOT 4: Earth Appears Again
      const p = (t - 68) / 20;
      // Ease smoothly in as Earth grows from a pale blue point into a majestic world
      const approachEase = Math.pow(p, 1.35);
      const z = THREE.MathUtils.lerp(215, 418, approachEase);
      _craftTargetPos.set(
        THREE.MathUtils.lerp(0, -4.2, approachEase),
        THREE.MathUtils.lerp(0, 2.2, approachEase),
        z,
      );
      craftYaw = 0.12 * approachEase;
      craftPitch = -0.05 * approachEase;
      thrusterPower = THREE.MathUtils.lerp(0.7, 0.3, approachEase);

      _camTargetPos.set(
        _craftTargetPos.x + THREE.MathUtils.lerp(-3.5, 4.5, approachEase),
        _craftTargetPos.y + THREE.MathUtils.lerp(1.3, 3.2, approachEase),
        _craftTargetPos.z - THREE.MathUtils.lerp(6.4, 5.2, approachEase),
      );
      // Gradually shift gaze directly onto Earth
      _camTargetLook.lerpVectors(
        _craftTargetPos,
        _earthCenter,
        this.ss(0.15, 0.75, p),
      );
      targetFov = THREE.MathUtils.lerp(46, 42, p);
    } else if (t < 112) {
      // SHOT 5: The Beauty of Our Home (orbital sweep: sunlit oceans -> terminator -> night city lights)
      const p = (t - 88) / 24;
      const orbitAngle = THREE.MathUtils.lerp(-0.45, 2.35, this.ss(0, 1, p));
      const craftOrbitR = 50.5;
      const camOrbitR = 57.5;

      _craftTargetPos.set(
        _earthCenter.x + Math.sin(orbitAngle) * craftOrbitR,
        _earthCenter.y + 7.5 - p * 3.5,
        _earthCenter.z - Math.cos(orbitAngle) * craftOrbitR,
      );
      // Tangent heading along orbital path
      craftYaw = orbitAngle + Math.PI * 0.5;
      craftRoll = -0.18;
      thrusterPower = 0.22;

      const camAng = orbitAngle - 0.14;
      _camTargetPos.set(
        _earthCenter.x + Math.sin(camAng) * camOrbitR,
        _earthCenter.y + 10.5 - p * 4.5,
        _earthCenter.z - Math.cos(camAng) * camOrbitR,
      );
      _camTargetLook.copy(_earthCenter).add(new THREE.Vector3(0, 3.0, 0));
      targetFov = 43;
    } else if (t < 136) {
      // SHOT 6: What Space Exploration Has Given Us
      const p = (t - 112) / 24;
      const orbitAngle = THREE.MathUtils.lerp(2.35, 3.15, p);
      const craftOrbitR = 54;
      const camOrbitR = 64;

      _craftTargetPos.set(
        _earthCenter.x + Math.sin(orbitAngle) * craftOrbitR,
        _earthCenter.y + 4.0 + p * 4.5,
        _earthCenter.z - Math.cos(orbitAngle) * craftOrbitR,
      );
      craftYaw = orbitAngle + Math.PI * 0.5;
      craftRoll = -0.08;
      thrusterPower = 0.25;

      const camAng = orbitAngle - 0.12;
      _camTargetPos.set(
        _earthCenter.x + Math.sin(camAng) * camOrbitR,
        _earthCenter.y + 6.0 + p * 6.0,
        _earthCenter.z - Math.cos(camAng) * camOrbitR,
      );
      _camTargetLook.copy(_earthCenter).add(new THREE.Vector3(0, 2.0, 0));
      targetFov = 44;
    } else {
      // SHOT 7: The Final Cosmic Reveal (pull back into the vast universe)
      const p = THREE.MathUtils.clamp((t - 136) / (TOTAL_DURATION - 136), 0, 1);
      const pullEase = Math.pow(p, 1.25);

      // Spacecraft slowly drifts outward/away while Earth shrinks into a small blue jewel
      _craftTargetPos.set(
        _earthCenter.x + THREE.MathUtils.lerp(-2.5, -24, pullEase),
        _earthCenter.y + THREE.MathUtils.lerp(8.5, 18, pullEase),
        _earthCenter.z + THREE.MathUtils.lerp(64, 150, pullEase),
      );
      craftYaw = Math.PI * 0.92;
      craftRoll = 0.05;
      thrusterPower = 0.35 * (1 - this.ss(0.6, 0.9, p));

      _camTargetPos.set(
        _earthCenter.x + THREE.MathUtils.lerp(-8, -42, pullEase),
        _earthCenter.y + THREE.MathUtils.lerp(12, 34, pullEase),
        _earthCenter.z + THREE.MathUtils.lerp(72, 330, pullEase),
      );
      _camTargetLook.copy(_earthCenter);
      targetFov = THREE.MathUtils.lerp(44, 40, p);
    }

    // Apply smooth exponential damping to spacecraft & camera
    if (dampAlpha >= 1.0) {
      this.visitor.group.position.copy(_craftTargetPos);
      this.visitor.group.rotation.set(craftPitch, craftYaw, craftRoll);
      if (!this.freeLook) {
        this.camera.position.copy(_camTargetPos);
        _currentLook.copy(_camTargetLook);
        this.camera.lookAt(_currentLook);
      }
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    } else {
      const kCraft = 1 - Math.exp(-5.0 * dampAlpha);
      this.visitor.group.position.lerp(_craftTargetPos, kCraft);
      this.visitor.group.rotation.x = THREE.MathUtils.damp(
        this.visitor.group.rotation.x,
        craftPitch,
        4.5,
        dampAlpha,
      );
      this.visitor.group.rotation.y = THREE.MathUtils.damp(
        this.visitor.group.rotation.y,
        craftYaw,
        3.5,
        dampAlpha,
      );
      this.visitor.group.rotation.z = THREE.MathUtils.damp(
        this.visitor.group.rotation.z,
        craftRoll,
        4.5,
        dampAlpha,
      );

      if (!this.freeLook) {
        const kCam = 1 - Math.exp(-3.4 * dampAlpha);
        this.camera.position.lerp(_camTargetPos, kCam);
        _currentLook.lerp(_camTargetLook, kCam);
        this.camera.lookAt(_currentLook);
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 3.0, dampAlpha);
        this.camera.updateProjectionMatrix();
      }
    }

    this.visitor.setThrusterPower(thrusterPower, t);

    // Pale Blue Dot glint visibility when Earth is >135 units from camera
    const camDistToEarth = this.camera.position.distanceTo(_earthCenter);
    const dotFadeIn = this.ss(66, 71, t);
    const dotFadeOut = 1 - THREE.MathUtils.smoothstep(camDistToEarth, 190, 125);
    this.paleBlueDotSprite.material.opacity = dotFadeIn * dotFadeOut * 0.85;
    this.earthSys.group.visible = t >= 64;

    // Update Shot 3 memory plates & Shot 6 orbital science models
    this.memories.update(t, this.visitor.group.position, _earthCenter);

    // Subtle spacecraft idle micro-hover
    _dirVec.set(0, Math.sin(t * 0.9) * 0.04, 0);
    this.visitor.group.position.add(_dirVec);
  }

  private scheduleNextTick() {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        this.frameId = window.requestAnimationFrame(this.tick);
      });
    } else {
      this.frameId = window.requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
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

  private tick = () => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = Math.min(0.1, Math.max(0.001, (now - this.lastNow) / 1000));
    this.lastNow = now;

    if (this.isPlaying) {
      this.sceneTime = Math.min(TOTAL_DURATION, this.sceneTime + rawDt * this.playbackSpeed);
      this.callbacks.onTimeUpdate(this.sceneTime);

      if (this.sceneTime >= TOTAL_DURATION && !this.completedFired) {
        this.completedFired = true;
        this.isPlaying = false;
        this.callbacks.onComplete();
      }
    }

    this.applyChoreography(this.sceneTime, rawDt);

    if (this.freeLook) {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextTick();
  };

  public dispose() {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.controls.dispose();
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
