import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import type { AttemptRecord } from '../../src/engine/session';
import { AuthContext, createAuthStore } from '../../src/lib/auth';
import { ServicesContext } from '../../src/lib/services';
import type { WritingFeedback } from '../../src/schema/attempt';
import type { Profile } from '../../src/schema/profile';
import { routes } from '../../src/routes';
import { fakeAuth, owner, OWNER_UID } from './fakeAuth';
import { fakeServices } from './fakeServices';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1);

let n = 0;
function attempt(over: Partial<AttemptRecord>): AttemptRecord {
  n += 1;
  const at = T0 + n * DAY;
  return {
    attemptId: `a${n}`,
    testId: 'book21-test1',
    module: 'reading',
    mode: 'single',
    part: 1,
    status: 'submitted',
    startedAt: at - 1000,
    updatedAt: at,
    submittedAt: at,
    timeLeftSec: 300,
    answers: {},
    flagged: [],
    revealUsed: false,
    ...over,
  };
}

const fb = (task: 1 | 2, overall: number): WritingFeedback => ({
  task,
  criteria: [
    { name: task === 1 ? 'Task achievement' : 'Task response', band: overall - 0.5, comment: 'c' },
    { name: 'Coherence and cohesion', band: overall + 0.5, comment: 'c' },
    { name: 'Lexical resource', band: overall, comment: 'c' },
    { name: 'Grammatical range and accuracy', band: overall, comment: 'c' },
  ],
  overall,
  topFixes: ['State your position early.', 'Add an example.', 'Vary your wording.'],
  corrections: [],
});

// Reading passage 1: TRUE FALSE NG TRUE NG envelope winter …; 5 of 9 right.
const READING = {
  '1': 'TRUE',
  '2': 'NOT GIVEN',
  '4': 'TRUE',
  '5': 'NOT GIVEN',
  '6': 'envelope',
  '7': 'summer',
  '8': 'x',
};

function sampleAttempts(): AttemptRecord[] {
  return [
    attempt({
      module: 'listening',
      mode: 'full',
      score: { raw: 31, total: 40, band: 7, byType: {} },
    }),
    attempt({
      module: 'reading',
      answers: READING,
      flagged: [7],
      score: { raw: 4, total: 9, band: 5, estimate: true, byType: {} },
    }),
    attempt({
      module: 'reading',
      answers: { '1': 'TRUE' },
      revealUsed: true,
      score: { raw: 9, total: 9, band: 9, estimate: true, byType: {} },
    }),
    attempt({
      module: 'writing',
      mode: 'full',
      writing: { task1: 'The graph shows', task2: 'Cities should', ai: { task2: fb(2, 6.5) } },
    }),
    attempt({
      module: 'speaking',
      mode: 'full',
      speaking: {
        selfScores: { fluency: 6, lexical: 6.5, grammar: 6, pronunciation: 6 },
        covered: ['point-1'],
        recordingKeys: ['k1', 'k2'],
      },
    }),
    attempt({
      module: 'listening',
      mode: 'single',
      status: 'in_progress',
      submittedAt: undefined,
      answers: { '1': 'Morgan', '2': 'family' },
      flagged: [3],
      timeLeftSec: 1338,
    }),
  ];
}

function renderAt(path: string, options: { attempts?: AttemptRecord[]; profile?: Profile } = {}) {
  const auth = fakeAuth();
  const authStore = createAuthStore(auth.adapter, OWNER_UID);
  const { services, world, saveProfile } = fakeServices(options);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <ServicesContext value={services}>
      <AuthContext value={authStore}>
        <RouterProvider router={router} />
      </AuthContext>
    </ServicesContext>,
  );
  act(() => auth.emit(owner));
  return { router, world, saveProfile, user: userEvent.setup() };
}

describe('Dashboard', () => {
  it('resumes the attempt in progress and shows the latest bands against the target', async () => {
    renderAt('/', { attempts: sampleAttempts(), profile: { targetBand: 7 } });
    const resume = await screen.findByRole('region', { name: 'Listening: Book 21 · Test 1' });
    expect(within(resume).getByText('Part 1 · 2 answered · 1 flagged')).toBeInTheDocument();
    expect(within(resume).getByText('22:18 left')).toBeInTheDocument();
    expect(within(resume).getByRole('link', { name: 'Resume test' })).toHaveAttribute(
      'href',
      '/test/book21-test1/listening?mode=single&part=1',
    );

    const bands = screen.getByRole('region', { name: 'Latest band by module' });
    // The revealed 9.0 Reading doesn't count: the 5.0 before it does.
    expect(within(bands).getByText('Reading').nextSibling).toHaveTextContent('5.0');
    expect(within(bands).getByText('Writing').nextSibling).toHaveTextContent('6.5');
    // (7 + 5 + 6.5 + 6) ÷ 4 = 6.125
    expect(
      within(bands).getByText(/Overall band 6\.0: 6\.125 rounds down to 6\.0/),
    ).toBeInTheDocument();

    const recent = screen.getByRole('region', { name: 'Recent attempts' });
    expect(within(recent).getAllByRole('row')).toHaveLength(6); // header + 5 newest
    expect(within(recent).getByText('Practice')).toBeInTheDocument();
  });

  it('discards an attempt after a confirm', async () => {
    const { user, world } = renderAt('/', { attempts: sampleAttempts() });
    await user.click(await screen.findByRole('button', { name: 'Discard attempt' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Discard this attempt?' })).getByRole(
        'button',
        { name: 'Discard' },
      ),
    );
    expect(await screen.findByRole('heading', { name: 'Nothing in progress' })).toBeInTheDocument();
    expect([...world.remoteData.values()].some((a) => a.status === 'in_progress')).toBe(false);
  });

  it('edits the target band and exam date', async () => {
    const { user, saveProfile } = renderAt('/');
    await user.click(await screen.findByRole('button', { name: 'Edit goals' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Target band' }), '7.5');
    await user.type(screen.getByLabelText('Exam date'), '2026-12-05');
    await user.click(screen.getByRole('button', { name: 'Save goals' }));
    expect(saveProfile).toHaveBeenCalledWith({ targetBand: 7.5, examDate: '2026-12-05' });
    expect(await screen.findByText('5 Dec 2026')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Your goals' })).not.toBeInTheDocument();
  });

  it('starts each module on the next test', async () => {
    renderAt('/');
    expect(await screen.findByRole('link', { name: 'Start Speaking' })).toHaveAttribute(
      'href',
      '/test/book21-test1/speaking?part=1',
    );
    expect(
      screen.getByText('Overall band appears once all four modules have a score.'),
    ).toBeInTheDocument();
  });
});

describe('Library', () => {
  it('shows each module’s band, Resume or Start, and filters', async () => {
    const { user } = renderAt('/library', { attempts: sampleAttempts() });
    const test = await screen.findByRole('article', { name: 'Book 21 · Test 1' });
    expect(within(test).getByText('In progress')).toBeInTheDocument();
    expect(within(test).getByRole('link', { name: 'Listening: Resume' })).toBeInTheDocument();
    expect(within(test).getByRole('link', { name: 'Reading: band 5.0' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/results\//),
    );
    expect(screen.getByRole('link', { name: /Continue/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Writing' }));
    expect(within(test).getByRole('link', { name: 'Start Writing' })).toHaveAttribute(
      'href',
      '/test/book21-test1/writing?mode=full',
    );
    await user.type(screen.getByRole('searchbox', { name: 'Search tests' }), 'book 20');
    expect(screen.getByText('No tests match your search.')).toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox', { name: 'Search tests' }));
    await user.click(screen.getByRole('button', { name: 'General Training' }));
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});

describe('History', () => {
  it('lists finished attempts newest first, by module', async () => {
    const { user } = renderAt('/history', { attempts: sampleAttempts() });
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent('Speaking');
    await user.click(screen.getByRole('button', { name: 'Reading 2' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
  });
});

describe('Band breakdown', () => {
  const four = () => [
    ...sampleAttempts(),
    attempt({
      module: 'reading',
      mode: 'full',
      score: { raw: 31, total: 40, band: 7, byType: {} },
    }),
  ];

  it('shows the overall band with its rounding and the route to target', async () => {
    renderAt('/bands', { attempts: four(), profile: { targetBand: 7 } });
    const overall = await screen.findByRole('region', { name: 'Overall band' });
    expect(within(overall).getByText('(7.0 + 7.0 + 6.5 + 6.0) ÷ 4 = 6.625')).toBeInTheDocument();
    expect(within(overall).getByText('6.625 rounds down to 6.5')).toBeInTheDocument();
    expect(within(overall).getByText('0.5 below target')).toBeInTheDocument();

    const route = screen.getByRole('region', { name: 'Fastest route to 7.0' });
    expect(within(route).getByText('Speaking 6.0 → 6.5')).toBeInTheDocument();
    expect(within(route).getByText('Writing 6.5 → 7.0')).toBeInTheDocument();
    expect(within(route).getByText(/Listening and Reading at or above 7\.0/)).toBeInTheDocument();
  });

  it('works out what-if bands as you step them', async () => {
    const { user } = renderAt('/bands', { attempts: four() });
    const whatIf = await screen.findByRole('region', { name: 'What if?' });
    expect(within(whatIf).getByRole('button', { name: 'Reset to my scores' })).toBeDisabled();
    await user.click(within(whatIf).getByRole('button', { name: 'Raise Speaking by half a band' }));
    expect(within(whatIf).getByText('(7.0 + 7.0 + 6.5 + 6.5) ÷ 4 = 6.75')).toBeInTheDocument();
    expect(within(whatIf).getByText('6.75 rounds up to 7.0.')).toBeInTheDocument();
    expect(within(whatIf).getByText('Target 7.0 reached')).toBeInTheDocument();
    expect(within(whatIf).getByText('Your score: 6.0')).toBeInTheDocument();
    await user.click(within(whatIf).getByRole('button', { name: 'Reset to my scores' }));
    expect(within(whatIf).getByText('6.625 rounds down to 6.5.')).toBeInTheDocument();
  });

  it('waits for all four modules before an overall band', async () => {
    renderAt('/bands', { attempts: [] });
    expect(
      await screen.findByText(/Appears once all four modules have a score/),
    ).toBeInTheDocument();
  });
});

describe('Results', () => {
  it('shows a Reading band, where it landed and every answer with where it is', async () => {
    const attempts = sampleAttempts();
    const { user } = renderAt(`/results/${attempts[1]!.attemptId}`, { attempts });
    expect(
      await screen.findByRole('heading', { name: 'Green Building Trends' }),
    ).toBeInTheDocument();
    const band = screen.getByRole('region', { name: 'Band score' });
    expect(within(band).getByText('5.0')).toBeInTheDocument();
    expect(within(band).getByText('2.0 below target 7.0')).toBeInTheDocument();
    expect(screen.getByText(/more correct answer/)).toBeInTheDocument();
    const review = screen.getByRole('table');
    expect(
      within(review).getByText('Paragraph A: “cutting energy bills after the oil crisis”'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Flagged 1' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
  });

  it('shows Writing feedback by task', async () => {
    const attempts = sampleAttempts();
    renderAt(`/results/${attempts[3]!.attemptId}`, { attempts });
    const band = await screen.findByRole('region', { name: 'Band score' });
    expect(within(band).getByText('Writing band (estimate)')).toBeInTheDocument();
    expect(within(band).getByText('AI estimate · Task 2 only')).toBeInTheDocument();
    expect(screen.getByText('Estimated band for Task 2')).toBeInTheDocument();
    expect(screen.getByText(/No AI feedback for this task/)).toBeInTheDocument();
  });

  it('shows Speaking self-scores and notes takes recorded elsewhere', async () => {
    const attempts = sampleAttempts();
    renderAt(`/results/${attempts[4]!.attemptId}`, { attempts });
    const band = await screen.findByRole('region', { name: 'Band score' });
    expect(within(band).getByText('6.0')).toBeInTheDocument();
    expect(await screen.findByText(/2 takes were recorded on another device/)).toBeInTheDocument();
  });
});
