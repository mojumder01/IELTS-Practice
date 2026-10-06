import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
} from 'firebase/auth';
import { createContext, useContext, useSyncExternalStore } from 'react';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

/** The slice of Firebase Auth the app uses; tests swap in a fake. */
export interface AuthAdapter {
  onChange: (listener: (user: AuthUser | null) => void) => () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; refusedEmail: string | null; error: string | null }
  | { status: 'owner'; user: AuthUser };

export interface AuthStore {
  getState: () => AuthState;
  subscribe: (listener: () => void) => () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

/** Only the configured owner gets in; an empty owner UID refuses everyone. */
export function isOwner(user: AuthUser, ownerUid: string): boolean {
  return ownerUid !== '' && user.uid === ownerUid;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return typeof error.code === 'string' ? error.code : undefined;
  }
  return undefined;
}

/** Copy shown under the sign-in button, or null when the user simply backed out. */
export function signInErrorMessage(error: unknown): string | null {
  switch (errorCode(error)) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null;
    case 'auth/network-request-failed':
      return 'Couldn’t reach Google. Check your connection and try again.';
    case 'auth/unauthorized-domain':
      return 'This address isn’t authorised for sign-in. Add it under Firebase → Authentication → Settings → Authorised domains.';
    default:
      return 'Sign-in didn’t work. Please try again.';
  }
}

export function createAuthStore(adapter: AuthAdapter, ownerUid: string): AuthStore {
  let state: AuthState = { status: 'loading' };
  const listeners = new Set<() => void>();

  const set = (next: AuthState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const refusedEmail = () => (state.status === 'signedOut' ? state.refusedEmail : null);

  adapter.onChange((user) => {
    if (!user) {
      set({ status: 'signedOut', refusedEmail: refusedEmail(), error: null });
    } else if (isOwner(user, ownerUid)) {
      set({ status: 'owner', user });
    } else {
      // Any other account is signed straight back out; Firestore rules refuse it too.
      set({ status: 'signedOut', refusedEmail: user.email ?? 'That account', error: null });
      adapter.signOut().catch((error: unknown) => {
        console.error('Could not sign out a refused account', error);
      });
    }
  });

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signIn: async () => {
      if (state.status === 'signedOut')
        set({ status: 'signedOut', refusedEmail: null, error: null });
      try {
        await adapter.signIn();
      } catch (error) {
        const message = signInErrorMessage(error);
        if (message && state.status !== 'owner') {
          set({ status: 'signedOut', refusedEmail: null, error: message });
        }
      }
    },
    signOut: () => adapter.signOut(),
  };
}

export function createFirebaseAuthAdapter(auth: Auth): AuthAdapter {
  const provider = new GoogleAuthProvider();
  // Always show the account chooser, so a refused account isn't picked again silently.
  provider.setCustomParameters({ prompt: 'select_account' });

  return {
    onChange: (listener) =>
      onAuthStateChanged(auth, (user) =>
        listener(user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null),
      ),
    signIn: async () => {
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        if (errorCode(error) !== 'auth/popup-blocked') throw error;
        await signInWithRedirect(auth, provider);
      }
    },
    signOut: () => signOut(auth),
  };
}

export const AuthContext = createContext<AuthStore | null>(null);

export function useAuth() {
  const store = useContext(AuthContext);
  if (!store) throw new Error('useAuth() needs an AuthContext provider');
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return { state, signIn: store.signIn, signOut: store.signOut };
}
