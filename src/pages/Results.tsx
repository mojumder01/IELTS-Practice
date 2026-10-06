import { ArrowLeft, Check, Minus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { moduleName, partsOf } from '../engine/parts';
import { markParts, scoreResults, type QuestionResult, type Score } from '../engine/scoring';
import type { AttemptRecord } from '../engine/session';
import { formatClock } from '../engine/timer';
import { FullPageStatus } from '../components/FullPageStatus';
import { useAuth } from '../lib/auth';
import { useServices } from '../lib/services';
import type { QuestionType, TestFile } from '../schema/test';

const TYPE_NAMES: Record<QuestionType, string> = {
  MULTIPLE_CHOICE_SINGLE: 'Multiple choice',
  MULTIPLE_CHOICE_MULTIPLE: 'Multiple choice (choose more than one)',
  TRUE_FALSE_NOT_GIVEN: 'True / False / Not Given',
  YES_NO_NOT_GIVEN: 'Yes / No / Not Given',
  MATCHING_HEADINGS: 'Matching headings',
  MATCHING_PARAGRAPH_INFO: 'Matching information',
  MATCHING_FEATURES: 'Matching features',
  MATCHING_SENTENCE_ENDINGS: 'Matching sentence endings',
  GAP_FILL: 'Completion',
  DIAGRAM_LABEL: 'Diagram labelling',
  SHORT_ANSWER: 'Short answer',
};

const RESULT = {
  correct: { word: 'Correct', icon: Check, chip: 'bg-good text-good-text' },
  incorrect: { word: 'Incorrect', icon: X, chip: 'bg-warn text-warn-text' },
  skipped: { word: 'Skipped', icon: Minus, chip: 'bg-surface-muted text-navy-3' },
};

type Filter = 'all' | 'incorrect' | 'skipped' | 'flagged';

interface Loaded {
  attempt: AttemptRecord;
  test: TestFile;
  results: QuestionResult[];
  score: Score;
}

/** /results/:attemptId: the band, the breakdown and every answer (Results artboard; Phase 7 completes it). */
export function Results() {
  const { attemptId = '' } = useParams();
  const services = useServices();
  const { state } = useAuth();
  const uid = state.status === 'owner' ? state.user.uid : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const attempt = await services.attempts(uid).get(attemptId);
      if (!attempt) throw new Error('This attempt doesn’t exist.');
      if (attempt.module !== 'reading' && attempt.module !== 'listening') {
        throw new Error(`${moduleName(attempt.module)} results arrive in a later phase.`);
      }
      const test = await services.loadTest(attempt.testId);
      const parts = partsOf(test, attempt.module).filter(
        (p) => attempt.mode === 'full' || p.part === attempt.part,
      );
      const results = markParts(test, attempt.module, parts, attempt.answers);
      const score = scoreResults(results, attempt.module, test.meta.track);
      if (!cancelled) setLoaded({ attempt, test, results, score });
    })().catch(
      (e: unknown) =>
        !cancelled && setError(e instanceof Error ? e.message : 'Results could not be loaded.'),
    );
    return () => {
      cancelled = true;
    };
  }, [services, uid, attemptId]);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-4 py-9 sm:px-8">
        <p role="alert" className="m-0 text-[15px] text-warn-text">
          {error}
        </p>
        <Link to="/">Back to dashboard</Link>
      </main>
    );
  }
  if (!loaded) return <FullPageStatus label="Loading results…" />;

  const { attempt, test, results, score } = loaded;
  const counts = {
    correct: results.filter((r) => r.status === 'correct').length,
    incorrect: results.filter((r) => r.status === 'incorrect').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
  };
  const flagged = new Set(attempt.flagged);
  const shown = results.filter((r) =>
    filter === 'all' ? true : filter === 'flagged' ? flagged.has(r.number) : r.status === filter,
  );
  const types = Object.entries(score.byType) as [
    QuestionType,
    { correct: number; total: number },
  ][];
  const lowest = types.reduce<QuestionType | null>(
    (worst, [type, t]) =>
      worst === null ||
      t.correct / t.total < score.byType[worst]!.correct / score.byType[worst]!.total
        ? type
        : worst,
    null,
  );
  const name =
    attempt.module === 'reading' && test.meta.track === 'academic'
      ? 'Academic Reading'
      : moduleName(attempt.module);
  const submitted = attempt.submittedAt
    ? new Date(attempt.submittedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: results.length },
    { id: 'incorrect', label: 'Incorrect', count: counts.incorrect },
    { id: 'skipped', label: 'Skipped', count: counts.skipped },
    { id: 'flagged', label: 'Flagged', count: results.filter((r) => flagged.has(r.number)).length },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-8 pb-12 sm:px-8">
      <Link
        to="/"
        className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to dashboard
      </Link>
      <div className="flex flex-col gap-1.5">
        <p className="m-0 text-sm font-medium text-muted">
          Results · {name} · {test.meta.book} Test {test.meta.testNumber}
          {attempt.mode === 'single' && ` · Part ${attempt.part}`}
        </p>
        <h1 className="m-0 text-[30px] leading-tight font-semibold text-navy">
          {moduleName(attempt.module)} band {score.band.toFixed(1)}
          {score.estimate && (
            <span className="ml-2 align-middle text-base font-medium text-muted">(estimate)</span>
          )}
        </h1>
        <p className="m-0 text-[15px] text-muted">
          {submitted && `Submitted ${submitted} · `}
          {score.raw} / {score.total} correct
          {score.estimate && ' · scaled to 40 questions'}
          {attempt.timeLeftSec > 0 && ` · ${formatClock(attempt.timeLeftSec)} left on the clock`}
        </p>
        {attempt.revealUsed && (
          <p className="m-0 self-start rounded-control bg-answer-hl px-3 py-1.5 text-sm font-medium text-flag-stroke">
            Practice: answers were shown, so this attempt doesn’t count toward your band history.
          </p>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <section
          aria-labelledby="breakdown-h"
          className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6"
        >
          <h2 id="breakdown-h" className="m-0 text-[17px] font-semibold text-navy">
            Breakdown
          </h2>
          <dl className="m-0 grid grid-cols-3 gap-3">
            {(['correct', 'incorrect', 'skipped'] as const).map((k) => (
              <div key={k} className="flex flex-col gap-1 rounded-control bg-surface-muted p-3">
                <dt className="text-[13px] text-muted">{RESULT[k].word}</dt>
                <dd className="m-0 font-mono text-2xl font-semibold text-navy">{counts[k]}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section
          aria-labelledby="types-h"
          className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6"
        >
          <h2 id="types-h" className="m-0 text-[17px] font-semibold text-navy">
            Accuracy by question type
          </h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {types.map(([type, t]) => {
              const pct = Math.round((t.correct / t.total) * 100);
              return (
                <li key={type} className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-3 text-sm">
                    <span>
                      {TYPE_NAMES[type]}
                      {type === lowest && types.length > 1 && (
                        <span className="ml-2 rounded-[6px] bg-warn px-2 py-0.5 text-xs font-semibold text-warn-text">
                          Focus area
                        </span>
                      )}
                    </span>
                    <span className="font-mono font-semibold text-navy">
                      {t.correct} / {t.total} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-pill bg-border">
                    <div className="h-full rounded-pill bg-navy" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section
        aria-labelledby="review-h"
        className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-6 sm:px-7"
      >
        <h2 id="review-h" className="m-0 text-[17px] font-semibold text-navy">
          Answer review
        </h2>
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr>
                {['Q', 'Your answer', 'Correct answer', 'Result'].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="border-b border-border px-3 py-2.5 text-left text-xs font-semibold tracking-[0.05em] text-muted uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const { word, icon: Icon, chip } = RESULT[r.status];
                return (
                  <tr key={r.number}>
                    <td className="border-b border-surface-muted px-3 py-3 font-mono font-semibold text-navy">
                      {r.number}
                    </td>
                    <td className="border-b border-surface-muted px-3 py-3">
                      {r.given || <span className="text-muted">—</span>}
                    </td>
                    <td className="border-b border-surface-muted px-3 py-3 font-medium text-navy">
                      {r.expected}
                    </td>
                    <td className="border-b border-surface-muted px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-[6px] px-2 py-1 text-xs font-semibold ${chip}`}
                      >
                        <Icon aria-hidden="true" className="size-3.5" />
                        {word}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted">
                    Nothing to show here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
