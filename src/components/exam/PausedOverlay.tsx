import { Pause } from 'lucide-react';
import { formatClock } from '../../engine/timer';

/** Covers the test content while paused; the header stays usable. */
export function PausedOverlay({
  secondsLeft,
  hidden,
  onResume,
}: {
  secondsLeft: number;
  hidden: string;
  onResume: () => void;
}) {
  return (
    <div className="absolute inset-0 z-[5] flex items-center justify-center bg-canvas/97 p-6">
      <div
        role="dialog"
        aria-labelledby="paused-title"
        className="flex max-w-[380px] flex-col items-center gap-3 rounded-[16px] border border-border bg-surface px-9 py-8 text-center"
      >
        <span className="flex size-[52px] items-center justify-center rounded-full bg-surface-muted text-navy">
          <Pause aria-hidden="true" className="size-[22px] fill-current" />
        </span>
        <h2 id="paused-title" className="m-0 text-xl font-semibold text-navy">
          Test paused
        </h2>
        <p className="m-0 text-sm leading-normal text-muted">
          The timer has stopped at {formatClock(secondsLeft)} and the {hidden} is hidden. Your
          answers are saved.
        </p>
        <button
          type="button"
          onClick={onResume}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the only action while paused
          autoFocus
          className="min-h-12 rounded-pill bg-navy px-6 text-[15px] font-semibold text-on-navy hover:bg-navy-2"
        >
          Resume test
        </button>
      </div>
    </div>
  );
}
