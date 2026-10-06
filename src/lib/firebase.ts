import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import type { FirebaseWebConfig } from './env';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

/** e2e builds talk to the local Firebase emulators instead of the real project. */
export const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

export function initFirebase(config: FirebaseWebConfig): FirebaseApp {
  app ??= initializeApp(config);
  return app;
}

function requireApp(): FirebaseApp {
  if (!app) throw new Error('initFirebase() must run first');
  return app;
}

export function firebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(requireApp());
    if (useEmulators) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  return auth;
}

/** Firestore with its offline cache, shared across tabs. */
export function firestore(): Firestore {
  if (!db) {
    db = initializeFirestore(requireApp(), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    if (useEmulators) connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  return db;
}
