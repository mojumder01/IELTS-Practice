import { LogOut } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../lib/auth';
import { BrandMark } from './BrandMark';
import { OfflineBanner } from './OfflineBanner';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/library', label: 'Test library', end: false },
  { to: '/vocabulary', label: 'Vocabulary', end: false },
  { to: '/bands', label: 'Band breakdown', end: false },
  { to: '/history', label: 'History', end: false },
];

export function AppShell() {
  const { state, signOut } = useAuth();
  const user = state.status === 'owner' ? state.user : null;
  const name = user?.displayName ?? user?.email ?? '';

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-text">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 bg-chrome px-4 py-2 text-on-chrome sm:px-8 sm:py-3">
        <Link to="/" className="flex min-h-11 items-center no-underline hover:no-underline">
          <BrandMark tone="onNavy" />
        </Link>
        {/* On a phone the nav takes its own row and scrolls sideways instead of wrapping. */}
        <nav
          aria-label="Main"
          className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 lg:order-none lg:mx-0 lg:w-auto lg:flex-1 lg:px-0"
        >
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `inline-flex min-h-11 shrink-0 items-center rounded-control px-3 text-sm font-medium whitespace-nowrap no-underline sm:px-4 ${
                  isActive
                    ? 'bg-chrome-2 text-on-chrome hover:text-on-chrome'
                    : 'text-on-chrome-muted hover:text-on-chrome'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/admin"
            className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-on-chrome-muted no-underline hover:text-on-chrome"
          >
            Admin
          </Link>
          <ThemeToggle className="flex size-11 items-center justify-center rounded-control border border-chrome-3 text-on-chrome-muted hover:text-on-chrome" />
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-control border border-chrome-3 bg-transparent px-3 text-sm font-medium text-on-chrome-muted hover:text-on-chrome"
          >
            <LogOut aria-hidden="true" className="size-4" />
            <span className="sr-only sm:not-sr-only">Sign out</span>
          </button>
          {name && (
            <span
              title={name}
              className="hidden size-[38px] items-center justify-center rounded-full bg-chrome-3 text-sm font-semibold text-on-chrome sm:flex"
            >
              <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
              <span className="sr-only">Signed in as {name}</span>
            </span>
          )}
        </div>
      </header>
      <OfflineBanner />
      <Outlet />
    </div>
  );
}
