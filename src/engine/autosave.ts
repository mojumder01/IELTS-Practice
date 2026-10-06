/** Firestore gets at most one write every 10 s, plus one on part change and on submit. */
export const REMOTE_SAVE_INTERVAL_MS = 10_000;

export type SaveReason = 'change' | 'part' | 'submit';

/** How long to wait before writing to Firestore: 0 means now. */
export function remoteSaveDelay(
  lastRemoteAt: number | null,
  now: number,
  reason: SaveReason,
): number {
  if (reason !== 'change' || lastRemoteAt === null) return 0;
  return Math.max(0, lastRemoteAt + REMOTE_SAVE_INTERVAL_MS - now);
}
