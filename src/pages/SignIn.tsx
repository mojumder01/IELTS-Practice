import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { BrandMark } from '../components/BrandMark';
import { FullPageStatus } from '../components/FullPageStatus';
import { useAuth } from '../lib/auth';

/** Where to go after sign-in: the guarded page that sent us here, never another site. */
function returnPath(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    const { from } = state;
    if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) return from;
  }
  return '/';
}

export function SignIn() {
  const { state, signIn } = useAuth();
  const location = useLocation();
  const [pending, setPending] = useState(false);

  if (state.status === 'loading') return <FullPageStatus label="Checking sign-in…" />;
  if (state.status === 'owner') return <Navigate to={returnPath(location.state)} replace />;

  const handleSignIn = async () => {
    setPending(true);
    try {
      await signIn();
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-12">
      <div className="flex w-full max-w-[420px] flex-col gap-6 rounded-card border border-border bg-surface p-7">
        <BrandMark />
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-2xl leading-tight font-semibold text-navy">Sign in</h1>
          <p className="m-0 text-[15px] leading-normal text-muted">
            This is a private practice app. Sign in with the owner’s Google account to continue.
          </p>
        </div>

        {state.refusedEmail && (
          <div
            role="alert"
            className="flex flex-col gap-1 rounded-control bg-warn p-4 text-warn-text"
          >
            <p className="m-0 font-semibold">This app is private</p>
            <p className="m-0 text-sm leading-normal">
              {state.refusedEmail} can’t use this app, so it has been signed out. Choose the owner’s
              account instead.
            </p>
          </div>
        )}
        {state.error && (
          <p role="alert" className="m-0 text-sm leading-normal text-warn-text">
            {state.error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSignIn()}
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-navy px-5 py-3 text-[15px] font-semibold text-on-navy hover:bg-navy-2 disabled:cursor-wait disabled:opacity-80"
        >
          <LogIn aria-hidden="true" className="size-[18px]" />
          {pending
            ? 'Waiting for Google…'
            : state.refusedEmail
              ? 'Use another account'
              : 'Sign in with Google'}
        </button>
      </div>
    </main>
  );
}
