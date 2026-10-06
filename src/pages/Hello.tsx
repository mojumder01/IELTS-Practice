import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { formatToday } from '../lib/dates';

/** Phase 0 placeholder for the Dashboard: proves the owner can sign in. */
export function Hello() {
  const { state } = useAuth();
  if (state.status !== 'owner') return null;
  const { displayName, email } = state.user;
  const firstName = displayName?.split(' ')[0] ?? email ?? 'there';

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-7 px-4 pt-9 pb-12 sm:px-8">
      <div className="flex flex-col gap-1.5">
        <p className="m-0 text-sm font-medium text-muted">{formatToday(new Date())}</p>
        <h1 className="m-0 text-[30px] leading-tight font-semibold text-navy">
          Hello, {firstName}
        </h1>
      </div>
      <section className="flex items-start gap-4 rounded-card border border-border bg-surface p-7">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-good text-good-text">
          <ShieldCheck aria-hidden="true" className="size-[22px]" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="m-0 text-[17px] font-semibold text-navy">Signed in as the owner</h2>
          <p className="m-0 text-[15px] leading-normal text-muted">
            {email ?? 'This account'} is the only account that can open this app. Any other Google
            account is signed out straight away.
          </p>
        </div>
      </section>
    </main>
  );
}
