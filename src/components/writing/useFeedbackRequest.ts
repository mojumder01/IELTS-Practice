import { useContext } from 'react';
import { essayWordCount, MIN_WORDS_FOR_FEEDBACK } from '../../engine/writing';
import { FeedbackError } from '../../lib/ai';
import { ServicesContext } from '../../lib/services';
import { useExamStore } from '../../store/examContext';

/**
 * Opens the feedback panel and asks the AI about one task's essay. The editor's button and
 * "Evaluate my essay" both use it, so it reads the latest essay when it runs.
 */
export function useFeedbackRequest(): (task: 1 | 2) => void {
  // Read without throwing: the exam frame holds this hook for every module, Writing or not.
  const services = useContext(ServicesContext);
  const store = useExamStore();

  return (task) => {
    const { test, session, setFeedback, setFeedbackStatus, setFeedbackOpen } = store.getState();
    const section = test?.sections.writing;
    if (!services || !session || section?.kind !== 'writing') return;
    setFeedbackOpen(true);
    const essay = session.essays[`task${task}`];
    if (essayWordCount(essay) < MIN_WORDS_FOR_FEEDBACK) return; // the panel explains why
    setFeedbackStatus(task, { kind: 'loading' });
    services
      .writingFeedback({
        task,
        prompt: task === 1 ? section.task1.prompt : section.task2.prompt,
        essay,
        ...(task === 1 ? { imageDescription: section.task1.imageDescription } : {}),
      })
      .then((feedback) => {
        setFeedback(feedback);
        setFeedbackStatus(task, { kind: 'idle' });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof FeedbackError
            ? error.message
            : 'Feedback isn’t available right now. Please try again.';
        setFeedbackStatus(task, { kind: 'error', message });
      });
  };
}
