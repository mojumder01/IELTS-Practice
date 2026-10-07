import { createContext, useContext } from 'react';
import type { WritingFeedback } from '../schema/attempt';
import type { Profile } from '../schema/profile';
import type { MediaManifest } from '../schema/media';
import type { TestFile, TestMeta } from '../schema/test';
import { requestFeedback, type FeedbackRequest, type Generate } from './ai';
import type { LocalAttempts, RemoteAttempts } from '../store/examStore';
import {
  firestoreAttempts,
  firestoreDrafts,
  firestoreVocab,
  getManifest,
  getProfile,
  getTest,
  listAllTests,
  listTests,
  publishTest,
  deleteTest,
  saveProfile,
  type DraftStore,
  type VocabStore,
} from './db';
import { firebaseApp, firestore, useEmulators } from './firebase';
import { localAttempts } from './localAttempts';
import { browserMicrophone, type Microphone } from './microphone';
import { idbRecordings, memoryRecordings, type RecordingStore } from './recordings';

/** What pages need from the outside world; tests provide fakes. */
export interface Services {
  loadTest: (testId: string) => Promise<TestFile>;
  /** Every live test's metadata. */
  listTests: () => Promise<TestMeta[]>;
  profile: (uid: string) => { get: () => Promise<Profile>; save: (p: Profile) => Promise<void> };
  vocab: (uid: string) => VocabStore;
  /** The admin panel: drafts, every test, the media manifest and publishing. */
  admin: {
    drafts: DraftStore;
    listAllTests: () => Promise<TestMeta[]>;
    manifest: () => Promise<MediaManifest | null>;
    publish: (draft: TestFile) => Promise<void>;
    /** Removes the live test and its draft; attempts at it stay. */
    deleteTest: (testId: string) => Promise<void>;
  };
  attempts: (uid: string) => RemoteAttempts;
  local: LocalAttempts;
  now: () => number;
  newId: () => string;
  /** Writing AI feedback; throws FeedbackError with a message to show. */
  writingFeedback: (request: FeedbackRequest) => Promise<WritingFeedback>;
  /** Speaking takes, on this device only. */
  recordings: RecordingStore;
  microphone: Microphone;
}

/** Loaded on first use: the real model in the app, a fake in e2e builds. */
let generator: Promise<Generate> | undefined;
function generate(): Promise<Generate> {
  generator ??= useEmulators
    ? import('./aiFake').then((m) => m.fakeGenerate)
    : import('./aiFirebase').then((m) => m.firebaseGenerate(firebaseApp()));
  return generator;
}

export function firebaseServices(): Services {
  return {
    loadTest: (testId) => getTest(firestore(), testId),
    listTests: () => listTests(firestore()),
    vocab: (uid) => firestoreVocab(firestore(), uid),
    get admin() {
      return {
        drafts: firestoreDrafts(firestore()),
        listAllTests: () => listAllTests(firestore()),
        manifest: () => getManifest(firestore()),
        publish: (draft: TestFile) => publishTest(firestore(), draft),
        deleteTest: (testId: string) => deleteTest(firestore(), testId),
      };
    },
    profile: (uid) => ({
      get: () => getProfile(firestore(), uid),
      save: (p) => saveProfile(firestore(), uid, p),
    }),
    attempts: (uid) => firestoreAttempts(firestore(), uid),
    local: localAttempts,
    now: () => Date.now(),
    newId: () => crypto.randomUUID(),
    writingFeedback: async (request) => requestFeedback(request, await generate()),
    recordings: typeof indexedDB === 'undefined' ? memoryRecordings() : idbRecordings,
    microphone: browserMicrophone,
  };
}

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices() needs a ServicesContext provider');
  return services;
}
