import { useCallback, useEffect, useState } from 'react';
import { dayOf } from '../engine/srs';
import { vocabIdOf, type VocabWord } from '../schema/vocab';
import { useAuth } from './auth';
import { useServices } from './services';

export type VocabState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; words: VocabWord[] };

/** The owner's saved words, with a save that updates the list at once and then Firestore. */
export function useVocab() {
  const services = useServices();
  const { state: auth } = useAuth();
  const uid = auth.status === 'owner' ? auth.user.uid : null;
  const [state, setState] = useState<VocabState>({ status: 'loading' });
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    services
      .vocab(uid)
      .list()
      .then((words) => !cancelled && setState({ status: 'ready', words }))
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled) {
          setState({
            status: 'error',
            message: 'Your words couldn’t be loaded. Reload to try again.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [services, uid]);

  const save = useCallback(
    async (word: VocabWord) => {
      if (!uid) return;
      const id = vocabIdOf(word.word);
      setState((s) =>
        s.status === 'ready'
          ? {
              status: 'ready',
              words: [...s.words.filter((w) => vocabIdOf(w.word) !== id), word],
            }
          : s,
      );
      try {
        await services.vocab(uid).save(word);
        setSaveError(null);
      } catch (error) {
        console.error(error);
        setSaveError('A change couldn’t be saved. Check your connection.');
      }
    },
    [services, uid],
  );

  return { state, save, saveError, today: dayOf(services.now()) };
}
