import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { dayOf } from '../../engine/srs';
import { useAuth } from '../../lib/auth';
import { useServices } from '../../lib/services';
import { vocabIdOf } from '../../schema/vocab';
import { WordForm } from './WordForm';

interface SaveWordDialogProps {
  word: string;
  sentence: string;
  testId: string;
  onClose: () => void;
}

/** Saves a word picked from a passage or transcript, with its sentence as the example. */
export function SaveWordDialog({ word, sentence, testId, onClose }: SaveWordDialogProps) {
  const services = useServices();
  const { state } = useAuth();
  const uid = state.status === 'owner' ? state.user.uid : null;
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<null | 'saving' | 'saved' | 'error'>(null);
  const [savedWord, setSavedWord] = useState(word);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    services
      .vocab(uid)
      .list()
      .then((words) => !cancelled && setSaved(new Set(words.map((w) => vocabIdOf(w.word)))))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [services, uid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-navy/50 p-4 sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-word-h"
        className="flex max-h-full w-full max-w-[560px] flex-col gap-4 overflow-auto rounded-card bg-surface p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="save-word-h" className="m-0 text-lg font-semibold text-navy">
              Save “{word}” to vocabulary
            </h2>
            <p className="m-0 font-serif text-sm text-muted italic">{sentence}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-control border border-border text-navy-3"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        {status === 'saved' ? (
          <div role="status" className="flex flex-col gap-3">
            <p className="m-0 rounded-control bg-good p-3 text-sm font-medium text-good-text">
              “{savedWord}” is saved. It’s due for review today.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 self-start rounded-control bg-navy px-5 text-sm font-semibold text-on-navy"
            >
              Back to the test
            </button>
          </div>
        ) : (
          <>
            <WordForm
              initial={{ word, example: sentence, source: { testId } }}
              today={dayOf(services.now())}
              isSaved={(w) => saved.has(vocabIdOf(w))}
              submitLabel={status === 'saving' ? 'Saving…' : 'Save word'}
              onCancel={onClose}
              onSave={(w) => {
                if (!uid) return;
                setStatus('saving');
                setSavedWord(w.word);
                services
                  .vocab(uid)
                  .save(w)
                  .then(() => setStatus('saved'))
                  .catch(() => setStatus('error'));
              }}
            />
            {status === 'error' && (
              <p role="alert" className="m-0 text-sm text-warn-text">
                The word couldn’t be saved. Check your connection and try again.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
