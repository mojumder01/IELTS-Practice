import { vi } from 'vitest';
import sampleJson from '../../content/tests/book21-test1.json';
import type { AttemptRecord, Session } from '../../src/engine/session';
import { TestFileSchema } from '../../src/schema/test';
import {
  createExamStore,
  type LocalAttempts,
  type RemoteAttempts,
} from '../../src/store/examStore';

export const sample = TestFileSchema.parse(sampleJson);

/** A hand-driven clock, timers, device storage and Firestore, shared across "reloads". */
export function examWorld() {
  let now = 1_000_000;
  let nextId = 1;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  const localData = new Map<string, string>();
  const remoteData = new Map<string, AttemptRecord>();

  const local: LocalAttempts = {
    load: (key) => (localData.has(key) ? (JSON.parse(localData.get(key)!) as unknown) : null),
    save: (key, session: Session) => localData.set(key, JSON.stringify(session)),
    remove: (key) => localData.delete(key),
  };
  const remote = {
    findInProgress: vi.fn((testId: string, module: string) =>
      Promise.resolve(
        [...remoteData.values()]
          .filter((a) => a.testId === testId && a.module === module && a.status === 'in_progress')
          .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null,
      ),
    ),
    save: vi.fn((a: AttemptRecord) => {
      remoteData.set(a.attemptId, structuredClone(a));
      return Promise.resolve();
    }),
    remove: vi.fn((id: string) => {
      remoteData.delete(id);
      return Promise.resolve();
    }),
    get: vi.fn((id: string) => Promise.resolve(remoteData.get(id) ?? null)),
    list: vi.fn(() => Promise.resolve([...remoteData.values()])),
  } satisfies RemoteAttempts;

  const newStore = () =>
    createExamStore({
      now: () => now,
      newId: () => `attempt-${nextId++}`,
      local,
      remote,
      setTimer: (fn, ms) => {
        const id = timers.length + 1;
        timers.push({ at: now + ms, fn, id });
        return id;
      },
      clearTimer: (handle) => {
        const i = timers.findIndex((t) => t.id === handle);
        if (i >= 0) timers.splice(i, 1);
      },
    });

  /** Moves the clock on, firing any timers that come due. */
  const advance = (ms: number) => {
    now += ms;
    for (const t of [...timers].sort((a, b) => a.at - b.at)) {
      if (t.at <= now) {
        timers.splice(timers.indexOf(t), 1);
        t.fn();
      }
    }
  };

  return { newStore, advance, local, localData, remote, remoteData, now: () => now };
}
