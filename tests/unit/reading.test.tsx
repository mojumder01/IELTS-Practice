import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it, vi } from 'vitest';
import { ExamShell } from '../../src/components/exam/ExamShell';
import { ReadingContent } from '../../src/components/reading/ReadingContent';
import type { ReadingSection } from '../../src/schema/test';
import { ExamStoreContext } from '../../src/store/examContext';
import { examWorld, sample } from './examHarness';

function readingSection(): ReadingSection {
  const s = sample.sections['reading-1'];
  if (s?.kind !== 'reading') throw new Error('sample has no reading-1');
  return s;
}
const section = readingSection();

async function renderReading() {
  const world = examWorld();
  const store = world.newStore();
  await store.getState().open({ test: sample, module: 'reading', mode: 'single', part: 1 });
  const router = createMemoryRouter([
    {
      path: '*',
      element: (
        <ExamStoreContext value={store}>
          <ExamShell>
            <ReadingContent section={section} />
          </ExamShell>
        </ExamStoreContext>
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
  return { store, user: userEvent.setup() };
}

describe('Reading', () => {
  it('shows the passage with its lettered paragraphs', async () => {
    await renderReading();
    expect(screen.getByRole('heading', { name: 'Green Building Trends' })).toBeInTheDocument();
    const passage = screen.getByRole('article');
    for (const label of ['A', 'B', 'C', 'D', 'E'])
      expect(within(passage).getByText(label)).toBeInTheDocument();
  });

  it('answers TRUE / FALSE / NOT GIVEN with pressed buttons, and toggles them off', async () => {
    const { store, user } = await renderReading();
    const trueButton = screen.getByRole('button', { name: 'Question 2: TRUE' });
    await user.click(trueButton);
    expect(trueButton).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Question 2: FALSE' }));
    expect(store.getState().session!.answers['2']).toBe('FALSE');
    await user.click(screen.getByRole('button', { name: 'Question 2: FALSE' }));
    expect(store.getState().session!.answers['2']).toBeUndefined();
  });

  it('fills the summary gaps and warns past the word limit', async () => {
    const { store, user } = await renderReading();
    const gap = screen.getByRole('textbox', { name: 'Question 6' });
    await user.type(gap, 'building envelope');
    expect(store.getState().session!.answers['6']).toBe('building envelope');
    expect(screen.getByText('Too many words: ONE WORD ONLY')).toBeInTheDocument();
    expect(gap).toHaveAttribute('aria-invalid', 'true');
    await user.clear(gap);
    await user.type(gap, 'envelope');
    expect(screen.queryByText(/Too many words/)).not.toBeInTheDocument();
  });

  it('reveals one answer with its verdict and location, and highlights it in the passage', async () => {
    const { store, user } = await renderReading();
    await user.click(screen.getByRole('button', { name: 'Question 1: FALSE' }));
    await user.click(screen.getByRole('button', { name: 'Show answer for question 1' }));
    expect(screen.getByText('You wrote FALSE')).toBeInTheDocument();
    expect(screen.getByText('Paragraph A, highlighted', { exact: false })).toBeInTheDocument();
    const mark = within(screen.getByRole('article')).getByText(
      'cutting energy bills after the oil crisis',
    );
    expect(mark.tagName).toBe('MARK');
    expect(store.getState().session!.revealUsed).toBe(true);
  });

  it('says NOT GIVEN answers have nothing to highlight', async () => {
    const { user } = await renderReading();
    await user.click(screen.getByRole('button', { name: 'Show answer for question 3' }));
    expect(
      screen.getByText('No matching text in the passage', { exact: false }),
    ).toBeInTheDocument();
  });

  it('reveals a gap group from its own button, marking right and wrong in words', async () => {
    const { user } = await renderReading();
    await user.type(screen.getByRole('textbox', { name: 'Question 6' }), 'envelope');
    await user.type(screen.getByRole('textbox', { name: 'Question 7' }), 'summer');
    await user.click(screen.getByRole('button', { name: 'Show answers for questions 6–9' }));
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('You wrote summer')).toBeInTheDocument();
    expect(screen.getAllByText('Not answered')).toHaveLength(2);
    expect(within(screen.getByRole('article')).getAllByRole('mark').length).toBeGreaterThan(0);
  });

  it('flags gap questions from the summary', async () => {
    const { store, user } = await renderReading();
    await user.click(screen.getByRole('button', { name: 'Flag question 8 for review' }));
    expect(store.getState().session!.flagged).toEqual([8]);
    expect(
      screen.getByRole('button', { name: 'Question 8, unanswered, flagged, current' }),
    ).toBeInTheDocument();
  });

  it('changes the passage text size and remembers it', async () => {
    const { user } = await renderReading();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    await user.click(screen.getByRole('button', { name: 'Larger text' }));
    expect(setItem).toHaveBeenCalledWith('ielts:textSize', '20');
    await user.click(screen.getByRole('button', { name: 'Larger text' }));
    expect(screen.getByRole('button', { name: 'Larger text' })).toBeDisabled();
  });
});
