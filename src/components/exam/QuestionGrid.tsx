import { Star } from 'lucide-react';
import type { PartInfo } from '../../engine/parts';

interface QuestionGridProps {
  /** The parts shown: one in single-part mode, all of them in a full mock. */
  parts: PartInfo[];
  answers: Record<string, string>;
  flagged: number[];
  current: number | null;
  onPick: (n: number) => void;
}

/** Answered cells are filled, flagged ones get a star, and the current one a ring: never colour alone. */
export function QuestionGrid({ parts, answers, flagged, current, onPick }: QuestionGridProps) {
  const total = parts.reduce((n, p) => n + p.numbers.length, 0);
  const answered = parts.reduce(
    (n, p) => n + p.numbers.filter((q) => answers[String(q)]?.trim()).length,
    0,
  );
  if (total === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-canvas px-4 py-2.5 sm:px-5">
      <span className="text-[13px] font-semibold whitespace-nowrap text-navy-3">
        {answered} / {total} answered
      </span>
      {parts.map((part) => (
        <div
          key={part.part}
          role="group"
          aria-label={part.label}
          className="flex flex-wrap gap-[5px] pr-2.5"
        >
          {part.items.map((item) => {
            const isAnswered = item.numbers.every((n) => answers[String(n)]?.trim());
            const isFlagged = item.numbers.some((n) => flagged.includes(n));
            const isCurrent = current !== null && item.numbers.includes(current);
            const states = [
              isAnswered ? 'answered' : 'unanswered',
              isFlagged && 'flagged',
              isCurrent && 'current',
            ];
            return (
              <button
                key={item.label}
                type="button"
                aria-label={`Question ${item.label}, ${states.filter(Boolean).join(', ')}`}
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => onPick(item.numbers[0]!)}
                className={`relative h-10 min-w-10 rounded-control border-[1.5px] px-1 font-mono text-[13px] font-semibold ${
                  isAnswered
                    ? 'border-answered bg-answered text-on-navy'
                    : 'border-unanswered bg-surface text-text'
                } ${isCurrent ? 'ring-2 ring-navy ring-offset-2 ring-offset-surface' : ''}`}
              >
                {item.label}
                {isFlagged && (
                  <Star
                    aria-hidden="true"
                    className="absolute -top-1.5 -right-1.5 size-3.5 fill-flag stroke-flag-stroke"
                    strokeWidth={2}
                  />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
