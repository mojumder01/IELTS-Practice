/** Shared admin form styles. */
export const input =
  'min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-sm text-text';
export const label = 'text-sm font-semibold text-navy';
export const panel = 'flex flex-col gap-4 rounded-card border border-border bg-surface p-5';
export const smallButton =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control border border-border-strong bg-surface px-3.5 text-sm font-semibold text-navy disabled:opacity-50';
export const primaryButton =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control bg-navy px-4 text-sm font-semibold text-on-navy disabled:opacity-50';
export const pressable = (on: boolean) =>
  `min-h-11 rounded-control border px-3.5 text-sm font-semibold ${
    on ? 'border-navy bg-navy text-on-navy' : 'border-border-strong bg-surface text-navy'
  }`;
