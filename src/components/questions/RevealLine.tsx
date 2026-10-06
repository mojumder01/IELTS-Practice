import type { QuestionResult } from '../../engine/scoring';

const VERDICT = {
  correct: 'bg-good text-good-text',
  incorrect: 'bg-warn text-warn-text',
  skipped: 'bg-surface-muted text-navy-3',
};

/** "Correct" / "You wrote …" / "Not answered", then the answer and where it comes from. */
export function RevealLine({
  result,
  where,
  numbered,
}: {
  result: QuestionResult;
  where: string;
  numbered?: boolean;
}) {
  const verdict =
    result.status === 'correct'
      ? 'Correct'
      : result.status === 'incorrect'
        ? `You wrote ${result.given}`
        : 'Not answered';
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
      {numbered && (
        <span className="flex size-[22px] items-center justify-center rounded-full bg-navy text-[11px] font-bold text-on-navy">
          {result.number}
        </span>
      )}
      <span className={`rounded-[6px] px-2.5 py-1 font-semibold ${VERDICT[result.status]}`}>
        {verdict}
      </span>
      <span className="text-navy-3">
        Answer <strong className="font-semibold text-navy">{result.expected}</strong>
        {where && ` · ${where}`}
      </span>
    </div>
  );
}
