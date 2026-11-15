import * as THREE from 'three';
import { MOON_RADIUS } from './constants';
import { RegolithMaps } from './lunarTextures';
import { craterProfile, fbm2, hash2 } from './noise';

interface LocalCrater {
  x: number;
  z: number;
  radius: number;
  depth: number;
}

// Carefully placed Tranquility Base craters:
// Keeps the exact footprint under the Lunar Module, both astronauts, and flag gently flat/firm
// while adding rich sculpted craters in foreground, midground, and horizon!
const LOCAL_CRATERS: LocalCrater[] = [
  // Small foreground-right shallow depression visible in Apollo EVA photography
  { x: 3.4, z: 3.6, radius: 1.9, depth: 0.22 },
  // Foreground-left micro crater
  { x: -3.8, z: 3.1, radius: 1.4, depth: 0.16 },
  // Midground craters framing the site
  { x: 8.5, z: -4.2, radius: 3.4, depth: 0.42 },
  { x: -11.5, z: -2.0, radius: 4.2, depth: 0.55 },
  { x: 6.2, z: -15.5, radius: 5.5, depth: 0.7 },
  { x: -16.0, z: -18.5, radius: 6.8, depth: 0.85 },
  { x: 22.0, z: -28.0, radius: 9.5, depth: 1.15 },
  { x: -28.0, z: -34.0, radius: 11.0, depth: 1.25 },
  { x: 1.5, z: -38.0, radius: 8.2, depth: 0.95 },
  { x: 38.0, z: -12.0, radius: 10.5, depth: 1.1 },
  { x: -42.0, z: 14.0, radius: 12.0, depth: 1.3 },
  { x: 18.0, z: 24.0, radius: 7.4, depth: 0.8 },
];

// Deterministic scatter of smaller secondary pockmark craters
for (let i = 0; i < 42; i++) {
  const angle = hash2(i, 1.3) * Math.PI * 2;
  const dist = 7.5 + Math.pow(hash2(i, 4.7), 0.78) * 110;
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;

  // Keep the Lunar Module pad (-4.8, -7.5) and astronaut/flag zone clear of deep craters
  const distToLM = Math.hypot(x + 4.8, z + 7.5);
  const distToHero = Math.hypot(x - 0.5, z + 0.5);
  if (distToLM < 5.5 || distToHero < 4.5) continue;

  const r = 0.7 + hash2(i, 8.2) * 3.8;
  LOCAL_CRATERS.push({
    x,
    z,
    radius: r,
    depth: r * (0.11 + hash2(i, 2.9) * 0.06),
  });
}

/**
 * Exact elevation of the Tranquility Base surface at world (x, z),
 * seamlessly matching the spherical Moon curvature plus local relief.
 */
export function terrainHeightAt(x: number, z: number): number {
  const r2 = x * x + z * z;
  const r = Math.sqrt(r2);

  // Exact spherical drop-off matching Moon sphere centered at (0, -MOON_RADIUS, 0)
  const maxR = MOON_RADIUS * 0.95;
  const clampedR2 = Math.min(r2, maxR * maxR);
  const sphereY = Math.sqrt(MOON_RADIUS * MOON_RADIUS - clampedR2) - MOON_RADIUS;

  // Feather local relief down to 0 between r = 190m and r = 250m so outer edge merges cleanly
  const edgeFade = 1 - THREE.MathUtils.smoothstep(r, 190, 250);
  if (edgeFade <= 0.0001) {
    return sphereY - 0.06;
  }

  // Rolling lunar regolith undulation
  let relief =
    fbm2(x * 0.045 + 3.2, z * 0.045 - 1.7, 4) * 0.42 +
    fbm2(x * 0.22 - 5.1, z * 0.22 + 2.9, 3) * 0.065;

  // Subtle flattening directly under the Eagle Lunar Module landing pad & astronaut stance
  const flatHero = Math.exp(-(Math.pow(x - 0.4, 2) + Math.pow(z + 0.8, 2)) / 24);
  const flatLM = Math.exp(-(Math.pow(x + 4.8, 2) + Math.pow(z + 7.5, 2)) / 26);
  const flattenFactor = 1 - Math.min(0.82, flatHero * 0.72 + flatLM * 0.78);
  relief *= flattenFactor;

  // Add local impact craters
  for (let i = 0; i < LOCAL_CRATERS.length; i++) {
    const c = LOCAL_CRATERS[i];
    const dx = x - c.x;
    const dz = z - c.z;
    const d2 = dx * dx + dz * dz;
    const maxD = c.radius * 1.55;
    if (d2 < maxD * maxD) {
      const dist = Math.sqrt(d2);
      relief += craterProfile(dist / c.radius, false) * c.depth;
    }
  }

  // Outer skirt gently tucks 0.06m below sphereY at r=260m so no silhouette lip ever floats
  const skirtTuck = THREE.MathUtils.smoothstep(r, 220, 260) * -0.08;
  return sphereY + relief * edgeFade + skirtTuck;
}

export interface LunarTerrainHandle {
  group: THREE.Group;
  terrainMaterial: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createLunarTerrain(regolithMaps: RegolithMaps): LunarTerrainHandle {
  const group = new THREE.Group();

  // Concentric polar grid concentrates vertex resolution around the Apollo 11 diorama (0..25m)
  // while extending smoothly out to 260m horizon radius.
  const angularSegs = 160;
  const radialSegs = 120;
  const maxRadius = 260;

  const vertCount = 1 + angularSegs * radialSegs;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  // Center vertex (0, y, 0)
  positions[0] = 0;
  positions[1] = terrainHeightAt(0, 0);
  positions[2] = 0;
  uvs[0] = 0.5;
  uvs[1] = 0.5;

  let vIdx = 1;
  for (let rStep = 1; rStep <= radialSegs; rStep++) {
    const t = rStep / radialSegs;
    // Non-linear radial distribution: dense near 0..25m, wide out to 260m
    const radius = maxRadius * Math.pow(t, 2.05);

    for (let aStep = 0; aStep < angularSegs; aStep++) {
      const angle = (aStep / angularSegs) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = terrainHeightAt(x, z);

      positions[vIdx * 3] = x;
      positions[vIdx * 3 + 1] = y;
      positions[vIdx * 3 + 2] = z;

      // World-space planar UV tiling (~8m per repeat tile)
      uvs[vIdx * 2] = x * 0.12 + 0.5;
      uvs[vIdx * 2 + 1] = z * 0.12 + 0.5;
      vIdx++;
    }
  }

  const indices: number[] = [];
  // Inner triangle fan around center vertex 0
  for (let a = 0; a < angularSegs; a++) {
    const nextA = (a + 1) % angularSegs;
    indices.push(0, 1 + nextA, 1 + a);
  }

  // Concentric quad rings
  for (let rStep = 1; rStep < radialSegs; rStep++) {
    const ringStart = 1 + (rStep - 1) * angularSegs;
    const nextRingStart = 1 + rStep * angularSegs;
    for (let a = 0; a < angularSegs; a++) {
      const nextA = (a + 1) % angularSegs;
      const i00 = ringStart + a;
      const i01 = ringStart + nextA;
      const i10 = nextRingStart + a;
      const i11 = nextRingStart + nextA;

      indices.push(i00, i01, i11);
      indices.push(i00, i11, i10);
    }
  }

  const terrainGeo = new THREE.BufferGeometry();
  terrainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  terrainGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  terrainGeo.setIndex(indices);
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: regolithMaps.albedoMap,
    normalMap: regolithMaps.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: regolithMaps.roughnessMap,
    roughness: 0.94,
    metalness: 0.0,
    color: new THREE.Color(0xc4c7cc),
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = false;
  group.add(terrainMesh);

  // Subtle bootprint track decals / compressed dust ridges around the astronauts & LM ladder
  const bootGeo = new THREE.BoxGeometry(0.14, 0.015, 0.28);
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x62656b,
    roughness: 0.98,
    metalness: 0.0,
  });
  const bootPrints: Array<[number, number, number]> = [
    [-3.6, -5.2, 0.45],
    [-3.2, -4.6, 0.42],
    [-2.7, -3.9, 0.35],
    [-2.1, -3.1, 0.38],
    [-1.6, -2.2, 0.28],
    [-1.1, -1.2, 0.2],
    [-0.7, -0.3, 0.12],
    [-0.4, 0.5, 0.08],
    [0.5, -1.4, -0.45],
    [1.1, -1.9, -0.5],
    [1.7, -2.3, -0.4],
    [2.4, -2.5, -0.35],
  ];
  const bootInst = new THREE.InstancedMesh(bootGeo, bootMat, bootPrints.length);
  bootInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < bootPrints.length; i++) {
    const [bx, bz, rot] = bootPrints[i];
    const sideOffset = (i % 2 === 0 ? -1 : 1) * 0.13;
    const px = bx + Math.cos(rot) * sideOffset;
    const pz = bz - Math.sin(rot) * sideOffset;
    dummy.position.set(px, terrainHeightAt(px, pz) + 0.003, pz);
    dummy.rotation.set(0, rot, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    bootInst.setMatrixAt(i, dummy.matrix);
  }
  bootInst.instanceMatrix.needsUpdate = true;
  bootInst.computeBoundingSphere();
  group.add(bootInst);

  // Instanced angular basaltic lunar rocks & pebbles
  const rockGeo = new THREE.DodecahedronGeometry(0.18, 1);
  const rockPos = rockGeo.attributes.position;
  for (let i = 0; i < rockPos.count; i++) {
    const vx = rockPos.getX(i);
    const vy = rockPos.getY(i);
    const vz = rockPos.getZ(i);
    const disp = 0.72 + hash2(vx * 13.7 + vy * 7.1, vz * 19.3) * 0.48;
    // Slightly flatten rock base so boulders sit naturally in dust
    rockPos.setXYZ(i, vx * disp * 1.15, vy * disp * 0.72, vz * disp);
  }
  rockGeo.computeVertexNormals();

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x8b8e94,
    roughness: 0.92,
    metalness: 0.02,
    normalMap: regolithMaps.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
  });

  const rockCount = 320;
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;

  const rockColor = new THREE.Color();
  let placed = 0;
  for (let i = 0; i < 480 && placed < rockCount; i++) {
    const angle = hash2(i, 3.1) * Math.PI * 2;
    const dist = 1.6 + Math.pow(hash2(i, 7.9), 1.35) * 68;
    const rx = Math.cos(angle) * dist;
    const rz = Math.sin(angle) * dist;

    // Keep clear of astronaut boots & LM footpads
    if (Math.hypot(rx + 0.4, rz - 1.0) < 1.1) continue;
    if (Math.hypot(rx - 2.1, rz + 2.6) < 1.0) continue;
    if (Math.hypot(rx + 4.8, rz + 7.5) < 3.6) continue;

    const sizeBias = Math.pow(hash2(i, 9.4), 2.6);
    const baseScale = 0.22 + sizeBias * 1.65;
    const sy = baseScale * (0.65 + hash2(i, 5.2) * 0.55);

    const groundY = terrainHeightAt(rx, rz);
    dummy.position.set(rx, groundY + sy * 0.05, rz);
    dummy.rotation.set(
      hash2(i, 2.1) * 0.4,
      hash2(i, 6.7) * Math.PI * 2,
      hash2(i, 4.3) * 0.4,
    );
    dummy.scale.set(
      baseScale * (0.85 + hash2(i, 1.8) * 0.3),
      sy,
      baseScale * (0.85 + hash2(i, 8.6) * 0.3),
    );
    dummy.updateMatrix();
    rockInst.setMatrixAt(placed, dummy.matrix);

    const shade = 0.65 + hash2(i, 0.9) * 0.45;
    rockColor.setRGB(shade, shade, shade * 1.01);
    rockInst.setColorAt(placed, rockColor);
    placed++;
  }
  rockInst.count = placed;
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  group.add(rockInst);

  return {
    group,
    terrainMaterial: terrainMat,
    dispose() {
      terrainGeo.dispose();
      terrainMat.dispose();
      bootGeo.dispose();
      bootMat.dispose();
      rockGeo.dispose();
      rockMat.dispose();
    },
  };
}
