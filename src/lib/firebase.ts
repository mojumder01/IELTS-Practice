import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import type { FirebaseWebConfig } from './env';

let app: FirebaseApp | undefined;

export function initFirebase(config: FirebaseWebConfig): FirebaseApp {
  app ??= initializeApp(config);
  return app;
}

export function firebaseAuth(): Auth {
  if (!app) throw new Error('initFirebase() must run before firebaseAuth()');
  return getAuth(app);
}
