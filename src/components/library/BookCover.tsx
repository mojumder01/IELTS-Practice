import { Check, Play } from 'lucide-react';
import type { CSSProperties } from 'react';
import { coverTitle } from '../../lib/links';

const COVERS = 6;

interface BookCoverProps {
  /** The book's name, e.g. "Cambridge 19": its series and number go on the cover. */
  book: string;
  /** Picks the cover colour (1, 2, 3…, repeating after six). */
  colour: number;
  /** Beside the big number, e.g. "Test 1" or "4 tests". */
  label: string;
  status: 'Completed' | 'In progress' | null;
  /** The button at the foot of the cover, e.g. "Full mock" or "Open". */
  action: string;
}

/**
 * The face of a book: its colour, spine, series, number and status. Purely visual: the link
 * around it says what it does.
 */
export function BookCover({ book, colour, label, status, action }: BookCoverProps) {
  const { series, number } = coverTitle(book);
  const n = ((((colour - 1) % COVERS) + COVERS) % COVERS) + 1;
  const style = {
    backgroundImage: `linear-gradient(160deg, var(--cover-${n}-from), var(--cover-${n}-to))`,
    color: `var(--cover-${n}-ink)`,
  } as CSSProperties;
  const chip = { background: 'var(--cover-chip)', color: 'var(--cover-chip-ink)' };

  return (
    <span
      aria-hidden="true"
      style={style}
      className="relative flex aspect-[3/4] w-full flex-col items-center overflow-hidden rounded-l-[6px] rounded-r-[16px] shadow-[0_10px_24px_-12px_rgb(15_23_42/0.45)] transition-transform duration-200 group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
    >
      {/* The spine and the light along it. */}
      <span
        className="absolute inset-y-0 left-0 w-3"
        style={{ background: 'var(--cover-spine)' }}
      />
      <span
        className="absolute inset-y-0 left-3 w-1.5"
        style={{ background: 'var(--cover-sheen)' }}
      />
      <span className="mt-[9%] flex flex-col items-center gap-2 px-4 text-center text-[11px] font-semibold tracking-[0.14em] opacity-90 sm:text-xs">
        {series}
        <span className="h-px w-10 bg-current opacity-50" />
      </span>
      <span className="my-auto flex flex-col items-center gap-2.5 pl-2">
        <span className="flex items-baseline gap-1.5">
          <span className="text-[44px] leading-none font-semibold tracking-tight sm:text-6xl">
            {number}
          </span>
          <span className="text-sm font-semibold">{label}</span>
        </span>
        {status && (
          <span
            className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-semibold"
            style={chip}
          >
            {status === 'Completed' && <Check className="size-3" />}
            {status}
          </span>
        )}
      </span>
      <span
        className="mb-[8%] inline-flex min-h-8 items-center gap-1.5 rounded-pill px-3 text-xs font-semibold"
        style={chip}
      >
        <Play className="size-3 fill-current" />
        {action}
      </span>
    </span>
  );
}
