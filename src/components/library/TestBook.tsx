import { Check, Play } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { moduleName, MODULE_ORDER } from '../../engine/parts';
import type { ModuleState } from '../../engine/progress';
import { coverTitle, examHref, testName } from '../../lib/links';
import type { Module, TestMeta } from '../../schema/test';

const COVERS = 6;

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
  const { series, number } = coverTitle(test.book);
  const n = ((test.testNumber - 1) % COVERS) + 1;
  const cover = {
    backgroundImage: `linear-gradient(160deg, var(--cover-${n}-from), var(--cover-${n}-to))`,
    color: `var(--cover-${n}-ink)`,
  } as CSSProperties;
  const action = focus ? `Start ${moduleName(focus)}` : 'Start full mock';

  return (
    <article aria-label={testName(test)} className="flex min-w-0 flex-col gap-2.5">
      <Link
        to={examHref(test.testId, focus ?? 'listening')}
        aria-label={action}
        style={cover}
        className="group relative flex aspect-[3/4] flex-col items-center overflow-hidden rounded-l-[6px] rounded-r-[16px] no-underline shadow-[0_10px_24px_-12px_rgb(15_23_42/0.45)] transition-transform duration-200 motion-safe:hover:-translate-y-1"
      >
        {/* The spine and the light across the cover. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-3"
          style={{ background: 'var(--cover-spine)' }}
        />
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-3 w-1.5"
          style={{ background: 'var(--cover-sheen)', opacity: 0.6 }}
        />
        <span
          aria-hidden="true"
          className="mt-[9%] flex flex-col items-center gap-2 px-4 text-center text-[11px] font-semibold tracking-[0.14em] opacity-90 sm:text-xs"
        >
          {series}
          <span className="h-px w-10 bg-current opacity-50" />
        </span>
        <span aria-hidden="true" className="my-auto flex items-baseline gap-1.5 pl-2">
          <span className="text-[44px] leading-none font-semibold tracking-tight sm:text-6xl">
            {number}
          </span>
          <span className="text-sm font-semibold">Test {test.testNumber}</span>
        </span>
        {status && (
          <span
            className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: 'var(--cover-chip)', color: 'var(--cover-chip-ink)' }}
          >
            {status === 'Completed' && <Check aria-hidden="true" className="size-3" />}
            {status}
          </span>
        )}
        <span
          aria-hidden="true"
          className="mb-[8%] inline-flex min-h-8 items-center gap-1.5 rounded-pill px-3 text-xs font-semibold"
          style={{ background: 'var(--cover-chip)', color: 'var(--cover-chip-ink)' }}
        >
          <Play aria-hidden="true" className="size-3 fill-current" />
          {focus ? moduleName(focus) : 'Full mock'}
        </span>
      </Link>

      <h3 className="m-0 text-[15px] leading-snug font-semibold text-navy">{testName(test)}</h3>
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
