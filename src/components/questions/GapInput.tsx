import { overWordLimit } from '../../engine/answers';
import type { QuestionResult } from '../../engine/scoring';
import { useQuestionState } from './useQuestionState';

interface GapInputProps {
  number: number;
  maxWords?: number;
  wordLimit?: string;
  /** When answers are showing, the border says right or wrong (the reveal line says it in words). */
  result?: QuestionResult;
  showNumber?: boolean;
}

/** A gap to type into, with an inline warning as soon as the answer passes the word limit. */
export function GapInput({
  number,
  maxWords,
  wordLimit,
  result,
  showNumber = true,
}: GapInputProps) {
  const q = useQuestionState();
  const value = q.value(number);
  const tooLong = overWordLimit(value, maxWords);
  const border = result
    ? result.status === 'correct'
      ? 'border-good-text'
      : result.status === 'incorrect'
        ? 'border-warn-text'
        : 'border-unanswered'
    : q.current === number
      ? 'border-answered'
      : 'border-unanswered';

  return (
    <span className="inline-flex flex-col align-middle">
      <span className="inline-flex items-center">
        {showNumber && (
          <span
            aria-hidden="true"
            className="mx-1 inline-flex size-6 items-center justify-center rounded-full border-[1.5px] border-muted text-xs font-semibold"
          >
            {number}
          </span>
        )}
        <input
          aria-label={`Question ${number}`}
          data-question={number}
          aria-invalid={tooLong || undefined}
          aria-describedby={tooLong ? `limit-${number}` : undefined}
          value={value}
          onChange={(e) => q.answer(number, e.target.value)}
          onFocus={() => q.goTo(number)}
          autoComplete="off"
          spellCheck={false}
          className={`h-10 w-[140px] rounded-[6px] border-[1.5px] px-2.5 text-[15px] leading-normal text-navy ${border} ${
            value.trim() ? 'bg-now-playing' : 'bg-surface'
          }`}
        />
      </span>
      {tooLong && (
        <span
          id={`limit-${number}`}
          role="status"
          className="text-xs leading-snug font-medium text-warn-text"
        >
          Too many words: {wordLimit ?? `${maxWords} max`}
        </span>
      )}
    </span>
  );
}
