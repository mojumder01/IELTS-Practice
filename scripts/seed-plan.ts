import { encodeSection } from '../src/schema/firestore';
import { vocabIdOf } from '../src/schema/vocab';
import type { LoadedContent } from './content';

export interface SeedWrite {
  path: string;
  data: Record<string, unknown>;
  /** "set" overwrites; "create" leaves an existing document alone. */
  mode: 'set' | 'create';
}

/** The Firestore documents for validated content (SPEC section 4 layout). */
export function planSeed(content: LoadedContent, ownerUid: string | null): { writes: SeedWrite[] } {
  const writes: SeedWrite[] = [];
  for (const { test } of content.tests) {
    if (!test) continue;
    writes.push({ path: `tests/${test.meta.testId}`, data: { ...test.meta }, mode: 'set' });
    for (const [id, section] of Object.entries(test.sections)) {
      if (section) {
        writes.push({
          path: `tests/${test.meta.testId}/sections/${id}`,
          data: encodeSection(section),
          mode: 'set',
        });
      }
    }
  }
  if (content.manifest)
    writes.push({ path: 'media/manifest', data: { ...content.manifest }, mode: 'set' });
  if (ownerUid && content.vocab) {
    for (const word of content.vocab) {
      writes.push({
        path: `users/${ownerUid}/vocab/${vocabIdOf(word.word)}`,
        data: { ...word },
        mode: 'create',
      });
    }
  }
  return { writes };
}
