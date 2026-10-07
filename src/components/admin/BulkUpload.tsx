import { Download, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { checklist } from '../../admin/draft';
import { bookToTest, templateBook, type SheetProblem } from '../../admin/sheets';
import { downloadBook, readBook } from '../../admin/xlsx';
import { useServices } from '../../lib/services';
import type { MediaManifest } from '../../schema/media';
import type { TestFile } from '../../schema/test';
import { label, panel, primaryButton, smallButton } from './ui';

interface BulkUploadProps {
  manifest: MediaManifest | null | undefined;
  /** Test IDs that already have a draft or a live test. */
  existing: Set<string>;
  /** After a draft is saved, so the test list can refresh. */
  onSaved: () => void;
}

type Result =
  | { file: string; status: 'reading' }
  | { file: string; status: 'unreadable' }
  | { file: string; status: 'problems'; problems: SheetProblem[] }
  | {
      file: string;
      status: 'exists' | 'saving' | 'saved' | 'failed';
      draft: TestFile;
      todo: number;
    };

function checksLeft(draft: TestFile, manifest: MediaManifest | null): number {
  return checklist(draft, manifest).filter((i) => i.ok !== true).length;
}

/** Admin home: the Excel template, and uploading filled-in workbooks as drafts. */
export function BulkUpload({ manifest, existing, onSaved }: BulkUploadProps) {
  const services = useServices();
  const [results, setResults] = useState<Result[]>([]);
  const [templateError, setTemplateError] = useState(false);

  const update = (i: number, result: Result) =>
    setResults((rs) => rs.map((r, j) => (j === i ? result : r)));

  const save = async (i: number, draft: TestFile, todo: number) => {
    update(i, { file: results[i]?.file ?? '', status: 'saving', draft, todo });
    try {
      await services.admin.drafts.save(draft);
      update(i, { file: results[i]?.file ?? '', status: 'saved', draft, todo });
      onSaved();
    } catch {
      update(i, { file: results[i]?.file ?? '', status: 'failed', draft, todo });
    }
  };

  const upload = async (files: File[]) => {
    setResults(files.map((f) => ({ file: f.name, status: 'reading' })));
    const seen = new Set<string>();
    let saved = false;
    for (const [i, file] of files.entries()) {
      const set = (r: Result) => update(i, r);
      let grids;
      try {
        grids = await readBook(file);
      } catch {
        set({ file: file.name, status: 'unreadable' });
        continue;
      }
      const m = manifest ?? null;
      let { draft, problems } = bookToTest(grids, m);
      const id = draft?.meta.testId;
      if (draft && id && existing.has(id)) {
        // Re-read with the saved test, so an image stored in the app carries over.
        const before =
          (await services.admin.drafts.get(id).catch(() => null)) ??
          (await services.loadTest(id).catch(() => null));
        ({ draft, problems } = bookToTest(grids, m, before));
      }
      if (draft && id && seen.has(id)) {
        problems = [
          ...problems,
          { sheet: 'Test', row: null, message: `Another file in this upload is also ${id}.` },
        ];
      }
      if (!draft || problems.length) {
        set({ file: file.name, status: 'problems', problems });
        continue;
      }
      seen.add(id!);
      const todo = checksLeft(draft, m);
      if (existing.has(id!)) {
        set({ file: file.name, status: 'exists', draft, todo });
        continue;
      }
      try {
        await services.admin.drafts.save(draft);
        set({ file: file.name, status: 'saved', draft, todo });
        saved = true;
      } catch {
        set({ file: file.name, status: 'failed', draft, todo });
      }
    }
    if (saved) onSaved();
  };

  return (
    <section aria-labelledby="bulk-h" className={panel}>
      <div className="flex flex-col gap-1">
        <h2 id="bulk-h" className="m-0 text-lg font-semibold text-navy">
          Bulk upload
        </h2>
        <p className="m-0 text-sm text-muted">
          Download the Excel template, fill it in (Excel or Google Sheets), then upload it. Each
          file becomes a draft to preview and publish. Its How to fill sheet explains every column.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          onClick={() => {
            setTemplateError(false);
            downloadBook(templateBook(), 'ielts-test-template.xlsx').catch(() =>
              setTemplateError(true),
            );
          }}
          className={smallButton}
        >
          <Download aria-hidden="true" className="size-4" />
          Download the template
        </button>
        <div className="flex flex-col gap-1">
          <label htmlFor="bulk-files" className={label}>
            <Upload aria-hidden="true" className="mr-1.5 inline size-4" />
            Upload filled-in files (.xlsx)
          </label>
          <input
            id="bulk-files"
            type="file"
            multiple
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={manifest === undefined || results.some((r) => r.status === 'reading')}
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              if (files.length) void upload(files);
            }}
            className="min-h-11 text-sm"
          />
        </div>
      </div>
      {templateError && (
        <p role="alert" className="m-0 text-sm text-warn-text">
          The template couldn’t be made. Reload the page and try again.
        </p>
      )}
      {results.length > 0 && (
        <ul aria-label="Uploaded files" className="m-0 flex list-none flex-col gap-2 p-0">
          {results.map((r, i) => (
            <li
              key={`${r.file}-${i}`}
              className="flex flex-col gap-2 rounded-control border border-border bg-canvas p-3"
            >
              <span className="text-sm font-semibold break-all text-navy">{r.file}</span>
              <ResultBody result={r} onReplace={(draft, todo) => void save(i, draft, todo)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResultBody({
  result: r,
  onReplace,
}: {
  result: Result;
  onReplace: (draft: TestFile, todo: number) => void;
}) {
  if (r.status === 'reading') {
    return (
      <p role="status" className="m-0 text-sm text-muted">
        Reading…
      </p>
    );
  }
  if (r.status === 'unreadable') {
    return (
      <p role="alert" className="m-0 text-sm text-warn-text">
        This isn’t an Excel workbook (.xlsx). In Google Sheets use File → Download → Microsoft
        Excel.
      </p>
    );
  }
  if (r.status === 'problems') {
    return (
      <div role="alert" className="flex flex-col gap-1">
        <p className="m-0 text-sm font-semibold text-warn-text">
          Not uploaded: fix {r.problems.length === 1 ? 'this' : `these ${r.problems.length}`} and
          upload the file again.
        </p>
        <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-sm text-warn-text">
          {r.problems.map((p, j) => (
            <li key={j}>
              <span className="font-semibold">
                {p.sheet}
                {p.row !== null && ` row ${p.row}`}:
              </span>{' '}
              {p.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const { draft, todo } = r;
  const name = `${draft.meta.book} · Test ${draft.meta.testNumber}`;
  const open = (
    <Link to={`/admin/tests/${draft.meta.testId}/settings`} className="text-sm font-semibold">
      Open {name}
    </Link>
  );
  const left =
    todo === 0
      ? 'Ready to publish.'
      : `${todo} ${todo === 1 ? 'check' : 'checks'} left on Before publishing.`;
  if (r.status === 'exists') {
    return (
      <div className="flex flex-col gap-2">
        <p className="m-0 text-sm text-navy">
          {name} already exists. Replace its draft with this file? The live test doesn’t change
          until you publish.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => onReplace(draft, todo)} className={primaryButton}>
            Replace the draft
          </button>
          {open}
        </div>
      </div>
    );
  }
  if (r.status === 'failed') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className="m-0 text-sm text-warn-text">
          The draft couldn’t be saved. Check your connection.
        </p>
        <button type="button" onClick={() => onReplace(draft, todo)} className={smallButton}>
          Try again
        </button>
      </div>
    );
  }
  return (
    <div role="status" className="flex flex-col gap-1">
      <p className="m-0 text-sm text-navy">
        {r.status === 'saving' ? 'Saving…' : `Saved as a draft. ${left}`}
      </p>
      {r.status === 'saved' && open}
    </div>
  );
}
