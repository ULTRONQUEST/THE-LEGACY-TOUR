import * as THREE from 'three';

function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm2D(x: number, y: number, octaves = 5): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * valueNoise2D(x * freq, y * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return value;
}

// Simplified realistic Earth landmass polygons in (lon, lat) degrees [-180..180, -90..90]
const CONTINENTS: Array<Array<[number, number]>> = [
  // Australia
  [
    [114, -22], [122, -17], [130, -12], [136, -12], [136, -15], [141, -17],
    [142, -11], [146, -18], [153, -26], [150, -37], [144, -38], [137, -35],
    [129, -32], [122, -34], [115, -34], [113, -26],
  ],
  // Tasmania
  [[145, -41], [148, -41], [147, -43.5], [145, -43]],
  // New Zealand
  [[172, -35], [178, -38], [175, -42], [167, -46], [171, -41]],
  // New Guinea
  [[131, -2], [141, -3], [150, -9], [145, -8], [135, -5]],
  // Borneo & Sumatra & Java & Philippines
  [[96, 5], [104, 0], [106, -6], [114, -8], [104, -5], [99, 1]],
  [[109, 2], [118, 5], [118, -3], [110, -3]],
  [[120, 18], [123, 14], [126, 7], [122, 7], [120, 14]],
  // Eurasia (West to East)
  [
    [-9, 37], [-9, 43], [-2, 43], [-4, 48], [2, 51], [8, 54], [10, 58],
    [5, 61], [15, 69], [28, 71], [42, 68], [60, 70], [72, 73], [95, 76],
    [115, 74], [140, 72], [172, 66], [162, 56], [142, 54], [135, 44],
    [129, 36], [122, 39], [121, 31], [114, 22], [108, 21], [109, 12],
    [102, 10], [100, 14], [103, 2], [99, 7], [96, 16], [90, 22], [80, 12],
    [77, 8], [72, 20], [67, 25], [57, 26], [48, 30], [56, 22], [44, 13],
    [35, 29], [36, 36], [27, 37], [26, 41], [20, 39], [15, 38], [12, 43],
    [5, 43], [0, 39], [-5, 36],
  ],
  // Japan
  [[130, 32], [136, 34], [141, 38], [145, 44], [140, 42], [135, 36]],
  // UK
  [[-5, 50], [-6, 58], [-2, 58], [1, 52]],
  // Africa
  [
    [-17, 15], [-13, 28], [-6, 36], [10, 37], [12, 33], [24, 32], [32, 31],
    [40, 18], [43, 12], [51, 12], [46, 2], [41, -3], [40, -11], [35, -20],
    [32, -28], [26, -34], [18, -34], [15, -26], [12, -15], [12, -5],
    [9, 4], [2, 6], [-8, 5], [-16, 11],
  ],
  // Madagascar
  [[44, -25], [47, -25], [50, -13], [47, -15]],
  // North America
  [
    [-166, 65], [-156, 71], [-135, 69], [-110, 72], [-85, 70], [-65, 62],
    [-55, 52], [-66, 45], [-75, 35], [-81, 25], [-83, 30], [-90, 29],
    [-97, 26], [-96, 19], [-88, 21], [-84, 10], [-78, 8], [-82, 9],
    [-92, 14], [-105, 20], [-112, 28], [-117, 32], [-124, 41], [-124, 49],
    [-136, 58], [-152, 60], [-162, 56],
  ],
  // South America
  [
    [-78, 9], [-72, 12], [-62, 10], [-50, 1], [-35, -6], [-39, -15],
    [-42, -23], [-52, -33], [-62, -41], [-67, -54], [-74, -52], [-73, -40],
    [-71, -30], [-70, -18], [-81, -5], [-79, 2],
  ],
  // Greenland
  [[-44, 60], [-52, 68], [-45, 81], [-20, 82], [-22, 70], [-36, 65]],
  // Antarctica band
  [
    [-180, -72], [-120, -74], [-60, -64], [0, -70], [60, -68], [120, -67],
    [180, -71], [180, -90], [-180, -90],
  ],
];

function pointInPoly(lon: number, lat: number, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isContinent(lon: number, lat: number): boolean {
  for (let c = 0; c < CONTINENTS.length; c++) {
    if (pointInPoly(lon, lat, CONTINENTS[c])) return true;
  }
  return false;
}

export interface EarthTextureBundle {
  albedoMap: THREE.CanvasTexture;
  specularMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  cloudMap: THREE.CanvasTexture;
  nightLightsMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function createEarthTextures(maxAnisotropy: number): EarthTextureBundle {
  const width = 1024;
  const height = 512;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const albedoCtx = albedoCanvas.getContext('2d')!;
  const albedoImg = albedoCtx.createImageData(width, height);

  const specCanvas = document.createElement('canvas');
  specCanvas.width = width;
  specCanvas.height = height;
  const specCtx = specCanvas.getContext('2d')!;
  const specImg = specCtx.createImageData(width, height);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bumpCtx = bumpCanvas.getContext('2d')!;
  const bumpImg = bumpCtx.createImageData(width, height);

  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = width;
  cloudCanvas.height = height;
  const cloudCtx = cloudCanvas.getContext('2d')!;
  const cloudImg = cloudCtx.createImageData(width, height);

  const nightCanvas = document.createElement('canvas');
  nightCanvas.width = width;
  nightCanvas.height = height;
  const nightCtx = nightCanvas.getContext('2d')!;
  const nightImg = nightCtx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    const v = y / height;
    const lat = 90 - v * 180;
    const absLat = Math.abs(lat);
    const cosLat = Math.max(0.18, Math.cos((lat * Math.PI) / 180));

    for (let x = 0; x < width; x++) {
      const u = x / width;
      const lon = u * 360 - 180;
      const idx = (y * width + x) * 4;

      // Seamless spherical-friendly sampling coordinates
      const angle = u * Math.PI * 2;
      const nx = Math.cos(angle) * cosLat * 4.5;
      const nz = Math.sin(angle) * cosLat * 4.5;
      const ny = (lat / 90) * 4.5;

      const coastPerturb = (fbm2D(nx * 1.8 + ny * 0.7, nz * 1.8 - ny * 0.5, 4) - 0.5) * 9.5;
      const landMask = isContinent(lon + coastPerturb, lat + coastPerturb * 0.55);

      const terrainNoise = fbm2D(nx * 2.4 + 13.7, nz * 2.4 + ny * 2.1, 5);
      const moisture = fbm2D(nx * 1.4 - 5.2, nz * 1.4 + ny * 1.9, 4);
      const detail = fbm2D(nx * 8.0, nz * 8.0 + ny * 6.0, 3);

      let r = 0;
      let g = 0;
      let b = 0;
      let spec = 215;
      let bump = 8;
      let night = 0;

      if (absLat > 78 + (terrainNoise - 0.5) * 8) {
        // Polar ice cap
        r = 232 + detail * 18;
        g = 240 + detail * 14;
        b = 248;
        spec = 40;
        bump = 120 + terrainNoise * 40;
      } else if (landMask) {
        spec = 12;
        const elev = Math.max(0, Math.min(1, terrainNoise * 1.15 + detail * 0.2 - 0.25));
        bump = Math.floor(80 + elev * 170);

        // Biome color: lush tropics, arid subtropics (Australia/Sahara), temperate green, alpine rock
        const aridBand =
          Math.exp(-Math.pow((absLat - 25) / 11, 2)) * (1.0 - moisture * 0.65) +
          (lon > 113 && lon < 146 && lat < -16 && lat > -34 ? 0.52 : 0);

        if (elev > 0.74) {
          // Alpine snow / rock peaks
          r = 185 + elev * 55;
          g = 182 + elev * 55;
          b = 180 + elev * 58;
        } else if (aridBand > 0.45) {
          // Arid ochre / red-earth desert (matches Australia & Sahara in ref)
          const t = Math.min(1, (aridBand - 0.45) * 1.8);
          r = 120 + t * 55 + detail * 22;
          g = 94 + t * 24 + detail * 16;
          b = 58 + t * 8 + detail * 10;
        } else {
          // Dense forest / vegetated plains
          const veg = Math.min(1, moisture * 1.25);
          r = 32 + (1 - veg) * 52 + detail * 18;
          g = 76 + veg * 32 + detail * 20;
          b = 34 + (1 - veg) * 20 + detail * 10;
        }

        // Subtle coastal city lights on populated latitudes
        if (absLat < 58 && elev < 0.45 && detail > 0.67 && terrainNoise > 0.48) {
          night = Math.min(255, (detail - 0.67) * 900);
        }
      } else {
        // Deep cobalt & royal Pacific oceans (matches EARTH_3-D_IMAGE_042d9e1f.png)
        const depth = fbm2D(nx * 1.9 + 31.1, nz * 1.9 + ny * 1.2, 4);
        const latCool = Math.min(1, absLat / 80);
        r = 8 + depth * 12 + latCool * 10;
        g = 34 + depth * 32 + latCool * 16;
        b = 98 + depth * 56 + latCool * 14;
        spec = 225;
        bump = 4;
      }

      albedoImg.data[idx] = Math.min(255, Math.max(0, r));
      albedoImg.data[idx + 1] = Math.min(255, Math.max(0, g));
      albedoImg.data[idx + 2] = Math.min(255, Math.max(0, b));
      albedoImg.data[idx + 3] = 255;

      specImg.data[idx] = spec;
      specImg.data[idx + 1] = spec;
      specImg.data[idx + 2] = spec;
      specImg.data[idx + 3] = 255;

      bumpImg.data[idx] = bump;
      bumpImg.data[idx + 1] = bump;
      bumpImg.data[idx + 2] = bump;
      bumpImg.data[idx + 3] = 255;

      nightImg.data[idx] = night;
      nightImg.data[idx + 1] = Math.floor(night * 0.78);
      nightImg.data[idx + 2] = Math.floor(night * 0.42);
      nightImg.data[idx + 3] = 255;

      // Cloud bands with cyclonic swirl warp
      const swirlX = nx * 2.2 + Math.sin(ny * 2.1) * 0.85;
      const swirlZ = nz * 2.2 + Math.cos(nx * 1.7) * 0.85;
      const c1 = fbm2D(swirlX + 4.1, swirlZ + ny * 2.7, 5);
      const c2 = fbm2D(swirlX * 3.1 - 7.3, swirlZ * 3.1 + ny * 4.2, 3);
      const bandBoost = Math.exp(-Math.pow((absLat - 45) / 22, 2)) * 0.08 + Math.exp(-Math.pow(lat / 12, 2)) * 0.07;
      const cloudAlpha = Math.max(0, Math.min(1, (c1 * 0.75 + c2 * 0.35 + bandBoost - 0.54) * 2.45));
      const cVal = 242 + c2 * 13;

      cloudImg.data[idx] = cVal;
      cloudImg.data[idx + 1] = cVal;
      cloudImg.data[idx + 2] = 255;
      cloudImg.data[idx + 3] = Math.floor(cloudAlpha * 245);
    }
  }

  albedoCtx.putImageData(albedoImg, 0, 0);
  specCtx.putImageData(specImg, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);
  cloudCtx.putImageData(cloudImg, 0, 0);
  nightCtx.putImageData(nightImg, 0, 0);

  const configure = (canvas: HTMLCanvasElement, isColor: boolean): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;
    return tex;
  };

  const albedoMap = configure(albedoCanvas, true);
  const specularMap = configure(specCanvas, false);
  const bumpMap = configure(bumpCanvas, false);
  const cloudMap = configure(cloudCanvas, true);
  const nightLightsMap = configure(nightCanvas, true);

  return {
    albedoMap,
    specularMap,
    bumpMap,
    cloudMap,
    nightLightsMap,
    dispose: () => {
      albedoMap.dispose();
      specularMap.dispose();
      bumpMap.dispose();
      cloudMap.dispose();
      nightLightsMap.dispose();
    },
  };
}

export interface MoonTextureBundle {
  albedoMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function createMoonTextures(maxAnisotropy: number): MoonTextureBundle {
  const width = 1024;
  const height = 512;

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

  // Pre-generate deterministic lunar craters
  const craters: Array<{ u: number; v: number; r: number; depth: number; ray: boolean }> = [];
  for (let i = 0; i < 240; i++) {
    const u = hash2(i * 1.13, 7.91);
    const v = 0.12 + hash2(i * 2.71, 3.17) * 0.76;
    const isLarge = i < 24;
    const r = isLarge ? 0.028 + hash2(i, 9.1) * 0.048 : 0.004 + hash2(i, 12.3) * 0.018;
    craters.push({
      u,
      v,
      r,
      depth: isLarge ? 0.85 : 0.45 + hash2(i, 5.5) * 0.4,
      ray: i < 5,
    });
  }

  for (let y = 0; y < height; y++) {
    const v = y / height;
    const lat = 90 - v * 180;
    const cosLat = Math.max(0.15, Math.cos((lat * Math.PI) / 180));

    for (let x = 0; x < width; x++) {
      const u = x / width;
      const idx = (y * width + x) * 4;
      const angle = u * Math.PI * 2;
      const nx = Math.cos(angle) * cosLat * 4.2;
      const nz = Math.sin(angle) * cosLat * 4.2;
      const ny = (lat / 90) * 4.2;

      const mariaNoise = fbm2D(nx * 0.9 + 2.3, nz * 0.9 + ny * 0.8, 5);
      const regolith = fbm2D(nx * 6.5 - 4.1, nz * 6.5 + ny * 5.2, 4);
      const micro = fbm2D(nx * 18.0, nz * 18.0 + ny * 16.0, 2);

      // Basalt maria plains (dark lunar seas)
      const mariaMask = Math.max(0, Math.min(1, (mariaNoise - 0.44) * 3.1));
      let heightVal = 0.52 + (1 - mariaMask) * 0.16 + (regolith - 0.5) * 0.15 + (micro - 0.5) * 0.05;
      let albedoVal = 0.46 + (1 - mariaMask) * 0.25 + (regolith - 0.5) * 0.11 + (micro - 0.5) * 0.04;

      // Apply craters
      for (let c = 0; c < craters.length; c++) {
        const cr = craters[c];
        let du = Math.abs(u - cr.u);
        if (du > 0.5) du = 1 - du;
        du *= cosLat;
        const dv = v - cr.v;
        const dist = Math.sqrt(du * du + dv * dv);

        if (dist < cr.r * 2.4) {
          const nd = dist / cr.r;
          if (nd < 0.78) {
            // Bowl depression
            const bowl = 1 - (nd / 0.78) * (nd / 0.78);
            heightVal -= bowl * 0.26 * cr.depth;
            albedoVal -= bowl * 0.04;
          } else if (nd < 1.15) {
            // Raised crater rim
            const rim = Math.sin(((nd - 0.78) / 0.37) * Math.PI);
            heightVal += rim * 0.14 * cr.depth;
            albedoVal += rim * 0.09;
          } else if (cr.ray) {
            // Bright ejecta rays (Tycho/Copernicus style)
            const ang = Math.atan2(dv, du);
            const rayPattern = Math.max(0, Math.sin(ang * 11 + cr.u * 20) * Math.cos(ang * 7));
            const fade = 1 - (nd - 1.15) / 1.25;
            albedoVal += rayPattern * fade * 0.14;
          }
        }
      }

      const shade = Math.floor(Math.min(255, Math.max(38, albedoVal * 255)));
      const bump = Math.floor(Math.min(255, Math.max(0, heightVal * 255)));

      albedoImg.data[idx] = shade;
      albedoImg.data[idx + 1] = shade;
      albedoImg.data[idx + 2] = Math.min(255, shade + 3);
      albedoImg.data[idx + 3] = 255;

      bumpImg.data[idx] = bump;
      bumpImg.data[idx + 1] = bump;
      bumpImg.data[idx + 2] = bump;
      bumpImg.data[idx + 3] = 255;
    }
  }

  albedoCtx.putImageData(albedoImg, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.ClampToEdgeWrapping;
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = maxAnisotropy;
  albedoMap.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.anisotropy = maxAnisotropy;
  bumpMap.needsUpdate = true;

  return {
    albedoMap,
    bumpMap,
    dispose: () => {
      albedoMap.dispose();
      bumpMap.dispose();
    },
  };
}

export interface SpriteAndSurfaceTextures {
  smokeTexture: THREE.CanvasTexture;
  glowTexture: THREE.CanvasTexture;
  contactShadowTexture: THREE.CanvasTexture;
  concreteTexture: THREE.CanvasTexture;
  rocketHullTexture: THREE.CanvasTexture;
  shuttleTileTexture: THREE.CanvasTexture;
  dispose: () => void;
}

export function createSurfaceAndSpriteTextures(maxAnisotropy: number): SpriteAndSurfaceTextures {
  // 1. Soft billowing smoke sprite
  const smokeCanvas = document.createElement('canvas');
  smokeCanvas.width = 256;
  smokeCanvas.height = 256;
  const sCtx = smokeCanvas.getContext('2d')!;
  const sImg = sCtx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const dx = (x - 128) / 128;
      const dy = (y - 128) / 128;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const n = fbm2D(x * 0.045 + 3.2, y * 0.045 + 9.1, 4);
      const falloff = Math.max(0, 1 - dist);
      const alpha = Math.pow(falloff, 1.45) * (0.55 + n * 0.65);
      const shade = Math.floor(228 + n * 27);
      const idx = (y * 256 + x) * 4;
      sImg.data[idx] = shade;
      sImg.data[idx + 1] = shade;
      sImg.data[idx + 2] = Math.min(255, shade + 4);
      sImg.data[idx + 3] = Math.floor(Math.min(1, alpha) * 255);
    }
  }
  sCtx.putImageData(sImg, 0, 0);
  const smokeTexture = new THREE.CanvasTexture(smokeCanvas);
  smokeTexture.colorSpace = THREE.SRGBColorSpace;

  // 2. Soft radial engine/exhaust glow sprite
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 256;
  glowCanvas.height = 256;
  const gCtx = glowCanvas.getContext('2d')!;
  const grad = gCtx.createRadialGradient(128, 128, 2, 128, 128, 128);
  grad.addColorStop(0.0, 'rgba(255, 252, 240, 1)');
  grad.addColorStop(0.22, 'rgba(255, 215, 130, 0.9)');
  grad.addColorStop(0.55, 'rgba(255, 135, 45, 0.42)');
  grad.addColorStop(1.0, 'rgba(255, 80, 10, 0)');
  gCtx.fillStyle = grad;
  gCtx.fillRect(0, 0, 256, 256);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;

  // 3. Radial contact shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const shCtx = shadowCanvas.getContext('2d')!;
  const shGrad = shCtx.createRadialGradient(128, 128, 10, 128, 128, 128);
  shGrad.addColorStop(0, 'rgba(0,0,0,0.85)');
  shGrad.addColorStop(0.6, 'rgba(0,0,0,0.35)');
  shGrad.addColorStop(1, 'rgba(0,0,0,0)');
  shCtx.fillStyle = shGrad;
  shCtx.fillRect(0, 0, 256, 256);
  const contactShadowTexture = new THREE.CanvasTexture(shadowCanvas);

  // 4. Concrete launchpad surface
  const concCanvas = document.createElement('canvas');
  concCanvas.width = 512;
  concCanvas.height = 512;
  const cCtx = concCanvas.getContext('2d')!;
  cCtx.fillStyle = '#8b8f91';
  cCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4000; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    const v = 115 + Math.floor(Math.random() * 45);
    cCtx.fillStyle = `rgb(${v},${v + 1},${v + 2})`;
    cCtx.fillRect(px, py, 2, 2);
  }
  cCtx.strokeStyle = 'rgba(45,48,50,0.35)';
  cCtx.lineWidth = 2;
  for (let g = 0; g < 512; g += 64) {
    cCtx.beginPath();
    cCtx.moveTo(g, 0);
    cCtx.lineTo(g, 512);
    cCtx.stroke();
    cCtx.beginPath();
    cCtx.moveTo(0, g);
    cCtx.lineTo(512, g);
    cCtx.stroke();
  }
  const concreteTexture = new THREE.CanvasTexture(concCanvas);
  concreteTexture.wrapS = THREE.RepeatWrapping;
  concreteTexture.wrapT = THREE.RepeatWrapping;
  concreteTexture.repeat.set(8, 8);
  concreteTexture.colorSpace = THREE.SRGBColorSpace;
  concreteTexture.anisotropy = maxAnisotropy;

  // 5. Rocket hull panel texture with vertical stringers & Saturn-V roll stripes
  const hullCanvas = document.createElement('canvas');
  hullCanvas.width = 512;
  hullCanvas.height = 512;
  const hCtx = hullCanvas.getContext('2d')!;
  hCtx.fillStyle = '#f2f4f7';
  hCtx.fillRect(0, 0, 512, 512);
  // Subtle vertical corrugation lines
  for (let x = 0; x < 512; x += 8) {
    hCtx.fillStyle = x % 16 === 0 ? 'rgba(180,190,205,0.22)' : 'rgba(255,255,255,0.35)';
    hCtx.fillRect(x, 0, 3, 512);
  }
  // Horizontal ring frames
  hCtx.fillStyle = 'rgba(120,130,145,0.28)';
  for (let y = 0; y < 512; y += 64) {
    hCtx.fillRect(0, y, 512, 2);
  }
  // Classic black roll-pattern blocks on bottom half
  hCtx.fillStyle = '#15181e';
  for (let q = 0; q < 4; q++) {
    if (q % 2 === 0) {
      hCtx.fillRect(q * 128, 360, 128, 152);
    }
  }
  // Upper black collar band
  hCtx.fillRect(0, 28, 512, 34);
  // USA vertical marking
  hCtx.fillStyle = '#b91c1c';
  hCtx.fillRect(46, 175, 10, 88);
  hCtx.fillStyle = '#111827';
  hCtx.font = 'bold 26px sans-serif';
  hCtx.fillText('UNITED', 240, 200);
  hCtx.fillText('STATES', 240, 232);

  const rocketHullTexture = new THREE.CanvasTexture(hullCanvas);
  rocketHullTexture.wrapS = THREE.RepeatWrapping;
  rocketHullTexture.wrapT = THREE.ClampToEdgeWrapping;
  rocketHullTexture.colorSpace = THREE.SRGBColorSpace;
  rocketHullTexture.anisotropy = maxAnisotropy;

  // 6. Orbiter Thermal Protection Tile Texture (for belly & wing edges)
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = 512;
  tileCanvas.height = 512;
  const tCtx = tileCanvas.getContext('2d')!;
  tCtx.fillStyle = '#1b1d22';
  tCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 16) {
    const offset = (y / 16) % 2 === 0 ? 0 : 8;
    for (let x = -16; x < 512; x += 16) {
      const shade = 22 + Math.floor(Math.random() * 16);
      tCtx.fillStyle = `rgb(${shade},${shade + 1},${shade + 3})`;
      tCtx.fillRect(x + offset + 1, y + 1, 14, 14);
    }
  }
  const shuttleTileTexture = new THREE.CanvasTexture(tileCanvas);
  shuttleTileTexture.wrapS = THREE.RepeatWrapping;
  shuttleTileTexture.wrapT = THREE.RepeatWrapping;
  shuttleTileTexture.repeat.set(3, 3);
  shuttleTileTexture.colorSpace = THREE.SRGBColorSpace;
  shuttleTileTexture.anisotropy = maxAnisotropy;

  return {
    smokeTexture,
    glowTexture,
    contactShadowTexture,
    concreteTexture,
    rocketHullTexture,
    shuttleTileTexture,
    dispose: () => {
      smokeTexture.dispose();
      glowTexture.dispose();
      contactShadowTexture.dispose();
      concreteTexture.dispose();
      rocketHullTexture.dispose();
      shuttleTileTexture.dispose();
    },
  };
}
