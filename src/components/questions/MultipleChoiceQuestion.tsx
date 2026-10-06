import type { QuestionResult } from '../../engine/scoring';
import type { Question } from '../../schema/test';
import { ChoiceButton } from './ChoiceButton';
import { QuestionCard } from './QuestionCard';
import { useQuestionState } from './useQuestionState';

interface MultipleChoiceQuestionProps {
  question: Question;
  options: { key: string; text: string }[];
  results: QuestionResult[];
  where: (n: number) => string;
}

/**
 * One letter for a single question; for paired numbers ("Choose TWO", 21–22) up to one letter
 * per number, stored in letter order across the numbers.
 */
export function MultipleChoiceQuestion({
  question,
  options,
  results,
  where,
}: MultipleChoiceQuestionProps) {
  const q = useQuestionState();
  const { numbers } = question;
  const chosen = numbers.map((n) => q.value(n)).filter(Boolean);

  const pick = (key: string) => {
    let next: string[];
    if (numbers.length === 1) next = chosen[0] === key ? [] : [key];
    else if (chosen.includes(key)) next = chosen.filter((k) => k !== key);
    else if (chosen.length < numbers.length) next = [...chosen, key];
    else return; // already chose as many as allowed
    const sorted = [...next].sort();
    numbers.forEach((n, i) => q.answer(n, sorted[i] ?? ''));
  };

  return (
    <QuestionCard numbers={numbers} prompt={question.prompt} results={results} where={where}>
      <div
        role="group"
        aria-label={`Question ${numbers.join('–')} options`}
        className="flex w-full flex-col gap-2"
      >
        {options.map((o) => (
          <ChoiceButton
            key={o.key}
            label={o.key}
            text={o.text}
            ariaLabel={`Question ${numbers.join('–')}: ${o.key}`}
            pressed={chosen.includes(o.key)}
            onClick={() => pick(o.key)}
          />
        ))}
      </div>
    </QuestionCard>
  );
}
