import {
  coveragePoints,
  fillerCount,
  formatSpeakingTime,
  paceWpm,
  reviewNote,
  selfScoreBand,
  SPEAKING_CRITERIA,
  spokenWords,
  transcriptPieces,
  type SelfScores,
  type SpeakingCriterion,
} from '../../engine/speaking';
import type { Take } from '../../lib/recordings';
import type { SpeakingSection } from '../../schema/test';

interface SelfReviewProps {
  section: SpeakingSection;
  part: number;
  maxSec: number;
  take: Take | null;
  /** Whether this browser can transcribe at all. */
  canTranscribe: boolean;
  covered: string[];
  onToggleCovered: (point: string) => void;
  selfScores: SelfScores;
  onSelfScore: (criterion: SpeakingCriterion, band: number | null) => void;
  finished: boolean;
}

const BANDS = [9, 8, 7, 6, 5, 4, 3, 2, 1];

function Transcript({ take, canTranscribe }: { take: Take | null; canTranscribe: boolean }) {
  const text = take?.transcript;
  if (take && text === null) {
    return (
      <p className="m-0 rounded-control bg-surface-muted p-3 text-sm text-navy-3">
        Transcript not available in this browser. Your recording still works; Chrome can write a
        transcript.
      </p>
    );
  }
  if (!take) {
    return (
      <p className="m-0 text-sm text-muted">
        {canTranscribe
          ? 'Record a take and its transcript appears here, with filler words highlighted.'
          : 'Transcript not available in this browser. Recording still works; Chrome can write a transcript.'}
      </p>
    );
  }
  if (!text)
    return <p className="m-0 text-sm text-muted">No speech was picked up for a transcript.</p>;
  return (
    <>
      <p className="m-0 font-serif text-[16px] leading-relaxed text-text">
        {transcriptPieces(text).map((piece, i) =>
          piece.filler ? (
            <mark key={i} className="rounded-[3px] bg-user-hl px-0.5 text-text">
              <span className="sr-only">filler: </span>
              {piece.text}
            </mark>
          ) : (
            <span key={i}>{piece.text}</span>
          ),
        )}
      </p>
      <span className="text-xs text-muted">Filler words are highlighted.</span>
    </>
  );
}

/** The take's numbers, transcript, Part 2 checklist and the self-assessed band (Speaking artboard). */
export function SelfReview({
  section,
  part,
  maxSec,
  take,
  canTranscribe,
  covered,
  onToggleCovered,
  selfScores,
  onSelfScore,
  finished,
}: SelfReviewProps) {
  const transcript = take?.transcript ?? null;
  const words = transcript ? spokenWords(transcript) : null;
  const pace = take && words !== null ? paceWpm(words, take.durationSec) : null;
  const points = part === 2 ? coveragePoints(section.part2) : [];
  const ticked = points.filter((p) => covered.includes(p.id));
  const band = selfScoreBand(selfScores);
  const metrics = [
    { label: 'Speaking time', value: take ? formatSpeakingTime(take.durationSec) : '—' },
    { label: 'Pace', value: pace === null ? '—' : String(pace), unit: pace === null ? '' : 'wpm' },
    { label: 'Filler words', value: transcript === null ? '—' : String(fillerCount(transcript)) },
  ];

  return (
    <aside
      aria-label="Self-review"
      className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 md:col-span-2 xl:col-span-1"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-base font-semibold text-navy">Self-review</h2>
        {take && (
          <span className="rounded-pill bg-surface-muted px-2.5 py-1 text-xs font-semibold text-navy-3">
            Take {take.number}
          </span>
        )}
      </div>

      <dl className="m-0 grid grid-cols-3 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col gap-1 rounded-control bg-surface-muted p-3">
            <dt className="text-xs text-muted">{m.label}</dt>
            <dd className="m-0 font-mono text-lg font-semibold text-navy">
              {m.value}
              {m.unit && <span className="ml-1 text-xs font-medium text-muted">{m.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold text-navy">Transcript</h3>
        <Transcript take={take} canTranscribe={canTranscribe} />
      </div>

      {points.length > 0 && (
        <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
          <legend className="mb-1 p-0 text-sm font-semibold text-navy">
            Did you cover every point?{' '}
            <span className="font-medium text-muted">
              {ticked.length} of {points.length}
            </span>
          </legend>
          {points.map((p) => (
            <label key={p.id} htmlFor={p.id} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                id={p.id}
                type="checkbox"
                checked={covered.includes(p.id)}
                disabled={finished}
                onChange={() => onToggleCovered(p.id)}
                className="size-5 accent-navy"
              />
              {p.label}
            </label>
          ))}
        </fieldset>
      )}
      {part === 2 && take && (
        <p className="m-0 rounded-control bg-surface-muted p-3 text-sm text-navy-3">
          {reviewNote(
            take,
            maxSec,
            points.filter((p) => !covered.includes(p.id)),
          )}
        </p>
      )}

      <fieldset className="m-0 flex flex-col gap-2 border-0 border-t border-border p-0 pt-4">
        <legend className="float-left mb-1 w-full p-0 text-sm font-semibold text-navy">
          Score yourself
        </legend>
        <p className="m-0 text-[13px] text-muted">
          Use the public band descriptors and score the whole test, all three parts.
        </p>
        {SPEAKING_CRITERIA.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3">
            <label htmlFor={`score-${c.id}`} className="text-sm text-text">
              {c.label}
            </label>
            <select
              id={`score-${c.id}`}
              value={selfScores[c.id] ?? ''}
              disabled={finished}
              onChange={(e) => onSelfScore(c.id, e.target.value ? Number(e.target.value) : null)}
              className="min-h-11 rounded-control border border-border-strong bg-surface px-2 font-mono text-sm text-navy"
            >
              <option value="">—</option>
              {BANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        ))}
        <p role="status" className="m-0 text-sm font-semibold text-navy">
          {band === null
            ? 'Score all four to see your speaking band.'
            : `Speaking band ${band.toFixed(1)} (self-assessed)`}
        </p>
      </fieldset>
    </aside>
  );
}
