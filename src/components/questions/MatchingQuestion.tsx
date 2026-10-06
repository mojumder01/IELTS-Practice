import type { QuestionResult } from '../../engine/scoring';
import type { Question } from '../../schema/test';
import { QuestionCard } from './QuestionCard';
import { useQuestionState } from './useQuestionState';

interface MatchingQuestionProps {
  question: Question;
  options: { key: string; text: string }[];
  results: QuestionResult[];
  where: (n: number) => string;
}

/** Headings, paragraph information, features and sentence endings: pick an option key. */
export function MatchingQuestion({ question, options, results, where }: MatchingQuestionProps) {
  const q = useQuestionState();
  const n = question.numbers[0]!;
  return (
    <QuestionCard
      numbers={question.numbers}
      prompt={question.prompt}
      results={results}
      where={where}
    >
      <select
        aria-label={`Question ${n}`}
        value={q.value(n)}
        onChange={(e) => q.answer(n, e.target.value)}
        onFocus={() => q.goTo(n)}
        className="min-h-11 max-w-full rounded-control border-[1.5px] border-unanswered bg-surface px-3 text-[15px] text-text"
      >
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.key}
          </option>
        ))}
      </select>
    </QuestionCard>
  );
}
