import { X } from 'lucide-react';

interface LegacyPanelProps {
  visible: boolean;
  onClose: () => void;
}

const LEGACY_MILESTONES = [
  {
    year: '1977',
    label: 'Launch',
    detail: 'Departed Earth on September 5, 1977 to survey the outer giant planets.',
  },
  {
    year: '1979–1980',
    label: 'Jupiter & Saturn',
    detail:
      'Captured active volcanism on Io, intricate ring structures, and Titan’s dense atmosphere.',
  },
  {
    year: '2012',
    label: 'Interstellar Space',
    detail:
      'Crossed the heliopause in August 2012, entering the interstellar medium beyond solar plasma.',
  },
  {
    year: 'Ongoing',
    label: 'Limited Science Telemetry',
    detail:
      'Continues operating select fields-and-particles instruments as plutonium-238 power gradually declines.',
  },
];

export function LegacyPanel({ visible, onClose }: LegacyPanelProps) {
  if (!visible) return null;

  return (
    <aside
      aria-label="Voyager 1 Golden Legacy"
      className="fixed right-5 top-20 z-20 w-[min(360px,calc(100vw-40px))] rounded-xl border border-slate-300/15 bg-[#080b16]/90 p-5 text-slate-200 shadow-2xl transition-opacity duration-200"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-300/10 pb-3.5">
        <div>
          <p className="font-mono-tabular text-[11px] tracking-wider text-amber-300/90 uppercase">
            Archival Brief · Spacecraft No. 1
          </p>
          <h2 className="font-display mt-1 text-lg font-medium tracking-tight text-white">
            The Golden Legacy
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close legacy notes"
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-3.5">
        {LEGACY_MILESTONES.map((item) => (
          <div key={item.year} className="grid grid-cols-[74px_1fr] gap-3 text-[13px] leading-relaxed">
            <span className="font-mono-tabular pt-0.5 text-xs font-medium text-indigo-300/90">
              {item.year}
            </span>
            <div>
              <div className="font-medium text-slate-100">{item.label}</div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-slate-300/10 pt-3.5">
        <div className="text-xs font-medium text-amber-200/95">The Golden Record</div>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Mounted to the decagonal bus is a gold-plated copper phonograph disc inscribed with
          a pulsar map locating Earth, alongside spoken greetings, music, and images of human life
          preserved as a physical time capsule rather than a radio broadcast.
        </p>
      </div>
    </aside>
  );
}
