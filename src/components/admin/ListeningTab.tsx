import { Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { badTimes, blankListening, formatTime, parseScript, parseTime } from '../../admin/draft';
import type { MediaManifest } from '../../schema/media';
import type { ListeningSection, TestFile } from '../../schema/test';
import { GroupsEditor } from './GroupsEditor';
import { LocalInput } from './LocalText';
import { input, label, panel, pressable, primaryButton, smallButton } from './ui';

interface ListeningTabProps {
  draft: TestFile;
  update: (edit: (d: TestFile) => void) => void;
  manifest: MediaManifest | null;
}

const PARTS = [1, 2, 3, 4] as const;

function listening(d: TestFile, part: 1 | 2 | 3 | 4): ListeningSection | undefined {
  const s = d.sections[`listening-${part}`];
  return s?.kind === 'listening' ? s : undefined;
}

/** Per part: the audio, the audioscript with times and answers, and the questions (SPEC section 8). */
export function ListeningTab({ draft, update, manifest }: ListeningTabProps) {
  const [part, setPart] = useState<1 | 2 | 3 | 4>(1);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [tapping, setTapping] = useState<number | null>(null);
  // Bumped when lines change from outside a row (tap along, paste, delete), to refresh the rows.
  const [rev, setRev] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  const section = listening(draft, part);
  const edit = (fn: (s: ListeningSection) => void) =>
    update((d) => {
      const s = listening(d, part);
      if (s) fn(s);
    });
  const audioFiles = manifest?.files.filter((f) => f.kind === 'audio') ?? [];
  const numbers = section?.groups.flatMap((g) => g.questions.flatMap((q) => q.numbers)) ?? [];
  const bad = section ? badTimes(section.script, section.durationSec) : new Set<number>();

  const stamp = () => {
    if (tapping === null || !section) return;
    const t = Math.round((audio.current?.currentTime ?? 0) * 10) / 10;
    edit((s) => {
      const line = s.script[tapping];
      if (line) line.start = t;
    });
    setRev((r) => r + 1);
    const next = tapping + 1;
    if (next >= section.script.length) {
      setTapping(null);
      audio.current?.pause();
    } else setTapping(next);
  };

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Audio" className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-semibold text-navy">Audio</h2>
          <div role="group" aria-label="Part" className="flex flex-wrap gap-2">
            {PARTS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={part === p}
                onClick={() => {
                  setPart(p);
                  setTapping(null);
                }}
                className={pressable(part === p)}
              >
                Part {p}
              </button>
            ))}
          </div>
        </div>
        {!section ? (
          <button
            type="button"
            onClick={() =>
              update((d) => {
                d.sections[`listening-${part}`] = blankListening(part);
              })
            }
            className={`${smallButton} self-start`}
          >
            Add part {part}
          </button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <div className="flex flex-col gap-1">
              <label htmlFor={`l${part}-audio`} className={label}>
                Audio file (from the media manifest)
              </label>
              <select
                id={`l${part}-audio`}
                value={audioFiles.some((f) => f.path === section.audio) ? section.audio : ''}
                onChange={(e) =>
                  edit((s) => {
                    const file = audioFiles.find((f) => f.path === e.target.value);
                    s.audio = e.target.value || '/media/audio/';
                    if (file?.durationSec) s.durationSec = file.durationSec;
                  })
                }
                className={input}
              >
                <option value="">Choose a file</option>
                {audioFiles.map((f) => (
                  <option key={f.path} value={f.path}>
                    {f.path.replace('/media/audio/', '')}
                    {f.durationSec ? ` · ${formatTime(Math.round(f.durationSec))}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`l${part}-duration`} className={label}>
                Length (s)
              </label>
              <LocalInput
                key={section.audio}
                id={`l${part}-duration`}
                inputMode="decimal"
                initial={String(section.durationSec)}
                onText={(text) =>
                  edit((s) => {
                    const n = Number(text);
                    if (n > 0) s.durationSec = n;
                  })
                }
                className={input}
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor={`l${part}-context`} className={label}>
                Context line (optional)
              </label>
              <input
                id={`l${part}-context`}
                value={section.context ?? ''}
                placeholder="You will hear a man calling a sports centre."
                onChange={(e) =>
                  edit((s) => {
                    s.context = e.target.value || undefined;
                  })
                }
                className={input}
              />
            </div>
            {section.audio.endsWith('.mp3') && (
              // Admin preview of the recording; the script below is its text.
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio ref={audio} controls src={section.audio} className="w-full sm:col-span-2" />
            )}
          </div>
        )}
      </section>

      {section && (
        <section aria-labelledby="script-h" className={panel}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="script-h" className="m-0 text-lg font-semibold text-navy">
                Audioscript
              </h2>
              <span className="text-sm text-muted">
                Times drive the follow-along highlight. Mark which line answers each question.
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-expanded={pasting}
                onClick={() => setPasting(!pasting)}
                className={smallButton}
              >
                Paste full script
              </button>
              <button
                type="button"
                disabled={!section.script.length || !section.audio.endsWith('.mp3')}
                onClick={() => {
                  if (tapping !== null) {
                    setTapping(null);
                    audio.current?.pause();
                    return;
                  }
                  setTapping(0);
                  if (audio.current) {
                    audio.current.currentTime = 0;
                    void audio.current.play();
                  }
                }}
                className={smallButton}
              >
                {tapping === null ? 'Tap along to set times' : 'Stop tapping'}
              </button>
            </div>
          </div>
          {pasting && (
            <div className="flex flex-col gap-2 rounded-control bg-canvas p-3">
              <label htmlFor="paste-script" className={label}>
                One line each: “Speaker: words”, optionally starting with a time (“0:14 Daniel: …”)
              </label>
              <textarea
                id="paste-script"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                className={`${input} min-h-40 py-2`}
              />
              <button
                type="button"
                disabled={!pasted.trim()}
                onClick={() => {
                  edit((s) => {
                    s.script = parseScript(pasted);
                  });
                  setRev((r) => r + 1);
                  setPasting(false);
                  setPasted('');
                }}
                className={`${primaryButton} self-start`}
              >
                Replace the script
              </button>
            </div>
          )}
          {tapping !== null && section.script[tapping] && (
            <button type="button" onClick={stamp} className={`${primaryButton} min-h-14`}>
              Tap as line {tapping + 1} starts: “{section.script[tapping].text.slice(0, 60)}”
            </button>
          )}

          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {section.script.map((line, i) => (
              <li
                key={`${rev}-${i}`}
                className="flex flex-col gap-2 rounded-control bg-canvas p-2.5"
              >
                <div className="grid grid-cols-[5.5rem_8rem_1fr] gap-2 max-sm:grid-cols-[5.5rem_1fr]">
                  <LocalInput
                    aria-label={`Line ${i + 1} start time`}
                    initial={formatTime(line.start)}
                    onText={(text) => {
                      const t = parseTime(text);
                      if (t !== null)
                        edit((s) => {
                          s.script[i]!.start = t;
                        });
                    }}
                    className={`${input} font-mono ${bad.has(i) ? 'border-2 border-warn-text' : ''}`}
                  />
                  <input
                    aria-label={`Line ${i + 1} speaker`}
                    value={line.speaker}
                    onChange={(e) =>
                      edit((s) => {
                        s.script[i]!.speaker = e.target.value;
                      })
                    }
                    className={input}
                  />
                  <input
                    aria-label={`Line ${i + 1} text`}
                    value={line.text}
                    onChange={(e) =>
                      edit((s) => {
                        s.script[i]!.text = e.target.value;
                      })
                    }
                    className={`${input} max-sm:col-span-2`}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label={`Line ${i + 1} answers question`}
                    value={line.answer?.question ?? ''}
                    onChange={(e) =>
                      edit((s) => {
                        const l = s.script[i]!;
                        if (e.target.value) {
                          l.answer = {
                            question: Number(e.target.value),
                            highlight: l.answer?.highlight ?? '',
                          };
                        } else delete l.answer;
                      })
                    }
                    className={`${input} max-w-48`}
                  >
                    <option value="">Answers: none</option>
                    {numbers.map((n) => (
                      <option key={n} value={n}>
                        Answers Q{n}
                      </option>
                    ))}
                  </select>
                  {line.answer && (
                    <input
                      aria-label={`Line ${i + 1} words to highlight`}
                      value={line.answer.highlight}
                      placeholder="Words to highlight"
                      onChange={(e) =>
                        edit((s) => {
                          s.script[i]!.answer!.highlight = e.target.value;
                        })
                      }
                      className={`${input} flex-1 ${
                        line.answer.highlight && !line.text.includes(line.answer.highlight)
                          ? 'border-2 border-warn-text'
                          : ''
                      }`}
                    />
                  )}
                  {bad.has(i) && <span className="text-xs text-warn-text">Time out of order</span>}
                  <button
                    type="button"
                    aria-label={`Remove line ${i + 1}`}
                    onClick={() => {
                      edit((s) => void s.script.splice(i, 1));
                      setRev((r) => r + 1);
                    }}
                    className={`${smallButton} ml-auto w-11 px-0`}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() =>
              edit((s) => {
                const last = s.script.at(-1);
                s.script.push({
                  start: last ? last.start + 5 : 0,
                  speaker: last?.speaker ?? '',
                  text: '',
                });
              })
            }
            className={`${smallButton} self-start`}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add line
          </button>
        </section>
      )}

      {section && (
        <section aria-labelledby="lq-h" className={panel}>
          <div className="flex flex-col gap-1">
            <h2 id="lq-h" className="m-0 text-lg font-semibold text-navy">
              Questions
            </h2>
            <span className="text-sm text-muted">
              Part {part} is questions {(part - 1) * 10 + 1}–{part * 10}. Choose-TWO items take two
              numbers and show as one grid button (21–22).
            </span>
          </div>
          <GroupsEditor
            key={part}
            groups={section.groups}
            start={(part - 1) * 10 + 1}
            onChange={(fn) => edit((s) => fn(s.groups))}
            allowLayout
          />
        </section>
      )}
    </div>
  );
}
