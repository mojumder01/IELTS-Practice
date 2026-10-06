import type { PartInfo } from '../../engine/parts';
import { GridCell } from './GridCell';

interface QuestionGridProps {
  /** The parts shown: one in single-part mode, all of them in a full mock. */
  parts: PartInfo[];
  answers: Record<string, string>;
  flagged: number[];
  current: number | null;
  onPick: (n: number) => void;
}

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
          {part.items.map((item) => (
            <GridCell
              key={item.label}
              item={item}
              answers={answers}
              flagged={flagged}
              current={current}
              onPick={onPick}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
