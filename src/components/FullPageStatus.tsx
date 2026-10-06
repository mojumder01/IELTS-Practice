import { LoaderCircle } from 'lucide-react';

export function FullPageStatus({ label }: { label: string }) {
  return (
    <div role="status" className="grid min-h-dvh place-items-center px-4 text-muted">
      <span className="inline-flex items-center gap-2 text-[15px]">
        <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
        {label}
      </span>
    </div>
  );
}
