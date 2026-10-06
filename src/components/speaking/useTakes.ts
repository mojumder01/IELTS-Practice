import { useEffect, useState } from 'react';
import { useServices } from '../../lib/services';
import type { Take } from '../../lib/recordings';

/**
 * This part's takes from the device, oldest first; `version` reloads them after a new take.
 * null while loading.
 */
export function useTakes(attemptId: string, part: number, version: number): Take[] | null {
  const { recordings } = useServices();
  const [loaded, setLoaded] = useState<{ key: string; takes: Take[] } | null>(null);
  const key = `${attemptId}:${part}:${version}`;

  useEffect(() => {
    let cancelled = false;
    recordings
      .list(attemptId)
      .then((all) => {
        if (!cancelled) setLoaded({ key, takes: all.filter((t) => t.part === part) });
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled) setLoaded({ key, takes: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [recordings, attemptId, part, key]);

  // Until the new list arrives, keep showing the last one rather than flashing empty.
  return loaded ? loaded.takes : null;
}
