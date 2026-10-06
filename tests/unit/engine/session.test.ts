import { describe, expect, it } from 'vitest';
import { remoteSaveDelay } from '../../../src/engine/autosave';
import * as s from '../../../src/engine/session';
import { timeLeftSec } from '../../../src/engine/timer';

const base = (overrides: Partial<s.NewSession> = {}) =>
  s.createSession({
    attemptId: 'a1',
    testId: 'book21-test1',
    module: 'reading',
    mode: 'single',
    part: 1,
    totalSec: 1200,
    now: 0,
    ...overrides,
  });

describe('session', () => {
  it('keeps answers under string keys and drops blank ones', () => {
    let session = s.setAnswer(base(), 21, 'B', 5);
    expect(session.answers).toEqual({ '21': 'B' });
    expect(session.current).toBe(21);
    expect(session.updatedAt).toBe(5);
    session = s.setAnswer(session, 21, '  ', 6);
    expect(session.answers).toEqual({});
  });

  it('toggles flags in order', () => {
    let session = s.toggleFlag(base(), 7, 1);
    session = s.toggleFlag(session, 3, 2);
    expect(session.flagged).toEqual([3, 7]);
    expect(s.toggleFlag(session, 7, 3).flagged).toEqual([3]);
  });

  it('clears answers, flags and script marks for one part only', () => {
    let session = { ...base({ module: 'listening' }), scriptMarks: [2, 5] };
    session = s.setAnswer(session, 1, 'Morgan', 1);
    session = s.setAnswer(session, 12, 'x', 2);
    session = s.toggleFlag(session, 3, 3);
    session = s.clearPart(session, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [2, 5], 4);
    expect(session.answers).toEqual({ '12': 'x' });
    expect(session.flagged).toEqual([]);
    expect(session.scriptMarks).toEqual([]);
  });

  it('runs the clock only while visible, open and not paused', () => {
    let session = s.runClock(base(), true, 0);
    expect(session.timer?.runningSince).toBe(0);
    session = s.pause(session, 60_000);
    expect(session.paused).toBe(true);
    expect(s.runClock(session, true, 70_000).timer?.runningSince).toBeNull();
    session = s.runClock(s.resume(session, 80_000), true, 80_000);
    expect(timeLeftSec(session.timer!, 90_000)).toBe(1200 - 60 - 10);
    session = s.runClock(session, false, 100_000);
    expect(timeLeftSec(session.timer!, 999_999)).toBe(1200 - 60 - 20);
  });

  it('doesn’t pause a full mock Listening', () => {
    const session = s.runClock(base({ module: 'listening', mode: 'full' }), true, 0);
    expect(s.canPause(session)).toBe(false);
    expect(s.pause(session, 1000)).toBe(session);
  });

  it('auto-submits at 0:00', () => {
    const session = s.runClock(base({ totalSec: 10 }), true, 0);
    expect(s.tick(session, 9_000).status).toBe('in_progress');
    const done = s.tick(session, 10_000);
    expect(done.status).toBe('submitted');
    expect(done.submittedAt).toBe(10_000);
  });

  it('ignores changes after submitting', () => {
    const done = s.submit(base(), 1);
    expect(s.setAnswer(done, 1, 'TRUE', 2)).toBe(done);
    expect(s.markRevealUsed(done, 2)).toBe(done);
  });

  it('marks revealUsed once', () => {
    const shown = s.markRevealUsed(base(), 1);
    expect(shown.revealUsed).toBe(true);
    expect(s.markRevealUsed(shown, 2)).toBe(shown);
  });

  it('stays on its part in single-part mode, moves between parts in a full mock', () => {
    expect(s.goTo(base(), 20, 2, 1).part).toBe(1);
    expect(s.goTo(base({ mode: 'full' }), 20, 2, 1).part).toBe(2);
    expect(s.goToPart(base({ mode: 'full' }), 3, 27, 1)).toMatchObject({ part: 3, current: 27 });
  });

  it('round-trips through the attempt document with the time left', () => {
    let session = s.runClock(base(), true, 0);
    session = s.setAnswer(session, 1, 'TRUE', 30_000);
    const record = s.toAttempt(session, 60_000);
    expect(record.timeLeftSec).toBe(1140);
    const back = s.fromAttempt(record);
    expect(back.answers).toEqual({ '1': 'TRUE' });
    expect(timeLeftSec(back.timer!, 10 ** 9)).toBe(1140);
  });
});

describe('remoteSaveDelay', () => {
  it('writes the first change at once, then at most every 10 s', () => {
    expect(remoteSaveDelay(null, 0, 'change')).toBe(0);
    expect(remoteSaveDelay(1_000, 4_000, 'change')).toBe(7_000);
    expect(remoteSaveDelay(1_000, 12_000, 'change')).toBe(0);
  });

  it('writes at once on part change and submit', () => {
    expect(remoteSaveDelay(1_000, 2_000, 'part')).toBe(0);
    expect(remoteSaveDelay(1_000, 2_000, 'submit')).toBe(0);
  });
});
