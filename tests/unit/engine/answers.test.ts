import { describe, expect, it } from 'vitest';
import {
  expandOptional,
  isCorrect,
  markPaired,
  normalise,
  parseNumber,
  wordCount,
} from '../../../src/engine/answers';

describe('answer matching (SPEC section 7)', () => {
  it('1. normalises case, spaces, curly quotes and trailing full stops', () => {
    expect(normalise('  The   Building’s Envelope.. ')).toBe("the building's envelope");
    expect(isCorrect(' ENVELOPE. ', ['envelope'])).toBe(true);
  });

  it('2. accepts any listed alternative and optional bracketed words', () => {
    expect(expandOptional('(the) envelope')).toEqual(['the envelope', ' envelope']);
    expect(isCorrect('the envelope', ['(the) envelope'])).toBe(true);
    expect(isCorrect('envelope', ['(the) envelope'])).toBe(true);
    expect(isCorrect('building envelope', ['envelope', 'building envelope'])).toBe(true);
    expect(isCorrect('an envelope', ['(the) envelope'])).toBe(false);
  });

  it('3. accepts digits or words for numeric answers, including dates', () => {
    for (const given of ['14', 'fourteen', '14th', 'fourteenth', 'Fourteenth.']) {
      expect(isCorrect(given, ['14'])).toBe(true);
    }
    expect(isCorrect('38', ['thirty-eight'])).toBe(true);
    expect(isCorrect('thirty eight', ['38'])).toBe(true);
    expect(isCorrect('1,500', ['one thousand five hundred'])).toBe(true);
    expect(isCorrect('15', ['14'])).toBe(false);
    expect(parseNumber('two hundred and five')).toBe(205);
    expect(parseNumber('twentieth')).toBe(20);
    expect(parseNumber('envelope')).toBeNull();
  });

  it('4. marks an answer over the word limit wrong even if it holds the right word', () => {
    expect(isCorrect('the envelope', ['envelope'], 1)).toBe(false);
    expect(isCorrect('envelope', ['envelope'], 1)).toBe(true);
    expect(wordCount('thirty-eight pounds')).toBe(2);
  });

  it('5. needs exact spelling; British and American count only if both are listed', () => {
    expect(isCorrect('envelop', ['envelope'])).toBe(false);
    expect(isCorrect('color', ['colour'])).toBe(false);
    expect(isCorrect('color', ['colour', 'color'])).toBe(true);
  });

  it('6. scores paired letters once each, in any order', () => {
    expect(markPaired(['D', 'B'], [['B'], ['D']])).toEqual([true, true]);
    expect(markPaired(['B', 'B'], [['B'], ['D']])).toEqual([true, false]);
    expect(markPaired(['B', 'A'], [['B'], ['D']])).toEqual([true, false]);
    expect(markPaired(['', 'd'], [['B'], ['D']])).toEqual([false, true]);
  });

  it('7. keeps TRUE/FALSE/NOT GIVEN and YES/NO/NOT GIVEN apart', () => {
    expect(isCorrect('YES', ['TRUE'])).toBe(false);
    expect(isCorrect('NO', ['FALSE'])).toBe(false);
    expect(isCorrect('NOT GIVEN', ['NOT GIVEN'])).toBe(true);
  });

  it('never marks a blank answer correct', () => {
    expect(isCorrect('  ', ['envelope'])).toBe(false);
  });
});
