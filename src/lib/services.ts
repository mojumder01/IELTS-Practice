import { createContext, useContext } from 'react';
import type { TestFile } from '../schema/test';
import type { LocalAttempts, RemoteAttempts } from '../store/examStore';
import { firestoreAttempts, getTest } from './db';
import { firestore } from './firebase';
import { localAttempts } from './localAttempts';

/** What pages need from the outside world; tests provide fakes. */
export interface Services {
  loadTest: (testId: string) => Promise<TestFile>;
  attempts: (uid: string) => RemoteAttempts;
  local: LocalAttempts;
  now: () => number;
  newId: () => string;
}

export function firebaseServices(): Services {
  return {
    loadTest: (testId) => getTest(firestore(), testId),
    attempts: (uid) => firestoreAttempts(firestore(), uid),
    local: localAttempts,
    now: () => Date.now(),
    newId: () => crypto.randomUUID(),
  };
}

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices() needs a ServicesContext provider');
  return services;
}
