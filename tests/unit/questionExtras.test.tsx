import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { ExamShell } from '../../src/components/exam/ExamShell';
import { ReadingContent } from '../../src/components/reading/ReadingContent';
import type { ReadingSection, TestFile } from '../../src/schema/test';
import { ExamStoreContext } from '../../src/store/examContext';
import { examWorld, sample } from './examHarness';

/** The sample with its summary group turned into "choose from the box" with a diagram. */
function withBoxAndDiagram(): { test: TestFile; section: ReadingSection } {
  const test = structuredClone(sample);
  const section = test.sections['reading-1'];
  if (section?.kind !== 'reading') throw new Error('sample has no reading-1');
  const group = section.groups.find((g) => g.layout)!;
  group.options = [
    { key: 'A', text: 'the building envelope' },
    { key: 'B', text: 'winter warmth' },
    { key: 'C', text: 'summer shade' },
  ];
  group.image = '/media/img/b21t1-w1.2e4b8323.png';
  group.imageDescription = 'A cross-section of a house showing where heat escapes.';
  group.questions.forEach((q) => (q.acceptedAnswers = q.numbers.map(() => ['A'])));
  return { test, section };
}

async function renderReading() {
  const { test, section } = withBoxAndDiagram();
  const store = examWorld().newStore();
  await store.getState().open({ test, module: 'reading', mode: 'single', part: 1 });
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
  return { store, section, user: userEvent.setup() };
}

describe('Question groups with a box of options and a diagram', () => {
  it('shows the diagram with its description and the box of options', async () => {
    const { section } = await renderReading();
    const group = section.groups.find((g) => g.layout)!;
    const first = group.questions[0]!.numbers[0]!;
    const region = screen.getByRole('heading', { name: new RegExp(`Questions ${first}`) })
      .parentElement!.parentElement!.parentElement!;
    expect(
      within(region).getByRole('img', {
        name: 'A cross-section of a house showing where heat escapes.',
      }),
    ).toBeInTheDocument();
    expect(within(region).getByText('summer shade')).toBeInTheDocument();
  });

  it('answers each gap from a drop-down of the box’s letters', async () => {
    const { store, section, user } = await renderReading();
    const n = section.groups.find((g) => g.layout)!.questions[0]!.numbers[0]!;
    const gap = screen.getByRole('combobox', { name: `Question ${n}` });
    expect(
      within(gap)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['–', 'A', 'B', 'C']);
    await user.selectOptions(gap, 'B');
    expect(store.getState().session!.answers[String(n)]).toBe('B');
  });
});
