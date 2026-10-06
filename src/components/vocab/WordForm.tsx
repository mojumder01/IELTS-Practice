import { useId, useState } from 'react';
import { newSrs } from '../../engine/srs';
import type { VocabWord } from '../../schema/vocab';
import { TOPICS } from './topics';

interface WordFormProps {
  /** Prefilled from a passage: the word, its sentence and where it came from. */
  initial?: Partial<Pick<VocabWord, 'word' | 'example' | 'topic'>> & {
    source?: VocabWord['source'];
  };
  today: string;
  /** True when this word is already saved: saving replaces it. */
  isSaved: (word: string) => boolean;
  onSave: (word: VocabWord) => void;
  onCancel: () => void;
  submitLabel?: string;
}

const input =
  'min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-sm text-text';

/** Add a word by hand, or save one from a passage with its sentence as the example. */
export function WordForm({
  initial,
  today,
  isSaved,
  onSave,
  onCancel,
  submitLabel = 'Save word',
}: WordFormProps) {
  const id = useId();
  const [word, setWord] = useState(initial?.word ?? '');
  const [meaning, setMeaning] = useState('');
  const [bangla, setBangla] = useState('');
  const [pos, setPos] = useState('');
  const [topic, setTopic] = useState(initial?.topic ?? 'General');
  const [example, setExample] = useState(initial?.example ?? '');
  const [error, setError] = useState<string | null>(null);
  const field = (name: string) => `${id}-${name}`;

  return (
    <form
      aria-label="Word details"
      onSubmit={(e) => {
        e.preventDefault();
        if (!word.trim() || !meaning.trim() || !topic.trim()) {
          setError('A word needs its meaning and a topic.');
          return;
        }
        onSave({
          word: word.trim(),
          pos: pos.trim(),
          ipa: '',
          topic: topic.trim(),
          meaning: meaning.trim(),
          bangla: bangla.trim(),
          example: example.trim(),
          source: initial?.source ?? 'manual',
          status: 'new',
          srs: newSrs(today),
        });
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={field('word')} className="text-sm font-semibold text-navy">
            Word
          </label>
          <input
            id={field('word')}
            value={word}
            onChange={(e) => setWord(e.target.value)}
            className={input}
          />
          {word.trim() && isSaved(word) && (
            <span className="text-xs text-warn-text">Already saved: this replaces it.</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={field('pos')} className="text-sm font-semibold text-navy">
            Part of speech <span className="font-normal text-muted">(optional)</span>
          </label>
          <select
            id={field('pos')}
            value={pos}
            onChange={(e) => setPos(e.target.value)}
            className={input}
          >
            {['', 'noun', 'verb', 'adjective', 'adverb', 'phrase'].map((p) => (
              <option key={p} value={p}>
                {p || '—'}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={field('meaning')} className="text-sm font-semibold text-navy">
            Meaning
          </label>
          <input
            id={field('meaning')}
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            className={input}
            // The word is known on a save from a passage, so the meaning is the first thing to type.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={!!initial?.word}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={field('bangla')} className="text-sm font-semibold text-navy">
            Bangla <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id={field('bangla')}
            lang="bn"
            value={bangla}
            onChange={(e) => setBangla(e.target.value)}
            className={`${input} font-bangla`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={field('topic')} className="text-sm font-semibold text-navy">
            Topic
          </label>
          <input
            id={field('topic')}
            list={field('topics')}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className={input}
          />
          <datalist id={field('topics')}>
            {TOPICS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={field('example')} className="text-sm font-semibold text-navy">
            Example sentence <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id={field('example')}
            value={example}
            onChange={(e) => setExample(e.target.value)}
            className={`${input} min-h-16 py-2`}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm text-warn-text">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="min-h-11 rounded-control bg-navy px-5 text-sm font-semibold text-on-navy"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-control border border-border-strong bg-surface px-5 text-sm font-semibold text-navy"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
