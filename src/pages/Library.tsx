import { ArrowRight, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageSkeleton } from '../components/PageSkeleton';
import { card } from '../components/progress/styles';
import { moduleName, MODULE_ORDER } from '../engine/parts';
import { byNewest, moduleState, progressLine, sortTests } from '../engine/progress';
import { formatClock } from '../engine/timer';
import { examHref, testName } from '../lib/links';
import { useProgress } from '../lib/useProgress';
import { ModuleSchema, type Module, type Track } from '../schema/test';

const TRACKS: { id: Track; label: string }[] = [
  { id: 'academic', label: 'Academic' },
  { id: 'general', label: 'General Training' },
];

const pill = (on: boolean) =>
  `min-h-11 rounded-pill border px-4 text-sm font-semibold ${
    on ? 'border-navy bg-navy text-on-navy' : 'border-border-strong bg-surface text-navy'
  }`;

/** "/library" — every live test by book, with each module's band or status (Test library artboard). */
export function Library() {
  const { state } = useProgress();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const track: Track = params.get('track') === 'general' ? 'general' : 'academic';
  const parsed = ModuleSchema.safeParse(params.get('module'));
  const focus: Module | null = parsed.success ? parsed.data : null;
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  if (state.status === 'loading') return <PageSkeleton label="Loading the library…" />;
  if (state.status === 'error') {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-4 py-9 sm:px-8">
        <p role="alert" className="m-0 text-[15px] text-warn-text">
          {state.message}
        </p>
      </main>
    );
  }

  const { attempts, tests } = state.data;
  const q = query.trim().toLowerCase();
  const shown = sortTests(tests).filter(
    (t) => t.track === track && (!q || `${t.book} test ${t.testNumber}`.toLowerCase().includes(q)),
  );
  const books = [...new Set(shown.map((t) => t.book))].map((book) => ({
    book,
    tests: shown.filter((t) => t.book === book),
  }));
  const resume = byNewest(attempts.filter((a) => a.status === 'in_progress'))[0];
  const resumeTest = resume && tests.find((t) => t.testId === resume.testId);

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-9 pb-12 sm:px-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[30px] leading-tight font-semibold text-navy">Test library</h1>
          <p className="m-0 text-[15px] text-muted">
            Take a full mock in exam order, or practise one module at a time.
          </p>
        </div>
        <div className="flex w-full flex-col gap-1 sm:w-[300px]">
          <label htmlFor="lib-search" className="text-sm font-semibold text-navy">
            Search tests
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            />
            <input
              id="lib-search"
              type="search"
              placeholder="Search book or test"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-11 w-full rounded-control border border-border-strong bg-surface pr-3 pl-9 text-sm"
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Track"
          className="flex gap-1 rounded-pill bg-surface-muted p-1"
        >
          {TRACKS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={track === t.id}
              onClick={() => setParam('track', t.id === 'academic' ? null : t.id)}
              className={`min-h-10 rounded-pill px-4 text-sm font-semibold ${
                track === t.id ? 'bg-navy text-on-navy' : 'text-navy-3'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Module" className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={focus === null}
            onClick={() => setParam('module', null)}
            className={pill(focus === null)}
          >
            All modules
          </button>
          {MODULE_ORDER.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={focus === m}
              onClick={() => setParam('module', m)}
              className={pill(focus === m)}
            >
              {moduleName(m)}
            </button>
          ))}
        </div>
      </div>

      {resume && (
        <Link
          to={examHref(resume.testId, resume.module, resume.mode, resume.part)}
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-now-playing-border bg-now-playing px-5 py-4 text-navy no-underline hover:text-navy"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold tracking-[0.06em] text-answered uppercase">
              Continue
            </span>
            <span className="text-base font-semibold">
              {resumeTest ? testName(resumeTest) : resume.testId} · {moduleName(resume.module)}
            </span>
            <span className="text-sm text-muted">
              {progressLine(resume)}
              {resume.module !== 'speaking' && ` · ${formatClock(resume.timeLeftSec)} left`}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
            Resume
            <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        </Link>
      )}

      {books.map(({ book, tests: list }) => (
        <section key={book} aria-labelledby={`book-${book}`} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 id={`book-${book}`} className="m-0 text-xl font-semibold text-navy">
              {book}
            </h2>
            <span className="text-sm text-muted">
              {list.length} {list.length === 1 ? 'test' : 'tests'} · full mock about 2 h 45 min
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {list.map((t) => {
              const states = MODULE_ORDER.map((m) => ({
                m,
                s: moduleState(t.testId, m, attempts),
              }));
              const done = states.filter((x) => x.s.kind === 'band').length;
              const started = done > 0 || states.some((x) => x.s.kind === 'resume');
              const status = done === 4 ? 'Completed' : started ? 'In progress' : 'Not started';
              return (
                <article
                  key={t.testId}
                  aria-label={testName(t)}
                  className={`${card} flex flex-col gap-3 !p-4`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted">{t.book}</span>
                      <span className="text-lg font-semibold text-navy">Test {t.testNumber}</span>
                    </div>
                    <span className="rounded-pill bg-surface-muted px-2.5 py-1 text-xs font-semibold text-navy-3">
                      {status}
                    </span>
                  </div>
                  <ul className="m-0 flex list-none flex-col p-0">
                    {states.map(({ m, s }) => (
                      <li key={m}>
                        <Link
                          aria-label={`${moduleName(m)}: ${
                            s.kind === 'band'
                              ? `band ${s.band.toFixed(1)}`
                              : s.kind === 'resume'
                                ? 'Resume'
                                : 'Start'
                          }`}
                          to={
                            s.kind === 'band'
                              ? `/results/${s.attempt.attemptId}`
                              : examHref(t.testId, m)
                          }
                          className={`flex min-h-11 items-center justify-between gap-2 rounded-control px-2 text-sm text-navy no-underline hover:text-navy ${
                            focus === m ? 'bg-now-playing font-semibold' : ''
                          }`}
                        >
                          <span>{moduleName(m)}</span>
                          <span
                            className={
                              s.kind === 'band'
                                ? 'font-mono font-semibold text-good-text'
                                : s.kind === 'resume'
                                  ? 'font-semibold text-answered'
                                  : 'text-muted'
                            }
                          >
                            {s.kind === 'band'
                              ? s.band.toFixed(1)
                              : s.kind === 'resume'
                                ? 'Resume'
                                : 'Start'}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={examHref(t.testId, focus ?? 'listening')}
                    className="mt-auto inline-flex min-h-11 items-center justify-center rounded-control bg-navy px-4 text-sm font-semibold text-on-navy no-underline hover:text-on-navy"
                  >
                    {focus ? `Start ${moduleName(focus)}` : 'Start full mock'}
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {books.length === 0 && (
        <p className="m-0 text-[15px] text-muted">
          {tests.length === 0 ? 'No tests are published yet.' : 'No tests match your search.'}
        </p>
      )}
    </main>
  );
}
