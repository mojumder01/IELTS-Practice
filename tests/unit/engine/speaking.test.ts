import { describe, expect, it } from 'vitest';
import sampleJson from '../../../content/tests/book21-test1.json';
import { AttemptSchema } from '../../../src/schema/attempt';
import { TestFileSchema, type SpeakingSection } from '../../../src/schema/test';
import {
  addRecording,
  createSession,
  fromAttempt,
  setSelfScore,
  submit,
  toAttempt,
  toggleCovered,
} from '../../../src/engine/session';
import {
  coveragePoints,
  fillerCount,
  formatSpeakingTime,
  paceWpm,
  recorderClock,
  recordingKey,
  recordingLimits,
  reviewNote,
  selfScoreBand,
  spokenWords,
  transcriptPieces,
} from '../../../src/engine/speaking';

const sample = TestFileSchema.parse(sampleJson);
const section = sample.sections.speaking as SpeakingSection;

describe('Speaking transcript', () => {
  it('marks filler words and phrases, whole words only', () => {
    const text = 'It is, um, near. You know, I like it. Uh, I mean the umbrella stand.';
    expect(
      transcriptPieces(text)
        .filter((p) => p.filler)
        .map((p) => p.text),
    ).toEqual(['um', 'You know', 'like', 'Uh', 'I mean']);
    expect(fillerCount(text)).toBe(5);
    expect(
      transcriptPieces(text)
        .map((p) => p.text)
        .join(''),
    ).toBe(text);
    expect(fillerCount('An umbrella, unlike yours.')).toBe(0);
  });

  it('counts words and pace in words per minute', () => {
    expect(spokenWords('  one two\nthree ')).toBe(3);
    expect(spokenWords('')).toBe(0);
    expect(paceWpm(186, 90)).toBe(124);
    expect(paceWpm(3, 2)).toBeNull(); // too short to judge
  });
});

describe('Speaking Part 2 checklist', () => {
  it('turns the cue card into points, closing line included', () => {
    expect(coveragePoints(section.part2)).toEqual([
      { id: 'point-1', label: 'Where it is' },
      { id: 'point-2', label: 'How often you go there' },
      { id: 'point-3', label: 'What people do there' },
      { id: 'point-4', label: 'Why you enjoy visiting it' },
    ]);
  });

  it('writes the coaching line from the take', () => {
    const [, , , why] = coveragePoints(section.part2);
    expect(reviewNote({ number: 1, durationSec: 91 }, 120, [why!])).toBe(
      'Take 1 stopped at 1:31 and skipped why you enjoy visiting it. Use the full two minutes.',
    );
    expect(reviewNote({ number: 2, durationSec: 60 }, 120, [])).toBe(
      'Take 2 stopped at 1:00. Use the full two minutes.',
    );
    expect(reviewNote({ number: 3, durationSec: 118 }, 120, [why!])).toBe(
      'Take 3 skipped why you enjoy visiting it.',
    );
    expect(reviewNote({ number: 4, durationSec: 120 }, 120, [])).toBe(
      'Take 4 used the time and covered every point.',
    );
  });
});

describe('Speaking recorder clock', () => {
  const limits = { prepSec: 60, maxSec: 120 };

  it('counts preparation down, then says to start', () => {
    const prepare = { kind: 'prepare' as const, since: 0 };
    expect(recorderClock(prepare, 18_000, limits)).toEqual({
      prepLeftSec: 42,
      elapsedSec: null,
      due: null,
    });
    expect(recorderClock(prepare, 60_000, limits).due).toBe('start');
  });

  it('counts speaking up and stops at the maximum', () => {
    const record = { kind: 'record' as const, since: 1_000 };
    expect(recorderClock(record, 85_000, limits)).toEqual({
      prepLeftSec: null,
      elapsedSec: 84,
      due: null,
    });
    expect(recorderClock(record, 125_000, limits)).toMatchObject({ elapsedSec: 120, due: 'stop' });
  });

  it('gives Part 2 the cue card’s limits and Parts 1 and 3 five minutes, no preparation', () => {
    expect(recordingLimits(2, section)).toEqual({ prepSec: 60, maxSec: 120 });
    expect(recordingLimits(1, section)).toEqual({ prepSec: 0, maxSec: 300 });
  });

  it('formats times and keys', () => {
    expect(formatSpeakingTime(91)).toBe('1:31');
    expect(formatSpeakingTime(5)).toBe('0:05');
    expect(recordingKey('a1', 2, 3)).toBe('a1:p2:t3');
  });
});

describe('Speaking self-assessment', () => {
  it('bands the four criteria, rounding down to the half, once all are scored', () => {
    expect(selfScoreBand({ fluency: 7, lexical: 6, grammar: 6 })).toBeNull();
    expect(selfScoreBand({ fluency: 7, lexical: 6, grammar: 6, pronunciation: 7 })).toBe(6.5);
    expect(selfScoreBand({ fluency: 7, lexical: 6, grammar: 6, pronunciation: 6 })).toBe(6);
  });

  it('keeps scores, ticks and takes with the attempt, and freezes them on submit', () => {
    let s = createSession({
      attemptId: 'a1',
      testId: 'book21-test1',
      module: 'speaking',
      mode: 'full',
      part: 2,
      totalSec: null,
      now: 0,
    });
    s = setSelfScore(s, 'fluency', 7, 1);
    s = setSelfScore(s, 'lexical', 6, 2);
    s = setSelfScore(s, 'lexical', null, 3);
    s = toggleCovered(s, 'point-1', 4);
    s = toggleCovered(s, 'point-4', 5);
    s = toggleCovered(s, 'point-1', 6);
    s = addRecording(s, 'a1:p2:t1', 7);
    s = addRecording(s, 'a1:p2:t1', 8);
    expect(s.speaking).toEqual({
      selfScores: { fluency: 7 },
      covered: ['point-4'],
      recordingKeys: ['a1:p2:t1'],
    });

    const attempt = toAttempt(s, 9);
    expect(attempt.speaking).toEqual(s.speaking);
    expect(attempt.writing).toBeUndefined();
    expect(fromAttempt(attempt).speaking).toEqual(s.speaking);
    expect(fromAttempt(attempt).timer).toBeNull();
    // A part-scored attempt is valid in Firestore (with timestamps in place of epoch ms).
    const ts = { seconds: 0, nanoseconds: 0 };
    expect(() => AttemptSchema.parse({ ...attempt, startedAt: ts, updatedAt: ts })).not.toThrow();

    const done = submit(s, 10);
    expect(setSelfScore(done, 'grammar', 6, 11)).toBe(done);
    expect(toggleCovered(done, 'point-2', 11)).toBe(done);
    expect(addRecording(done, 'a1:p2:t2', 11)).toBe(done);
  });
});
