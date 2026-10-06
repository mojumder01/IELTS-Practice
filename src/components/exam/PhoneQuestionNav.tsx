import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import type { GridItem } from '../../engine/parts';

interface PhoneQuestionNavProps {
  items: GridItem[];
  answered: number;
  current: number | null;
  onPick: (n: number) => void;
  onOpenSheet: () => void;
  sheetOpen: boolean;
}

/** Previous / question list / next, at the bottom of the phone layout. */
export function PhoneQuestionNav({
  items,
  answered,
  current,
  onPick,
  onOpenSheet,
  sheetOpen,
}: PhoneQuestionNavProps) {
  const index = Math.max(
    0,
    items.findIndex((i) => current !== null && i.numbers.includes(current)),
  );
  const here = items[index];
  const go = (to: number) => {
    const item = items[to];
    if (item) onPick(item.numbers[0]!);
  };
  const button =
    'flex size-11 shrink-0 items-center justify-center rounded-control border disabled:opacity-40';
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Question navigation"
      className="flex shrink-0 items-center gap-2 border-t border-border bg-surface px-3 pt-2 pb-3.5"
    >
      <button
        type="button"
        aria-label="Previous question"
        disabled={index === 0}
        onClick={() => go(index - 1)}
        className={`${button} border-border-strong bg-surface text-navy`}
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </button>
      <button
        type="button"
        aria-expanded={sheetOpen}
        onClick={onOpenSheet}
        className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-control border border-border-strong bg-canvas text-sm font-semibold text-navy"
      >
        <LayoutGrid aria-hidden="true" className="size-4" />Q{here?.label} · {answered}/
        {items.flatMap((i) => i.numbers).length} answered
      </button>
      <button
        type="button"
        aria-label="Next question"
        disabled={index >= items.length - 1}
        onClick={() => go(index + 1)}
        className={`${button} border-navy bg-navy text-on-navy`}
      >
        <ChevronRight aria-hidden="true" className="size-5" />
      </button>
    </nav>
  );
}
