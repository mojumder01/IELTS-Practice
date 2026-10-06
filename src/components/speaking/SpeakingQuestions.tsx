import { SPEAKING_PARTS } from '../../engine/speaking';
import type { SpeakingSection } from '../../schema/test';

interface SpeakingQuestionsProps {
  section: SpeakingSection;
  part: number;
  notes: string;
  onNotes: (notes: string) => void;
  readOnly: boolean;
}

const eyebrow = 'm-0 text-xs font-semibold tracking-[0.08em] text-muted uppercase';

/** The interview questions, or Part 2's cue card with preparation notes (Speaking artboard). */
export function SpeakingQuestions({
  section,
  part,
  notes,
  onNotes,
  readOnly,
}: SpeakingQuestionsProps) {
  const heading = SPEAKING_PARTS.find((p) => p.part === part)?.heading ?? `Part ${part}`;

  if (part === 2) {
    const card = section.part2;
    return (
      <aside aria-label="Questions" className="flex flex-col gap-4">
        <p className={eyebrow}>{heading}</p>
        <div className="flex flex-col gap-2 rounded-card border border-border-strong bg-surface p-5 font-serif text-[17px] leading-relaxed text-text">
          <p className="m-0 font-semibold text-navy">{card.topic}</p>
          <p className="m-0">You should say:</p>
          <ul className="m-0 flex flex-col gap-1 pl-5">
            {card.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="m-0">{card.closing}</p>
        </div>
        <p className="m-0 text-sm text-muted">
          You have one minute to prepare. Then speak for one to two minutes.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prep-notes" className="text-sm font-semibold text-navy">
            Preparation notes
          </label>
          <textarea
            id="prep-notes"
            value={notes}
            readOnly={readOnly}
            onChange={(e) => onNotes(e.target.value)}
            className="min-h-28 resize-y rounded-control border border-border-strong bg-surface px-3 py-2.5 text-sm leading-normal"
          />
        </div>
      </aside>
    );
  }

  const questions = part === 1 ? section.part1 : section.part3;
  return (
    <aside aria-label="Questions" className="flex flex-col gap-3">
      <p className={eyebrow}>{heading}</p>
      <p className="m-0 text-sm text-muted">
        {part === 1
          ? 'Answer each question in two or three sentences.'
          : 'Give longer answers with reasons and examples.'}
      </p>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {questions.map((q, i) => (
          <li
            key={q}
            className="flex gap-3 rounded-control border border-border bg-surface px-4 py-3 text-[15px] leading-normal text-text"
          >
            <strong className="font-mono text-sm text-navy">Q{i + 1}</strong>
            {q}
          </li>
        ))}
      </ol>
    </aside>
  );
}
