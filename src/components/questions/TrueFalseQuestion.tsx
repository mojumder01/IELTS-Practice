import type { QuestionResult } from '../../engine/scoring';
import type { Question } from '../../schema/test';
import { ChoiceButton } from './ChoiceButton';
import { QuestionCard } from './QuestionCard';
import { useQuestionState } from './useQuestionState';

interface TrueFalseQuestionProps {
  question: Question;
  choices: readonly string[]; // TRUE / FALSE / NOT GIVEN or YES / NO / NOT GIVEN
  results: QuestionResult[];
  where: (n: number) => string;
}

export function TrueFalseQuestion({ question, choices, results, where }: TrueFalseQuestionProps) {
  const q = useQuestionState();
  const n = question.numbers[0]!;
  return (
    <QuestionCard
      numbers={question.numbers}
      prompt={question.prompt}
      results={results}
      where={where}
    >
      {choices.map((choice) => {
        const pressed = q.value(n) === choice;
        return (
          <ChoiceButton
            key={choice}
            label={choice}
            ariaLabel={`Question ${n}: ${choice}`}
            pressed={pressed}
            onClick={() => q.answer(n, pressed ? '' : choice)}
          />
        );
      })}
    </QuestionCard>
  );
}
