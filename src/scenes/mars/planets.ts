import * as THREE from 'three';
import { MarsTextureSet } from './textures';

export interface MarsPlanetHandle {
  group: THREE.Group;
  sphere: THREE.Mesh;
  atmosphere: THREE.Mesh;
  setAtmosphereOpacity: (opacity: number) => void;
}

export interface StarfieldHandle {
  group: THREE.Group;
  update: (streakAmount: number, driftZ: number, time: number) => void;
}

export function createMoonGroup(textures: MarsTextureSet): THREE.Group {
  const moonGroup = new THREE.Group();
  moonGroup.name = 'MoonSphere';

  const geo = new THREE.SphereGeometry(18, 72, 54);
  const mat = new THREE.MeshStandardMaterial({
    map: textures.moonAlbedo,
    bumpMap: textures.moonBump,
    bumpScale: 0.35,
    roughness: 0.94,
    metalness: 0.02,
  });

  const moonMesh = new THREE.Mesh(geo, mat);
  moonMesh.rotation.y = -0.8;
  moonGroup.add(moonMesh);

  return moonGroup;
}

export function createMarsGroup(textures: MarsTextureSet): MarsPlanetHandle {
  const group = new THREE.Group();
  group.name = 'MarsPlanet';

  const radius = 52;
  const sphereGeo = new THREE.SphereGeometry(radius, 128, 96);
  const sphereMat = new THREE.MeshStandardMaterial({
    map: textures.marsAlbedo,
    bumpMap: textures.marsBump,
    bumpScale: 0.52,
    roughnessMap: textures.marsRoughness,
    roughness: 0.88,
    metalness: 0.03,
  });

  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  // Orient front hemisphere (containing reference crater) nicely for approach & orbital view
  sphere.rotation.y = -0.15;
  sphere.rotation.z = 0.08;
  group.add(sphere);

  // Subtle Martian Atmospheric Rim Shader (matches MARS_VIEW_97e85c0b.png & video)
  const atmoUniforms = {
    uSunDir: { value: new THREE.Vector3(-0.65, 0.42, 0.63).normalize() },
    uOpacity: { value: 1.0 },
  };

  const atmoGeo = new THREE.SphereGeometry(radius * 1.028, 96, 64);
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: atmoUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    vertexShader: `
      varying vec3 vNormalWorld;
      varying vec3 vPosWorld;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vPosWorld = worldPos.xyz;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform float uOpacity;
      varying vec3 vNormalWorld;
      varying vec3 vPosWorld;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vPosWorld);
        // BackSide normal points outward; rim peaks where dot(viewDir, normal) is near 0 -> -0.35
        float rim = pow(clamp(0.68 + dot(viewDir, vNormalWorld), 0.0, 1.0), 3.4);
        float sunTerm = smoothstep(-0.35, 0.65, dot(vNormalWorld, uSunDir));
        vec3 dayGlow = vec3(0.95, 0.48, 0.24);
        vec3 twilightGlow = vec3(0.65, 0.24, 0.14);
        vec3 col = mix(twilightGlow, dayGlow, sunTerm);
        float alpha = rim * (0.22 + 0.78 * sunTerm) * uOpacity * 0.85;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
  group.add(atmosphere);

  // Subtle inner surface-haze scattering shell on sunlit limb
  const innerAtmoGeo = new THREE.SphereGeometry(radius * 1.006, 96, 64);
  const innerAtmoMat = new THREE.ShaderMaterial({
    uniforms: atmoUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    vertexShader: `
      varying vec3 vNormalWorld;
      varying vec3 vPosWorld;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vPosWorld = worldPos.xyz;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform float uOpacity;
      varying vec3 vNormalWorld;
      varying vec3 vPosWorld;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vPosWorld);
        float fresnel = pow(1.0 - max(0.0, dot(viewDir, vNormalWorld)), 4.2);
        float sunTerm = smoothstep(-0.2, 0.75, dot(vNormalWorld, uSunDir));
        vec3 col = vec3(0.96, 0.56, 0.30);
        gl_FragColor = vec4(col, fresnel * sunTerm * 0.55 * uOpacity);
      }
    `,
  });
  const innerAtmo = new THREE.Mesh(innerAtmoGeo, innerAtmoMat);
  group.add(innerAtmo);

  return {
    group,
    sphere,
    atmosphere,
    setAtmosphereOpacity(opacity: number) {
      atmoUniforms.uOpacity.value = opacity;
    },
  };
}

/**
 * Deep-space starfield with subtle blue nebula backdrop (inspired by MARS_VIEW_97e85c0b.png)
 * and restrained directional star streaks during Shot 1 acceleration.
 */
export function createStarfieldSystem(textures: MarsTextureSet): StarfieldHandle {
  const group = new THREE.Group();
  group.name = 'DeepSpaceStarfield';

  // 1. Subtle deep-space cosmic dust backdrop dome (faint midnight blue wisps, never overpowering)
  const skyGeo = new THREE.SphereGeometry(1400, 32, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
              mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
              mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      void main() {
        float n1 = noise(vDir * 3.5);
        float n2 = noise(vDir * 7.2 + 2.1);
        float band = exp(-pow(vDir.y * 2.2 - vDir.x * 0.6, 2.0));
        float wisp = smoothstep(0.45, 0.88, n1 * 0.65 + n2 * 0.35) * band;
        vec3 spaceBlack = vec3(0.012, 0.014, 0.022);
        vec3 nebulaBlue = vec3(0.035, 0.075, 0.16);
        gl_FragColor = vec4(mix(spaceBlack, nebulaBlue, wisp * 0.55), 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  group.add(skyDome);

  // 2. Pin-sharp background stars (Points)
  const staticCount = 2600;
  const staticPos = new Float32Array(staticCount * 3);
  const staticCol = new Float32Array(staticCount * 3);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < staticCount; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const r = 720 + Math.random() * 480;

    staticPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    staticPos[i * 3 + 1] = r * Math.cos(phi);
    staticPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    // Realistic stellar temperature tint (blue-white, warm white, pale amber)
    const temp = Math.random();
    if (temp > 0.82) tmpColor.setRGB(0.75, 0.86, 1.0);
    else if (temp > 0.25) tmpColor.setRGB(0.96, 0.96, 0.98);
    else tmpColor.setRGB(1.0, 0.87, 0.72);

    const brightness = 0.35 + Math.pow(Math.random(), 2.2) * 0.65;
    staticCol[i * 3] = tmpColor.r * brightness;
    staticCol[i * 3 + 1] = tmpColor.g * brightness;
    staticCol[i * 3 + 2] = tmpColor.b * brightness;
  }

  const staticGeo = new THREE.BufferGeometry();
  staticGeo.setAttribute('position', new THREE.BufferAttribute(staticPos, 3));
  staticGeo.setAttribute('color', new THREE.BufferAttribute(staticCol, 3));

  const staticMat = new THREE.PointsMaterial({
    size: 2.1,
    sizeAttenuation: true,
    vertexColors: true,
    map: textures.softParticleTex,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const staticStars = new THREE.Points(staticGeo, staticMat);
  group.add(staticStars);

  // 3. Restrained 3D Motion-Streak Stars (LineSegments stretched subtly along flight axis Z during Shot 1 acceleration)
  const streakCount = 420;
  const basePoints: Array<{ x: number; y: number; z: number; speed: number; bright: number }> = [];
  const streakPositions = new Float32Array(streakCount * 2 * 3);
  const streakColors = new Float32Array(streakCount * 2 * 3);

  for (let i = 0; i < streakCount; i++) {
    // Cylindrical tunnel around flight path, excluding direct center corridor
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.pow(Math.random(), 1.3) * 95;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const z = (Math.random() - 0.5) * 260;
    const speed = 0.65 + Math.random() * 0.85;
    const bright = 0.45 + Math.random() * 0.55;

    basePoints.push({ x, y, z, speed, bright });

    // Tail darker, head bright
    streakColors[i * 6 + 0] = 0.35 * bright;
    streakColors[i * 6 + 1] = 0.48 * bright;
    streakColors[i * 6 + 2] = 0.72 * bright;
    streakColors[i * 6 + 3] = 0.96 * bright;
    streakColors[i * 6 + 4] = 0.97 * bright;
    streakColors[i * 6 + 5] = 1.0 * bright;
  }

  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
  streakGeo.setAttribute('color', new THREE.BufferAttribute(streakColors, 3));

  const streakMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const streakLines = new THREE.LineSegments(streakGeo, streakMat);
  streakLines.frustumCulled = false;
  group.add(streakLines);

  return {
    group,
    update(streakAmount: number, travelOffset: number, time: number) {
      // Very gentle sidereal drift
      staticStars.rotation.y = time * 0.0025;
      skyDome.rotation.y = time * 0.0015;

      const visibleStreak = Math.max(0, Math.min(1, streakAmount));
      streakLines.visible = visibleStreak > 0.01;
      streakMat.opacity = visibleStreak * 0.62;

      if (!streakLines.visible) return;

      const posAttr = streakGeo.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const streakLen = 0.15 + visibleStreak * 6.8;

      for (let i = 0; i < streakCount; i++) {
        const bp = basePoints[i];
        // Wrap z cleanly in [-130, 130] relative to spacecraft corridor
        let z = ((bp.z - travelOffset * bp.speed) % 260);
        if (z < -130) z += 260;
        if (z > 130) z -= 260;

        const idx = i * 6;
        // Head
        arr[idx + 0] = bp.x;
        arr[idx + 1] = bp.y;
        arr[idx + 2] = z;
        // Tail trails forward/back along Z
        arr[idx + 3] = bp.x;
        arr[idx + 4] = bp.y;
        arr[idx + 5] = z + streakLen * bp.speed;
      }
      posAttr.needsUpdate = true;
    },
  };
}
