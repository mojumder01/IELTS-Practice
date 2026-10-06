import { ArrowLeft, CircleCheck, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { PageSkeleton } from '../components/PageSkeleton';
import { card } from '../components/progress/styles';
import { ScoredResults } from '../components/results/ScoredResults';
import { SpeakingResults } from '../components/results/SpeakingResults';
import { WritingResults } from '../components/results/WritingResults';
import { moduleName, partsOf } from '../engine/parts';
import { attemptBand } from '../engine/progress';
import { markParts, scoreResults, type QuestionResult, type Score } from '../engine/scoring';
import type { AttemptRecord } from '../engine/session';
import { durationSec, formatClock } from '../engine/timer';
import { useAuth } from '../lib/auth';
import { examHref, formatDate, testName } from '../lib/links';
import { useServices } from '../lib/services';
import type { Profile } from '../schema/profile';
import type { TestFile } from '../schema/test';

interface Loaded {
  attempt: AttemptRecord;
  test: TestFile;
  profile: Profile;
  /** Reading and Listening only. */
  marked: { results: QuestionResult[]; score: Score } | null;
}

/** /results/:attemptId: the band, how it was reached and every answer (Results artboard). */
export function Results() {
  const { attemptId = '' } = useParams();
  const services = useServices();
  const { state } = useAuth();
  const uid = state.status === 'owner' ? state.user.uid : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const attempt = await services.attempts(uid).get(attemptId);
      if (!attempt) throw new Error('This attempt doesn’t exist.');
      const [test, profile] = await Promise.all([
        services.loadTest(attempt.testId),
        services.profile(uid).get(),
      ]);
      let marked: Loaded['marked'] = null;
      if (attempt.module === 'reading' || attempt.module === 'listening') {
        const parts = partsOf(test, attempt.module).filter(
          (p) => attempt.mode === 'full' || p.part === attempt.part,
        );
        const results = markParts(test, attempt.module, parts, attempt.answers);
        marked = { results, score: scoreResults(results, attempt.module, test.meta.track) };
      }
      if (!cancelled) setLoaded({ attempt, test, profile, marked });
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
  if (!loaded) return <PageSkeleton label="Loading results…" />;

  const { attempt, test, profile, marked } = loaded;
  const module = attempt.module;
  const target = profile.targetBand;
  // Scored modules are re-marked from the answers, so content fixes reach old attempts.
  const band = marked
    ? { band: marked.score.band, estimate: marked.score.estimate }
    : attemptBand(attempt);
  const name =
    module === 'reading'
      ? test.meta.track === 'general'
        ? 'General Training Reading'
        : 'Academic Reading'
      : moduleName(module);
  const single = attempt.mode === 'single' && module !== 'speaking';
  const readingTitle =
    module === 'reading' && single
      ? test.sections[`reading-${attempt.part}` as 'reading-1']
      : undefined;
  const title =
    readingTitle?.kind === 'reading'
      ? readingTitle.title
      : `${testName(test.meta)}${single ? ` · ${module === 'writing' ? 'Task' : 'Part'} ${attempt.part}` : ''}`;
  const allowed = durationSec(test.meta.timing, module, attempt.mode, attempt.part ?? 1);
  const used = allowed === null ? null : allowed - attempt.timeLeftSec;
  const submitted = attempt.submittedAt ? formatDate(attempt.submittedAt) : null;

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-8 pb-12 sm:px-8">
      <Link
        to="/"
        className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to dashboard
      </Link>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="m-0 text-sm font-medium text-muted">
            Results · {name}
            {readingTitle && ` · ${testName(test.meta)}`}
          </p>
          <h1 className="m-0 text-[30px] leading-tight font-semibold text-navy">{title}</h1>
          <p className="m-0 text-[15px] text-muted">
            {attempt.status === 'submitted' ? `Submitted ${submitted ?? ''}` : 'Not submitted yet'}
            {used !== null &&
              allowed !== null &&
              ` · Time used ${formatClock(used)} of ${formatClock(allowed)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={examHref(attempt.testId, module, attempt.mode, attempt.part ?? 1)}
            className="inline-flex min-h-11 items-center rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold text-navy no-underline hover:text-navy"
          >
            Retake test
          </Link>
          {marked && (
            <a
              href="#review"
              className="inline-flex min-h-11 items-center rounded-control bg-navy px-4 text-sm font-semibold text-on-navy no-underline hover:text-on-navy"
            >
              Review answers
            </a>
          )}
        </div>
      </section>

      <section
        aria-label="Band score"
        className={`${card} flex flex-wrap items-center gap-x-8 gap-y-3`}
      >
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-sm font-medium text-muted">
            {moduleName(module)} band{band?.estimate ? ' (estimate)' : ''}
          </h2>
          <span className="font-mono text-[56px] leading-none font-semibold text-navy">
            {band ? band.band.toFixed(1) : '—'}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {marked && (
            <span className="text-[15px] text-navy">
              {marked.score.raw} / {marked.score.total} correct
              {marked.score.estimate && ' · scaled to 40 questions'}
            </span>
          )}
          {!marked && band && 'basis' in band && (
            <span className="text-[15px] text-navy">{band.basis}</span>
          )}
          {!band && (
            <span className="text-[15px] text-muted">
              {module === 'writing'
                ? 'No band yet: Task 2 needs AI feedback.'
                : 'No band yet: score all four criteria on the Speaking page.'}
            </span>
          )}
          {band && (
            <span
              className={`inline-flex items-center gap-1.5 self-start rounded-pill px-3 py-1 text-sm font-semibold ${
                band.band >= target ? 'bg-good text-good-text' : 'bg-warn text-warn-text'
              }`}
            >
              {band.band >= target ? (
                <CircleCheck aria-hidden="true" className="size-4" />
              ) : (
                <Target aria-hidden="true" className="size-4" />
              )}
              {band.band >= target
                ? `Target ${target.toFixed(1)} reached`
                : `${(target - band.band).toFixed(1)} below target ${target.toFixed(1)}`}
            </span>
          )}
          {attempt.revealUsed && (
            <span className="self-start rounded-control bg-answer-hl px-3 py-1.5 text-sm font-medium text-flag-stroke">
              Practice: answers were shown, so this attempt doesn’t count toward your band history.
            </span>
          )}
        </div>
      </section>

      {marked && (module === 'reading' || module === 'listening') && (
        <ScoredResults
          attempt={attempt}
          module={module}
          test={test}
          results={marked.results}
          score={marked.score}
        />
      )}
      {module === 'writing' && <WritingResults attempt={attempt} test={test} />}
      {module === 'speaking' && <SpeakingResults attempt={attempt} />}
    </main>
  );
}
