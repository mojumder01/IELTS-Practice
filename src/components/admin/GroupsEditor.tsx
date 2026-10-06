import { Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { blankGroup, nextNumber } from '../../admin/draft';
import { TYPE_NAMES } from '../../lib/questionTypes';
import {
  QuestionTypeSchema,
  type Question,
  type QuestionGroup,
  type QuestionType,
} from '../../schema/test';
import { LocalInput, LocalTextArea } from './LocalText';
import { input, label, pressable, smallButton } from './ui';

const TYPES = QuestionTypeSchema.options;
const VERDICTS: Partial<Record<QuestionType, string[]>> = {
  TRUE_FALSE_NOT_GIVEN: ['TRUE', 'FALSE', 'NOT GIVEN'],
  YES_NO_NOT_GIVEN: ['YES', 'NO', 'NOT GIVEN'],
};
const CHOICE: QuestionType[] = [
  'MULTIPLE_CHOICE_SINGLE',
  'MULTIPLE_CHOICE_MULTIPLE',
  'MATCHING_HEADINGS',
  'MATCHING_PARAGRAPH_INFO',
  'MATCHING_FEATURES',
  'MATCHING_SENTENCE_ENDINGS',
];
const WORDS: QuestionType[] = ['GAP_FILL', 'SHORT_ANSWER', 'DIAGRAM_LABEL'];

/** "A Text" per line ↔ options. */
const formatOptions = (o: QuestionGroup['options']) =>
  (o ?? []).map((x) => `${x.key} ${x.text}`).join('\n');
const parseOptions = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [key = '', ...rest] = l.split(/\s+/);
      return { key, text: rest.join(' ') };
    });

const splitAnswers = (text: string) =>
  text
    .split('/')
    .map((a) => a.trim())
    .filter(Boolean);

interface GroupsEditorProps {
  groups: QuestionGroup[];
  /** The first question number in this section, for a section's first group. */
  start: number;
  onChange: (edit: (groups: QuestionGroup[]) => void) => void;
  /** Reading adds its location controls under each question. */
  renderExtra?: (question: Question, type: QuestionType, g: number, q: number) => ReactNode;
  /** Listening forms and tables put their gaps in a layout. */
  allowLayout?: boolean;
}

/** Question groups: type, instructions, word limit and options, then each question's answers. */
export function GroupsEditor({
  groups,
  start,
  onChange,
  renderExtra,
  allowLayout,
}: GroupsEditorProps) {
  const [newType, setNewType] = useState<QuestionType>('TRUE_FALSE_NOT_GIVEN');
  const [newCount, setNewCount] = useState('5');

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group, g) => {
        const verdicts = VERDICTS[group.type];
        const id = `g${g}`;
        return (
          <fieldset
            key={group.groupId}
            className="m-0 flex min-w-0 flex-col gap-3 rounded-card border border-border p-4"
          >
            <legend className="px-1 text-sm font-semibold text-navy">
              Group {g + 1} · Questions {group.questions[0]?.numbers[0] ?? '—'}–
              {group.questions.at(-1)?.numbers.at(-1) ?? '—'}
            </legend>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-type`} className={label}>
                  Question type
                </label>
                <select
                  id={`${id}-type`}
                  value={group.type}
                  onChange={(e) =>
                    onChange((gs) => {
                      gs[g]!.type = e.target.value as QuestionType;
                    })
                  }
                  className={input}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_NAMES[t]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => onChange((gs) => void gs.splice(g, 1))}
                className={`${smallButton} self-end`}
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Remove group
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-instructions`} className={label}>
                Instructions
              </label>
              <textarea
                id={`${id}-instructions`}
                value={group.instructions}
                onChange={(e) =>
                  onChange((gs) => {
                    gs[g]!.instructions = e.target.value;
                  })
                }
                className={`${input} min-h-16 py-2`}
              />
            </div>
            {WORDS.includes(group.type) && (
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${id}-limit`} className={label}>
                    Word limit as shown
                  </label>
                  <input
                    id={`${id}-limit`}
                    value={group.wordLimit ?? ''}
                    placeholder="NO MORE THAN TWO WORDS"
                    onChange={(e) =>
                      onChange((gs) => {
                        gs[g]!.wordLimit = e.target.value || undefined;
                      })
                    }
                    className={input}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${id}-max`} className={label}>
                    Most words
                  </label>
                  <select
                    id={`${id}-max`}
                    value={group.maxWords ?? ''}
                    onChange={(e) =>
                      onChange((gs) => {
                        gs[g]!.maxWords = e.target.value ? Number(e.target.value) : undefined;
                      })
                    }
                    className={input}
                  >
                    <option value="">No limit</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {CHOICE.includes(group.type) && (
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${id}-options`} className={label}>
                    Options, one per line (“A Sports hall”)
                  </label>
                  <LocalTextArea
                    id={`${id}-options`}
                    initial={formatOptions(group.options)}
                    onText={(text) =>
                      onChange((gs) => {
                        const options = parseOptions(text);
                        gs[g]!.options = options.length ? options : undefined;
                      })
                    }
                    className={`${input} min-h-24 py-2 font-mono`}
                  />
                </div>
                {group.type === 'MULTIPLE_CHOICE_MULTIPLE' && (
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`${id}-per`} className={label}>
                      Answers needed
                    </label>
                    <select
                      id={`${id}-per`}
                      value={group.answersPerItem ?? 2}
                      onChange={(e) =>
                        onChange((gs) => {
                          gs[g]!.answersPerItem = Number(e.target.value);
                        })
                      }
                      className={input}
                    >
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </div>
                )}
              </div>
            )}
            {allowLayout && WORDS.includes(group.type) && (
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-layout`} className={label}>
                  Form, table or notes (optional): Markdown with {'{{n}}'} for each gap
                </label>
                <textarea
                  id={`${id}-layout`}
                  value={group.layout?.body ?? ''}
                  onChange={(e) =>
                    onChange((gs) => {
                      gs[g]!.layout = e.target.value
                        ? { kind: gs[g]!.layout?.kind ?? 'form', body: e.target.value }
                        : undefined;
                    })
                  }
                  className={`${input} min-h-24 py-2 font-mono`}
                />
              </div>
            )}

            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {group.questions.map((question, q) => {
                const nums = question.numbers.join('–');
                return (
                  <li
                    key={question.numbers.join('-')}
                    className="flex flex-col gap-2 rounded-control bg-canvas p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-10 font-mono text-sm font-semibold text-navy">
                        Q{nums}
                      </span>
                      <input
                        aria-label={`Question ${nums} statement`}
                        value={question.prompt ?? ''}
                        placeholder="Statement, question or sentence with ___"
                        onChange={(e) =>
                          onChange((gs) => {
                            gs[g]!.questions[q]!.prompt = e.target.value;
                          })
                        }
                        className={`${input} flex-1`}
                      />
                      <button
                        type="button"
                        aria-label={`Remove question ${nums}`}
                        onClick={() => onChange((gs) => void gs[g]!.questions.splice(q, 1))}
                        className={`${smallButton} w-11 px-0`}
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                    {verdicts ? (
                      <div
                        role="group"
                        aria-label={`Question ${nums} answer`}
                        className="flex flex-wrap gap-1.5"
                      >
                        {verdicts.map((v) => (
                          <button
                            key={v}
                            type="button"
                            aria-pressed={question.acceptedAnswers[0]?.[0] === v}
                            onClick={() =>
                              onChange((gs) => {
                                gs[g]!.questions[q]!.acceptedAnswers = [[v]];
                              })
                            }
                            className={pressable(question.acceptedAnswers[0]?.[0] === v)}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    ) : (
                      question.numbers.map((n, i) => (
                        <LocalInput
                          key={n}
                          aria-label={`Question ${n} accepted answers`}
                          initial={(question.acceptedAnswers[i] ?? []).join(' / ')}
                          placeholder={
                            CHOICE.includes(group.type)
                              ? 'Letter, e.g. B'
                              : 'Accepted answers, separated by /'
                          }
                          onText={(text) =>
                            onChange((gs) => {
                              const qq = gs[g]!.questions[q]!;
                              qq.acceptedAnswers = qq.numbers.map((_, j) =>
                                j === i ? splitAnswers(text) : (qq.acceptedAnswers[j] ?? []),
                              );
                            })
                          }
                          className={input}
                        />
                      ))
                    )}
                    <input
                      aria-label={`Question ${nums} explanation`}
                      value={question.explanation ?? ''}
                      placeholder="Explanation (optional), shown on Results"
                      onChange={(e) =>
                        onChange((gs) => {
                          gs[g]!.questions[q]!.explanation = e.target.value || undefined;
                        })
                      }
                      className={input}
                    />
                    {renderExtra?.(question, group.type, g, q)}
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              onClick={() =>
                onChange((gs) => {
                  const n = nextNumber(gs, start);
                  const per =
                    gs[g]!.type === 'MULTIPLE_CHOICE_MULTIPLE' ? (gs[g]!.answersPerItem ?? 2) : 1;
                  const numbers = Array.from({ length: per }, (_, i) => n + i);
                  gs[g]!.questions.push({
                    numbers,
                    prompt: '',
                    acceptedAnswers: numbers.map(() => []),
                  });
                })
              }
              className={`${smallButton} self-start`}
            >
              <Plus aria-hidden="true" className="size-4" />
              Add question
            </button>
          </fieldset>
        );
      })}

      <div className="flex flex-wrap items-end gap-3 rounded-card border border-dashed border-border-strong p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="new-group-type" className={label}>
            New group type
          </label>
          <select
            id="new-group-type"
            value={newType}
            onChange={(e) => setNewType(e.target.value as QuestionType)}
            className={input}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_NAMES[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex w-28 flex-col gap-1">
          <label htmlFor="new-group-count" className={label}>
            Questions
          </label>
          <input
            id="new-group-count"
            inputMode="numeric"
            value={newCount}
            onChange={(e) => setNewCount(e.target.value)}
            className={input}
          />
        </div>
        <button
          type="button"
          onClick={() =>
            onChange((gs) => {
              const count = Math.max(1, Math.min(20, Number.parseInt(newCount, 10) || 1));
              gs.push(
                blankGroup(newType, nextNumber(gs, start), count, `g${Date.now().toString(36)}`),
              );
            })
          }
          className={smallButton}
        >
          <Plus aria-hidden="true" className="size-4" />
          Add group
        </button>
      </div>
    </div>
  );
}
