import { useCallback, useEffect, useRef, useState } from 'react';
import { useServices } from '../../lib/services';
import type { TestFile } from '../../schema/test';

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

type DraftState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; draft: TestFile; live: boolean };

const AUTOSAVE_MS = 1200;

/**
 * One test in the admin: its draft (or a copy of the live test the first time), edits that
 * autosave a moment after typing stops, and publishing.
 */
export function useDraft(testId: string) {
  const services = useServices();
  const [state, setState] = useState<DraftState>({ status: 'loading' });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const timer = useRef<number | null>(null);
  const latest = useRef<TestFile | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [draft, all] = await Promise.all([
        services.admin.drafts.get(testId),
        services.admin.listAllTests(),
      ]);
      const live = all.some((t) => t.testId === testId && t.status === 'live');
      const start = draft ?? (live ? await services.loadTest(testId) : null);
      if (cancelled) return;
      if (!start) return setState({ status: 'missing' });
      latest.current = start;
      setState({ status: 'ready', draft: start, live });
    })().catch(() => !cancelled && setState({ status: 'missing' }));
    return () => {
      cancelled = true;
    };
  }, [services, testId]);

  const save = useCallback(async () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const draft = latest.current;
    if (!draft) return;
    setSaveStatus('saving');
    try {
      await services.admin.drafts.save(draft);
      // Still the latest? Then everything is saved.
      setSaveStatus(latest.current === draft ? 'saved' : 'unsaved');
    } catch (error) {
      console.error(error);
      setSaveStatus('error');
    }
  }, [services]);

  // Saves on leaving, too.
  useEffect(
    () => () => {
      if (timer.current !== null) void save();
    },
    [save],
  );

  /** Edits a copy of the draft; it saves itself shortly after. */
  const update = useCallback(
    (edit: (draft: TestFile) => void) => {
      setState((s) => {
        if (s.status !== 'ready') return s;
        const next = structuredClone(s.draft);
        edit(next);
        latest.current = next;
        return { ...s, draft: next };
      });
      setSaveStatus('unsaved');
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void save(), AUTOSAVE_MS);
    },
    [save],
  );

  /** Import: the whole draft at once. */
  const replace = useCallback(
    (draft: TestFile) => update((d) => Object.assign(d, structuredClone(draft))),
    [update],
  );

  const publish = useCallback(async () => {
    const draft = latest.current;
    if (!draft) return;
    await save();
    await services.admin.publish(draft);
    setState((s) => (s.status === 'ready' ? { ...s, live: true } : s));
  }, [services, save]);

  return { state, saveStatus, update, replace, save, publish };
}
