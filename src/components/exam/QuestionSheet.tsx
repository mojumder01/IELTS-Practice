import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { rangeLabel, type PartInfo } from '../../engine/parts';
import { GridCell } from './GridCell';

interface QuestionSheetProps {
  parts: PartInfo[];
  answers: Record<string, string>;
  flagged: number[];
  current: number | null;
  onPick: (n: number) => void;
  onClose: () => void;
  /** Part tabs, module links and the module action. */
  children: ReactNode;
}

/** The phone's question grid: a bottom sheet over the test (ReadingPhone artboard). */
export function QuestionSheet({
  parts,
  answers,
  flagged,
  current,
  onPick,
  onClose,
  children,
}: QuestionSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const all = parts.flatMap((p) => p.numbers);
  const answered = all.filter((n) => answers[String(n)]?.trim()).length;
  const flaggedCount = all.filter((n) => flagged.includes(n)).length;

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end bg-navy/50">
      <button
        type="button"
        aria-label="Close question list"
        tabIndex={-1}
        onClick={onClose}
        className="flex-1"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="flex max-h-[86%] flex-col gap-3.5 overflow-y-auto rounded-t-[18px] bg-surface px-4 pt-2.5 pb-6"
      >
        <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-pill bg-border-strong" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <h2 id="sheet-title" className="m-0 text-[17px] font-semibold text-navy">
              All questions
            </h2>
            <span className="text-[13px] text-muted">
              {answered} answered · {flaggedCount} flagged
            </span>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close question list"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-control border border-border bg-surface text-navy-3"
          >
            <X aria-hidden="true" className="size-[18px]" />
          </button>
        </div>
        {parts.map((part) => (
          <div key={part.part} className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-navy">
              {part.label} · Questions {rangeLabel(part)}
            </span>
            <div role="group" aria-label={part.label} className="grid grid-cols-5 gap-2">
              {part.items.map((item) => (
                <GridCell
                  key={item.label}
                  item={item}
                  answers={answers}
                  flagged={flagged}
                  current={current}
                  size="sheet"
                  onPick={(n) => {
                    onPick(n);
                    onClose();
                  }}
                />
              ))}
            </div>
          </div>
        ))}
        {children}
      </section>
    </div>
  );
}
