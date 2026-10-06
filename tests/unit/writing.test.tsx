import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it, vi } from 'vitest';
import { ExamShell } from '../../src/components/exam/ExamShell';
import { WritingContent } from '../../src/components/writing/WritingContent';
import { clearEssay, hasAnswers, setEssay } from '../../src/engine/session';
import { essayWordCount, wordNote } from '../../src/engine/writing';
import { FeedbackError, requestFeedback, type FeedbackRequest } from '../../src/lib/ai';
import { ServicesContext, type Services } from '../../src/lib/services';
import type { WritingFeedback } from '../../src/schema/attempt';
import type { WritingSection } from '../../src/schema/test';
import { ExamStoreContext } from '../../src/store/examContext';
import { SAMPLE_ESSAY, SAMPLE_MODEL_REPLY } from '../fixtures/writingSample';
import { examWorld, sample } from './examHarness';

function writingSection(): WritingSection {
  const section = sample.sections.writing;
  if (section?.kind !== 'writing') throw new Error('the sample test needs a Writing section');
  return section;
}
const section = writingSection();

/** The sample reply, run through the real parser, as the app's services would. */
const sampleFeedback = (request: FeedbackRequest) =>
  requestFeedback(request, () => Promise.resolve(SAMPLE_MODEL_REPLY));

async function renderWriting({
  mode = 'single',
  part = 1,
  feedback = vi.fn(sampleFeedback),
}: {
  mode?: 'single' | 'full';
  part?: 1 | 2;
  feedback?: (request: FeedbackRequest) => Promise<WritingFeedback>;
} = {}) {
  const world = examWorld();
  const store = world.newStore();
  await store.getState().open({ test: sample, module: 'writing', mode, part });
  const services = { writingFeedback: feedback } as unknown as Services;
  const router = createMemoryRouter([
    {
      path: '*',
      element: (
        <ServicesContext value={services}>
          <ExamStoreContext value={store}>
            <ExamShell>
              <WritingContent section={section} />
            </ExamShell>
          </ExamStoreContext>
        </ServicesContext>
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
  return { world, store, router, feedback };
}

/** Pasting the whole essay at once: typing 150 words key by key is slow and proves nothing more. */
const writeEssay = (text: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: /Your answer/ }), {
    target: { value: text },
  });

describe('Writing engine', () => {
  it('counts words by whitespace', () => {
    expect(essayWordCount('')).toBe(0);
    expect(essayWordCount('  A well-known  fact,\nin 2025. ')).toBe(5);
    expect(essayWordCount(SAMPLE_ESSAY)).toBe(154);
  });

  it('says how many words are left to the minimum', () => {
    expect(wordNote(112, 150)).toBe('38 more to reach the minimum');
    expect(wordNote(150, 150)).toBe('Minimum reached');
  });

  it('counts an essay as an answer and clears one task only', async () => {
    const store = examWorld().newStore();
    const s0 = await store
      .getState()
      .open({ test: sample, module: 'writing', mode: 'full', part: 1 });
    expect(hasAnswers(s0)).toBe(false);
    const s1 = setEssay(setEssay(s0, 1, 'Task one.', 1), 2, 'Task two.', 2);
    expect(hasAnswers(s1)).toBe(true);
    const s2 = clearEssay(s1, 1, 3);
    expect(s2.essays).toEqual({ task1: '', task2: 'Task two.' });
  });
});

describe('Writing page', () => {
  it('shows the task, Practice and Exam modes, and a live word count', async () => {
    await renderWriting();
    expect(screen.getByText('Book 21 · Test 1 · Writing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Practice' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Exam' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('timer')).toHaveTextContent('20:00');
    expect(screen.getByText('You should spend about 20 minutes on this task.')).toBeInTheDocument();
    expect(screen.getByText('Write at least 150 words.')).toBeInTheDocument();

    const editor = screen.getByRole('textbox', { name: 'Your answer · Task 1' });
    expect(editor).toHaveAttribute('spellcheck', 'false');
    await userEvent.setup().type(editor, 'The graph shows four types');
    expect(screen.getByText('5 / 150 words')).toBeInTheDocument();
    expect(screen.getByText('145 more to reach the minimum')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Words towards the minimum' })).toHaveAttribute(
      'aria-valuenow',
      '5',
    );
  });

  it('enlarges the chart with zoom, and Escape closes it', async () => {
    const user = userEvent.setup();
    await renderWriting();
    await user.click(screen.getByRole('button', { name: 'Enlarge the chart' }));
    const dialog = screen.getByRole('dialog', { name: 'Enlarged chart' });
    expect(within(dialog).getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Zoom in' }));
    await user.click(within(dialog).getByRole('button', { name: 'Zoom in' }));
    expect(
      within(dialog).getByRole('button', { name: 'Reset zoom (now 200%)' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('img', { name: /Drag or use the arrow keys/ }),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Reset zoom (now 200%)' }));
    expect(
      within(dialog).getByRole('button', { name: 'Reset zoom (now 100%)' }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks for 50 words before calling the AI', async () => {
    const user = userEvent.setup();
    const { feedback } = await renderWriting({ part: 2 });
    writeEssay('Too short to mark.');
    await user.click(screen.getByRole('button', { name: 'Get AI feedback' }));
    expect(
      within(screen.getByRole('complementary', { name: 'AI feedback' })).getByText(
        /Write at least 50 words for Task 2/,
      ),
    ).toBeInTheDocument();
    expect(feedback).not.toHaveBeenCalled();
  });

  it('renders feedback for the sample essay in Practice', async () => {
    const user = userEvent.setup();
    const { feedback, store } = await renderWriting({ part: 2 });
    writeEssay(SAMPLE_ESSAY);
    expect(screen.getByText('154 / 250 words')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Get AI feedback' }));

    const panel = await screen.findByRole('complementary', { name: 'AI feedback' });
    expect(await within(panel).findByText('Estimated band for Task 2')).toBeInTheDocument();
    expect(within(panel).getByText('6.5', { selector: '.text-\\[34px\\]' })).toBeInTheDocument();
    expect(within(panel).getByText('Coherence and cohesion')).toBeInTheDocument();
    expect(within(panel).getAllByRole('listitem').length).toBeGreaterThan(3);
    expect(within(panel).getByText('Subject–verb agreement')).toBeInTheDocument();
    expect(feedback).toHaveBeenCalledWith(
      expect.objectContaining({ task: 2, essay: SAMPLE_ESSAY, prompt: section.task2.prompt }),
    );
    // Saved with the attempt, so it's there after a reload.
    expect(store.getState().session!.feedback.task2?.overall).toBe(6.5);
    expect(screen.getByRole('button', { name: 'Hide AI feedback' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('shows a retry message when the reply is unusable, never a crash', async () => {
    const user = userEvent.setup();
    const feedback = vi
      .fn<(request: FeedbackRequest) => Promise<WritingFeedback>>()
      .mockRejectedValueOnce(
        new FeedbackError('The AI’s reply couldn’t be read. Please try again.'),
      )
      .mockImplementation(sampleFeedback);
    await renderWriting({ part: 2, feedback });
    writeEssay(SAMPLE_ESSAY);
    await user.click(screen.getByRole('button', { name: 'Get AI feedback' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The AI’s reply couldn’t be read. Please try again.');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Estimated band for Task 2')).toBeInTheDocument();
    expect(feedback).toHaveBeenCalledTimes(2);
  });

  it('turns any other failure into a message too', async () => {
    const user = userEvent.setup();
    await renderWriting({ part: 2, feedback: () => Promise.reject(new TypeError('boom')) });
    writeEssay(SAMPLE_ESSAY);
    await user.click(screen.getByRole('button', { name: 'Get AI feedback' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Feedback isn’t available right now. Please try again.',
    );
  });

  it('evaluates in Practice: submits, stays on the page and opens feedback', async () => {
    const user = userEvent.setup();
    const { store, router } = await renderWriting({ part: 2 });
    writeEssay(SAMPLE_ESSAY);
    await user.click(screen.getByRole('button', { name: 'Evaluate my essay' }));

    expect(await screen.findByText('Estimated band for Task 2')).toBeInTheDocument();
    expect(store.getState().session!.status).toBe('submitted');
    expect(router.state.location.pathname).toBe('/');
    expect(screen.getByRole('textbox', { name: 'Your answer · Task 2' })).toHaveAttribute(
      'readonly',
    );
    expect(screen.queryByRole('button', { name: 'Evaluate my essay' })).not.toBeInTheDocument();
  });

  it('locks feedback in Exam mode until the writing is submitted', async () => {
    const user = userEvent.setup();
    const { store } = await renderWriting({ mode: 'full' });
    expect(screen.getByRole('button', { name: 'Exam' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('timer')).toHaveTextContent('60:00');
    expect(screen.getByText('AI feedback unlocks after you submit')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Get AI feedback' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next task' }));
    expect(screen.getByRole('textbox', { name: 'Your answer · Task 2' })).toBeInTheDocument();
    writeEssay(SAMPLE_ESSAY);
    await user.click(screen.getByRole('button', { name: 'Submit writing' }));

    expect(await screen.findByText('Estimated band for Task 2')).toBeInTheDocument();
    expect(store.getState().session!.status).toBe('submitted');
    // Task 1 can be checked too; the panel stays open on the other task.
    await user.click(screen.getByRole('button', { name: 'Task 1' }));
    expect(
      within(screen.getByRole('complementary', { name: 'AI feedback' })).getByText(
        /Write at least 50 words for Task 1/,
      ),
    ).toBeInTheDocument();
  });

  it('clears the current task’s essay after a confirm', async () => {
    const user = userEvent.setup();
    const { store } = await renderWriting();
    writeEssay('A first draft.');
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Clear task 1?' });
    expect(dialog).toHaveTextContent('This removes your essay for task 1.');
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }));
    expect(store.getState().session!.essays.task1).toBe('');
  });

  it('asks before switching to Exam once there is an essay', async () => {
    const user = userEvent.setup();
    await renderWriting();
    writeEssay('A first draft.');
    await user.click(screen.getByRole('button', { name: 'Exam' }));
    expect(screen.getByRole('alertdialog', { name: 'Switch to Exam?' })).toBeInTheDocument();
  });

  it('keeps the essay when the page reloads', async () => {
    const world = examWorld();
    const store = world.newStore();
    await store.getState().open({ test: sample, module: 'writing', mode: 'single', part: 1 });
    store.getState().setEssay(1, 'Saved on the device.');
    act(() => world.advance(0));
    const again = world.newStore();
    const session = await again
      .getState()
      .open({ test: sample, module: 'writing', mode: 'single', part: 1 });
    expect(session.essays.task1).toBe('Saved on the device.');
  });
});
