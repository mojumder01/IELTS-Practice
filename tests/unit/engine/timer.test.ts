import { describe, expect, it } from 'vitest';
import sampleJson from '../../../content/tests/book21-test1.json';
import {
  createTimer,
  durationSec,
  formatClock,
  isExpired,
  isWarning,
  startTimer,
  stopTimer,
  timeLeftSec,
} from '../../../src/engine/timer';
import { TestMetaSchema } from '../../../src/schema/test';

const timing = TestMetaSchema.parse(sampleJson.meta).timing;

describe('timer', () => {
  it('only counts down while running', () => {
    let t = createTimer(1200);
    expect(timeLeftSec(t, 50_000)).toBe(1200);
    t = startTimer(t, 0);
    expect(timeLeftSec(t, 90_000)).toBe(1110);
    t = stopTimer(t, 90_000);
    expect(timeLeftSec(t, 999_999)).toBe(1110);
  });

  it('measures from the wall clock, so a slow tick doesn’t drift', () => {
    const t = startTimer(createTimer(60), 1_000);
    expect(timeLeftSec(t, 31_500)).toBe(30); // 29.5 s left shows as 0:30
  });

  it('starting twice keeps the original start', () => {
    const t = startTimer(createTimer(60), 0);
    expect(startTimer(t, 10_000)).toBe(t);
  });

  it('expires at zero and never goes negative', () => {
    const t = startTimer(createTimer(10), 0);
    expect(isExpired(t, 9_999)).toBe(false);
    expect(isExpired(t, 10_000)).toBe(true);
    expect(timeLeftSec(t, 60_000)).toBe(0);
  });

  it('warns at 5:00 or less', () => {
    expect(isWarning(301)).toBe(false);
    expect(isWarning(300)).toBe(true);
  });

  it('formats mm:ss', () => {
    expect(formatClock(3600)).toBe('60:00');
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(0)).toBe('00:00');
  });
});

describe('durationSec (SPEC section 7)', () => {
  it('gives Listening 8 min a part, or 30 + 2 min check in a full mock', () => {
    expect(durationSec(timing, 'listening', 'single', 1)).toBe(8 * 60);
    expect(durationSec(timing, 'listening', 'full', 1)).toBe(32 * 60);
  });

  it('gives Reading 20 min a passage, or 60 min', () => {
    expect(durationSec(timing, 'reading', 'single', 2)).toBe(20 * 60);
    expect(durationSec(timing, 'reading', 'full', 1)).toBe(60 * 60);
  });

  it('gives Writing 20 or 40 min by task, or 60 min', () => {
    expect(durationSec(timing, 'writing', 'single', 1)).toBe(20 * 60);
    expect(durationSec(timing, 'writing', 'single', 2)).toBe(40 * 60);
    expect(durationSec(timing, 'writing', 'full', 1)).toBe(60 * 60);
  });

  it('has no module timer for Speaking', () => {
    expect(durationSec(timing, 'speaking', 'single', 1)).toBeNull();
  });
});
