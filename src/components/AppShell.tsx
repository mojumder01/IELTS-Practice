import { LogOut } from 'lucide-react';
import { Link, Outlet } from 'react-router';
import { useAuth } from '../lib/auth';
import { BrandMark } from './BrandMark';

export function AppShell() {
  const { state, signOut } = useAuth();
  const user = state.status === 'owner' ? state.user : null;
  const name = user?.displayName ?? user?.email ?? '';

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-text">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-navy px-4 py-3 text-on-navy sm:px-8">
        <Link to="/" className="flex min-h-11 items-center no-underline hover:no-underline">
          <BrandMark tone="onNavy" />
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-h-11 items-center gap-2 rounded-control border border-navy-3 bg-transparent px-3.5 text-sm font-medium text-on-navy-muted hover:text-on-navy"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Sign out
          </button>
          {name && (
            <span
              title={name}
              className="flex size-[38px] items-center justify-center rounded-full bg-navy-3 text-sm font-semibold text-on-navy"
            >
              <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
              <span className="sr-only">Signed in as {name}</span>
            </span>
          )}
        </div>
      </header>
      <Outlet />
    </div>
  );
}
