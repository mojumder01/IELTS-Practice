import { useState } from 'react';
import {
  blankReading,
  formatPassage,
  nextNumber,
  parsePassage,
  passageSentences,
  toggleLocation,
} from '../../admin/draft';
import type { Question, QuestionType, ReadingSection, TestFile } from '../../schema/test';
import { GroupsEditor } from './GroupsEditor';
import { LocalInput, LocalTextArea } from './LocalText';
import { input, label, panel, pressable, smallButton } from './ui';

interface ReadingTabProps {
  draft: TestFile;
  update: (edit: (d: TestFile) => void) => void;
}

const PARTS = [1, 2, 3] as const;
const VERDICT_TYPES: QuestionType[] = ['TRUE_FALSE_NOT_GIVEN', 'YES_NO_NOT_GIVEN'];

function reading(d: TestFile, part: 1 | 2 | 3): ReadingSection | undefined {
  const s = d.sections[`reading-${part}`];
  return s?.kind === 'reading' ? s : undefined;
}

/** Where passage `part` starts numbering: after the previous passage's last question. */
function startOf(d: TestFile, part: 1 | 2 | 3): number {
  if (part === 1) return 1;
  const previous = reading(d, (part - 1) as 1 | 2);
  return previous ? nextNumber(previous.groups, startOf(d, (part - 1) as 1 | 2)) : 1;
}

/** Passages, their questions, and each answer linked to the sentence that proves it (SPEC section 8). */
export function ReadingTab({ draft, update }: ReadingTabProps) {
  const [part, setPart] = useState<1 | 2 | 3>(1);
  const [view, setView] = useState<'edit' | 'link'>('edit');
  const [active, setActive] = useState<number | null>(null);
  const section = reading(draft, part);
  const edit = (fn: (s: ReadingSection) => void) =>
    update((d) => {
      const s = reading(d, part);
      if (s) fn(s);
    });

  const questions = section?.groups.flatMap((g) => g.questions) ?? [];
  const activeQuestion = questions.find((q) => q.numbers.includes(active ?? -1));
  const sentences = section ? passageSentences(section.paragraphs) : [];
  const linkedTo = (paragraph: string, sentence: number) =>
    questions
      .filter((q) => q.location?.paragraph === paragraph && q.location.sentence === sentence)
      .flatMap((q) => q.numbers);

  const locationControls = (question: Question, type: QuestionType, g: number, q: number) => {
    const loc = question.location;
    const n = question.numbers.join('–');
    const sentence = loc
      ? sentences.find((p) => p.label === loc.paragraph)?.sentences[loc.sentence - 1]
      : undefined;
    const setLoc = (location: Question['location']) =>
      edit((s) => {
        s.groups[g]!.questions[q]!.location = location;
      });
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {loc === undefined ? (
            <span className="rounded-pill bg-warn px-2.5 py-1 text-xs font-semibold text-warn-text">
              Needs a location
            </span>
          ) : loc === null ? (
            <span className="rounded-pill bg-surface-muted px-2.5 py-1 text-xs font-semibold text-navy-3">
              Not Given: no location
            </span>
          ) : (
            <span className="rounded-pill bg-good px-2.5 py-1 text-xs font-semibold text-good-text">
              Paragraph {loc.paragraph} · sentence {loc.sentence}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setActive(question.numbers[0]!);
              setView('link');
            }}
            className={smallButton}
          >
            Link to passage
          </button>
          {VERDICT_TYPES.includes(type) && (
            <button
              type="button"
              aria-pressed={loc === null}
              onClick={() => setLoc(loc === null ? undefined : null)}
              className={pressable(loc === null)}
            >
              No location (Not Given)
            </button>
          )}
        </div>
        {loc && (
          <div className="flex flex-col gap-1">
            <LocalInput
              key={`${loc.paragraph}${loc.sentence}`}
              aria-label={`Question ${n} words to highlight`}
              initial={loc.highlight}
              placeholder="Exact words to highlight"
              onText={(text) => setLoc({ ...loc, highlight: text })}
              className={input}
            />
            {sentence && !sentence.includes(loc.highlight) && (
              <span className="text-xs text-warn-text">
                These words aren’t in the sentence: “{sentence}”
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Passage" className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Passage" className="flex flex-wrap gap-2">
            {PARTS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={part === p}
                onClick={() => {
                  setPart(p);
                  setActive(null);
                }}
                className={pressable(part === p)}
              >
                Passage {p}
              </button>
            ))}
          </div>
          {section && (
            <div role="group" aria-label="View" className="flex gap-2">
              <button
                type="button"
                aria-pressed={view === 'edit'}
                onClick={() => setView('edit')}
                className={pressable(view === 'edit')}
              >
                Edit text
              </button>
              <button
                type="button"
                aria-pressed={view === 'link'}
                onClick={() => setView('link')}
                className={pressable(view === 'link')}
              >
                Link answers
              </button>
            </div>
          )}
        </div>

        {!section ? (
          <button
            type="button"
            onClick={() =>
              update((d) => {
                d.sections[`reading-${part}`] = blankReading(part);
              })
            }
            className={`${smallButton} self-start`}
          >
            Add passage {part}
          </button>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor={`p${part}-title`} className={label}>
                Passage title
              </label>
              <input
                id={`p${part}-title`}
                value={section.title}
                onChange={(e) =>
                  edit((s) => {
                    s.title = e.target.value;
                  })
                }
                className={input}
              />
            </div>
            {view === 'edit' ? (
              <div className="flex flex-col gap-1">
                <label htmlFor={`p${part}-text`} className={label}>
                  Passage text
                </label>
                <span className="text-xs text-muted">
                  Start each paragraph with [A], [B] … and leave a blank line between paragraphs.
                </span>
                <LocalTextArea
                  key={part}
                  id={`p${part}-text`}
                  initial={formatPassage(section.paragraphs)}
                  onText={(text) =>
                    edit((s) => {
                      const paragraphs = parsePassage(text);
                      s.paragraphs = paragraphs.length ? paragraphs : [{ label: 'A', text: '' }];
                    })
                  }
                  className={`${input} min-h-72 py-3 font-serif text-[15px] leading-relaxed`}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="active-q" className={label}>
                      Linking answer for
                    </label>
                    <select
                      id="active-q"
                      value={active ?? ''}
                      onChange={(e) => setActive(e.target.value ? Number(e.target.value) : null)}
                      className={input}
                    >
                      <option value="">Choose a question</option>
                      {questions.map((q) => (
                        <option key={q.numbers.join('-')} value={q.numbers[0]}>
                          Question {q.numbers.join('–')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-sm text-muted">
                    Click the sentence that proves the answer. Click it again to unlink.
                  </span>
                </div>
                {sentences.map((p) => (
                  <div key={p.label} className="flex gap-3">
                    <span className="w-5 shrink-0 font-bold text-navy">{p.label}</span>
                    <div className="flex flex-1 flex-col gap-1.5">
                      {p.sentences.map((text, i) => {
                        const linked = linkedTo(p.label, i + 1);
                        const mine =
                          activeQuestion?.location?.paragraph === p.label &&
                          activeQuestion.location.sentence === i + 1;
                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={!activeQuestion}
                            aria-pressed={mine}
                            aria-label={`Paragraph ${p.label}, sentence ${i + 1}: ${text}${
                              linked.length ? `. Linked to question ${linked.join(', ')}` : ''
                            }`}
                            onClick={() => {
                              if (!activeQuestion) return;
                              const location = toggleLocation(
                                activeQuestion.location,
                                p.label,
                                i + 1,
                                text,
                              );
                              edit((s) => {
                                for (const g of s.groups)
                                  for (const q of g.questions)
                                    if (q.numbers.includes(active!)) q.location = location;
                              });
                            }}
                            className={`flex items-start justify-between gap-2 rounded-control border px-3 py-2 text-left font-serif text-[15px] leading-normal ${
                              mine ? 'border-navy bg-now-playing' : 'border-border bg-surface'
                            } disabled:cursor-default`}
                          >
                            <span>{text}</span>
                            {linked.length > 0 && (
                              <span className="flex shrink-0 gap-1">
                                {linked.map((n) => (
                                  <span
                                    key={n}
                                    className="flex size-6 items-center justify-center rounded-pill bg-navy font-sans text-xs font-bold text-on-navy"
                                  >
                                    {n}
                                  </span>
                                ))}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {section && (
        <section aria-labelledby="rq-h" className={panel}>
          <h2 id="rq-h" className="m-0 text-lg font-semibold text-navy">
            Questions, answers and locations
          </h2>
          <GroupsEditor
            key={part}
            groups={section.groups}
            start={startOf(draft, part)}
            onChange={(fn) => edit((s) => fn(s.groups))}
            renderExtra={locationControls}
          />
        </section>
      )}
    </div>
  );
}
