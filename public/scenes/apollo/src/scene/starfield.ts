import * as THREE from 'three';
import { hash3 } from './noise';

export interface StarfieldHandle {
  points: THREE.Points;
  setExposureFactor: (factor: number) => void;
  dispose: () => void;
}

/**
 * Creates a deep-space astronomical starfield whose perceived brightness adapts smoothly
 * between deep space (Shots 1-3) and bright sunlit lunar surface exposure (Shots 4-5).
 */
export function createStarfield(starCount = 3400): StarfieldHandle {
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);

  const radius = 26000;
  const color = new THREE.Color();

  for (let i = 0; i < starCount; i++) {
    const u = hash3(i, 1.3, 4.7);
    const v = hash3(i, 8.9, 2.1);
    const theta = Math.acos(2 * v - 1);
    const phi = u * Math.PI * 2;

    positions[i * 3] = radius * Math.sin(theta) * Math.cos(phi);
    positions[i * 3 + 1] = radius * Math.cos(theta);
    positions[i * 3 + 2] = radius * Math.sin(theta) * Math.sin(phi);

    // Realistic stellar color temperatures (cool blue-white, neutral white, warm K-type)
    const temp = hash3(i, 5.4, 9.1);
    if (temp < 0.25) {
      color.setRGB(0.78, 0.86, 1.0);
    } else if (temp < 0.72) {
      color.setRGB(0.95, 0.96, 0.99);
    } else if (temp < 0.92) {
      color.setRGB(1.0, 0.92, 0.82);
    } else {
      color.setRGB(1.0, 0.82, 0.68);
    }

    const brightness = 0.35 + Math.pow(hash3(i, 3.2, 6.8), 2.4) * 0.65;
    colors[i * 3] = color.r * brightness;
    colors[i * 3 + 1] = color.g * brightness;
    colors[i * 3 + 2] = color.b * brightness;

    sizes[i] = 1.2 + Math.pow(hash3(i, 7.7, 1.4), 3.0) * 3.4;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 1.0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: `
      attribute float aSize;
      attribute vec3 color;
      varying vec3 vColor;
      uniform float uPixelRatio;

      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      uniform float uOpacity;

      void main() {
        vec2 cxy = 2.0 * gl_PointCoord - 1.0;
        float r2 = dot(cxy, cxy);
        if (r2 > 1.0) discard;
        float falloff = exp(-r2 * 3.4);
        gl_FragColor = vec4(vColor, falloff * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return {
    points,
    setExposureFactor(factor: number) {
      material.uniforms.uOpacity.value = THREE.MathUtils.clamp(factor, 0.12, 1.0);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
