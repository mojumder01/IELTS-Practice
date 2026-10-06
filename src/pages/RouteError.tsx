import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

/** Shown instead of a blank page when something on a page throws. */
export function RouteError() {
  const error = useRouteError();
  console.error(error);
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : null;
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 text-text">
      <div
        role="alert"
        className="flex max-w-[460px] flex-col gap-3 rounded-card border border-border bg-surface p-7"
      >
        <h1 className="m-0 text-xl font-semibold text-navy">Something went wrong</h1>
        <p className="m-0 text-[15px] text-muted">
          This page hit a problem. Your answers are saved on this device, so reloading is safe.
        </p>
        {detail && <p className="m-0 font-mono text-xs text-muted">{detail}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-control bg-navy px-4 text-sm font-semibold text-on-navy"
          >
            Reload
          </button>
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-control border border-border-strong px-4 text-sm font-semibold text-navy no-underline"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
