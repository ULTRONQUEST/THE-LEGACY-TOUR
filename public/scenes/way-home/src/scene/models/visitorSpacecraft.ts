import * as THREE from 'three';

export interface VisitorSpacecraftResult {
  group: THREE.Group;
  thrusterPlume: THREE.Mesh;
  thrusterLight: THREE.PointLight;
  setThrusterPower: (power: number, elapsed: number) => void;
}

export function createVisitorSpacecraft(
  foilBumpTex: THREE.CanvasTexture,
  solarTex: THREE.CanvasTexture,
  glowTex: THREE.CanvasTexture,
): VisitorSpacecraftResult {
  const group = new THREE.Group();
  group.name = 'VisitorSpacecraft';

  // Calibrated aerospace PBR materials (varied roughness/metalness across adjacent parts)
  const ceramicWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xe2e7ee,
    roughness: 0.45,
    metalness: 0.08,
  });

  const titaniumMat = new THREE.MeshPhysicalMaterial({
    color: 0x9aa6b5,
    roughness: 0.24,
    metalness: 0.9,
    anisotropy: 0.7,
  });

  const darkCompositeMat = new THREE.MeshStandardMaterial({
    color: 0x1b212c,
    roughness: 0.68,
    metalness: 0.3,
  });

  const goldFoilMat = new THREE.MeshPhysicalMaterial({
    color: 0xd9a12e,
    roughness: 0.26,
    metalness: 0.92,
    bumpMap: foilBumpTex,
    bumpScale: 0.03,
    anisotropy: 0.65,
  });

  const solarWingMat = new THREE.MeshPhysicalMaterial({
    map: solarTex,
    roughness: 0.2,
    metalness: 0.55,
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
  });

  const sensorGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x4da8da,
    roughness: 0.08,
    metalness: 0.15,
    clearcoat: 1.0,
    emissive: 0x0b253a,
    emissiveIntensity: 0.5,
  });

  // Note: Spacecraft forward direction is +Z (nose at +Z, thruster at -Z)
  // 1. Primary Sculpted Nose Cone & Command Hull (LatheGeometry rotated along Z)
  const hullProfile: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 2.35),
    new THREE.Vector2(0.26, 2.18),
    new THREE.Vector2(0.56, 1.65),
    new THREE.Vector2(0.76, 0.95),
    new THREE.Vector2(0.84, 0.35),
    new THREE.Vector2(0.84, -0.35),
    new THREE.Vector2(0.72, -0.95),
    new THREE.Vector2(0.54, -1.55),
    new THREE.Vector2(0.0, -1.55),
  ];
  const noseGeo = new THREE.LatheGeometry(hullProfile, 32);
  noseGeo.rotateX(Math.PI / 2);
  const mainHull = new THREE.Mesh(noseGeo, ceramicWhiteMat);
  mainHull.castShadow = true;
  mainHull.receiveShadow = true;
  group.add(mainHull);

  // 2. Forward Optical Sensor Turret & Viewport Canopy
  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.44, 0.52, 16),
    darkCompositeMat,
  );
  canopy.rotation.x = Math.PI / 2;
  canopy.position.set(0, 0.36, 1.12);
  group.add(canopy);

  const opticalLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
    sensorGlassMat,
  );
  opticalLens.rotation.x = Math.PI / 2;
  opticalLens.position.set(0, 0.36, 1.35);
  group.add(opticalLens);

  // 3. Gold Kapton MLI Thermal Blanket Midsection Collar
  const foilMid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.865, 0.865, 0.92, 16),
    goldFoilMat,
  );
  foilMid.rotation.x = Math.PI / 2;
  foilMid.position.z = -0.15;
  group.add(foilMid);

  // 4. Titanium Structural Spine & Dorsal Fairing
  const spineShape = new THREE.Shape();
  spineShape.moveTo(-0.18, 0);
  spineShape.lineTo(0.18, 0);
  spineShape.lineTo(0.11, 0.28);
  spineShape.lineTo(-0.11, 0.28);
  spineShape.closePath();

  const spineGeo = new THREE.ExtrudeGeometry(spineShape, {
    depth: 2.2,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  const dorsalSpine = new THREE.Mesh(spineGeo, titaniumMat);
  dorsalSpine.position.set(0, 0.72, -1.25);
  group.add(dorsalSpine);

  // 5. Dorsal High-Gain Dish Antenna
  const dishPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const r = t * 0.48;
    dishPts.push(new THREE.Vector2(r, 0.35 * r * r));
  }
  const smallDish = new THREE.Mesh(new THREE.LatheGeometry(dishPts, 28), ceramicWhiteMat);
  smallDish.position.set(0, 1.15, -0.35);
  smallDish.rotation.x = -0.35;
  group.add(smallDish);

  const dishMast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 12), titaniumMat);
  dishMast.position.set(0, 1.0, -0.35);
  group.add(dishMast);

  // 6. Twin Articulated Deep-Space Solar / Radiator Wings
  for (const side of [-1, 1]) {
    const wingPivot = new THREE.Group();
    wingPivot.position.set(side * 0.86, 0.0, -0.2);

    // Titanium gimbal yoke
    const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.55, 12), titaniumMat);
    yoke.rotation.z = Math.PI / 2;
    yoke.position.x = side * 0.28;
    wingPivot.add(yoke);

    // Dual wing panels per side
    for (const p of [0, 1]) {
      const panelFrame = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.04, 1.02),
        darkCompositeMat,
      );
      panelFrame.position.set(side * (1.3 + p * 1.62), 0, 0);
      panelFrame.castShadow = true;
      wingPivot.add(panelFrame);

      const panelCells = new THREE.Mesh(
        new THREE.BoxGeometry(1.48, 0.046, 0.94),
        solarWingMat,
      );
      panelCells.position.copy(panelFrame.position);
      wingPivot.add(panelCells);
    }

    // Subtle wingtip titanium caps
    const tipCap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.04), titaniumMat);
    tipCap.position.set(side * 3.72, 0, 0);
    wingPivot.add(tipCap);

    group.add(wingPivot);
  }

  // 7. Aft Propulsion Ring & Gimbaled Xenon Ion Thruster Bell
  const aftRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.075, 12, 28), titaniumMat);
  aftRing.position.z = -1.52;
  group.add(aftRing);

  const nozzlePts: THREE.Vector2[] = [
    new THREE.Vector2(0.28, 0.0),
    new THREE.Vector2(0.22, -0.18),
    new THREE.Vector2(0.36, -0.52),
    new THREE.Vector2(0.42, -0.7),
  ];
  const nozzleGeo = new THREE.LatheGeometry(nozzlePts, 28);
  nozzleGeo.rotateX(Math.PI / 2);
  const nozzle = new THREE.Mesh(nozzleGeo, darkCompositeMat);
  nozzle.position.z = -1.52;
  group.add(nozzle);

  // Ion thruster core glow ring inside nozzle
  const ionCore = new THREE.Mesh(
    new THREE.CircleGeometry(0.24, 24),
    new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    }),
  );
  ionCore.position.z = -1.88;
  group.add(ionCore);

  // Restrained, realistic pale-blue Xenon Ion Plume cone
  const plumeGeo = new THREE.ConeGeometry(0.34, 2.6, 24, 1, true);
  plumeGeo.translate(0, -1.3, 0);
  plumeGeo.rotateX(-Math.PI / 2);
  const plumeMat = new THREE.ShaderMaterial({
    uniforms: {
      uPower: { value: 0.7 },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x6ecbff) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uPower;
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float axial = pow(vUv.y, 1.85);
        float flicker = 0.94 + 0.06 * sin(uTime * 18.0 + vUv.y * 12.0);
        float alpha = axial * 0.42 * uPower * flicker;
        vec3 col = mix(uColor, vec3(0.92, 0.97, 1.0), pow(vUv.y, 3.0));
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const thrusterPlume = new THREE.Mesh(plumeGeo, plumeMat);
  thrusterPlume.position.z = -2.18;
  group.add(thrusterPlume);

  // Subtle thruster halo sprite
  const haloSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  haloSprite.scale.set(1.4, 1.4, 1);
  haloSprite.position.z = -2.2;
  group.add(haloSprite);

  const thrusterLight = new THREE.PointLight(0x60b8ff, 0.8, 9, 2);
  thrusterLight.position.z = -2.3;
  group.add(thrusterLight);

  const setThrusterPower = (power: number, elapsed: number) => {
    const p = THREE.MathUtils.clamp(power, 0, 1.2);
    plumeMat.uniforms.uPower.value = p;
    plumeMat.uniforms.uTime.value = elapsed;
    thrusterPlume.scale.set(0.85 + p * 0.25, 0.85 + p * 0.25, 0.4 + p * 0.8);
    haloSprite.material.opacity = 0.35 * p;
    thrusterLight.intensity = 0.7 * p;
    (ionCore.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.65 * p;
  };

  return { group, thrusterPlume, thrusterLight, setThrusterPower };
}
