import { Link } from 'react-router';
import { moduleName, MODULE_ORDER } from '../../engine/parts';
import type { ModuleState } from '../../engine/progress';
import { examHref, testName } from '../../lib/links';
import type { Module, TestMeta } from '../../schema/test';
import { BookCover } from './BookCover';

interface TestBookProps {
  test: TestMeta;
  states: { m: Module; s: ModuleState }[];
  /** The module filter: the cover starts it, and its row is marked. */
  focus: Module | null;
}

/** One test as a book cover, with each module's band, Resume or Start underneath. */
export function TestBook({ test, states, focus }: TestBookProps) {
  const done = states.filter((x) => x.s.kind === 'band').length;
  const started = done > 0 || states.some((x) => x.s.kind === 'resume');
  const status = done === 4 ? 'Completed' : started ? 'In progress' : null;
  const action = focus ? `Start ${moduleName(focus)}` : 'Start full mock';

  return (
    <article aria-label={testName(test)} className="flex min-w-0 flex-col gap-2.5">
      <Link
        to={examHref(test.testId, focus ?? 'listening')}
        aria-label={action}
        className="group block rounded-r-[16px] no-underline"
      >
        <BookCover
          book={test.book}
          colour={test.testNumber}
          label={`Test ${test.testNumber}`}
          status={status}
          action={focus ? moduleName(focus) : 'Full mock'}
        />
      </Link>

      <h2 className="m-0 text-[15px] leading-snug font-semibold text-navy">{testName(test)}</h2>
      <ul className="m-0 grid list-none grid-cols-2 gap-1.5 p-0">
        {MODULE_ORDER.map((m) => {
          const s = states.find((x) => x.m === m)!.s;
          const value =
            s.kind === 'band' ? s.band.toFixed(1) : s.kind === 'resume' ? 'Resume' : 'Start';
          return (
            <li key={m}>
              <Link
                aria-label={`${moduleName(m)}: ${s.kind === 'band' ? `band ${value}` : value}`}
                to={
                  s.kind === 'band' ? `/results/${s.attempt.attemptId}` : examHref(test.testId, m)
                }
                className={`flex min-h-11 flex-col justify-center rounded-control border px-2 py-1 leading-tight no-underline ${
                  focus === m
                    ? 'border-now-playing-border bg-now-playing'
                    : 'border-border bg-surface hover:border-border-strong'
                }`}
              >
                <span className="text-[11px] text-muted">{moduleName(m)}</span>
                <span
                  className={`text-[13px] font-semibold ${
                    s.kind === 'band'
                      ? 'font-mono text-good-text'
                      : s.kind === 'resume'
                        ? 'text-answered'
                        : 'text-navy-3'
                  }`}
                >
                  {value}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
