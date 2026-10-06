import { Star } from 'lucide-react';
import type { GridItem } from '../../engine/parts';

interface GridCellProps {
  item: GridItem;
  answers: Record<string, string>;
  flagged: number[];
  current: number | null;
  onPick: (n: number) => void;
  size?: 'grid' | 'sheet';
}

/** Answered cells are filled, flagged ones get a star, and the current one a ring: never colour alone. */
export function GridCell({
  item,
  answers,
  flagged,
  current,
  onPick,
  size = 'grid',
}: GridCellProps) {
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
      type="button"
      aria-label={`Question ${item.label}, ${states.filter(Boolean).join(', ')}`}
      aria-current={isCurrent ? 'true' : undefined}
      onClick={() => onPick(item.numbers[0]!)}
      className={`relative rounded-control border-[1.5px] px-1 font-mono font-semibold ${
        size === 'sheet' ? 'h-11 text-sm' : 'h-10 min-w-10 text-[13px]'
      } ${isAnswered ? 'border-answered bg-answered text-on-navy' : 'border-unanswered bg-surface text-text'} ${
        isCurrent ? 'ring-2 ring-navy ring-offset-2 ring-offset-surface' : ''
      }`}
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
}
