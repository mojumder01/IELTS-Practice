import { describe, expect, it } from 'vitest';
import { highlightRanges } from '../../../src/engine/passage';
import { partsOf } from '../../../src/engine/parts';
import { markParts, scoreResults } from '../../../src/engine/scoring';
import { sample } from '../examHarness';

const reading = partsOf(sample, 'reading');

describe('scoring the sample Reading passage', () => {
  it('marks each question and counts by type', () => {
    const answers = {
      '1': 'TRUE',
      '2': 'TRUE',
      '6': 'Envelope',
      '7': 'winter warmth',
      '9': 'certificate',
    };
    const results = markParts(sample, 'reading', reading, answers);
    expect(results.map((r) => `${r.number}:${r.status}`)).toEqual([
      '1:correct',
      '2:incorrect',
      '3:skipped',
      '4:skipped',
      '5:skipped',
      '6:correct',
      '7:incorrect',
      '8:skipped',
      '9:correct',
    ]);
    const score = scoreResults(results, 'reading', 'academic');
    expect(score).toMatchObject({ raw: 3, total: 9, estimate: true });
    expect(score.byType).toEqual({
      TRUE_FALSE_NOT_GIVEN: { correct: 1, total: 5 },
      GAP_FILL: { correct: 2, total: 4 },
    });
    expect(score.band).toBe(4.5); // 3 × 40 / 9 = 13
  });

  it('gives the answer to show for each question', () => {
    const results = markParts(sample, 'reading', reading, {});
    expect(results.find((r) => r.number === 6)?.expected).toBe('envelope');
    expect(results.find((r) => r.number === 3)?.expected).toBe('NOT GIVEN');
  });

  it('accepts digits or words in Listening', () => {
    const results = markParts(sample, 'listening', partsOf(sample, 'listening'), {
      '4': 'fourteenth',
      '5': 'thirty-eight',
    });
    expect(results.filter((r) => r.correct).map((r) => r.number)).toEqual([4, 5]);
  });
});

describe('passage highlights', () => {
  const paragraph = 'One sentence here. The building envelope matters! A third one.';

  it('finds the words inside the right sentence', () => {
    const [range] = highlightRanges(paragraph, [
      { sentence: 2, text: 'building envelope', question: 6 },
    ]);
    expect(paragraph.slice(range!.start, range!.end)).toBe('building envelope');
    expect(range!.wholeSentence).toBe(false);
  });

  it('marks the whole sentence when the words are missing', () => {
    const [range] = highlightRanges(paragraph, [{ sentence: 3, text: 'missing', question: 2 }]);
    expect(paragraph.slice(range!.start, range!.end)).toBe('A third one.');
    expect(range!.wholeSentence).toBe(true);
  });
});
