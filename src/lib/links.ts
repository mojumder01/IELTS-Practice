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
