import type { ReactNode } from 'react';
import type { QuestionResult } from '../../engine/scoring';
import { IconToggle } from './IconToggle';
import { RevealLine } from './RevealLine';
import { useQuestionState } from './useQuestionState';

interface QuestionCardProps {
  numbers: number[];
  prompt?: ReactNode;
  /** The answer controls (option buttons, a select, a gap). */
  children: ReactNode;
  results: QuestionResult[];
  where: (number: number) => string;
}

/** One numbered question: prompt, flag, its own lightbulb, controls, and the revealed answer. */
export function QuestionCard({ numbers, prompt, children, results, where }: QuestionCardProps) {
  const q = useQuestionState();
  const label = numbers.join('–');
  const key = `q${numbers[0]}`;
  const shown = q.isShown(key);
  const isCurrent = q.current !== null && numbers.includes(q.current);
  const flagged = numbers.some((n) => q.flagged(n));

  return (
    <div
      data-question={numbers[0]}
      className={`flex scroll-mt-4 flex-col gap-2.5 rounded-card border px-4 py-3.5 ${
        isCurrent ? 'border-now-playing-border bg-now-playing' : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-navy font-mono text-[13px] font-semibold text-navy">
          {label}
        </span>
        <div className="min-w-0 flex-1 pt-[3px] text-base leading-normal text-text">{prompt}</div>
        {q.canShow && (
          <IconToggle
            kind="show"
            label={`${shown ? 'Hide' : 'Show'} answer for question ${label}`}
            pressed={shown}
            onClick={() => q.toggleShown(key)}
          />
        )}
        <IconToggle
          kind="flag"
          label={`Flag question ${label} for review`}
          pressed={flagged}
          onClick={() => q.toggleFlag(numbers[0]!)}
        />
      </div>
      <div className="flex flex-wrap gap-2 sm:pl-10">{children}</div>
      {shown && (
        <div className="flex flex-col gap-1.5 sm:pl-10">
          {results.map((r) => (
            <RevealLine
              key={r.number}
              result={r}
              where={where(r.number)}
              numbered={numbers.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
