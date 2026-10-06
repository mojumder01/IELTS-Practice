import { useState } from 'react';
import type { Profile } from '../../schema/profile';

interface GoalsEditorProps {
  profile: Profile;
  onSave: (profile: Profile) => Promise<void>;
  onClose: () => void;
}

const TARGETS = [9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4];

/** Target band and exam date, saved to the profile. */
export function GoalsEditor({ profile, onSave, onClose }: GoalsEditorProps) {
  const [target, setTarget] = useState(profile.targetBand);
  const [date, setDate] = useState(profile.examDate ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <form
      aria-label="Your goals"
      onSubmit={(e) => {
        e.preventDefault();
        setSaving(true);
        onSave({ targetBand: target, ...(date ? { examDate: date } : {}) })
          .then(onClose)
          .catch(() => {
            setError('Your goals couldn’t be saved. Try again.');
            setSaving(false);
          });
      }}
      className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="goal-target" className="text-sm font-semibold text-navy">
          Target band
        </label>
        <select
          id="goal-target"
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="min-h-11 rounded-control border border-border-strong bg-surface px-3 font-mono text-sm"
        >
          {TARGETS.map((t) => (
            <option key={t} value={t}>
              {t.toFixed(1)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="goal-date" className="text-sm font-semibold text-navy">
          Exam date
        </label>
        <input
          id="goal-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="min-h-11 rounded-control border border-border-strong bg-surface px-3 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-control bg-navy px-4 text-sm font-semibold text-on-navy disabled:opacity-60"
        >
          Save goals
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold text-navy"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="m-0 w-full text-sm text-warn-text">
          {error}
        </p>
      )}
    </form>
  );
}
