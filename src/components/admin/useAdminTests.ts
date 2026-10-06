import { useEffect, useState } from 'react';
import { sortTests } from '../../engine/progress';
import { useServices } from '../../lib/services';

export interface AdminTestRow {
  testId: string;
  book: string;
  testNumber: number;
  live: boolean;
}

/** Every draft and live test, for the sidebar and the admin home. */
export function useAdminTests(version: unknown = 0) {
  const services = useServices();
  const [rows, setRows] = useState<AdminTestRow[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([services.admin.drafts.list(), services.admin.listAllTests()])
      .then(([drafts, tests]) => {
        const byId = new Map<string, AdminTestRow>();
        for (const d of drafts) byId.set(d.testId, { ...d, live: false });
        for (const t of tests) {
          byId.set(t.testId, { ...t, live: t.status === 'live' });
        }
        if (!cancelled) setRows(sortTests([...byId.values()]));
      })
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [services, version]);
  return rows;
}
