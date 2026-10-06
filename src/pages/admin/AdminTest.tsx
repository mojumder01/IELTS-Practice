import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { canPublish, checklist } from '../../admin/draft';
import { Checklist } from '../../components/admin/Checklist';
import { ImportExport } from '../../components/admin/ImportExport';
import { ListeningTab } from '../../components/admin/ListeningTab';
import { ReadingTab } from '../../components/admin/ReadingTab';
import { SettingsTab } from '../../components/admin/SettingsTab';
import { SpeakingTab } from '../../components/admin/SpeakingTab';
import { primaryButton, smallButton } from '../../components/admin/ui';
import { useDraft, type SaveStatus } from '../../components/admin/useDraft';
import { WritingTab } from '../../components/admin/WritingTab';
import { ConfirmDialog } from '../../components/exam/ConfirmDialog';
import { FullPageStatus } from '../../components/FullPageStatus';
import { useServices } from '../../lib/services';
import type { MediaManifest } from '../../schema/media';
import type { TestFile } from '../../schema/test';

const TABS = ['settings', 'listening', 'reading', 'writing', 'speaking'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  settings: 'Settings',
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
};

const SAVE_TEXT: Record<SaveStatus, string> = {
  saved: 'autosaved',
  unsaved: 'saving soon…',
  saving: 'saving…',
  error: 'not saved: check your connection',
};

function tabNote(draft: TestFile, tab: Tab): string {
  const ids = Object.keys(draft.sections);
  if (tab === 'listening') return `${ids.filter((i) => i.startsWith('listening')).length} of 4`;
  if (tab === 'reading') return `${ids.filter((i) => i.startsWith('reading')).length} of 3`;
  if (tab === 'writing') return draft.sections.writing ? 'Added' : 'Empty';
  if (tab === 'speaking') return draft.sections.speaking ? 'Added' : 'Empty';
  return '';
}

/** What the right column shows as this tab's JSON. */
function tabJson(draft: TestFile, tab: Tab): unknown {
  if (tab === 'settings') return draft.meta;
  return Object.fromEntries(Object.entries(draft.sections).filter(([id]) => id.startsWith(tab)));
}

/** "/admin/tests/:testId/:tab" — one test's draft, its checks, preview and publish (SPEC section 8). */
export function AdminTest() {
  const { testId = '', tab = 'settings' } = useParams();
  const services = useServices();
  const navigate = useNavigate();
  const { state, saveStatus, update, replace, save, publish } = useDraft(testId);
  const [manifest, setManifest] = useState<MediaManifest | null>(null);
  const [rev, setRev] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [published, setPublished] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    services.admin
      .manifest()
      .then((m) => !cancelled && setManifest(m))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [services]);

  if (!(TABS as readonly string[]).includes(tab)) {
    return <Navigate to={`/admin/tests/${testId}/settings`} replace />;
  }
  const current = tab as Tab;
  if (state.status === 'loading') return <FullPageStatus label="Loading the draft…" />;
  if (state.status === 'missing') {
    return (
      <main className="px-4 py-8 sm:px-8">
        <p role="alert" className="m-0 text-[15px] text-warn-text">
          There is no test called {testId}.
        </p>
        <Link to="/admin">Back to tests</Link>
      </main>
    );
  }

  const { draft, live } = state;
  const items = checklist(draft, manifest);
  const ready = canPublish(items);
  // Preview needs a draft the student pages can read: every check but the schema has run.
  const schemaOk = items.some((i) => i.id !== 'schema' && i.ok !== null);
  const previewModule = current === 'settings' ? 'reading' : current;
  const previewHref =
    previewModule === 'speaking'
      ? `/test/${testId}/speaking?part=1&preview=draft`
      : `/test/${testId}/${previewModule}?mode=single&part=1&preview=draft`;
  const hasPreviewSection = Object.keys(draft.sections).some((id) => id.startsWith(previewModule));

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-col gap-3 border-b border-border bg-surface px-4 pt-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <nav aria-label="Breadcrumb" className="flex flex-wrap gap-1.5 text-sm text-muted">
              <Link to="/admin">Tests</Link>
              <span aria-hidden="true">/</span>
              <span>{draft.meta.book}</span>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Test {draft.meta.testNumber}</span>
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="m-0 text-2xl font-semibold text-navy">
                {draft.meta.book} · Test {draft.meta.testNumber}
              </h1>
              <span
                role="status"
                className="rounded-pill bg-surface-muted px-3 py-1 text-xs font-semibold text-navy-3"
              >
                {live ? 'Live' : 'Draft'} · {SAVE_TEXT[saveStatus]}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!schemaOk || !hasPreviewSection}
              onClick={() => void save().then(() => navigate(previewHref))}
              className={smallButton}
            >
              Preview as student
            </button>
            <button
              type="button"
              disabled={!ready}
              onClick={() => setConfirming(true)}
              className={primaryButton}
            >
              Publish test
            </button>
          </div>
        </div>
        {published && (
          <p
            role="status"
            className="m-0 rounded-control bg-good px-3 py-2 text-sm font-medium text-good-text"
          >
            {published}
          </p>
        )}
        <div
          role="tablist"
          aria-label="Test sections"
          className="-mb-px flex gap-1 overflow-x-auto"
        >
          {TABS.map((t) => (
            <Link
              key={t}
              role="tab"
              aria-selected={t === current}
              to={`/admin/tests/${testId}/${t}`}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold no-underline ${
                t === current
                  ? 'border-navy text-navy'
                  : 'border-transparent text-muted hover:text-navy'
              }`}
            >
              {TAB_LABEL[t]}
              {tabNote(draft, t) && (
                <span className="text-xs font-normal text-muted">{tabNote(draft, t)}</span>
              )}
            </Link>
          ))}
        </div>
      </div>

      <main className="grid flex-1 grid-cols-1 items-start gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div
          key={`${current}-${rev}`}
          role="tabpanel"
          aria-label={TAB_LABEL[current]}
          className="min-w-0"
        >
          {current === 'settings' && <SettingsTab draft={draft} update={update} />}
          {current === 'reading' && <ReadingTab draft={draft} update={update} />}
          {current === 'listening' && (
            <ListeningTab draft={draft} update={update} manifest={manifest} />
          )}
          {current === 'writing' && (
            <WritingTab draft={draft} update={update} manifest={manifest} />
          )}
          {current === 'speaking' && <SpeakingTab draft={draft} update={update} />}
        </div>
        <aside aria-label="Checks and data" className="flex flex-col gap-4">
          <Checklist items={items} />
          <section
            aria-labelledby="json-h"
            className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
          >
            <h2 id="json-h" className="m-0 text-base font-semibold text-navy">
              {TAB_LABEL[current]} JSON
            </h2>
            <pre
              // A scrolling box must take keyboard focus so its content can be scrolled (WCAG 2.1.1).
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              aria-labelledby="json-h"
              className="m-0 max-h-80 overflow-auto rounded-control bg-canvas p-3 font-mono text-xs leading-relaxed text-navy-3"
            >
              {JSON.stringify(tabJson(draft, current), null, 2)}
            </pre>
          </section>
          <ImportExport
            draft={draft}
            onReplace={(file) => {
              replace(file);
              setRev((r) => r + 1);
            }}
          />
        </aside>
      </main>

      {confirming && (
        <ConfirmDialog
          title={live ? 'Publish the changes?' : 'Publish this test?'}
          message="Students see it in the library straight away. Attempts already taken keep their answers."
          confirmLabel="Publish"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            publish()
              .then(() => setPublished('Published. It’s live in the library.'))
              .catch(() => setPublished('Publishing failed: check your connection and try again.'));
          }}
        />
      )}
    </div>
  );
}
