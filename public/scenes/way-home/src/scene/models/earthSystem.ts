import * as THREE from 'three';
import { EarthTextureSet } from '../textures';

export interface EarthSystemResult {
  group: THREE.Group;
  earthMesh: THREE.Mesh;
  cloudsMesh: THREE.Mesh;
  atmosphereMesh: THREE.Mesh;
  sunGroup: THREE.Group;
  update: (elapsed: number, sunWorldDir: THREE.Vector3) => void;
}

export function createEarthSystem(
  textures: EarthTextureSet,
  glowTex: THREE.CanvasTexture,
  radius = 36,
): EarthSystemResult {
  const group = new THREE.Group();
  group.name = 'EarthSystem';

  // Tilt Earth realistically (~23.4 deg) and orient Australia/SE Asia/Pacific visible on approach
  const earthTiltGroup = new THREE.Group();
  earthTiltGroup.rotation.z = THREE.MathUtils.degToRad(18);
  earthTiltGroup.rotation.x = THREE.MathUtils.degToRad(12);
  group.add(earthTiltGroup);

  const surfaceUniforms = {
    uDayMap: { value: textures.dayMap },
    uNightMap: { value: textures.nightMap },
    uSpecMap: { value: textures.specularMap },
    uBumpMap: { value: textures.bumpMap },
    uCloudsMap: { value: textures.cloudsMap },
    uSunDir: { value: new THREE.Vector3(0.65, 0.35, 0.68).normalize() },
    uCloudOffset: { value: 0.0 },
  };

  const earthGeo = new THREE.SphereGeometry(radius, 96, 72);
  const earthMat = new THREE.ShaderMaterial({
    uniforms: surfaceUniforms,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uDayMap;
      uniform sampler2D uNightMap;
      uniform sampler2D uSpecMap;
      uniform sampler2D uBumpMap;
      uniform sampler2D uCloudsMap;
      uniform vec3 uSunDir;
      uniform float uCloudOffset;

      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uSunDir);
        vec3 V = normalize(cameraPosition - vWorldPos);

        // Subtle bump perturbation from elevation map
        vec2 texel = vec2(1.0 / 2048.0, 1.0 / 1024.0);
        float hL = texture2D(uBumpMap, vUv - vec2(texel.x, 0.0)).r;
        float hR = texture2D(uBumpMap, vUv + vec2(texel.x, 0.0)).r;
        float hD = texture2D(uBumpMap, vUv - vec2(0.0, texel.y)).r;
        float hU = texture2D(uBumpMap, vUv + vec2(0.0, texel.y)).r;
        vec3 up = abs(N.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        vec3 T = normalize(cross(up, N));
        vec3 B = cross(N, T);
        vec3 bumpedN = normalize(N + (T * (hL - hR) + B * (hD - hU)) * 2.2);

        float ndotlRaw = dot(N, L);
        float ndotl = dot(bumpedN, L);

        // Smooth terminator illumination
        float dayFactor = smoothstep(-0.08, 0.16, ndotlRaw);
        float diffuse = max(0.0, ndotl);
        float softFill = 0.018; // Very subtle cosmic starlight fill on night side

        vec3 dayTex = texture2D(uDayMap, vUv).rgb;
        vec3 nightTex = texture2D(uNightMap, vUv).rgb;
        float specMask = texture2D(uSpecMap, vUv).r;

        // Cloud shadow approximation on surface
        vec2 cloudUv = vec2(fract(vUv.x + uCloudOffset), vUv.y);
        float cloudDensity = texture2D(uCloudsMap, cloudUv).a;
        float cloudShadow = 1.0 - cloudDensity * 0.36;

        // Ocean solar specular glint (Blinn-Phong)
        vec3 H = normalize(L + V);
        float specAngle = max(0.0, dot(N, H));
        float specPower = mix(24.0, 88.0, specMask);
        float specular = pow(specAngle, specPower) * specMask * 0.62 * dayFactor * cloudShadow;

        // Rayleigh atmospheric scattering tint near limb & terminator
        float fresnel = pow(1.0 - max(0.0, dot(N, V)), 3.2);
        vec3 atmoDay = vec3(0.24, 0.56, 0.98) * fresnel * (0.38 + 0.62 * dayFactor);

        // Warm golden-amber sunset scattering band right at the twilight terminator
        float twilight = exp(-pow((ndotlRaw - 0.015) * 9.0, 2.0));
        vec3 sunsetGlow = vec3(0.92, 0.42, 0.16) * twilight * (0.28 + 0.35 * fresnel);

        // Day side lit earth
        vec3 dayColor = dayTex * (diffuse * 1.18 * cloudShadow + softFill)
                      + vec3(1.0, 0.97, 0.92) * specular
                      + sunsetGlow * 0.45;

        // Night side with warm city lights emerging cleanly in darkness
        float nightFactor = smoothstep(0.06, -0.14, ndotlRaw);
        vec3 nightBase = dayTex * 0.022;
        vec3 cityGlow = nightTex * nightFactor * (1.0 - cloudDensity * 0.55) * 1.55;

        vec3 finalColor = mix(nightBase + cityGlow, dayColor, dayFactor) + atmoDay;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });

  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  earthTiltGroup.add(earthMesh);

  // Cloud Layer Sphere
  const cloudsGeo = new THREE.SphereGeometry(radius * 1.0085, 84, 64);
  const cloudsUniforms = {
    uCloudsMap: { value: textures.cloudsMap },
    uSunDir: { value: surfaceUniforms.uSunDir.value },
    uCloudOffset: { value: 0.0 },
  };
  const cloudsMat = new THREE.ShaderMaterial({
    uniforms: cloudsUniforms,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uCloudsMap;
      uniform vec3 uSunDir;
      uniform float uCloudOffset;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      void main() {
        vec2 cuv = vec2(fract(vUv.x + uCloudOffset), vUv.y);
        vec4 c = texture2D(uCloudsMap, cuv);
        float ndotl = dot(normalize(vWorldNormal), normalize(uSunDir));
        float lit = smoothstep(-0.14, 0.25, ndotl);
        float twilight = exp(-pow((ndotl + 0.02) * 8.0, 2.0));
        vec3 col = c.rgb * mix(0.035, 1.08, lit) + vec3(0.75, 0.36, 0.18) * twilight * 0.28;
        gl_FragColor = vec4(col, c.a * 0.92);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
  earthTiltGroup.add(cloudsMesh);

  // Outer Atmospheric Limb Glow (Rayleigh Halo matching EARTH_VIEW_39c5af0f.png)
  const atmoGeo = new THREE.SphereGeometry(radius * 1.045, 72, 56);
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: surfaceUniforms.uSunDir.value },
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
      uniform vec3 uSunDir;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // BackSide sphere rim calculation
        float rim = clamp(0.68 - dot(-N, V), 0.0, 1.0);
        float glow = pow(rim, 3.6);
        float sunSide = smoothstep(-0.25, 0.45, dot(N, L));
        vec3 dayGlow = vec3(0.22, 0.62, 1.0);
        vec3 twilightTint = vec3(0.85, 0.45, 0.22) * exp(-pow(dot(N, L) * 5.0, 2.0)) * 0.35;
        vec3 col = dayGlow * sunSide + twilightTint;
        gl_FragColor = vec4(col, glow * (0.25 + 0.85 * sunSide));
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const atmosphereMesh = new THREE.Mesh(atmoGeo, atmoMat);
  earthTiltGroup.add(atmosphereMesh);

  // Distant Sun Visual Group (for Shot 7 dramatic angle)
  const sunGroup = new THREE.Group();
  const sunCore = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xfff8eb,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sunCore.scale.set(28, 28, 1);
  sunGroup.add(sunCore);

  const sunHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffd59e,
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sunHalo.scale.set(95, 95, 1);
  sunGroup.add(sunHalo);

  const update = (elapsed: number, sunWorldDir: THREE.Vector3) => {
    surfaceUniforms.uSunDir.value.copy(sunWorldDir).normalize();
    // Subtle slow planetary rotation & faster cloud drift
    earthMesh.rotation.y = -2.35 + elapsed * 0.0085;
    cloudsMesh.rotation.y = -2.35 + elapsed * 0.011;
    const cloudDrift = elapsed * 0.0018;
    surfaceUniforms.uCloudOffset.value = cloudDrift;
    cloudsUniforms.uCloudOffset.value = cloudDrift;
  };

  return { group, earthMesh, cloudsMesh, atmosphereMesh, sunGroup, update };
}
