import { Pause, Play } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AttemptRecord } from '../../engine/session';
import { formatSpeakingTime, SPEAKING_CRITERIA } from '../../engine/speaking';
import type { Take } from '../../lib/recordings';
import { useServices } from '../../lib/services';
import { TakePlayback } from '../../lib/takePlayback';
import { card } from '../progress/styles';

/** The self-scores, the Part 2 checklist and the takes still on this device. */
export function SpeakingResults({ attempt }: { attempt: AttemptRecord }) {
  const { recordings } = useServices();
  const [takes, setTakes] = useState<Take[] | null>(null);
  const [playback] = useState(() => new TakePlayback());
  const playing = useSyncExternalStore(playback.subscribe, playback.getSnapshot);
  useEffect(() => playback.stop, [playback]);

  useEffect(() => {
    let cancelled = false;
    recordings
      .list(attempt.attemptId)
      .then((list) => !cancelled && setTakes(list))
      .catch(() => !cancelled && setTakes([]));
    return () => {
      cancelled = true;
    };
  }, [recordings, attempt.attemptId]);

  const scores = attempt.speaking?.selfScores ?? {};
  const keys = attempt.speaking?.recordingKeys.length ?? 0;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <section aria-labelledby="criteria-h" className={`${card} flex flex-col gap-3`}>
        <h2 id="criteria-h" className="m-0 text-[17px] font-semibold text-navy">
          Your self-assessment
        </h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {SPEAKING_CRITERIA.map((c) => (
            <li key={c.id} className="flex justify-between gap-3 text-sm">
              <span>{c.label}</span>
              <span className="font-mono font-semibold text-navy">
                {scores[c.id]?.toFixed(1) ?? '—'}
              </span>
            </li>
          ))}
        </ul>
        <p className="m-0 text-sm text-muted">
          Part 2 points covered: {attempt.speaking?.covered.length ?? 0}.
        </p>
      </section>
      <section aria-labelledby="takes-h" className={`${card} flex flex-col gap-3`}>
        <h2 id="takes-h" className="m-0 text-[17px] font-semibold text-navy">
          Takes
        </h2>
        {takes === null ? (
          <p className="m-0 text-sm text-muted">Loading…</p>
        ) : takes.length === 0 ? (
          <p className="m-0 text-sm text-muted">
            {keys
              ? `${keys} ${keys === 1 ? 'take was' : 'takes were'} recorded on another device; recordings stay where they were made.`
              : 'No takes were recorded.'}
          </p>
        ) : (
          <ul aria-labelledby="takes-h" className="m-0 flex list-none flex-col gap-2 p-0">
            {takes.map((t) => (
              <li
                key={t.key}
                className="flex items-center gap-3 rounded-control border border-border px-2 py-1.5"
              >
                <button
                  type="button"
                  aria-label={`${playing === t.key ? 'Pause' : 'Play'} part ${t.part} take ${t.number}`}
                  onClick={() => playback.toggle(t)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-control border border-border-strong text-navy"
                >
                  {playing === t.key ? (
                    <Pause aria-hidden="true" className="size-4" />
                  ) : (
                    <Play aria-hidden="true" className="size-4" />
                  )}
                </button>
                <span className="text-sm font-semibold text-navy">
                  Part {t.part} · Take {t.number}
                </span>
                <span className="ml-auto font-mono text-sm text-navy">
                  {formatSpeakingTime(t.durationSec)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
