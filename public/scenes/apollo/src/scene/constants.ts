import * as THREE from 'three';

export const MOON_RADIUS = 1500;
export const MOON_CENTER = new THREE.Vector3(0, -MOON_RADIUS, 0);

// Shot 1 near-full illumination vs. Apollo 11 Tranquility Base low morning Sun (~19 deg elevation from left-front)
export const FULL_MOON_SUN_DIR = new THREE.Vector3(-0.24, 0.78, 0.58).normalize();
export const APOLLO_SUN_DIR = new THREE.Vector3(-0.88, 0.33, 0.34).normalize();

export interface ShotDefinition {
  id: number;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  start: number;
  end: number;
  interactiveHint: string;
}

export const SHOTS: ShotDefinition[] = [
  {
    id: 1,
    code: '01',
    title: 'The Moon Approach',
    subtitle: '384,400 km · Translunar Coast',
    description:
      'Emerging from deep black space, the cratered lunar sphere grows naturally in frame as basaltic maria and ray systems resolve.',
    start: 0.0,
    end: 0.21,
    interactiveHint: 'Drag to look · Scroll to zoom',
  },
  {
    id: 2,
    code: '02',
    title: 'Orbital Experience',
    subtitle: 'Lunar Orbit · Selenographic Survey',
    description:
      'Sweeping around the sunlit hemisphere and sculpted terminator. Drag freely to rotate around the Moon or scroll to inspect craters.',
    start: 0.21,
    end: 0.45,
    interactiveHint: 'Drag to orbit the Moon · Scroll to zoom',
  },
  {
    id: 3,
    code: '03',
    title: 'Cinematic Descent',
    subtitle: 'Mare Tranquillitatis · Powered Approach',
    description:
      'A continuous orbital dive toward the Sea of Tranquility as planetary curvature gives way to regolith craters and boulders.',
    start: 0.45,
    end: 0.68,
    interactiveHint: 'Continuous descent · Drag anytime to inspect',
  },
  {
    id: 4,
    code: '04',
    title: 'Apollo 11 Historical Scene',
    subtitle: 'Tranquility Base · Historically Informed 3D Reconstruction',
    description:
      'An independent 3D reconstruction inspired by the July 1969 EVA tableau: two astronauts, the Lunar Module, and the flag under harsh directional sunlight.',
    start: 0.68,
    end: 0.86,
    interactiveHint: 'Drag to inspect the reconstruction · Scroll to zoom',
  },
  {
    id: 5,
    code: '05',
    title: 'Final Cinematic Composition',
    subtitle: '0°40′26.69″ N · 23°28′22.69″ E',
    description:
      'Pulling back to frame the astronauts and Lunar Module together against the curving lunar horizon and deep space.',
    start: 0.86,
    end: 1.0,
    interactiveHint: 'Drag to orbit freely · Scroll to zoom',
  },
];

export const TOTAL_FILM_DURATION_SEC = 48;

export function getShotForProgress(t: number): ShotDefinition {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = SHOTS.length - 1; i >= 0; i--) {
    if (clamped >= SHOTS[i].start) {
      return SHOTS[i];
    }
  }
  return SHOTS[0];
}
