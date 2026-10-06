import { Link } from 'react-router';
import { moduleName } from '../../engine/parts';
import { attemptBand, scoreText } from '../../engine/progress';
import type { AttemptRecord } from '../../engine/session';
import { formatDate } from '../../lib/links';
import { td, th } from './styles';

/** Date, test, module, score, band and a Review link; shared with History. */
export function AttemptTable({
  attempts,
  nameOf,
}: {
  attempts: AttemptRecord[];
  nameOf: (testId: string) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr>
            {['Date', 'Test', 'Module', 'Score', 'Band', 'Details'].map((h) => (
              <th key={h} scope="col" className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => {
            const band = attemptBand(a);
            return (
              <tr key={a.attemptId}>
                <td className={td}>{formatDate(a.submittedAt ?? a.updatedAt)}</td>
                <td className={td}>
                  {nameOf(a.testId)}
                  {a.mode === 'single' && a.module !== 'speaking' && (
                    <span className="text-muted"> · Part {a.part}</span>
                  )}
                </td>
                <td className={td}>{moduleName(a.module)}</td>
                <td className={`${td} font-mono`}>{scoreText(a)}</td>
                <td className={td}>
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span className="rounded-[6px] bg-surface-muted px-2 py-0.5 font-mono font-semibold text-navy">
                      {band ? band.band.toFixed(1) : '—'}
                    </span>
                    {band?.estimate && <span className="text-xs text-muted">estimate</span>}
                    {a.revealUsed && (
                      <span className="rounded-[6px] bg-answer-hl px-2 py-0.5 text-xs font-semibold text-flag-stroke">
                        Practice
                      </span>
                    )}
                  </span>
                </td>
                <td className={td}>
                  <Link to={`/results/${a.attemptId}`}>Review</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
