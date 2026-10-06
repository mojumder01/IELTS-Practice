import {
  ArrowLeft,
  Eraser,
  Lightbulb,
  Maximize2,
  NotebookPen,
  Pause,
  Play,
  Timer,
} from 'lucide-react';
import { Link } from 'react-router';
import { formatClock, isWarning, type ExamMode } from '../../engine/timer';
import { ThemeToggle } from '../ThemeToggle';

interface ExamHeaderProps {
  title: string;
  partLabel: string;
  mode: ExamMode;
  /** Null hides the mode switch (Speaking has one sitting for all three parts). */
  modeLabels: Record<ExamMode, string> | null;
  onModeChange: (mode: ExamMode) => void;
  notesOpen: boolean;
  /** Null hides Notes (Speaking keeps its notes on the cue card). */
  onToggleNotes: (() => void) | null;
  /** Null hides the lightbulb (Full mock, or the test doesn't allow it). */
  revealLabel: string | null;
  revealing: boolean;
  onToggleReveal: () => void;
  /** Null for a module without a timer (Speaking). */
  secondsLeft: number | null;
  canPause: boolean;
  paused: boolean;
  onTogglePause: () => void;
  /** Null hides Clear. */
  onClear: (() => void) | null;
  focus: boolean;
  onToggleFocus: () => void;
}

const iconButton =
  'flex size-11 shrink-0 items-center justify-center rounded-control border border-navy-3 bg-transparent text-on-navy-muted hover:text-on-navy';
const textButton =
  'inline-flex min-h-11 items-center gap-2 rounded-control border border-navy-3 bg-transparent px-3.5 text-sm font-semibold text-on-navy-muted hover:text-on-navy';

export function ExamHeader(props: ExamHeaderProps) {
  const warning = props.secondsLeft !== null && isWarning(props.secondsLeft);
  const labels = props.modeLabels;
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2.5 bg-navy px-4 py-2.5 text-on-navy sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/library"
          aria-label="Back to test library"
          className={`${iconButton} text-on-navy`}
        >
          <ArrowLeft aria-hidden="true" className="size-[18px]" />
        </Link>
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-control bg-red text-[13px] font-bold"
        >
          IP
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-semibold">{props.title}</span>
          <span className="text-xs tracking-[0.06em] text-unanswered uppercase">
            {props.partLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {labels && (
          <>
            <span className="text-[11px] font-semibold tracking-[0.1em] text-unanswered">
              TIMER
            </span>
            <div className="flex gap-0.5 rounded-pill bg-navy-2 p-[3px]">
              {(['single', 'full'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={props.mode === m}
                  onClick={() => props.mode !== m && props.onModeChange(m)}
                  className={`min-h-[38px] rounded-pill px-3.5 text-[13px] font-semibold ${
                    props.mode === m ? 'bg-surface text-navy' : 'bg-transparent text-on-navy-muted'
                  }`}
                >
                  {labels[m]}
                </button>
              ))}
            </div>
          </>
        )}
        {props.onToggleNotes && (
          <button
            type="button"
            aria-label="Notes"
            aria-expanded={props.notesOpen}
            onClick={props.onToggleNotes}
            className={
              props.notesOpen
                ? `${iconButton} border-surface bg-surface text-navy hover:text-navy`
                : iconButton
            }
          >
            <NotebookPen aria-hidden="true" className="size-[18px]" />
          </button>
        )}
        {props.revealLabel && (
          <button
            type="button"
            aria-label={props.revealLabel}
            aria-pressed={props.revealing}
            onClick={props.onToggleReveal}
            className={
              props.revealing
                ? `${iconButton} border-answer-hl bg-answer-hl text-flag-stroke hover:text-flag-stroke`
                : iconButton
            }
          >
            <Lightbulb aria-hidden="true" className="size-[18px]" />
          </button>
        )}
        {props.secondsLeft !== null && (
          <div
            className={`inline-flex min-h-11 items-center gap-2 rounded-pill border px-3.5 font-mono text-lg font-semibold ${
              warning ? 'border-red bg-red text-on-navy' : 'border-navy-3 bg-navy-2'
            }`}
          >
            <Timer aria-hidden="true" className="size-[17px]" />
            <span className="sr-only">Time left</span>
            <span role="timer" aria-live="off">
              {formatClock(props.secondsLeft)}
            </span>
          </div>
        )}
        {props.canPause && (
          <button type="button" onClick={props.onTogglePause} className={textButton}>
            {props.paused ? (
              <Play aria-hidden="true" className="size-3.5 fill-current" />
            ) : (
              <Pause aria-hidden="true" className="size-3.5 fill-current" />
            )}
            {props.paused ? 'Resume' : 'Pause'}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {props.onClear && (
          <button type="button" onClick={props.onClear} className={textButton}>
            <Eraser aria-hidden="true" className="size-4" />
            Clear
          </button>
        )}
        <button
          type="button"
          aria-label="Focus mode"
          aria-pressed={props.focus}
          onClick={props.onToggleFocus}
          className={props.focus ? `${iconButton} bg-navy-2` : iconButton}
        >
          <Maximize2 aria-hidden="true" className="size-[17px]" />
        </button>
        <ThemeToggle className={iconButton} />
      </div>
    </header>
  );
}
