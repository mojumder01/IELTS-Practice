import { Eraser, Lightbulb, NotebookPen, Pause, Play } from 'lucide-react';
import type { ExamMode } from '../../engine/timer';
import { ThemeToggle } from '../ThemeToggle';

interface ExamOptionsProps {
  mode: ExamMode;
  modeLabels: Record<ExamMode, string> | null;
  onModeChange: (mode: ExamMode) => void;
  notesOpen: boolean;
  onToggleNotes: (() => void) | null;
  revealLabel: string | null;
  revealing: boolean;
  onToggleReveal: () => void;
  canPause: boolean;
  paused: boolean;
  onTogglePause: () => void;
  onClear: (() => void) | null;
}

const row =
  'flex min-h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-3.5 text-sm font-semibold text-navy';

/** On a phone, the header's controls live in this panel under "Test options". */
export function ExamOptions(props: ExamOptionsProps) {
  const labels = props.modeLabels;
  return (
    <div className="absolute top-0 right-0 left-0 flex flex-col gap-3 border-b border-border bg-surface p-4 shadow-xl">
      {labels && (
        <div
          role="group"
          aria-label="Timer"
          className="grid grid-cols-2 gap-1 rounded-pill bg-surface-muted p-1"
        >
          {(['single', 'full'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={props.mode === m}
              onClick={() => props.mode !== m && props.onModeChange(m)}
              className={`min-h-10 rounded-pill text-[13px] font-semibold ${props.mode === m ? 'bg-navy text-on-navy' : 'text-navy'}`}
            >
              {labels[m]}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {props.canPause && (
          <button type="button" onClick={props.onTogglePause} className={row}>
            {props.paused ? (
              <Play aria-hidden="true" className="size-4" />
            ) : (
              <Pause aria-hidden="true" className="size-4" />
            )}
            {props.paused ? 'Resume' : 'Pause'}
          </button>
        )}
        {props.onToggleNotes && (
          <button
            type="button"
            aria-expanded={props.notesOpen}
            onClick={props.onToggleNotes}
            className={row}
          >
            <NotebookPen aria-hidden="true" className="size-4" />
            Notes
          </button>
        )}
        {props.revealLabel && (
          <button
            type="button"
            aria-pressed={props.revealing}
            onClick={props.onToggleReveal}
            className={row}
          >
            <Lightbulb aria-hidden="true" className="size-4" />
            {props.revealLabel}
          </button>
        )}
        {props.onClear && (
          <button type="button" onClick={props.onClear} className={row}>
            <Eraser aria-hidden="true" className="size-4" />
            Clear
          </button>
        )}
        <ThemeToggle className={`${row} w-11 justify-center px-0`} />
      </div>
    </div>
  );
}
