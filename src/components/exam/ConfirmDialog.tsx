import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A modal question. Escape cancels; focus starts on Cancel, the safe choice. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-navy/50 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="flex w-full max-w-[420px] flex-col gap-4 rounded-card border border-border bg-surface p-6"
      >
        <h2 id="confirm-title" className="m-0 text-lg font-semibold text-navy">
          {title}
        </h2>
        <p id="confirm-message" className="m-0 text-[15px] leading-normal text-muted">
          {message}
        </p>
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
            type="button"
            onClick={onConfirm}
            className="min-h-11 rounded-control bg-navy px-4 text-sm font-semibold text-on-navy hover:bg-navy-2"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
