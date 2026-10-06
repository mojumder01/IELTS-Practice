import { Lock, Sparkles } from 'lucide-react';
import { essayWordCount, MIN_WORDS_FOR_FEEDBACK } from '../../engine/writing';
import { useIsPhone } from '../../lib/useMediaQuery';
import type { WritingSection } from '../../schema/test';
import { useExam } from '../../store/examContext';
import { EssayEditor } from './EssayEditor';
import { FeedbackPanel } from './FeedbackPanel';
import { TaskPrompt } from './TaskPrompt';
import { useFeedbackRequest } from './useFeedbackRequest';

/** On a phone the panel opens under the editor, out of sight: bring it up once, as it opens. */
const scrollIntoView = (el: HTMLElement | null) =>
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** One Writing task: the prompt, the editor and AI feedback (Writing artboard). */
export function WritingContent({ section }: { section: WritingSection }) {
  const phone = useIsPhone();
  const session = useExam((s) => s.session)!;
  const timing = useExam((s) => s.test!.meta.timing.writing);
  const setEssay = useExam((s) => s.setEssay);
  const setNotes = useExam((s) => s.setNotes);
  const status = useExam((s) => s.feedbackStatus);
  const panelOpen = useExam((s) => s.feedbackOpen);
  const setPanelOpen = useExam((s) => s.setFeedbackOpen);
  const requestFeedback = useFeedbackRequest();

  const task = session.part === 2 ? 2 : 1;
  const key = `task${task}` as const;
  const text = session.essays[key];
  const submitted = session.status === 'submitted';
  // Practice (single part) gets feedback any time; Exam (full mock) only after submitting.
  const available = session.mode === 'single' || submitted;
  const tooShort = essayWordCount(text) < MIN_WORDS_FOR_FEEDBACK;
  const request = () => requestFeedback(task);

  const panel = (
    <FeedbackPanel
      task={task}
      feedback={session.feedback[key]}
      status={status[key] ?? { kind: 'idle' }}
      tooShort={tooShort}
      minWordsForFeedback={MIN_WORDS_FOR_FEEDBACK}
      onRequest={request}
      onClose={() => setPanelOpen(false)}
    />
  );
  // As on the paper: the advice is per task, whichever timer is running.
  const minutes = task === 1 ? timing.task1Min : timing.task2Min;
  const t = task === 1 ? section.task1 : section.task2;

  return (
    <div className={`flex min-h-full gap-6 px-4 py-6 sm:px-7 ${phone ? 'flex-col' : ''}`}>
      <div className={phone ? '' : 'w-[min(34%,420px)] shrink-0'}>
        <TaskPrompt
          section={section}
          task={task}
          minutes={minutes}
          notes={session.notes}
          onNotes={setNotes}
          readOnly={submitted}
        />
      </div>
      <section aria-label="Your response" className="flex min-w-0 flex-1 flex-col gap-3">
        <EssayEditor
          task={task}
          text={text}
          minWords={t.minWords}
          readOnly={submitted}
          onChange={(v) => setEssay(task, v)}
        />
        <div className="flex flex-wrap items-center gap-3">
          {available ? (
            <button
              type="button"
              aria-expanded={panelOpen}
              onClick={() =>
                panelOpen
                  ? setPanelOpen(false)
                  : session.feedback[key]
                    ? setPanelOpen(true)
                    : request()
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-control border border-navy bg-navy px-4 text-sm font-semibold text-on-navy"
            >
              <Sparkles aria-hidden="true" className="size-4" />
              {panelOpen
                ? 'Hide AI feedback'
                : session.feedback[key]
                  ? 'Show AI feedback'
                  : 'Get AI feedback'}
            </button>
          ) : (
            <span className="inline-flex min-h-11 items-center gap-2 rounded-control bg-surface-muted px-3 text-[13px] text-navy-3">
              <Lock aria-hidden="true" className="size-4" />
              AI feedback unlocks after you submit
            </span>
          )}
          <span className="text-xs text-muted">Spellcheck is off, as in the real test.</span>
        </div>
      </section>
      {available && panelOpen && (
        <div
          ref={phone ? scrollIntoView : undefined}
          className={phone ? 'scroll-mt-4' : 'w-[min(30%,380px)] shrink-0'}
        >
          {panel}
        </div>
      )}
    </div>
  );
}
