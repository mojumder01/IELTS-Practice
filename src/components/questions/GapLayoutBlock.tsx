import { Fragment, type ReactNode } from 'react';
import type { QuestionResult } from '../../engine/scoring';
import type { QuestionGroup } from '../../schema/test';
import { GapInput } from './GapInput';
import { IconToggle } from './IconToggle';
import { RevealLine } from './RevealLine';
import { useQuestionState } from './useQuestionState';

interface GapLayoutBlockProps {
  group: QuestionGroup;
  results: QuestionResult[];
  where: (n: number) => string;
}

/**
 * A summary, notes, form, flow-chart or table with gaps (SPEC section 7, "Gap layouts"): the
 * layout body is Markdown-like text where {{n}} marks the input for question n.
 */
export function GapLayoutBlock({ group, results, where }: GapLayoutBlockProps) {
  const q = useQuestionState();
  const layout = group.layout!;
  const shown = q.isShown(group.groupId);
  const resultFor = (n: number) => results.find((r) => r.number === n);
  const numbers = group.questions.flatMap((question) => question.numbers);

  const inline = (text: string): ReactNode =>
    text
      .split(/\{\{(\d+)\}\}/)
      .map((part, i) =>
        i % 2 === 1 ? (
          <GapInput
            key={i}
            number={Number(part)}
            maxWords={group.maxWords}
            wordLimit={group.wordLimit}
            result={shown ? resultFor(Number(part)) : undefined}
          />
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      );

  const lines = layout.body.split('\n').filter((line) => line.trim() !== '');
  let body: ReactNode;
  if (layout.kind === 'table') {
    const rows = lines.filter((l) => l.trim().startsWith('|') && !/^\|\s*:?-{2,}/.test(l.trim()));
    const cells = (row: string) =>
      row
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim());
    const [head, ...rest] = rows;
    body = (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-[15px]">
          {head && (
            <thead>
              <tr>
                {cells(head).map((c, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="border border-border bg-surface-muted px-3 py-2 text-left font-semibold"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rest.map((row, r) => (
              <tr key={r}>
                {cells(row).map((c, i) => (
                  <td key={i} className="border border-border px-3 py-2 align-middle leading-[2.4]">
                    {inline(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else if (layout.kind === 'flow') {
    body = (
      <ol className="m-0 flex list-none flex-col items-center gap-1 p-0">
        {lines.map((line, i) => (
          <li key={i} className="flex flex-col items-center gap-1">
            {i > 0 && (
              <span aria-hidden="true" className="text-muted">
                ↓
              </span>
            )}
            <span className="rounded-control border border-border px-4 py-1 text-center leading-[2.4]">
              {inline(line)}
            </span>
          </li>
        ))}
      </ol>
    );
  } else if (layout.kind === 'summary') {
    body = layout.body.split(/\n\s*\n/).map((para, i) => (
      <p key={i} className="m-0 text-base leading-[2.7]">
        {inline(para.replace(/\n/g, ' '))}
      </p>
    ));
  } else {
    // notes and form: one line per row; "- " lines are bullets, "# " lines subheadings.
    body = (
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {lines.map((line, i) =>
          line.startsWith('# ') ? (
            <li key={i} className="pt-2 font-semibold text-navy">
              {line.slice(2)}
            </li>
          ) : (
            <li key={i} className={`leading-[2.4] ${line.startsWith('- ') ? 'pl-4' : ''}`}>
              {line.startsWith('- ') && <span aria-hidden="true">• </span>}
              {inline(line.replace(/^- /, ''))}
            </li>
          ),
        )}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-border bg-surface px-[22px] py-5">
      {layout.title && (
        <h3 className="m-0 text-center text-base font-semibold text-navy">{layout.title}</h3>
      )}
      <div className="text-base text-text">{body}</div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-[13px] text-muted">Flag for review:</span>
        {numbers.map((n) => (
          <span key={n} className="inline-flex items-center gap-1">
            <span className="font-mono text-[13px] font-semibold text-navy">{n}</span>
            <IconToggle
              kind="flag"
              label={`Flag question ${n} for review`}
              pressed={q.flagged(n)}
              onClick={() => q.toggleFlag(n)}
            />
          </span>
        ))}
      </div>
      {shown && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
          {results.map((r) => (
            <RevealLine key={r.number} result={r} where={where(r.number)} numbered />
          ))}
        </div>
      )}
    </div>
  );
}
