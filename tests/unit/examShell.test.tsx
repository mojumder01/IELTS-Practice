import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { ExamShell } from '../../src/components/exam/ExamShell';
import { QuestionsPlaceholder } from '../../src/components/exam/QuestionsPlaceholder';
import type { Module } from '../../src/schema/test';
import { ExamStoreContext, useExam } from '../../src/store/examContext';
import { examWorld, sample } from './examHarness';

function Content() {
  const session = useExam((s) => s.session)!;
  const answer = useExam((s) => s.answer);
  const toggleFlag = useExam((s) => s.toggleFlag);
  const goTo = useExam((s) => s.goTo);
  const section = sample.sections[`${session.module}-1` as 'reading-1'];
  if (section?.kind !== 'reading' && section?.kind !== 'listening') return null;
  return (
    <QuestionsPlaceholder
      section={section}
      answers={session.answers}
      flagged={session.flagged}
      onAnswer={answer}
      onFlag={toggleFlag}
      onFocusQuestion={goTo}
    />
  );
}

async function renderShell(module: Module = 'reading', mode: 'single' | 'full' = 'single') {
  const world = examWorld();
  const store = world.newStore();
  await store.getState().open({ test: sample, module, mode, part: 1 });
  const router = createMemoryRouter([
    {
      path: '*',
      element: (
        <ExamStoreContext value={store}>
          <ExamShell>
            <Content />
          </ExamShell>
        </ExamStoreContext>
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
  const tick = (ms: number) =>
    act(() => {
      world.advance(ms);
      store.getState().tick();
    });
  return { world, store, router, tick };
}

describe('exam shell', () => {
  it('shows the test, the countdown and a cell per question', async () => {
    await renderShell();
    expect(screen.getByText('Book 21 · Test 1 · Reading')).toBeInTheDocument();
    expect(screen.getByText('Passage 1 of 1')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('20:00');
    expect(screen.getByText('0 / 9 answered')).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Passage 1' })).getAllByRole('button'),
    ).toHaveLength(9);
    expect(
      screen.getByText(
        'Spend about 20 minutes on Questions 1–9, which are based on the passage below.',
      ),
    ).toBeInTheDocument();
  });

  it('counts down and turns the timer red at 5:00', async () => {
    const { tick } = await renderShell();
    tick(61_000);
    expect(screen.getByRole('timer')).toHaveTextContent('18:59');
    expect(screen.getByRole('timer').parentElement).not.toHaveClass('bg-red');
    tick(14 * 60_000);
    expect(screen.getByRole('timer')).toHaveTextContent('04:59');
    expect(screen.getByRole('timer').parentElement).toHaveClass('bg-red');
  });

  it('shows answered, flagged and current in the grid in words as well as colour', async () => {
    const user = userEvent.setup();
    await renderShell();
    await user.type(screen.getByRole('textbox', { name: 'Question 6' }), 'envelope');
    await user.click(screen.getByRole('button', { name: 'Flag question 6 for review' }));
    expect(
      screen.getByRole('button', { name: 'Question 6, answered, flagged, current' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 / 9 answered')).toBeInTheDocument();
    expect(screen.getByText(/Autosaved at \d\d:\d\d:\d\d/)).toBeInTheDocument();
  });

  it('pauses behind an overlay and resumes', async () => {
    const user = userEvent.setup();
    const { store } = await renderShell();
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('dialog', { name: 'Test paused' })).toHaveTextContent(
      'The timer has stopped at 20:00',
    );
    expect(store.getState().session!.paused).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Resume test' }));
    expect(screen.queryByRole('dialog', { name: 'Test paused' })).not.toBeInTheDocument();
  });

  it('offers no pause in a full mock Listening', async () => {
    await renderShell('listening', 'full');
    expect(screen.getByRole('timer')).toHaveTextContent('32:00');
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
  });

  it('asks before switching mode once an answer is filled', async () => {
    const user = userEvent.setup();
    const { store } = await renderShell();
    await user.type(screen.getByRole('textbox', { name: 'Question 1' }), 'TRUE');
    await user.click(screen.getByRole('button', { name: 'Full mock' }));
    expect(screen.getByRole('alertdialog', { name: 'Switch to Full mock?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(store.getState().session).toMatchObject({ mode: 'single', answers: { '1': 'TRUE' } });

    await user.click(screen.getByRole('button', { name: 'Full mock' }));
    await user.click(screen.getByRole('button', { name: 'Switch and restart' }));
    expect(store.getState().session).toMatchObject({ mode: 'full', answers: {} });
    expect(screen.getByRole('button', { name: 'Full mock' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('timer')).toHaveTextContent('60:00');
  });

  it('switches mode straight away when nothing is answered', async () => {
    const user = userEvent.setup();
    const { store } = await renderShell();
    await user.click(screen.getByRole('button', { name: 'Full mock' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(store.getState().session!.mode).toBe('full');
  });

  it('clears the part after a confirm', async () => {
    const user = userEvent.setup();
    const { store } = await renderShell();
    await user.type(screen.getByRole('textbox', { name: 'Question 1' }), 'TRUE');
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Clear' }),
    );
    expect(store.getState().session!.answers).toEqual({});
  });

  it('shows the reveal banner and keeps the attempt out of band history', async () => {
    const user = userEvent.setup();
    const { store } = await renderShell();
    await user.click(screen.getByRole('button', { name: 'Show answers in the passage' }));
    expect(
      screen.getByText(/This attempt won’t count toward your band history/),
    ).toBeInTheDocument();
    expect(store.getState().session!.revealUsed).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Hide answers' }));
    expect(screen.queryByText(/won’t count toward your band history/)).not.toBeInTheDocument();
  });

  it('has no reveal in a full mock', async () => {
    await renderShell('reading', 'full');
    expect(
      screen.queryByRole('button', { name: 'Show answers in the passage' }),
    ).not.toBeInTheDocument();
  });

  it('evaluates in single-part mode and moves on in a full mock', async () => {
    const user = userEvent.setup();
    const { store } = await renderShell();
    await user.click(screen.getByRole('button', { name: 'Evaluate my Reading' }));
    expect(store.getState().session!.status).toBe('submitted');
    expect(screen.getByText('Your Reading answers are submitted')).toBeInTheDocument();
  });

  it('ends a full mock module with Next: <module>', async () => {
    const user = userEvent.setup();
    const { router, store } = await renderShell('reading', 'full');
    await user.click(screen.getByRole('button', { name: 'Next: Writing' }));
    expect(store.getState().session!.status).toBe('submitted');
    expect(router.state.location.pathname).toBe('/test/book21-test1/writing');
  });

  it('links the neighbouring modules', async () => {
    await renderShell('reading');
    expect(screen.getByRole('link', { name: 'Listening' })).toHaveAttribute(
      'href',
      '/test/book21-test1/listening?mode=single&part=1',
    );
    expect(screen.getByRole('link', { name: 'Writing' })).toHaveAttribute(
      'href',
      '/test/book21-test1/writing?mode=single&part=1',
    );
  });

  it('keeps notes with the attempt', async () => {
    const user = userEvent.setup();
    const { store } = await renderShell();
    await user.click(screen.getByRole('button', { name: 'Notes' }));
    await user.type(screen.getByRole('textbox', { name: 'Notes' }), 'B2 envelope');
    expect(store.getState().session!.notes).toBe('B2 envelope');
  });
});
