import { useState } from 'react';
import { PageSkeleton } from '../components/PageSkeleton';
import { AttemptTable } from '../components/progress/AttemptTable';
import { card } from '../components/progress/styles';
import { moduleName, MODULE_ORDER } from '../engine/parts';
import { byNewest } from '../engine/progress';
import { testName } from '../lib/links';
import { useProgress } from '../lib/useProgress';
import type { Module } from '../schema/test';

/** "/history" — every finished attempt, newest first, by module (Results artboard's list). */
export function History() {
  const { state } = useProgress();
  const [filter, setFilter] = useState<Module | 'all'>('all');

  if (state.status === 'loading') return <PageSkeleton label="Loading your history…" />;
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
  const names = new Map(tests.map((t) => [t.testId, testName(t)]));
  const finished = byNewest(attempts.filter((a) => a.status === 'submitted'));
  const shown = filter === 'all' ? finished : finished.filter((a) => a.module === filter);
  const filters: { id: Module | 'all'; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: finished.length },
    ...MODULE_ORDER.map((m) => ({
      id: m,
      label: moduleName(m),
      count: finished.filter((a) => a.module === m).length,
    })),
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-9 pb-12 sm:px-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[30px] leading-tight font-semibold text-navy">History</h1>
        <p className="m-0 text-[15px] text-muted">
          Every finished attempt. Practice attempts, where answers were shown, don’t count toward
          your bands.
        </p>
      </div>
      <section aria-label="Attempts" className={`${card} flex flex-col gap-4`}>
        <div role="group" aria-label="Module" className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-10 rounded-pill border px-3.5 text-[13px] font-semibold ${
                filter === f.id
                  ? 'border-navy bg-navy text-on-navy'
                  : 'border-border-strong bg-surface text-navy'
              }`}
            >
              {f.label} {f.count}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="m-0 text-sm text-muted">No finished attempts here yet.</p>
        ) : (
          <AttemptTable attempts={shown} nameOf={(id) => names.get(id) ?? id} />
        )}
      </section>
    </main>
  );
}
