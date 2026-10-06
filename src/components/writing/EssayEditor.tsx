import { essayWordCount, wordNote } from '../../engine/writing';

interface EssayEditorProps {
  task: 1 | 2;
  text: string;
  minWords: number;
  readOnly: boolean;
  onChange: (text: string) => void;
}

/** The answer box with a live word count against the task's minimum. Spellcheck is off, as in the test. */
export function EssayEditor({ task, text, minWords, readOnly, onChange }: EssayEditorProps) {
  const words = essayWordCount(text);
  const pct = Math.min(100, Math.round((words / minWords) * 100));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <label htmlFor="essay" className="text-sm font-semibold text-navy">
        Your answer · Task {task}
      </label>
      <textarea
        id="essay"
        value={text}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        aria-describedby="essay-count"
        className="min-h-[320px] flex-1 resize-y rounded-card border border-border-strong bg-surface px-5 py-4 font-serif text-[17px] leading-[1.7] text-text read-only:bg-surface-muted"
      />
      <div id="essay-count" className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-mono text-sm font-semibold text-navy" aria-live="polite">
            {words} / {minWords} words
          </span>
          <span className={`text-[13px] ${words >= minWords ? 'text-good-text' : 'text-muted'}`}>
            {wordNote(words, minWords)}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Words towards the minimum"
          aria-valuemin={0}
          aria-valuemax={minWords}
          aria-valuenow={Math.min(words, minWords)}
          className="h-1.5 overflow-hidden rounded-pill bg-border"
        >
          <div
            className={`h-full rounded-pill ${words >= minWords ? 'bg-good-text' : 'bg-answered'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
