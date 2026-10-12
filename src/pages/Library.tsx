import { ArrowRight, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageSkeleton } from '../components/PageSkeleton';
import { BookCard } from '../components/library/BookCard';
import { moduleName, MODULE_ORDER } from '../engine/parts';
import { byNewest, moduleState, progressLine, sortTests } from '../engine/progress';
import { formatClock } from '../engine/timer';
import { examHref, testName } from '../lib/links';
import { useProgress } from '../lib/useProgress';
import type { Track } from '../schema/test';

const TRACKS: { id: Track; label: string }[] = [
  { id: 'academic', label: 'Academic' },
  { id: 'general', label: 'General Training' },
];

/** "/library": every book as a cover with its progress; a book opens its tests (LibraryBook). */
export function Library() {
  const { state } = useProgress();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const track: Track = params.get('track') === 'general' ? 'general' : 'academic';
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
            Pick a book to see its tests. Take a full mock in exam order, or practise one module.
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

      {books.length > 0 && (
        <section
          aria-label="Books"
          className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        >
          {books.map(({ book, tests: list }) => {
            const states = list.flatMap((t) =>
              MODULE_ORDER.map((m) => moduleState(t.testId, m, attempts)),
            );
            return (
              <BookCard
                key={book}
                book={book}
                tests={list.length}
                done={states.filter((x) => x.kind === 'band').length}
                started={states.some((x) => x.kind !== 'start')}
              />
            );
          })}
        </section>
      )}
      {books.length === 0 && (
        <p className="m-0 text-[15px] text-muted">
          {tests.length === 0 ? 'No tests are published yet.' : 'No tests match your search.'}
        </p>
      )}
    </main>
  );
}
