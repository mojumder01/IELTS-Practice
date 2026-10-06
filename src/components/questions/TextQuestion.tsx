import type { QuestionResult } from '../../engine/scoring';
import type { QuestionGroup, Question } from '../../schema/test';
import { GapInput } from './GapInput';
import { QuestionCard } from './QuestionCard';
import { useQuestionState } from './useQuestionState';

interface TextQuestionProps {
  group: QuestionGroup;
  question: Question;
  results: QuestionResult[];
  where: (n: number) => string;
}

/** Sentence completion, short answers and diagram labels: a prompt with a typed answer. */
export function TextQuestion({ group, question, results, where }: TextQuestionProps) {
  const q = useQuestionState();
  const n = question.numbers[0]!;
  const shown = q.isShown(`q${n}`, group.groupId);
  const [before, after] = (question.prompt ?? '').split('___');
  const inline = after !== undefined;
  const gap = (
    <GapInput
      number={n}
      maxWords={group.maxWords}
      wordLimit={group.wordLimit}
      result={shown ? results[0] : undefined}
      showNumber={false}
    />
  );
  return (
    <QuestionCard
      numbers={question.numbers}
      prompt={
        inline ? (
          <span className="leading-[2.4]">
            {before}
            {gap}
            {after}
          </span>
        ) : (
          question.prompt
        )
      }
      results={results}
      where={where}
    >
      {!inline && gap}
    </QuestionCard>
  );
}
