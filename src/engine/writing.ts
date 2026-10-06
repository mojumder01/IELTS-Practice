/** Words in an essay: whitespace-separated, so "well-known" and "2025" each count once. */
export function essayWordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** AI feedback needs something to read (Writing artboard: "Write at least 50 words"). */
export const MIN_WORDS_FOR_FEEDBACK = 50;

/** "38 more to reach the minimum" / "Minimum reached". */
export function wordNote(words: number, minimum: number): string {
  const left = minimum - words;
  return left > 0 ? `${left} more to reach the minimum` : 'Minimum reached';
}

/** Where a feedback request is; the feedback itself lives on the session. */
export type FeedbackStatus =
  { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string };
