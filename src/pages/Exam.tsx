import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { FullPageStatus } from '../components/FullPageStatus';
import { ExamShell } from '../components/exam/ExamShell';
import { ListeningContent } from '../components/listening/ListeningContent';
import { ReadingContent } from '../components/reading/ReadingContent';
import { SpeakingContent } from '../components/speaking/SpeakingContent';
import { WritingContent } from '../components/writing/WritingContent';
import type { ExamMode } from '../engine/timer';
import { useAuth } from '../lib/auth';
import { useServices } from '../lib/services';
import { ModuleSchema, TestFileSchema, type Module } from '../schema/test';
import { ExamStoreContext, useExam } from '../store/examContext';
import { createExamStore, type LocalAttempts } from '../store/examStore';

/** Device storage that forgets on reload: previews leave nothing behind. */
function memoryLocal(): LocalAttempts {
  const data = new Map<string, unknown>();
  return {
    load: (key) => data.get(key) ?? null,
    save: (key, session) => data.set(key, structuredClone(session)),
    remove: (key) => data.delete(key),
  };
}

/** /test/:testId/:module — a fresh store per test and module. */
export function ExamRoute() {
  const { testId, module } = useParams();
  const parsed = ModuleSchema.safeParse(module);
  if (!testId || !parsed.success) return <Navigate to="/" replace />;
  return <Exam key={`${testId}/${parsed.data}`} testId={testId} module={parsed.data} />;
}

function Exam({ testId, module }: { testId: string; module: Module }) {
  const services = useServices();
  const { state } = useAuth();
  const [params, setParams] = useSearchParams();
  const uid = state.status === 'owner' ? state.user.uid : null;
  // ?preview=draft (from the admin): the draft, with nothing saved on the device or in Firestore.
  const [preview] = useState(() => params.get('preview') === 'draft');

  const [store] = useState(() =>
    createExamStore({
      now: services.now,
      newId: services.newId,
      local: preview ? memoryLocal() : services.local,
      remote: uid && !preview ? services.attempts(uid) : null,
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (handle) => window.clearTimeout(handle as number),
    }),
  );
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Load the test, then resume the unfinished sitting or start one from the URL.
  useEffect(() => {
    let cancelled = false;
    // Speaking is one sitting across its three parts, with no timer to choose.
    const mode: ExamMode =
      module === 'speaking' || params.get('mode') === 'full' ? 'full' : 'single';
    const part = Math.max(1, Number.parseInt(params.get('part') ?? '1', 10) || 1);
    const load = preview
      ? services.admin.drafts.get(testId).then((draft) => {
          const parsed = TestFileSchema.safeParse(draft);
          if (!parsed.success) {
            throw new Error('Fix the draft’s schema problems in the admin before previewing it.');
          }
          return parsed.data;
        })
      : services.loadTest(testId);
    load
      .then((test) => store.getState().open({ test, module, mode, part }))
      .then(() => !cancelled && setReady(true))
      .catch((e: unknown) => {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'The test could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
    // The URL is read once: after that the sitting decides the mode and part.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, services, testId, module]);

  // One tick a second drives the countdown and auto-submit; the clock stops while the page is hidden.
  useEffect(() => {
    const interval = window.setInterval(() => store.getState().tick(), 1000);
    const onVisibility = () => store.getState().setVisible(document.visibilityState === 'visible');
    onVisibility();
    const onPageHide = () => store.getState().setVisible(false);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      store.getState().setVisible(false);
    };
  }, [store]);

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <div
          role="alert"
          className="flex max-w-[420px] flex-col gap-3 rounded-card border border-border bg-surface p-7"
        >
          <h1 className="m-0 text-xl font-semibold text-navy">This test can’t be opened</h1>
          <p className="m-0 text-[15px] text-muted">{error}</p>
          <Link to="/">Back to home</Link>
        </div>
      </main>
    );
  }
  if (!ready) return <FullPageStatus label="Loading test…" />;

  return (
    <ExamStoreContext value={store}>
      <SyncUrl params={params} setParams={setParams} />
      <ExamShell notice={preview ? 'Preview of the draft: nothing you do here is saved.' : null}>
        <ModuleContent />
      </ExamShell>
    </ExamStoreContext>
  );
}

/** Keeps ?mode= and ?part= matching the sitting, so a reload or bookmark lands in the same place. */
function SyncUrl({
  params,
  setParams,
}: {
  params: URLSearchParams;
  setParams: ReturnType<typeof useSearchParams>[1];
}) {
  const mode = useExam((s) => s.session?.mode);
  const part = useExam((s) => s.session?.part);
  useEffect(() => {
    if (!mode || !part) return;
    if (params.get('mode') !== mode || params.get('part') !== String(part)) {
      setParams({ mode, part: String(part) }, { replace: true });
    }
  }, [mode, part, params, setParams]);
  return null;
}

function ModuleContent() {
  const test = useExam((s) => s.test);
  const session = useExam((s) => s.session);
  if (!test || !session) return null;

  const section =
    session.module === 'reading' || session.module === 'listening'
      ? test.sections[`${session.module}-${session.part}` as 'reading-1']
      : undefined;
  if (section?.kind === 'reading') return <ReadingContent key={section.part} section={section} />;
  if (section?.kind === 'listening')
    return <ListeningContent key={section.part} section={section} />;
  const writing = test.sections.writing;
  if (session.module === 'writing' && writing?.kind === 'writing') {
    return <WritingContent key={session.part} section={writing} />;
  }
  const speaking = test.sections.speaking;
  if (session.module === 'speaking' && speaking?.kind === 'speaking') {
    return <SpeakingContent key={session.part} section={speaking} />;
  }
  return (
    <p className="mx-auto max-w-[520px] px-6 py-12 text-center text-[15px] text-muted">
      This {session.module === 'writing' ? 'task' : 'part'} isn’t in this test yet.
    </p>
  );
}
