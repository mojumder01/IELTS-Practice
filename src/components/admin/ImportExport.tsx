import { useState } from 'react';
import { diffTests, type DiffLine } from '../../admin/draft';
import { TestFileSchema, type TestFile } from '../../schema/test';
import { zodIssues } from '../../schema/validate';
import { primaryButton, smallButton } from './ui';

interface ImportExportProps {
  draft: TestFile;
  onReplace: (draft: TestFile) => void;
}

/** Import a test file (checked, then a diff, then replace) and export the draft as JSON. */
export function ImportExport({ draft, onReplace }: ImportExportProps) {
  const [pending, setPending] = useState<{ file: TestFile; diff: DiffLine[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section
      aria-labelledby="io-h"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="io-h" className="m-0 text-base font-semibold text-navy">
        Import / export
      </h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="json-file" className="text-sm font-semibold text-navy">
          Import a test JSON file
        </label>
        <span className="text-xs text-muted">Checked against the schema first.</span>
        <input
          id="json-file"
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setError(null);
            setPending(null);
            void file.text().then((text) => {
              let raw: unknown;
              try {
                raw = JSON.parse(text);
              } catch {
                return setError('That file isn’t JSON.');
              }
              const parsed = TestFileSchema.safeParse(raw);
              if (!parsed.success) {
                const [first] = zodIssues(parsed.error);
                return setError(
                  `That file doesn’t match the test schema (${first?.path}: ${first?.message}).`,
                );
              }
              if (parsed.data.meta.testId !== draft.meta.testId) {
                return setError(
                  `That file is for ${parsed.data.meta.testId}, not ${draft.meta.testId}.`,
                );
              }
              setPending({ file: parsed.data, diff: diffTests(draft, parsed.data) });
            });
          }}
          className="min-h-11 text-sm"
        />
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm text-warn-text">
          {error}
        </p>
      )}
      {pending && (
        <div className="flex flex-col gap-2 rounded-control bg-canvas p-3">
          <p className="m-0 text-sm font-semibold text-navy">
            {pending.diff.length ? 'Importing changes:' : 'The file matches the draft.'}
          </p>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 font-mono text-xs">
            {pending.diff.map((d) => (
              <li key={d.path}>
                {d.change === 'added' ? '+' : d.change === 'removed' ? '−' : '~'} {d.path} (
                {d.change})
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!pending.diff.length}
              onClick={() => {
                onReplace(pending.file);
                setPending(null);
              }}
              className={primaryButton}
            >
              Replace the draft
            </button>
            <button type="button" onClick={() => setPending(null)} className={smallButton}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob([`${JSON.stringify(draft, null, 2)}\n`], { type: 'application/json' }),
          );
          const a = document.createElement('a');
          a.href = url;
          a.download = `${draft.meta.testId}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        className={smallButton}
      >
        Download this test as JSON
      </button>
    </section>
  );
}
