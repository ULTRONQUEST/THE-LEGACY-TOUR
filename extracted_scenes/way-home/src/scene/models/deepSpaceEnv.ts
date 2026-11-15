import * as THREE from 'three';

export interface DeepSpaceEnvResult {
  group: THREE.Group;
  setNebulaPresence: (nebulaIntensity: number, elapsed: number) => void;
}

export function createDeepSpaceEnv(glowTex: THREE.CanvasTexture): DeepSpaceEnvResult {
  const group = new THREE.Group();
  group.name = 'DeepSpaceEnvironment';

  // 1. Custom GLSL Interstellar Nebula & Galactic Plane Dome
  // Recreates the deep violet/indigo/cyan cosmic nebula from VOYAGER_1_9a9c9e26.jpeg in Shots 1-2,
  // then smoothly eases into crisp, star-rich near-Earth deep black in Shots 4-7.
  const nebulaUniforms = {
    uTime: { value: 0 },
    uNebulaStrength: { value: 1.0 },
  };

  const skyDomeGeo = new THREE.SphereGeometry(1400, 48, 32);
  const skyDomeMat = new THREE.ShaderMaterial({
    uniforms: nebulaUniforms,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uNebulaStrength;
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

      float fbm(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = p * 2.03 + vec3(1.7, 9.2, 3.1);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        // Subtle tilted galactic plane
        float galPlane = exp(-pow((d.y * 0.78 + d.x * 0.42 - 0.08) * 3.8, 2.0));
        float n1 = fbm(d * 3.2 + vec3(0.0, uTime * 0.002, 0.0));
        float n2 = fbm(d * 6.5 - vec3(2.4, 1.1, 0.7));
        float dust = smoothstep(0.35, 0.78, n1 * 0.65 + n2 * 0.35);

        // Interstellar Voyager palette (indigo, royal violet, faint cyan-teal dust)
        vec3 deepVoid = vec3(0.008, 0.012, 0.025);
        vec3 violetNeb = vec3(0.16, 0.11, 0.34) * pow(n1, 1.6);
        vec3 cyanNeb = vec3(0.05, 0.24, 0.38) * pow(n2, 2.1) * galPlane;
        vec3 milkyWay = vec3(0.055, 0.085, 0.145) * galPlane * (0.4 + 0.6 * dust);

        vec3 col = deepVoid
                 + (violetNeb + cyanNeb) * uNebulaStrength * 0.92
                 + milkyWay * (0.28 + 0.72 * uNebulaStrength);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const skyDome = new THREE.Mesh(skyDomeGeo, skyDomeMat);
  group.add(skyDome);

  // 2. Multi-Layer Spectral Starfield (4,800 crisp stars with realistic color temperatures)
  const starCount = 4800;
  const starPos = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starPhases = new Float32Array(starCount);

  const spectralPalette = [
    new THREE.Color(0xcad8ff), // B-type blue-white
    new THREE.Color(0xeef3ff), // A-type pure white
    new THREE.Color(0xfff6e5), // G-type warm white
    new THREE.Color(0xffdcb0), // K-type pale amber
  ];

  for (let i = 0; i < starCount; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2 * Math.PI;
    const phi = Math.acos(2 * v - 1);
    const r = 650 + Math.random() * 550;

    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const c = spectralPalette[Math.floor(Math.random() * spectralPalette.length)];
    const brightness = 0.45 + Math.pow(Math.random(), 2.2) * 0.55;
    starColors[i * 3] = c.r * brightness;
    starColors[i * 3 + 1] = c.g * brightness;
    starColors[i * 3 + 2] = c.b * brightness;

    starSizes[i] = 1.2 + Math.pow(Math.random(), 3.6) * 4.8;
    starPhases[i] = Math.random() * Math.PI * 2;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));

  const starUniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
  };

  const starMat = new THREE.ShaderMaterial({
    uniforms: starUniforms,
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vTwinkle;
      uniform float uTime;
      uniform float uPixelRatio;
      void main() {
        vColor = color;
        vTwinkle = 0.86 + 0.14 * sin(uTime * 1.4 + aPhase);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (520.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.04, d);
        gl_FragColor = vec4(vColor * vTwinkle, core * core);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const starField = new THREE.Points(starGeo, starMat);
  group.add(starField);

  // 3. Subtle Distant Spiral Galaxies in Deep Space (visible in Shot 2)
  const galaxyGroup = new THREE.Group();
  const galaxyCoords = [
    new THREE.Vector3(-280, 140, -520),
    new THREE.Vector3(340, -90, -580),
    new THREE.Vector3(-120, -190, -640),
    new THREE.Vector3(210, 220, -490),
  ];
  galaxyCoords.forEach((pos, idx) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: idx % 2 === 0 ? 0xf6d8b8 : 0xbdd4ff,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sprite.position.copy(pos);
    const s = 38 + idx * 14;
    sprite.scale.set(s * 1.8, s * 0.72, 1);
    sprite.material.rotation = idx * 0.7 + 0.3;
    galaxyGroup.add(sprite);
  });
  group.add(galaxyGroup);

  const setNebulaPresence = (nebulaIntensity: number, elapsed: number) => {
    nebulaUniforms.uTime.value = elapsed;
    nebulaUniforms.uNebulaStrength.value = nebulaIntensity;
    starUniforms.uTime.value = elapsed;
    galaxyGroup.children.forEach((child, idx) => {
      const sp = child as THREE.Sprite;
      sp.material.opacity = (0.08 + 0.24 * nebulaIntensity) * (idx % 2 === 0 ? 1 : 0.85);
    });
  };

  return { group, setNebulaPresence };
}
