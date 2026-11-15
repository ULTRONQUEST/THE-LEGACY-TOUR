import * as THREE from 'three';

export interface VoyagerModelResult {
  group: THREE.Group;
  goldenRecordMesh: THREE.Mesh;
}

export function createVoyager1(
  goldenRecordTex: THREE.CanvasTexture,
  foilBumpTex: THREE.CanvasTexture,
): VoyagerModelResult {
  const group = new THREE.Group();
  group.name = 'Voyager1';

  // Materials with realistic roughness/metalness contrast
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0xe6eaf0,
    roughness: 0.42,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });

  const darkCarbonMat = new THREE.MeshStandardMaterial({
    color: 0x171b24,
    roughness: 0.72,
    metalness: 0.25,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x9aa4b2,
    roughness: 0.28,
    metalness: 0.88,
  });

  const goldFoilMat = new THREE.MeshPhysicalMaterial({
    color: 0xd9a12b,
    roughness: 0.26,
    metalness: 0.92,
    bumpMap: foilBumpTex,
    bumpScale: 0.025,
    anisotropy: 0.6,
  });

  const recordMat = new THREE.MeshPhysicalMaterial({
    map: goldenRecordTex,
    roughness: 0.18,
    metalness: 0.95,
    clearcoat: 0.65,
    clearcoatRoughness: 0.12,
  });

  // 1. Parabolic High-Gain Antenna Dish (3.7m diameter -> radius 1.85)
  const dishPoints: THREE.Vector2[] = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const r = t * 1.85;
    const y = 0.26 * r * r;
    dishPoints.push(new THREE.Vector2(r, y));
  }
  const dishGeo = new THREE.LatheGeometry(dishPoints, 48);
  const dishMesh = new THREE.Mesh(dishGeo, dishMat);
  dishMesh.position.y = 0.36;
  dishMesh.castShadow = true;
  dishMesh.receiveShadow = true;
  group.add(dishMesh);

  // Dish backing collar
  const collarGeo = new THREE.CylinderGeometry(0.62, 0.78, 0.36, 24);
  const collar = new THREE.Mesh(collarGeo, titaniumMat);
  collar.position.y = 0.3;
  group.add(collar);

  // Sub-reflector & Tripod feed struts
  const subReflector = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.16, 0.12, 24),
    titaniumMat,
  );
  subReflector.position.y = 1.65;
  group.add(subReflector);

  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + 0.3;
    const start = new THREE.Vector3(Math.cos(angle) * 1.15, 0.62, Math.sin(angle) * 1.15);
    const end = new THREE.Vector3(Math.cos(angle) * 0.16, 1.62, Math.sin(angle) * 0.16);
    const curve = new THREE.LineCurve3(start, end);
    const strut = new THREE.Mesh(new THREE.TubeGeometry(curve, 1, 0.022, 8, false), titaniumMat);
    group.add(strut);
  }

  // 2. Decagonal Bus Body
  const busMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.88, 0.88, 0.56, 10),
    darkCarbonMat,
  );
  busMesh.position.y = -0.14;
  busMesh.castShadow = true;
  busMesh.receiveShadow = true;
  group.add(busMesh);

  // Gold thermal blanket lower shroud
  const lowerShroud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.52, 0.38, 10),
    goldFoilMat,
  );
  lowerShroud.position.y = -0.58;
  group.add(lowerShroud);

  // 3. The Iconic Voyager Golden Record (mounted cleanly on +Z/-X visible bay)
  const recordGroup = new THREE.Group();
  recordGroup.position.set(0.0, -0.14, 0.89);
  const recordBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.035, 32),
    titaniumMat,
  );
  recordBezel.rotation.x = Math.PI / 2;
  recordGroup.add(recordBezel);

  const goldenRecordMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.215, 0.215, 0.042, 36),
    recordMat,
  );
  goldenRecordMesh.rotation.x = Math.PI / 2;
  recordGroup.add(goldenRecordMesh);
  group.add(recordGroup);

  // 4. Long Triangular Lattice Magnetometer Boom (extending -X)
  const magLength = 7.4;
  const magGroup = new THREE.Group();
  magGroup.position.set(-0.82, -0.05, 0);
  magGroup.rotation.z = 0.06;

  // 3 longerons + cross-bracing merged cleanly as small struts
  const boomRad = 0.095;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const ly = Math.cos(a) * boomRad;
    const lz = Math.sin(a) * boomRad;
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.01, magLength, 6),
      darkCarbonMat,
    );
    rod.rotation.z = Math.PI / 2;
    rod.position.set(-magLength / 2, ly, lz);
    magGroup.add(rod);
  }
  const bays = 16;
  for (let b = 0; b < bays; b++) {
    const xPos = -(b + 0.5) * (magLength / bays);
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(boomRad * 1.05, boomRad * 1.05, 0.016, 3),
      titaniumMat,
    );
    ring.rotation.z = Math.PI / 2;
    ring.position.set(xPos, 0, 0);
    magGroup.add(ring);
  }
  // Magnetometer sensor at boom tip
  const magTip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 12), goldFoilMat);
  magTip.rotation.z = Math.PI / 2;
  magTip.position.set(-magLength - 0.1, 0, 0);
  magGroup.add(magTip);
  group.add(magGroup);

  // 5. Science Scan Platform Boom (+X side)
  const scanBoomGroup = new THREE.Group();
  scanBoomGroup.position.set(0.84, -0.08, 0.15);
  scanBoomGroup.rotation.z = -0.08;
  const scanArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.055, 2.35, 8),
    darkCarbonMat,
  );
  scanArm.rotation.z = -Math.PI / 2;
  scanArm.position.x = 1.15;
  scanBoomGroup.add(scanArm);

  // Scan platform truss frame
  const trussBar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.14), titaniumMat);
  trussBar.position.set(1.1, 0.06, 0);
  scanBoomGroup.add(trussBar);

  // Optical camera & spectrometer cluster at tip
  const platformBody = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.42), darkCarbonMat);
  platformBody.position.set(2.38, -0.05, 0);
  scanBoomGroup.add(platformBody);

  const narrowCam = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.42, 16), titaniumMat);
  narrowCam.rotation.x = Math.PI / 2;
  narrowCam.position.set(2.42, 0.02, 0.24);
  scanBoomGroup.add(narrowCam);

  const lensAccent = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.04, 16), goldFoilMat);
  lensAccent.rotation.x = Math.PI / 2;
  lensAccent.position.set(2.42, 0.02, 0.44);
  scanBoomGroup.add(lensAccent);

  group.add(scanBoomGroup);

  // 6. RTG Nuclear Power Boom (angled downward/aft-left)
  const rtgGroup = new THREE.Group();
  rtgGroup.position.set(-0.6, -0.32, -0.58);
  rtgGroup.rotation.set(0.28, -0.68, 0.32);

  const rtgArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 2.4, 8), darkCarbonMat);
  rtgArm.rotation.z = Math.PI / 2;
  rtgArm.position.x = -1.2;
  rtgGroup.add(rtgArm);

  for (let c = 0; c < 3; c++) {
    const rtgCan = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.44, 12), darkCarbonMat);
    rtgCan.rotation.z = Math.PI / 2;
    rtgCan.position.x = -1.55 - c * 0.48;
    rtgGroup.add(rtgCan);
  }
  group.add(rtgGroup);

  // 7. Twin Plasma Wave Whip Antennas (extending downward in V)
  for (const dir of [-1, 1]) {
    const whipCurve = new THREE.LineCurve3(
      new THREE.Vector3(0, -0.55, 0.15),
      new THREE.Vector3(dir * 1.45, -4.3, -0.45),
    );
    const whip = new THREE.Mesh(
      new THREE.TubeGeometry(whipCurve, 1, 0.011, 6, false),
      titaniumMat,
    );
    group.add(whip);
  }

  return { group, goldenRecordMesh };
}
