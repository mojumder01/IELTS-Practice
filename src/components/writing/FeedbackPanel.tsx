import { LoaderCircle, RefreshCw, Sparkles, X } from 'lucide-react';
import type { FeedbackStatus } from '../../engine/writing';
import type { WritingFeedback } from '../../schema/attempt';

interface FeedbackPanelProps {
  task: 1 | 2;
  feedback: WritingFeedback | undefined;
  status: FeedbackStatus;
  /** Too few words to assess yet. */
  tooShort: boolean;
  minWordsForFeedback: number;
  onRequest: () => void;
  onClose: () => void;
}

/** AI feedback: an estimated band per criterion, the top 3 fixes and corrections (Writing artboard). */
export function FeedbackPanel({
  task,
  feedback,
  status,
  tooShort,
  minWordsForFeedback,
  onRequest,
  onClose,
}: FeedbackPanelProps) {
  return (
    <aside
      aria-label="AI feedback"
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-control bg-now-playing text-answered">
            <Sparkles aria-hidden="true" className="size-[18px]" />
          </span>
          <div className="flex flex-col">
            <h2 className="m-0 text-base font-semibold text-navy">AI feedback</h2>
            <span className="text-xs text-muted">Task {task}</span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close AI feedback"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-control border border-border text-navy-3"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      {status.kind === 'loading' ? (
        <p role="status" className="m-0 inline-flex items-center gap-2 text-sm text-muted">
          <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
          Reading your essay…
        </p>
      ) : status.kind === 'error' ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-control bg-warn p-4 text-sm text-warn-text"
        >
          <p className="m-0 font-medium">{status.message}</p>
          <button
            type="button"
            onClick={onRequest}
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-control border border-warn-text bg-surface px-3.5 font-semibold"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Try again
          </button>
        </div>
      ) : !feedback ? (
        tooShort ? (
          <p className="m-0 rounded-control bg-surface-muted p-4 text-sm leading-normal text-navy-3">
            Write at least {minWordsForFeedback} words for Task {task}, then ask for feedback. You
            get an estimated band for each marking criterion, plus fixes.
          </p>
        ) : (
          <button
            type="button"
            onClick={onRequest}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-navy px-4 text-sm font-semibold text-on-navy"
          >
            <Sparkles aria-hidden="true" className="size-4" />
            Get feedback
          </button>
        )
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-control bg-surface-muted p-4">
            <span className="font-mono text-[34px] leading-none font-semibold text-navy">
              {feedback.overall.toFixed(1)}
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-navy">
                Estimated band for Task {task}
              </span>
              <span className="text-xs text-muted">
                An AI estimate, not an official IELTS score
              </span>
            </div>
          </div>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {feedback.criteria.map((c) => (
              <li
                key={c.name}
                className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-semibold text-navy">{c.name}</span>
                  <span className="font-mono font-semibold text-navy">{c.band.toFixed(1)}</span>
                </div>
                <p className="m-0 text-[13px] leading-normal text-navy-3">{c.comment}</p>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-sm font-semibold text-navy">Top 3 fixes</h3>
            <ol className="m-0 flex flex-col gap-1.5 pl-5 text-[13px] leading-normal text-text">
              {feedback.topFixes.map((fix) => (
                <li key={fix}>{fix}</li>
              ))}
            </ol>
          </div>
          {feedback.corrections.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-sm font-semibold text-navy">Corrections</h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {feedback.corrections.map((c) => (
                  <li
                    key={c.original}
                    className="flex flex-col gap-0.5 rounded-control bg-surface-muted p-3 text-[13px]"
                  >
                    <span>
                      <span className="sr-only">Instead of </span>
                      <s className="text-warn-text">{c.original}</s>
                    </span>
                    <span>
                      <span className="sr-only">write </span>
                      <strong className="font-semibold text-good-text">{c.suggested}</strong>
                    </span>
                    <span className="text-muted">{c.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={onRequest}
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-control border border-border-strong bg-surface px-3.5 text-sm font-semibold text-navy"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Check again
          </button>
        </>
      )}
    </aside>
  );
}
