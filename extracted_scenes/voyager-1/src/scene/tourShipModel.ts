import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';

export interface TourShipHandle {
  group: THREE.Group;
  setThrustIntensity: (intensity: number, time: number) => void;
  setSpotlightIntensity: (intensity: number) => void;
  spotLight: THREE.SpotLight;
  dispose: () => void;
}

export function createTourShipModel(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean
): TourShipHandle {
  const root = new THREE.Group();
  root.name = 'TourSpacecraft';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // --- Materials ---
  const hullCompositeMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.tourHullMap,
      bumpMap: textures.tourHullBump,
      bumpScale: 0.014,
      color: 0xdbe2ee,
      roughness: 0.42,
      metalness: 0.28,
    })
  );

  const titaniumTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x7b8599,
      roughness: 0.26,
      metalness: 0.88,
    })
  );

  const darkCarbonArmorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x161a24,
      roughness: 0.68,
      metalness: 0.38,
    })
  );

  const radiatorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x202737,
      roughness: 0.55,
      metalness: 0.55,
    })
  );

  const windowStripMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1a2233,
      emissive: 0xffc78a,
      emissiveMap: textures.tourWindowEmissive,
      emissiveIntensity: 0.9,
      roughness: 0.14,
      metalness: 0.2,
    })
  );

  const cupolaGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x8cb8ff,
      roughness: 0.06,
      metalness: 0.08,
      transmission: isSoftwareGl ? 0 : 0.72,
      transparent: true,
      opacity: isSoftwareGl ? 0.55 : 1,
      ior: 1.52,
      clearcoat: 1.0,
      emissive: 0x3b4d70,
      emissiveIntensity: 0.25,
    })
  );

  const thrusterCoreMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x86c8ff,
      transparent: true,
      opacity: 0.75,
    })
  );

  const thrusterPlumeMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x5aa8ff,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );

  // =========================================================================
  // Orientation: Ship nose points along -Z (forward flight direction)
  // Total length: ~14.6 meters (distinctly larger than Voyager's 1.78m bus)
  // =========================================================================

  // 1. Sculpted Forward Observation Nose Cone & Panoramic Cupola (-Z forward)
  const nosePts = [
    new THREE.Vector2(0.0, 3.1),
    new THREE.Vector2(0.45, 2.95),
    new THREE.Vector2(1.05, 2.35),
    new THREE.Vector2(1.48, 1.3),
    new THREE.Vector2(1.62, 0.0),
  ];
  const noseGeo = trackGeo(new THREE.LatheGeometry(nosePts, 40));
  // Lathe revolves around +Y; rotate -90 deg on X so +Y -> -Z (forward)
  noseGeo.rotateX(-Math.PI / 2);
  const noseMesh = new THREE.Mesh(noseGeo, hullCompositeMat);
  noseMesh.position.z = -3.4;
  noseMesh.castShadow = true;
  noseMesh.receiveShadow = true;
  root.add(noseMesh);

  // Forward panoramic observation cupola dome embedded on top-forward fairing
  const cupolaGeo = trackGeo(new THREE.SphereGeometry(0.92, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.52));
  const cupola = new THREE.Mesh(cupolaGeo, cupolaGlassMat);
  cupola.position.set(0, 0.85, -4.25);
  cupola.rotation.x = -0.35;
  cupola.scale.set(1.08, 0.62, 1.45);
  root.add(cupola);

  // Cupola titanium framing ring
  const cupolaFrameGeo = trackGeo(new THREE.TorusGeometry(0.92, 0.055, 10, 36));
  const cupolaFrame = new THREE.Mesh(cupolaFrameGeo, titaniumTrimMat);
  cupolaFrame.position.set(0, 0.82, -4.25);
  cupolaFrame.rotation.x = Math.PI / 2 - 0.35;
  cupolaFrame.scale.set(1.08, 1.45, 1);
  root.add(cupolaFrame);

  // 2. Main Pressurized Observation & Habitat Hull (-3.4 to +2.8)
  const mainHullGeo = trackGeo(new THREE.CylinderGeometry(1.64, 1.72, 6.2, 36));
  mainHullGeo.rotateX(Math.PI / 2);
  const mainHull = new THREE.Mesh(mainHullGeo, hullCompositeMat);
  mainHull.position.z = -0.3;
  mainHull.castShadow = true;
  mainHull.receiveShadow = true;
  root.add(mainHull);

  // Titanium structural bulkhead rings along main hull
  const ringGeo = trackGeo(new THREE.TorusGeometry(1.68, 0.065, 12, 40));
  [-3.3, -1.2, 0.9, 2.75].forEach((zPos) => {
    const ring = new THREE.Mesh(ringGeo, titaniumTrimMat);
    ring.position.z = zPos;
    root.add(ring);
  });

  // Port & Starboard illuminated panoramic passenger window strips
  const winBandGeo = trackGeo(
    new THREE.CylinderGeometry(1.66, 1.66, 3.6, 32, 1, true, 0.38, 0.52)
  );
  winBandGeo.rotateX(Math.PI / 2);
  const winBandStarboard = new THREE.Mesh(winBandGeo, windowStripMat);
  winBandStarboard.position.z = -0.35;
  winBandStarboard.rotation.z = 0.15;
  root.add(winBandStarboard);

  const winBandPort = new THREE.Mesh(winBandGeo, windowStripMat);
  winBandPort.position.z = -0.35;
  winBandPort.rotation.z = Math.PI + 0.15;
  root.add(winBandPort);

  // Ventral dark carbon heat-shield spine & sensor chin pod
  const bellyShieldGeo = trackGeo(new THREE.BoxGeometry(1.5, 0.45, 7.2));
  const bellyShield = new THREE.Mesh(bellyShieldGeo, darkCarbonArmorMat);
  bellyShield.position.set(0, -1.52, -0.9);
  root.add(bellyShield);

  // Dorsal communications & optical tracking spine
  const spineGeo = trackGeo(new THREE.BoxGeometry(0.68, 0.38, 5.4));
  const spine = new THREE.Mesh(spineGeo, titaniumTrimMat);
  spine.position.set(0, 1.72, 0.1);
  root.add(spine);

  // 3. Aft Engineering Truss & Propulsion Section (+2.8 to +7.8)
  const aftAdapterGeo = trackGeo(new THREE.CylinderGeometry(1.72, 1.18, 1.4, 24));
  aftAdapterGeo.rotateX(Math.PI / 2);
  const aftAdapter = new THREE.Mesh(aftAdapterGeo, darkCarbonArmorMat);
  aftAdapter.position.z = 3.5;
  root.add(aftAdapter);

  // Open aft structural spine truss
  const aftCoreGeo = trackGeo(new THREE.CylinderGeometry(0.75, 0.75, 3.4, 16));
  aftCoreGeo.rotateX(Math.PI / 2);
  const aftCore = new THREE.Mesh(aftCoreGeo, titaniumTrimMat);
  aftCore.position.z = 5.8;
  root.add(aftCore);

  // Twin Deployable Thermal Radiator Wings (left & right)
  const radWingGeo = trackGeo(new THREE.BoxGeometry(2.6, 0.045, 2.2));
  const radStrutGeo = trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 2.9, 8));
  radStrutGeo.rotateZ(Math.PI / 2);

  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(radWingGeo, radiatorMat);
    wing.position.set(side * 2.55, 0.15, 5.3);
    wing.rotation.z = side * 0.12;
    wing.castShadow = true;
    root.add(wing);

    const strut = new THREE.Mesh(radStrutGeo, titaniumTrimMat);
    strut.position.set(side * 2.1, 0.12, 5.3);
    strut.rotation.z = side * 0.12;
    root.add(strut);
  });

  // 4. Twin Shrouded Ion / MPD Thruster Pods & Plumes
  const thrusterCores: THREE.Mesh[] = [];
  const thrusterPlumes: THREE.Mesh[] = [];

  const podGeo = trackGeo(new THREE.CylinderGeometry(0.56, 0.66, 1.65, 24));
  podGeo.rotateX(Math.PI / 2);
  const bellGeo = trackGeo(new THREE.CylinderGeometry(0.46, 0.62, 0.55, 24, 1, true));
  bellGeo.rotateX(Math.PI / 2);
  const coreDiskGeo = trackGeo(new THREE.CircleGeometry(0.42, 24));
  const plumeGeo = trackGeo(new THREE.ConeGeometry(0.44, 3.2, 24, 1, true));
  plumeGeo.rotateX(-Math.PI / 2);

  [-1, 1].forEach((side) => {
    const podGroup = new THREE.Group();
    podGroup.position.set(side * 1.15, -0.18, 6.75);

    const pod = new THREE.Mesh(podGeo, darkCarbonArmorMat);
    podGroup.add(pod);

    const bell = new THREE.Mesh(bellGeo, titaniumTrimMat);
    bell.position.z = 1.05;
    podGroup.add(bell);

    const core = new THREE.Mesh(coreDiskGeo, thrusterCoreMat);
    core.position.z = 1.12;
    podGroup.add(core);
    thrusterCores.push(core);

    const plume = new THREE.Mesh(plumeGeo, thrusterPlumeMat);
    plume.position.z = 2.65;
    podGroup.add(plume);
    thrusterPlumes.push(plume);

    // Connecting pylon to aft core
    const pylonGeo = trackGeo(new THREE.BoxGeometry(0.85, 0.24, 0.9));
    const pylon = new THREE.Mesh(pylonGeo, titaniumTrimMat);
    pylon.position.set(-side * 0.55, 0.1, -0.2);
    podGroup.add(pylon);

    root.add(podGroup);
  });

  // 5. Bow Encounter Spotlight (illuminates Voyager gently during close flyby)
  const spotLight = new THREE.SpotLight(0xeef4ff, 0, 48, Math.PI / 5, 0.65, 1.2);
  spotLight.position.set(0, 0.35, -6.2);
  spotLight.target.position.set(0, 0, -24);
  root.add(spotLight);
  root.add(spotLight.target);

  // Subtle navigation marker lenses (steady documentary running lights)
  const navGeo = trackGeo(new THREE.SphereGeometry(0.05, 10, 10));
  const portNavMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xe25555 }));
  const stbdNavMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x55d68a }));
  const portNav = new THREE.Mesh(navGeo, portNavMat);
  portNav.position.set(-3.82, 0.45, 5.3);
  root.add(portNav);

  const stbdNav = new THREE.Mesh(navGeo, stbdNavMat);
  stbdNav.position.set(3.82, 0.45, 5.3);
  root.add(stbdNav);

  return {
    group: root,
    spotLight,
    setThrustIntensity: (intensity: number, time: number) => {
      const clamped = Math.max(0, Math.min(1, intensity));
      const flicker = 0.95 + Math.sin(time * 24) * 0.05;
      thrusterCoreMat.opacity = clamped * 0.85 * flicker;
      thrusterPlumeMat.opacity = clamped * 0.34 * flicker;
      thrusterPlumes.forEach((p) => {
        p.visible = clamped > 0.02;
        p.scale.set(1, 1, 0.35 + clamped * 0.95);
      });
      thrusterCores.forEach((c) => {
        c.visible = clamped > 0.01;
      });
    },
    setSpotlightIntensity: (intensity: number) => {
      spotLight.intensity = intensity;
    },
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
