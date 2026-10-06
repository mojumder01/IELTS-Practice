import { createContext, useContext } from 'react';
import type { WritingFeedback } from '../schema/attempt';
import type { TestFile } from '../schema/test';
import { requestFeedback, type FeedbackRequest, type Generate } from './ai';
import type { LocalAttempts, RemoteAttempts } from '../store/examStore';
import { firestoreAttempts, getTest } from './db';
import { firebaseApp, firestore, useEmulators } from './firebase';
import { localAttempts } from './localAttempts';

/** What pages need from the outside world; tests provide fakes. */
export interface Services {
  loadTest: (testId: string) => Promise<TestFile>;
  attempts: (uid: string) => RemoteAttempts;
  local: LocalAttempts;
  now: () => number;
  newId: () => string;
  /** Writing AI feedback; throws FeedbackError with a message to show. */
  writingFeedback: (request: FeedbackRequest) => Promise<WritingFeedback>;
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
    attempts: (uid) => firestoreAttempts(firestore(), uid),
    local: localAttempts,
    now: () => Date.now(),
    newId: () => crypto.randomUUID(),
    writingFeedback: async (request) => requestFeedback(request, await generate()),
  };
}

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices() needs a ServicesContext provider');
  return services;
}
