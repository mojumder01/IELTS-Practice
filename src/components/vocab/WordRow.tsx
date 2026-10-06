import { ChevronDown, ChevronUp, Volume2 } from 'lucide-react';
import type { VocabWord } from '../../schema/vocab';
import { canSpeak, speak } from './speak';
import { STATUS_CHIP } from './topics';

interface WordRowProps {
  word: VocabWord;
  open: boolean;
  onToggle: () => void;
  onToggleMastered: () => void;
  /** "Sustainable Architecture" for a word saved from a test, or null for one added by hand. */
  sourceName: string | null;
}

/** One saved word: meaning and Bangla, opening to the example, source and status (Vocabulary artboard). */
export function WordRow({ word, open, onToggle, onToggleMastered, sourceName }: WordRowProps) {
  const chip = STATUS_CHIP[word.status];
  const mastered = word.status === 'mastered';
  return (
    <li
      className={`flex flex-col gap-3 border-t border-border px-4 py-3 first:border-t-0 ${open ? 'bg-canvas' : ''}`}
    >
      <div className="grid grid-cols-1 items-center gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto]">
        <div className="flex flex-col">
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="text-base font-semibold text-navy">{word.word}</span>
            {word.pos && <span className="text-xs text-muted italic">{word.pos}</span>}
          </span>
          {word.ipa && <span className="font-mono text-xs text-muted">{word.ipa}</span>}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-text">{word.meaning}</span>
          {word.bangla && (
            <span lang="bn" className="font-bangla text-[15px] text-navy-3">
              {word.bangla}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${chip.className}`}>
            {chip.label}
          </span>
          {canSpeak() && (
            <button
              type="button"
              aria-label={`Play pronunciation of ${word.word}`}
              onClick={() => speak(word.word)}
              className="flex size-11 items-center justify-center rounded-control text-navy-3 hover:bg-surface-muted"
            >
              <Volume2 aria-hidden="true" className="size-4" />
            </button>
          )}
          <button
            type="button"
            aria-label={`${open ? 'Hide' : 'Show'} example for ${word.word}`}
            aria-expanded={open}
            onClick={onToggle}
            className="flex size-11 items-center justify-center rounded-control text-navy-3 hover:bg-surface-muted"
          >
            {open ? (
              <ChevronUp aria-hidden="true" className="size-4" />
            ) : (
              <ChevronDown aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
      </div>
      {open && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="m-0 font-serif text-[15px] text-text italic">
              {word.example || 'No example yet.'}
            </p>
            <span className="text-xs text-muted">
              {word.topic} · {sourceName ? `Saved from ${sourceName}` : 'Added by you'}
            </span>
          </div>
          <button
            type="button"
            aria-pressed={mastered}
            onClick={onToggleMastered}
            className="min-h-11 rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold text-navy"
          >
            {mastered ? 'Move back to learning' : 'Mark as mastered'}
          </button>
        </div>
      )}
    </li>
  );
}
