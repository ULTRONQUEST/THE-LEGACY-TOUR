import * as THREE from 'three';
import { WORLD_CONSTANTS } from './types';
import { EarthTextureBundle } from './textures';

export class EarthSystem {
  public readonly group = new THREE.Group();
  private surfaceMesh: THREE.Mesh;
  private cloudsMesh: THREE.Mesh;
  private atmosphereMesh: THREE.Mesh;

  private surfaceGeo: THREE.SphereGeometry;
  private cloudGeo: THREE.SphereGeometry;
  private atmoGeo: THREE.SphereGeometry;

  private surfaceMat: THREE.MeshPhongMaterial;
  private cloudMat: THREE.MeshLambertMaterial;
  private atmoMat: THREE.ShaderMaterial;

  constructor(textures: EarthTextureBundle) {
    const R = WORLD_CONSTANTS.EARTH_RADIUS;
    this.group.position.copy(WORLD_CONSTANTS.EARTH_CENTER);

    // Orient Earth so Australia, SE Asia & Pacific Ocean face the orbital camera in Shot 6
    this.group.rotation.set(0.35, -2.15, 0.14);

    this.surfaceGeo = new THREE.SphereGeometry(R, 96, 64);
    this.surfaceMat = new THREE.MeshPhongMaterial({
      map: textures.albedoMap,
      specularMap: textures.specularMap,
      specular: new THREE.Color('#9ec5f0'),
      shininess: 32,
      bumpMap: textures.bumpMap,
      bumpScale: 16,
      fog: false,
    });

    // Inject subtle night city lights on the dark terminator side
    this.surfaceMat.onBeforeCompile = (shader) => {
      shader.uniforms.uNightMap = { value: textures.nightLightsMap };
      shader.uniforms.uSunDir = { value: WORLD_CONSTANTS.SUN_DIRECTION };

      shader.vertexShader =
        'varying vec3 vEarthWorldNormal;\n' +
        shader.vertexShader.replace(
          '#include <worldpos_vertex>',
          `
          #include <worldpos_vertex>
          vEarthWorldNormal = normalize(mat3(modelMatrix) * normal);
          `
        );

      shader.fragmentShader =
        'uniform sampler2D uNightMap;\nuniform vec3 uSunDir;\nvarying vec3 vEarthWorldNormal;\n' +
        shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `
          #include <emissivemap_fragment>
          float sunFacing = dot(normalize(vEarthWorldNormal), normalize(uSunDir));
          float nightMask = smoothstep(0.12, -0.22, sunFacing);
          vec3 cityLights = texture2D(uNightMap, vMapUv).rgb;
          totalEmissiveRadiance += cityLights * nightMask * 0.9;
          `
        );
    };

    this.surfaceMesh = new THREE.Mesh(this.surfaceGeo, this.surfaceMat);
    this.surfaceMesh.receiveShadow = false;
    this.group.add(this.surfaceMesh);

    // Elevated swirling cloud sphere
    this.cloudGeo = new THREE.SphereGeometry(R * 1.007, 96, 64);
    this.cloudMat = new THREE.MeshLambertMaterial({
      map: textures.cloudMap,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      fog: false,
    });
    this.cloudsMesh = new THREE.Mesh(this.cloudGeo, this.cloudMat);
    this.group.add(this.cloudsMesh);

    // Glowing Rayleigh atmospheric limb rim (matches EARTH_3-D_IMAGE_042d9e1f.png)
    this.atmoGeo = new THREE.SphereGeometry(R * 1.045, 96, 64);
    this.atmoMat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: WORLD_CONSTANTS.SUN_DIRECTION },
        uIntensity: { value: 1.0 },
      },
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        uniform vec3 uSunDir;
        uniform float uIntensity;

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec3 normal = normalize(vWorldNormal);
          // BackSide sphere: viewDir aligns opposite normal on grazing rim
          float rim = pow(clamp(1.0 + dot(viewDir, normal), 0.0, 1.0), 3.4);
          float sunLit = smoothstep(-0.35, 0.55, dot(normal, normalize(uSunDir)));
          vec3 dayRim = vec3(0.22, 0.58, 1.0);
          vec3 twilightRim = vec3(0.08, 0.24, 0.55);
          vec3 col = mix(twilightRim, dayRim, sunLit);
          float alpha = rim * (0.2 + 0.85 * sunLit) * uIntensity;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.atmosphereMesh = new THREE.Mesh(this.atmoGeo, this.atmoMat);
    this.group.add(this.atmosphereMesh);
  }

  public update(elapsedTime: number, visibility: number): void {
    // Slow, majestic planetary rotation + differential cloud drift
    this.surfaceMesh.rotation.y = elapsedTime * 0.012;
    this.cloudsMesh.rotation.y = elapsedTime * 0.0155;
    this.atmoMat.uniforms.uIntensity.value = visibility;
    this.group.visible = visibility > 0.01;
  }

  public dispose(): void {
    this.surfaceGeo.dispose();
    this.cloudGeo.dispose();
    this.atmoGeo.dispose();
    this.surfaceMat.dispose();
    this.cloudMat.dispose();
    this.atmoMat.dispose();
  }
}
