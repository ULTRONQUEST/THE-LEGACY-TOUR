export type ShotId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ShotDefinition {
  id: ShotId;
  title: string;
  subtitle: string;
  startTime: number;
  endTime: number;
  narrative?: string;
}

export interface MemoryMoment {
  id: string;
  year: string;
  title: string;
  caption: string;
  startTime: number;
  endTime: number;
  kind: 'apollo' | 'iss' | 'mars' | 'voyager' | 'telescope' | 'earthsat';
}

export interface LegacyStatement {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
}

export const TOTAL_DURATION = 162; // 2m 42s deliberate, emotional pacing

export const SHOTS: ShotDefinition[] = [
  {
    id: 1,
    title: 'Farewell to Voyager 1',
    subtitle: 'Interstellar Space',
    startTime: 0,
    endTime: 22,
    narrative:
      'Some journeys are not meant to bring us home. Some are meant to take humanity further than ever before.',
  },
  {
    id: 2,
    title: 'The Journey Back',
    subtitle: 'Deep Space Corridor',
    startTime: 22,
    endTime: 42,
  },
  {
    id: 3,
    title: "Remembering Humanity's Exploration",
    subtitle: 'Echoes of Curiosity',
    startTime: 42,
    endTime: 68,
    narrative:
      'Every mission expanded our understanding. Every discovery opened another question. Every generation carried our curiosity a little further.',
  },
  {
    id: 4,
    title: 'Earth Appears Again',
    subtitle: 'The Pale Blue Point',
    startTime: 68,
    endTime: 88,
    narrative:
      'After travelling across worlds and reaching into the unknown, we return to the one place that has always been ours.',
  },
  {
    id: 5,
    title: 'The Beauty of Our Home',
    subtitle: 'Low Earth Orbit Sweep',
    startTime: 88,
    endTime: 112,
  },
  {
    id: 6,
    title: 'What Space Exploration Has Given Us',
    subtitle: 'Science, Vision & Unity',
    startTime: 112,
    endTime: 136,
  },
  {
    id: 7,
    title: 'The Final Cosmic Reveal',
    subtitle: 'Our Place in the Universe',
    startTime: 136,
    endTime: TOTAL_DURATION,
  },
];

export const MEMORY_MOMENTS: MemoryMoment[] = [
  {
    id: 'apollo',
    year: '1969',
    title: 'Apollo Lunar Exploration',
    caption: 'First human footsteps across the Sea of Tranquility',
    startTime: 43.0,
    endTime: 47.0,
    kind: 'apollo',
  },
  {
    id: 'iss',
    year: '1998 — Present',
    title: 'International Space Station',
    caption: 'Nations working together in continuous low Earth orbit',
    startTime: 47.2,
    endTime: 51.2,
    kind: 'iss',
  },
  {
    id: 'mars',
    year: '1997 — Present',
    title: 'Mars Surface Rovers',
    caption: 'Robotic geologists uncovering the ancient history of Mars',
    startTime: 51.4,
    endTime: 55.4,
    kind: 'mars',
  },
  {
    id: 'voyager',
    year: '1977 — Present',
    title: 'Voyager Interstellar Mission',
    caption: 'Carrying Earth’s Golden Record beyond the heliopause',
    startTime: 55.6,
    endTime: 59.6,
    kind: 'voyager',
  },
  {
    id: 'telescope',
    year: '1990 — Present',
    title: 'Space Observatories',
    caption: 'Capturing light from the earliest galaxies of the cosmos',
    startTime: 59.8,
    endTime: 63.8,
    kind: 'telescope',
  },
  {
    id: 'earthsat',
    year: '1972 — Present',
    title: 'Earth Observation Satellites',
    caption: 'Monitoring our oceans, atmosphere, and changing climate',
    startTime: 64.0,
    endTime: 67.6,
    kind: 'earthsat',
  },
];

export const LEGACY_STATEMENTS: LegacyStatement[] = [
  {
    id: 's1',
    text: 'WE LEARNED TO LOOK BEYOND OUR HORIZON.',
    startTime: 113.0,
    endTime: 117.3,
  },
  {
    id: 's2',
    text: 'WE DISCOVERED WORLDS WE HAD NEVER SEEN.',
    startTime: 117.6,
    endTime: 121.9,
  },
  {
    id: 's3',
    text: 'WE BUILT MACHINES THAT TRAVELLED BEYOND OUR SOLAR SYSTEM.',
    startTime: 122.2,
    endTime: 126.5,
  },
  {
    id: 's4',
    text: 'WE TURNED QUESTIONS INTO DISCOVERIES.',
    startTime: 126.8,
    endTime: 131.1,
  },
  {
    id: 's5',
    text: 'AND WE LEARNED HOW PRECIOUS OUR HOME REALLY IS.',
    startTime: 131.4,
    endTime: 135.7,
  },
];
