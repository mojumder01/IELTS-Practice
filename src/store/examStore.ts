import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import { remoteSaveDelay, type SaveReason } from '../engine/autosave';
import { partsOf } from '../engine/parts';
import { markParts, scoreResults } from '../engine/scoring';
import * as engine from '../engine/session';
import type { AttemptRecord, Session } from '../engine/session';
import { durationSec, stopTimer, type ExamMode } from '../engine/timer';
import { ModuleSchema, type Module, type TestFile } from '../schema/test';

/** Device storage for the live sitting (localStorage in the app). */
export interface LocalAttempts {
  load: (key: string) => unknown;
  save: (key: string, session: Session) => void;
  remove: (key: string) => void;
}

/** Firestore attempts for the signed-in owner (src/lib/db.ts in the app). */
export interface RemoteAttempts {
  findInProgress: (testId: string, module: Module) => Promise<AttemptRecord | null>;
  save: (attempt: AttemptRecord) => Promise<void>;
  remove: (attemptId: string) => Promise<void>;
  get: (attemptId: string) => Promise<AttemptRecord | null>;
}

export interface ExamDeps {
  now: () => number;
  newId: () => string;
  local: LocalAttempts;
  remote: RemoteAttempts | null;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

export interface OpenParams {
  test: TestFile;
  module: Module;
  mode: ExamMode;
  part: number;
}

export interface ExamState {
  test: TestFile | null;
  session: Session | null;
  /** Whether the page is showing; the clock stops while it isn't. */
  visible: boolean;
  /** The clock reading at the last tick; the countdown re-renders from it. */
  clockNow: number;
  /** Last time a change was saved, for "Autosaved at hh:mm:ss". */
  lastSavedAt: number | null;
  saveError: string | null;
  /** Answers shown for everything (header lightbulb), or per question or group key. Not saved. */
  revealAll: boolean;
  shown: Record<string, boolean>;
  open: (params: OpenParams) => Promise<Session>;
  answer: (n: number, value: string) => void;
  toggleFlag: (n: number) => void;
  setNotes: (notes: string) => void;
  goTo: (n: number) => void;
  goToPart: (part: number) => void;
  clearPart: () => void;
  switchMode: (mode: ExamMode, part: number) => void;
  pause: () => void;
  resume: () => void;
  setVisible: (visible: boolean) => void;
  tick: () => void;
  setRevealAll: (on: boolean) => void;
  toggleShown: (key: string) => void;
  toggleScriptMark: (line: number) => void;
  /** Saved on the device as the audio plays; Firestore doesn't need it. */
  setAudioPosition: (part: number, seconds: number) => void;
  hideAnswers: () => void;
  submit: () => Promise<void>;
  flush: () => Promise<void>;
}

/** One live sitting per test and module on this device. */
export function localKey(testId: string, module: Module): string {
  return `ielts:attempt:${testId}:${module}`;
}

const TimerSchema = z.strictObject({
  remainingMs: z.number().nonnegative(),
  runningSince: z.number().nullable(),
});

/** What localStorage holds; anything else (an older format, a bad edit) is ignored. */
export const SessionSchema = z.strictObject({
  attemptId: z.string().min(1),
  testId: z.string().min(1),
  module: ModuleSchema,
  mode: z.enum(['single', 'full']),
  part: z.number().int().min(1).max(4),
  current: z.number().int().nullable(),
  answers: z.record(z.string(), z.string()),
  flagged: z.array(z.number().int()),
  notes: z.string(),
  scriptMarks: z.array(z.number().int()),
  audioPositions: z.record(z.string(), z.number().nonnegative()).default({}),
  revealUsed: z.boolean(),
  paused: z.boolean(),
  status: z.enum(['in_progress', 'submitted']),
  timer: TimerSchema.nullable(),
  score: z
    .strictObject({
      raw: z.number(),
      total: z.number(),
      band: z.number(),
      estimate: z.boolean(),
      byType: z.record(z.string(), z.strictObject({ correct: z.number(), total: z.number() })),
    })
    .nullable(),
  startedAt: z.number(),
  updatedAt: z.number(),
  submittedAt: z.number().nullable(),
}) satisfies z.ZodType<Omit<Session, 'score'> & { score: unknown }>;

export type ExamStore = ReturnType<typeof createExamStore>;

export function createExamStore(deps: ExamDeps) {
  let lastRemoteAt: number | null = null;
  let pending: unknown = null;
  let remoteWrites: Promise<void> = Promise.resolve();

  return createStore<ExamState>()((set, get) => {
    const keyOf = (s: Session) => localKey(s.testId, s.module);

    /** Saved with the clock stopped, so time doesn't run while the app is closed. */
    const saveLocal = (s: Session) => {
      if (s.status === 'submitted') deps.local.remove(keyOf(s));
      else deps.local.save(keyOf(s), { ...s, timer: s.timer && stopTimer(s.timer, deps.now()) });
    };

    const writeRemote = (): Promise<void> => {
      if (pending !== null) deps.clearTimer(pending);
      pending = null;
      const { session } = get();
      if (!session || !deps.remote) return remoteWrites;
      const remote = deps.remote;
      const record = engine.toAttempt(session, deps.now());
      lastRemoteAt = deps.now();
      remoteWrites = remoteWrites
        .then(() => remote.save(record))
        .then(() => set({ saveError: null }))
        .catch((error: unknown) => {
          console.error('Could not save the attempt to Firestore', error);
          set({
            saveError: 'Saved on this device; Firestore will catch up when you’re back online.',
          });
        });
      return remoteWrites;
    };

    const scheduleRemote = (reason: SaveReason) => {
      if (!deps.remote) return;
      const delay = remoteSaveDelay(lastRemoteAt, deps.now(), reason);
      if (delay === 0) void writeRemote();
      else if (pending === null) pending = deps.setTimer(() => void writeRemote(), delay);
    };

    /** Listening and Reading are marked the moment they're submitted, however that happens. */
    const withScore = (s: Session): Session => {
      const { test } = get();
      if (!test || (s.module !== 'reading' && s.module !== 'listening')) return s;
      const parts = partsOf(test, s.module).filter((p) => s.mode === 'full' || p.part === s.part);
      const results = markParts(test, s.module, parts, s.answers);
      return results.length ? { ...s, score: scoreResults(results, s.module, test.meta.track) } : s;
    };

    /** Applies an engine step, saves it on the device at once and queues Firestore. */
    const update = (step: (s: Session, now: number) => Session, reason: SaveReason | null) => {
      const s = get().session;
      if (!s) return;
      const now = deps.now();
      let next = step(s, now);
      if (next === s) return;
      if (next.status === 'submitted' && s.status !== 'submitted') next = withScore(next);
      set({ session: next, ...(reason ? { lastSavedAt: now } : {}) });
      saveLocal(next);
      if (next.status === 'submitted' && s.status !== 'submitted') scheduleRemote('submit');
      else if (reason) scheduleRemote(reason);
    };

    const partOf = (n: number) => {
      const { test, session } = get();
      if (!test || !session) return null;
      return partsOf(test, session.module).find((p) => p.numbers.includes(n))?.part ?? null;
    };

    return {
      test: null,
      session: null,
      visible: true,
      clockNow: deps.now(),
      lastSavedAt: null,
      saveError: null,
      revealAll: false,
      shown: {},

      open: async ({ test, module, mode, part }) => {
        const testId = test.meta.testId;
        const parsed = SessionSchema.safeParse(deps.local.load(localKey(testId, module)));
        const local = parsed.success && parsed.data.status === 'in_progress' ? parsed.data : null;

        let remote: Session | null = null;
        try {
          const record = deps.remote ? await deps.remote.findInProgress(testId, module) : null;
          remote = record ? engine.fromAttempt(record) : null;
          if (record) lastRemoteAt = deps.now();
        } catch (error) {
          console.error('Could not look for a saved attempt in Firestore', error);
        }

        // Resume the unfinished sitting (this device's copy unless another device saved later).
        const resumed =
          local && remote
            ? remote.updatedAt > local.updatedAt
              ? remote
              : local
            : (local ?? remote);
        const now = deps.now();
        const session =
          resumed ??
          engine.createSession({
            attemptId: deps.newId(),
            testId,
            module,
            mode,
            part,
            totalSec: durationSec(test.meta.timing, module, mode, part),
            now,
          });
        const running = engine.runClock(session, get().visible, now);
        set({
          test,
          session: running,
          clockNow: now,
          lastSavedAt: resumed ? resumed.updatedAt : null,
        });
        saveLocal(running);
        return running;
      },

      answer: (n, value) => update((s, now) => engine.setAnswer(s, n, value, now), 'change'),
      toggleFlag: (n) => update((s, now) => engine.toggleFlag(s, n, now), 'change'),
      setNotes: (notes) => update((s, now) => engine.setNotes(s, notes, now), 'change'),

      goTo: (n) => {
        const part = partOf(n);
        const before = get().session?.part;
        if (part === null) return;
        update((s, now) => engine.goTo(s, n, part, now), part !== before ? 'part' : null);
      },

      goToPart: (part) => {
        const { test, session } = get();
        if (!test || !session) return;
        const first =
          partsOf(test, session.module).find((p) => p.part === part)?.numbers[0] ?? null;
        update((s, now) => engine.goToPart(s, part, first, now), 'part');
      },

      clearPart: () => {
        const { test, session } = get();
        if (!test || !session) return;
        const numbers =
          partsOf(test, session.module).find((p) => p.part === session.part)?.numbers ?? [];
        // The highlighter only works in single-part mode, so its marks all belong to this part.
        update(
          (s, now) => engine.clearPart(s, numbers, s.mode === 'single' ? s.scriptMarks : [], now),
          'change',
        );
      },

      switchMode: (mode, part) => {
        const { test, session, visible } = get();
        if (!test || !session || session.mode === mode) return;
        const now = deps.now();
        const fresh = engine.createSession({
          attemptId: deps.newId(),
          testId: session.testId,
          module: session.module,
          mode,
          part,
          totalSec: durationSec(test.meta.timing, session.module, mode, part),
          now,
        });
        if (deps.remote) {
          const remote = deps.remote;
          remoteWrites = remoteWrites.then(() => remote.remove(session.attemptId)).catch(() => {});
        }
        if (pending !== null) deps.clearTimer(pending);
        pending = null;
        lastRemoteAt = null;
        const running = engine.runClock(fresh, visible, now);
        set({ session: running, lastSavedAt: null, revealAll: false, shown: {} });
        saveLocal(running);
      },

      pause: () => update((s, now) => engine.pause(s, now), 'change'),
      resume: () =>
        update((s, now) => engine.runClock(engine.resume(s, now), get().visible, now), 'change'),

      setVisible: (visible) => {
        set({ visible });
        update((s, now) => engine.runClock(s, visible, now), null);
        if (!visible) void get().flush();
      },

      tick: () => {
        set({ clockNow: deps.now() });
        const s = get().session;
        if (!s) return;
        const next = engine.tick(s, deps.now());
        if (next !== s) update(() => next, 'submit');
        else if (s.timer?.runningSince != null) saveLocal(s); // keeps time left current on the device
      },

      // Showing any answer before submitting keeps the attempt out of band history.
      setRevealAll: (on) => {
        set({ revealAll: on });
        if (on) update((s, now) => engine.markRevealUsed(s, now), 'change');
      },
      toggleShown: (key) => {
        const on = !get().shown[key];
        set({ shown: { ...get().shown, [key]: on } });
        if (on) update((s, now) => engine.markRevealUsed(s, now), 'change');
      },
      hideAnswers: () => set({ revealAll: false, shown: {} }),
      toggleScriptMark: (line) =>
        update((s, now) => engine.toggleScriptMark(s, line, now), 'change'),
      setAudioPosition: (part, seconds) =>
        update((s) => engine.setAudioPosition(s, part, seconds), null),

      submit: async () => {
        update((s, now) => engine.submit(s, now), 'submit');
        await remoteWrites;
      },

      flush: () => (pending !== null ? writeRemote() : remoteWrites),
    };
  });
}
