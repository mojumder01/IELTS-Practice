import { CloudOff } from 'lucide-react';
import { useOnline } from '../lib/useOnline';

/** Shown while offline: tests already opened keep working and changes sync later. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <p
      role="status"
      className="m-0 flex items-center justify-center gap-2 bg-answer-hl px-4 py-2 text-center text-sm font-medium text-flag-stroke"
    >
      <CloudOff aria-hidden="true" className="size-4 shrink-0" />
      You’re offline. Tests you’ve opened before still work, and changes sync when you’re back.
    </p>
  );
}
