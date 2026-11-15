import * as THREE from 'three';

export class SpaceBackdrop {
  public readonly group = new THREE.Group();
  private starMaterial: THREE.ShaderMaterial;
  private nebulaMaterial: THREE.ShaderMaterial;
  private starGeo: THREE.BufferGeometry;
  private nebulaGeo: THREE.SphereGeometry;

  constructor() {
    const starCount = 4800;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const phases = new Float32Array(starCount);

    const palette = [
      new THREE.Color('#dbeafe'), // blue-white O/B
      new THREE.Color('#ffffff'), // white A/F
      new THREE.Color('#fef3c7'), // warm yellow G
      new THREE.Color('#fed7aa'), // amber K
    ];

    for (let i = 0; i < starCount; i++) {
      // Distribute across far celestial sphere
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 34000 + Math.random() * 6000;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const c = palette[Math.floor(Math.pow(Math.random(), 1.4) * palette.length)];
      const brightness = 0.45 + Math.pow(Math.random(), 2.2) * 0.85;
      colors[i * 3] = c.r * brightness;
      colors[i * 3 + 1] = c.g * brightness;
      colors[i * 3 + 2] = c.b * brightness;

      sizes[i] = 1.2 + Math.pow(Math.random(), 3.0) * 4.5;
      phases[i] = Math.random() * Math.PI * 2;
    }

    this.starGeo = new THREE.BufferGeometry();
    this.starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    this.starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    this.starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aPhase;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;
        uniform float uPixelRatio;

        void main() {
          vColor = aColor;
          vAlpha = 0.85 + 0.15 * sin(uTime * 1.4 + aPhase);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uOpacity;

        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float dist = length(d) * 2.0;
          if (dist > 1.0) discard;
          float core = exp(-dist * dist * 4.5);
          gl_FragColor = vec4(vColor, core * vAlpha * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const stars = new THREE.Points(this.starGeo, this.starMaterial);
    stars.frustumCulled = false;
    this.group.add(stars);

    // Subtle deep-space Milky Way dust band
    this.nebulaGeo = new THREE.SphereGeometry(42000, 48, 32);
    this.nebulaMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform float uOpacity;

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
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
            f.z
          );
        }

        void main() {
          // Tilted galactic plane
          vec3 rotDir = normalize(vec3(
            vDir.x * 0.85 - vDir.y * 0.52,
            vDir.x * 0.52 + vDir.y * 0.85,
            vDir.z
          ));
          float band = exp(-abs(rotDir.y) * 5.2);
          float dust = noise(rotDir * 5.5) * 0.65 + noise(rotDir * 12.0) * 0.35;
          float rift = smoothstep(0.32, 0.72, noise(rotDir * 8.0 + 4.2));
          vec3 nebulaColor = mix(vec3(0.03, 0.06, 0.14), vec3(0.11, 0.18, 0.32), dust);
          float alpha = band * dust * (0.55 + 0.45 * rift) * 0.38 * uOpacity;
          gl_FragColor = vec4(nebulaColor, alpha);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const nebulaDome = new THREE.Mesh(this.nebulaGeo, this.nebulaMaterial);
    nebulaDome.frustumCulled = false;
    this.group.add(nebulaDome);
  }

  public update(elapsedTime: number, visibility: number, cameraPos: THREE.Vector3): void {
    this.group.position.copy(cameraPos);
    this.starMaterial.uniforms.uTime.value = elapsedTime;
    this.starMaterial.uniforms.uOpacity.value = visibility;
    this.nebulaMaterial.uniforms.uOpacity.value = visibility;
    this.group.visible = visibility > 0.005;
  }

  public dispose(): void {
    this.starGeo.dispose();
    this.starMaterial.dispose();
    this.nebulaGeo.dispose();
    this.nebulaMaterial.dispose();
  }
}
