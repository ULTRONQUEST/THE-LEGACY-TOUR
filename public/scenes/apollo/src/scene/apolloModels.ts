import * as THREE from 'three';
import { terrainHeightAt } from './lunarTerrain';
import {
  createAmericanFlagTexture,
  createKaptonFoilNormalMap,
  createLMPlaqueTexture,
  createSoftContactShadowTexture,
  createSuitFabricNormalMap,
} from './lunarTextures';

export interface ApolloSceneAssets {
  group: THREE.Group;
  dispose: () => void;
}

export function createApolloSiteAssets(maxAnisotropy: number): ApolloSceneAssets {
  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const kaptonNormal = track(createKaptonFoilNormalMap(maxAnisotropy));
  const suitNormal = track(createSuitFabricNormalMap(maxAnisotropy));
  const flagTex = track(createAmericanFlagTexture(maxAnisotropy));
  const plaqueTex = track(createLMPlaqueTexture(maxAnisotropy));
  const shadowTex = track(createSoftContactShadowTexture());

  // Shared calibrated PBR materials
  const matGoldFoil = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xd99e32,
      metalness: 0.92,
      roughness: 0.26,
      normalMap: kaptonNormal,
      normalScale: new THREE.Vector2(1.2, 1.2),
      anisotropy: 0.5,
      envMapIntensity: 1.25,
    }),
  );

  const matAmberFoil = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xb87620,
      metalness: 0.9,
      roughness: 0.34,
      normalMap: kaptonNormal,
      normalScale: new THREE.Vector2(1.4, 1.4),
      envMapIntensity: 1.15,
    }),
  );

  const matSilverFoil = track(
    new THREE.MeshStandardMaterial({
      color: 0xb8bcc2,
      metalness: 0.88,
      roughness: 0.32,
      normalMap: kaptonNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
    }),
  );

  const matDarkThermal = track(
    new THREE.MeshStandardMaterial({
      color: 0x353942,
      metalness: 0.42,
      roughness: 0.56,
      normalMap: kaptonNormal,
      normalScale: new THREE.Vector2(0.55, 0.55),
    }),
  );

  const matAscentShell = track(
    new THREE.MeshStandardMaterial({
      color: 0x626770,
      metalness: 0.48,
      roughness: 0.48,
    }),
  );

  const matTitaniumStrut = track(
    new THREE.MeshStandardMaterial({
      color: 0xd1b36b,
      metalness: 0.84,
      roughness: 0.3,
    }),
  );

  const matBrushedMetal = track(
    new THREE.MeshStandardMaterial({
      color: 0xc5c9d0,
      metalness: 0.88,
      roughness: 0.26,
    }),
  );

  const matWindowGlass = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x0b0f16,
      metalness: 0.15,
      roughness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    }),
  );

  const matSuitWhite = track(
    new THREE.MeshStandardMaterial({
      color: 0xe6e4de,
      metalness: 0.03,
      roughness: 0.84,
      normalMap: suitNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
    }),
  );

  const matSuitDusty = track(
    new THREE.MeshStandardMaterial({
      color: 0xbcbab4,
      metalness: 0.02,
      roughness: 0.9,
      normalMap: suitNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
    }),
  );

  const matGlovesBoots = track(
    new THREE.MeshStandardMaterial({
      color: 0x525761,
      metalness: 0.08,
      roughness: 0.78,
    }),
  );

  const matGoldVisor = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xd29f3b,
      metalness: 0.96,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 2.1,
    }),
  );

  const matShadowDisc = track(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );

  // =========================================================================
  // 1. APOLLO LUNAR MODULE ("Eagle" — Background Left, matching reference)
  // =========================================================================
  const lmGroup = new THREE.Group();
  const lmX = -4.8;
  const lmZ = -7.5;
  const lmGroundY = terrainHeightAt(lmX, lmZ);
  lmGroup.position.set(lmX, lmGroundY, lmZ);
  lmGroup.rotation.y = 0.34;

  // Octagonal Descent Stage Core (Gold Kapton wrapped)
  const descentGeo = track(new THREE.CylinderGeometry(2.05, 2.08, 1.56, 8));
  descentGeo.rotateY(Math.PI / 8);
  const descentMesh = new THREE.Mesh(descentGeo, matGoldFoil);
  descentMesh.position.y = 1.92;
  descentMesh.castShadow = true;
  descentMesh.receiveShadow = true;
  lmGroup.add(descentMesh);

  // Secondary lower thermal skirt & side equipment bay contrast panels
  const skirtGeo = track(new THREE.CylinderGeometry(2.1, 1.98, 0.36, 8));
  skirtGeo.rotateY(Math.PI / 8);
  const skirtMesh = new THREE.Mesh(skirtGeo, matAmberFoil);
  skirtMesh.position.y = 1.06;
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  lmGroup.add(skirtMesh);

  // Silver foil upper deck collar
  const deckGeo = track(new THREE.CylinderGeometry(2.12, 2.12, 0.14, 8));
  deckGeo.rotateY(Math.PI / 8);
  const deckMesh = new THREE.Mesh(deckGeo, matSilverFoil);
  deckMesh.position.y = 2.74;
  deckMesh.castShadow = true;
  lmGroup.add(deckMesh);

  // Descent Engine Bell (LatheGeometry underneath center)
  const bellPoints = [
    new THREE.Vector2(0.18, 0.95),
    new THREE.Vector2(0.32, 0.8),
    new THREE.Vector2(0.55, 0.45),
    new THREE.Vector2(0.72, 0.12),
    new THREE.Vector2(0.74, 0.0),
  ];
  const bellGeo = track(new THREE.LatheGeometry(bellPoints, 24));
  const bellMesh = new THREE.Mesh(bellGeo, matDarkThermal);
  bellMesh.position.y = 0.34;
  bellMesh.castShadow = true;
  lmGroup.add(bellMesh);

  // "UNITED STATES" Plaque on front-facing descent panel
  const plaqueGeo = track(new THREE.PlaneGeometry(0.92, 0.68));
  const plaqueMat = track(
    new THREE.MeshStandardMaterial({
      map: plaqueTex,
      roughness: 0.48,
      metalness: 0.15,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const plaqueMesh = new THREE.Mesh(plaqueGeo, plaqueMat);
  plaqueMesh.position.set(0.76, 1.96, 1.76);
  plaqueMesh.rotation.y = Math.PI / 8 + 0.02;
  lmGroup.add(plaqueMesh);

  // Helper to build strut cylinder between two 3D points
  const addStrut = (
    parent: THREE.Object3D,
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    radius: number,
    mat: THREE.Material,
  ) => {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    const geo = track(new THREE.CylinderGeometry(radius, radius, len, 10));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(p1).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  };

  // 4 Splayed Landing Gear Legs + Circular Dish Footpads
  const footpadPoints = [
    new THREE.Vector2(0.0, 0.11),
    new THREE.Vector2(0.18, 0.11),
    new THREE.Vector2(0.46, 0.03),
    new THREE.Vector2(0.5, 0.0),
  ];
  const footpadGeo = track(new THREE.LatheGeometry(footpadPoints, 20));
  const legAngles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];

  for (let i = 0; i < legAngles.length; i++) {
    const ang = legAngles[i];
    const sinA = Math.sin(ang);
    const cosA = Math.cos(ang);

    // Local footpad position
    const padLocal = new THREE.Vector3(sinA * 4.15, 0.0, cosA * 4.15);
    // Transform into world XZ to match exact terrain relief under each pad
    const worldCos = Math.cos(lmGroup.rotation.y);
    const worldSin = Math.sin(lmGroup.rotation.y);
    const padWorldX = lmX + padLocal.x * worldCos + padLocal.z * worldSin;
    const padWorldZ = lmZ - padLocal.x * worldSin + padLocal.z * worldCos;
    const padLocalY = terrainHeightAt(padWorldX, padWorldZ) - lmGroundY;

    const padPos = new THREE.Vector3(padLocal.x, padLocalY + 0.02, padLocal.z);
    const padMesh = new THREE.Mesh(footpadGeo, matTitaniumStrut);
    padMesh.position.copy(padPos);
    padMesh.castShadow = true;
    padMesh.receiveShadow = true;
    lmGroup.add(padMesh);

    // Primary telescopic landing leg strut
    const upperOutrigger = new THREE.Vector3(sinA * 2.02, 2.58, cosA * 2.02);
    const lowerJoint = new THREE.Vector3(sinA * 3.15, 1.32, cosA * 3.15);
    addStrut(lmGroup, upperOutrigger, padPos.clone().add(new THREE.Vector3(0, 0.08, 0)), 0.075, matTitaniumStrut);

    // Secondary A-frame side braces from lower octagon ring
    const perpX = cosA;
    const perpZ = -sinA;
    const braceL = new THREE.Vector3(sinA * 1.92 + perpX * 0.72, 1.24, cosA * 1.92 + perpZ * 0.72);
    const braceR = new THREE.Vector3(sinA * 1.92 - perpX * 0.72, 1.24, cosA * 1.92 - perpZ * 0.72);
    addStrut(lmGroup, braceL, lowerJoint, 0.045, matBrushedMetal);
    addStrut(lmGroup, braceR, lowerJoint, 0.045, matBrushedMetal);

    // Diagonal upper drag strut
    const upperMid = new THREE.Vector3(sinA * 2.15, 1.95, cosA * 2.15);
    addStrut(lmGroup, upperMid, lowerJoint, 0.04, matBrushedMetal);

    // Forward Boarding Ladder on front leg (ang === 0, facing +Z)
    if (i === 0) {
      const ladderStart = new THREE.Vector3(0, 2.52, 2.16);
      const ladderEnd = new THREE.Vector3(0, padLocalY + 0.35, 3.85);
      const ladderDir = new THREE.Vector3().subVectors(ladderEnd, ladderStart);
      const ladderLen = ladderDir.length();
      const ladderUnit = ladderDir.clone().normalize();

      // Side rails
      addStrut(
        lmGroup,
        ladderStart.clone().add(new THREE.Vector3(-0.18, 0, 0)),
        ladderEnd.clone().add(new THREE.Vector3(-0.18, 0, 0)),
        0.022,
        matBrushedMetal,
      );
      addStrut(
        lmGroup,
        ladderStart.clone().add(new THREE.Vector3(0.18, 0, 0)),
        ladderEnd.clone().add(new THREE.Vector3(0.18, 0, 0)),
        0.022,
        matBrushedMetal,
      );

      // 9 Ladder rungs
      for (let r = 0; r < 9; r++) {
        const frac = (r + 0.5) / 9;
        const center = ladderStart.clone().addScaledVector(ladderUnit, ladderLen * frac);
        addStrut(
          lmGroup,
          center.clone().add(new THREE.Vector3(-0.18, 0, 0)),
          center.clone().add(new THREE.Vector3(0.18, 0, 0)),
          0.014,
          matBrushedMetal,
        );
      }
    }
  }

  // Egress Porch Platform above front ladder
  const porchGeo = track(new THREE.BoxGeometry(0.95, 0.08, 0.65));
  const porchMesh = new THREE.Mesh(porchGeo, matBrushedMetal);
  porchMesh.position.set(0, 2.82, 2.25);
  porchMesh.castShadow = true;
  lmGroup.add(porchMesh);

  // Ascent Stage (asymmetrical dark thermal-shielded crew cabin + equipment bays)
  const ascentGroup = new THREE.Group();
  ascentGroup.position.set(0, 2.82, 0);
  lmGroup.add(ascentGroup);

  // Main horizontal cylindrical crew tunnel/cabin
  const cabinBodyGeo = track(new THREE.CylinderGeometry(1.18, 1.24, 2.35, 10));
  cabinBodyGeo.rotateX(Math.PI / 2);
  const cabinBodyMesh = new THREE.Mesh(cabinBodyGeo, matAscentShell);
  cabinBodyMesh.position.set(0, 1.12, 0.15);
  cabinBodyMesh.castShadow = true;
  cabinBodyMesh.receiveShadow = true;
  ascentGroup.add(cabinBodyMesh);

  // Forward faceted crew face & side helmeted-window cheeks
  const frontFaceGeo = track(new THREE.BoxGeometry(2.08, 1.72, 0.92));
  const frontFaceMesh = new THREE.Mesh(frontFaceGeo, matDarkThermal);
  frontFaceMesh.position.set(0, 1.05, 1.08);
  frontFaceMesh.castShadow = true;
  frontFaceMesh.receiveShadow = true;
  ascentGroup.add(frontFaceMesh);

  // Side cylindrical helium/propellant blister pods on left & right of ascent stage
  const podGeo = track(new THREE.CylinderGeometry(0.58, 0.58, 1.65, 12));
  const podL = new THREE.Mesh(podGeo, matSilverFoil);
  podL.position.set(-1.35, 1.05, -0.05);
  podL.rotation.z = 0.08;
  podL.castShadow = true;
  ascentGroup.add(podL);

  const podR = new THREE.Mesh(podGeo, matDarkThermal);
  podR.position.set(1.35, 1.05, -0.05);
  podR.rotation.z = -0.08;
  podR.castShadow = true;
  ascentGroup.add(podR);

  // Rear ascent equipment bay
  const rearBayGeo = track(new THREE.BoxGeometry(2.15, 1.52, 1.25));
  const rearBayMesh = new THREE.Mesh(rearBayGeo, matDarkThermal);
  rearBayMesh.position.set(0, 1.18, -1.05);
  rearBayMesh.castShadow = true;
  ascentGroup.add(rearBayMesh);

  // Forward crew windows (canted dark glass) & egress hatch
  const winGeo = track(new THREE.PlaneGeometry(0.46, 0.38));
  const winL = new THREE.Mesh(winGeo, matWindowGlass);
  winL.position.set(-0.52, 1.38, 1.55);
  winL.rotation.set(0.22, -0.18, 0);
  ascentGroup.add(winL);

  const winR = new THREE.Mesh(winGeo, matWindowGlass);
  winR.position.set(0.52, 1.38, 1.55);
  winR.rotation.set(0.22, 0.18, 0);
  ascentGroup.add(winR);

  const hatchGeo = track(new THREE.BoxGeometry(0.76, 0.78, 0.12));
  const hatchMesh = new THREE.Mesh(hatchGeo, matSilverFoil);
  hatchMesh.position.set(0, 0.62, 1.56);
  ascentGroup.add(hatchMesh);

  // Overhead docking tunnel
  const dockGeo = track(new THREE.CylinderGeometry(0.46, 0.52, 0.42, 16));
  const dockMesh = new THREE.Mesh(dockGeo, matSilverFoil);
  dockMesh.position.set(0, 2.28, 0.12);
  dockMesh.castShadow = true;
  ascentGroup.add(dockMesh);

  // 4 RCS Thruster Quads on ascent outriggers
  const rcsPodGeo = track(new THREE.BoxGeometry(0.26, 0.28, 0.26));
  const rcsNozzleGeo = track(new THREE.ConeGeometry(0.075, 0.2, 10));
  const rcsOffsets: Array<[number, number]> = [
    [-1.48, 1.18],
    [1.48, 1.18],
    [-1.45, -1.08],
    [1.45, -1.08],
  ];
  for (const [rx, rz] of rcsOffsets) {
    const pod = new THREE.Mesh(rcsPodGeo, matBrushedMetal);
    pod.position.set(rx, 1.35, rz);
    pod.castShadow = true;
    ascentGroup.add(pod);

    const nUp = new THREE.Mesh(rcsNozzleGeo, matDarkThermal);
    nUp.position.set(rx, 1.56, rz);
    ascentGroup.add(nUp);

    const nSide = new THREE.Mesh(rcsNozzleGeo, matDarkThermal);
    nSide.position.set(rx + Math.sign(rx) * 0.18, 1.35, rz);
    nSide.rotation.z = -Math.sign(rx) * (Math.PI / 2);
    ascentGroup.add(nSide);
  }

  // S-Band Steerable Dish Antenna + Rendezvous Radar + Whip Masts
  const dishPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.24, 0.05),
    new THREE.Vector2(0.46, 0.18),
    new THREE.Vector2(0.5, 0.22),
  ];
  const dishGeo = track(new THREE.LatheGeometry(dishPoints, 20));
  const dishMesh = new THREE.Mesh(dishGeo, matBrushedMetal);
  dishMesh.material.side = THREE.DoubleSide;
  dishMesh.position.set(0.68, 2.65, 0.85);
  dishMesh.rotation.set(0.55, 0.35, 0);
  dishMesh.castShadow = true;
  ascentGroup.add(dishMesh);

  addStrut(
    ascentGroup,
    new THREE.Vector3(0.42, 1.92, 0.62),
    new THREE.Vector3(0.68, 2.65, 0.85),
    0.032,
    matBrushedMetal,
  );

  // Rendezvous dish & slender VHF whip masts rising into black sky
  const radarDish = new THREE.Mesh(dishGeo, matSilverFoil);
  radarDish.scale.setScalar(0.68);
  radarDish.position.set(-0.35, 2.52, 0.92);
  radarDish.rotation.set(0.35, -0.25, 0);
  ascentGroup.add(radarDish);

  addStrut(
    ascentGroup,
    new THREE.Vector3(-0.35, 1.92, 0.78),
    new THREE.Vector3(-0.35, 2.52, 0.92),
    0.025,
    matBrushedMetal,
  );
  addStrut(
    ascentGroup,
    new THREE.Vector3(-0.72, 1.92, -0.4),
    new THREE.Vector3(-0.72, 3.85, -0.4),
    0.014,
    matBrushedMetal,
  );
  addStrut(
    ascentGroup,
    new THREE.Vector3(0.55, 1.92, -0.65),
    new THREE.Vector3(0.55, 3.45, -0.65),
    0.012,
    matBrushedMetal,
  );

  // Soft radial contact shadow under Lunar Module
  const lmShadow = new THREE.Mesh(track(new THREE.PlaneGeometry(8.6, 8.6)), matShadowDisc);
  lmShadow.rotation.x = -Math.PI / 2;
  lmShadow.position.y = 0.02;
  lmGroup.add(lmShadow);

  root.add(lmGroup);

  // =========================================================================
  // 2. APOLLO ASTRONAUT BUILDER (A7L EVA Suit, PLSS, Gold Reflective Visor)
  // =========================================================================
  const createAstronaut = (variant: 'foreground' | 'flagbearer') => {
    const astro = new THREE.Group();

    // Overshoes seated at y = 0
    const bootGeo = track(new THREE.BoxGeometry(0.15, 0.12, 0.28));
    const bootL = new THREE.Mesh(bootGeo, matGlovesBoots);
    bootL.position.set(-0.15, 0.06, 0.03);
    bootL.castShadow = true;
    bootL.receiveShadow = true;
    astro.add(bootL);

    const bootR = new THREE.Mesh(bootGeo, matGlovesBoots);
    bootR.position.set(0.15, 0.06, 0.01);
    bootR.castShadow = true;
    bootR.receiveShadow = true;
    astro.add(bootR);

    // Lower legs (dusty Beta cloth) + Knee/Thigh bellows
    const shinGeo = track(new THREE.CylinderGeometry(0.105, 0.092, 0.44, 14));
    const shinL = new THREE.Mesh(shinGeo, matSuitDusty);
    shinL.position.set(-0.15, 0.34, 0.01);
    shinL.rotation.x = -0.04;
    shinL.castShadow = true;
    shinL.receiveShadow = true;
    astro.add(shinL);

    const shinR = new THREE.Mesh(shinGeo, matSuitDusty);
    shinR.position.set(0.15, 0.34, 0.0);
    shinR.rotation.x = -0.02;
    shinR.castShadow = true;
    shinR.receiveShadow = true;
    astro.add(shinR);

    const thighGeo = track(new THREE.CylinderGeometry(0.125, 0.108, 0.4, 14));
    const thighL = new THREE.Mesh(thighGeo, matSuitWhite);
    thighL.position.set(-0.14, 0.72, -0.01);
    thighL.rotation.z = 0.04;
    thighL.castShadow = true;
    thighL.receiveShadow = true;
    astro.add(thighL);

    const thighR = new THREE.Mesh(thighGeo, matSuitWhite);
    thighR.position.set(0.14, 0.72, -0.01);
    thighR.rotation.z = -0.04;
    thighR.castShadow = true;
    thighR.receiveShadow = true;
    astro.add(thighR);

    // Hip / Pelvis assembly
    const pelvisGeo = track(new THREE.CylinderGeometry(0.21, 0.195, 0.24, 16));
    const pelvisMesh = new THREE.Mesh(pelvisGeo, matSuitWhite);
    pelvisMesh.position.set(0, 0.96, -0.01);
    pelvisMesh.scale.set(1.12, 1, 0.86);
    pelvisMesh.castShadow = true;
    pelvisMesh.receiveShadow = true;
    astro.add(pelvisMesh);

    // Upper pressurized torso
    const torsoGeo = track(new THREE.CylinderGeometry(0.24, 0.215, 0.48, 16));
    const torsoMesh = new THREE.Mesh(torsoGeo, matSuitWhite);
    torsoMesh.position.set(0, 1.28, 0);
    torsoMesh.scale.set(1.15, 1, 0.85);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    astro.add(torsoMesh);

    // Chest Remote Control Unit (RCU) + umbilical hoses
    const rcuGeo = track(new THREE.BoxGeometry(0.2, 0.18, 0.11));
    const rcuMesh = new THREE.Mesh(rcuGeo, matBrushedMetal);
    rcuMesh.position.set(0, 1.32, 0.23);
    rcuMesh.castShadow = true;
    astro.add(rcuMesh);

    // Braided oxygen hose from RCU down toward hip
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.07, 1.24, 0.24),
      new THREE.Vector3(-0.22, 1.08, 0.18),
      new THREE.Vector3(-0.21, 1.02, 0.04),
    ]);
    const hoseGeo = track(new THREE.TubeGeometry(hoseCurve, 12, 0.016, 8, false));
    const hoseMesh = new THREE.Mesh(hoseGeo, matGlovesBoots);
    astro.add(hoseMesh);

    // PLSS Backpack + Oxygen Purge System (OPS) + Whip Antenna
    const plssGeo = track(new THREE.BoxGeometry(0.46, 0.64, 0.24));
    const plssMesh = new THREE.Mesh(plssGeo, matSuitWhite);
    plssMesh.position.set(0, 1.36, -0.27);
    plssMesh.castShadow = true;
    plssMesh.receiveShadow = true;
    astro.add(plssMesh);

    const opsGeo = track(new THREE.BoxGeometry(0.42, 0.14, 0.2));
    const opsMesh = new THREE.Mesh(opsGeo, matBrushedMetal);
    opsMesh.position.set(0, 1.74, -0.26);
    opsMesh.castShadow = true;
    astro.add(opsMesh);

    const antGeo = track(new THREE.CylinderGeometry(0.005, 0.008, 0.42, 6));
    const antMesh = new THREE.Mesh(antGeo, matBrushedMetal);
    antMesh.position.set(0.15, 2.0, -0.28);
    astro.add(antMesh);

    // Neck ring + LEVA Helmet + Reflective Gold Sun Visor
    const neckRingGeo = track(new THREE.TorusGeometry(0.145, 0.024, 10, 20));
    neckRingGeo.rotateX(Math.PI / 2);
    const neckRing = new THREE.Mesh(neckRingGeo, matBrushedMetal);
    neckRing.position.set(0, 1.54, 0.01);
    astro.add(neckRing);

    const helmetShellGeo = track(new THREE.SphereGeometry(0.185, 22, 18));
    const helmetShell = new THREE.Mesh(helmetShellGeo, matSuitWhite);
    helmetShell.position.set(0, 1.69, 0.01);
    helmetShell.castShadow = true;
    astro.add(helmetShell);

    // Gold curved visor positioned forward on helmet
    const visorGeo = track(
      new THREE.SphereGeometry(0.172, 24, 18, -Math.PI * 0.38, Math.PI * 0.76, Math.PI * 0.18, Math.PI * 0.62),
    );
    // Rotate so visor open arc faces +Z
    visorGeo.rotateY(-Math.PI / 2);
    const visorMesh = new THREE.Mesh(visorGeo, matGoldVisor);
    visorMesh.position.set(0, 1.69, 0.032);
    astro.add(visorMesh);

    // Articulated arms & EVA gloves
    const upperArmGeo = track(new THREE.CylinderGeometry(0.088, 0.078, 0.3, 12));
    const forearmGeo = track(new THREE.CylinderGeometry(0.076, 0.068, 0.28, 12));
    const gloveGeo = track(new THREE.SphereGeometry(0.068, 10, 10));

    if (variant === 'foreground') {
      // Right arm (viewer's left!) reaching slightly forward-down holding sampling rod
      const rUpper = new THREE.Mesh(upperArmGeo, matSuitWhite);
      rUpper.position.set(-0.31, 1.36, 0.06);
      rUpper.rotation.set(-0.28, 0, -0.22);
      rUpper.castShadow = true;
      astro.add(rUpper);

      const rFore = new THREE.Mesh(forearmGeo, matSuitWhite);
      rFore.position.set(-0.37, 1.12, 0.19);
      rFore.rotation.set(-0.62, 0, -0.05);
      rFore.castShadow = true;
      astro.add(rFore);

      const rGlove = new THREE.Mesh(gloveGeo, matGlovesBoots);
      rGlove.position.set(-0.39, 0.98, 0.28);
      rGlove.scale.set(0.95, 1.2, 1.0);
      rGlove.castShadow = true;
      astro.add(rGlove);

      // Left arm (viewer's right!) bent naturally across waist/front
      const lUpper = new THREE.Mesh(upperArmGeo, matSuitWhite);
      lUpper.position.set(0.31, 1.36, 0.05);
      lUpper.rotation.set(-0.25, 0, 0.25);
      lUpper.castShadow = true;
      astro.add(lUpper);

      const lFore = new THREE.Mesh(forearmGeo, matSuitWhite);
      lFore.position.set(0.32, 1.14, 0.19);
      lFore.rotation.set(-0.85, 0, -0.25);
      lFore.castShadow = true;
      astro.add(lFore);

      const lGlove = new THREE.Mesh(gloveGeo, matGlovesBoots);
      lGlove.position.set(0.25, 1.06, 0.31);
      lGlove.scale.set(0.95, 1.2, 1.0);
      lGlove.castShadow = true;
      astro.add(lGlove);

      // Vertical Lunar Sampling / Gnomon Staff resting on regolith (matches APOLLO_6056b825.jpeg!)
      const staffTop = new THREE.Vector3(-0.39, 1.04, 0.29);
      const staffBottom = new THREE.Vector3(-0.48, 0.0, 0.34);
      addStrut(astro, staffBottom, staffTop, 0.013, matBrushedMetal);
    } else {
      // Flagbearer astronaut: Right arm relaxed, Left arm extended slightly to hold flagpole
      const rUpper = new THREE.Mesh(upperArmGeo, matSuitWhite);
      rUpper.position.set(-0.3, 1.36, 0.02);
      rUpper.rotation.set(-0.1, 0, -0.18);
      rUpper.castShadow = true;
      astro.add(rUpper);

      const rFore = new THREE.Mesh(forearmGeo, matSuitWhite);
      rFore.position.set(-0.33, 1.11, 0.09);
      rFore.rotation.set(-0.35, 0, -0.05);
      rFore.castShadow = true;
      astro.add(rFore);

      const rGlove = new THREE.Mesh(gloveGeo, matGlovesBoots);
      rGlove.position.set(-0.33, 0.96, 0.15);
      rGlove.castShadow = true;
      astro.add(rGlove);

      // Left arm extended out toward the flagpole
      const lUpper = new THREE.Mesh(upperArmGeo, matSuitWhite);
      lUpper.position.set(0.32, 1.38, 0.08);
      lUpper.rotation.set(-0.42, 0, 0.42);
      lUpper.castShadow = true;
      astro.add(lUpper);

      const lFore = new THREE.Mesh(forearmGeo, matSuitWhite);
      lFore.position.set(0.45, 1.26, 0.22);
      lFore.rotation.set(-0.65, 0, 0.65);
      lFore.castShadow = true;
      astro.add(lFore);

      const lGlove = new THREE.Mesh(gloveGeo, matGlovesBoots);
      lGlove.position.set(0.56, 1.24, 0.31);
      lGlove.castShadow = true;
      astro.add(lGlove);
    }

    // Soft radial contact shadow under astronaut boots
    const astroShadow = new THREE.Mesh(track(new THREE.PlaneGeometry(1.15, 1.15)), matShadowDisc);
    astroShadow.rotation.x = -Math.PI / 2;
    astroShadow.position.y = 0.012;
    astro.add(astroShadow);

    return astro;
  };

  // Foreground Astronaut (Center-left, matching APOLLO_6056b825.jpeg)
  const astro1 = createAstronaut('foreground');
  const a1X = -0.35;
  const a1Z = 1.2;
  astro1.position.set(a1X, terrainHeightAt(a1X, a1Z), a1Z);
  astro1.rotation.y = 0.08;
  root.add(astro1);

  // Midground Flagbearer Astronaut (Right-midground, matching APOLLO_6056b825.jpeg)
  const astro2 = createAstronaut('flagbearer');
  const a2X = 1.98;
  const a2Z = -2.7;
  astro2.position.set(a2X, terrainHeightAt(a2X, a2Z), a2Z);
  astro2.rotation.y = -0.18;
  root.add(astro2);

  // =========================================================================
  // 3. AMERICAN FLAG ASSEMBLY (Right of second astronaut)
  // =========================================================================
  const flagGroup = new THREE.Group();
  const flagX = 2.62;
  const flagZ = -2.42;
  flagGroup.position.set(flagX, terrainHeightAt(flagX, flagZ), flagZ);
  flagGroup.rotation.y = -0.12;

  // Vertical telescoping pole
  const poleGeo = track(new THREE.CylinderGeometry(0.016, 0.019, 2.38, 12));
  const poleMesh = new THREE.Mesh(poleGeo, matBrushedMetal);
  poleMesh.position.y = 1.19;
  poleMesh.castShadow = true;
  flagGroup.add(poleMesh);

  // Horizontal telescoping top crossbar
  const barGeo = track(new THREE.CylinderGeometry(0.011, 0.011, 1.48, 10));
  barGeo.rotateZ(Math.PI / 2);
  const barMesh = new THREE.Mesh(barGeo, matBrushedMetal);
  barMesh.position.set(0.74, 2.35, 0);
  barMesh.castShadow = true;
  flagGroup.add(barMesh);

  // Frozen vacuum-rippled flag cloth (stable, never wind-flapping)
  const clothGeo = track(new THREE.PlaneGeometry(1.44, 0.86, 28, 16));
  const clothPos = clothGeo.attributes.position;
  for (let i = 0; i < clothPos.count; i++) {
    const px = clothPos.getX(i); // -0.72 .. +0.72
    const py = clothPos.getY(i); // -0.43 .. +0.43
    const u = (px + 0.72) / 1.44;
    const v = (py + 0.43) / 0.86;
    // Frozen fold amplitude strongest near free right edge, zero along pole & top rod
    const poleMask = Math.sin(u * Math.PI * 0.95);
    const waveZ =
      (Math.sin(u * 10.5 + 0.4) * 0.032 + Math.cos(u * 21.0 - v * 4.5) * 0.014) *
      poleMask;
    const sagY = -0.025 * Math.sin(u * Math.PI) * (1 - v);
    clothPos.setXYZ(i, px, py + sagY, waveZ);
  }
  clothGeo.computeVertexNormals();

  const clothMat = track(
    new THREE.MeshStandardMaterial({
      map: flagTex,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
  );
  const clothMesh = new THREE.Mesh(clothGeo, clothMat);
  clothMesh.position.set(0.74, 1.9, 0);
  clothMesh.castShadow = true;
  clothMesh.receiveShadow = true;
  flagGroup.add(clothMesh);

  root.add(flagGroup);

  return {
    group: root,
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
