import * as THREE from 'three';
import { WORLD_CONSTANTS } from './types';

export class SkyAtmosphere {
  public readonly mesh: THREE.Mesh;
  private geometry: THREE.SphereGeometry;
  private material: THREE.ShaderMaterial;

  constructor() {
    this.geometry = new THREE.SphereGeometry(8500, 48, 32);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: WORLD_CONSTANTS.SUN_DIRECTION.clone() },
        uAtmosphereDensity: { value: 1.0 },
        uUpperSkyDarkness: { value: 0.0 },
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
        uniform vec3 uSunDir;
        uniform float uAtmosphereDensity;
        uniform float uUpperSkyDarkness;

        void main() {
          vec3 dir = normalize(vWorldDir);
          float elevation = clamp(dir.y, -0.15, 1.0);
          float horizonFactor = pow(1.0 - max(0.0, elevation), 2.6);

          vec3 zenithDay = vec3(0.09, 0.28, 0.62);
          vec3 zenithHigh = vec3(0.01, 0.03, 0.11);
          vec3 zenith = mix(zenithDay, zenithHigh, uUpperSkyDarkness);

          vec3 horizonDay = vec3(0.62, 0.78, 0.93);
          vec3 horizonHigh = vec3(0.11, 0.24, 0.48);
          vec3 horizon = mix(horizonDay, horizonHigh, uUpperSkyDarkness * 0.85);

          vec3 skyColor = mix(zenith, horizon, horizonFactor);

          // Warm solar Mie scattering glow
          float sunDot = max(0.0, dot(dir, normalize(uSunDir)));
          float sunHalo = pow(sunDot, 12.0) * 0.35 + pow(sunDot, 180.0) * 1.4;
          skyColor += vec3(1.0, 0.88, 0.68) * sunHalo * (1.0 - uUpperSkyDarkness * 0.7);

          // Below horizon blends into ocean/mist color
          if (dir.y < 0.0) {
            float below = clamp(-dir.y * 8.0, 0.0, 1.0);
            skyColor = mix(horizon, vec3(0.28, 0.42, 0.56), below);
          }

          gl_FragColor = vec4(skyColor, uAtmosphereDensity);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  public update(cameraPos: THREE.Vector3, density: number, upperDarkness: number): void {
    this.mesh.position.copy(cameraPos);
    this.material.uniforms.uAtmosphereDensity.value = density;
    this.material.uniforms.uUpperSkyDarkness.value = upperDarkness;
    this.mesh.visible = density > 0.01;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
