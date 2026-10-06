interface BrandMarkProps {
  /** Wordmark colour follows the surface: white on the navy header, navy on cards. */
  tone?: 'onNavy' | 'onLight';
}

export function BrandMark({ tone = 'onLight' }: BrandMarkProps) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-[34px] items-center justify-center rounded-control bg-red text-sm font-bold tracking-[0.02em] text-on-navy"
      >
        IP
      </span>
      <span
        className={`text-[17px] font-semibold ${tone === 'onNavy' ? 'text-on-navy' : 'text-navy'}`}
      >
        IELTS Practice
      </span>
    </span>
  );
}
