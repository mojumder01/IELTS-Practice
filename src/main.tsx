import './styles/fonts';
import './styles/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createAuthStore, createFirebaseAuthAdapter } from './lib/auth';
import { readEnv } from './lib/env';
import { signInWithCustomToken } from 'firebase/auth';
import { firebaseAuth, initFirebase, useEmulators } from './lib/firebase';
import { firebaseServices } from './lib/services';
import { SetupNeeded } from './pages/SetupNeeded';

const container = document.getElementById('root');
if (!container) throw new Error('index.html has no #root element');
const root = createRoot(container);

const config = readEnv(import.meta.env);
if (config.ok) {
  initFirebase(config.env.firebase);
  const authStore = createAuthStore(createFirebaseAuthAdapter(firebaseAuth()), config.env.ownerUid);
  if (useEmulators) {
    // e2e only: Playwright signs in with an emulator token. Never compiled into a real build.
    (window as unknown as { e2eSignIn: (token: string) => Promise<unknown> }).e2eSignIn = (token) =>
      signInWithCustomToken(firebaseAuth(), token);
  }
  root.render(
    <StrictMode>
      <App authStore={authStore} services={firebaseServices()} />
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <SetupNeeded missing={config.missing} />
    </StrictMode>,
  );
}
