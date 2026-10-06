import { Lightbulb } from 'lucide-react';
import { Fragment } from 'react';
import { markGroup } from '../../engine/scoring';
import type { QuestionGroup } from '../../schema/test';
import { useAnswerSource } from './answerContext';
import { GapLayoutBlock } from './GapLayoutBlock';
import { MatchingQuestion } from './MatchingQuestion';
import { MultipleChoiceQuestion } from './MultipleChoiceQuestion';
import { TextQuestion } from './TextQuestion';
import { TrueFalseQuestion } from './TrueFalseQuestion';
import { useQuestionState } from './useQuestionState';

const TFNG = ['TRUE', 'FALSE', 'NOT GIVEN'] as const;
const YNNG = ['YES', 'NO', 'NOT GIVEN'] as const;
const LEGEND: Record<string, [string, string][]> = {
  TRUE_FALSE_NOT_GIVEN: [
    ['TRUE', 'if the statement agrees with the information'],
    ['FALSE', 'if the statement contradicts the information'],
    ['NOT GIVEN', 'if there is no information on this'],
  ],
  YES_NO_NOT_GIVEN: [
    ['YES', 'if the statement agrees with the views of the writer'],
    ['NO', 'if the statement contradicts the views of the writer'],
    ['NOT GIVEN', 'if it is impossible to say what the writer thinks about this'],
  ],
};

/** Bolds the word limit inside the instructions, as the canvas does. */
function Instructions({ text, wordLimit }: { text: string; wordLimit?: string }) {
  if (!wordLimit || !text.includes(wordLimit)) return <>{text}</>;
  const [before, after] = text.split(wordLimit);
  return (
    <>
      {before}
      <strong className="font-semibold text-navy">{wordLimit}</strong>
      {after}
    </>
  );
}

/** "Questions 1–5", the instructions, and the right component for each question type. */
export function QuestionGroupView({ group }: { group: QuestionGroup }) {
  const q = useQuestionState();
  const source = useAnswerSource();
  const results = markGroup(group, q.answers);
  const numbers = group.questions.flatMap((question) => question.numbers);
  const range =
    numbers.length > 1 ? `${numbers[0]}–${numbers[numbers.length - 1]}` : String(numbers[0]);
  const shownGroup = q.isShown(group.groupId);
  const isMatching = group.type.startsWith('MATCHING_');

  const resultsFor = (nums: number[]) => results.filter((r) => nums.includes(r.number));
  const whereFor = (questionIndex: number) => (n: number) =>
    source.where(group.questions[questionIndex]!, n);

  return (
    <section aria-labelledby={`${group.groupId}-title`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-col gap-1.5">
          <h2 id={`${group.groupId}-title`} className="m-0 text-lg font-semibold text-navy">
            Questions {range}
          </h2>
          <p className="m-0 text-[15px] text-navy-3">
            <Instructions text={group.instructions} wordLimit={group.wordLimit} />
          </p>
        </div>
        {group.layout && q.canShow && (
          <button
            type="button"
            aria-pressed={shownGroup}
            aria-label={`${shownGroup ? 'Hide' : 'Show'} answers for questions ${range}`}
            onClick={() => q.toggleShown(group.groupId)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-border-strong bg-surface px-3 text-[13px] font-semibold text-navy"
          >
            <Lightbulb aria-hidden="true" className="size-[15px]" />
            {shownGroup ? 'Hide answers' : 'Show answers'}
          </button>
        )}
      </div>

      {LEGEND[group.type] && (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 rounded-[10px] border border-border bg-surface px-4 py-3 text-sm text-navy-3">
          {LEGEND[group.type]!.map(([term, meaning]) => (
            <Fragment key={term}>
              <dt className="font-semibold text-navy">{term}</dt>
              <dd className="m-0">{meaning}</dd>
            </Fragment>
          ))}
        </dl>
      )}

      {isMatching && group.options && (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 rounded-[10px] border border-border bg-surface px-4 py-3 text-sm text-navy-3">
          {group.options.map((o) => (
            <Fragment key={o.key}>
              <dt className="font-mono font-semibold text-navy">{o.key}</dt>
              <dd className="m-0">{o.text}</dd>
            </Fragment>
          ))}
        </dl>
      )}

      {group.layout ? (
        <GapLayoutBlock
          group={group}
          results={results}
          where={(n) =>
            source.where(
              group.questions.find((x) => x.numbers.includes(n))!,
              n,
            )
          }
        />
      ) : (
        group.questions.map((question, i) => {
          const props = { question, results: resultsFor(question.numbers), where: whereFor(i) };
          switch (group.type) {
            case 'TRUE_FALSE_NOT_GIVEN':
              return <TrueFalseQuestion key={i} {...props} choices={TFNG} />;
            case 'YES_NO_NOT_GIVEN':
              return <TrueFalseQuestion key={i} {...props} choices={YNNG} />;
            case 'MULTIPLE_CHOICE_SINGLE':
            case 'MULTIPLE_CHOICE_MULTIPLE':
              return (
                <MultipleChoiceQuestion
                  key={i}
                  {...props}
                  options={question.options ?? group.options ?? []}
                />
              );
            case 'MATCHING_HEADINGS':
            case 'MATCHING_PARAGRAPH_INFO':
            case 'MATCHING_FEATURES':
            case 'MATCHING_SENTENCE_ENDINGS':
              return (
                <MatchingQuestion
                  key={i}
                  {...props}
                  options={question.options ?? group.options ?? []}
                />
              );
            default:
              return <TextQuestion key={i} {...props} group={group} />;
          }
        })
      )}
    </section>
  );
}
