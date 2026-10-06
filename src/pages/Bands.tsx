import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageSkeleton } from '../components/PageSkeleton';
import { card, chip } from '../components/progress/styles';
import { moduleName, MODULE_ORDER, partsOf } from '../engine/parts';
import {
  currentBands,
  explainOverall,
  focusArea,
  latestBands,
  moreForNextBand,
  nextTestFor,
  routeToTarget,
  stepBand,
  targetGapText,
  trendText,
  type ModuleBands,
  type ModuleStanding,
} from '../engine/progress';
import { tableFor } from '../engine/bands';
import { markParts } from '../engine/scoring';
import type { AttemptRecord } from '../engine/session';
import { SPEAKING_CRITERIA } from '../engine/speaking';
import { examHref, formatDate } from '../lib/links';
import { TYPE_NAMES } from '../lib/questionTypes';
import { useServices } from '../lib/services';
import { useProgress } from '../lib/useProgress';
import type { Module, QuestionType, TestMeta } from '../schema/test';

/** A labelled bar out of `max`, with the target band marked when given. */
function Bar({
  label,
  value,
  max,
  text,
  target,
}: {
  label: string;
  value: number;
  max: number;
  text: string;
  target?: number;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
      <span className="truncate text-text">{label}</span>
      <div aria-hidden="true" className="relative h-2 rounded-pill bg-border">
        <div
          className="h-full rounded-pill bg-navy"
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        />
        {target !== undefined && (
          <div
            className="absolute -top-1 h-4 w-0.5 bg-red"
            style={{ left: `calc(${(target / max) * 100}% - 1px)` }}
          />
        )}
      </div>
      <span className="font-mono font-semibold text-navy">{text}</span>
    </div>
  );
}

/** Advice for raising one module, from its latest attempt. */
function advice(module: Module, s: ModuleStanding | undefined): string {
  if (!s) return `No ${moduleName(module)} score yet: take a test first.`;
  const a = s.attempt;
  if (module === 'speaking' && a.speaking) {
    const lowest = [...SPEAKING_CRITERIA].sort(
      (x, y) => (a.speaking!.selfScores[x.id] ?? 9) - (a.speaking!.selfScores[y.id] ?? 9),
    )[0]!;
    return `${lowest.label} is your lowest criterion. Use the full two minutes in Part 2 and cut filler words.`;
  }
  if (module === 'writing') {
    const fb = a.writing?.ai?.task2 ?? a.writing?.ai?.task1;
    const lowest = fb && [...fb.criteria].sort((x, y) => x.band - y.band)[0];
    return lowest
      ? `${lowest.name} is holding you back. ${fb.topFixes[0] ?? ''}`.trim()
      : 'Get AI feedback on both tasks to see what holds you back.';
  }
  const weakest = a.score && focusArea(a.score.byType);
  return weakest
    ? `${TYPE_NAMES[weakest]} is your weakest question type.`
    : 'Review your last test’s wrong answers.';
}

/** Listening "correct by part" needs the test, so it loads it. */
function ListeningByPart({ attempt }: { attempt: AttemptRecord }) {
  const services = useServices();
  const [rows, setRows] = useState<{ part: number; correct: number; total: number }[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    services
      .loadTest(attempt.testId)
      .then((test) => {
        const parts = partsOf(test, 'listening').filter(
          (p) => attempt.mode === 'full' || p.part === attempt.part,
        );
        const out = parts.map((p) => {
          const results = markParts(test, 'listening', [p], attempt.answers);
          return {
            part: p.part,
            correct: results.filter((r) => r.correct).length,
            total: results.length,
          };
        });
        if (!cancelled) setRows(out);
      })
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [services, attempt]);
  if (!rows) return <p className="m-0 text-sm text-muted">Loading…</p>;
  return (
    <>
      {rows.map((r) => (
        <Bar
          key={r.part}
          label={`Part ${r.part}`}
          value={r.correct}
          max={r.total}
          text={`${r.correct}/${r.total}`}
        />
      ))}
    </>
  );
}

function moreLine(s: ModuleStanding, track: TestMeta['track']): string | null {
  const score = s.attempt.score;
  if (!score || (s.module !== 'listening' && s.module !== 'reading')) return null;
  const next = moreForNextBand(score.raw, score.total, score.band, tableFor(s.module, track));
  if (!next) return 'Top band: keep it there.';
  return `${next.more} more correct ${next.more === 1 ? 'answer' : 'answers'} would reach ${next.band.toFixed(1)}.`;
}

/** "/bands" — overall band with its rounding, module cards, what-if and the route to target. */
export function Bands() {
  const { state } = useProgress();
  const [whatIf, setWhatIf] = useState<ModuleBands | null>(null);

  if (state.status === 'loading') return <PageSkeleton label="Loading your bands…" />;
  if (state.status === 'error') {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-4 py-9 sm:px-8">
        <p role="alert" className="m-0 text-[15px] text-warn-text">
          {state.message}
        </p>
      </main>
    );
  }

  const { attempts, tests, profile } = state.data;
  const target = profile.targetBand;
  const standings = latestBands(attempts);
  const bands = currentBands(standings);
  // Modules without a score start the what-if at the target.
  const base: ModuleBands = {
    listening: standings.listening?.band.band ?? target,
    reading: standings.reading?.band.band ?? target,
    writing: standings.writing?.band.band ?? target,
    speaking: standings.speaking?.band.band ?? target,
  };
  const values = whatIf ?? base;
  const changed = MODULE_ORDER.some((m) => values[m] !== base[m]);
  const sim = explainOverall(values);
  const latestAt = Math.max(0, ...MODULE_ORDER.map((m) => standings[m]?.attempt.submittedAt ?? 0));
  const trackOf = (testId: string) => tests.find((t) => t.testId === testId)?.track ?? 'academic';
  const route = bands ? routeToTarget(bands, target) : null;
  const steady = bands ? MODULE_ORDER.filter((m) => bands[m] >= target) : [];

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-9 pb-12 sm:px-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[30px] leading-tight font-semibold text-navy">Band breakdown</h1>
          <p className="m-0 text-[15px] text-muted">
            How each module adds up to your overall band, and where the next half band comes from.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={chip}>
            <span aria-hidden="true" className="size-2 rounded-pill bg-red" />
            Target band <strong className="font-mono text-navy">{target.toFixed(1)}</strong>
          </span>
          {latestAt > 0 && <span className={chip}>Latest scores · {formatDate(latestAt)}</span>}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <section
          aria-label="Overall band"
          className="flex flex-col gap-2 rounded-card bg-navy p-6 text-on-navy"
        >
          <span className="text-sm text-on-navy-muted">Overall band (estimate)</span>
          {bands ? (
            <>
              <span className="font-mono text-[56px] leading-none font-semibold">
                {explainOverall(bands).overall.toFixed(1)}
              </span>
              <span className="font-mono text-sm">{explainOverall(bands).formula}</span>
              <span className="text-sm text-on-navy-muted">{explainOverall(bands).rule}</span>
              <span className="self-start rounded-pill bg-navy-2 px-3 py-1 text-sm font-semibold">
                {explainOverall(bands).overall >= target
                  ? `Target ${target.toFixed(1)} reached`
                  : `${(target - explainOverall(bands).overall).toFixed(1)} below target`}
              </span>
            </>
          ) : (
            <p className="m-0 text-[15px] text-on-navy-muted">
              Appears once all four modules have a score. Missing:{' '}
              {MODULE_ORDER.filter((m) => !standings[m])
                .map(moduleName)
                .join(', ')}
              .
            </p>
          )}
        </section>
        <div className="grid gap-4 sm:grid-cols-2">
          {MODULE_ORDER.map((m) => {
            const s = standings[m];
            return (
              <div key={m} className={`${card} flex flex-col gap-1 !p-5`}>
                <span className="text-sm font-semibold text-navy">{moduleName(m)}</span>
                {s ? (
                  <>
                    <span className="font-mono text-[32px] leading-tight font-semibold text-navy">
                      {s.band.band.toFixed(1)}
                    </span>
                    <span className="text-[13px] text-muted">{s.band.basis}</span>
                    <span className="flex flex-wrap gap-2 pt-1 text-xs font-semibold">
                      <span
                        className={`rounded-pill px-2.5 py-1 ${
                          s.band.band >= target
                            ? 'bg-good text-good-text'
                            : 'bg-warn text-warn-text'
                        }`}
                      >
                        {targetGapText(s.band.band, target)}
                      </span>
                      <span className="rounded-pill bg-surface-muted px-2.5 py-1 text-navy-3">
                        {trendText(s.band.band, s.previous)}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[15px] text-muted">Not attempted</span>
                    <NextTestLink module={m} tests={tests} attempts={attempts} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <section aria-labelledby="whatif-h" className={`${card} flex flex-col gap-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="whatif-h" className="m-0 text-xl font-semibold text-navy">
              What if?
            </h2>
            <p className="m-0 text-sm text-muted">
              Change any module by half a band to see how the overall band rounds.
            </p>
          </div>
          <button
            type="button"
            disabled={!changed}
            onClick={() => setWhatIf(null)}
            className="min-h-11 rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold text-navy disabled:opacity-50"
          >
            Reset to my scores
          </button>
        </div>
        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            {MODULE_ORDER.map((m) => {
              const diff = values[m] !== base[m];
              const set = (dir: 1 | -1) => setWhatIf({ ...values, [m]: stepBand(values[m], dir) });
              return (
                <div
                  key={m}
                  className={`flex items-center justify-between gap-3 rounded-control border p-3 ${
                    diff ? 'border-now-playing-border bg-now-playing' : 'border-border'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-navy">{moduleName(m)}</span>
                    <span className="text-xs text-muted">
                      {!standings[m]
                        ? 'No score yet'
                        : diff
                          ? `Your score: ${base[m].toFixed(1)}`
                          : 'Your score'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Lower ${moduleName(m)} by half a band`}
                      onClick={() => set(-1)}
                      className="flex size-11 items-center justify-center rounded-control border border-border-strong bg-surface text-navy"
                    >
                      <Minus aria-hidden="true" className="size-4" />
                    </button>
                    <span className="w-10 text-center font-mono text-lg font-semibold text-navy">
                      {values[m].toFixed(1)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Raise ${moduleName(m)} by half a band`}
                      onClick={() => set(1)}
                      className="flex size-11 items-center justify-center rounded-control border border-border-strong bg-surface text-navy"
                    >
                      <Plus aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div
            aria-live="polite"
            className={`flex flex-col gap-1.5 rounded-card p-5 text-on-navy ${
              sim.overall >= target ? 'bg-good-text' : 'bg-navy'
            }`}
          >
            <span className="text-sm text-on-navy-muted">Overall band</span>
            <span className="font-mono text-[44px] leading-none font-semibold">
              {sim.overall.toFixed(1)}
            </span>
            <span className="font-mono text-sm">{sim.formula}</span>
            <span className="text-sm">{sim.rule}.</span>
            <span className="text-sm font-semibold">
              {sim.overall >= target
                ? `Target ${target.toFixed(1)} reached`
                : `${(target - sim.overall).toFixed(1)} below target`}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1 rounded-control bg-surface-muted p-4 text-sm text-navy-3">
          <strong className="text-navy">How rounding works</strong>
          <span>An average ending in .25 rounds up to .5.</span>
          <span>One ending in .75 rounds up to the next whole band.</span>
          <span>Anything else rounds down to the nearest half.</span>
          <span className="font-mono">6.125 → 6.0 · 6.25 → 6.5 · 6.625 → 6.5 · 6.75 → 7.0</span>
        </div>
      </section>

      {bands && route && (
        <section aria-labelledby="route-h" className={`${card} flex flex-col gap-4`}>
          <h2 id="route-h" className="m-0 text-xl font-semibold text-navy">
            {route.reached
              ? `You’re at your target of ${target.toFixed(1)}`
              : `Fastest route to ${target.toFixed(1)}`}
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {route.options.map((option, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-control border border-border p-4">
                <span className="text-xs font-semibold tracking-[0.05em] text-muted uppercase">
                  Option {i + 1}
                  {i === 0 && route.options.length > 1 ? ' · Biggest gap' : ''}
                </span>
                <span className="font-semibold text-navy">
                  {option
                    .map((o) => `${moduleName(o.module)} ${o.from.toFixed(1)} → ${o.to.toFixed(1)}`)
                    .join(' and ')}
                </span>
                {option.map((o) => (
                  <p key={o.module} className="m-0 text-sm text-muted">
                    {advice(o.module, standings[o.module])}
                  </p>
                ))}
                <NextTestLink
                  module={option[0]!.module}
                  tests={tests}
                  attempts={attempts}
                  label={`Practise ${moduleName(option[0]!.module)}`}
                />
              </div>
            ))}
            {steady.length > 0 && (
              <div className="flex flex-col gap-2 rounded-control border border-border p-4">
                <span className="text-xs font-semibold tracking-[0.05em] text-muted uppercase">
                  Keep steady
                </span>
                <span className="font-semibold text-navy">
                  {steady.map(moduleName).join(' and ')} at or above {target.toFixed(1)}
                </span>
                <p className="m-0 text-sm text-muted">
                  One wrong answer can cost half a band. Review your last attempts to stay there.
                </p>
                <Link to="/history" className="text-sm font-semibold">
                  Review history
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="detail-h" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="detail-h" className="m-0 text-xl font-semibold text-navy">
            Inside each module
          </h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span aria-hidden="true" className="h-3 w-0.5 bg-red" />
            Red mark = band {target.toFixed(1)}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {MODULE_ORDER.map((m) => {
            const s = standings[m];
            const a = s?.attempt;
            const title = {
              listening: 'Listening · correct by part',
              reading: 'Reading · accuracy by type',
              writing: 'Writing · marking criteria',
              speaking: 'Speaking · marking criteria',
            }[m];
            const feedback = a?.writing?.ai?.task2 ?? a?.writing?.ai?.task1;
            return (
              <div key={m} className={`${card} flex flex-col gap-3 !p-5`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="m-0 text-base font-semibold text-navy">{title}</h3>
                  {s && (
                    <span className="font-mono font-semibold text-navy">
                      {s.band.band.toFixed(1)}
                    </span>
                  )}
                </div>
                {!s || !a ? (
                  <p className="m-0 text-sm text-muted">No score yet.</p>
                ) : m === 'listening' ? (
                  <ListeningByPart attempt={a} />
                ) : m === 'reading' ? (
                  (
                    Object.entries(a.score?.byType ?? {}) as [
                      QuestionType,
                      { correct: number; total: number },
                    ][]
                  ).map(([type, t]) => (
                    <Bar
                      key={type}
                      label={TYPE_NAMES[type]}
                      value={t.correct}
                      max={t.total}
                      text={`${t.correct}/${t.total}`}
                    />
                  ))
                ) : m === 'writing' ? (
                  feedback?.criteria.map((c) => (
                    <Bar
                      key={c.name}
                      label={c.name}
                      value={c.band}
                      max={9}
                      text={c.band.toFixed(1)}
                      target={target}
                    />
                  ))
                ) : (
                  SPEAKING_CRITERIA.map((c) => {
                    const v = a.speaking?.selfScores[c.id] ?? 0;
                    return (
                      <Bar
                        key={c.id}
                        label={c.label}
                        value={v}
                        max={9}
                        text={v.toFixed(1)}
                        target={target}
                      />
                    );
                  })
                )}
                {s && (
                  <p className="m-0 text-sm text-muted">
                    {m === 'writing'
                      ? a?.writing?.ai?.task1
                        ? 'Task 2 counts twice as much as Task 1.'
                        : 'Task 2 counts twice as much as Task 1. Task 1 has no feedback yet.'
                      : m === 'speaking'
                        ? `${s.band.basis}.`
                        : moreLine(s, trackOf(s.attempt.testId))}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function NextTestLink({
  module,
  tests,
  attempts,
  label,
}: {
  module: Module;
  tests: TestMeta[];
  attempts: AttemptRecord[];
  label?: string;
}) {
  const next = nextTestFor(module, tests, attempts);
  if (!next) return null;
  return (
    <Link to={examHref(next.testId, module)} className="text-sm font-semibold">
      {label ?? `Start ${moduleName(module)}`}
    </Link>
  );
}
