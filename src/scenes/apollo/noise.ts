// Deterministic 3D value/gradient noise and lunar crater profile utilities

function fract(x: number): number {
  return x - Math.floor(x);
}

export function hash3(x: number, y: number, z: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return fract(n);
}

export function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return fract(n);
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);

  const fx = fade(x - ix);
  const fy = fade(y - iy);
  const fz = fade(z - iz);

  const c000 = hash3(ix, iy, iz);
  const c100 = hash3(ix + 1, iy, iz);
  const c010 = hash3(ix, iy + 1, iz);
  const c110 = hash3(ix + 1, iy + 1, iz);
  const c001 = hash3(ix, iy, iz + 1);
  const c101 = hash3(ix + 1, iy, iz + 1);
  const c011 = hash3(ix, iy + 1, iz + 1);
  const c111 = hash3(ix + 1, iy + 1, iz + 1);

  const x00 = lerp(c000, c100, fx);
  const x10 = lerp(c010, c110, fx);
  const x01 = lerp(c001, c101, fx);
  const x11 = lerp(c011, c111, fx);

  const y0 = lerp(x00, x10, fy);
  const y1 = lerp(x01, x11, fy);

  return lerp(y0, y1, fz) * 2 - 1;
}

export function noise2(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = fade(x - ix);
  const fy = fade(y - iy);

  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);

  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy) * 2 - 1;
}

export function fbm3(x: number, y: number, z: number, octaves = 5): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise3(x * freq, y * freq, z * freq);
    freq *= 2.04;
    amp *= 0.5;
  }
  return value;
}

export function fbm2(x: number, y: number, octaves = 4): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise2(x * freq, y * freq);
    freq *= 2.07;
    amp *= 0.5;
  }
  return value;
}

/**
 * Realistic lunar impact crater elevation profile for normalized radial distance d = dist / radius.
 * Returns normalized displacement in [-1, +0.35].
 */
export function craterProfile(d: number, hasCentralPeak = false): number {
  if (d >= 1.55) return 0;

  if (d < 0.84) {
    // Smooth parabolic bowl
    const t = d / 0.84;
    let bowl = (t * t - 1.0) * 0.85;
    if (hasCentralPeak && d < 0.25) {
      const p = 1.0 - d / 0.25;
      bowl += p * p * 0.34;
    }
    return bowl;
  }

  // Raised crater rim peaking around d = 0.96, tapering out cleanly to 1.55
  if (d < 1.0) {
    const t = (d - 0.84) / 0.16;
    return Math.sin(t * Math.PI * 0.5) * 0.28;
  }

  const t = (d - 1.0) / 0.55;
  const falloff = 1.0 - t;
  return 0.28 * falloff * falloff;
}
