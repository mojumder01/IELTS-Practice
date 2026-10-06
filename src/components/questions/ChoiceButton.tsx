interface ChoiceButtonProps {
  label: string;
  /** Option text for multiple choice; omitted for TRUE / FALSE / NOT GIVEN. */
  text?: string;
  ariaLabel: string;
  pressed: boolean;
  onClick: () => void;
}

/** A selectable answer. Selected is filled and marked pressed, so it never relies on colour alone. */
export function ChoiceButton({ label, text, ariaLabel, pressed, onClick }: ChoiceButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={pressed}
      onClick={onClick}
      className={`min-h-11 rounded-control border-[1.5px] px-4 text-sm font-semibold ${
        text ? 'flex w-full items-center gap-3 py-2 text-left' : ''
      } ${pressed ? 'border-answered bg-answered text-on-navy' : 'border-border-strong bg-surface text-text'}`}
    >
      {text ? (
        <>
          <span className="font-mono">{label}</span>
          <span className="font-normal">{text}</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}
