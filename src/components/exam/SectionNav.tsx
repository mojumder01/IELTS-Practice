import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { Link } from 'react-router';
import type { PartInfo } from '../../engine/parts';

interface SectionNavProps {
  parts: PartInfo[];
  currentPart: number;
  onPickPart: (part: number) => void;
  previous: { label: string; href: string } | null;
  next: { label: string; href: string } | null;
  /** The right-hand action: Evaluate, Next part, or Next module. */
  action: { label: string; onClick: () => void; kind: 'evaluate' | 'next' } | null;
}

const moduleLink =
  'inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-border-strong bg-surface px-4 text-sm font-semibold text-navy no-underline hover:text-navy';

export function SectionNav({
  parts,
  currentPart,
  onPickPart,
  previous,
  next,
  action,
}: SectionNavProps) {
  return (
    <nav
      aria-label="Test sections"
      className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-t border-border bg-surface px-4 py-2.5 sm:px-5"
    >
      <span className="hidden min-w-0 flex-1 sm:block" />
      <div className="flex flex-wrap items-center justify-center gap-2">
        {previous && (
          <Link to={previous.href} className={moduleLink}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            {previous.label}
          </Link>
        )}
        {parts.map((p) => (
          <button
            key={p.part}
            type="button"
            aria-pressed={p.part === currentPart}
            onClick={() => onPickPart(p.part)}
            className={`min-h-11 rounded-[10px] border px-[18px] text-sm font-semibold ${
              p.part === currentPart
                ? 'border-navy bg-navy text-on-navy'
                : 'border-border-strong bg-surface text-navy'
            }`}
          >
            {p.label}
          </button>
        ))}
        {next && (
          <Link to={next.href} className={moduleLink}>
            {next.label}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
      <div className="flex flex-1 justify-end">
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-navy px-[18px] text-sm font-semibold whitespace-nowrap text-on-navy hover:bg-navy-2"
          >
            {action.kind === 'evaluate' && <CheckCircle aria-hidden="true" className="size-4" />}
            {action.label}
            {action.kind === 'next' && <ArrowRight aria-hidden="true" className="size-4" />}
          </button>
        )}
      </div>
    </nav>
  );
}
