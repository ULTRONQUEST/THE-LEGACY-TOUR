import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';

export interface VoyagerModelHandle {
  group: THREE.Group;
  goldenRecordMesh: THREE.Mesh;
  dishCenterLocal: THREE.Vector3;
  goldenRecordLocal: THREE.Vector3;
  scanPlatformLocal: THREE.Vector3;
  dispose: () => void;
}

/**
 * Helper to create an open lattice truss between local origin (0,0,0) and (length, 0, 0)
 * using 3 longitudinal longerons + triangular cross-frames + diagonals.
 */
function buildTriangularTruss(
  length: number,
  radius: number,
  bays: number,
  strutMat: THREE.Material,
  geometriesToDispose: THREE.BufferGeometry[]
): THREE.Group {
  const truss = new THREE.Group();
  const bayLen = length / bays;

  // 3 vertex angles of equilateral triangle
  const corners = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((a) => ({
    y: Math.cos(a) * radius,
    z: Math.sin(a) * radius,
  }));

  // Count total struts: 3 longerons + bays * (3 battens + 3 diagonals) + 3 end battens
  const strutGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
  geometriesToDispose.push(strutGeo);

  const totalInstances = 3 + (bays + 1) * 3 + bays * 3;
  const instanced = new THREE.InstancedMesh(strutGeo, strutMat, totalInstances);
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const aVec = new THREE.Vector3();
  const bVec = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  let idx = 0;

  const placeStrut = (p1: THREE.Vector3, p2: THREE.Vector3, thickness: number) => {
    dir.subVectors(p2, p1);
    const len = dir.length();
    if (len < 1e-5) return;
    mid.addVectors(p1, p2).multiplyScalar(0.5);
    dir.normalize();
    quat.setFromUnitVectors(up, dir);
    dummy.position.copy(mid);
    dummy.quaternion.copy(quat);
    dummy.scale.set(thickness, len, thickness);
    dummy.updateMatrix();
    instanced.setMatrixAt(idx++, dummy.matrix);
  };

  const longeronRadius = Math.max(0.011, radius * 0.085);
  const braceRadius = Math.max(0.007, radius * 0.055);

  // 3 Longerons
  for (let c = 0; c < 3; c++) {
    aVec.set(0, corners[c].y, corners[c].z);
    bVec.set(length, corners[c].y, corners[c].z);
    placeStrut(aVec, bVec, longeronRadius);
  }

  // Cross battens & alternating diagonals
  for (let b = 0; b <= bays; b++) {
    const x = b * bayLen;
    for (let c = 0; c < 3; c++) {
      const next = (c + 1) % 3;
      aVec.set(x, corners[c].y, corners[c].z);
      bVec.set(x, corners[next].y, corners[next].z);
      placeStrut(aVec, bVec, braceRadius);

      if (b < bays) {
        const nextX = (b + 1) * bayLen;
        const diagCorner = b % 2 === 0 ? next : c;
        const startCorner = b % 2 === 0 ? c : next;
        aVec.set(x, corners[startCorner].y, corners[startCorner].z);
        bVec.set(nextX, corners[diagCorner].y, corners[diagCorner].z);
        placeStrut(aVec, bVec, braceRadius * 0.88);
      }
    }
  }

  instanced.count = idx;
  instanced.instanceMatrix.needsUpdate = true;
  instanced.computeBoundingSphere();
  truss.add(instanced);
  return truss;
}

export function createVoyager1Model(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean
): VoyagerModelHandle {
  const root = new THREE.Group();
  root.name = 'Voyager1';

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

  // --- Calibrated Aerospace PBR Materials ---
  const dishMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.dishMap,
      bumpMap: textures.dishBump,
      bumpScale: 0.008,
      color: 0xe6eaf2,
      roughness: 0.56,
      metalness: 0.14,
      side: THREE.DoubleSide,
    })
  );

  const darkCarbonMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1a1e29,
      roughness: 0.62,
      metalness: 0.45,
    })
  );

  const titaniumMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x8e98ab,
      roughness: 0.3,
      metalness: 0.88,
    })
  );

  const blackMliMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.blackMliMap,
      bumpMap: textures.foilBump,
      bumpScale: 0.018,
      color: 0x1e2330,
      roughness: 0.52,
      metalness: 0.35,
    })
  );

  const goldMliMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: textures.goldFoilMap,
      bumpMap: textures.foilBump,
      bumpScale: 0.022,
      color: 0xe0a83e,
      roughness: 0.28,
      metalness: 0.92,
      clearcoat: 0.2,
    })
  );

  const louverMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.louverMap,
      bumpMap: textures.louverBump,
      bumpScale: 0.014,
      color: 0x4b5568,
      roughness: 0.42,
      metalness: 0.68,
    })
  );

  const trussDarkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2a3140,
      roughness: 0.46,
      metalness: 0.64,
    })
  );

  const whipCopperMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x9aa2b2,
      roughness: 0.34,
      metalness: 0.86,
    })
  );

  const goldenRecordMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: textures.goldenRecordMap,
      bumpMap: textures.goldenRecordBump,
      bumpScale: 0.008,
      color: 0xf4cf6b,
      roughness: 0.22,
      metalness: 0.96,
      anisotropy: isSoftwareGl ? 0 : 0.7,
      clearcoat: 0.35,
      clearcoatRoughness: 0.2,
    })
  );

  const opticGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x6ba5ff,
      roughness: 0.08,
      metalness: 0.1,
      transmission: isSoftwareGl ? 0 : 0.75,
      transparent: true,
      opacity: isSoftwareGl ? 0.5 : 1,
      ior: 1.52,
      clearcoat: 1.0,
    })
  );

  // =========================================================================
  // 1. HIGH-GAIN PARABOLIC DISH ANTENNA (3.7m diameter -> radius 1.85m)
  // =========================================================================
  const dishGroup = new THREE.Group();
  const dishRadius = 1.85;
  const dishDepth = 0.54;
  const lathePts: THREE.Vector2[] = [];
  const steps = 24;
  // Front parabolic curve (from center out to rim)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = t * dishRadius;
    const y = (r * r) / (dishRadius * dishRadius) * dishDepth;
    lathePts.push(new THREE.Vector2(r, y));
  }
  // Rim bevel lip
  lathePts.push(new THREE.Vector2(dishRadius + 0.02, dishDepth - 0.015));
  lathePts.push(new THREE.Vector2(dishRadius + 0.02, dishDepth - 0.045));
  // Back shell curve
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const r = t * dishRadius;
    const y = (r * r) / (dishRadius * dishRadius) * dishDepth - 0.035;
    lathePts.push(new THREE.Vector2(r, y));
  }

  const dishGeo = trackGeo(new THREE.LatheGeometry(lathePts, 64));
  dishGeo.computeVertexNormals();
  const dishMesh = new THREE.Mesh(dishGeo, dishMat);
  dishMesh.castShadow = true;
  dishMesh.receiveShadow = true;
  dishGroup.add(dishMesh);

  // Rear structural ring stiffener behind dish
  const dishRingGeo = trackGeo(new THREE.TorusGeometry(0.92, 0.032, 10, 48));
  const dishRing = new THREE.Mesh(dishRingGeo, titaniumMat);
  dishRing.rotation.x = Math.PI / 2;
  dishRing.position.y = 0.06;
  dishGroup.add(dishRing);

  // Central S/X-band feed horn cone
  const feedHornGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.14, 0.28, 20));
  const feedHorn = new THREE.Mesh(feedHornGeo, darkCarbonMat);
  feedHorn.position.y = 0.12;
  dishGroup.add(feedHorn);

  // Subreflector assembly suspended above dish center
  const subreflectorY = 1.28;
  const subGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.28, 0.14, 24));
  const subreflector = new THREE.Mesh(subGeo, dishMat);
  subreflector.position.y = subreflectorY;
  subreflector.castShadow = true;
  dishGroup.add(subreflector);

  const subCapGeo = trackGeo(new THREE.CylinderGeometry(0.05, 0.12, 0.18, 16));
  const subCap = new THREE.Mesh(subCapGeo, darkCarbonMat);
  subCap.position.y = subreflectorY + 0.14;
  dishGroup.add(subCap);

  // Low-Gain Antenna (LGA) mast beside subreflector
  const lgaMastGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.03, 0.34, 12));
  const lgaMast = new THREE.Mesh(lgaMastGeo, titaniumMat);
  lgaMast.position.set(0.16, subreflectorY + 0.22, 0.06);
  dishGroup.add(lgaMast);

  const lgaTipGeo = trackGeo(new THREE.ConeGeometry(0.055, 0.11, 14));
  const lgaTip = new THREE.Mesh(lgaTipGeo, dishMat);
  lgaTip.position.set(0.16, subreflectorY + 0.42, 0.06);
  dishGroup.add(lgaTip);

  // 3 Tripod struts connecting dish surface to subreflector
  const strutBaseR = 1.05;
  const strutBaseY = (strutBaseR * strutBaseR) / (dishRadius * dishRadius) * dishDepth;
  const tripodGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.026, 1, 10));
  const upAxis = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + 0.35;
    const pStart = new THREE.Vector3(
      Math.cos(angle) * strutBaseR,
      strutBaseY,
      Math.sin(angle) * strutBaseR
    );
    const pEnd = new THREE.Vector3(
      Math.cos(angle) * 0.2,
      subreflectorY - 0.04,
      Math.sin(angle) * 0.2
    );
    const dir = new THREE.Vector3().subVectors(pEnd, pStart);
    const len = dir.length();
    const strut = new THREE.Mesh(tripodGeo, darkCarbonMat);
    strut.position.addVectors(pStart, pEnd).multiplyScalar(0.5);
    strut.quaternion.setFromUnitVectors(upAxis, dir.normalize());
    strut.scale.set(1, len, 1);
    strut.castShadow = true;
    dishGroup.add(strut);
  }

  root.add(dishGroup);

  // =========================================================================
  // 2. ADAPTER COLLAR & DECAGONAL MAIN BUS (10-SIDED BODY)
  // =========================================================================
  const collarGeo = trackGeo(new THREE.CylinderGeometry(0.78, 0.85, 0.24, 24));
  const collar = new THREE.Mesh(collarGeo, blackMliMat);
  collar.position.y = -0.14;
  collar.castShadow = true;
  collar.receiveShadow = true;
  root.add(collar);

  const busRadius = 0.89;
  const busHeight = 0.48;
  const busY = -0.48;

  // Main 10-sided bus core
  const busGeo = trackGeo(new THREE.CylinderGeometry(busRadius, busRadius, busHeight, 10));
  const busMesh = new THREE.Mesh(busGeo, blackMliMat);
  busMesh.position.y = busY;
  busMesh.castShadow = true;
  busMesh.receiveShadow = true;
  root.add(busMesh);

  // Top & bottom metallic decagonal structural flange rings
  const flangeGeo = trackGeo(new THREE.CylinderGeometry(busRadius + 0.03, busRadius + 0.03, 0.045, 10));
  const topFlange = new THREE.Mesh(flangeGeo, titaniumMat);
  topFlange.position.y = busY + busHeight * 0.5;
  root.add(topFlange);

  const botFlange = new THREE.Mesh(flangeGeo, titaniumMat);
  botFlange.position.y = busY - busHeight * 0.5;
  root.add(botFlange);

  // Recessed bay louvers & electronics panels on all 10 faces
  const bayPanelGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.32, 0.04));
  const bayCenterDist = busRadius * Math.cos(Math.PI / 10);

  let goldenRecordMesh!: THREE.Mesh;
  const goldenRecordLocal = new THREE.Vector3();

  for (let i = 0; i < 10; i++) {
    const faceAngle = ((i + 0.5) / 10) * Math.PI * 2;
    const fx = Math.sin(faceAngle) * (bayCenterDist + 0.015);
    const fz = Math.cos(faceAngle) * (bayCenterDist + 0.015);

    if (i === 1) {
      // Bay 1 (facing +Z / +X quadrant toward camera side): GOLDEN RECORD!
      const recordMount = new THREE.Group();
      recordMount.position.set(fx, busY, fz);
      recordMount.rotation.y = faceAngle;

      // Titanium backing bezel
      const bezelGeo = trackGeo(new THREE.CylinderGeometry(0.175, 0.185, 0.03, 32));
      const bezel = new THREE.Mesh(bezelGeo, titaniumMat);
      bezel.rotation.x = Math.PI / 2;
      bezel.position.z = 0.015;
      recordMount.add(bezel);

      // The Golden Record anodized cover disc (30.5 cm diameter -> radius 0.155m)
      const discGeo = trackGeo(new THREE.CylinderGeometry(0.158, 0.158, 0.018, 48));
      goldenRecordMesh = new THREE.Mesh(discGeo, goldenRecordMat);
      goldenRecordMesh.rotation.x = Math.PI / 2;
      goldenRecordMesh.rotation.y = -Math.PI / 2;
      goldenRecordMesh.position.z = 0.032;
      goldenRecordMesh.castShadow = true;
      recordMount.add(goldenRecordMesh);

      goldenRecordLocal.set(fx, busY, fz);
      root.add(recordMount);
    } else {
      const bayMat = i % 3 === 0 ? goldMliMat : louverMat;
      const panel = new THREE.Mesh(bayPanelGeo, bayMat);
      panel.position.set(fx, busY, fz);
      panel.rotation.y = faceAngle;
      root.add(panel);
    }
  }

  // Underside propulsion V-strut framework & hydrazine sphere
  const propSphereGeo = trackGeo(new THREE.SphereGeometry(0.32, 24, 18));
  const propSphere = new THREE.Mesh(propSphereGeo, goldMliMat);
  propSphere.position.set(0, busY - 0.34, 0);
  root.add(propSphere);

  // V-strut support ring under bus (clearly visible in silhouette)
  const vStrutGeo = trackGeo(new THREE.CylinderGeometry(0.014, 0.014, 1, 8));
  for (let i = 0; i < 6; i++) {
    const a1 = (i / 6) * Math.PI * 2;
    const a2 = ((i + 0.5) / 6) * Math.PI * 2;
    const pTop = new THREE.Vector3(Math.cos(a1) * 0.72, busY - 0.24, Math.sin(a1) * 0.72);
    const pBot = new THREE.Vector3(Math.cos(a2) * 0.45, busY - 0.68, Math.sin(a2) * 0.45);
    const dir = new THREE.Vector3().subVectors(pBot, pTop);
    const len = dir.length();
    const m = new THREE.Mesh(vStrutGeo, trussDarkMat);
    m.position.addVectors(pTop, pBot).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(upAxis, dir.normalize());
    m.scale.set(1, len, 1);
    root.add(m);
  }

  const lowerRingGeo = trackGeo(new THREE.TorusGeometry(0.45, 0.018, 8, 24));
  const lowerRing = new THREE.Mesh(lowerRingGeo, trussDarkMat);
  lowerRing.rotation.x = Math.PI / 2;
  lowerRing.position.y = busY - 0.68;
  root.add(lowerRing);

  // =========================================================================
  // 3. MAGNETOMETER BOOM (13m Open Triangular Lattice Truss to the Left)
  // =========================================================================
  const magBoomRoot = new THREE.Group();
  magBoomRoot.position.set(-0.78, busY + 0.06, -0.18);
  // Point along -X and slightly forward/up depending on craft tilt
  magBoomRoot.rotation.set(0, Math.PI + 0.18, -0.06);

  const magTruss = buildTriangularTruss(11.8, 0.14, 34, trussDarkMat, geometries);
  magBoomRoot.add(magTruss);

  // Mid-boom & tip magnetometer sensor canisters
  const magCanGeo = trackGeo(new THREE.CylinderGeometry(0.065, 0.065, 0.22, 14));
  const magMid = new THREE.Mesh(magCanGeo, titaniumMat);
  magMid.rotation.z = Math.PI / 2;
  magMid.position.set(5.8, 0, 0);
  magBoomRoot.add(magMid);

  const magTip = new THREE.Mesh(magCanGeo, goldMliMat);
  magTip.rotation.z = Math.PI / 2;
  magTip.position.set(11.85, 0, 0);
  magBoomRoot.add(magTip);

  root.add(magBoomRoot);

  // =========================================================================
  // 4. RTG BOOM & 3 TANDEM MHW-RTG NUCLEAR POWER CANISTERS
  // =========================================================================
  const rtgGroup = new THREE.Group();
  rtgGroup.position.set(-0.68, busY - 0.14, 0.42);
  // Angled down-left relative to dish
  rtgGroup.rotation.set(0.22, Math.PI - 0.48, 0.34);

  const rtgTruss = buildTriangularTruss(2.35, 0.15, 7, trussDarkMat, geometries);
  rtgGroup.add(rtgTruss);

  // 3 tandem RTG cylinders at the outer half of the RTG boom
  const rtgBodyGeo = trackGeo(new THREE.CylinderGeometry(0.2, 0.2, 0.44, 16));
  const rtgFinGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.012, 0.52));
  const rtgEndGeo = trackGeo(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 16));

  for (let r = 0; r < 3; r++) {
    const canister = new THREE.Group();
    canister.position.set(2.55 + r * 0.48, 0, 0);

    const cyl = new THREE.Mesh(rtgBodyGeo, darkCarbonMat);
    cyl.rotation.z = Math.PI / 2;
    cyl.castShadow = true;
    canister.add(cyl);

    // 4 intersecting radiator fin planes (8 fins radially)
    for (let f = 0; f < 4; f++) {
      const fin = new THREE.Mesh(rtgFinGeo, darkCarbonMat);
      fin.rotation.x = (f / 4) * Math.PI;
      canister.add(fin);
    }

    const cap = new THREE.Mesh(rtgEndGeo, titaniumMat);
    cap.rotation.z = Math.PI / 2;
    cap.position.x = 0.24;
    canister.add(cap);

    rtgGroup.add(canister);
  }

  root.add(rtgGroup);

  // =========================================================================
  // 5. SCIENCE SCAN PLATFORM BOOM & ARTICULATED OPTICAL INSTRUMENTS
  // =========================================================================
  const scanBoomGroup = new THREE.Group();
  scanBoomGroup.position.set(0.78, busY + 0.04, 0.12);
  scanBoomGroup.rotation.set(-0.08, -0.18, 0.04);

  const scanTruss = buildTriangularTruss(2.45, 0.16, 8, trussDarkMat, geometries);
  scanBoomGroup.add(scanTruss);

  // Articulated Scan Platform Head at end of boom
  const platformHead = new THREE.Group();
  platformHead.position.set(2.58, -0.08, 0.05);
  platformHead.rotation.set(0.15, 0.35, -0.2);

  // Gimbal actuator cylinder
  const gimbalGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.13, 0.28, 16));
  const gimbal = new THREE.Mesh(gimbalGeo, titaniumMat);
  platformHead.add(gimbal);

  // Main instrument pallet box wrapped in black MLI + gold foil accents
  const palletGeo = trackGeo(new THREE.BoxGeometry(0.46, 0.38, 0.42));
  const pallet = new THREE.Mesh(palletGeo, blackMliMat);
  pallet.position.set(0.18, -0.18, 0);
  pallet.castShadow = true;
  platformHead.add(pallet);

  // Narrow-Angle Camera (ISS NAC) barrel + sunshade hood + lens
  const nacBarrelGeo = trackGeo(new THREE.CylinderGeometry(0.1, 0.11, 0.56, 20));
  const nacBarrel = new THREE.Mesh(nacBarrelGeo, darkCarbonMat);
  nacBarrel.rotation.z = Math.PI / 2;
  nacBarrel.position.set(0.32, -0.08, 0.18);
  platformHead.add(nacBarrel);

  const nacHoodGeo = trackGeo(new THREE.CylinderGeometry(0.13, 0.105, 0.18, 20, 1, true));
  const nacHood = new THREE.Mesh(nacHoodGeo, titaniumMat);
  nacHood.rotation.z = Math.PI / 2;
  nacHood.position.set(0.64, -0.08, 0.18);
  platformHead.add(nacHood);

  const nacLensGeo = trackGeo(new THREE.CylinderGeometry(0.085, 0.085, 0.03, 20));
  const nacLens = new THREE.Mesh(nacLensGeo, opticGlassMat);
  nacLens.rotation.z = Math.PI / 2;
  nacLens.position.set(0.58, -0.08, 0.18);
  platformHead.add(nacLens);

  // Wide-Angle Camera (ISS WAC) + IRIS spectrometer drum
  const irisDrumGeo = trackGeo(new THREE.CylinderGeometry(0.15, 0.15, 0.32, 20));
  const irisDrum = new THREE.Mesh(irisDrumGeo, blackMliMat);
  irisDrum.rotation.x = Math.PI / 2;
  irisDrum.position.set(0.24, -0.26, -0.22);
  platformHead.add(irisDrum);

  const irisGoldRimGeo = trackGeo(new THREE.TorusGeometry(0.145, 0.018, 10, 24));
  const irisGoldRim = new THREE.Mesh(irisGoldRimGeo, goldMliMat);
  irisGoldRim.position.set(0.24, -0.26, -0.38);
  platformHead.add(irisGoldRim);

  // UVS / PPS secondary sensor pod
  const uvsGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.22, 0.26));
  const uvs = new THREE.Mesh(uvsGeo, goldMliMat);
  uvs.position.set(0.08, -0.36, 0.16);
  platformHead.add(uvs);

  scanBoomGroup.add(platformHead);
  root.add(scanBoomGroup);

  const scanPlatformLocal = new THREE.Vector3(3.3, busY - 0.15, -0.3);

  // =========================================================================
  // 6. PRA / PWS DUAL 10m WHIP ANTENNAS (Slender V-shaped rods)
  // =========================================================================
  const whipGeo = trackGeo(new THREE.CylinderGeometry(0.006, 0.015, 7.6, 8));
  const whip1 = new THREE.Mesh(whipGeo, whipCopperMat);
  whip1.position.set(-1.35, busY - 3.65, 1.05);
  whip1.rotation.set(0.25, 0, -0.34);
  root.add(whip1);

  const whip2 = new THREE.Mesh(whipGeo, whipCopperMat);
  whip2.position.set(-0.95, busY - 3.4, -1.65);
  whip2.rotation.set(-0.42, 0, -0.24);
  root.add(whip2);

  return {
    group: root,
    goldenRecordMesh,
    dishCenterLocal: new THREE.Vector3(0, 0.35, 0),
    goldenRecordLocal,
    scanPlatformLocal,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
