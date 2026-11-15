import * as THREE from 'three';

// Deterministic PRNG for consistent cosmic & planetary procedural detail
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fast 2D value noise + FBM
function hash2(ix: number, iy: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function noise2(x: number, y: number): number {
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

function fbm2(x: number, y: number, octaves = 5): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * noise2(x * freq, y * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return val;
}

// Spherical seamless noise via 3D-like projection to avoid equirectangular seam
function sphereFbm(lonRad: number, latRad: number, scale: number, octaves = 5): number {
  const cx = Math.cos(latRad) * Math.cos(lonRad) * scale;
  const cy = Math.sin(latRad) * scale;
  const cz = Math.cos(latRad) * Math.sin(lonRad) * scale;
  return (
    fbm2(cx + cz * 0.7 + 13.7, cy - cz * 0.5 + 7.3, octaves) * 0.65 +
    fbm2(cz * 1.1 - 4.2, cy * 1.1 + cx * 0.6 + 19.1, Math.max(2, octaves - 1)) * 0.35
  );
}

// Major continental polygons in [lonDeg, latDeg]
const CONTINENT_POLYGONS: Array<Array<[number, number]>> = [
  // North America
  [
    [-168, 65], [-160, 71], [-135, 70], [-115, 72], [-95, 74], [-80, 68],
    [-75, 62], [-64, 58], [-55, 51], [-66, 44], [-75, 36], [-80, 26],
    [-82, 29], [-89, 30], [-97, 26], [-96, 19], [-88, 21], [-83, 10],
    [-78, 8], [-85, 11], [-94, 15], [-105, 20], [-112, 28], [-117, 32],
    [-124, 41], [-125, 49], [-136, 58], [-152, 60], [-165, 59],
  ],
  // Greenland
  [
    [-55, 60], [-42, 60], [-28, 70], [-18, 78], [-32, 83], [-58, 82],
    [-70, 77], [-58, 70],
  ],
  // South America
  [
    [-78, 9], [-71, 12], [-61, 10], [-50, 1], [-35, -6], [-38, -14],
    [-40, -22], [-48, -28], [-54, -34], [-63, -41], [-67, -52], [-70, -55],
    [-75, -48], [-73, -36], [-71, -18], [-77, -12], [-81, -5], [-79, 2],
  ],
  // Africa
  [
    [-17, 15], [-13, 28], [-6, 36], [10, 37], [12, 33], [25, 32],
    [33, 31], [38, 22], [43, 12], [51, 11], [48, 2], [41, -4],
    [40, -15], [35, -24], [28, -33], [19, -35], [15, -26], [12, -14],
    [9, 4], [2, 6], [-8, 5], [-16, 11],
  ],
  // Madagascar
  [
    [44, -25], [47, -25], [50, -13], [48, -12], [44, -18],
  ],
  // Europe + Eurasia main body
  [
    [-9, 37], [-9, 43], [-2, 43], [-5, 48], [2, 51], [8, 54],
    [10, 58], [5, 61], [15, 69], [28, 71], [42, 68], [60, 70],
    [75, 73], [105, 77], [135, 72], [168, 67], [178, 65], [162, 59],
    [156, 51], [142, 53], [135, 44], [129, 40], [126, 35], [122, 39],
    [118, 38], [122, 31], [116, 22], [108, 17], [109, 11], [104, 8],
    [100, 13], [97, 16], [91, 22], [82, 15], [77, 8], [72, 20],
    [66, 25], [56, 26], [51, 28], [59, 22], [54, 17], [44, 13],
    [35, 29], [35, 36], [27, 37], [26, 41], [23, 37], [19, 40],
    [14, 45], [16, 40], [12, 42], [9, 44], [3, 42], [-5, 36],
  ],
  // UK & Ireland
  [
    [-6, 50], [2, 51], [0, 56], [-5, 58], [-8, 54],
  ],
  // Japan
  [
    [130, 31], [134, 33], [140, 36], [142, 41], [145, 44], [140, 44],
    [137, 38], [131, 34],
  ],
  // Sumatra & Java
  [
    [95, 5], [104, -1], [106, -6], [114, -8], [114, -9], [103, -6], [98, 1],
  ],
  // Borneo
  [
    [109, -3], [117, -3], [119, 5], [115, 6], [110, 1],
  ],
  // Papua New Guinea
  [
    [132, -2], [141, -3], [150, -10], [144, -9], [136, -5],
  ],
  // Australia (prominent in EARTH_VIEW_39c5af0f.png!)
  [
    [114, -22], [122, -17], [130, -12], [136, -12], [136, -15],
    [141, -17], [142, -11], [146, -18], [153, -26], [150, -37],
    [144, -38], [138, -35], [131, -32], [122, -34], [115, -34],
    [114, -27],
  ],
  // New Zealand
  [
    [167, -46], [172, -41], [178, -38], [175, -35], [172, -39], [169, -44],
  ],
  // Antarctica
  [
    [-180, -72], [-120, -74], [-62, -64], [-40, -75], [0, -70],
    [60, -68], [120, -67], [165, -74], [180, -72], [180, -90], [-180, -90],
  ],
];

// Point in polygon test
function pointInPoly(lon: number, lat: number, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Minimum approximate distance to polygon edges for smooth coastal falloff
function distToPoly(lon: number, lat: number, poly: Array<[number, number]>): number {
  let minDistSq = 1e9;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], ay = poly[j][1];
    const bx = poly[i][0], by = poly[i][1];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy + 1e-6;
    const t = Math.max(0, Math.min(1, ((lon - ax) * dx + (lat - ay) * dy) / lenSq));
    const px = ax + t * dx;
    const py = ay + t * dy;
    const distSq = (lon - px) * (lon - px) + (lat - py) * (lat - py);
    if (distSq < minDistSq) minDistSq = distSq;
  }
  return Math.sqrt(minDistSq);
}

// Major metropolitan clusters [lonDeg, latDeg, intensity, radiusDeg] for realistic night lights
const CITY_CENTERS: Array<[number, number, number, number]> = [
  [-74, 40.7, 1.0, 5.5], [-87.6, 41.8, 0.9, 5.0], [-118.2, 34.0, 0.95, 4.5],
  [-122.4, 37.7, 0.8, 3.5], [-80.2, 25.8, 0.75, 3.5], [-95.3, 29.7, 0.85, 4.5],
  [-99.1, 19.4, 0.9, 3.5], [-79.4, 43.6, 0.85, 4.0], [-46.6, -23.5, 0.95, 4.5],
  [-43.2, -22.9, 0.8, 3.0], [-58.4, -34.6, 0.85, 3.5], [-70.6, -33.4, 0.65, 2.5],
  [-0.1, 51.5, 1.0, 4.5], [2.35, 48.8, 1.0, 5.0], [13.4, 52.5, 0.9, 5.5],
  [9.2, 45.4, 0.95, 4.5], [-3.7, 40.4, 0.85, 4.0], [37.6, 55.7, 0.95, 5.0],
  [29.0, 41.0, 0.85, 3.5], [31.2, 30.0, 1.0, 4.0], [32.6, 25.7, 0.6, 3.0],
  [3.4, 6.5, 0.75, 3.5], [28.0, -26.2, 0.8, 3.5], [55.3, 25.2, 0.85, 3.5],
  [46.7, 24.7, 0.7, 3.0], [72.8, 19.1, 1.0, 5.0], [77.2, 28.6, 1.0, 6.0],
  [88.3, 22.6, 0.85, 4.5], [77.6, 13.0, 0.8, 4.0], [100.5, 13.7, 0.85, 3.5],
  [106.8, -6.2, 0.9, 4.0], [103.8, 1.3, 0.85, 2.8], [121.0, 14.6, 0.75, 3.0],
  [116.4, 39.9, 1.0, 6.0], [121.5, 31.2, 1.0, 6.0], [113.3, 23.1, 1.0, 5.0],
  [104.0, 30.6, 0.8, 4.5], [127.0, 37.5, 0.95, 3.5], [139.7, 35.7, 1.0, 4.5],
  [135.5, 34.7, 0.9, 3.5], [151.2, -33.8, 0.8, 3.0], [144.9, -37.8, 0.75, 2.8],
  [115.8, -31.9, 0.55, 2.2], [174.7, -36.8, 0.55, 2.2],
];

export interface EarthTextureSet {
  dayMap: THREE.CanvasTexture;
  nightMap: THREE.CanvasTexture;
  specularMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  cloudsMap: THREE.CanvasTexture;
}

export function createEarthTextures(maxAnisotropy: number, isSoftwareGl: boolean): EarthTextureSet {
  const W = isSoftwareGl ? 1024 : 2048;
  const H = isSoftwareGl ? 512 : 1024;

  const dayCanvas = document.createElement('canvas');
  dayCanvas.width = W;
  dayCanvas.height = H;
  const dayCtx = dayCanvas.getContext('2d')!;
  const dayImg = dayCtx.createImageData(W, H);

  const nightCanvas = document.createElement('canvas');
  nightCanvas.width = W;
  nightCanvas.height = H;
  const nightCtx = nightCanvas.getContext('2d')!;
  const nightImg = nightCtx.createImageData(W, H);

  const specCanvas = document.createElement('canvas');
  specCanvas.width = W;
  specCanvas.height = H;
  const specCtx = specCanvas.getContext('2d')!;
  const specImg = specCtx.createImageData(W, H);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = W;
  bumpCanvas.height = H;
  const bumpCtx = bumpCanvas.getContext('2d')!;
  const bumpImg = bumpCtx.createImageData(W, H);

  const cloudsCanvas = document.createElement('canvas');
  cloudsCanvas.width = W;
  cloudsCanvas.height = H;
  const cloudsCtx = cloudsCanvas.getContext('2d')!;
  const cloudsImg = cloudsCtx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const latDeg = 90 - v * 180;
    const latRad = (latDeg * Math.PI) / 180;
    const absLat = Math.abs(latDeg);

    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const lonDeg = u * 360 - 180;
      const lonRad = (lonDeg * Math.PI) / 180;
      const idx = (y * W + x) * 4;

      // Perturb lon/lat slightly with FBM for natural jagged coastlines
      const coastWarp = (sphereFbm(lonRad, latRad, 4.2, 4) - 0.5) * 7.5;
      const coastWarpY = (sphereFbm(lonRad + 1.9, latRad, 4.5, 4) - 0.5) * 4.5;
      const wLon = lonDeg + coastWarp;
      const wLat = latDeg + coastWarpY;

      let insideLand = false;
      let minEdge = 99;
      for (let p = 0; p < CONTINENT_POLYGONS.length; p++) {
        const poly = CONTINENT_POLYGONS[p];
        if (pointInPoly(wLon, wLat, poly)) {
          insideLand = true;
          minEdge = Math.min(minEdge, distToPoly(wLon, wLat, poly));
          break;
        } else if (absLat < 72) {
          const d = distToPoly(wLon, wLat, poly);
          if (d < minEdge) minEdge = d;
        }
      }

      const detailNoise = sphereFbm(lonRad, latRad, 9.5, 5);
      const microNoise = sphereFbm(lonRad + 3.1, latRad - 1.2, 22.0, 3);

      // Polar ice sheets
      const polarIce = absLat > 77 + (detailNoise - 0.5) * 8;

      if (insideLand || polarIce) {
        // Elevation
        const inlandFactor = Math.min(1, minEdge / 10);
        const ridge = Math.pow(Math.max(0, 1 - Math.abs(detailNoise - 0.5) * 3.8), 2);
        const elevation = Math.min(1, inlandFactor * 0.45 + ridge * 0.55 + microNoise * 0.15);

        // Biome coloring (realistic, natural documentary tones, not oversaturated)
        const moisture = sphereFbm(lonRad + 5.4, latRad + 2.1, 3.8, 4);
        const isDesertBelt =
          ((absLat > 15 && absLat < 35) &&
            ((lonDeg > -15 && lonDeg < 62) || // Sahara + Arabia
              (lonDeg > 115 && lonDeg < 145 && latDeg < -18) || // Outback
              (lonDeg > -118 && lonDeg < -102 && latDeg > 22 && latDeg < 38) || // SW US/Mexico
              (lonDeg > 55 && lonDeg < 105 && latDeg > 35 && latDeg < 46))) || // Gobi/Central Asia
          false;

        let r = 38, g = 66, b = 36; // Temperate forest

        if (polarIce || (absLat > 66 && elevation > 0.35)) {
          // Snow / ice
          r = 228; g = 234; b = 240;
        } else if (isDesertBelt && moisture < 0.62) {
          // Arid sandstone / ochre / desert (like Australian Outback in reference)
          const arid = 0.7 + microNoise * 0.3;
          r = Math.round(156 * arid);
          g = Math.round(124 * arid);
          b = Math.round(82 * arid);
        } else if (absLat < 16 && moisture > 0.44) {
          // Deep tropical rainforest
          r = Math.round(28 + microNoise * 16);
          g = Math.round(58 + microNoise * 20);
          b = Math.round(28 + microNoise * 12);
        } else if (elevation > 0.72) {
          // High alpine / rocky peaks
          const snow = Math.min(1, (elevation - 0.72) * 3.5);
          r = Math.round(92 + snow * 128);
          g = Math.round(88 + snow * 134);
          b = Math.round(84 + snow * 142);
        } else {
          // Temperate / grassland / boreal
          const greenMix = Math.max(0, Math.min(1, moisture * 1.2 - 0.1));
          r = Math.round(62 + (1 - greenMix) * 58 + microNoise * 14);
          g = Math.round(78 + (1 - greenMix) * 30 + microNoise * 18);
          b = Math.round(44 + (1 - greenMix) * 18 + microNoise * 10);
        }

        dayImg.data[idx] = r;
        dayImg.data[idx + 1] = g;
        dayImg.data[idx + 2] = b;
        dayImg.data[idx + 3] = 255;

        const specVal = polarIce ? 105 : 16;
        specImg.data[idx] = specVal;
        specImg.data[idx + 1] = specVal;
        specImg.data[idx + 2] = specVal;
        specImg.data[idx + 3] = 255;

        const bumpVal = Math.round(128 + elevation * 125);
        bumpImg.data[idx] = bumpVal;
        bumpImg.data[idx + 1] = bumpVal;
        bumpImg.data[idx + 2] = bumpVal;
        bumpImg.data[idx + 3] = 255;

        // Night city lights
        let city = 0;
        if (!polarIce && absLat < 64) {
          for (let c = 0; c < CITY_CENTERS.length; c++) {
            const [clon, clat, cint, crad] = CITY_CENTERS[c];
            const dl = Math.abs(lonDeg - clon);
            const dlat = Math.abs(latDeg - clat);
            if (dl < crad * 2.2 && dlat < crad * 2.2) {
              const dist = Math.sqrt(dl * dl + dlat * dlat);
              const falloff = Math.exp(-(dist * dist) / (crad * crad * 0.48));
              const urbanNet = Math.pow(Math.max(0, microNoise * 1.15 - 0.18), 1.6);
              city = Math.max(city, falloff * cint * (0.45 + urbanNet * 0.95));
            }
          }
          // Subtle coastal sprawl
          if (minEdge < 1.8 && absLat < 55 && microNoise > 0.58) {
            city = Math.max(city, (microNoise - 0.58) * 0.85);
          }
        }
        const cLum = Math.min(1, city);
        nightImg.data[idx] = Math.round(255 * cLum);
        nightImg.data[idx + 1] = Math.round(192 * cLum);
        nightImg.data[idx + 2] = Math.round(98 * cLum);
        nightImg.data[idx + 3] = 255;
      } else {
        // Deep sapphire ocean + turquoise continental shelf
        const shelf = Math.max(0, 1 - minEdge / 3.2);
        const depthVar = detailNoise * 0.18;
        const r = Math.round(6 + shelf * 14 + depthVar * 8);
        const g = Math.round(26 + shelf * 46 + depthVar * 16);
        const b = Math.round(66 + shelf * 52 + depthVar * 26);

        dayImg.data[idx] = r;
        dayImg.data[idx + 1] = g;
        dayImg.data[idx + 2] = b;
        dayImg.data[idx + 3] = 255;

        specImg.data[idx] = 235;
        specImg.data[idx + 1] = 235;
        specImg.data[idx + 2] = 235;
        specImg.data[idx + 3] = 255;

        bumpImg.data[idx] = 110;
        bumpImg.data[idx + 1] = 110;
        bumpImg.data[idx + 2] = 110;
        bumpImg.data[idx + 3] = 255;

        nightImg.data[idx] = 0;
        nightImg.data[idx + 1] = 0;
        nightImg.data[idx + 2] = 0;
        nightImg.data[idx + 3] = 255;
      }

      // Dynamic realistic planetary cloud formations (swirls + trade wind bands)
      const swirl = sphereFbm(lonRad + Math.sin(latRad * 3) * 0.18, latRad, 3.6, 5);
      const wisp = sphereFbm(lonRad * 1.4 + swirl * 1.2, latRad + swirl * 0.45, 8.5, 4);
      const bandBoost =
        Math.exp(-Math.pow((absLat - 4) / 10, 2)) * 0.14 + // ITCZ
        Math.exp(-Math.pow((absLat - 48) / 16, 2)) * 0.16; // Mid-lat storm tracks
      const rawCloud = swirl * 0.58 + wisp * 0.42 + bandBoost;
      const cloudAlpha = Math.max(0, Math.min(1, (rawCloud - 0.5) * 2.55));
      const cVal = Math.round(238 + wisp * 17);
      cloudsImg.data[idx] = cVal;
      cloudsImg.data[idx + 1] = cVal;
      cloudsImg.data[idx + 2] = 255;
      cloudsImg.data[idx + 3] = Math.round(cloudAlpha * 238);
    }
  }

  dayCtx.putImageData(dayImg, 0, 0);
  nightCtx.putImageData(nightImg, 0, 0);
  specCtx.putImageData(specImg, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);
  cloudsCtx.putImageData(cloudsImg, 0, 0);

  const dayMap = new THREE.CanvasTexture(dayCanvas);
  dayMap.colorSpace = THREE.SRGBColorSpace;
  dayMap.wrapS = THREE.RepeatWrapping;
  dayMap.anisotropy = maxAnisotropy;

  const nightMap = new THREE.CanvasTexture(nightCanvas);
  nightMap.colorSpace = THREE.SRGBColorSpace;
  nightMap.wrapS = THREE.RepeatWrapping;
  nightMap.anisotropy = maxAnisotropy;

  const specularMap = new THREE.CanvasTexture(specCanvas);
  specularMap.wrapS = THREE.RepeatWrapping;
  specularMap.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  const cloudsMap = new THREE.CanvasTexture(cloudsCanvas);
  cloudsMap.colorSpace = THREE.SRGBColorSpace;
  cloudsMap.wrapS = THREE.RepeatWrapping;
  cloudsMap.anisotropy = maxAnisotropy;

  return { dayMap, nightMap, specularMap, bumpMap, cloudsMap };
}

export function createGoldenRecordTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  const grad = ctx.createRadialGradient(cx * 0.85, cy * 0.85, 10, cx, cy, size * 0.5);
  grad.addColorStop(0, '#ffe899');
  grad.addColorStop(0.55, '#d4a63a');
  grad.addColorStop(1, '#8c6618');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Concentric record grooves
  ctx.strokeStyle = 'rgba(72, 48, 8, 0.35)';
  ctx.lineWidth = 1.2;
  for (let r = 36; r < size * 0.48; r += 6) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Etched scientific diagrams (stylized Golden Record cover engravings)
  ctx.strokeStyle = 'rgba(55, 36, 4, 0.82)';
  ctx.lineWidth = 2.2;

  // Top-left phonograph circle
  ctx.beginPath();
  ctx.arc(cx - 88, cy - 82, 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - 88, cy - 82, 12, 0, Math.PI * 2);
  ctx.stroke();

  // Top-right binary wave diagram
  ctx.strokeRect(cx + 38, cy - 118, 96, 68);
  ctx.beginPath();
  ctx.moveTo(cx + 46, cy - 84);
  for (let i = 0; i < 8; i++) {
    ctx.lineTo(cx + 46 + i * 11, i % 2 === 0 ? cy - 100 : cy - 68);
  }
  ctx.stroke();

  // Bottom-left pulsar map (14 radiating lines)
  const px = cx - 80;
  const py = cy + 78;
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    const len = 34 + ((i * 19) % 36);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
    ctx.stroke();
  }

  // Bottom-right hydrogen hyperfine transition circles
  ctx.beginPath();
  ctx.arc(cx + 58, cy + 78, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 112, cy + 78, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 80, cy + 78);
  ctx.lineTo(cx + 90, cy + 78);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createFoilBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n1 = fbm2(x * 0.045, y * 0.045, 4);
      const crinkle = Math.abs(n1 - 0.5) * 2.0;
      const val = Math.round(80 + (1 - crinkle) * 165);
      const idx = (y * size + x) * 4;
      img.data[idx] = val;
      img.data[idx + 1] = val;
      img.data[idx + 2] = val;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSolarPanelTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0c1a36';
  ctx.fillRect(0, 0, size, size);

  // Subtle cell gradients
  const cols = 8;
  const rows = 16;
  const cw = size / cols;
  const ch = size / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#112349' : '#0f1f40';
      ctx.fillRect(c * cw + 2, r * ch + 2, cw - 4, ch - 4);
      // Silver busbars
      ctx.fillStyle = 'rgba(175, 200, 235, 0.28)';
      ctx.fillRect(c * cw + cw * 0.48, r * ch + 2, 1.5, ch - 4);
    }
  }

  // Frame grid lines
  ctx.strokeStyle = '#384c6b';
  ctx.lineWidth = 2;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cw, 0);
    ctx.lineTo(c * cw, size);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * ch);
    ctx.lineTo(size, r * ch);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createRadialGlowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(240,248,255,0.72)');
  grad.addColorStop(0.45, 'rgba(180,215,255,0.20)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// High-resolution procedural documentary memory paintings for Shot 3
export function createMemoryPlateTexture(
  kind: 'apollo' | 'iss' | 'mars' | 'voyager' | 'telescope' | 'earthsat',
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const W = 1024;
  const H = 576;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(kind.length * 9173 + kind.charCodeAt(0) * 131);

  // Deep archival space backdrop
  ctx.fillStyle = '#04070f';
  ctx.fillRect(0, 0, W, H);

  const drawStars = (count: number, alphaMax = 0.8) => {
    for (let i = 0; i < count; i++) {
      const sx = rand() * W;
      const sy = rand() * H;
      const sr = 0.6 + rand() * 1.4;
      ctx.fillStyle = `rgba(225, 238, 255, ${0.2 + rand() * alphaMax})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (kind === 'apollo') {
    drawStars(70, 0.45);
    // Distant Earth crescent in the lunar black sky
    const earthGrad = ctx.createRadialGradient(780, 145, 5, 780, 145, 34);
    earthGrad.addColorStop(0, '#9bd2ff');
    earthGrad.addColorStop(0.6, '#2b6cb0');
    earthGrad.addColorStop(1, 'rgba(10,30,60,0)');
    ctx.fillStyle = earthGrad;
    ctx.beginPath();
    ctx.arc(780, 145, 34, 0, Math.PI * 2);
    ctx.fill();

    // Lunar horizon terrain
    const terrainGrad = ctx.createLinearGradient(0, 320, 0, H);
    terrainGrad.addColorStop(0, '#4b5058');
    terrainGrad.addColorStop(0.3, '#6e737b');
    terrainGrad.addColorStop(1, '#26292e');
    ctx.fillStyle = terrainGrad;
    ctx.beginPath();
    ctx.moveTo(0, 355);
    for (let x = 0; x <= W; x += 24) {
      ctx.lineTo(x, 345 + Math.sin(x * 0.008) * 16 + Math.cos(x * 0.021) * 7);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Crater ellipses
    for (let c = 0; c < 8; c++) {
      const cx = 80 + rand() * 860;
      const cy = 385 + rand() * 160;
      const rx = 25 + rand() * 55;
      ctx.fillStyle = 'rgba(20, 22, 26, 0.45)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, rx * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Lunar Module silhouette on left-center
    ctx.fillStyle = '#c89b3c';
    ctx.fillRect(250, 265, 74, 54);
    ctx.fillStyle = '#d8dde6';
    ctx.beginPath();
    ctx.arc(287, 250, 30, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#9ea6b2';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(254, 315); ctx.lineTo(222, 378);
    ctx.moveTo(320, 315); ctx.lineTo(352, 378);
    ctx.moveTo(287, 318); ctx.lineTo(287, 384);
    ctx.stroke();

    // Apollo Astronaut silhouette + long lunar shadow
    ctx.fillStyle = 'rgba(12, 14, 18, 0.72)';
    ctx.beginPath();
    ctx.ellipse(540, 412, 95, 11, -0.05, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#eef2f6';
    ctx.fillRect(455, 326, 26, 44); // backpack + torso
    ctx.fillRect(458, 370, 9, 34); // left leg
    ctx.fillRect(470, 370, 9, 34); // right leg
    ctx.beginPath();
    ctx.arc(469, 316, 13, 0, Math.PI * 2);
    ctx.fill();
    // Gold visor reflection
    ctx.fillStyle = '#d49a2a';
    ctx.beginPath();
    ctx.arc(473, 316, 8, -0.8, 0.9);
    ctx.fill();
  } else if (kind === 'iss') {
    drawStars(110, 0.55);
    // Curved sunlit Earth limb below
    const limbGrad = ctx.createRadialGradient(512, 1280, 740, 512, 1280, 960);
    limbGrad.addColorStop(0, '#103e78');
    limbGrad.addColorStop(0.76, '#1f68b8');
    limbGrad.addColorStop(0.86, '#58b4ff');
    limbGrad.addColorStop(0.92, 'rgba(90, 180, 255, 0.15)');
    limbGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = limbGrad;
    ctx.fillRect(0, 0, W, H);

    // ISS integrated truss + pressurized modules + 8 golden-copper solar wings
    ctx.save();
    ctx.translate(512, 235);
    ctx.rotate(-0.18);
    ctx.fillStyle = '#9aa8b8';
    ctx.fillRect(-260, -4, 520, 8); // main truss
    // Modules
    ctx.fillStyle = '#e5ebf2';
    ctx.fillRect(-35, -52, 70, 18);
    ctx.fillRect(-20, -34, 40, 96);
    ctx.fillStyle = '#b8c3d0';
    ctx.fillRect(-75, -16, 150, 22);
    // Solar array wings
    const wingX = [-225, -175, 135, 185];
    for (const wx of wingX) {
      ctx.fillStyle = '#9e6828';
      ctx.fillRect(wx, -125, 34, 114);
      ctx.fillRect(wx, 11, 34, 114);
      ctx.strokeStyle = 'rgba(255, 220, 150, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(wx, -125, 34, 114);
      ctx.strokeRect(wx, 11, 34, 114);
    }
    ctx.restore();
  } else if (kind === 'mars') {
    // Rusty salmon/butterscotch Martian sky
    const sky = ctx.createLinearGradient(0, 0, 0, 340);
    sky.addColorStop(0, '#1c1110');
    sky.addColorStop(0.55, '#5b2b1d');
    sky.addColorStop(1, '#a95534');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 360);

    // Distant Gale Crater rim silhouettes
    ctx.fillStyle = '#6c3420';
    ctx.beginPath();
    ctx.moveTo(0, 310);
    ctx.lineTo(180, 255);
    ctx.lineTo(410, 290);
    ctx.lineTo(680, 240);
    ctx.lineTo(900, 278);
    ctx.lineTo(W, 250);
    ctx.lineTo(W, 380);
    ctx.lineTo(0, 380);
    ctx.closePath();
    ctx.fill();

    // Red regolith foreground
    const ground = ctx.createLinearGradient(0, 305, 0, H);
    ground.addColorStop(0, '#96472b');
    ground.addColorStop(0.5, '#71321d');
    ground.addColorStop(1, '#2b120b');
    ctx.fillStyle = ground;
    ctx.fillRect(0, 305, W, H - 305);

    // Scattered Martian rocks
    for (let i = 0; i < 24; i++) {
      const rx = rand() * W;
      const ry = 330 + rand() * 220;
      const rw = 8 + rand() * 34;
      ctx.fillStyle = '#471e12';
      ctx.beginPath();
      ctx.ellipse(rx, ry, rw, rw * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Perseverance/Curiosity style rover silhouette & warm deck
    ctx.fillStyle = '#d9dfe6';
    ctx.fillRect(435, 315, 115, 36); // chassis
    ctx.fillStyle = '#222831';
    for (const wx of [445, 492, 540]) {
      ctx.beginPath();
      ctx.arc(wx, 385, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#9aa4b2';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(455, 350); ctx.lineTo(445, 385);
    ctx.moveTo(492, 350); ctx.lineTo(492, 385);
    ctx.moveTo(530, 350); ctx.lineTo(540, 385);
    // Mast + ChemCam head
    ctx.moveTo(525, 315); ctx.lineTo(525, 258);
    ctx.stroke();
    ctx.fillStyle = '#e8edf2';
    ctx.fillRect(512, 242, 34, 18);
  } else if (kind === 'voyager') {
    // Matching VOYAGER_1_9a9c9e26.jpeg indigo-violet cosmic starfield
    const neb = ctx.createLinearGradient(0, 0, W, H);
    neb.addColorStop(0, '#100c2e');
    neb.addColorStop(0.5, '#2b1e63');
    neb.addColorStop(1, '#092447');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, W, H);
    drawStars(320, 0.9);

    // Voyager silhouette
    ctx.save();
    ctx.translate(512, 265);
    ctx.fillStyle = '#d4dae6';
    ctx.beginPath();
    ctx.ellipse(0, -45, 118, 36, -0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#101420';
    ctx.fillRect(-38, -20, 76, 54);
    ctx.strokeStyle = '#242b3d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-38, 0); ctx.lineTo(-340, -90); // Mag boom
    ctx.moveTo(38, 0); ctx.lineTo(195, -45); // Scan platform boom
    ctx.moveTo(-25, 28); ctx.lineTo(-175, 85); // RTG boom
    ctx.stroke();
    ctx.restore();
  } else if (kind === 'telescope') {
    // Deep field galaxy cluster glow
    const bg = ctx.createRadialGradient(540, 260, 20, 540, 260, 440);
    bg.addColorStop(0, 'rgba(218, 175, 108, 0.25)');
    bg.addColorStop(0.45, 'rgba(65, 105, 175, 0.16)');
    bg.addColorStop(1, 'rgba(4, 7, 15, 1)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    drawStars(260, 0.85);

    // Distant spiral galaxies
    for (let g = 0; g < 9; g++) {
      const gx = 120 + rand() * 780;
      const gy = 80 + rand() * 400;
      const gr = 12 + rand() * 28;
      const gGrad = ctx.createRadialGradient(gx, gy, 1, gx, gy, gr);
      gGrad.addColorStop(0, 'rgba(255, 228, 185, 0.9)');
      gGrad.addColorStop(0.4, 'rgba(175, 200, 255, 0.35)');
      gGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gGrad;
      ctx.beginPath();
      ctx.ellipse(gx, gy, gr, gr * 0.5, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Gold segmented hexagonal mirror silhouette (JWST-inspired)
    ctx.save();
    ctx.translate(460, 290);
    ctx.fillStyle = '#c8962e';
    const hexR = 20;
    const offsets = [
      [0, -36], [32, -18], [32, 18], [0, 36], [-32, 18], [-32, -18],
      [0, -72], [32, -54], [64, -36], [64, 0], [64, 36], [32, 54],
      [0, 72], [-32, 54], [-64, 36], [-64, 0], [-64, -36], [-32, -54],
    ];
    for (const [ox, oy] of offsets) {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        const hx = ox + Math.cos(a) * (hexR - 1.5);
        const hy = oy + Math.sin(a) * (hexR - 1.5);
        if (k === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else {
    // Earth Observation Satellite above sunlit cloud-swirled oceans
    drawStars(90, 0.45);
    const ocean = ctx.createRadialGradient(512, 1180, 680, 512, 1180, 920);
    ocean.addColorStop(0, '#0a3366');
    ocean.addColorStop(0.75, '#1d5fa3');
    ocean.addColorStop(0.88, '#62bbff');
    ocean.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, W, H);

    // Subtle hurricane cloud swirl
    ctx.strokeStyle = 'rgba(240, 248, 255, 0.32)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(630, 440, 60, 0, Math.PI * 1.4);
    ctx.stroke();

    // Satellite bus + dish + solar wing
    ctx.save();
    ctx.translate(470, 220);
    ctx.rotate(-0.12);
    ctx.fillStyle = '#d4a33a';
    ctx.fillRect(-35, -24, 70, 48);
    ctx.fillStyle = '#183466';
    ctx.fillRect(-190, -18, 145, 36);
    ctx.fillRect(45, -18, 145, 36);
    ctx.fillStyle = '#dce4ef';
    ctx.beginPath();
    ctx.arc(0, 38, 24, 0, Math.PI);
    ctx.fill();
    ctx.restore();
  }

  // Soft documentary vignette & edge feathering
  const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.22, W / 2, H / 2, W * 0.56);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(3,5,10,0.88)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}
