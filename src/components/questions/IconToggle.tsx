import { Lightbulb, Star } from 'lucide-react';

interface IconToggleProps {
  kind: 'flag' | 'show';
  label: string;
  pressed: boolean;
  onClick: () => void;
}

/** The per-question flag star and answer lightbulb. */
export function IconToggle({ kind, label, pressed, onClick }: IconToggleProps) {
  const Icon = kind === 'flag' ? Star : Lightbulb;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex size-11 shrink-0 items-center justify-center rounded-control border ${
        pressed
          ? 'border-answer-hl-outline bg-answer-hl text-flag-stroke'
          : 'border-border-strong bg-surface text-muted'
      }`}
    >
      <Icon
        aria-hidden="true"
        className={`size-4 ${kind === 'flag' && pressed ? 'fill-flag' : ''}`}
      />
    </button>
  );
}
