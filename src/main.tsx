import './styles/fonts';
import './styles/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createAuthStore, createFirebaseAuthAdapter } from './lib/auth';
import { readEnv } from './lib/env';
import { firebaseAuth, initFirebase } from './lib/firebase';
import { SetupNeeded } from './pages/SetupNeeded';

const container = document.getElementById('root');
if (!container) throw new Error('index.html has no #root element');
const root = createRoot(container);

const config = readEnv(import.meta.env);
if (config.ok) {
  initFirebase(config.env.firebase);
  const authStore = createAuthStore(createFirebaseAuthAdapter(firebaseAuth()), config.env.ownerUid);
  root.render(
    <StrictMode>
      <App authStore={authStore} />
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <SetupNeeded missing={config.missing} />
    </StrictMode>,
  );
}
