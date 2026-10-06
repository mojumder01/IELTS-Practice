import {
  ArrowRight,
  BookOpen,
  Headphones,
  Mic,
  PenLine,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ConfirmDialog } from '../components/exam/ConfirmDialog';
import { PageSkeleton } from '../components/PageSkeleton';
import { BandBar } from '../components/progress/BandBar';
import { AttemptTable } from '../components/progress/AttemptTable';
import { GoalsEditor } from '../components/progress/GoalsEditor';
import { card, chip } from '../components/progress/styles';
import { moduleName, MODULE_ORDER } from '../engine/parts';
import {
  byNewest,
  currentBands,
  explainOverall,
  latestBands,
  nextTestFor,
  progressLine,
} from '../engine/progress';
import type { AttemptRecord } from '../engine/session';
import { formatClock } from '../engine/timer';
import { useAuth } from '../lib/auth';
import { formatToday } from '../lib/dates';
import { examHref, formatDate, testName } from '../lib/links';
import { useProgress } from '../lib/useProgress';
import type { Module } from '../schema/test';

const TILES: Record<Module, { icon: LucideIcon; text: string }> = {
  listening: { icon: Headphones, text: '4 parts · 40 questions · about 30 min' },
  reading: { icon: BookOpen, text: '3 passages · 40 questions · 60 min' },
  writing: { icon: PenLine, text: '2 tasks · 60 min · live word count' },
  speaking: { icon: Mic, text: '3 parts · 11–14 min · record yourself' },
};

/** "/" — resume, latest bands against the target, module tiles and recent attempts (Dashboard artboard). */
export function Dashboard() {
  const { state: auth } = useAuth();
  const { state, saveProfile, discard } = useProgress();
  const [editingGoals, setEditingGoals] = useState(false);
  const [discarding, setDiscarding] = useState<AttemptRecord | null>(null);

  if (state.status === 'loading') return <PageSkeleton label="Loading your progress…" />;
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
  const names = new Map(tests.map((t) => [t.testId, testName(t)]));
  const nameOf = (testId: string) => names.get(testId) ?? testId;
  const user = auth.status === 'owner' ? auth.user : null;
  const firstName = user?.displayName?.split(' ')[0] ?? user?.email ?? 'there';
  const inProgress = byNewest(attempts.filter((a) => a.status === 'in_progress'))[0] ?? null;
  const standings = latestBands(attempts);
  const bands = currentBands(standings);
  const recent = byNewest(attempts.filter((a) => a.status === 'submitted')).slice(0, 5);

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-7 px-4 pt-9 pb-12 sm:px-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="m-0 text-sm font-medium text-muted">{formatToday(new Date())}</p>
          <h1 className="m-0 text-[30px] leading-tight font-semibold text-navy">
            Welcome back, {firstName}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={chip}>
            <span aria-hidden="true" className="size-2 rounded-pill bg-red" />
            Target band <strong className="font-mono text-navy">{target.toFixed(1)}</strong>
          </span>
          <span className={chip}>
            Exam date{' '}
            <strong className="text-navy">
              {profile.examDate ? formatDate(Date.parse(profile.examDate)) : 'not set'}
            </strong>
          </span>
          <button
            type="button"
            aria-expanded={editingGoals}
            onClick={() => setEditingGoals(!editingGoals)}
            className="min-h-11 rounded-control px-3 text-sm font-semibold text-link"
          >
            Edit goals
          </button>
        </div>
      </section>
      {editingGoals && (
        <GoalsEditor
          profile={profile}
          onSave={saveProfile}
          onClose={() => setEditingGoals(false)}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="continue-h" className={`${card} flex flex-col gap-4`}>
          {inProgress ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-pill bg-now-playing px-3 py-1 text-xs font-semibold text-answered">
                  In progress
                </span>
                {inProgress.module !== 'speaking' && (
                  <span className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-navy">
                    <Timer aria-hidden="true" className="size-4" />
                    {formatClock(inProgress.timeLeftSec)} left
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <h2 id="continue-h" className="m-0 text-xl font-semibold text-navy">
                  {moduleName(inProgress.module)}: {nameOf(inProgress.testId)}
                </h2>
                <p className="m-0 text-[15px] text-muted">{progressLine(inProgress)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={examHref(
                    inProgress.testId,
                    inProgress.module,
                    inProgress.mode,
                    inProgress.part,
                  )}
                  className="inline-flex min-h-11 items-center gap-2 rounded-control bg-navy px-5 text-sm font-semibold text-on-navy no-underline hover:text-on-navy"
                >
                  Resume test
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => setDiscarding(inProgress)}
                  className="min-h-11 rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold text-navy"
                >
                  Discard attempt
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 id="continue-h" className="m-0 text-xl font-semibold text-navy">
                Nothing in progress
              </h2>
              <p className="m-0 text-[15px] text-muted">
                Pick a module below, or browse every test in the library.
              </p>
              <Link to="/library" className="self-start text-sm font-semibold">
                Open the test library
              </Link>
            </>
          )}
        </section>

        <section aria-labelledby="bands-h" className={`${card} flex flex-col gap-4`}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="bands-h" className="m-0 text-[17px] font-semibold text-navy">
              Latest band by module
            </h2>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span aria-hidden="true" className="h-3 w-0.5 bg-red" />
              Target {target.toFixed(1)}
            </span>
          </div>
          {MODULE_ORDER.map((m) => {
            const band = standings[m]?.band.band ?? null;
            return (
              <div key={m} className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-medium text-navy">{moduleName(m)}</span>
                  <span
                    className={band === null ? 'text-muted' : 'font-mono font-semibold text-navy'}
                  >
                    {band === null ? 'Not attempted' : band.toFixed(1)}
                  </span>
                </div>
                <BandBar band={band} target={target} />
              </div>
            );
          })}
          <p className="m-0 text-sm text-muted">
            {bands
              ? `Overall band ${explainOverall(bands).overall.toFixed(1)}: ${explainOverall(bands).rule}.`
              : 'Overall band appears once all four modules have a score.'}
          </p>
          <Link to="/bands" className="text-sm font-semibold">
            See full band breakdown
          </Link>
        </section>
      </div>

      <section aria-labelledby="modules-h" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="modules-h" className="m-0 text-xl font-semibold text-navy">
            Start a mock test
          </h2>
          <span className="text-sm text-muted">Timed, exam-style, scored instantly</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULE_ORDER.map((m) => {
            const { icon: Icon, text } = TILES[m];
            const next = nextTestFor(m, tests, attempts);
            return (
              <div key={m} className={`${card} flex flex-col gap-3 !p-5`}>
                <span className="flex size-11 items-center justify-center rounded-control bg-surface-muted text-navy">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="m-0 text-base font-semibold text-navy">{moduleName(m)}</h3>
                  <p className="m-0 text-sm text-muted">{text}</p>
                </div>
                {next ? (
                  <Link
                    to={examHref(next.testId, m)}
                    className="mt-auto inline-flex min-h-11 items-center justify-between gap-2 rounded-control border border-border-strong px-4 text-sm font-semibold text-navy no-underline hover:text-navy"
                  >
                    Start {moduleName(m)}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                ) : (
                  <span className="mt-auto text-sm text-muted">No tests published yet</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="recent-h" className={`${card} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="recent-h" className="m-0 text-[17px] font-semibold text-navy">
            Recent attempts
          </h2>
          <Link to="/history" className="text-sm font-semibold">
            View all history
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="m-0 text-sm text-muted">Finished tests appear here.</p>
        ) : (
          <AttemptTable attempts={recent} nameOf={nameOf} />
        )}
      </section>

      {discarding && (
        <ConfirmDialog
          title="Discard this attempt?"
          message="Its answers, notes and time are deleted from this device and your account."
          confirmLabel="Discard"
          onCancel={() => setDiscarding(null)}
          onConfirm={() => {
            void discard(discarding);
            setDiscarding(null);
          }}
        />
      )}
    </main>
  );
}
