import { blankSpeaking } from '../../admin/draft';
import type { SpeakingSection, TestFile } from '../../schema/test';
import { LocalTextArea } from './LocalText';
import { input, label, panel, smallButton } from './ui';

interface SpeakingTabProps {
  draft: TestFile;
  update: (edit: (d: TestFile) => void) => void;
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** Part 1 and 3 questions, one per line, and the Part 2 cue card. */
export function SpeakingTab({ draft, update }: SpeakingTabProps) {
  const section =
    draft.sections.speaking?.kind === 'speaking' ? draft.sections.speaking : undefined;
  const edit = (fn: (s: SpeakingSection) => void) =>
    update((d) => {
      if (d.sections.speaking?.kind === 'speaking') fn(d.sections.speaking);
    });
  if (!section) {
    return (
      <section className={panel}>
        <button
          type="button"
          onClick={() =>
            update((d) => {
              d.sections.speaking = blankSpeaking();
            })
          }
          className={`${smallButton} self-start`}
        >
          Add Speaking
        </button>
      </section>
    );
  }
  const card = section.part2;
  return (
    <section aria-labelledby="speak-h" className={panel}>
      <h2 id="speak-h" className="m-0 text-lg font-semibold text-navy">
        Speaking parts
      </h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="s1" className={label}>
          Part 1 questions (one per line)
        </label>
        <LocalTextArea
          id="s1"
          initial={section.part1.join('\n')}
          onText={(text) => edit((s) => void (s.part1 = lines(text)))}
          className={`${input} min-h-32 py-2`}
        />
      </div>
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className={`${label} mb-1 p-0`}>Part 2 cue card</legend>
        <input
          aria-label="Cue card topic"
          value={card.topic}
          placeholder="Describe a place you enjoy visiting."
          onChange={(e) => edit((s) => void (s.part2.topic = e.target.value))}
          className={input}
        />
        {card.points.map((point, i) => (
          <input
            key={i}
            aria-label={`Cue card point ${i + 1}`}
            value={point}
            placeholder={['where it is', 'how often you go there', 'what people do there'][i]}
            onChange={(e) => edit((s) => void (s.part2.points[i] = e.target.value))}
            className={input}
          />
        ))}
        <input
          aria-label="Cue card last line"
          value={card.closing}
          placeholder="and explain why you enjoy visiting it."
          onChange={(e) => edit((s) => void (s.part2.closing = e.target.value))}
          className={input}
        />
      </fieldset>
      <div className="flex flex-col gap-1">
        <label htmlFor="s3" className={label}>
          Part 3 questions (one per line)
        </label>
        <LocalTextArea
          id="s3"
          initial={section.part3.join('\n')}
          onText={(text) => edit((s) => void (s.part3 = lines(text)))}
          className={`${input} min-h-32 py-2`}
        />
      </div>
    </section>
  );
}
