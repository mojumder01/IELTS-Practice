import { Fragment } from 'react';
import { highlightRanges, type Highlight } from '../../engine/passage';

/**
 * A paragraph with revealed answers marked: amber fill, dark amber outline and the question
 * number after it (SPEC section 7, "Show answers").
 */
export function HighlightedText({ text, highlights }: { text: string; highlights: Highlight[] }) {
  if (highlights.length === 0) return <>{text}</>;
  const parts = [];
  let at = 0;
  for (const range of highlightRanges(text, highlights)) {
    if (range.start < at) continue; // overlapping answers: keep the first
    parts.push(<Fragment key={`t${at}`}>{text.slice(at, range.start)}</Fragment>);
    parts.push(
      <Fragment key={`m${range.start}`}>
        <mark className="rounded-[3px] bg-answer-hl px-0.5 text-inherit ring-[1.5px] ring-answer-hl-outline">
          {text.slice(range.start, range.end)}
        </mark>
        <span className="mx-1 inline-flex size-5 items-center justify-center rounded-full bg-answer-hl-outline align-[2px] font-sans text-[11px] font-bold text-on-navy">
          <span className="sr-only">answer to question </span>
          {range.question}
        </span>
      </Fragment>,
    );
    at = range.end;
  }
  parts.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return <>{parts}</>;
}
