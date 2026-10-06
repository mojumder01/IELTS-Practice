import { BrandMark } from '../components/BrandMark';

/** Shown instead of the app when the build has no Firebase config. */
export function SetupNeeded({ missing }: { missing: string[] }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-12">
      <div className="flex w-full max-w-[520px] flex-col gap-5 rounded-card border border-border bg-surface p-7">
        <BrandMark />
        <h1 className="m-0 text-2xl leading-tight font-semibold text-navy">
          Firebase isn’t configured
        </h1>
        <p className="m-0 text-[15px] leading-normal text-muted">
          This build is missing these settings:
        </p>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {missing.map((name) => (
            <li key={name}>
              <code className="rounded-[6px] bg-surface-muted px-2 py-1 font-mono text-sm text-navy">
                {name}
              </code>
            </li>
          ))}
        </ul>
        <p className="m-0 text-[15px] leading-normal text-muted">
          Copy <code className="font-mono text-sm">.env.example</code> to{' '}
          <code className="font-mono text-sm">.env.local</code>, fill in the values and restart the
          dev server. <code className="font-mono text-sm">docs/SETUP.md</code> walks through it.
        </p>
      </div>
    </main>
  );
}
