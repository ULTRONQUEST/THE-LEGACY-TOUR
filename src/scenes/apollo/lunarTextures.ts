import * as THREE from 'three';
import { craterProfile, fbm2, fbm3, hash3, noise3 } from './noise';

export interface LunarSphereMaps {
  albedoMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

export interface RegolithMaps {
  albedoMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

interface MariaBasin {
  dir: THREE.Vector3;
  radius: number;
  depth: number;
  darkness: number;
  warpAmp: number;
}

interface SphereCrater {
  dir: THREE.Vector3;
  angRadius: number;
  cosMax: number;
  depth: number;
  brightRim: number;
  hasRays: boolean;
  raySeed: number;
  rayLength: number;
  hasPeak: boolean;
}

function buildMariaBasins(): MariaBasin[] {
  const raw: Array<[number, number, number, number, number, number, number]> = [
    // [nx, ny, nz, angularRadius, depth, darkness, warpAmp]
    // Mare Tranquillitatis (right around +Y landing zone and slightly +X/+Z)
    [0.14, 0.97, 0.18, 0.27, 0.32, 0.44, 0.11],
    // Mare Serenitatis (north-west of Tranquillitatis)
    [-0.12, 0.91, 0.39, 0.25, 0.34, 0.46, 0.08],
    // Mare Imbrium (huge upper-left basin)
    [-0.56, 0.65, 0.51, 0.36, 0.4, 0.43, 0.1],
    // Oceanus Procellarum (expansive western maria)
    [-0.74, 0.34, 0.58, 0.44, 0.3, 0.39, 0.14],
    // Mare Vaporum / Sinus Medii
    [-0.15, 0.72, 0.68, 0.18, 0.24, 0.37, 0.09],
    // Mare Crisium (isolated oval eastern mare)
    [0.58, 0.76, 0.29, 0.15, 0.36, 0.48, 0.05],
    // Mare Fecunditatis
    [0.58, 0.56, 0.59, 0.23, 0.28, 0.41, 0.11],
    // Mare Nectaris
    [0.42, 0.46, 0.78, 0.17, 0.3, 0.43, 0.07],
    // Mare Nubium
    [-0.25, 0.38, 0.89, 0.24, 0.26, 0.38, 0.12],
    // Mare Humorum
    [-0.58, 0.22, 0.78, 0.16, 0.3, 0.42, 0.07],
    // Far-side Mare Moscoviense & Orientale-style basins
    [0.45, -0.68, -0.58, 0.17, 0.34, 0.42, 0.07],
    [-0.52, -0.55, -0.65, 0.2, 0.32, 0.38, 0.09],
  ];

  return raw.map(([x, y, z, radius, depth, darkness, warpAmp]) => ({
    dir: new THREE.Vector3(x, y, z).normalize(),
    radius,
    depth,
    darkness,
    warpAmp,
  }));
}

function buildSphereCraters(): SphereCrater[] {
  const craters: SphereCrater[] = [];

  // Iconic named rayed craters matching reference full-Moon visual layout
  const landmarkCraters: Array<
    [number, number, number, number, number, boolean, number, boolean]
  > = [
    // Tycho (lower-center of Earth-facing disk, long dramatic rays)
    [0.06, 0.16, 0.985, 0.052, 0.78, true, 0.85, true],
    // Copernicus (upper-left central highland edge)
    [-0.41, 0.55, 0.725, 0.055, 0.72, true, 0.48, true],
    // Kepler
    [-0.64, 0.45, 0.62, 0.032, 0.62, true, 0.32, false],
    // Aristarchus (very bright northwest crater)
    [-0.76, 0.52, 0.39, 0.03, 0.85, true, 0.26, false],
    // Plato (dark-floored northern crater)
    [-0.36, 0.86, 0.36, 0.048, 0.65, false, 0.0, false],
    // Clavius (huge southern highland crater)
    [-0.08, -0.02, 0.996, 0.09, 0.68, false, 0.0, false],
    // Langrenus & Petavius on eastern limb
    [0.78, 0.38, 0.49, 0.046, 0.64, true, 0.22, true],
    // Far-side ray crater
    [0.2, -0.45, -0.87, 0.06, 0.75, true, 0.55, true],
  ];

  for (let i = 0; i < landmarkCraters.length; i++) {
    const [x, y, z, r, bright, hasRays, rayLen, hasPeak] = landmarkCraters[i];
    craters.push({
      dir: new THREE.Vector3(x, y, z).normalize(),
      angRadius: r,
      cosMax: Math.cos(r * 1.65),
      depth: 0.75,
      brightRim: bright,
      hasRays,
      raySeed: i * 17.3 + 3.1,
      rayLength: rayLen,
      hasPeak,
    });
  }

  // Deterministic procedural craters across the entire sphere
  for (let i = 0; i < 210; i++) {
    const u = hash3(i, 1.7, 9.2);
    const v = hash3(i, 5.3, 2.8);
    const theta = Math.acos(2 * v - 1);
    const phi = u * Math.PI * 2;
    const dir = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.cos(theta),
      Math.sin(theta) * Math.sin(phi),
    );

    // Keep the immediate Tranquility Base landing pole (ny > 0.994) smooth for seamless terrain blend
    if (dir.y > 0.992) continue;

    const sizeRand = hash3(i, 8.1, 4.4);
    const angRadius = 0.014 + Math.pow(sizeRand, 2.3) * 0.075;
    craters.push({
      dir,
      angRadius,
      cosMax: Math.cos(angRadius * 1.6),
      depth: 0.32 + hash3(i, 3.3, 7.7) * 0.45,
      brightRim: 0.2 + hash3(i, 2.2, 6.1) * 0.35,
      hasRays: false,
      raySeed: 0,
      rayLength: 0,
      hasPeak: angRadius > 0.055,
    });
  }

  return craters;
}

/**
 * Generates seamless 3D-evaluated equirectangular lunar maps asynchronously in chunks
 * so the UI stays responsive and displays smooth progress.
 */
export async function generateLunarSphereMaps(
  maxAnisotropy: number,
  onProgress?: (progress01: number) => void,
): Promise<LunarSphereMaps> {
  const width = 1280;
  const height = 640;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const albedoCtx = albedoCanvas.getContext('2d')!;
  const albedoImg = albedoCtx.createImageData(width, height);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bumpCtx = bumpCanvas.getContext('2d')!;
  const bumpImg = bumpCtx.createImageData(width, height);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext('2d')!;
  const roughImg = roughCtx.createImageData(width, height);

  const maria = buildMariaBasins();
  const craters = buildSphereCraters();

  // Precompute two tangent axes for each rayed crater to evaluate radial ray angles in 3D
  const rayAxes = craters.map((c) => {
    if (!c.hasRays) return null;
    const up =
      Math.abs(c.dir.y) < 0.9
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
    const t1 = new THREE.Vector3().crossVectors(up, c.dir).normalize();
    const t2 = new THREE.Vector3().crossVectors(c.dir, t1).normalize();
    return { t1, t2 };
  });

  const aData = albedoImg.data;
  const bData = bumpImg.data;
  const rData = roughImg.data;

  const chunkRows = 24;

  for (let yStart = 0; yStart < height; yStart += chunkRows) {
    const yEnd = Math.min(height, yStart + chunkRows);

    for (let y = yStart; y < yEnd; y++) {
      // Three.js SphereGeometry: canvas top (y=0) maps to v=1 => theta=0 (+Y pole)
      const v = 1 - y / (height - 1);
      const theta = (1 - v) * Math.PI;
      const sinTheta = Math.sin(theta);
      const ny = Math.cos(theta);

      for (let x = 0; x < width; x++) {
        const u = x / (width - 1);
        const phi = u * Math.PI * 2;
        const nx = -Math.cos(phi) * sinTheta;
        const nz = Math.sin(phi) * sinTheta;

        // Multi-scale 3D FBM for highland geology and regolith mottling
        const macroNoise = fbm3(nx * 2.8, ny * 2.8, nz * 2.8, 4);
        const midNoise = fbm3(nx * 9.5 + 4.1, ny * 9.5 - 2.3, nz * 9.5 + 1.7, 4);
        const fineNoise = noise3(nx * 36.0, ny * 36.0, nz * 36.0);

        // Base highland albedo & elevation
        let albedo = 0.58 + macroNoise * 0.14 + midNoise * 0.08 + fineNoise * 0.035;
        let elev = 0.52 + macroNoise * 0.16 + midNoise * 0.09 + fineNoise * 0.025;
        let mareFactor = 0;

        // Evaluate Maria basins with domain-warped organic edges
        const warp = midNoise * 0.65 + macroNoise * 0.35;
        for (let m = 0; m < maria.length; m++) {
          const basin = maria[m];
          const dot = nx * basin.dir.x + ny * basin.dir.y + nz * basin.dir.z;
          if (dot < 0.3) continue;
          const ang = Math.acos(Math.min(1, Math.max(-1, dot)));
          const warpedAng = ang + warp * basin.warpAmp;
          if (warpedAng < basin.radius) {
            const t = 1 - warpedAng / basin.radius;
            const smooth = t * t * (3 - 2 * t);
            mareFactor = Math.max(mareFactor, smooth);
            albedo -= smooth * basin.darkness * 0.62;
            elev -= smooth * basin.depth * 0.36;
          }
        }

        // Evaluate spherical craters and bright ray ejecta
        for (let c = 0; c < craters.length; c++) {
          const cr = craters[c];
          const dot = nx * cr.dir.x + ny * cr.dir.y + nz * cr.dir.z;

          if (cr.hasRays && dot > 0.25) {
            const ang = Math.acos(Math.min(1, Math.max(-1, dot)));
            if (ang < cr.rayLength && ang > cr.angRadius * 0.75) {
              const axes = rayAxes[c]!;
              const tx = nx * axes.t1.x + ny * axes.t1.y + nz * axes.t1.z;
              const ty = nx * axes.t2.x + ny * axes.t2.y + nz * axes.t2.z;
              const angle = Math.atan2(ty, tx);
              // Angular ray pattern modulated by noise so rays look wispy & organic
              const rayWave =
                Math.sin(angle * 11 + cr.raySeed) * 0.5 +
                Math.sin(angle * 23 - cr.raySeed * 1.7) * 0.35 +
                Math.cos(angle * 37 + cr.raySeed * 0.4) * 0.25;
              const radialFade = Math.pow(1 - ang / cr.rayLength, 1.8);
              const rayMask = Math.max(0, rayWave - 0.12) * radialFade;
              albedo += rayMask * (0.28 + 0.14 * (midNoise + 0.5));
            }
          }

          if (dot < cr.cosMax) continue;
          const ang = Math.acos(Math.min(1, Math.max(-1, dot)));
          const d = ang / cr.angRadius;
          const prof = craterProfile(d, cr.hasPeak);
          elev += prof * cr.depth * 0.32;

          if (d < 1.35) {
            const rimGlow = Math.exp(-Math.pow((d - 0.96) / 0.24, 2));
            albedo += rimGlow * cr.brightRim * 0.26;
            if (d < 0.65) {
              albedo += prof * 0.04;
            }
          }
        }

        // Smooth pole region slightly right at Tranquility Base (+Y) so local terrain matches color
        if (ny > 0.985) {
          const poleBlend = (ny - 0.985) / 0.015;
          albedo = albedo * (1 - poleBlend * 0.45) + 0.36 * (poleBlend * 0.45);
          elev = elev * (1 - poleBlend * 0.7) + 0.44 * (poleBlend * 0.7);
        }

        const idx = (y * width + x) * 4;
        const gray = Math.max(24, Math.min(242, Math.round(albedo * 255)));
        // Subtle cool-neutral photographic silver-gray lunar tint
        aData[idx] = gray;
        aData[idx + 1] = Math.min(255, Math.round(gray * 1.005));
        aData[idx + 2] = Math.min(255, Math.round(gray * 1.015));
        aData[idx + 3] = 255;

        const bumpVal = Math.max(0, Math.min(255, Math.round(elev * 255)));
        bData[idx] = bumpVal;
        bData[idx + 1] = bumpVal;
        bData[idx + 2] = bumpVal;
        bData[idx + 3] = 255;

        const roughVal = Math.max(
          185,
          Math.min(250, Math.round((0.94 - mareFactor * 0.09 + fineNoise * 0.03) * 255)),
        );
        rData[idx] = roughVal;
        rData[idx + 1] = roughVal;
        rData[idx + 2] = roughVal;
        rData[idx + 3] = 255;
      }
    }

    if (onProgress) {
      onProgress(yEnd / height);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  albedoCtx.putImageData(albedoImg, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = maxAnisotropy;
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = maxAnisotropy;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = maxAnisotropy;
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.ClampToEdgeWrapping;

  return { albedoMap, bumpMap, roughnessMap };
}

/**
 * Generates high-frequency seamless regolith dust & pockmark textures for Tranquility Base.
 */
export function createRegolithTextures(maxAnisotropy: number): RegolithMaps {
  const size = 512;

  // Heightfield first so we can derive accurate tangent-space normal map
  const heights = new Float32Array(size * size);
  const microCraters: Array<{ x: number; y: number; r: number; depth: number }> = [];
  for (let i = 0; i < 160; i++) {
    microCraters.push({
      x: hash3(i, 1.1, 3.7) * size,
      y: hash3(i, 4.9, 8.3) * size,
      r: 3 + Math.pow(hash3(i, 2.7, 5.1), 2) * 22,
      depth: 0.25 + hash3(i, 6.2, 1.9) * 0.55,
    });
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Periodic 2D domain sampling via 4D/torus trick using 3D noise on a circle
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const nx = Math.cos(u) * 2.2;
      const ny = Math.sin(u) * 2.2;
      const nz = Math.cos(v) * 2.2 + Math.sin(v) * 1.4;
      let h =
        0.5 +
        fbm3(nx, ny, nz, 4) * 0.22 +
        noise3(Math.cos(u * 4) * 5, Math.sin(u * 4) * 5, Math.sin(v * 4) * 5) * 0.1 +
        (hash3(x, y, 0.5) - 0.5) * 0.08;

      // Add micro-craters wrapped seamlessly across edges
      for (let c = 0; c < microCraters.length; c++) {
        const cr = microCraters[c];
        let dx = Math.abs(x - cr.x);
        let dy = Math.abs(y - cr.y);
        if (dx > size * 0.5) dx = size - dx;
        if (dy > size * 0.5) dy = size - dy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < cr.r * 1.5) {
          h += craterProfile(dist / cr.r, false) * cr.depth * 0.25;
        }
      }
      heights[y * size + x] = h;
    }
  }

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;
  const aImg = aCtx.createImageData(size, size);

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nCtx = normalCanvas.getContext('2d')!;
  const nImg = nCtx.createImageData(size, size);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;
  const rImg = rCtx.createImageData(size, size);

  const normalStrength = 3.6;

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const h = heights[y * size + x];
      const hL = heights[y * size + xm];
      const hR = heights[y * size + xp];
      const hD = heights[ym * size + x];
      const hU = heights[yp * size + x];

      const idx = (y * size + x) * 4;

      // Photographic grayscale lunar regolith dust (~#72757a - #9a9da3)
      const g = Math.max(58, Math.min(198, Math.round((0.46 + (h - 0.5) * 0.38) * 255)));
      aImg.data[idx] = g;
      aImg.data[idx + 1] = g;
      aImg.data[idx + 2] = Math.min(255, Math.round(g * 1.01));
      aImg.data[idx + 3] = 255;

      const dx = (hL - hR) * normalStrength;
      const dy = (hD - hU) * normalStrength;
      const dz = 1.0;
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
      nImg.data[idx] = Math.round((dx * invLen * 0.5 + 0.5) * 255);
      nImg.data[idx + 1] = Math.round((dy * invLen * 0.5 + 0.5) * 255);
      nImg.data[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      nImg.data[idx + 3] = 255;

      const rVal = Math.max(210, Math.min(252, Math.round((0.92 + (h - 0.5) * 0.12) * 255)));
      rImg.data[idx] = rVal;
      rImg.data[idx + 1] = rVal;
      rImg.data[idx + 2] = rVal;
      rImg.data[idx + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  nCtx.putImageData(nImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const setupTex = (canvas: HTMLCanvasElement, isSrgb: boolean) => {
    const tex = new THREE.CanvasTexture(canvas);
    if (isSrgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(22, 22);
    tex.anisotropy = maxAnisotropy;
    return tex;
  };

  return {
    albedoMap: setupTex(albedoCanvas, true),
    normalMap: setupTex(normalCanvas, false),
    roughnessMap: setupTex(roughCanvas, false),
  };
}

/**
 * Generates crinkled Kapton thermal foil normal map for the Lunar Module descent stage.
 */
export function createKaptonFoilNormalMap(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const heights = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      // Sharp faceted foil crinkles using ridged noise
      const n1 = Math.abs(
        noise3(Math.cos(u) * 3.8, Math.sin(u) * 3.8, Math.cos(v) * 3.8 + Math.sin(v) * 2.1),
      );
      const n2 = Math.abs(
        noise3(Math.cos(u * 2) * 5.2 + 7, Math.sin(u * 2) * 5.2, Math.sin(v * 2) * 5.2),
      );
      heights[y * size + x] = (1 - n1) * 0.65 + (1 - n2) * 0.35;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (heights[y * size + xm] - heights[y * size + xp]) * 5.2;
      const dy = (heights[ym * size + x] - heights[yp * size + x]) * 5.2;
      const dz = 1.0;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
      const idx = (y * size + x) * 4;
      img.data[idx] = Math.round((dx * inv * 0.5 + 0.5) * 255);
      img.data[idx + 1] = Math.round((dy * inv * 0.5 + 0.5) * 255);
      img.data[idx + 2] = Math.round((dz * inv * 0.5 + 0.5) * 255);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates woven pressure-suit Beta-cloth crease normal map for realistic astronaut fabric folds.
 */
export function createSuitFabricNormalMap(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const heights = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fold =
        Math.sin((y / size) * Math.PI * 16 + fbm2(x * 0.04, y * 0.04, 3) * 3.0) * 0.45 +
        fbm2(x * 0.08, y * 0.06, 3) * 0.55;
      heights[y * size + x] = fold;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (heights[y * size + xm] - heights[y * size + xp]) * 2.2;
      const dy = (heights[ym * size + x] - heights[yp * size + x]) * 2.8;
      const dz = 1.0;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
      const idx = (y * size + x) * 4;
      img.data[idx] = Math.round((dx * inv * 0.5 + 0.5) * 255);
      img.data[idx + 1] = Math.round((dy * inv * 0.5 + 0.5) * 255);
      img.data[idx + 2] = Math.round((dz * inv * 0.5 + 0.5) * 255);
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates crisp 13-stripe, 50-star US flag CanvasTexture.
 */
export function createAmericanFlagTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 540;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const stripeH = h / 13;
  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#a8222d' : '#edeae2';
    ctx.fillRect(0, i * stripeH, w, stripeH + 1);
  }

  const cantonW = w * 0.4;
  const cantonH = stripeH * 7;
  ctx.fillStyle = '#192a56';
  ctx.fillRect(0, 0, cantonW, cantonH);

  ctx.fillStyle = '#f2f1ec';
  const rows = 9;
  const rowStep = cantonH / (rows + 1);
  for (let r = 0; r < rows; r++) {
    const cols = r % 2 === 0 ? 6 : 5;
    const colStep = cantonW / 6;
    const offset = r % 2 === 0 ? colStep * 0.5 : colStep;
    const cy = (r + 1) * rowStep;
    for (let c = 0; c < cols; c++) {
      const cx = offset + c * colStep;
      drawStar(ctx, cx, cy, 5, 10, 4.3);
    }
  }

  // Subtle fabric weave shading
  ctx.fillStyle = 'rgba(0,0,0,0.03)';
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerR: number,
  innerR: number,
) {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Generates the United States marking plaque on the Lunar Module descent stage (without NASA logos).
 */
export function createLMPlaqueTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e8e5dc';
  ctx.fillRect(0, 0, 256, 192);

  // Small US flag motif on top half
  const fw = 180;
  const fh = 96;
  const fx = 38;
  const fy = 18;
  const sh = fh / 13;
  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#a8222d' : '#edeae2';
    ctx.fillRect(fx, fy + i * sh, fw, sh + 0.5);
  }
  ctx.fillStyle = '#192a56';
  ctx.fillRect(fx, fy, fw * 0.42, sh * 7);

  ctx.fillStyle = '#1e2430';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('UNITED', 128, 145);
  ctx.fillText('STATES', 128, 174);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates soft radial contact shadow alpha texture.
 */
export function createSoftContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.05,
    size / 2,
    size / 2,
    size * 0.48,
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.32)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
