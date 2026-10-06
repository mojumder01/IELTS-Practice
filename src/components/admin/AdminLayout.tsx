import { ArrowLeft } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { BrandMark } from '../BrandMark';
import { useAdminTests } from './useAdminTests';

const navLink = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center rounded-control px-3 text-sm font-medium no-underline ${
    isActive ? 'bg-navy-2 text-on-navy hover:text-on-navy' : 'text-on-navy-muted hover:text-on-navy'
  }`;

/** The admin frame: a sidebar with the test tree, and the page (Admin artboards). */
export function AdminLayout() {
  // Reloaded on each page change, so a new or published test shows up.
  const { pathname } = useLocation();
  const rows = useAdminTests(pathname);
  const books = rows ? [...new Set(rows.map((r) => r.book))] : [];
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-text lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-5 bg-navy p-4 text-on-navy lg:w-[248px]">
        <div className="flex items-center justify-between gap-2">
          <BrandMark tone="onNavy" />
          <span className="rounded-pill bg-navy-2 px-2.5 py-1 text-xs font-semibold">Admin</span>
        </div>
        <nav aria-label="Admin" className="flex flex-wrap gap-1 lg:flex-col">
          <NavLink to="/admin" end className={navLink}>
            Tests
          </NavLink>
          <NavLink to="/vocabulary" className={navLink}>
            Vocabulary
          </NavLink>
        </nav>
        <nav aria-label="Tests by book" className="flex flex-col gap-1">
          {books.map((book) => (
            <div key={book} className="flex flex-col gap-1">
              <span className="px-3 pt-2 text-xs font-semibold tracking-[0.06em] text-unanswered uppercase">
                {book}
              </span>
              {rows!
                .filter((r) => r.book === book)
                .map((r) => (
                  <NavLink
                    key={r.testId}
                    to={`/admin/tests/${r.testId}/settings`}
                    className={navLink}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      Test {r.testNumber}
                      <span className="text-xs text-on-navy-muted">
                        {r.live ? 'Live' : 'Draft'}
                      </span>
                    </span>
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <Link
          to="/"
          className="mt-auto inline-flex min-h-11 items-center gap-2 px-3 text-sm text-on-navy-muted no-underline hover:text-on-navy"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to the app
        </Link>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
