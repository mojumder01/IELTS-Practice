import { Check, Minus, X } from 'lucide-react';
import { useState } from 'react';
import { tableFor } from '../../engine/bands';
import { bandRows, focusArea, moreForNextBand } from '../../engine/progress';
import type { QuestionResult, Score } from '../../engine/scoring';
import type { AttemptRecord } from '../../engine/session';
import { formatClock } from '../../engine/timer';
import { TYPE_NAMES } from '../../lib/questionTypes';
import type { QuestionType, TestFile } from '../../schema/test';
import { card, td, th } from '../progress/styles';

const RESULT = {
  correct: { word: 'Correct', icon: Check, chip: 'bg-good text-good-text' },
  incorrect: { word: 'Incorrect', icon: X, chip: 'bg-warn text-warn-text' },
  skipped: { word: 'Skipped', icon: Minus, chip: 'bg-surface-muted text-navy-3' },
};

type Filter = 'all' | 'incorrect' | 'skipped' | 'flagged';

/**
 * What to say about each answer: the content's explanation, else where the answer is — the
 * paragraph and its words (Reading) or the audioscript time and words (Listening).
 */
function explanations(test: TestFile, module: 'reading' | 'listening'): Map<number, string> {
  const out = new Map<number, string>();
  for (const [id, section] of Object.entries(test.sections)) {
    if (!id.startsWith(module)) continue;
    if (section.kind === 'listening') {
      for (const line of section.script) {
        if (line.answer) {
          out.set(
            line.answer.question,
            `Audioscript ${formatClock(line.start)}: “${line.answer.highlight}”`,
          );
        }
      }
    }
    if (section.kind !== 'reading' && section.kind !== 'listening') continue;
    for (const g of section.groups) {
      for (const q of g.questions) {
        const where =
          q.location === null
            ? 'No matching text in the passage.'
            : q.location
              ? `Paragraph ${q.location.paragraph}: “${q.location.highlight}”`
              : undefined;
        const text = q.explanation ?? where;
        if (text) for (const n of q.numbers) if (q.explanation || !out.has(n)) out.set(n, text);
      }
    }
  }
  return out;
}

interface ScoredResultsProps {
  attempt: AttemptRecord;
  module: 'reading' | 'listening';
  test: TestFile;
  results: QuestionResult[];
  score: Score;
}

/** Breakdown, where the score landed, accuracy by type and the answer review (Results artboard). */
export function ScoredResults({ attempt, module, test, results, score }: ScoredResultsProps) {
  const [filter, setFilter] = useState<Filter>('all');
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
  const focus = focusArea(score.byType);
  const table = tableFor(module, test.meta.track);
  const rows = bandRows(table);
  const scaled = score.total >= 40 ? score.raw : Math.round((score.raw * 40) / score.total);
  const at = rows.findIndex((r) => scaled >= r.min && scaled <= r.max);
  const around = at < 0 ? [] : rows.slice(Math.max(0, at - 1), at + 2).reverse();
  const next = moreForNextBand(score.raw, score.total, score.band, table);
  const notes = explanations(test, module);
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: results.length },
    { id: 'incorrect', label: 'Incorrect', count: counts.incorrect },
    { id: 'skipped', label: 'Skipped', count: counts.skipped },
    { id: 'flagged', label: 'Flagged', count: results.filter((r) => flagged.has(r.number)).length },
  ];

  return (
    <>
      <div className="grid gap-5 md:grid-cols-2">
        <section aria-labelledby="breakdown-h" className={`${card} flex flex-col gap-3`}>
          <h2 id="breakdown-h" className="m-0 text-[17px] font-semibold text-navy">
            Breakdown
          </h2>
          <div aria-hidden="true" className="flex h-2.5 overflow-hidden rounded-pill bg-border">
            <div
              className="bg-good-text"
              style={{ width: `${(counts.correct / results.length) * 100}%` }}
            />
            <div
              className="bg-warn-text"
              style={{ width: `${(counts.incorrect / results.length) * 100}%` }}
            />
          </div>
          <dl className="m-0 grid grid-cols-3 gap-3">
            {(['correct', 'incorrect', 'skipped'] as const).map((k) => {
              const Icon = RESULT[k].icon;
              return (
                <div key={k} className="flex flex-col gap-1 rounded-control bg-surface-muted p-3">
                  <dt className="inline-flex items-center gap-1.5 text-[13px] text-muted">
                    <Icon aria-hidden="true" className="size-3.5" />
                    {RESULT[k].word}
                  </dt>
                  <dd className="m-0 font-mono text-2xl font-semibold text-navy">{counts[k]}</dd>
                </div>
              );
            })}
          </dl>
        </section>
        <section aria-labelledby="landed-h" className={`${card} flex flex-col gap-3`}>
          <h2 id="landed-h" className="m-0 text-[17px] font-semibold text-navy">
            Where you landed
          </h2>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {around.map((r) => {
              const you = r === rows[at];
              return (
                <li
                  key={r.band}
                  className={`flex justify-between gap-3 rounded-control px-3 py-2 text-sm ${
                    you ? 'bg-navy font-semibold text-on-navy' : 'bg-surface-muted text-navy-3'
                  }`}
                >
                  <span>
                    {r.min === r.max ? r.min : `${r.min}–${r.max}`} correct{you ? ' · you' : ''}
                  </span>
                  <span className="font-mono">{r.band.toFixed(1)}</span>
                </li>
              );
            })}
          </ul>
          <p className="m-0 text-sm text-muted">
            {score.estimate && `Scaled to 40 questions: ${scaled}. `}
            {next ? (
              <>
                <strong className="text-navy">
                  {next.more} more correct {next.more === 1 ? 'answer' : 'answers'}
                </strong>{' '}
                would move you to band {next.band.toFixed(1)}.
              </>
            ) : (
              'This is the top band.'
            )}
          </p>
        </section>
      </div>

      <section aria-labelledby="types-h" className={`${card} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="types-h" className="m-0 text-[17px] font-semibold text-navy">
            Accuracy by question type
          </h2>
          {focus && (
            <span className="text-sm text-muted">Lowest accuracy is marked as your focus area</span>
          )}
        </div>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {types.map(([type, t]) => {
            const pct = Math.round((t.correct / t.total) * 100);
            return (
              <li key={type} className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-3 text-sm">
                  <span>
                    {TYPE_NAMES[type]}
                    {type === focus && (
                      <span className="ml-2 rounded-[6px] bg-warn px-2 py-0.5 text-xs font-semibold text-warn-text">
                        Focus area
                      </span>
                    )}
                  </span>
                  <span className="font-mono font-semibold text-navy">
                    {t.correct} / {t.total} · {pct}%
                  </span>
                </div>
                <div aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-border">
                  <div className="h-full rounded-pill bg-navy" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        id="review"
        aria-labelledby="review-h"
        className={`${card} flex flex-col gap-3 !px-4 sm:!px-7`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
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
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                {['Q', 'Your answer', 'Correct answer', 'Result', 'Explanation'].map((h) => (
                  <th key={h} scope="col" className={th}>
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
                    <td className={`${td} font-mono font-semibold text-navy`}>{r.number}</td>
                    <td className={td}>
                      {r.given || <span className="text-muted">No answer</span>}
                    </td>
                    <td className={`${td} font-medium text-navy`}>{r.expected}</td>
                    <td className={td}>
                      <span
                        className={`inline-flex items-center gap-1 rounded-[6px] px-2 py-1 text-xs font-semibold ${chip}`}
                      >
                        <Icon aria-hidden="true" className="size-3.5" />
                        {word}
                      </span>
                    </td>
                    <td className={`${td} text-navy-3`}>{notes.get(r.number) ?? ''}</td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted">
                    Nothing to show here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
