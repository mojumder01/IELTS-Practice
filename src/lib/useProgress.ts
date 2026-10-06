import { useCallback, useEffect, useState } from 'react';
import type { AttemptRecord } from '../engine/session';
import type { Profile } from '../schema/profile';
import type { TestMeta } from '../schema/test';
import { localKey } from '../store/examStore';
import { useAuth } from './auth';
import { useServices } from './services';

export interface ProgressData {
  attempts: AttemptRecord[];
  tests: TestMeta[];
  profile: Profile;
}

export type ProgressState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ProgressData };

/** The owner's attempts, the live tests and the profile, for the progress pages. */
export function useProgress() {
  const services = useServices();
  const { state: auth } = useAuth();
  const uid = auth.status === 'owner' ? auth.user.uid : null;
  const [state, setState] = useState<ProgressState>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    Promise.all([services.attempts(uid).list(), services.listTests(), services.profile(uid).get()])
      .then(([attempts, tests, profile]) => {
        if (!cancelled) setState({ status: 'ready', data: { attempts, tests, profile } });
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled) {
          setState({
            status: 'error',
            message: 'Your progress couldn’t be loaded. Check your connection, then reload.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [services, uid, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const saveProfile = useCallback(
    async (profile: Profile) => {
      if (!uid) return;
      await services.profile(uid).save(profile);
      setState((s) => (s.status === 'ready' ? { ...s, data: { ...s.data, profile } } : s));
    },
    [services, uid],
  );

  /** Drops an unfinished attempt from Firestore and this device. */
  const discard = useCallback(
    async (attempt: AttemptRecord) => {
      if (!uid) return;
      await services.attempts(uid).remove(attempt.attemptId);
      services.local.remove(localKey(attempt.testId, attempt.module));
      reload();
    },
    [services, uid, reload],
  );

  return { state, reload, saveProfile, discard };
}
