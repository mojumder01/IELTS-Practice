import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayOf,
  isDue,
  masteredByTopic,
  newSrs,
  review,
  reviewQueue,
  reviewWord,
  sentenceAt,
  vocabForm,
  setMastered,
  statusFor,
  vocabStats,
  wordAt,
} from '../../../src/engine/srs';
import type { VocabWord } from '../../../src/schema/vocab';

const TODAY = '2026-10-06';

function word(
  w: string,
  srs: Partial<VocabWord['srs']> = {},
  over: Partial<VocabWord> = {},
): VocabWord {
  const full = { due: TODAY, intervalDays: 1, ease: 2.5, reps: 1, ...srs };
  return {
    word: w,
    pos: 'noun',
    ipa: '',
    topic: 'Environment',
    meaning: 'm',
    bangla: 'ব',
    example: '',
    source: 'manual',
    status: statusFor(full),
    srs: full,
    ...over,
  };
}

describe('calendar days', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 6)).toBe('2027-01-06');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('reads the local day of a time', () => {
    expect(dayOf(new Date(2026, 9, 6, 23, 59).getTime())).toBe('2026-10-06');
  });
});

describe('review queue', () => {
  it('holds due words only, longest overdue first', () => {
    const words = [
      word('later', { due: '2026-10-07' }),
      word('today', { due: TODAY }),
      word('overdue', { due: '2026-10-01' }),
      word('another', { due: TODAY }),
    ];
    expect(reviewQueue(words, TODAY).map((w) => w.word)).toEqual(['overdue', 'another', 'today']);
    expect(isDue(words[0]!, '2026-10-07')).toBe(true);
  });

  it('makes a newly saved word due today', () => {
    expect(newSrs(TODAY)).toEqual({ due: TODAY, intervalDays: 0, ease: 2.5, reps: 0 });
    expect(statusFor(newSrs(TODAY))).toBe('new');
  });
});

describe('Got it and Again', () => {
  it('spaces a remembered word 1, 6, then interval × ease days', () => {
    let srs = newSrs(TODAY);
    srs = review(srs, 'gotIt', TODAY);
    expect(srs).toEqual({ due: '2026-10-07', intervalDays: 1, ease: 2.5, reps: 1 });
    srs = review(srs, 'gotIt', '2026-10-07');
    expect(srs).toEqual({ due: '2026-10-13', intervalDays: 6, ease: 2.5, reps: 2 });
    srs = review(srs, 'gotIt', '2026-10-13');
    expect(srs).toEqual({ due: '2026-10-28', intervalDays: 15, ease: 2.5, reps: 3 });
    srs = review(srs, 'gotIt', '2026-10-28');
    expect(srs.intervalDays).toBe(38);
    expect(statusFor(srs)).toBe('mastered');
  });

  it('brings a forgotten word back tomorrow, a little harder', () => {
    const srs = review({ due: TODAY, intervalDays: 15, ease: 2.5, reps: 3 }, 'again', TODAY);
    expect(srs).toEqual({ due: '2026-10-07', intervalDays: 1, ease: 2.3, reps: 0 });
    expect(review({ ...srs, ease: 1.4 }, 'again', TODAY).ease).toBe(1.3);
    expect(statusFor(srs)).toBe('learning');
  });

  it('updates the word’s status with its schedule', () => {
    const mastered = word('sustainable', { intervalDays: 21, reps: 4 });
    expect(mastered.status).toBe('mastered');
    expect(reviewWord(mastered, 'again', TODAY).status).toBe('learning');
    expect(reviewWord(word('new', newSrs(TODAY)), 'gotIt', TODAY).status).toBe('learning');
    // No longer due once answered.
    expect(reviewQueue([reviewWord(mastered, 'gotIt', TODAY)], TODAY)).toEqual([]);
    expect(reviewQueue([reviewWord(mastered, 'again', TODAY)], TODAY)).toEqual([]);
  });

  it('marks a word mastered by hand, or moves it back to learning', () => {
    const w = word('mitigate');
    const m = setMastered(w, true, TODAY);
    expect(m.status).toBe('mastered');
    expect(m.srs.due).toBe('2026-10-27');
    const back = setMastered(m, false, TODAY);
    expect(back).toMatchObject({ status: 'learning', srs: { due: '2026-10-07', intervalDays: 1 } });
  });
});

describe('vocabulary stats', () => {
  it('counts by status and due, and mastery by topic', () => {
    const words = [
      word('a', { intervalDays: 21, reps: 4, due: '2026-11-01' }),
      word('b', { due: TODAY }, { topic: 'Work' }),
      word('c', newSrs(TODAY)),
    ];
    expect(vocabStats(words, TODAY)).toEqual({
      saved: 3,
      mastered: 1,
      learning: 1,
      new: 1,
      due: 2,
    });
    expect(masteredByTopic(words)).toEqual([
      { topic: 'Environment', mastered: 1, total: 2 },
      { topic: 'Work', mastered: 0, total: 1 },
    ]);
  });
});

describe('saving from a passage', () => {
  const text = 'Steel carries a high embodied carbon cost. Timber, by contrast, stores carbon.';

  it('finds the word at a point', () => {
    expect(wordAt(text, 23)).toEqual({ word: 'embodied', start: 21, end: 29 });
    expect(wordAt(text, 21)?.word).toBe('embodied');
    expect(wordAt(text, 5)?.word).toBe('Steel'); // the caret just after it
    expect(wordAt('one — two', 4)).toBeNull(); // between a space and a dash
    expect(wordAt("the city's well-being.", 13)?.word).toBe('well-being');
    expect(wordAt('in 2025, then', 4)).toBeNull();
  });

  it('saves a capitalised word in lower case, but keeps acronyms', () => {
    expect(vocabForm('Green')).toBe('green');
    expect(vocabForm('UNESCO')).toBe('UNESCO');
    expect(vocabForm('CO2')).toBe('CO2');
    expect(vocabForm('well-being')).toBe('well-being');
  });

  it('takes the sentence around it as the example', () => {
    expect(sentenceAt(text, 23)).toBe('Steel carries a high embodied carbon cost.');
    expect(sentenceAt(text, 60)).toBe('Timber, by contrast, stores carbon.');
  });
});
