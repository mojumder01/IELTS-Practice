import type { Attempt } from '../schema/attempt';
import type { Module } from '../schema/test';
import {
  createTimer,
  isExpired,
  startTimer,
  stopTimer,
  timeLeftSec,
  type ExamMode,
  type TimerState,
} from './timer';

/** One sitting of one module, as the exam store holds it. Times are epoch ms. */
export interface Session {
  attemptId: string;
  testId: string;
  module: Module;
  mode: ExamMode;
  /** Current part; fixed in single-part mode. */
  part: number;
  current: number | null;
  answers: Record<string, string>;
  flagged: number[];
  notes: string;
  scriptMarks: number[];
  revealUsed: boolean;
  /** Paused by the student (the clock also stops while the page is closed). */
  paused: boolean;
  status: 'in_progress' | 'submitted';
  /** null for Speaking, which has no module timer. */
  timer: TimerState | null;
  startedAt: number;
  updatedAt: number;
  submittedAt: number | null;
}

export interface NewSession {
  attemptId: string;
  testId: string;
  module: Module;
  mode: ExamMode;
  part: number;
  totalSec: number | null;
  now: number;
}

export function createSession(s: NewSession): Session {
  return {
    attemptId: s.attemptId,
    testId: s.testId,
    module: s.module,
    mode: s.mode,
    part: s.part,
    current: null,
    answers: {},
    flagged: [],
    notes: '',
    scriptMarks: [],
    revealUsed: false,
    paused: false,
    status: 'in_progress',
    timer: s.totalSec === null ? null : createTimer(s.totalSec),
    startedAt: s.now,
    updatedAt: s.now,
    submittedAt: null,
  };
}

const open = (s: Session) => s.status === 'in_progress';
const changed = (s: Session, now: number, patch: Partial<Session>): Session => ({
  ...s,
  ...patch,
  updatedAt: now,
});

/** An empty or blank answer removes it. */
export function setAnswer(s: Session, n: number, value: string, now: number): Session {
  if (!open(s)) return s;
  const answers = { ...s.answers };
  if (value.trim() === '') delete answers[String(n)];
  else answers[String(n)] = value;
  return changed(s, now, { answers, current: n });
}

export function toggleFlag(s: Session, n: number, now: number): Session {
  if (!open(s)) return s;
  const flagged = s.flagged.includes(n)
    ? s.flagged.filter((f) => f !== n)
    : [...s.flagged, n].sort((a, b) => a - b);
  return changed(s, now, { flagged, current: n });
}

export function setNotes(s: Session, notes: string, now: number): Session {
  return open(s) ? changed(s, now, { notes }) : s;
}

export function goTo(s: Session, n: number, part: number, now: number): Session {
  return changed(s, now, { current: n, part: s.mode === 'single' ? s.part : part });
}

export function goToPart(
  s: Session,
  part: number,
  firstQuestion: number | null,
  now: number,
): Session {
  if (s.mode === 'single' || part === s.part) return s;
  return changed(s, now, { part, current: firstQuestion });
}

export function hasAnswers(s: Session): boolean {
  return Object.keys(s.answers).length > 0;
}

/** Clear removes answers, flags and script marks for the current part. */
export function clearPart(
  s: Session,
  numbers: number[],
  scriptLines: number[],
  now: number,
): Session {
  if (!open(s)) return s;
  const drop = new Set(numbers.map(String));
  const answers = Object.fromEntries(Object.entries(s.answers).filter(([n]) => !drop.has(n)));
  const flagged = s.flagged.filter((n) => !drop.has(String(n)));
  const scriptMarks = s.scriptMarks.filter((line) => !scriptLines.includes(line));
  return changed(s, now, { answers, flagged, scriptMarks });
}

/** Full mock Listening plays straight through, so it can't be paused. */
export function canPause(s: Session): boolean {
  return open(s) && s.timer !== null && !(s.module === 'listening' && s.mode === 'full');
}

export function pause(s: Session, now: number): Session {
  if (!canPause(s) || s.paused) return s;
  return changed(s, now, { paused: true, timer: s.timer && stopTimer(s.timer, now) });
}

export function resume(s: Session, now: number): Session {
  return s.paused ? changed(s, now, { paused: false }) : s;
}

/** The clock runs only while the page is visible, the test is open and not paused. */
export function runClock(s: Session, visible: boolean, now: number): Session {
  if (!s.timer) return s;
  const shouldRun = visible && open(s) && !s.paused;
  const timer = shouldRun ? startTimer(s.timer, now) : stopTimer(s.timer, now);
  return timer === s.timer ? s : { ...s, timer };
}

export function submit(s: Session, now: number): Session {
  if (!open(s)) return s;
  return changed(s, now, {
    status: 'submitted',
    submittedAt: now,
    paused: false,
    timer: s.timer && stopTimer(s.timer, now),
  });
}

/** At 0:00 the attempt submits itself. */
export function tick(s: Session, now: number): Session {
  return open(s) && s.timer && isExpired(s.timer, now) ? submit(s, now) : s;
}

/** Revealing any answer before submitting keeps the attempt out of band history. */
export function markRevealUsed(s: Session, now: number): Session {
  return open(s) && !s.revealUsed ? changed(s, now, { revealUsed: true }) : s;
}

/** The Firestore attempt document (SPEC section 4), with times still in epoch ms. */
export type AttemptRecord = Omit<Attempt, 'startedAt' | 'updatedAt' | 'submittedAt'> & {
  startedAt: number;
  updatedAt: number;
  submittedAt?: number;
};

export function toAttempt(s: Session, now: number): AttemptRecord {
  return {
    attemptId: s.attemptId,
    testId: s.testId,
    module: s.module,
    mode: s.mode,
    part: s.part,
    status: s.status,
    startedAt: s.startedAt,
    updatedAt: s.updatedAt,
    ...(s.submittedAt !== null ? { submittedAt: s.submittedAt } : {}),
    timeLeftSec: s.timer ? timeLeftSec(s.timer, now) : 0,
    answers: s.answers,
    flagged: s.flagged,
    notes: s.notes,
    scriptMarks: s.scriptMarks,
    revealUsed: s.revealUsed,
  };
}

/** Resume from a saved attempt; the clock starts stopped. */
export function fromAttempt(a: AttemptRecord): Session {
  return {
    attemptId: a.attemptId,
    testId: a.testId,
    module: a.module,
    mode: a.mode,
    part: a.part ?? 1,
    current: null,
    answers: a.answers,
    flagged: a.flagged,
    notes: a.notes ?? '',
    scriptMarks: a.scriptMarks ?? [],
    revealUsed: a.revealUsed,
    paused: false,
    status: a.status,
    timer: a.module === 'speaking' ? null : createTimer(a.timeLeftSec),
    startedAt: a.startedAt,
    updatedAt: a.updatedAt,
    submittedAt: a.submittedAt ?? null,
  };
}
