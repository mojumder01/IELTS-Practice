import { vi } from 'vitest';
import type { AttemptRecord } from '../../src/engine/session';
import { memoryRecordings } from '../../src/lib/recordings';
import type { Services } from '../../src/lib/services';
import type { Profile } from '../../src/schema/profile';
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
    ...options.over,
  };
  return { services, world, saveProfile, vocab, saveWord };
}
