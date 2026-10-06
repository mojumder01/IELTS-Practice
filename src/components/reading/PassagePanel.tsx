import { Minus, Plus } from 'lucide-react';
import type { Highlight } from '../../engine/passage';
import type { ReadingSection } from '../../schema/test';
import { HighlightedText } from './HighlightedText';
import { TEXT_SIZES } from './textSizes';

interface PassagePanelProps {
  section: ReadingSection;
  /** Revealed answers by paragraph label. */
  highlights: Record<string, Highlight[]>;
  textSize: number;
  onTextSize: (size: number) => void;
}

/** The passage: title, subtitle and lettered paragraphs in Source Serif, 18px / 1.8 by default. */
export function PassagePanel({ section, highlights, textSize, onTextSize }: PassagePanelProps) {
  const i = TEXT_SIZES.indexOf(textSize as (typeof TEXT_SIZES)[number]);
  const sizeButton =
    'flex size-11 items-center justify-center rounded-control border border-border-strong bg-surface text-navy disabled:opacity-40';
  return (
    <article aria-labelledby="passage-title" className="flex flex-col">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="m-0 text-xs font-semibold tracking-[0.08em] text-muted uppercase">
          Reading passage {section.part}
        </p>
        <div role="group" aria-label="Text size" className="flex gap-1">
          <button
            type="button"
            aria-label="Smaller text"
            disabled={i <= 0}
            onClick={() => onTextSize(TEXT_SIZES[i - 1]!)}
            className={sizeButton}
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Larger text"
            disabled={i >= TEXT_SIZES.length - 1}
            onClick={() => onTextSize(TEXT_SIZES[i + 1]!)}
            className={sizeButton}
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
      <h1
        id="passage-title"
        className="m-0 mb-1.5 font-serif text-[28px] leading-tight font-semibold text-navy"
      >
        {section.title}
      </h1>
      {section.subtitle && (
        <p className="m-0 mb-6 font-serif text-base text-muted italic">{section.subtitle}</p>
      )}
      <div
        className="flex flex-col gap-[18px] font-serif text-text"
        style={{ fontSize: textSize, lineHeight: 1.8 }}
      >
        {section.paragraphs.map((p) => (
          <div key={p.label} className="flex gap-3">
            <span className="w-5 shrink-0 font-sans text-[15px] leading-[inherit] font-bold text-navy">
              {p.label}
            </span>
            <p className="m-0">
              <HighlightedText text={p.text} highlights={highlights[p.label] ?? []} />
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
