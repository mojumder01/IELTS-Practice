import { LogOut } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../lib/auth';
import { BrandMark } from './BrandMark';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/library', label: 'Test library', end: false },
  { to: '/bands', label: 'Band breakdown', end: false },
  { to: '/history', label: 'History', end: false },
];

export function AppShell() {
  const { state, signOut } = useAuth();
  const user = state.status === 'owner' ? state.user : null;
  const name = user?.displayName ?? user?.email ?? '';

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-text">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-navy px-4 py-3 text-on-navy sm:px-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link to="/" className="flex min-h-11 items-center no-underline hover:no-underline">
            <BrandMark tone="onNavy" />
          </Link>
          <nav aria-label="Main" className="flex flex-wrap gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center rounded-control px-3 text-sm font-medium no-underline sm:px-4 ${
                    isActive
                      ? 'bg-navy-2 text-on-navy hover:text-on-navy'
                      : 'text-on-navy-muted hover:text-on-navy'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
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
