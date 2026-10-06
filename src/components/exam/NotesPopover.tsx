export function NotesPopover({
  notes,
  onChange,
}: {
  notes: string;
  onChange: (notes: string) => void;
}) {
  return (
    <div className="absolute top-2 right-4 flex w-[min(320px,calc(100%-2rem))] flex-col gap-2 rounded-card border border-border bg-surface p-4 shadow-xl sm:right-5">
      <label htmlFor="exam-notes" className="text-sm font-semibold text-navy">
        Notes
      </label>
      <textarea
        id="exam-notes"
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Jot down keywords or paragraph letters"
        className="min-h-[140px] w-full resize-y rounded-control border border-border-strong px-3 py-2.5 text-sm leading-normal text-text"
      />
      <span className="text-xs text-muted">Saved with this attempt. Not marked.</span>
    </div>
  );
}
