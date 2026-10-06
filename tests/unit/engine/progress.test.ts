import { describe, expect, it } from 'vitest';
import { ACADEMIC_READING, LISTENING } from '../../../src/engine/bands';
import {
  attemptBand,
  bandRows,
  countsTowardBands,
  currentBands,
  explainOverall,
  latestBands,
  moduleState,
  moreForNextBand,
  nextTestFor,
  progressLine,
  routeToTarget,
  scoreText,
  sortTests,
  stepBand,
  targetGapText,
  trendText,
} from '../../../src/engine/progress';
import type { AttemptRecord } from '../../../src/engine/session';
import type { WritingFeedback } from '../../../src/schema/attempt';

let n = 0;
function attempt(over: Partial<AttemptRecord> = {}): AttemptRecord {
  n += 1;
  return {
    attemptId: `a${n}`,
    testId: 'book21-test1',
    module: 'reading',
    mode: 'full',
    part: 1,
    status: 'submitted',
    startedAt: n * 1000,
    updatedAt: n * 1000,
    submittedAt: n * 1000,
    timeLeftSec: 0,
    answers: {},
    flagged: [],
    revealUsed: false,
    ...over,
  };
}
const scored = (module: 'listening' | 'reading', raw: number, band: number, over = {}) =>
  attempt({ module, score: { raw, total: 40, band, byType: {} }, ...over });

const feedback = (task: 1 | 2, overall: number): WritingFeedback => ({
  task,
  criteria: [],
  overall,
  topFixes: [],
  corrections: [],
});

describe('attempt bands', () => {
  it('reads each module’s band the way it was earned', () => {
    expect(attemptBand(scored('reading', 31, 7))).toEqual({
      band: 7,
      estimate: false,
      basis: '31 / 40 correct · auto-scored',
    });
    const writing = attempt({
      module: 'writing',
      writing: { task1: '', task2: 'x', ai: { task1: feedback(1, 6), task2: feedback(2, 7) } },
    });
    expect(attemptBand(writing)).toMatchObject({ band: 6.5, estimate: false }); // (6 + 14) ÷ 3
    const task2Only = attempt({
      module: 'writing',
      writing: { task1: '', task2: 'x', ai: { task2: feedback(2, 6.5) } },
    });
    expect(attemptBand(task2Only)).toEqual({
      band: 6.5,
      estimate: true,
      basis: 'AI estimate · Task 2 only',
    });
    const speaking = attempt({
      module: 'speaking',
      speaking: {
        selfScores: { fluency: 6, lexical: 6.5, grammar: 6, pronunciation: 6 },
        covered: [],
        recordingKeys: ['k1', 'k2'],
      },
    });
    expect(attemptBand(speaking)).toEqual({
      band: 6,
      estimate: false,
      basis: 'Self-assessed · 2 takes',
    });
  });

  it('has no band until submitted and scored', () => {
    expect(attemptBand(attempt({ status: 'in_progress' }))).toBeNull();
    expect(attemptBand(attempt({ module: 'writing' }))).toBeNull();
    expect(
      attemptBand(
        attempt({
          module: 'speaking',
          speaking: { selfScores: { fluency: 6 }, covered: [], recordingKeys: [] },
        }),
      ),
    ).toBeNull();
  });

  it('excludes attempts where answers were revealed', () => {
    expect(countsTowardBands(scored('reading', 31, 7))).toBe(true);
    expect(countsTowardBands(scored('reading', 40, 9, { revealUsed: true }))).toBe(false);
  });

  it('takes the latest counted band per module, ignoring revealed ones', () => {
    const older = scored('listening', 27, 6.5, { submittedAt: 1 });
    const newer = scored('listening', 31, 7, { submittedAt: 5 });
    const revealed = scored('listening', 40, 9, { submittedAt: 9, revealUsed: true });
    const reading = scored('reading', 28, 6.5, { submittedAt: 3 });
    const latest = latestBands([older, revealed, newer, reading]);
    expect(latest.listening?.band.band).toBe(7);
    expect(latest.listening?.previous).toBe(6.5);
    expect(latest.reading?.previous).toBeNull();
    expect(latest.writing).toBeUndefined();
    expect(currentBands(latest)).toBeNull();
  });
});

describe('overall band', () => {
  const bands = { listening: 7, reading: 7, writing: 6.5, speaking: 6 };

  it('shows the sum and how it rounds: 6.625 → 6.5, 6.75 → 7.0', () => {
    expect(explainOverall(bands)).toEqual({
      overall: 6.5,
      mean: 6.625,
      formula: '(7.0 + 7.0 + 6.5 + 6.0) ÷ 4 = 6.625',
      rule: '6.625 rounds down to 6.5',
    });
    expect(explainOverall({ ...bands, speaking: 6.5 })).toMatchObject({
      overall: 7,
      rule: '6.75 rounds up to 7.0',
    });
    expect(
      explainOverall({ ...bands, listening: 6.5, reading: 6.5, writing: 6, speaking: 6 }),
    ).toMatchObject({ overall: 6.5, rule: '6.25 rounds up to 6.5' });
    expect(explainOverall({ listening: 6, reading: 6, writing: 6, speaking: 6.5 })).toMatchObject({
      overall: 6,
      rule: '6.125 rounds down to 6.0',
    });
    expect(explainOverall({ ...bands, writing: 6, speaking: 6 }).rule).toBe(
      '6.5 needs no rounding',
    );
  });

  it('steps the what-if bands by half within 0–9', () => {
    expect(stepBand(6.5, 1)).toBe(7);
    expect(stepBand(9, 1)).toBe(9);
    expect(stepBand(0, -1)).toBe(0);
  });

  it('finds the fewest half-bands to the target', () => {
    expect(routeToTarget(bands, 7)).toEqual({
      reached: false,
      options: [
        [{ module: 'speaking', from: 6, to: 6.5 }],
        [{ module: 'writing', from: 6.5, to: 7 }],
      ],
    });
    expect(routeToTarget(bands, 6.5)).toEqual({ reached: true, options: [] });
    // No single module can reach 8.5 from here: the lowest rise together.
    const together = routeToTarget({ listening: 7, reading: 7, writing: 7, speaking: 7 }, 8.5);
    expect(together.reached).toBe(false);
    expect(together.options).toHaveLength(1);
    expect(together.options[0]!.length).toBeGreaterThan(1);
  });

  it('describes trends and the gap to target', () => {
    expect(trendText(7, 6.5)).toBe('Up 0.5 from last test');
    expect(trendText(6.5, 7)).toBe('Down 0.5 from last test');
    expect(trendText(7, 7)).toBe('Same as last test');
    expect(trendText(7, null)).toBe('First attempt');
    expect(targetGapText(7, 7)).toBe('On target');
    expect(targetGapText(6, 7)).toBe('1.0 to target');
  });
});

describe('distance to the next band', () => {
  it('turns the table into ranges', () => {
    const rows = bandRows(ACADEMIC_READING);
    expect(rows[0]).toEqual({ band: 9, min: 39, max: 40 });
    expect(rows.find((r) => r.band === 7)).toEqual({ band: 7, min: 30, max: 32 });
  });

  it('counts the correct answers to the next band, scaled for one part', () => {
    expect(moreForNextBand(31, 40, 7, ACADEMIC_READING)).toEqual({ more: 2, band: 7.5 });
    expect(moreForNextBand(40, 40, 9, LISTENING)).toBeNull();
    // 4 of 9 scales to 18 (5.0); 5 of 9 scales to 22 (5.5).
    expect(moreForNextBand(4, 9, 5, ACADEMIC_READING)).toEqual({ more: 1, band: 5.5 });
  });
});

describe('summaries', () => {
  it('sums up an attempt in a line', () => {
    expect(
      progressLine(attempt({ answers: { '1': 'TRUE', '2': ' ', '6': 'x' }, flagged: [3] })),
    ).toBe('Passage 1 (full mock) · 2 answered · 1 flagged');
    expect(
      progressLine(
        attempt({
          module: 'writing',
          mode: 'single',
          part: 2,
          writing: { task1: '', task2: 'a b c' },
        }),
      ),
    ).toBe('Task 2 · 0 + 3 words');
    expect(
      progressLine(
        attempt({
          module: 'speaking',
          part: 2,
          speaking: { selfScores: {}, covered: [], recordingKeys: ['k'] },
        }),
      ),
    ).toBe('Part 2 · 1 take');
    expect(scoreText(scored('listening', 31, 7))).toBe('31 / 40');
    expect(scoreText(attempt({ module: 'writing' }))).toBe('No feedback');
  });

  it('orders tests and picks the next one per module', () => {
    const tests = [
      { testId: 'b20-t1', book: 'Book 20', testNumber: 1 },
      { testId: 'b21-t2', book: 'Book 21', testNumber: 2 },
      { testId: 'b21-t1', book: 'Book 21', testNumber: 1 },
    ];
    expect(sortTests(tests).map((t) => t.testId)).toEqual(['b21-t1', 'b21-t2', 'b20-t1']);
    const done = [scored('reading', 30, 7, { testId: 'b21-t1' })];
    expect(nextTestFor('reading', tests, done)?.testId).toBe('b21-t2');
    expect(nextTestFor('listening', tests, done)?.testId).toBe('b21-t1');
    expect(nextTestFor('reading', [], done)).toBeNull();
  });

  it('gives each test’s module a band, Resume or Start', () => {
    const attempts = [
      scored('reading', 30, 7, { testId: 't1' }),
      attempt({ module: 'listening', testId: 't1', status: 'in_progress' }),
      scored('reading', 40, 9, { testId: 't2', revealUsed: true }),
    ];
    expect(moduleState('t1', 'reading', attempts)).toMatchObject({ kind: 'band', band: 7 });
    expect(moduleState('t1', 'listening', attempts)).toEqual({ kind: 'resume' });
    expect(moduleState('t2', 'reading', attempts)).toEqual({ kind: 'start' });
  });
});
