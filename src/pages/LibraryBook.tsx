import { ArrowLeft } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router';
import { PageSkeleton } from '../components/PageSkeleton';
import { TestBook } from '../components/library/TestBook';
import { moduleName, MODULE_ORDER } from '../engine/parts';
import { moduleState, sortTests } from '../engine/progress';
import { bookSlug } from '../lib/links';
import { useProgress } from '../lib/useProgress';
import { ModuleSchema, type Module } from '../schema/test';

const pill = (on: boolean) =>
  `min-h-11 rounded-pill border px-4 text-sm font-semibold ${
    on ? 'border-navy bg-navy text-on-navy' : 'border-border-strong bg-surface text-navy'
  }`;

/** "/library/:book": one book's tests as covers, each with its modules' bands or status. */
export function LibraryBook() {
  const { book: slug = '' } = useParams();
  const { state } = useProgress();
  const [params, setParams] = useSearchParams();
  const parsed = ModuleSchema.safeParse(params.get('module'));
  const focus: Module | null = parsed.success ? parsed.data : null;
  const setFocus = (m: Module | null) => {
    const next = new URLSearchParams(params);
    if (m) next.set('module', m);
    else next.delete('module');
    setParams(next, { replace: true });
  };

  if (state.status === 'loading') return <PageSkeleton label="Loading the book…" />;
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
  const list = sortTests(tests).filter((t) => bookSlug(t.book) === slug);
  const back = (
    <Link
      to="/library"
      className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      All books
    </Link>
  );

  if (list.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 pt-8 pb-12 sm:px-8">
        {back}
        <p role="alert" className="m-0 text-[15px] text-warn-text">
          This book isn’t in the library.
        </p>
      </main>
    );
  }

  const book = list[0]!.book;
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-8 pb-12 sm:px-8">
      {back}
      <section className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[30px] leading-tight font-semibold text-navy">{book}</h1>
        <p className="m-0 text-[15px] text-muted">
          {list.length} {list.length === 1 ? 'test' : 'tests'} · a full mock takes about 2 h 45 min.
          Tap a cover for the full mock, or a module to practise it.
        </p>
      </section>

      <div role="group" aria-label="Module" className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={focus === null}
          onClick={() => setFocus(null)}
          className={pill(focus === null)}
        >
          All modules
        </button>
        {MODULE_ORDER.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={focus === m}
            onClick={() => setFocus(m)}
            className={pill(focus === m)}
          >
            {moduleName(m)}
          </button>
        ))}
      </div>

      <section
        aria-label="Tests"
        className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      >
        {list.map((t) => (
          <TestBook
            key={t.testId}
            test={t}
            focus={focus}
            states={MODULE_ORDER.map((m) => ({ m, s: moduleState(t.testId, m, attempts) }))}
          />
        ))}
      </section>
    </main>
  );
}
