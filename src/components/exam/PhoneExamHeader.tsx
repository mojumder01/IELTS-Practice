import { SlidersHorizontal, X } from 'lucide-react';
import { Link } from 'react-router';
import { formatClock, isWarning } from '../../engine/timer';

interface PhoneExamHeaderProps {
  title: string;
  subtitle: string;
  secondsLeft: number | null;
  optionsOpen: boolean;
  onToggleOptions: () => void;
  action: { label: string; onClick: () => void } | null;
}

/** The compact phone header: exit, where you are, time left, options and submit. */
export function PhoneExamHeader({
  title,
  subtitle,
  secondsLeft,
  optionsOpen,
  onToggleOptions,
  action,
}: PhoneExamHeaderProps) {
  const warning = secondsLeft !== null && isWarning(secondsLeft);
  return (
    <header className="flex shrink-0 items-center gap-1.5 bg-chrome py-2 pr-2.5 pl-1 text-on-chrome">
      <Link
        to="/"
        aria-label="Exit to dashboard"
        className="flex size-11 shrink-0 items-center justify-center rounded-control text-on-chrome"
      >
        <X aria-hidden="true" className="size-5" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs text-on-chrome-muted">{title}</span>
        <span className="truncate text-sm font-semibold">{subtitle}</span>
      </div>
      {secondsLeft !== null && (
        <span
          className={`inline-flex min-h-9 items-center rounded-pill border px-2.5 font-mono text-[15px] font-semibold ${
            warning ? 'border-red bg-red' : 'border-chrome-3 bg-chrome-2'
          }`}
        >
          <span className="sr-only">Time left</span>
          <span role="timer" aria-live="off">
            {formatClock(secondsLeft)}
          </span>
        </span>
      )}
      <button
        type="button"
        aria-label="Test options"
        aria-expanded={optionsOpen}
        onClick={onToggleOptions}
        className="flex size-11 shrink-0 items-center justify-center rounded-control border border-chrome-3 text-on-chrome-muted"
      >
        <SlidersHorizontal aria-hidden="true" className="size-[18px]" />
      </button>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="min-h-11 shrink-0 rounded-control bg-on-chrome px-3 text-sm font-semibold text-chrome"
        >
          {action.label}
        </button>
      )}
    </header>
  );
}
