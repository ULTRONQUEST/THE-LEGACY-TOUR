export interface ShotSpec {
  id: number;
  code: string;
  title: string;
  subtitle: string;
  start: number;
  end: number;
  interactiveOrbit: boolean;
  caption: string;
}

export const SHOTS: ShotSpec[] = [
  {
    id: 1,
    code: '01',
    title: 'Lunar Departure & Acceleration',
    subtitle: 'Trans-Mars Injection Burn',
    start: 0.0,
    end: 1.0,
    interactiveOrbit: false,
    caption:
      'Departing lunar orbit, the transit vehicle fires its main propulsion stage, accelerating steadily into interplanetary cruise.',
  },
  {
    id: 2,
    code: '02',
    title: 'The First View of Mars',
    subtitle: 'Interplanetary Approach',
    start: 1.0,
    end: 2.0,
    interactiveOrbit: false,
    caption:
      'Across millions of kilometres of deep space, Mars emerges as a small rust-ochre world—growing slowly into planetary scale.',
  },
  {
    id: 3,
    code: '03',
    title: 'Orbital Approach',
    subtitle: 'Low Martian Orbit · Drag to Rotate & Zoom',
    start: 2.0,
    end: 3.0,
    interactiveOrbit: true,
    caption:
      'Captured into orbit above the ancient cratered highlands, the curved horizon reveals Mars’s thin, sunlit dust-amber limb.',
  },
  {
    id: 4,
    code: '04',
    title: 'Descent to the Surface',
    subtitle: 'Atmospheric Entry & Canyon Approach',
    start: 3.0,
    end: 4.0,
    interactiveOrbit: false,
    caption:
      'Descending through tenuous carbon-dioxide haze, vast canyon networks, sedimentary mesas, and spire-framed valleys unfold below.',
  },
  {
    id: 5,
    code: '05',
    title: 'Opportunity Historical Reconstruction',
    subtitle: 'MER-B Rover · Meridiani Planum · Drag to Inspect',
    start: 4.0,
    end: 5.0,
    interactiveOrbit: true,
    caption:
      'A historical reconstruction of NASA’s solar-powered Opportunity rover surveying the iron-rich Martian regolith.',
  },
  {
    id: 6,
    code: '06',
    title: 'The Legacy of Opportunity',
    subtitle: '2004 – 2018 · 45.16 km Traversed',
    start: 5.0,
    end: 6.0,
    interactiveOrbit: true,
    caption:
      'Resting in Perseverance Valley after fifteen Earth years of discovery, Opportunity transformed our understanding of ancient water on Mars.',
  },
];

export const TOTAL_DURATION_SECONDS = 54; // ~9s per shot in continuous cinema playback

export const ASSET_PATHS = {
  marsGlobeRef: '/assets/aistudio/MARS_3-D_IMAGE_4bb32701.png',
  marsOrbitalRef: '/assets/aistudio/MARS_VIEW_97e85c0b.png',
  marsLandRef: '/assets/aistudio/MARS_LAND_2d20d55b.webp',
  marsValleysAlpha: '/assets/aistudio/MARS_VALLEYS_373777f1.webp',
  perseveranceRef: '/assets/aistudio/MARS_ROVER_64b36fe1.jpeg',
} as const;

export interface HistoricalFact {
  label: string;
  value: string;
  detail: string;
}

export const OPPORTUNITY_FACTS: HistoricalFact[] = [
  {
    label: 'Planned Mission',
    value: '90 Sols',
    detail: 'Originally designed for a 90-Martian-day primary surface mission (~92.5 Earth days).',
  },
  {
    label: 'Operational Endurance',
    value: '> 14 Years',
    detail: 'Operated continuously on the Martian surface for more than 14 Earth years (5,111 sols).',
  },
  {
    label: 'Distance Traversed',
    value: '45.16 km',
    detail: 'Drove approximately 45.16 kilometres (28.06 miles) across Meridiani Planum to Endeavour Crater.',
  },
  {
    label: 'Key Discovery',
    value: 'Ancient Water',
    detail: 'Uncovered mineralogical and geological evidence of ancient liquid water on Mars.',
  },
  {
    label: 'Final Contact',
    value: 'June 10, 2018',
    detail: 'Final communication received on June 10, 2018, during a planet-encircling dust storm.',
  },
  {
    label: 'Mission Complete',
    value: 'February 2019',
    detail: 'NASA officially declared the Opportunity mission complete in February 2019.',
  },
];
