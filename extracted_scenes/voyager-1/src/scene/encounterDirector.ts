import * as THREE from 'three';

export interface ShotDefinition {
  id: number;
  code: string;
  title: string;
  subtitle: string;
  start: number; // 0..1 normalized progress
  end: number;
}

export const ENCOUNTER_SHOTS: ShotDefinition[] = [
  {
    id: 1,
    code: '01',
    title: 'High-Speed Interstellar Travel',
    subtitle: 'Cruising beyond the heliosphere toward the outer dark.',
    start: 0.0,
    end: 0.15,
  },
  {
    id: 2,
    code: '02',
    title: 'An Unexpected Discovery',
    subtitle: 'Forty-nine years into its flight, a lone silhouette emerges ahead.',
    start: 0.15,
    end: 0.32,
  },
  {
    id: 3,
    code: '03',
    title: 'The Encounter',
    subtitle: 'Matching velocity beside humanity’s farthest emissary.',
    start: 0.32,
    end: 0.50,
  },
  {
    id: 4,
    code: '04',
    title: 'Drifting Through Interstellar Space',
    subtitle: 'Antenna locked toward a distant Sun. Motion measured in millennia.',
    start: 0.50,
    end: 0.68,
  },
  {
    id: 5,
    code: '05',
    title: 'The Golden Legacy',
    subtitle: 'Launched 1977 · Carrying Earth’s portrait into the silent void.',
    start: 0.68,
    end: 0.84,
  },
  {
    id: 6,
    code: '06',
    title: 'The Final Wide Shot',
    subtitle: 'Our journey ends here. Voyager’s journey continues.',
    start: 0.84,
    end: 1.0,
  },
];

export const TOTAL_DURATION_SECONDS = 56;

export interface EncounterFrameState {
  progress: number;
  activeShot: ShotDefinition;
  speedFactor: number; // 1.0 = max interstellar cruise, ~0.008 = matched drift
  relativeVelocityKms: number; // Tour craft relative speed vs Voyager (km/s)
  distanceMeters: number; // Separation between tour craft and Voyager (m)
  fov: number;
  thrustIntensity: number;
  spotlightIntensity: number;
  cameraPos: THREE.Vector3;
  cameraTarget: THREE.Vector3;
  voyagerPos: THREE.Vector3;
  voyagerRot: THREE.Euler;
  tourPos: THREE.Vector3;
  tourRot: THREE.Euler;
}

function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function segmentT(progress: number, start: number, end: number): number {
  return THREE.MathUtils.clamp((progress - start) / (end - start), 0, 1);
}

// Reusable scratch state returned cleanly each frame
const _state: EncounterFrameState = {
  progress: 0,
  activeShot: ENCOUNTER_SHOTS[0],
  speedFactor: 1,
  relativeVelocityKms: 420,
  distanceMeters: 220,
  fov: 62,
  thrustIntensity: 1,
  spotlightIntensity: 0,
  cameraPos: new THREE.Vector3(),
  cameraTarget: new THREE.Vector3(),
  voyagerPos: new THREE.Vector3(),
  voyagerRot: new THREE.Euler(),
  tourPos: new THREE.Vector3(),
  tourRot: new THREE.Euler(),
};

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _tA = new THREE.Vector3();
const _tB = new THREE.Vector3();

export function evaluateEncounterState(
  progress: number,
  elapsed: number,
  goldenRecordWorldHint: THREE.Vector3
): EncounterFrameState {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  _state.progress = p;

  let activeShot = ENCOUNTER_SHOTS[ENCOUNTER_SHOTS.length - 1];
  for (let i = 0; i < ENCOUNTER_SHOTS.length; i++) {
    if (p < ENCOUNTER_SHOTS[i].end || i === ENCOUNTER_SHOTS.length - 1) {
      activeShot = ENCOUNTER_SHOTS[i];
      break;
    }
  }
  _state.activeShot = activeShot;

  // -------------------------------------------------------------------------
  // 1. SPEED PROGRESSION (High-speed cruise -> Deceleration -> Matched Drift)
  // -------------------------------------------------------------------------
  let speedFactor = 1.0;
  if (p < 0.15) {
    // Shot 1: High-speed cruise
    speedFactor = THREE.MathUtils.lerp(1.0, 0.92, smootherstep(0.0, 0.15, p));
  } else if (p < 0.32) {
    // Shot 2: Discovery & initial braking
    speedFactor = THREE.MathUtils.lerp(0.92, 0.42, smootherstep(0.15, 0.32, p));
  } else if (p < 0.50) {
    // Shot 3: Final deceleration alongside Voyager
    speedFactor = THREE.MathUtils.lerp(0.42, 0.045, smootherstep(0.32, 0.50, p));
  } else if (p < 0.68) {
    // Shot 4: Matched drift
    speedFactor = THREE.MathUtils.lerp(0.045, 0.008, smootherstep(0.50, 0.62, p));
  } else {
    // Shots 5 & 6: Quiet station-keeping drift
    speedFactor = 0.008;
  }
  _state.speedFactor = speedFactor;
  _state.relativeVelocityKms = Math.max(0.0, (speedFactor - 0.008) * 485.0);

  // Thruster intensity dims cleanly as ship completes braking
  _state.thrustIntensity = THREE.MathUtils.clamp(
    smootherstep(0.015, 0.55, speedFactor) * 0.95 + 0.06,
    0.04,
    1.0
  );

  // -------------------------------------------------------------------------
  // 2. SPACECRAFT POSITIONS & ORIENTATIONS
  // -------------------------------------------------------------------------
  // Voyager sits near (1.6, 0.45, 0) once encountered, or far ahead along -Z in Shots 1-2
  const approachDistance =
    p < 0.15
      ? THREE.MathUtils.lerp(380, 240, smootherstep(0.0, 0.15, p))
      : p < 0.32
      ? THREE.MathUtils.lerp(240, 15, smootherstep(0.15, 0.32, p))
      : p < 0.48
      ? THREE.MathUtils.lerp(15, 0, smootherstep(0.32, 0.48, p))
      : 0;

  // Voyager 1 maintains stable HGA dish pointing toward Earth with ultra-subtle drift
  _state.voyagerPos.set(1.6, 0.45, -approachDistance);
  _state.voyagerRot.set(
    0.42 + Math.sin(elapsed * 0.14) * 0.008,
    -0.36 + Math.cos(elapsed * 0.11) * 0.008,
    -0.28 + Math.sin(elapsed * 0.09) * 0.006
  );

  // Tour Spacecraft position: starts centered ahead in Shot 1, then glides laterally to station-keep on port side (-X)
  const lateralPull = smootherstep(0.24, 0.48, p);
  const tourX = THREE.MathUtils.lerp(0.0, -10.8, lateralPull);
  const tourY = THREE.MathUtils.lerp(-1.4, -0.85, lateralPull) + Math.sin(elapsed * 0.45) * 0.04;
  const tourZ = THREE.MathUtils.lerp(4.0, 1.4, lateralPull);
  _state.tourPos.set(tourX, tourY, tourZ);

  // Tour ship subtle braking pitch & banking as it pulls alongside
  const bankRoll = Math.sin(smootherstep(0.24, 0.48, p) * Math.PI) * -0.14;
  _state.tourRot.set(
    0.015 * Math.sin(elapsed * 0.3),
    lateralPull * -0.04,
    bankRoll
  );

  _state.distanceMeters = _state.tourPos.distanceTo(_state.voyagerPos);

  // Encounter spotlight fades in smoothly as tour ship draws alongside
  _state.spotlightIntensity = smootherstep(0.28, 0.44, p) * (1.0 - 0.15 * smootherstep(0.84, 1.0, p)) * 4.5;

  // -------------------------------------------------------------------------
  // 3. CINEMATIC 6-SHOT CAMERA CHOREOGRAPHY
  // -------------------------------------------------------------------------
  if (p < 0.15) {
    // SHOT 1: Forward-facing perspective above bow of tour spacecraft slicing through starlight
    const t = smootherstep(0.0, 0.15, p);
    const vibX = Math.sin(elapsed * 19.0) * 0.012 * speedFactor;
    const vibY = Math.cos(elapsed * 23.0) * 0.01 * speedFactor;

    _state.cameraPos.set(
      _state.tourPos.x + THREE.MathUtils.lerp(0.0, 0.35, t) + vibX,
      _state.tourPos.y + THREE.MathUtils.lerp(2.25, 2.55, t) + vibY,
      _state.tourPos.z + THREE.MathUtils.lerp(0.8, -1.6, t)
    );
    _state.cameraTarget.set(
      THREE.MathUtils.lerp(0.0, 0.8, t),
      THREE.MathUtils.lerp(0.6, 0.4, t),
      -85
    );
    _state.fov = THREE.MathUtils.lerp(64, 57, t);
  } else if (p < 0.32) {
    // SHOT 2: Unexpected Discovery — Tiny Voyager emerges against deep purple-blue cosmos
    const t = smootherstep(0.15, 0.32, p);
    _vA.set(_state.tourPos.x + 0.35, _state.tourPos.y + 2.55, _state.tourPos.z - 1.6);
    _vB.set(3.2, -1.3, 12.5);
    _state.cameraPos.lerpVectors(_vA, _vB, t);

    _tA.set(0.8, 0.4, -85);
    _tB.copy(_state.voyagerPos).add(new THREE.Vector3(-0.3, 0.1, 0));
    _state.cameraTarget.lerpVectors(_tA, _tB, smootherstep(0.15, 0.28, p));
    _state.fov = THREE.MathUtils.lerp(57, 44, t);
  } else if (p < 0.50) {
    // SHOT 3: The Encounter — Sweep alongside both spacecraft in the same frame
    const t = smootherstep(0.32, 0.50, p);
    _vA.set(3.2, -1.3, 12.5);
    _vB.set(6.4, 2.2, 16.5);
    _state.cameraPos.lerpVectors(_vA, _vB, t);
    // Mid-arc subtle push out for cinematic sweep
    _state.cameraPos.x += Math.sin(t * Math.PI) * 3.8;
    _state.cameraPos.y -= Math.sin(t * Math.PI) * 0.8;

    _tA.copy(_state.voyagerPos);
    _tB.set(-4.2, -0.2, 0.6); // Frames both Tour Ship (-10.8) and Voyager (+1.6)
    _state.cameraTarget.lerpVectors(_tA, _tB, t);
    _state.fov = THREE.MathUtils.lerp(44, 46, t);
  } else if (p < 0.68) {
    // SHOT 4: Voyager Drifting Through Interstellar Space — Slow meditative orbit echoing reference silhouette
    const t = segmentT(p, 0.50, 0.68);
    const e = smootherstep(0.0, 1.0, t);
    // Arc from wide dual-ship framing down under Voyager's dish looking up (matching reference photo), then around scan platform
    if (t < 0.5) {
      const sub = smootherstep(0.0, 0.5, t);
      _vA.set(6.4, 2.2, 16.5);
      _vB.set(2.4, -2.5, 9.2);
      _state.cameraPos.lerpVectors(_vA, _vB, sub);

      _tA.set(-4.2, -0.2, 0.6);
      _tB.set(0.6, 0.25, 0.0);
      _state.cameraTarget.lerpVectors(_tA, _tB, sub);
    } else {
      const sub = smootherstep(0.5, 1.0, t);
      _vA.set(2.4, -2.5, 9.2);
      _vB.set(8.2, 1.5, -5.8);
      _state.cameraPos.lerpVectors(_vA, _vB, sub);

      _tA.set(0.6, 0.25, 0.0);
      _tB.set(1.5, 0.2, 0.0);
      _state.cameraTarget.lerpVectors(_tA, _tB, sub);
    }
    _state.fov = THREE.MathUtils.lerp(46, 42, e);
  } else if (p < 0.84) {
    // SHOT 5: The Golden Legacy — Intimate close-up on HGA dish & Golden Record, leaving right-side room for Legacy Panel, then gentle pull-back
    const t = segmentT(p, 0.68, 0.84);
    const rec = goldenRecordWorldHint;

    if (t < 0.55) {
      const sub = smootherstep(0.0, 0.55, t);
      _vA.set(8.2, 1.5, -5.8);
      // Close-up offset so Golden Record sits on left-center of frame, leaving right third free for Legacy info panel
      _vB.set(rec.x + 1.85, rec.y - 0.15, rec.z + 1.65);
      _state.cameraPos.lerpVectors(_vA, _vB, sub);

      _tA.set(1.5, 0.2, 0.0);
      _tB.set(rec.x + 0.52, rec.y - 0.02, rec.z - 0.15);
      _state.cameraTarget.lerpVectors(_tA, _tB, sub);
      _state.fov = THREE.MathUtils.lerp(42, 36, sub);
    } else {
      const sub = smootherstep(0.55, 1.0, t);
      _vA.set(rec.x + 1.85, rec.y - 0.15, rec.z + 1.65);
      _vB.set(5.4, 0.55, 6.2);
      _state.cameraPos.lerpVectors(_vA, _vB, sub);

      _tA.set(rec.x + 0.52, rec.y - 0.02, rec.z - 0.15);
      _tB.set(1.9, 0.2, 0.0);
      _state.cameraTarget.lerpVectors(_tA, _tB, sub);
      _state.fov = THREE.MathUtils.lerp(36, 44, sub);
    }
  } else {
    // SHOT 6: The Final Wide Shot — Pull far back into vast starfield, both vessels shrinking side by side
    const t = smootherstep(0.84, 1.0, p);
    _vA.set(5.4, 0.55, 6.2);
    _vB.set(22.0, 11.5, 86.0);
    _state.cameraPos.lerpVectors(_vA, _vB, t);

    _tA.set(1.9, 0.2, 0.0);
    _tB.set(-4.5, -0.2, 0.5);
    _state.cameraTarget.lerpVectors(_tA, _tB, t);
    _state.fov = THREE.MathUtils.lerp(44, 50, t);
  }

  return _state;
}
