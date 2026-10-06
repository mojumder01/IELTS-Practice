import { Lightbulb } from 'lucide-react';

export function RevealBanner({ message, onHide }: { message: string; onHide: () => void }) {
  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-answer-hl-outline/40 bg-answer-hl px-4 py-1.5 text-[13px] text-flag-stroke sm:px-5"
    >
      <span className="inline-flex items-center gap-2 font-medium">
        <Lightbulb aria-hidden="true" className="size-4 shrink-0" />
        {message} This attempt won’t count toward your band history.
      </span>
      <button
        type="button"
        onClick={onHide}
        className="min-h-9 rounded-[6px] border border-answer-hl-outline bg-surface px-3 text-[13px] font-semibold text-flag-stroke"
      >
        Hide answers
      </button>
    </div>
  );
}
