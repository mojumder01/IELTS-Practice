/** Placeholder blocks while a page loads: a heading, a row of cards and a list. */
export function PageSkeleton({ label }: { label: string }) {
  const block = 'rounded-card bg-surface-muted motion-safe:animate-pulse';
  return (
    <main
      role="status"
      aria-label={label}
      className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-9 pb-12 sm:px-8"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className={`${block} h-4 w-32`} />
        <div className={`${block} h-8 w-72 max-w-full`} />
      </div>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${block} h-28`} />
        ))}
      </div>
      <div aria-hidden="true" className={`${block} h-64`} />
    </main>
  );
}
