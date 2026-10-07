import { vi } from 'vitest';
import type { AttemptRecord } from '../../src/engine/session';
import { memoryRecordings } from '../../src/lib/recordings';
import type { Services } from '../../src/lib/services';
import type { Profile } from '../../src/schema/profile';
import type { TestFile, TestMeta } from '../../src/schema/test';
import manifestJson from '../../content/media-manifest.json';
import { MediaManifestSchema } from '../../src/schema/media';
import { vocabIdOf, type VocabWord } from '../../src/schema/vocab';
import { examWorld, sample } from './examHarness';

/** Services for page tests: the sample test, attempts held in memory, no microphone. */
export function fakeServices(
  options: {
    attempts?: AttemptRecord[];
    profile?: Profile;
    vocab?: VocabWord[];
    over?: Partial<Services>;
  } = {},
) {
  const vocab = new Map((options.vocab ?? []).map((w) => [vocabIdOf(w.word), w]));
  const saveWord = vi.fn((w: VocabWord) => {
    vocab.set(vocabIdOf(w.word), w);
    return Promise.resolve();
  });
  const world = examWorld();
  for (const a of options.attempts ?? []) world.remoteData.set(a.attemptId, a);
  let profile: Profile = options.profile ?? { targetBand: 7 };
  const saveProfile = vi.fn((p: Profile) => {
    profile = p;
    return Promise.resolve();
  });
  // The admin's Firestore: drafts and published tests, kept as plain objects.
  const drafts = new Map<string, TestFile>();
  const published = new Map<string, TestFile>([[sample.meta.testId, sample]]);
  const publish = vi.fn((draft: TestFile) => {
    published.set(
      draft.meta.testId,
      structuredClone({ ...draft, meta: { ...draft.meta, status: 'live' as const } }),
    );
    return Promise.resolve();
  });
  const saveDraft = vi.fn((draft: TestFile) => {
    drafts.set(draft.meta.testId, structuredClone(draft));
    return Promise.resolve();
  });
  const services: Services = {
    loadTest: () => Promise.resolve(sample),
    listTests: () => Promise.resolve([sample.meta]),
    attempts: () => world.remote,
    profile: () => ({ get: () => Promise.resolve(profile), save: saveProfile }),
    vocab: () => ({ list: () => Promise.resolve([...vocab.values()]), save: saveWord }),
    local: world.local,
    now: () => Date.now(),
    newId: () => 'new-attempt',
    writingFeedback: () => Promise.reject(new Error('No AI in tests')),
    recordings: memoryRecordings(),
    microphone: { canTranscribe: () => false, start: () => Promise.reject(new Error('No mic')) },
    admin: {
      drafts: {
        list: () => Promise.resolve([...drafts.values()].map((d) => d.meta)),
        get: (id) => Promise.resolve(drafts.has(id) ? structuredClone(drafts.get(id)!) : null),
        save: saveDraft,
      },
      listAllTests: () => Promise.resolve([...published.values()].map((t): TestMeta => t.meta)),
      manifest: () => Promise.resolve(MediaManifestSchema.parse(manifestJson)),
      publish,
      deleteTest: (id) => {
        drafts.delete(id);
        published.delete(id);
        return Promise.resolve();
      },
    },
    ...options.over,
  };
  return { services, world, saveProfile, vocab, saveWord, drafts, published, publish, saveDraft };
}
