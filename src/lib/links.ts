import type { ExamMode } from '../engine/timer';
import type { Module, TestMeta } from '../schema/test';

/** "Book 21 · Test 1". */
export function testName(meta: Pick<TestMeta, 'book' | 'testNumber'>): string {
  return `${meta.book} · Test ${meta.testNumber}`;
}

/** A module page: full mock by default; single part needs its part. Speaking takes only a part. */
export function examHref(
  testId: string,
  module: Module,
  mode: ExamMode = 'full',
  part = 1,
): string {
  if (module === 'speaking') return `/test/${testId}/speaking?part=${part}`;
  return `/test/${testId}/${module}?mode=${mode}${mode === 'single' ? `&part=${part}` : ''}`;
}

/** "6 Oct 2026". */
export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "Cambridge 19" → { series: "CAMBRIDGE IELTS", number: "19" }; "Book 21" → "IELTS" and "21". */
export function coverTitle(book: string): { series: string; number: string } {
  const match = /(\d+)\s*$/.exec(book.trim());
  const name = (match ? book.trim().slice(0, match.index) : book).trim();
  const series = !name || /^book$/i.test(name) ? 'IELTS' : `${name} IELTS`.toUpperCase();
  const initials = book
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
  return { series, number: match ? match[1]! : initials };
}

/** "Cambridge 19" → "cambridge-19", the book's page in the library. */
export function bookSlug(book: string): string {
  return (
    book
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'book'
  );
}

export function bookHref(book: string): string {
  return `/library/${bookSlug(book)}`;
}
