import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';

export interface DeepSpaceEnvHandle {
  group: THREE.Group;
  update: (dt: number, elapsed: number, speedFactor: number, cameraPos: THREE.Vector3) => void;
  dispose: () => void;
}

// Module-level scratch objects (zero GC in requestAnimationFrame)
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _lookTarget = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _dummyObj = new THREE.Object3D();

export function createDeepSpaceEnvironment(textures: ProceduralTextureSet): DeepSpaceEnvHandle {
  const group = new THREE.Group();
  group.name = 'DeepSpaceEnvironment';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // =========================================================================
  // 1. PROCEDURAL DEEP-SPACE NEBULA SKYDOME (Purple, Indigo, Sapphire Blue)
  // =========================================================================
  const skyGeo = new THREE.SphereGeometry(620, 48, 32);
  geometries.push(skyGeo);

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldDir;
      uniform float uTime;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(
            mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
            mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x),
            f.y
          ),
          mix(
            mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
            mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x),
            f.y
          ),
          f.z
        );
      }

      float fbm(vec3 p) {
        float v = 0.0;
        float a = 0.52;
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = p * 2.04 + vec3(13.1, 7.7, 5.3);
          a *= 0.48;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vWorldDir);

        // Cosmic base: deep obsidian-indigo
        vec3 deepIndigo = vec3(0.022, 0.025, 0.075);
        vec3 midIndigo  = vec3(0.055, 0.062, 0.175);
        vec3 violetNeb  = vec3(0.245, 0.135, 0.445);
        vec3 sapphire   = vec3(0.075, 0.235, 0.485);
        vec3 cyanDust   = vec3(0.205, 0.525, 0.725);

        // Broad galactic diagonal band matching reference Voyager backdrop
        float diag = dot(d, normalize(vec3(0.55, -0.45, -0.70)));
        float band = smoothstep(-0.65, 0.75, diag);

        float n1 = fbm(d * 2.6 + vec3(0.0, uTime * 0.002, 0.0));
        float n2 = fbm(d * 5.8 - vec3(2.4, 1.1, 3.7));
        float fineDust = fbm(d * 14.0 + vec3(n1 * 1.4));

        vec3 col = mix(deepIndigo, midIndigo, smoothstep(0.2, 0.8, n1));

        // Left/Upper-left deep purple-violet nebula clouds
        float purpleMask = smoothstep(0.32, 0.78, n1) * (1.0 - band * 0.78);
        col = mix(col, violetNeb, purpleMask * 0.72);

        // Lower-right / forward sapphire & icy-blue star clouds
        float blueMask = smoothstep(0.35, 0.85, n1 * 0.65 + n2 * 0.45) * band;
        col = mix(col, sapphire, blueMask * 0.75);

        // Fine luminous cyan-blue stellar veil filaments
        float filament = smoothstep(0.54, 0.88, fineDust) * smoothstep(0.38, 0.82, n2);
        col += cyanDust * filament * band * 0.46;
        col += violetNeb * filament * (1.0 - band) * 0.28;

        // Subtle dark dust rifts for cosmic contrast
        float darkRift = smoothstep(0.52, 0.78, n2) * smoothstep(0.25, 0.75, 1.0 - n1);
        col *= 1.0 - darkRift * 0.42;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  materials.push(skyMat);

  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.frustumCulled = false;
  group.add(skyDome);

  // =========================================================================
  // 2. DISTANT MULTI-MAGNITUDE STARFIELD (4,500 Celestial Stars)
  // =========================================================================
  const starCount = 4500;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);

  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const colorPalette = [
    new THREE.Color(0xc9ddff), // O/B blue-white
    new THREE.Color(0xeef3ff), // A white
    new THREE.Color(0xfff4de), // G warm white
    new THREE.Color(0xffe0b5), // K pale amber
    new THREE.Color(0xcbbcff), // faint violet-white
  ];

  for (let i = 0; i < starCount; i++) {
    // Uniform sphere distribution
    const u = rand();
    const v = rand();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const radius = 260 + rand() * 310;

    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = radius * Math.cos(phi);

    const c = colorPalette[Math.floor(rand() * colorPalette.length)];
    const brightness = 0.45 + Math.pow(rand(), 2.2) * 0.85;
    starColors[i * 3] = c.r * brightness;
    starColors[i * 3 + 1] = c.g * brightness;
    starColors[i * 3 + 2] = c.b * brightness;

    // Power-law size distribution (many faint pinpoint stars, few bright stars)
    starSizes[i] = 0.8 + Math.pow(rand(), 4.5) * 4.2;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
  geometries.push(starGeo);

  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSize;
      attribute vec3 color;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * (340.0 / -mvPosition.z), 1.0, 9.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float dist = length(uv);
        if (dist > 0.5) discard;
        float core = exp(-dist * dist * 28.0);
        float halo = smoothstep(0.5, 0.0, dist) * 0.35;
        float alpha = clamp(core + halo, 0.0, 1.0);
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });
  materials.push(starMat);

  const distantStars = new THREE.Points(starGeo, starMat);
  distantStars.frustumCulled = false;
  group.add(distantStars);

  // =========================================================================
  // 3. VOLUMETRIC 3D PARALLAX NEBULA CLOUDS (Subtle Deep Depth Layers)
  // =========================================================================
  const nebCount = 26;
  const nebGeo = new THREE.PlaneGeometry(1, 1);
  geometries.push(nebGeo);

  const nebMat = new THREE.MeshBasicMaterial({
    map: textures.nebulaSprite,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  materials.push(nebMat);

  const nebMesh = new THREE.InstancedMesh(nebGeo, nebMat, nebCount);
  nebMesh.frustumCulled = false;
  const nebPositions: THREE.Vector3[] = [];
  const nebScales: number[] = [];

  for (let i = 0; i < nebCount; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 120 + rand() * 240;
    const px = Math.cos(angle) * dist * 0.9;
    const py = (rand() - 0.5) * 160;
    const pz = -100 - rand() * 260;
    nebPositions.push(new THREE.Vector3(px, py, pz));
    nebScales.push(95 + rand() * 145);

    const tint = new THREE.Color();
    if (px < 0) {
      tint.setHSL(0.73 + rand() * 0.06, 0.65, 0.42); // Violet-purple
    } else {
      tint.setHSL(0.56 + rand() * 0.08, 0.72, 0.46); // Sapphire-cyan
    }
    nebMesh.setColorAt(i, tint);
  }
  if (nebMesh.instanceColor) nebMesh.instanceColor.needsUpdate = true;
  group.add(nebMesh);

  // =========================================================================
  // 4. INTERSTELLAR TRAVEL STARS & CONTROLLED STREAK PARTICLES (1,200)
  // =========================================================================
  const travelCount = 1200;
  const travelGeo = new THREE.PlaneGeometry(1, 1);
  geometries.push(travelGeo);

  const travelMat = new THREE.MeshBasicMaterial({
    map: textures.starSprite,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  materials.push(travelMat);

  const travelMesh = new THREE.InstancedMesh(travelGeo, travelMat, travelCount);
  travelMesh.frustumCulled = false;

  const pX = new Float32Array(travelCount);
  const pY = new Float32Array(travelCount);
  const pZ = new Float32Array(travelCount);
  const pBaseSize = new Float32Array(travelCount);
  const pSpeedMul = new Float32Array(travelCount);

  const spanX = 180;
  const spanY = 120;
  const spanZ = 240;

  for (let i = 0; i < travelCount; i++) {
    // Leave a quiet corridor right around (0,0) so particles don't clip through camera lens
    let x = (rand() - 0.5) * spanX;
    let y = (rand() - 0.5) * spanY;
    if (Math.abs(x) < 3.5 && Math.abs(y) < 3.5) {
      x += x >= 0 ? 4.5 : -4.5;
    }
    pX[i] = x;
    pY[i] = y;
    pZ[i] = (rand() - 0.5) * spanZ;
    pBaseSize[i] = 0.06 + Math.pow(rand(), 2.5) * 0.24;
    pSpeedMul[i] = 0.65 + rand() * 0.75;

    const c = colorPalette[Math.floor(rand() * colorPalette.length)];
    travelMesh.setColorAt(i, c);
  }
  if (travelMesh.instanceColor) travelMesh.instanceColor.needsUpdate = true;
  group.add(travelMesh);

  const update = (
    dt: number,
    elapsed: number,
    speedFactor: number,
    cameraPos: THREE.Vector3
  ) => {
    skyMat.uniforms.uTime.value = elapsed;

    // Keep skydome & distant stars centered on camera so they are infinitely far
    skyDome.position.copy(cameraPos);
    distantStars.position.copy(cameraPos);

    // Orient nebula billboards gently toward camera
    for (let i = 0; i < nebCount; i++) {
      _dummyObj.position.copy(nebPositions[i]);
      _dummyObj.lookAt(cameraPos);
      _dummyObj.scale.set(nebScales[i], nebScales[i] * 0.72, 1);
      _dummyObj.updateMatrix();
      nebMesh.setMatrixAt(i, _dummyObj.matrix);
    }
    nebMesh.instanceMatrix.needsUpdate = true;

    // Advance travel starfield particles along +Z (ship flying toward -Z)
    // speedFactor = 1.0 -> ~135 m/s visual flow; speedFactor = 0.01 -> ~0.35 m/s subtle drift
    const baseVelocity = speedFactor * 145.0 + 0.22;
    // Controlled streak elongation (0.0 -> 1.0): pinpoints at rest, crisp light streaks at high cruise
    const streakLength = Math.pow(Math.max(0, speedFactor), 1.35) * 11.5;

    const halfZ = spanZ * 0.5;
    for (let i = 0; i < travelCount; i++) {
      let z = pZ[i] + dt * baseVelocity * pSpeedMul[i];
      if (z > halfZ) {
        z -= spanZ;
      }
      pZ[i] = z;

      _pos.set(pX[i], pY[i], z);

      // Billboard streak along Z-axis facing camera
      _lookTarget.copy(cameraPos);
      // Compute right vector = normalize(cross(flightDir, toCam))
      const dx = cameraPos.x - _pos.x;
      const dy = cameraPos.y - _pos.y;
      const dz = cameraPos.z - _pos.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      const s = pBaseSize[i];
      if (streakLength < 0.08) {
        // Near-stationary pinpoint stars: clean camera-facing billboard
        _dummyObj.position.copy(_pos);
        _dummyObj.lookAt(cameraPos);
        _dummyObj.scale.set(s, s, 1);
        _dummyObj.updateMatrix();
        travelMesh.setMatrixAt(i, _dummyObj.matrix);
      } else {
        // Controlled velocity-aligned streak billboard
        const len = Math.sqrt(distSq) || 1;
        const vx = dx / len;
        const vy = dy / len;
        const vz = dz / len;
        // Flight direction is (0, 0, 1). Right = cross((0,0,1), view) = (-vy, vx, 0)
        let rx = -vy;
        let ry = vx;
        const rLen = Math.hypot(rx, ry);
        if (rLen > 1e-4) {
          rx /= rLen;
          ry /= rLen;
        } else {
          rx = 1;
          ry = 0;
        }
        // Up-normal perpendicular to flight Z and right
        // Right = (rx, ry, 0), Y-axis = (0, 0, 1) [streak length], Z-axis = (ry, -rx, 0) [facing camera]
        _scale.set(s, s + streakLength * pSpeedMul[i], 1);
        _mat.makeBasis(
          _dummyObj.position.set(rx, ry, 0),
          _dummyObj.up.set(0, 0, 1),
          _lookTarget.set(ry, -rx, 0)
        );
        _mat.scale(_scale);
        _mat.setPosition(_pos);
        travelMesh.setMatrixAt(i, _mat);
      }
    }
    travelMesh.instanceMatrix.needsUpdate = true;
  };

  return {
    group,
    update,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
