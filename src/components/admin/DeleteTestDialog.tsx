import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface DeleteTestDialogProps {
  /** "Book 10 · Test 1". */
  name: string;
  live: boolean;
  deleting: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const WORD = 'DELETE';

/**
 * The warning before a test is deleted. Deleting can't be undone, so the button only works once
 * DELETE is typed. Escape cancels; focus starts on Cancel, the safe choice.
 */
export function DeleteTestDialog({
  name,
  live,
  deleting,
  error,
  onConfirm,
  onCancel,
}: DeleteTestDialogProps) {
  const [typed, setTyped] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const ready = typed.trim().toUpperCase() === WORD && !deleting;

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-navy/50 p-4">
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-warning"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onConfirm();
        }}
        className="flex max-h-full w-full max-w-[460px] flex-col gap-4 overflow-y-auto rounded-card border border-border bg-surface p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warn">
            <TriangleAlert aria-hidden="true" className="size-5 text-warn-text" />
          </span>
          <h2 id="delete-title" className="m-0 pt-1.5 text-lg font-semibold text-navy">
            Delete {name}?
          </h2>
        </div>
        <div
          id="delete-warning"
          className="flex flex-col gap-2 rounded-control border border-warn-text bg-warn p-3 text-sm text-warn-text"
        >
          <p className="m-0 font-semibold">Warning: this can’t be undone.</p>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
            {live && <li>It leaves the library straight away.</li>}
            <li>Its draft and every section are deleted: questions, passages and scripts.</li>
            <li>
              Your past attempts stay in History, but their results and answers can’t be opened any
              more.
            </li>
            <li>Audio and image files stay, so another test can use them.</li>
          </ul>
        </div>
        <p className="m-0 text-sm text-muted">
          To keep a copy, cancel and use Download this test as Excel first.
        </p>
        <div className="flex flex-col gap-1">
          <label htmlFor="delete-confirm" className="text-sm font-semibold text-navy">
            Type {WORD} to confirm
          </label>
          <input
            id="delete-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 font-mono text-sm text-text"
          />
        </div>
        {error && (
          <p role="alert" className="m-0 text-sm text-warn-text">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold text-navy-3"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!ready}
            className="min-h-11 rounded-control border-2 border-warn-text bg-warn px-4 text-sm font-semibold text-warn-text disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete test'}
          </button>
        </div>
      </form>
    </div>
  );
}
