import { essayWordCount } from '../../engine/writing';
import type { AttemptRecord } from '../../engine/session';
import type { TestFile } from '../../schema/test';
import { card } from '../progress/styles';

/** Each task's essay with its AI feedback, as saved with the attempt. */
export function WritingResults({ attempt, test }: { attempt: AttemptRecord; test: TestFile }) {
  const section = test.sections.writing;
  const tasks = ([1, 2] as const).filter((t) => attempt.mode === 'full' || attempt.part === t);
  return (
    <>
      {tasks.map((task) => {
        const essay = attempt.writing?.[`task${task}`] ?? '';
        const feedback = attempt.writing?.ai?.[`task${task}`];
        const prompt =
          section?.kind === 'writing' ? section[`task${task}`].prompt : `Writing Task ${task}`;
        return (
          <section
            key={task}
            aria-labelledby={`task-${task}-h`}
            className={`${card} flex flex-col gap-4`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`task-${task}-h`} className="m-0 text-[17px] font-semibold text-navy">
                Task {task}
              </h2>
              <span className="font-mono text-sm text-muted">{essayWordCount(essay)} words</span>
            </div>
            <p className="m-0 font-serif text-[16px] leading-relaxed text-text">{prompt}</p>
            <details className="rounded-control border border-border p-3">
              <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-navy">
                Your essay
              </summary>
              <p className="m-0 font-serif text-[16px] leading-relaxed whitespace-pre-wrap text-text">
                {essay || 'Nothing was written for this task.'}
              </p>
            </details>
            {feedback ? (
              <div className="grid gap-4 md:grid-cols-2">
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  <li className="flex justify-between gap-3 rounded-control bg-surface-muted p-3 text-sm font-semibold text-navy">
                    <span>Estimated band for Task {task}</span>
                    <span className="font-mono">{feedback.overall.toFixed(1)}</span>
                  </li>
                  {feedback.criteria.map((c) => (
                    <li key={c.name} className="flex flex-col gap-0.5 text-sm">
                      <span className="flex justify-between gap-3">
                        <span className="font-semibold text-navy">{c.name}</span>
                        <span className="font-mono font-semibold text-navy">
                          {c.band.toFixed(1)}
                        </span>
                      </span>
                      <span className="text-[13px] text-navy-3">{c.comment}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-2">
                  <h3 className="m-0 text-sm font-semibold text-navy">Top 3 fixes</h3>
                  <ol className="m-0 flex flex-col gap-1.5 pl-5 text-[13px] leading-normal">
                    {feedback.topFixes.map((fix) => (
                      <li key={fix}>{fix}</li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : (
              <p className="m-0 text-sm text-muted">
                No AI feedback for this task. Open the task again to ask for it.
              </p>
            )}
          </section>
        );
      })}
    </>
  );
}
