import { ShieldCheck } from 'lucide-react';
import { SPEAKING_PARTS } from '../../engine/speaking';

interface SpeakingTabsProps {
  part: number;
  onPick: (part: number) => void;
}

/** Part 1–3 with what each is, above the Speaking page (Speaking artboard). */
export function SpeakingTabs({ part, onPick }: SpeakingTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div role="group" aria-label="Speaking parts" className="flex flex-wrap gap-2">
        {SPEAKING_PARTS.map((p) => {
          const on = p.part === part;
          return (
            <button
              key={p.part}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(p.part)}
              className={`flex min-h-12 flex-col items-start justify-center gap-px rounded-control border-[1.5px] px-4 py-1.5 text-left ${
                on
                  ? 'border-navy bg-navy text-on-navy'
                  : 'border-border-strong bg-surface text-navy'
              }`}
            >
              <span className="text-sm font-semibold">{p.label}</span>
              <span className={`text-xs ${on ? 'text-on-navy-muted' : 'text-muted'}`}>{p.sub}</span>
            </button>
          );
        })}
      </div>
      <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
        <ShieldCheck aria-hidden="true" className="size-4" />
        Recordings stay on this device
      </span>
    </div>
  );
}
