import * as THREE from 'three';
import {
  APOLLO_SUN_DIR,
  FULL_MOON_SUN_DIR,
  MOON_CENTER,
} from './constants';

interface CameraKeyframe {
  t: number;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

const KEYFRAMES: CameraKeyframe[] = [
  // SHOT 1: The Moon Approach (0.00 -> 0.21)
  {
    t: 0.0,
    pos: new THREE.Vector3(-1350, 10800, 10200),
    target: MOON_CENTER.clone(),
    fov: 42,
  },
  {
    t: 0.11,
    pos: new THREE.Vector3(-1150, 6200, 6400),
    target: MOON_CENTER.clone(),
    fov: 42,
  },
  {
    t: 0.21,
    pos: new THREE.Vector3(-750, 2900, 3400),
    target: MOON_CENTER.clone(),
    fov: 42,
  },

  // SHOT 2: Orbital Experience (0.21 -> 0.45)
  {
    t: 0.29,
    pos: new THREE.Vector3(1280, 2720, 2650),
    target: MOON_CENTER.clone(),
    fov: 43,
  },
  {
    t: 0.37,
    pos: new THREE.Vector3(2120, 1880, 1120),
    target: MOON_CENTER.clone(),
    fov: 43,
  },
  {
    t: 0.45,
    pos: new THREE.Vector3(820, 1820, 520),
    target: MOON_CENTER.clone(),
    fov: 44,
  },

  // SHOT 3: Cinematic Descent (0.45 -> 0.68) — logarithmic altitude stepping
  {
    t: 0.5,
    pos: new THREE.Vector3(340, 860, 290),
    target: new THREE.Vector3(0, -880, 0),
    fov: 44,
  },
  {
    t: 0.55,
    pos: new THREE.Vector3(120, 320, 145),
    target: new THREE.Vector3(0, -240, 0),
    fov: 45,
  },
  {
    t: 0.6,
    pos: new THREE.Vector3(34, 92, 58),
    target: new THREE.Vector3(-1.0, -18, -2.0),
    fov: 45,
  },
  {
    t: 0.64,
    pos: new THREE.Vector3(8.5, 22, 20),
    target: new THREE.Vector3(-0.6, 0.8, -2.2),
    fov: 45,
  },
  {
    t: 0.68,
    pos: new THREE.Vector3(1.25, 1.85, 6.4),
    target: new THREE.Vector3(-0.35, 1.25, -1.8),
    fov: 45,
  },

  // SHOT 4: Apollo 11 Historical Scene (0.68 -> 0.86)
  {
    t: 0.77,
    pos: new THREE.Vector3(0.4, 1.48, 5.15),
    target: new THREE.Vector3(-0.35, 1.18, -2.1),
    fov: 45,
  },
  {
    t: 0.86,
    pos: new THREE.Vector3(-0.3, 1.52, 5.45),
    target: new THREE.Vector3(-0.45, 1.22, -2.2),
    fov: 46,
  },

  // SHOT 5: Final Cinematic Composition (0.86 -> 1.00)
  {
    t: 0.93,
    pos: new THREE.Vector3(1.15, 2.05, 8.2),
    target: new THREE.Vector3(-0.75, 1.25, -2.8),
    fov: 48,
  },
  {
    t: 1.0,
    pos: new THREE.Vector3(2.1, 2.45, 11.2),
    target: new THREE.Vector3(-1.05, 1.22, -3.2),
    fov: 49,
  },
];

// Build time-parameterized Catmull-Rom curves using cumulative time-distance mapping
// so spline velocity respects the exact t timestamps of our keyframes.
const posCurve = new THREE.CatmullRomCurve3(
  KEYFRAMES.map((k) => k.pos),
  false,
  'centripetal',
  0.5,
);
const targetCurve = new THREE.CatmullRomCurve3(
  KEYFRAMES.map((k) => k.target),
  false,
  'centripetal',
  0.5,
);

const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();

function mapTimeToSplineU(t: number): number {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  const segCount = KEYFRAMES.length - 1;
  for (let i = 0; i < segCount; i++) {
    const k0 = KEYFRAMES[i];
    const k1 = KEYFRAMES[i + 1];
    if (clamped <= k1.t || i === segCount - 1) {
      const localT = THREE.MathUtils.clamp(
        (clamped - k0.t) / Math.max(1e-5, k1.t - k0.t),
        0,
        1,
      );
      // Gentle ease near Shot 1 start & Shot 5 settle; linear continuous flow through mid-shots
      const eased =
        i === 0
          ? localT * localT * (3 - 2 * localT) * 0.55 + localT * 0.45
          : i === segCount - 1
            ? 1 - Math.pow(1 - localT, 1.65)
            : localT;
      return (i + eased) / segCount;
    }
  }
  return 1;
}

export interface EvaluatedChoreography {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  sunDirection: THREE.Vector3;
  moonRotationY: number;
  starExposure: number;
}

export function evaluateChoreography(
  t: number,
  out: EvaluatedChoreography,
): EvaluatedChoreography {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  const u = mapTimeToSplineU(clamped);

  posCurve.getPoint(u, out.position);
  targetCurve.getPoint(u, out.target);

  // Interpolate FOV smoothly across keyframes
  let fov = KEYFRAMES[KEYFRAMES.length - 1].fov;
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (clamped <= KEYFRAMES[i + 1].t) {
      const localT = THREE.MathUtils.clamp(
        (clamped - KEYFRAMES[i].t) / (KEYFRAMES[i + 1].t - KEYFRAMES[i].t),
        0,
        1,
      );
      const s = localT * localT * (3 - 2 * localT);
      fov = THREE.MathUtils.lerp(KEYFRAMES[i].fov, KEYFRAMES[i + 1].fov, s);
      break;
    }
  }
  out.fov = fov;

  // Smoothly sweep solar illumination from Shot 1 near-full Moon angle to Apollo 11 low morning angle
  const sunBlend = THREE.MathUtils.smoothstep(clamped, 0.22, 0.56);
  _p0.copy(FULL_MOON_SUN_DIR);
  _p1.copy(APOLLO_SUN_DIR);
  out.sunDirection.copy(_p0).lerp(_p1, sunBlend).normalize();

  // Gentle axial rotation during Shot 2 Orbital Experience that smoothly locks back to 0 before Shot 3 descent
  const rotWindow =
    THREE.MathUtils.smoothstep(clamped, 0.2, 0.31) *
    (1 - THREE.MathUtils.smoothstep(clamped, 0.37, 0.49));
  out.moonRotationY = Math.sin(rotWindow * Math.PI * 0.5) * 0.16;

  // Stars are vivid in deep space (Shots 1-3) and realistically subtle against sunlit lunar ground (Shots 4-5)
  const surfaceFactor = THREE.MathUtils.smoothstep(clamped, 0.58, 0.72);
  out.starExposure = THREE.MathUtils.lerp(1.0, 0.22, surfaceFactor);

  return out;
}
