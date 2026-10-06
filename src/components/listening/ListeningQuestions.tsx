import { formatClock } from '../../engine/timer';
import type { ListeningSection } from '../../schema/test';
import { AnswerSourceContext } from '../questions/answerContext';
import { QuestionGroupView } from '../questions/QuestionGroupView';

/** Listening questions; the audio player and audioscript arrive in Phase 4. */
export function ListeningQuestions({ section }: { section: ListeningSection }) {
  const at = new Map(
    section.script.filter((l) => l.answer).map((l) => [l.answer!.question, l.start]),
  );
  const where = (_: unknown, n: number) => {
    const start = at.get(n);
    return start === undefined
      ? ''
      : `at ${formatClock(start).replace(/^0/, '')} in the audioscript`;
  };
  return (
    <AnswerSourceContext value={{ where }}>
      <section
        aria-label="Questions"
        className="mx-auto flex w-full max-w-[760px] flex-col gap-7 px-4 pt-6 pb-12 sm:px-8"
      >
        {section.context && <p className="m-0 text-[15px] text-navy-3">{section.context}</p>}
        {section.groups.map((group) => (
          <QuestionGroupView key={group.groupId} group={group} />
        ))}
      </section>
    </AnswerSourceContext>
  );
}
