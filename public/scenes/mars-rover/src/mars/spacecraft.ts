import * as THREE from 'three';
import { MarsTextureSet } from './textures';

export interface SpacecraftHandle {
  group: THREE.Group;
  setThrust: (intensity: number, time: number) => void;
}

/**
 * Composite 11-part Interplanetary Transit Spacecraft
 * Departs lunar orbit (Shot 1) and enters cruise toward Mars.
 */
export function createSpacecraft(textures: MarsTextureSet): SpacecraftHandle {
  const group = new THREE.Group();
  group.name = 'InterplanetaryTransitSpacecraft';

  // Calibrated aerospace PBR materials
  const hullWhite = new THREE.MeshStandardMaterial({
    color: 0xe6e7ea,
    roughness: 0.42,
    metalness: 0.18,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x6f7680,
    roughness: 0.28,
    metalness: 0.88,
  });

  const darkAlloyMat = new THREE.MeshStandardMaterial({
    color: 0x262930,
    roughness: 0.35,
    metalness: 0.82,
  });

  const kaptonGoldMat = new THREE.MeshPhysicalMaterial({
    color: 0xd99b26,
    metalness: 0.94,
    roughness: 0.24,
    bumpMap: textures.kaptonTex,
    bumpScale: 0.015,
    anisotropy: 0.65,
    clearcoat: 0.2,
  });

  const solarWingMat = new THREE.MeshStandardMaterial({
    map: textures.solarCellTex,
    roughness: 0.28,
    metalness: 0.55,
  });

  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0x162238,
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: 1.0,
    ior: 1.55,
  });

  // 1. Forward Docking Ring & Navigation Nose Cone (+Z is forward flight direction)
  const noseGeo = new THREE.CylinderGeometry(0.28, 0.55, 0.55, 24);
  noseGeo.rotateX(Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, titaniumMat);
  nose.position.z = 2.05;
  group.add(nose);

  const dockCollarGeo = new THREE.TorusGeometry(0.29, 0.04, 12, 24);
  const dockCollar = new THREE.Mesh(dockCollarGeo, darkAlloyMat);
  dockCollar.position.z = 2.33;
  group.add(dockCollar);

  // 2. Crew Transit Habitat Cylinder
  const habGeo = new THREE.CylinderGeometry(0.62, 0.62, 1.5, 32);
  habGeo.rotateX(Math.PI / 2);
  const habitat = new THREE.Mesh(habGeo, hullWhite);
  habitat.position.z = 1.05;
  habitat.castShadow = true;
  habitat.receiveShadow = true;
  group.add(habitat);

  // 3. Structural Pressure Rings along Habitat
  const ringGeo = new THREE.TorusGeometry(0.635, 0.024, 10, 32);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(ringGeo, titaniumMat);
    ring.position.z = 0.52 + i * 0.52;
    group.add(ring);
  }

  // 4. Optical Cupola / Star Tracker Sensor Pod
  const sensorBase = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.36), darkAlloyMat);
  sensorBase.position.set(0, 0.64, 1.42);
  group.add(sensorBase);

  const sensorLensGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16);
  sensorLensGeo.rotateX(Math.PI / 2);
  const sensorLens = new THREE.Mesh(sensorLensGeo, lensMat);
  sensorLens.position.set(0, 0.65, 1.62);
  group.add(sensorLens);

  // 5. Aft Gold Kapton Propulsion & Avionics Bus
  const busGeo = new THREE.CylinderGeometry(0.56, 0.50, 1.35, 24);
  busGeo.rotateX(Math.PI / 2);
  const serviceBus = new THREE.Mesh(busGeo, kaptonGoldMat);
  serviceBus.position.z = -0.38;
  serviceBus.castShadow = true;
  group.add(serviceBus);

  // 6. Structural Truss Adapter between Habitat & Service Bus
  const adapterGeo = new THREE.CylinderGeometry(0.60, 0.58, 0.24, 24);
  adapterGeo.rotateX(Math.PI / 2);
  const adapter = new THREE.Mesh(adapterGeo, darkAlloyMat);
  adapter.position.z = 0.28;
  group.add(adapter);

  // 7. Twin Deployable Solar Array Wings + Trusses
  const wingGeo = new THREE.BoxGeometry(2.65, 0.03, 0.85);
  const trussGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8);
  trussGeo.rotateZ(Math.PI / 2);

  [-1, 1].forEach((side) => {
    const truss = new THREE.Mesh(trussGeo, titaniumMat);
    truss.position.set(side * 0.72, 0, -0.15);
    group.add(truss);

    const wing = new THREE.Mesh(wingGeo, solarWingMat);
    wing.position.set(side * 2.18, 0, -0.15);
    wing.rotation.x = 0.18;
    wing.castShadow = true;
    group.add(wing);
  });

  // 8. Thermal Radiator Panels (Vertical)
  const radGeo = new THREE.BoxGeometry(0.025, 0.95, 0.68);
  [-1, 1].forEach((side) => {
    const rad = new THREE.Mesh(radGeo, hullWhite);
    rad.position.set(0, side * 0.88, -0.45);
    group.add(rad);
  });

  // 9. Four RCS Attitude Thruster Quads
  const rcsPodGeo = new THREE.BoxGeometry(0.14, 0.14, 0.22);
  [
    [0.54, 0.54],
    [-0.54, 0.54],
    [0.54, -0.54],
    [-0.54, -0.54],
  ].forEach(([x, y]) => {
    const pod = new THREE.Mesh(rcsPodGeo, titaniumMat);
    pod.position.set(x, y, -0.86);
    group.add(pod);
  });

  // 10. Main Propulsion Bell Nozzle (LatheGeometry)
  const bellPoints = [
    new THREE.Vector2(0.12, 0.0),
    new THREE.Vector2(0.18, -0.12),
    new THREE.Vector2(0.32, -0.36),
    new THREE.Vector2(0.41, -0.62),
  ];
  const bellGeo = new THREE.LatheGeometry(bellPoints, 28);
  bellGeo.rotateX(Math.PI / 2);
  const nozzle = new THREE.Mesh(bellGeo, darkAlloyMat);
  nozzle.position.z = -1.04;
  group.add(nozzle);

  // 11. Subtle Animated Ion/Cryo Exhaust Plume Shader
  const plumeUniforms = {
    uTime: { value: 0 },
    uThrust: { value: 0.25 },
  };
  const plumeMat = new THREE.ShaderMaterial({
    uniforms: plumeUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uThrust;
      varying vec2 vUv;
      void main() {
        // vUv.y goes 0 (tip) -> 1 (nozzle throat)
        float along = vUv.y;
        float core = pow(along, 1.8);
        float flicker = 0.88 + 0.12 * sin(uTime * 38.0 + along * 14.0);
        float radial = 1.0 - abs(vUv.x - 0.5) * 2.0;
        radial = smoothstep(0.0, 0.85, radial);
        vec3 innerCol = vec3(0.95, 0.88, 0.72);
        vec3 outerCol = vec3(0.35, 0.62, 1.0);
        vec3 col = mix(outerCol, innerCol, pow(along, 2.2));
        float alpha = core * radial * flicker * uThrust * 0.92;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const plumeGeo = new THREE.ConeGeometry(0.36, 3.2, 24, 1, true);
  plumeGeo.rotateX(-Math.PI / 2);
  plumeGeo.translate(0, 0, -1.6);
  const plume = new THREE.Mesh(plumeGeo, plumeMat);
  plume.position.z = -1.52;
  group.add(plume);

  // Subtle engine point light for hull bounce during burn
  const engineLight = new THREE.PointLight(0x9bc4ff, 0.6, 12, 2);
  engineLight.position.set(0, 0, -1.9);
  group.add(engineLight);

  return {
    group,
    setThrust(intensity: number, time: number) {
      const clamped = Math.max(0.05, Math.min(1.4, intensity));
      plumeUniforms.uTime.value = time;
      plumeUniforms.uThrust.value = clamped;
      plume.scale.set(0.85 + clamped * 0.35, 0.85 + clamped * 0.35, 0.5 + clamped * 1.15);
      engineLight.intensity = clamped * 2.2;
    },
  };
}
