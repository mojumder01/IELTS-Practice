import { Star } from 'lucide-react';
import type { ListeningSection, ReadingSection } from '../../schema/test';

interface QuestionsPlaceholderProps {
  section: ReadingSection | ListeningSection;
  answers: Record<string, string>;
  flagged: number[];
  onAnswer: (n: number, value: string) => void;
  onFlag: (n: number) => void;
  onFocusQuestion: (n: number) => void;
}

/**
 * A plain answer field per question so the shell can be used end to end. Phase 3 and 4
 * replace it with the passage, the audioscript and one component per question type.
 */
export function QuestionsPlaceholder({
  section,
  answers,
  flagged,
  onAnswer,
  onFlag,
  onFocusQuestion,
}: QuestionsPlaceholderProps) {
  return (
    <section
      aria-label="Questions"
      className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 py-6 sm:px-8"
    >
      {section.groups.map((group) => (
        <div key={group.groupId} className="flex flex-col gap-3">
          <p className="m-0 text-[15px] font-semibold text-navy">{group.instructions}</p>
          {group.questions.map((question) =>
            question.numbers.map((n) => {
              const isFlagged = flagged.includes(n);
              return (
                <div
                  key={n}
                  className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-3"
                >
                  <label
                    htmlFor={`answer-${n}`}
                    className="flex min-w-0 flex-1 basis-60 items-baseline gap-2 text-[15px]"
                  >
                    <span className="font-mono font-semibold text-navy">{n}</span>
                    <span>{question.prompt ?? `Question ${n}`}</span>
                  </label>
                  <input
                    id={`answer-${n}`}
                    aria-label={`Question ${n}`}
                    value={answers[String(n)] ?? ''}
                    onChange={(e) => onAnswer(n, e.target.value)}
                    onFocus={() => onFocusQuestion(n)}
                    className="min-h-11 w-44 rounded-control border border-unanswered bg-surface px-3 text-[15px]"
                  />
                  <button
                    type="button"
                    aria-label={`Flag question ${n} for review`}
                    aria-pressed={isFlagged}
                    onClick={() => onFlag(n)}
                    className={`flex size-11 items-center justify-center rounded-control border ${
                      isFlagged
                        ? 'border-flag bg-answer-hl text-flag-stroke'
                        : 'border-border-strong bg-surface text-muted'
                    }`}
                  >
                    <Star aria-hidden="true" className={`size-4 ${isFlagged ? 'fill-flag' : ''}`} />
                  </button>
                </div>
              );
            }),
          )}
        </div>
      ))}
    </section>
  );
}
