import { CircleCheck, CircleDashed, CircleX } from 'lucide-react';
import type { CheckItem } from '../../admin/draft';

/** "Before publishing": each check with a word as well as an icon, and its first problems. */
export function Checklist({ items }: { items: CheckItem[] }) {
  const failing = items.filter((i) => i.ok !== true).length;
  return (
    <section
      aria-labelledby="checks-h"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="checks-h" className="m-0 text-base font-semibold text-navy">
        Before publishing
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {items.map((item) => {
          const Icon = item.ok === true ? CircleCheck : item.ok === false ? CircleX : CircleDashed;
          return (
            <li key={item.id} className="flex flex-col gap-1">
              <span className="flex items-start gap-2 text-sm">
                <Icon
                  aria-hidden="true"
                  className={`mt-0.5 size-4 shrink-0 ${
                    item.ok === true
                      ? 'text-good-text'
                      : item.ok === false
                        ? 'text-warn-text'
                        : 'text-muted'
                  }`}
                />
                <span>
                  <span className="sr-only">
                    {item.ok === true
                      ? 'Passes: '
                      : item.ok === false
                        ? 'Fails: '
                        : 'Not checked yet: '}
                  </span>
                  <strong className="font-semibold text-navy">{item.area}</strong> · {item.text}
                </span>
              </span>
              {item.issues.length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-0.5 pl-6 text-xs text-warn-text">
                  {item.issues.slice(0, 4).map((issue, i) => (
                    <li key={i}>
                      <span className="font-mono">{issue.path}</span>: {issue.message}
                    </li>
                  ))}
                  {item.issues.length > 4 && <li>…and {item.issues.length - 4} more</li>}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <p role="status" className="m-0 text-sm text-muted">
        {failing === 0
          ? 'Every check passes: ready to publish.'
          : 'Publish unlocks when every check passes.'}
      </p>
    </section>
  );
}
