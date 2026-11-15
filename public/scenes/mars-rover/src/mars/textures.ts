import * as THREE from 'three';
import { ASSET_PATHS } from './constants';

export interface MarsTextureSet {
  marsAlbedo: THREE.CanvasTexture;
  marsBump: THREE.CanvasTexture;
  marsRoughness: THREE.CanvasTexture;
  moonAlbedo: THREE.CanvasTexture;
  moonBump: THREE.CanvasTexture;
  marsLandTex: THREE.Texture | null;
  marsValleysTex: THREE.Texture | null;
  marsViewTex: THREE.Texture | null;
  solarCellTex: THREE.CanvasTexture;
  kaptonTex: THREE.CanvasTexture;
  regolithAlbedo: THREE.CanvasTexture;
  regolithBump: THREE.CanvasTexture;
  softParticleTex: THREE.CanvasTexture;
}

// Fast deterministic 2D hash & value noise for procedural planetary geology
function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
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

function fbm(x: number, y: number, octaves = 5): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * noise2(x * freq, y * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return val;
}

// 3D noise for seamless spherical mapping without UV seam pinch
function noise3(x: number, y: number, z: number): number {
  return (
    noise2(x * 1.7 + z * 0.9, y * 1.7 - z * 0.6) * 0.5 +
    noise2(y * 1.3 - x * 0.8, z * 1.9 + x * 0.5) * 0.5
  );
}

function fbm3(x: number, y: number, z: number, octaves = 5): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * noise3(x * freq, y * freq, z * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return val;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function loadThreeTexture(
  loader: THREE.TextureLoader,
  url: string,
  srgb = true
): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    loader.load(
      url,
      (tex) => {
        if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      () => resolve(null)
    );
  });
}

function configureTexture(
  tex: THREE.CanvasTexture,
  maxAnisotropy: number,
  isColor = true
): THREE.CanvasTexture {
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Synthesizes seamless 360° equirectangular Mars Albedo, Bump, and Roughness maps
 * by sampling & de-lighting the uploaded MARS_3-D_IMAGE reference globe and blending
 * seamlessly with multi-octave cratered basaltic highlands and canyon formations.
 */
function buildMarsMaps(
  refImg: HTMLImageElement | null,
  maxAnisotropy: number
): {
  marsAlbedo: THREE.CanvasTexture;
  marsBump: THREE.CanvasTexture;
  marsRoughness: THREE.CanvasTexture;
} {
  const width = 1536;
  const height = 768;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const aCtx = albedoCanvas.getContext('2d')!;
  const aImg = aCtx.createImageData(width, height);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bCtx = bumpCanvas.getContext('2d')!;
  const bImg = bCtx.createImageData(width, height);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const rCtx = roughCanvas.getContext('2d')!;
  const rImg = rCtx.createImageData(width, height);

  // Sample uploaded MARS_3-D_IMAGE if available
  let refData: Uint8ClampedArray | null = null;
  let refSize = 0;
  if (refImg) {
    refSize = 512;
    const rc = document.createElement('canvas');
    rc.width = refSize;
    rc.height = refSize;
    const rctx = rc.getContext('2d')!;
    rctx.drawImage(refImg, 0, 0, refSize, refSize);
    refData = rctx.getImageData(0, 0, refSize, refSize).data;
  }

  // Deterministic crater catalog on Mars sphere
  const craters: Array<{ x: number; y: number; z: number; r: number; depth: number }> = [];
  for (let i = 0; i < 65; i++) {
    const u = hash2(i, 11.3);
    const v = hash2(i, 29.7);
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const radius = 0.025 + Math.pow(hash2(i, 71.1), 2.4) * 0.11;
    craters.push({
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.cos(phi),
      z: Math.sin(phi) * Math.sin(theta),
      r: radius,
      depth: 0.4 + hash2(i, 93.7) * 0.6,
    });
  }

  // Prominent hero crater matching MARS_3-D_IMAGE & MARS_VIEW
  craters.unshift({
    x: -0.18,
    y: 0.28,
    z: 0.943,
    r: 0.095,
    depth: 1.0,
  });

  // Sun direction in the reference MARS_3-D_IMAGE (upper-left illumination)
  const refSunX = -0.68;
  const refSunY = 0.42;
  const refSunZ = 0.60;

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const lat = (0.5 - v) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);

    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const lon = (u - 0.5) * Math.PI * 2;
      const sx = cosLat * Math.sin(lon);
      const sy = sinLat;
      const sz = cosLat * Math.cos(lon);

      // Base procedural Martian geology
      const continent = fbm3(sx * 2.2 + 1.4, sy * 2.2 - 0.8, sz * 2.2 + 0.5, 5);
      const fine = fbm3(sx * 9.5, sy * 9.5, sz * 9.5, 4);
      const micro = fbm3(sx * 26.0, sy * 26.0, sz * 26.0, 3);

      // Dark basaltic regions (Syrtis-like) vs ochre dust plains
      const basaltMask = THREE.MathUtils.smoothstep(continent + (fine - 0.5) * 0.25, 0.52, 0.72);

      // Canyon system scar near equator
      const canyonDist = Math.abs(lat + 0.14 + Math.sin(lon * 2.5) * 0.07);
      const canyonLonMask = Math.max(0, Math.cos((lon + 0.6) * 1.4));
      const canyonFactor =
        canyonLonMask * Math.exp(-(canyonDist * canyonDist) / 0.0018) * (0.6 + fine * 0.4);

      // Crater elevation & rim shading
      let craterHeight = 0;
      let craterEjecta = 0;
      for (let c = 0; c < craters.length; c++) {
        const cr = craters[c];
        const dx = sx - cr.x;
        const dy = sy - cr.y;
        const dz = sz - cr.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < cr.r * 1.65) {
          const t = dist / cr.r;
          if (t < 0.78) {
            const bowl = 1 - (t / 0.78) * (t / 0.78);
            craterHeight -= bowl * 0.42 * cr.depth;
          } else if (t < 1.18) {
            const rim = Math.sin(((t - 0.78) / 0.4) * Math.PI);
            craterHeight += rim * 0.22 * cr.depth;
            craterEjecta += rim * 0.18;
          } else {
            const ejectaFade = 1 - (t - 1.18) / 0.47;
            craterEjecta += ejectaFade * 0.12 * (0.5 + fine);
          }
        }
      }

      // Procedural Mars palette (matches MARS_3-D_IMAGE warm rust-ochre + dark basalt)
      let r = 196 + (fine - 0.5) * 34 + (micro - 0.5) * 18;
      let g = 114 + (fine - 0.5) * 24 + (micro - 0.5) * 12;
      let b = 68 + (fine - 0.5) * 16;

      // Dark basaltic plains
      r = THREE.MathUtils.lerp(r, 98 + fine * 22, basaltMask * 0.78);
      g = THREE.MathUtils.lerp(g, 58 + fine * 14, basaltMask * 0.78);
      b = THREE.MathUtils.lerp(b, 44 + fine * 10, basaltMask * 0.78);

      // Bright dusty highlands & crater ejecta streaks
      const dustHighlight = THREE.MathUtils.smoothstep(0.45 - continent, 0.0, 0.25) + craterEjecta;
      r = THREE.MathUtils.lerp(r, 226, Math.min(0.65, dustHighlight * 0.55));
      g = THREE.MathUtils.lerp(g, 152, Math.min(0.65, dustHighlight * 0.55));
      b = THREE.MathUtils.lerp(b, 102, Math.min(0.65, dustHighlight * 0.55));

      // Deep canyon shadow tint
      r = THREE.MathUtils.lerp(r, 82, canyonFactor * 0.65);
      g = THREE.MathUtils.lerp(g, 42, canyonFactor * 0.65);
      b = THREE.MathUtils.lerp(b, 28, canyonFactor * 0.65);

      // Blend front sunlit hemisphere from uploaded MARS_3-D_IMAGE_4bb32701.png
      if (refData && sz > 0.05) {
        // Orthographic coordinates of reference sphere (radius ~0.445 of canvas)
        const nx = sx;
        const ny = sy;
        const px = Math.round((0.5 + nx * 0.435) * (refSize - 1));
        const py = Math.round((0.5 - ny * 0.435) * (refSize - 1));
        if (px >= 0 && px < refSize && py >= 0 && py < refSize) {
          const ri = (py * refSize + px) * 4;
          const rr = refData[ri];
          const rg = refData[ri + 1];
          const rb = refData[ri + 2];
          // Exclude white background halo around the reference globe
          const isNotWhiteBg = !(rr > 235 && rg > 235 && rb > 235);
          const sunDot = sx * refSunX + sy * refSunY + sz * refSunZ;
          // Only sample well-lit regions so we don't bake the dark terminator
          if (isNotWhiteBg && sunDot > 0.18) {
            const irradiance = Math.max(0.42, Math.pow(sunDot, 0.58));
            const delitR = Math.min(242, rr / irradiance);
            const delitG = Math.min(210, rg / irradiance);
            const delitB = Math.min(180, rb / irradiance);

            const edgeFade = THREE.MathUtils.smoothstep(sz, 0.08, 0.48);
            const termFade = THREE.MathUtils.smoothstep(sunDot, 0.18, 0.52);
            const blend = edgeFade * termFade * 0.88;

            r = THREE.MathUtils.lerp(r, delitR, blend);
            g = THREE.MathUtils.lerp(g, delitG, blend);
            b = THREE.MathUtils.lerp(b, delitB, blend);
          }
        }
      }

      // Subtle polar CO2/water ice caps
      const polar = THREE.MathUtils.smoothstep(Math.abs(sy) + (fine - 0.5) * 0.06, 0.91, 0.985);
      r = THREE.MathUtils.lerp(r, 232, polar * 0.72);
      g = THREE.MathUtils.lerp(g, 218, polar * 0.72);
      b = THREE.MathUtils.lerp(b, 206, polar * 0.72);

      const idx = (y * width + x) * 4;
      aImg.data[idx] = Math.max(0, Math.min(255, r));
      aImg.data[idx + 1] = Math.max(0, Math.min(255, g));
      aImg.data[idx + 2] = Math.max(0, Math.min(255, b));
      aImg.data[idx + 3] = 255;

      const elev = Math.max(
        0,
        Math.min(
          255,
          128 + (continent - 0.5) * 70 + (fine - 0.5) * 48 + craterHeight * 110 - canyonFactor * 60
        )
      );
      bImg.data[idx] = elev;
      bImg.data[idx + 1] = elev;
      bImg.data[idx + 2] = elev;
      bImg.data[idx + 3] = 255;

      const rough = Math.max(150, Math.min(250, 215 - basaltMask * 25 + micro * 25));
      rImg.data[idx] = rough;
      rImg.data[idx + 1] = rough;
      rImg.data[idx + 2] = rough;
      rImg.data[idx + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  return {
    marsAlbedo: configureTexture(new THREE.CanvasTexture(albedoCanvas), maxAnisotropy, true),
    marsBump: configureTexture(new THREE.CanvasTexture(bumpCanvas), maxAnisotropy, false),
    marsRoughness: configureTexture(new THREE.CanvasTexture(roughCanvas), maxAnisotropy, false),
  };
}

function buildMoonMaps(maxAnisotropy: number): {
  moonAlbedo: THREE.CanvasTexture;
  moonBump: THREE.CanvasTexture;
} {
  const width = 1024;
  const height = 512;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const aCtx = albedoCanvas.getContext('2d')!;
  const aImg = aCtx.createImageData(width, height);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bCtx = bumpCanvas.getContext('2d')!;
  const bImg = bCtx.createImageData(width, height);

  const craters: Array<{ x: number; y: number; z: number; r: number }> = [];
  for (let i = 0; i < 80; i++) {
    const theta = hash2(i, 3.7) * Math.PI * 2;
    const phi = Math.acos(2 * hash2(i, 8.9) - 1);
    craters.push({
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.cos(phi),
      z: Math.sin(phi) * Math.sin(theta),
      r: 0.03 + Math.pow(hash2(i, 41.2), 2.2) * 0.14,
    });
  }

  for (let y = 0; y < height; y++) {
    const lat = (0.5 - y / (height - 1)) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);

    for (let x = 0; x < width; x++) {
      const lon = (x / (width - 1) - 0.5) * Math.PI * 2;
      const sx = cosLat * Math.sin(lon);
      const sy = sinLat;
      const sz = cosLat * Math.cos(lon);

      const maria = fbm3(sx * 1.9 + 2.0, sy * 1.9, sz * 1.9 - 1.2, 5);
      const detail = fbm3(sx * 14.0, sy * 14.0, sz * 14.0, 4);
      const mareMask = THREE.MathUtils.smoothstep(maria, 0.46, 0.64);

      let craterH = 0;
      let rayBright = 0;
      for (let c = 0; c < craters.length; c++) {
        const cr = craters[c];
        const dx = sx - cr.x;
        const dy = sy - cr.y;
        const dz = sz - cr.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < cr.r * 1.6) {
          const t = d / cr.r;
          if (t < 0.8) {
            craterH -= (1 - (t / 0.8) * (t / 0.8)) * 0.45;
          } else if (t < 1.15) {
            craterH += Math.sin(((t - 0.8) / 0.35) * Math.PI) * 0.25;
            rayBright += 0.16;
          }
        }
      }

      const highland = 166 + (detail - 0.5) * 42 + rayBright * 48;
      const mare = 78 + (detail - 0.5) * 24;
      const lum = Math.max(35, Math.min(230, THREE.MathUtils.lerp(highland, mare, mareMask)));

      const idx = (y * width + x) * 4;
      aImg.data[idx] = lum;
      aImg.data[idx + 1] = lum * 0.99;
      aImg.data[idx + 2] = lum * 0.97;
      aImg.data[idx + 3] = 255;

      const elev = Math.max(0, Math.min(255, 128 + (detail - 0.5) * 60 + craterH * 120 - mareMask * 32));
      bImg.data[idx] = elev;
      bImg.data[idx + 1] = elev;
      bImg.data[idx + 2] = elev;
      bImg.data[idx + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  return {
    moonAlbedo: configureTexture(new THREE.CanvasTexture(albedoCanvas), maxAnisotropy, true),
    moonBump: configureTexture(new THREE.CanvasTexture(bumpCanvas), maxAnisotropy, false),
  };
}

function buildSolarCellTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep photovoltaic blue-charcoal base
  ctx.fillStyle = '#0d182b';
  ctx.fillRect(0, 0, 512, 512);

  // Individual solar wafer grid
  const cols = 8;
  const rows = 12;
  const cw = 512 / cols;
  const ch = 512 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw;
      const y = r * ch;
      const shade = 12 + Math.floor(hash2(c, r) * 14);
      ctx.fillStyle = `rgb(${shade}, ${shade + 16}, ${shade + 42})`;
      ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4);

      // Fine silver finger lines
      ctx.strokeStyle = 'rgba(180, 200, 225, 0.22)';
      ctx.lineWidth = 1;
      for (let f = 1; f < 4; f++) {
        ctx.beginPath();
        ctx.moveTo(x + 3, y + (ch * f) / 4);
        ctx.lineTo(x + cw - 3, y + (ch * f) / 4);
        ctx.stroke();
      }
    }
  }

  // Gold/copper structural busbars
  ctx.strokeStyle = 'rgba(205, 165, 90, 0.6)';
  ctx.lineWidth = 2;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cw, 0);
    ctx.lineTo(c * cw, 512);
    ctx.stroke();
  }

  // Subtle Martian dust film around outer perimeter (historical Opportunity detail)
  const dustGrad = ctx.createRadialGradient(256, 256, 110, 256, 256, 320);
  dustGrad.addColorStop(0, 'rgba(184, 102, 56, 0.04)');
  dustGrad.addColorStop(0.75, 'rgba(184, 102, 56, 0.16)');
  dustGrad.addColorStop(1, 'rgba(176, 94, 48, 0.36)');
  ctx.fillStyle = dustGrad;
  ctx.fillRect(0, 0, 512, 512);

  const tex = configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, true);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function buildKaptonTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(256, 256);

  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const n1 = fbm(x * 0.09, y * 0.09, 4);
      const crinkle = Math.abs(fbm(x * 0.16 + 4.1, y * 0.16 - 2.3, 3) - 0.5) * 2.0;
      const v = Math.floor(110 + n1 * 70 + crinkle * 65);
      const idx = (y * 256 + x) * 4;
      img.data[idx] = v;
      img.data[idx + 1] = v;
      img.data[idx + 2] = v;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = configureTexture(new THREE.CanvasTexture(canvas), maxAnisotropy, false);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function buildRegolithMaps(maxAnisotropy: number): {
  regolithAlbedo: THREE.CanvasTexture;
  regolithBump: THREE.CanvasTexture;
} {
  const size = 512;
  const aCanvas = document.createElement('canvas');
  aCanvas.width = size;
  aCanvas.height = size;
  const aCtx = aCanvas.getContext('2d')!;
  const aImg = aCtx.createImageData(size, size);

  const bCanvas = document.createElement('canvas');
  bCanvas.width = size;
  bCanvas.height = size;
  const bCtx = bCanvas.getContext('2d')!;
  const bImg = bCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ripple = Math.sin(x * 0.08 + fbm(x * 0.03, y * 0.03, 3) * 5.0) * 0.5 + 0.5;
      const grit = fbm(x * 0.14, y * 0.14, 4);
      const pebble = hash2(x, y) > 0.985 ? 0.35 : 0;

      const r = 178 + (grit - 0.5) * 44 + ripple * 16 - pebble * 45;
      const g = 92 + (grit - 0.5) * 28 + ripple * 10 - pebble * 28;
      const b = 52 + (grit - 0.5) * 18 - pebble * 18;

      const idx = (y * size + x) * 4;
      aImg.data[idx] = Math.max(0, Math.min(255, r));
      aImg.data[idx + 1] = Math.max(0, Math.min(255, g));
      aImg.data[idx + 2] = Math.max(0, Math.min(255, b));
      aImg.data[idx + 3] = 255;

      const h = Math.max(0, Math.min(255, 110 + ripple * 45 + (grit - 0.5) * 70 + pebble * 80));
      bImg.data[idx] = h;
      bImg.data[idx + 1] = h;
      bImg.data[idx + 2] = h;
      bImg.data[idx + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const regolithAlbedo = configureTexture(new THREE.CanvasTexture(aCanvas), maxAnisotropy, true);
  regolithAlbedo.wrapS = THREE.RepeatWrapping;
  regolithAlbedo.wrapT = THREE.RepeatWrapping;
  regolithAlbedo.repeat.set(16, 16);

  const regolithBump = configureTexture(new THREE.CanvasTexture(bCanvas), maxAnisotropy, false);
  regolithBump.wrapS = THREE.RepeatWrapping;
  regolithBump.wrapT = THREE.RepeatWrapping;
  regolithBump.repeat.set(16, 16);

  return { regolithAlbedo, regolithBump };
}

function buildSoftParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.28, 'rgba(255,235,215,0.65)');
  grad.addColorStop(0.68, 'rgba(240,180,130,0.16)');
  grad.addColorStop(1, 'rgba(240,180,130,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export async function loadAndBuildTextures(
  maxAnisotropy: number,
  onProgress?: (pct: number) => void
): Promise<MarsTextureSet> {
  onProgress?.(10);
  const loader = new THREE.TextureLoader();

  const [marsRefImg, marsLandTex, marsValleysTex, marsViewTex] = await Promise.all([
    loadImage(ASSET_PATHS.marsGlobeRef),
    loadThreeTexture(loader, ASSET_PATHS.marsLandRef, true),
    loadThreeTexture(loader, ASSET_PATHS.marsValleysAlpha, true),
    loadThreeTexture(loader, ASSET_PATHS.marsOrbitalRef, true),
  ]);

  if (marsLandTex) marsLandTex.anisotropy = Math.min(8, maxAnisotropy);
  if (marsValleysTex) marsValleysTex.anisotropy = Math.min(8, maxAnisotropy);

  onProgress?.(55);
  const { marsAlbedo, marsBump, marsRoughness } = buildMarsMaps(marsRefImg, maxAnisotropy);

  onProgress?.(75);
  const { moonAlbedo, moonBump } = buildMoonMaps(maxAnisotropy);
  const solarCellTex = buildSolarCellTexture(maxAnisotropy);
  const kaptonTex = buildKaptonTexture(maxAnisotropy);
  const { regolithAlbedo, regolithBump } = buildRegolithMaps(maxAnisotropy);
  const softParticleTex = buildSoftParticleTexture();

  onProgress?.(100);

  return {
    marsAlbedo,
    marsBump,
    marsRoughness,
    moonAlbedo,
    moonBump,
    marsLandTex,
    marsValleysTex,
    marsViewTex,
    solarCellTex,
    kaptonTex,
    regolithAlbedo,
    regolithBump,
    softParticleTex,
  };
}
