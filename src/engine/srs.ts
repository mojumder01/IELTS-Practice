import type { Srs, VocabStatus, VocabWord } from '../schema/vocab';

// Spaced review, SM-2 style (SPEC section 10, Phase 8). Dates are calendar days, YYYY-MM-DD, in
// the owner's time zone; a word is due on or after its `due` day.

/** Words reviewed this far apart count as mastered. */
export const MASTERED_DAYS = 21;
export const MIN_EASE = 1.3;
export const START_EASE = 2.5;

/** The local calendar day for a time: 2026-10-06. */
export function dayOf(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A calendar day plus n days (works across months and years, ignores clock changes). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}

/** A word saved today: due today, never reviewed. */
export function newSrs(today: string): Srs {
  return { due: today, intervalDays: 0, ease: START_EASE, reps: 0 };
}

export function isDue(word: Pick<VocabWord, 'srs'>, today: string): boolean {
  return word.srs.due <= today;
}

/** Today's review: due words only, the longest overdue first, then A–Z. */
export function reviewQueue<T extends Pick<VocabWord, 'srs' | 'word'>>(
  words: T[],
  today: string,
): T[] {
  return words
    .filter((w) => isDue(w, today))
    .sort((a, b) => a.srs.due.localeCompare(b.srs.due) || a.word.localeCompare(b.word));
}

export function statusFor(srs: Srs): VocabStatus {
  if (srs.reps === 0 && srs.intervalDays === 0) return 'new';
  return srs.intervalDays >= MASTERED_DAYS ? 'mastered' : 'learning';
}

export type Grade = 'again' | 'gotIt';

/**
 * One answer on a flashcard. "Got it": 1 day, then 6, then the interval times the ease.
 * "Again": back to the start, tomorrow, and the word gets a little harder (ease − 0.2).
 */
export function review(srs: Srs, grade: Grade, today: string): Srs {
  if (grade === 'again') {
    return {
      due: addDays(today, 1),
      intervalDays: 1,
      ease: Math.max(MIN_EASE, round2(srs.ease - 0.2)),
      reps: 0,
    };
  }
  const reps = srs.reps + 1;
  const intervalDays =
    reps === 1
      ? 1
      : reps === 2
        ? 6
        : Math.max(srs.intervalDays + 1, Math.round(srs.intervalDays * srs.ease));
  return { due: addDays(today, intervalDays), intervalDays, ease: srs.ease, reps };
}

/** A word after a flashcard answer: new schedule, status to match. */
export function reviewWord<T extends VocabWord>(word: T, grade: Grade, today: string): T {
  const srs = review(word.srs, grade, today);
  return { ...word, srs, status: statusFor(srs) };
}

/** "Mark as mastered" skips ahead; "Move back to learning" brings the word back tomorrow. */
export function setMastered<T extends VocabWord>(word: T, mastered: boolean, today: string): T {
  const srs: Srs = mastered
    ? {
        due: addDays(today, MASTERED_DAYS),
        intervalDays: MASTERED_DAYS,
        ease: word.srs.ease,
        reps: Math.max(word.srs.reps, 3),
      }
    : { due: addDays(today, 1), intervalDays: 1, ease: word.srs.ease, reps: 1 };
  return { ...word, srs, status: mastered ? 'mastered' : 'learning' };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface VocabStats {
  saved: number;
  mastered: number;
  learning: number;
  new: number;
  due: number;
}

export function vocabStats(words: Pick<VocabWord, 'status' | 'srs'>[], today: string): VocabStats {
  return {
    saved: words.length,
    mastered: words.filter((w) => w.status === 'mastered').length,
    learning: words.filter((w) => w.status === 'learning').length,
    new: words.filter((w) => w.status === 'new').length,
    due: words.filter((w) => isDue(w, today)).length,
  };
}

/** Mastered out of saved, per topic, most mastered first. */
export function masteredByTopic(
  words: Pick<VocabWord, 'status' | 'topic'>[],
): { topic: string; mastered: number; total: number }[] {
  const topics = new Map<string, { mastered: number; total: number }>();
  for (const w of words) {
    const t = topics.get(w.topic) ?? { mastered: 0, total: 0 };
    t.total++;
    if (w.status === 'mastered') t.mastered++;
    topics.set(w.topic, t);
  }
  return [...topics.entries()]
    .map(([topic, t]) => ({ topic, ...t }))
    .sort((a, b) => b.mastered - a.mastered || b.total - a.total || a.topic.localeCompare(b.topic));
}

// ---- Saving a word from a passage ------------------------------------------------------------

const WORD_CHAR = /[\p{L}\p{N}'’-]/u;

/** The word at a character offset: letters, digits, apostrophes and hyphens. Null on a space. */
export function wordAt(
  text: string,
  offset: number,
): { word: string; start: number; end: number } | null {
  let start = Math.min(offset, text.length);
  let end = start;
  while (start > 0 && WORD_CHAR.test(text[start - 1]!)) start--;
  while (end < text.length && WORD_CHAR.test(text[end]!)) end++;
  const word = text.slice(start, end).replace(/^['’-]+|['’-]+$/g, '');
  if (!/\p{L}/u.test(word)) return null;
  const lead = text.slice(start, end).indexOf(word);
  return { word, start: start + lead, end: start + lead + word.length };
}

/** The sentence around a character offset, for the word's example. */
export function sentenceAt(text: string, offset: number): string {
  const before = text.slice(0, offset);
  const startMatch = [...before.matchAll(/[.!?]["”’)]?\s+/g)].at(-1);
  const start = startMatch ? startMatch.index + startMatch[0].length : 0;
  const after = text.slice(offset);
  const endMatch = /[.!?]["”’)]?(\s|$)/.exec(after);
  const end = endMatch ? offset + endMatch.index + endMatch[0].trimEnd().length : text.length;
  return text.slice(start, end).trim();
}

/** How a picked word is saved: "Green" at a sentence start → "green"; "UNESCO", "CO2" stay. */
export function vocabForm(word: string): string {
  return /^\p{Lu}[\p{Ll}'’-]*$/u.test(word) ? word.toLowerCase() : word;
}
