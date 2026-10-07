import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { blankTest, testIdFor } from '../../admin/draft';
import { BulkUpload } from '../../components/admin/BulkUpload';
import { useAdminTests } from '../../components/admin/useAdminTests';
import { input, label, panel, primaryButton } from '../../components/admin/ui';
import { useServices } from '../../lib/services';
import type { MediaManifest } from '../../schema/media';
import type { Track } from '../../schema/test';

/** "/admin" — every test, a new one, and the media files deployed with the app. */
export function AdminHome() {
  const services = useServices();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const rows = useAdminTests(version);
  const [book, setBook] = useState('');
  const [number, setNumber] = useState('1');
  const [track, setTrack] = useState<Track>('academic');
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<MediaManifest | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    services.admin
      .manifest()
      .then((m) => !cancelled && setManifest(m))
      .catch(() => !cancelled && setManifest(null));
    return () => {
      cancelled = true;
    };
  }, [services]);

  const n = Number.parseInt(number, 10);
  const id = book.trim() && n > 0 ? testIdFor(book.trim(), n) : '';

  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 px-4 py-8 sm:px-8">
      <h1 className="m-0 text-[28px] font-semibold text-navy">Tests</h1>

      <section aria-labelledby="tests-h" className={panel}>
        <h2 id="tests-h" className="m-0 text-lg font-semibold text-navy">
          All tests
        </h2>
        {rows === null ? (
          <p className="m-0 text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="m-0 text-sm text-muted">No tests yet. Start one below.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {rows.map((r) => (
              <li
                key={r.testId}
                className="flex min-h-11 items-center justify-between gap-3 border-t border-border py-1 first:border-0"
              >
                <Link to={`/admin/tests/${r.testId}/settings`}>
                  {r.book} · Test {r.testNumber}
                </Link>
                <span
                  className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${
                    r.live ? 'bg-good text-good-text' : 'bg-surface-muted text-navy-3'
                  }`}
                >
                  {r.live ? 'Live' : 'Draft'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="new-h" className={panel}>
        <h2 id="new-h" className="m-0 text-lg font-semibold text-navy">
          New book or test
        </h2>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!id) return setError('Give the book a name and the test a number.');
            if (rows?.some((r) => r.testId === id)) return setError(`${id} already exists.`);
            const draft = blankTest(book.trim(), n, track);
            services.admin.drafts
              .save(draft)
              .then(() => navigate(`/admin/tests/${id}/settings`))
              .catch(() => setError('The draft couldn’t be saved. Check your connection.'));
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="new-book" className={label}>
              Book or collection
            </label>
            <input
              id="new-book"
              value={book}
              onChange={(e) => setBook(e.target.value)}
              placeholder="Book 22"
              className={input}
            />
          </div>
          <div className="flex w-28 flex-col gap-1">
            <label htmlFor="new-number" className={label}>
              Test number
            </label>
            <input
              id="new-number"
              inputMode="numeric"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className={input}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="new-track" className={label}>
              Track
            </label>
            <select
              id="new-track"
              value={track}
              onChange={(e) => setTrack(e.target.value as Track)}
              className={input}
            >
              <option value="academic">Academic</option>
              <option value="general">General Training</option>
            </select>
          </div>
          <button type="submit" className={primaryButton}>
            Create test
          </button>
          {id && <span className="w-full text-xs text-muted">Test ID: {id}</span>}
          {error && (
            <p role="alert" className="m-0 w-full text-sm text-warn-text">
              {error}
            </p>
          )}
        </form>
      </section>

      <BulkUpload
        manifest={manifest}
        existing={new Set(rows?.map((r) => r.testId))}
        onSaved={() => setVersion((v) => v + 1)}
      />

      <section aria-labelledby="media-h" className={panel}>
        <div className="flex flex-col gap-1">
          <h2 id="media-h" className="m-0 text-lg font-semibold text-navy">
            Media files
          </h2>
          <p className="m-0 text-sm text-muted">
            To add one, put it in public/media/audio or public/media/img, run npm run media, then
            commit and push. After the deploy and npm run seed, it shows here and in the pickers.
          </p>
        </div>
        {manifest === undefined ? (
          <p className="m-0 text-sm text-muted">Loading…</p>
        ) : !manifest ? (
          <p className="m-0 text-sm text-warn-text">
            No media manifest in Firestore yet: run npm run seed.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 font-mono text-[13px]">
            {manifest.files.map((f) => (
              <li key={f.path} className="flex flex-wrap justify-between gap-2">
                <span>{f.path}</span>
                <span className="text-muted">
                  {Math.round(f.bytes / 1024)} KB
                  {f.durationSec !== undefined && ` · ${Math.round(f.durationSec)} s`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
