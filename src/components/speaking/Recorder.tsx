import { Check, CircleCheck, Mic, Pause, Play, Square } from 'lucide-react';
import { formatSpeakingTime } from '../../engine/speaking';
import { formatClock } from '../../engine/timer';
import type { Take } from '../../lib/recordings';
import type { RecorderSnapshot } from '../../lib/speakingRecorder';

interface RecorderProps {
  limits: { prepSec: number; maxSec: number };
  state: RecorderSnapshot;
  /** Submitted: takes can be played but not added. */
  finished: boolean;
  takes: Take[] | null;
  playing: string | null;
  /** The clock, for "Just now" and "Today 10:12". */
  now: number;
  onBegin: () => void;
  onStartSpeaking: () => void;
  onStop: () => void;
  onToggleTake: (take: Take) => void;
}

const primary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-navy px-5 text-sm font-semibold text-on-navy disabled:opacity-50';
const secondary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-5 text-sm font-semibold text-navy';

function takeWhen(createdAt: number, now: number): string {
  if (now - createdAt < 60_000) return 'Just now';
  const at = new Date(createdAt);
  const time = at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return at.toDateString() === new Date(now).toDateString()
    ? `Today ${time}`
    : `${at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`;
}

/** Prepare → Speak → Review, the live level meter and the takes so far (Speaking artboard). */
export function Recorder({
  limits,
  state,
  finished,
  takes,
  playing,
  now,
  onBegin,
  onStartSpeaking,
  onStop,
  onToggleTake,
}: RecorderProps) {
  const longTurn = limits.prepSec > 0;
  const steps = [
    ...(longTurn ? [{ id: 'prepare', label: 'Prepare', sub: '1 min' }] : []),
    { id: 'record', label: 'Speak', sub: longTurn ? '1–2 min' : 'Answer each question' },
    { id: 'review', label: 'Review', sub: 'Self-check' },
  ];
  const phase =
    state.phase === 'starting' ? 'record' : state.phase === 'saving' ? 'review' : state.phase;
  const current = steps.findIndex((s) => s.id === phase);
  const latest = takes?.at(-1) ?? null;

  return (
    <section
      aria-label="Recorder"
      className="flex min-w-0 flex-col gap-5 rounded-card border border-border bg-surface p-5"
    >
      <ol aria-label="Steps" className="m-0 flex list-none flex-wrap gap-2 p-0">
        {steps.map((step, i) => {
          const now = i === current;
          const done = current > i;
          return (
            <li
              key={step.id}
              aria-current={now ? 'step' : undefined}
              className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-control border px-3 py-2 ${
                now
                  ? 'border-navy bg-navy text-on-navy'
                  : done
                    ? 'border-now-playing-border bg-now-playing text-answered'
                    : 'border-border bg-surface text-muted'
              }`}
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-pill border text-[13px] font-semibold ${
                  now ? 'border-on-navy-muted' : 'border-current'
                }`}
              >
                {done ? <Check aria-label="Done" className="size-4" /> : i + 1}
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{step.label}</span>
                <span className={`text-xs ${now ? 'text-on-navy-muted' : ''}`}>{step.sub}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-card bg-canvas px-4 py-6 text-center">
        {finished && state.phase === 'idle' ? (
          <p className="m-0 max-w-[360px] text-[15px] text-muted">
            Speaking is finished. Play your takes below, or start a new attempt from the library.
          </p>
        ) : state.phase === 'idle' ? (
          <>
            <p className="m-0 max-w-[380px] text-[15px] text-muted">
              {longTurn
                ? 'You get one minute to prepare, then up to two minutes to speak. Recording starts on its own when preparation ends.'
                : 'Record your answers to the questions, one after another, as in the interview.'}
            </p>
            <button type="button" onClick={onBegin} className={primary}>
              <Mic aria-hidden="true" className="size-4" />
              {longTurn ? 'Start preparing' : 'Start recording'}
            </button>
          </>
        ) : state.phase === 'prepare' ? (
          <>
            <span className="text-sm font-medium text-muted">Preparation time left</span>
            <span
              role="timer"
              className="font-mono text-[44px] leading-none font-semibold text-navy"
            >
              {formatClock(Math.ceil(state.prepLeftSec ?? 0))}
            </span>
            <button type="button" onClick={onStartSpeaking} className={primary}>
              <Mic aria-hidden="true" className="size-4" />
              Start speaking now
            </button>
          </>
        ) : state.phase === 'starting' ? (
          <p role="status" className="m-0 text-[15px] text-muted">
            Starting the microphone…
          </p>
        ) : state.phase === 'record' ? (
          <>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-navy">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-pill bg-red motion-safe:animate-pulse"
              />
              Recording
            </span>
            <span
              role="timer"
              className="font-mono text-[44px] leading-none font-semibold text-navy"
            >
              {formatClock(Math.floor(state.elapsedSec ?? 0))}
            </span>
            <span className="text-[13px] text-muted">
              of {formatSpeakingTime(limits.maxSec)} maximum
            </span>
          </>
        ) : state.phase === 'saving' ? (
          <p role="status" className="m-0 text-[15px] text-muted">
            Saving the take…
          </p>
        ) : (
          latest && (
            <>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-good-text">
                <CircleCheck aria-hidden="true" className="size-4" />
                Take {latest.number} saved
              </span>
              <span className="font-mono text-[44px] leading-none font-semibold text-navy">
                {formatClock(latest.durationSec)}
              </span>
              <span className="text-[13px] text-muted">Listen back before checking the points</span>
            </>
          )
        )}

        {state.phase === 'record' && (
          <div aria-hidden="true" className="flex h-14 items-center gap-[3px]">
            {Array.from({ length: 32 }, (_, i) => {
              const level = state.levels[i - (32 - state.levels.length)];
              return (
                <span
                  key={i}
                  className={`w-1.5 rounded-pill ${level === undefined ? 'bg-border' : 'bg-red'}`}
                  style={{ height: `${Math.max(6, Math.round((level ?? 0) * 52))}px` }}
                />
              );
            })}
          </div>
        )}

        {state.phase === 'record' && (
          <button type="button" onClick={onStop} className={primary}>
            <Square aria-hidden="true" className="size-3.5 fill-current" />
            Stop recording
          </button>
        )}
        {state.phase === 'review' && latest && (
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => onToggleTake(latest)} className={primary}>
              {playing === latest.key ? (
                <Pause aria-hidden="true" className="size-4" />
              ) : (
                <Play aria-hidden="true" className="size-4" />
              )}
              {playing === latest.key ? 'Pause take' : 'Play take'}
            </button>
            {!finished && (
              <button type="button" onClick={onBegin} className={secondary}>
                Record again
              </button>
            )}
          </div>
        )}
        {state.error && (
          <p
            role="alert"
            className="m-0 max-w-[380px] rounded-control bg-warn px-3 py-2 text-sm text-warn-text"
          >
            {state.error}
          </p>
        )}
      </div>

      {longTurn && (
        <p className="m-0 text-[13px] text-muted">
          Speak until the two minutes run out. The examiner stops you, so you never need to finish
          early.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <h2 id="takes-h" className="m-0 text-[15px] font-semibold text-navy">
          Your takes
        </h2>
        {takes && takes.length === 0 && (
          <p className="m-0 text-sm text-muted">No takes yet for this part.</p>
        )}
        <ul aria-labelledby="takes-h" className="m-0 flex list-none flex-col gap-2 p-0">
          {takes?.map((take) => (
            <li
              key={take.key}
              className="flex items-center gap-3 rounded-control border border-border px-2 py-1.5"
            >
              <button
                type="button"
                aria-label={`${playing === take.key ? 'Pause' : 'Play'} take ${take.number}`}
                onClick={() => onToggleTake(take)}
                className="flex size-11 shrink-0 items-center justify-center rounded-control border border-border-strong text-navy"
              >
                {playing === take.key ? (
                  <Pause aria-hidden="true" className="size-4" />
                ) : (
                  <Play aria-hidden="true" className="size-4" />
                )}
              </button>
              <span className="text-sm font-semibold text-navy">Take {take.number}</span>
              <span className="font-mono text-sm text-navy">
                {formatSpeakingTime(take.durationSec)}
              </span>
              <span className="ml-auto text-xs text-muted">{takeWhen(take.createdAt, now)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
