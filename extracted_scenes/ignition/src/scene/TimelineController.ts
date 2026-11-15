import * as THREE from 'three';
import { MoonHandoverPose, SHOTS, ShotDefinition, TOTAL_DURATION, WORLD_CONSTANTS } from './types';

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export interface EvaluatedFrame {
  time: number;
  activeShot: ShotDefinition;
  // Launch Rocket
  rocketVisible: boolean;
  rocketPosition: THREE.Vector3;
  rocketQuaternion: THREE.Quaternion;
  stage1Separated: boolean;
  stage1Offset: THREE.Vector3;
  stage1Rotation: THREE.Euler;
  f1Intensity: number;
  j2Intensity: number;
  ventIntensity: number;
  padSmokeIntensity: number;
  armRetraction: number;
  // Spacecraft Orbiter
  orbiterVisible: boolean;
  orbiterPosition: THREE.Vector3;
  orbiterQuaternion: THREE.Quaternion;
  orbiterBurnIntensity: number;
  orbiterRcsPulse: number;
  // Camera
  cameraPosition: THREE.Vector3;
  cameraTarget: THREE.Vector3;
  cameraFov: number;
  cameraShake: number;
  // Environment & Atmosphere
  skyDensity: number;
  upperSkyDarkness: number;
  starVisibility: number;
  padVisibility: number;
  earthVisibility: number;
  cloudDeckOpacity: number;
  fogDensity: number;
  sunIntensity: number;
  hemiIntensity: number;
  // Telemetry
  altitudeKm: number;
  velocityKms: number;
}

const _up = new THREE.Vector3(0, 1, 0);
const _lookMat = new THREE.Matrix4();
const _tempPos = new THREE.Vector3();
const _tempTarget = new THREE.Vector3();
const _tempDir = new THREE.Vector3();

export class TimelineController {
  // Smooth continuous splines for Rocket trajectory, Orbiter trajectory, Camera path, and Target path
  private rocketCurve: THREE.CatmullRomCurve3;
  private orbiterCurve: THREE.CatmullRomCurve3;
  private cameraCurve: THREE.CatmullRomCurve3;
  private targetCurve: THREE.CatmullRomCurve3;

  // Reusable evaluated state to avoid GC
  public readonly state: EvaluatedFrame = {
    time: 0,
    activeShot: SHOTS[0],
    rocketVisible: true,
    rocketPosition: new THREE.Vector3(),
    rocketQuaternion: new THREE.Quaternion(),
    stage1Separated: false,
    stage1Offset: new THREE.Vector3(),
    stage1Rotation: new THREE.Euler(),
    f1Intensity: 0,
    j2Intensity: 0,
    ventIntensity: 0,
    padSmokeIntensity: 0,
    armRetraction: 0,
    orbiterVisible: false,
    orbiterPosition: new THREE.Vector3(),
    orbiterQuaternion: new THREE.Quaternion(),
    orbiterBurnIntensity: 0,
    orbiterRcsPulse: 0,
    cameraPosition: new THREE.Vector3(),
    cameraTarget: new THREE.Vector3(),
    cameraFov: 46,
    cameraShake: 0,
    skyDensity: 1,
    upperSkyDarkness: 0,
    starVisibility: 0,
    padVisibility: 1,
    earthVisibility: 0,
    cloudDeckOpacity: 1,
    fogDensity: 0.00045,
    sunIntensity: 2.8,
    hemiIntensity: 0.85,
    altitudeKm: 0,
    velocityKms: 0,
  };

  constructor() {
    // 1. Rocket Trajectory (t = 24..52s mapped cleanly to s = 0..1)
    this.rocketCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 42, -1),
        new THREE.Vector3(0, 155, -14),
        new THREE.Vector3(0, 380, -85),
        new THREE.Vector3(-12, 720, -290),
        new THREE.Vector3(-45, 1060, -680),
        new THREE.Vector3(-110, 1290, -1350),
      ],
      false,
      'catmullrom',
      0.5
    );

    // 2. Orbiter Trajectory (t = 46..78s)
    // Enters smoothly in orbital cruise over sunlit Earth and departs toward Moon
    this.orbiterCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(440, 1140, -1620),  // t = 46.0 (orbital entry)
        new THREE.Vector3(380, 1080, -1930),  // t = 50.5 (Earth wide reveal)
        new THREE.Vector3(175, 995, -2610),   // t = 55.5 (Earth departure start)
        new THREE.Vector3(-310, 782, -4040),  // t = 59.5 (Trans-lunar burn, camera behind)
        new THREE.Vector3(-895, 492, -6030),  // t = 63.5 (Deep space cruise, Moon appears)
        new THREE.Vector3(-1390, 302, -7760), // t = 69.5 (Moon growing ahead)
        new THREE.Vector3(-1665, 206, -8560), // t = 78.0 (Handover lunar approach)
      ],
      false,
      'catmullrom',
      0.5
    );

    // 3. Camera Curve across all 9 shots (sampled by piecewise normalized time)
    this.cameraCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(310, 138, -245),    // 0: Shot 1 start (wide launch centre)
        new THREE.Vector3(145, 62, -135),     // 1: Shot 1 mid (aerial sweep in)
        new THREE.Vector3(52, 9, -68),        // 2: Shot 2 start (low-angle base reveal)
        new THREE.Vector3(44, 48, -56),       // 3: Shot 2 mid (traveling up rocket body)
        new THREE.Vector3(58, 52, -74),       // 4: Shot 2->3 hold (full stack pre-ignition)
        new THREE.Vector3(60, 18, -78),       // 5: Shot 3 ignition (low angle flame/smoke)
        new THREE.Vector3(55, 13, -72),       // 6: Shot 4 liftoff start (hold-down release)
        new THREE.Vector3(78, 72, -108),      // 7: Shot 4 mid (clearing red tower)
        new THREE.Vector3(115, 290, -190),    // 8: Shot 4->5 transition (aerial chase)
        new THREE.Vector3(115, 760, -410),    // 9: Shot 5 mid (max-Q & staging)
        new THREE.Vector3(150, 1140, -960),   // 10: Shot 5->6 (emerging into space)
        new THREE.Vector3(490, 1310, -2140),  // 11: Shot 6 mid (wide Earth from space)
        new THREE.Vector3(240, 1140, -2780),  // 12: Shot 6->7 (orbital sweep around orbiter)
        new THREE.Vector3(-260, 820, -3920),  // 13: Shot 7 mid (swing behind orbiter)
        new THREE.Vector3(-840, 520, -5900),  // 14: Shot 7->8 (departure vector revealed)
        new THREE.Vector3(-1320, 325, -7600), // 15: Shot 8 mid (Moon appears ahead)
        new THREE.Vector3(-1560, 235, -8260), // 16: Shot 9 end (Canonical Handover Pose!)
      ],
      false,
      'catmullrom',
      0.5
    );

    // 4. Camera Target Curve matching the exact same 17 time beats
    this.targetCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-12, 34, 15),       // 0: Shot 1 wide complex
        new THREE.Vector3(-6, 46, 0),         // 1: Shot 1 approaching rocket
        new THREE.Vector3(-2, 22, 0),         // 2: Shot 2 low rocket base
        new THREE.Vector3(-1, 66, 0),         // 3: Shot 2 upper stages
        new THREE.Vector3(-4, 52, 0),         // 4: Shot 2->3 full rocket hold
        new THREE.Vector3(-2, 22, 0),         // 5: Shot 3 engine ignition trench
        new THREE.Vector3(0, 28, 0),          // 6: Shot 4 liftoff
        new THREE.Vector3(0, 115, -8),        // 7: Shot 4 clearing tower
        new THREE.Vector3(-2, 275, -52),      // 8: Shot 4->5 ascent chase
        new THREE.Vector3(-14, 735, -295),    // 9: Shot 5 stage separation
        new THREE.Vector3(-55, 1020, -820),   // 10: Shot 5->6 upper orbit
        new THREE.Vector3(45, -220, -760),    // 11: Shot 6 Earth & Orbiter wide
        new THREE.Vector3(25, -50, -1450),    // 12: Shot 6->7 sweeping past orbiter
        new THREE.Vector3(-360, 745, -4220),  // 13: Shot 7 behind orbiter
        new THREE.Vector3(-1180, 405, -7000), // 14: Shot 7->8 looking toward Moon
        new THREE.Vector3(-1920, 225, -9480), // 15: Shot 8 Orbiter + Moon ahead
        WORLD_CONSTANTS.MOON_CENTER.clone(),  // 16: Shot 9 Canonical Moon Handover!
      ],
      false,
      'catmullrom',
      0.5
    );
  }

  // Exact timestamp anchors corresponding to the 17 spline control points
  private readonly keyTimes = [
    0, 5, 9, 13.5, 17, 21, 24, 29.5, 34.5, 40.5, 45.5, 50.5, 55.5, 59.5, 63.5, 69.5, TOTAL_DURATION,
  ];

  private readonly orbiterKeyTimes = [46.0, 50.5, 55.5, 59.5, 63.5, 69.5, TOTAL_DURATION];

  private mapTimeToCurveU(t: number, times: number[]): number {
    const n = times.length;
    if (t <= times[0]) return 0;
    if (t >= times[n - 1]) return 1;

    for (let i = 0; i < n - 1; i++) {
      const t0 = times[i];
      const t1 = times[i + 1];
      if (t >= t0 && t <= t1) {
        const local = (t - t0) / (t1 - t0);
        return (i + local) / (n - 1);
      }
    }
    return 1;
  }

  private timeToSplineU(t: number): number {
    return this.mapTimeToCurveU(t, this.keyTimes);
  }

  private timeToOrbiterU(t: number): number {
    return this.mapTimeToCurveU(t, this.orbiterKeyTimes);
  }

  public evaluate(timeInput: number): EvaluatedFrame {
    const t = Math.max(0, Math.min(TOTAL_DURATION, timeInput));
    const s = this.state;
    s.time = t;

    // Active Shot lookup
    let shot = SHOTS[SHOTS.length - 1];
    for (let i = 0; i < SHOTS.length; i++) {
      if (t < SHOTS[i].endTime) {
        shot = SHOTS[i];
        break;
      }
    }
    s.activeShot = shot;

    // =========================================================================
    // 1. LAUNCH ROCKET KINEMATICS & STAGING (t = 0..51s)
    // =========================================================================
    s.rocketVisible = t < 51.5;
    s.ventIntensity = t < 24.5 ? 1 - smoothstep(22.0, 24.5, t) : 0;

    // Engine ignition ramps up during Shot 3 (t = 19.2..23.8)
    const ignitionRamp = smoothstep(19.2, 23.4, t);
    const stagingDip = 1 - smoothstep(39.8, 40.6, t);
    s.f1Intensity = t < 41.0 ? ignitionRamp * stagingDip : 0;
    s.j2Intensity = t >= 40.4 && t < 51.0 ? smoothstep(40.4, 41.2, t) * (1 - smoothstep(49.0, 51.0, t)) : 0;

    // Pad smoke intensifies at ignition and lingers while clearing tower
    s.padSmokeIntensity =
      t >= 18.2 && t < 38.0
        ? smoothstep(18.2, 22.8, t) * (1 - smoothstep(32.0, 38.0, t))
        : 0;

    // Swing arms retract cleanly right at T-0 (t = 23.3..25.8)
    s.armRetraction = smoothstep(23.3, 25.8, t);

    if (t <= 24.0) {
      s.rocketPosition.set(0, 0, 0);
      s.rocketQuaternion.identity();
      // Subtle pre-liftoff engine buildup vibration
      if (t > 19.5) {
        const vib = smoothstep(19.5, 24.0, t) * 0.065;
        s.rocketPosition.x = Math.sin(t * 62) * vib;
        s.rocketPosition.z = Math.cos(t * 54) * vib;
      }
    } else if (t < 52.0) {
      // Smooth continuous liftoff acceleration (u=0 -> 1 over t=24..52)
      const uRaw = (t - 24.0) / 28.0;
      const uCurved = Math.pow(uRaw, 1.85);
      this.rocketCurve.getPointAt(Math.min(1, uCurved), s.rocketPosition);
      this.rocketCurve.getTangentAt(Math.min(1, uCurved), _tempDir);
      // Point rocket +Y nose axis along curve tangent
      s.rocketQuaternion.setFromUnitVectors(_up, _tempDir.normalize());
    }

    // Stage 1 separation at t = 40.5s
    if (t > 40.5 && t < 51.5) {
      const sepTime = t - 40.5;
      s.stage1Separated = true;
      s.stage1Offset.set(sepTime * 1.4, -sepTime * sepTime * 4.8 - sepTime * 7.5, sepTime * 2.5);
      s.stage1Rotation.set(sepTime * 0.14, 0, -sepTime * 0.08);
    } else {
      s.stage1Separated = false;
      s.stage1Offset.set(0, 0, 0);
      s.stage1Rotation.set(0, 0, 0);
    }

    // =========================================================================
    // 2. SPACECRAFT ORBITER KINEMATICS (t = 46..78s)
    // =========================================================================
    s.orbiterVisible = t >= 46.0;
    if (s.orbiterVisible) {
      const uOrb = this.timeToOrbiterU(t);
      this.orbiterCurve.getPointAt(uOrb, s.orbiterPosition);
      this.orbiterCurve.getTangentAt(uOrb, _tempDir);
      // Orbiter nose points along -Z locally, so lookAt aligns -Z along forward tangent
      _lookMat.lookAt(s.orbiterPosition, _tempPos.copy(s.orbiterPosition).add(_tempDir), _up);
      s.orbiterQuaternion.setFromRotationMatrix(_lookMat);

      // OMS / Main engine trans-lunar burn in Shots 6-8
      s.orbiterBurnIntensity =
        smoothstep(52.0, 56.5, t) * (1 - smoothstep(66.5, 72.5, t));
      s.orbiterRcsPulse = t > 70.0 ? smoothstep(70.0, 73.0, t) * (1 - smoothstep(76.0, 78.0, t)) : 0;
    } else {
      s.orbiterBurnIntensity = 0;
      s.orbiterRcsPulse = 0;
    }

    // =========================================================================
    // 3. CONTINUOUS CAMERA SPLINE & DYNAMIC TRACKING
    // =========================================================================
    const splineU = this.timeToSplineU(t);
    this.cameraCurve.getPointAt(splineU, s.cameraPosition);
    this.targetCurve.getPointAt(splineU, s.cameraTarget);

    // During Shot 4 & 5 ascent (t = 24..46), blend camera lookAt toward live rocket position
    // so the rocket stays framed heroically without ever lagging or cutting
    const trackRocketWeight =
      smoothstep(24.0, 27.0, t) * (1 - smoothstep(43.0, 46.5, t));
    if (trackRocketWeight > 0.001) {
      _tempTarget.copy(s.rocketPosition);
      _tempTarget.y += 32 * (1 - smoothstep(32, 43, t));
      s.cameraTarget.lerp(_tempTarget, trackRocketWeight * 0.85);
    }

    // During Shot 6->8 orbital sweep (t = 53..70), subtly keep Orbiter framed cleanly
    const trackOrbiterWeight =
      smoothstep(53.0, 56.5, t) * (1 - smoothstep(67.5, 72.5, t));
    if (trackOrbiterWeight > 0.001 && s.orbiterVisible) {
      _tempTarget.copy(s.orbiterPosition).lerp(WORLD_CONSTANTS.MOON_CENTER, smoothstep(61.0, 70.0, t) * 0.28);
      s.cameraTarget.lerp(_tempTarget, trackOrbiterWeight * 0.72);
    }

    // Smooth FOV storytelling (wide on launchpad -> dynamic chase -> grand planetary -> lunar tele)
    if (t < 17) {
      s.cameraFov = 48 - smoothstep(0, 17, t) * 3;
    } else if (t < 45) {
      s.cameraFov = 45 + smoothstep(24, 42, t) * 7;
    } else if (t < 64) {
      s.cameraFov = 52 - smoothstep(48, 64, t) * 4;
    } else {
      s.cameraFov = 48 - smoothstep(64, 78, t) * 2;
    }

    // Subtle acoustic camera rumble during ignition & tower liftoff
    s.cameraShake =
      t >= 19.5 && t <= 35.0
        ? smoothstep(19.5, 23.0, t) * (1 - smoothstep(29.0, 35.0, t)) * 0.24
        : 0;

    // =========================================================================
    // 4. ATMOSPHERE, EARTH, PAD & SPACE TRANSITIONS
    // =========================================================================
    const climbFrac = smoothstep(30.0, 46.5, t);
    s.skyDensity = 1 - smoothstep(38.0, 48.0, t);
    s.upperSkyDarkness = smoothstep(31.0, 44.0, t);
    s.starVisibility = smoothstep(39.0, 51.0, t);
    s.padVisibility = 1 - smoothstep(39.5, 47.0, t);
    s.earthVisibility = smoothstep(34.0, 43.0, t);
    s.cloudDeckOpacity = 1 - smoothstep(40.0, 47.5, t);
    s.fogDensity = 0.00042 * (1 - climbFrac);

    // Directional solar intensity & hemisphere ambient fill fade smoothly as we enter space
    s.sunIntensity = 2.6 + climbFrac * 0.6;
    s.hemiIntensity = 0.85 * (1 - smoothstep(36.0, 49.0, t)) + 0.14;

    // =========================================================================
    // 5. SCIENTIFIC TELEMETRY READOUT (Altitude & Velocity)
    // =========================================================================
    if (t < 24) {
      s.altitudeKm = 0;
      s.velocityKms = 0;
    } else if (t < 45) {
      const u = (t - 24) / 21;
      s.altitudeKm = Math.pow(u, 2.2) * 145;
      s.velocityKms = Math.pow(u, 1.35) * 4.8;
    } else if (t < 55) {
      const u = (t - 45) / 10;
      s.altitudeKm = 145 + u * 265;
      s.velocityKms = 4.8 + u * 3.0;
    } else {
      const u = (t - 55) / (TOTAL_DURATION - 55);
      s.altitudeKm = 410 + Math.pow(u, 1.45) * 384000;
      s.velocityKms = 7.8 + smoothstep(55, 63, t) * 3.1 - smoothstep(68, 78, t) * 8.4;
    }

    return s;
  }

  public getHandoverPose(): MoonHandoverPose {
    const finalState = this.evaluate(TOTAL_DURATION);
    const tangent = new THREE.Vector3();
    this.orbiterCurve.getTangentAt(1, tangent);
    return {
      moonCenter: WORLD_CONSTANTS.MOON_CENTER.clone(),
      moonRadius: WORLD_CONSTANTS.MOON_RADIUS,
      sunDirection: WORLD_CONSTANTS.SUN_DIRECTION.clone(),
      cameraPosition: finalState.cameraPosition.clone(),
      cameraTarget: finalState.cameraTarget.clone(),
      cameraFov: finalState.cameraFov,
      spacecraftPosition: finalState.orbiterPosition.clone(),
      spacecraftQuaternion: finalState.orbiterQuaternion.clone(),
      approachVelocity: tangent.normalize().multiplyScalar(2.5),
    };
  }
}
