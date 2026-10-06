import type { TestFile } from '../../schema/test';
import { LocalInput } from './LocalText';
import { input, label, panel } from './ui';

interface SettingsTabProps {
  draft: TestFile;
  update: (edit: (d: TestFile) => void) => void;
}

/** A whole number of minutes from a field, or the old value while it's being typed. */
const minutes = (text: string, old: number) => {
  const n = Number.parseInt(text, 10);
  return n > 0 ? n : old;
};

/** Book, number and track; timers per mode; student help switches (SPEC section 8). */
export function SettingsTab({ draft, update }: SettingsTabProps) {
  const { meta } = draft;
  const t = meta.timing;
  const timer = (
    name: string,
    value: number,
    set: (d: TestFile, n: number) => void,
    suffix: string,
  ) => (
    <span className="inline-flex items-center gap-2">
      <LocalInput
        aria-label={name}
        inputMode="numeric"
        initial={String(value)}
        onText={(text) => update((d) => set(d, minutes(text, value)))}
        className={`${input} w-16 text-center font-mono`}
      />
      <span className="text-sm text-muted">{suffix}</span>
    </span>
  );
  const toggles = [
    {
      id: 'allowReveal' as const,
      label: 'Show answers in Single part',
      note: 'The lightbulb reveals answers and their place in the passage or script.',
    },
    {
      id: 'showScriptInSinglePart' as const,
      label: 'Audioscript in Single part',
      note: 'Listening shows the script with follow-along while practising one part.',
    },
    {
      id: 'lockAudioInFullMock' as const,
      label: 'Lock audio in Full mock',
      note: 'No pausing, seeking or speed changes, as in the real test.',
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="identity-h" className={panel}>
        <h2 id="identity-h" className="m-0 text-lg font-semibold text-navy">
          Test identity
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="f-book" className={label}>
              Book or collection
            </label>
            <input
              id="f-book"
              value={meta.book}
              onChange={(e) =>
                update((d) => {
                  d.meta.book = e.target.value;
                })
              }
              className={input}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="f-no" className={label}>
              Test number
            </label>
            <LocalInput
              id="f-no"
              inputMode="numeric"
              initial={String(meta.testNumber)}
              onText={(text) =>
                update((d) => {
                  d.meta.testNumber = minutes(text, d.meta.testNumber);
                })
              }
              className={input}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="f-track" className={label}>
              Track
            </label>
            <select
              id="f-track"
              value={meta.track}
              onChange={(e) =>
                update((d) => {
                  d.meta.track = e.target.value === 'general' ? 'general' : 'academic';
                })
              }
              className={input}
            >
              <option value="academic">Academic</option>
              <option value="general">General Training</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={label}>Test ID</span>
            <span className="flex min-h-11 items-center font-mono text-sm text-navy-3">
              {meta.testId}
            </span>
            <span className="text-xs text-muted">
              Fixed once created: attempts and the URL use it.
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="timer-h" className={panel}>
        <div className="flex flex-col gap-1">
          <h2 id="timer-h" className="m-0 text-lg font-semibold text-navy">
            Timer for each mode
          </h2>
          <p className="m-0 text-sm text-muted">
            Students pick Single part or Full mock from the test header. Minutes.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold tracking-[0.05em] text-muted uppercase">
                <th scope="col" className="py-2">
                  Module
                </th>
                <th scope="col" className="py-2">
                  Single part
                </th>
                <th scope="col" className="py-2">
                  Full mock
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="py-2 text-left font-semibold text-navy">
                  Listening
                </th>
                <td className="py-2">
                  {timer(
                    'Listening single part minutes',
                    t.listening.singlePartMin,
                    (d, n) => {
                      d.meta.timing.listening.singlePartMin = n;
                    },
                    'per part',
                  )}
                </td>
                <td className="py-2">
                  {timer(
                    'Listening full mock minutes',
                    t.listening.fullMockMin,
                    (d, n) => {
                      d.meta.timing.listening.fullMockMin = n;
                    },
                    `+ ${t.listening.checkMin} min check`,
                  )}
                </td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="py-2 text-left font-semibold text-navy">
                  Reading
                </th>
                <td className="py-2">
                  {timer(
                    'Reading single part minutes',
                    t.reading.singlePartMin,
                    (d, n) => {
                      d.meta.timing.reading.singlePartMin = n;
                    },
                    'per passage',
                  )}
                </td>
                <td className="py-2">
                  {timer(
                    'Reading full mock minutes',
                    t.reading.fullMockMin,
                    (d, n) => {
                      d.meta.timing.reading.fullMockMin = n;
                    },
                    '',
                  )}
                </td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="py-2 text-left font-semibold text-navy">
                  Writing
                </th>
                <td className="flex flex-wrap gap-2 py-2">
                  {timer(
                    'Writing task 1 minutes',
                    t.writing.task1Min,
                    (d, n) => {
                      d.meta.timing.writing.task1Min = n;
                    },
                    'Task 1',
                  )}
                  {timer(
                    'Writing task 2 minutes',
                    t.writing.task2Min,
                    (d, n) => {
                      d.meta.timing.writing.task2Min = n;
                    },
                    'Task 2',
                  )}
                </td>
                <td className="py-2">
                  {timer(
                    'Writing full mock minutes',
                    t.writing.fullMockMin,
                    (d, n) => {
                      d.meta.timing.writing.fullMockMin = n;
                    },
                    '',
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="help-h" className={panel}>
        <h2 id="help-h" className="m-0 text-lg font-semibold text-navy">
          Help for students
        </h2>
        {toggles.map((tg) => (
          <div key={tg.id} className="flex min-h-11 items-start gap-3">
            <input
              id={`tg-${tg.id}`}
              type="checkbox"
              aria-describedby={`tg-${tg.id}-note`}
              checked={meta.studentHelp[tg.id]}
              onChange={(e) =>
                update((d) => {
                  d.meta.studentHelp[tg.id] = e.target.checked;
                })
              }
              className="mt-1 size-5 accent-navy"
            />
            <div className="flex flex-col">
              <label htmlFor={`tg-${tg.id}`} className="text-sm font-semibold text-navy">
                {tg.label}
              </label>
              <span id={`tg-${tg.id}-note`} className="text-[13px] text-muted">
                {tg.note}
              </span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
