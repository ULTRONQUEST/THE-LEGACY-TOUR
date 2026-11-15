import * as THREE from 'three';
import { MarsTextureSet } from './textures';

export interface SurfaceHandle {
  group: THREE.Group;
  groundHeightAt: (x: number, z: number) => number;
  update: (elapsed: number, visibilityFactor: number) => void;
}

/**
 * Deterministic Martian terrain heightfield:
 * Keeps a realistic undulating Meridiani-like exploration plain near (0, 0)
 * while rising into dramatic canyon mesas and ridges at larger radii.
 */
export function groundHeightAt(x: number, z: number): number {
  const r = Math.sqrt(x * x + z * z);

  // Subtle surface undulations & wind-rippled regolith
  const gentle =
    Math.sin(x * 0.08 + z * 0.05) * 0.22 +
    Math.cos(x * 0.045 - z * 0.07) * 0.18 +
    Math.sin(x * 0.22 + z * 0.19) * 0.05;

  // Keep central rover zone gently sloped & natural
  const flatFactor = THREE.MathUtils.smoothstep(r, 3.0, 22.0);

  // Outer canyon walls & mesas rising smoothly beyond r = 24
  const ridgeWave =
    Math.sin(x * 0.032 + 0.8) * Math.cos(z * 0.028 - 0.5) +
    0.55 * Math.sin(x * 0.068 - z * 0.052);
  const canyonRise =
    THREE.MathUtils.smoothstep(r, 20.0, 92.0) * (6.5 + Math.max(0, ridgeWave) * 11.5);

  // Carve a subtle valley corridor along -Z/+Z so foreground spires frame a natural canyon vista
  const valleyChannel = Math.exp(-(x * x) / (2 * 26 * 26));
  const sculptedRise = canyonRise * (1.0 - valleyChannel * 0.55);

  return gentle * (0.28 + 0.72 * flatFactor) + sculptedRise;
}

export function createSurfaceGroup(textures: MarsTextureSet): SurfaceHandle {
  const group = new THREE.Group();
  group.name = 'MartianSurfaceEnvironment';

  // 1. High-resolution 3D Martian Terrain Mesh (240 x 240 units)
  const terrainSize = 240;
  const segs = 180;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segs, segs);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);
  const cBase = new THREE.Color(0xc46838);
  const cDark = new THREE.Color(0x733a22);
  const cLight = new THREE.Color(0xde8b58);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = groundHeightAt(x, z);
    posAttr.setY(i, y);

    const elevFactor = THREE.MathUtils.clamp((y + 0.5) / 14.0, 0, 1);
    const patch = Math.sin(x * 0.09) * Math.cos(z * 0.09) * 0.5 + 0.5;
    tmpColor.copy(cBase).lerp(cDark, patch * 0.38).lerp(cLight, elevFactor * 0.55);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: textures.regolithAlbedo,
    bumpMap: textures.regolithBump,
    bumpScale: 0.14,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.02,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // 2. Martian Atmospheric Sky Dome (Warm dusty ochre-amber gradient, NEVER Earth-blue)
  const skyDomeGeo = new THREE.SphereGeometry(280, 40, 24);
  const skyDomeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uOpacity: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vWorldDir;
      void main() {
        float h = clamp(vWorldDir.y, -0.15, 1.0);
        // Authentic Martian dusty butterscotch/amber sky grading up to darker rust-brown zenith
        vec3 horizonCol = vec3(0.84, 0.49, 0.28);
        vec3 midCol = vec3(0.62, 0.31, 0.18);
        vec3 zenithCol = vec3(0.24, 0.12, 0.09);
        vec3 col = mix(horizonCol, midCol, smoothstep(0.0, 0.28, h));
        col = mix(col, zenithCol, smoothstep(0.25, 0.85, h));
        // Subtle sunlit solar scattering halo
        vec3 sunDir = normalize(vec3(-0.55, 0.34, -0.76));
        float sunGlow = pow(max(0.0, dot(vWorldDir, sunDir)), 8.0);
        col += vec3(0.32, 0.18, 0.08) * sunGlow;
        gl_FragColor = vec4(col, uOpacity);
      }
    `,
  });
  const skyDome = new THREE.Mesh(skyDomeGeo, skyDomeMat);
  group.add(skyDome);

  // 3. Distant Canyon & Shield Volcano Panorama Ring using uploaded MARS_LAND_2d20d55b.webp
  const panoramaMaterials: THREE.MeshBasicMaterial[] = [];
  if (textures.marsLandTex) {
    const landTex = textures.marsLandTex;
    landTex.wrapS = THREE.ClampToEdgeWrapping;
    landTex.wrapT = THREE.ClampToEdgeWrapping;

    // Curved 240-degree backdrop arc behind the valley (-Z direction)
    const arcGeo = new THREE.CylinderGeometry(132, 132, 62, 64, 1, true, Math.PI * 0.22, Math.PI * 1.56);
    const arcMat = new THREE.MeshBasicMaterial({
      map: landTex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      fog: true,
    });
    panoramaMaterials.push(arcMat);

    const arcMesh = new THREE.Mesh(arcGeo, arcMat);
    arcMesh.position.set(0, 17, 0);
    arcMesh.rotation.y = Math.PI * 0.5;
    group.add(arcMesh);
  }

  // 4. Transparent Foreground Rock Formations using uploaded MARS_VALLEYS_373777f1.webp
  // Preserves alpha transparency cleanly—NO black or white rectangle behind formations.
  const valleyMeshes: THREE.Mesh[] = [];
  if (textures.marsValleysTex) {
    const valTex = textures.marsValleysTex;
    valTex.wrapS = THREE.ClampToEdgeWrapping;
    valTex.wrapT = THREE.ClampToEdgeWrapping;

    const createValleyLayer = (width: number, height: number, x: number, y: number, z: number, rotY = 0) => {
      const geo = new THREE.PlaneGeometry(width, height);
      const mat = new THREE.MeshStandardMaterial({
        map: valTex,
        transparent: true,
        alphaTest: 0.08,
        roughness: 0.92,
        metalness: 0.02,
        side: THREE.DoubleSide,
        depthWrite: true,
        fog: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      group.add(mesh);
      valleyMeshes.push(mesh);
    };

    // Mid-distance canyon spires framing the Martian valley during Shot 4 descent & Shot 5/6 vistas
    createValleyLayer(58, 32, 0, 11.2, -26, 0);
    // Secondary deeper canyon framing layer for parallax depth
    createValleyLayer(88, 48, 0, 16.5, -56, 0.04);
  }

  // 5. Instanced 3D Martian Rocks & Hematite Boulders grounded on groundHeightAt(x, z)
  const rockCount = 190;
  const rockGeo = new THREE.DodecahedronGeometry(0.45, 1);
  // Slightly flatten & crag vertices once for natural sedimentary rock shape
  const rPos = rockGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < rPos.count; i++) {
    const vx = rPos.getX(i);
    const vy = rPos.getY(i);
    const vz = rPos.getZ(i);
    const warp = 0.82 + 0.34 * Math.sin(vx * 5.2 + vy * 3.7 + vz * 4.1);
    rPos.setXYZ(i, vx * warp * 1.15, vy * warp * 0.68, vz * warp);
  }
  rockGeo.computeVertexNormals();

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.91,
    metalness: 0.04,
    bumpMap: textures.regolithBump,
    bumpScale: 0.04,
  });

  const rocksInstanced = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rocksInstanced.castShadow = true;
  rocksInstanced.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const rockColor = new THREE.Color();
  for (let i = 0; i < rockCount; i++) {
    const angle = (i * 2.39996) % (Math.PI * 2);
    // Keep immediate rover path clear (r > 2.2) while scattering densely around valley
    const dist = 2.4 + Math.pow((i / rockCount), 0.72) * 58.0;
    const rx = Math.cos(angle) * dist + Math.sin(i * 1.7) * 1.8;
    const rz = Math.sin(angle) * dist + Math.cos(i * 2.3) * 1.8;

    // Avoid blocking right in front of the camera-to-rover line in Shot 5/6
    if (Math.abs(rx) < 2.1 && rz > -2.5 && rz < 7.5) {
      dummy.position.set(rx + (rx >= 0 ? 3.5 : -3.5), 0, rz);
    } else {
      dummy.position.set(rx, 0, rz);
    }

    const scaleBase = 0.25 + Math.pow((Math.sin(i * 12.7) * 0.5 + 0.5), 2.0) * 2.4;
    const sx = scaleBase * (0.85 + ((i * 7) % 10) * 0.03);
    const sy = scaleBase * (0.55 + ((i * 3) % 10) * 0.04);
    const sz = scaleBase * (0.85 + ((i * 5) % 10) * 0.03);

    const gy = groundHeightAt(dummy.position.x, dummy.position.z);
    // Sink bottom ~30% into regolith so nothing ever floats
    dummy.position.y = gy + sy * 0.14;
    dummy.rotation.set(((i * 1.1) % 0.4) - 0.2, (i * 0.9) % (Math.PI * 2), ((i * 0.7) % 0.4) - 0.2);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    rocksInstanced.setMatrixAt(i, dummy.matrix);

    // Basalt-dark to rusty-ochre tint variation
    const tint = (Math.sin(i * 4.3) * 0.5 + 0.5);
    rockColor.setRGB(
      THREE.MathUtils.lerp(0.36, 0.68, tint),
      THREE.MathUtils.lerp(0.20, 0.34, tint),
      THREE.MathUtils.lerp(0.14, 0.21, tint)
    );
    rocksInstanced.setColorAt(i, rockColor);
  }
  rocksInstanced.instanceMatrix.needsUpdate = true;
  if (rocksInstanced.instanceColor) rocksInstanced.instanceColor.needsUpdate = true;
  rocksInstanced.computeBoundingSphere();
  group.add(rocksInstanced);

  // 6. Subtle Opportunity Rover Wheel Tracks trailing behind rover in regolith
  const trackGroup = new THREE.Group();
  const trackMat = new THREE.MeshStandardMaterial({
    color: 0x6b351e,
    roughness: 0.96,
    metalness: 0.0,
    transparent: true,
    opacity: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const trackSegGeo = new THREE.PlaneGeometry(0.18, 0.32);
  trackSegGeo.rotateX(-Math.PI / 2);
  for (let t = 0; t < 28; t++) {
    const tz = -1.1 - t * 0.36;
    [-0.56, 0.56].forEach((tx) => {
      const m = new THREE.Mesh(trackSegGeo, trackMat);
      const gy = groundHeightAt(tx, tz);
      m.position.set(tx, gy + 0.015, tz);
      m.receiveShadow = true;
      trackGroup.add(m);
    });
  }
  group.add(trackGroup);

  // 7. Wind-Blown Martian Dust Motes (atmospheric haze particles)
  const dustCount = 260;
  const dustPos = new Float32Array(dustCount * 3);
  const dustPhase = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 44;
    dustPos[i * 3 + 1] = 0.4 + Math.random() * 14;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 44;
    dustPhase[i] = Math.random() * Math.PI * 2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xf4a875,
    size: 0.24,
    map: textures.softParticleTex,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  group.add(dustPoints);

  return {
    group,
    groundHeightAt,
    update(elapsed: number, visibilityFactor: number) {
      skyDomeMat.uniforms.uOpacity.value = visibilityFactor;
      dustMat.opacity = visibilityFactor * 0.32;
      for (const pm of panoramaMaterials) {
        pm.opacity = visibilityFactor * 0.94;
      }

      if (visibilityFactor <= 0.01) return;

      const attr = dustGeo.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < dustCount; i++) {
        const idx = i * 3;
        arr[idx] += 0.012;
        arr[idx + 1] += Math.sin(elapsed * 0.7 + dustPhase[i]) * 0.002;
        if (arr[idx] > 22) arr[idx] = -22;
      }
      attr.needsUpdate = true;
    },
  };
}
