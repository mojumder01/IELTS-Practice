import { useEffect, useState } from 'react';
import type { Highlight } from '../../engine/passage';
import { useIsPhone } from '../../lib/useMediaQuery';
import type { Question, ReadingSection } from '../../schema/test';
import { useExam } from '../../store/examContext';
import { AnswerSourceContext } from '../questions/answerContext';
import { QuestionGroupView } from '../questions/QuestionGroupView';
import { useQuestionState } from '../questions/useQuestionState';
import { PassagePanel } from './PassagePanel';
import { TEXT_SIZES } from './textSizes';

const SIZE_KEY = 'ielts:textSize';

function storedSize(): number {
  try {
    const size = Number(localStorage.getItem(SIZE_KEY));
    return (TEXT_SIZES as readonly number[]).includes(size) ? size : 18;
  } catch {
    return 18;
  }
}

const where = (question: Question) =>
  question.location === null
    ? 'No matching text in the passage'
    : question.location
      ? `Paragraph ${question.location.paragraph}, highlighted`
      : '';

/** Passage and questions side by side; on a phone, Passage / Questions tabs. */
export function ReadingContent({ section }: { section: ReadingSection }) {
  const phone = useIsPhone();
  const q = useQuestionState();
  const current = useExam((s) => s.session?.current ?? null);
  const [tab, setTab] = useState<'passage' | 'questions'>('passage');
  const [textSize, setTextSize] = useState(storedSize);

  const changeSize = (size: number) => {
    setTextSize(size);
    try {
      localStorage.setItem(SIZE_KEY, String(size));
    } catch {
      // Just won't persist.
    }
  };

  // Picking a question in the grid opens the Questions tab on a phone…
  const [seenCurrent, setSeenCurrent] = useState(current);
  if (current !== seenCurrent) {
    setSeenCurrent(current);
    if (phone && current !== null) setTab('questions');
  }
  // …and brings the question into view.
  useEffect(() => {
    if (current === null) return;
    requestAnimationFrame(() =>
      document
        .querySelector(`[data-question="${current}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    );
  }, [current]);

  const highlights: Record<string, Highlight[]> = {};
  for (const group of section.groups) {
    for (const question of group.questions) {
      const n = question.numbers[0]!;
      if (question.location && q.isShown(`q${n}`, group.groupId)) {
        (highlights[question.location.paragraph] ??= []).push({
          sentence: question.location.sentence,
          text: question.location.highlight,
          question: n,
        });
      }
    }
  }
  const numbers = section.groups.flatMap((g) => g.questions.flatMap((x) => x.numbers));
  const answered = numbers.filter((n) => q.value(n).trim()).length;

  const passage = (
    <PassagePanel
      section={section}
      highlights={highlights}
      textSize={textSize}
      onTextSize={changeSize}
    />
  );
  const questions = (
    <section aria-label="Questions" className="flex flex-col gap-7">
      {section.groups.map((group) => (
        <QuestionGroupView key={group.groupId} group={group} />
      ))}
    </section>
  );

  return (
    <AnswerSourceContext value={{ where }}>
      {phone ? (
        <div className="flex h-full flex-col">
          <div className="grid shrink-0 grid-cols-2 gap-1 border-b border-border bg-surface p-2">
            {(['passage', 'questions'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-[7px] text-sm font-semibold ${
                  tab === t ? 'bg-navy text-on-navy' : 'bg-surface-muted text-navy'
                }`}
              >
                {t === 'passage' ? 'Passage' : 'Questions'}
                {t === 'questions' && (
                  <span
                    className={`text-xs font-medium ${tab === t ? 'text-on-navy-muted' : 'text-muted'}`}
                  >
                    {answered}/{numbers.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            {tab === 'passage' ? passage : questions}
          </div>
        </div>
      ) : (
        <div className="flex h-full">
          <div className="min-w-0 flex-1 overflow-y-auto border-r border-border bg-surface px-10 pt-7 pb-12">
            {passage}
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto px-8 pt-6 pb-12">{questions}</div>
        </div>
      )}
    </AnswerSourceContext>
  );
}
