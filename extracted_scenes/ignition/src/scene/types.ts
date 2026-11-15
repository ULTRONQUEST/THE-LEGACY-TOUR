import * as THREE from 'three';

export type ShotId =
  | 'launch-centre'
  | 'rocket-reveal'
  | 'countdown-ignition'
  | 'liftoff'
  | 'atmosphere-ascent'
  | 'earth-from-space'
  | 'earth-departure'
  | 'moon-appears'
  | 'lunar-handover';

export interface ShotDefinition {
  id: ShotId;
  index: number;
  title: string;
  subtitle: string;
  startTime: number;
  endTime: number;
}

export interface TimelineState {
  currentTime: number;
  duration: number;
  progress: number;
  isPlaying: boolean;
  isComplete: boolean;
  playbackSpeed: number;
  activeShot: ShotDefinition;
  altitudeKm: number;
  velocityKms: number;
  missionClockLabel: string;
}

/**
 * Canonical Moon Handover Pose at t = TOTAL_DURATION.
 * Exported so the main THE LEGACY TOUR application can initialize
 * its existing Moon exploration scene from this exact camera, moon,
 * lighting, and spacecraft continuity frame with zero visual discontinuity.
 */
export interface MoonHandoverPose {
  moonCenter: THREE.Vector3;
  moonRadius: number;
  sunDirection: THREE.Vector3;
  cameraPosition: THREE.Vector3;
  cameraTarget: THREE.Vector3;
  cameraFov: number;
  spacecraftPosition: THREE.Vector3;
  spacecraftQuaternion: THREE.Quaternion;
  approachVelocity: THREE.Vector3;
}

export interface DepartureSceneCallbacks {
  onTimelineUpdate?: (state: TimelineState) => void;
  onHandoverReady?: (pose: MoonHandoverPose) => void;
  onComplete?: (pose: MoonHandoverPose) => void;
}

export interface DepartureSceneHandle {
  play: () => void;
  pause: () => void;
  replay: () => void;
  seek: (timeSeconds: number) => void;
  seekToShot: (shotIndex: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setAudioEnabled: (enabled: boolean) => void;
  getHandoverPose: () => MoonHandoverPose;
  dispose: () => void;
}

export const TOTAL_DURATION = 78;

export const SHOTS: ShotDefinition[] = [
  {
    id: 'launch-centre',
    index: 0,
    title: '01. The Grand Launch Centre',
    subtitle: 'Coastal Launch Complex 39 · Sunrise Preparation',
    startTime: 0,
    endTime: 9,
  },
  {
    id: 'rocket-reveal',
    index: 1,
    title: '02. The Rocket Reveal',
    subtitle: 'Heavy Launch Vehicle · Full Stack Inspection',
    startTime: 9,
    endTime: 17,
  },
  {
    id: 'countdown-ignition',
    index: 2,
    title: '03. Countdown & Ignition',
    subtitle: 'Main Engine Ignition Sequence · Thrust Buildup',
    startTime: 17,
    endTime: 24,
  },
  {
    id: 'liftoff',
    index: 3,
    title: '04. The Moment of Liftoff',
    subtitle: 'Tower Clearance · Positive Rate of Climb',
    startTime: 24,
    endTime: 34,
  },
  {
    id: 'atmosphere-ascent',
    index: 4,
    title: '05. Ascending Through Atmosphere',
    subtitle: 'Max-Q & First Stage Separation',
    startTime: 34,
    endTime: 45,
  },
  {
    id: 'earth-from-space',
    index: 5,
    title: '06. Earth From Space',
    subtitle: 'Orbital Insertion · Planetary Horizon',
    startTime: 45,
    endTime: 55,
  },
  {
    id: 'earth-departure',
    index: 6,
    title: '07. The Departure From Earth',
    subtitle: 'Trans-Lunar Injection · Leaving Home Orbit',
    startTime: 55,
    endTime: 63,
  },
  {
    id: 'moon-appears',
    index: 7,
    title: '08. The Moon Appears',
    subtitle: 'Deep Space Transit · Target Acquisition',
    startTime: 63,
    endTime: 71,
  },
  {
    id: 'lunar-handover',
    index: 8,
    title: '09. Lunar Approach Handover',
    subtitle: 'Entering Lunar Orbit · Sequence Handover Ready',
    startTime: 71,
    endTime: 78,
  },
];

export const WORLD_CONSTANTS = {
  EARTH_RADIUS: 1800,
  EARTH_CENTER: new THREE.Vector3(0, -1815, 0),
  MOON_RADIUS: 620,
  MOON_CENTER: new THREE.Vector3(-2200, 180, -10400),
  SUN_DIRECTION: new THREE.Vector3(0.74, 0.65, 0.17).normalize(),
};
