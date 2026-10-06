import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import seedJson from '../../content/vocab/seed.json';
import { SaveWordDialog } from '../../src/components/vocab/SaveWordDialog';
import { AuthContext, createAuthStore } from '../../src/lib/auth';
import { ServicesContext } from '../../src/lib/services';
import { VocabSeedSchema } from '../../src/schema/vocab';
import { routes } from '../../src/routes';
import { fakeAuth, owner, OWNER_UID } from './fakeAuth';
import { fakeServices } from './fakeServices';

const seed = VocabSeedSchema.parse(seedJson);
// 6 of the 11 starter words are due on 6 October.
const NOW = new Date(2026, 9, 6, 9, 0).getTime();

function renderVocabulary() {
  const auth = fakeAuth();
  const authStore = createAuthStore(auth.adapter, OWNER_UID);
  const fake = fakeServices({ vocab: seed, over: { now: () => NOW } });
  const router = createMemoryRouter(routes, { initialEntries: ['/vocabulary'] });
  render(
    <ServicesContext value={fake.services}>
      <AuthContext value={authStore}>
        <RouterProvider router={router} />
      </AuthContext>
    </ServicesContext>,
  );
  act(() => auth.emit(owner));
  return { ...fake, user: userEvent.setup() };
}

const tile = (label: string) => screen.getByText(label, { selector: 'dt' }).nextSibling;

describe('Vocabulary', () => {
  it('counts words by status and due today', async () => {
    renderVocabulary();
    expect(await screen.findByRole('heading', { name: 'Vocabulary' })).toBeInTheDocument();
    expect(tile('Saved')).toHaveTextContent('11');
    expect(tile('Mastered')).toHaveTextContent('5');
    expect(tile('Learning')).toHaveTextContent('3');
    expect(tile('New')).toHaveTextContent('3');
    expect(tile('Due today')).toHaveTextContent('6');
    expect(screen.getByRole('link', { name: 'Review 6 due words' })).toBeInTheDocument();
  });

  it('filters by topic, status and search, Bangla included', async () => {
    const { user } = renderVocabulary();
    const list = await screen.findByRole('list', { name: 'Words' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(11);
    await user.click(screen.getByRole('button', { name: 'Environment' }));
    expect(screen.getByText('Showing 3 words in Environment')).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('group', { name: 'Status' })).getByRole('button', { name: 'New' }),
    );
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('embodied')).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('group', { name: 'Topic' })).getByRole('button', { name: 'All' }),
    );
    await user.click(
      within(screen.getByRole('group', { name: 'Status' })).getByRole('button', { name: 'All' }),
    );
    await user.type(screen.getByRole('searchbox', { name: 'Search words' }), 'যানজট');
    expect(within(list).getByText('congestion')).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('opens a word and marks it mastered', async () => {
    const { user, saveWord } = renderVocabulary();
    await user.click(await screen.findByRole('button', { name: 'Show example for embodied' }));
    expect(screen.getByText('Steel carries a high embodied carbon cost.')).toBeInTheDocument();
    expect(screen.getByText(/Environment · Saved from Book 21 · Test 1/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark as mastered' }));
    const last = saveWord.mock.lastCall?.[0];
    expect(last).toMatchObject({
      word: 'embodied',
      status: 'mastered',
      srs: { due: '2026-10-27' },
    });
    expect(screen.getByRole('button', { name: 'Move back to learning' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('reviews due words only, and Got it / Again reschedule them', async () => {
    const { user, saveWord } = renderVocabulary();
    const review = await screen.findByRole('region', { name: 'Daily review' });
    expect(within(review).getByText('1 of 6')).toBeInTheDocument();
    const due = [
      'embodied',
      'infrastructure',
      'mitigate',
      'obsolete',
      'remuneration',
      'vocational',
    ];
    const seen: string[] = [];
    for (let i = 0; i < due.length; i++) {
      const word = due.find((w) => within(review).queryByText(w, { selector: 'span' }));
      expect(word).toBeDefined();
      seen.push(word!);
      await user.click(within(review).getByRole('button', { name: 'Show meaning' }));
      await user.click(
        within(review).getByRole('button', { name: i % 2 === 0 ? 'Got it' : 'Again' }),
      );
    }
    // Mastered words (due on the 27th) never came up.
    expect(seen.sort()).toEqual(due);
    expect(within(review).getByText('Review done for today')).toBeInTheDocument();
    expect(within(review).getByText('3 remembered · 3 to repeat tomorrow')).toBeInTheDocument();
    expect(tile('Due today')).toHaveTextContent('0');

    const saved = new Map(saveWord.mock.calls.map(([w]) => [w.word, w]));
    expect(saved.size).toBe(6);
    seen.forEach((word, i) => {
      const w = saved.get(word)!;
      if (i % 2 === 0) {
        // Got it: on to the next interval (1 day for a new word, 6 after the first review).
        expect(w.srs.reps).toBe(seed.find((x) => x.word === word)!.srs.reps + 1);
        expect(w.srs.due > '2026-10-06').toBe(true);
      } else {
        expect(w.srs).toMatchObject({ due: '2026-10-07', intervalDays: 1, reps: 0 });
        expect(w.status).toBe('learning');
      }
    });
  });

  it('adds a word by hand, due for review today', async () => {
    const { user, saveWord } = renderVocabulary();
    await user.click(await screen.findByRole('button', { name: 'Add word' }));
    const form = screen.getByRole('form', { name: 'Word details' });
    await user.type(within(form).getByLabelText('Word'), 'resilient');
    await user.click(within(form).getByRole('button', { name: 'Save word' }));
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'A word needs its meaning and a topic.',
    );
    await user.type(within(form).getByLabelText('Meaning'), 'able to recover quickly');
    await user.type(within(form).getByLabelText(/Bangla/), 'সহনশীল');
    await user.click(within(form).getByRole('button', { name: 'Save word' }));
    expect(saveWord).toHaveBeenCalledWith(
      expect.objectContaining({
        word: 'resilient',
        bangla: 'সহনশীল',
        topic: 'General',
        source: 'manual',
        status: 'new',
        srs: { due: '2026-10-06', intervalDays: 0, ease: 2.5, reps: 0 },
      }),
    );
    expect(tile('Due today')).toHaveTextContent('7');
  });
});

describe('Saving a word from a passage', () => {
  it('saves it with its sentence and the test it came from', async () => {
    const auth = fakeAuth();
    const authStore = createAuthStore(auth.adapter, OWNER_UID);
    const fake = fakeServices({ vocab: seed, over: { now: () => NOW } });
    let closed = false;
    render(
      <ServicesContext value={fake.services}>
        <AuthContext value={authStore}>
          <SaveWordDialog
            word="envelope"
            sentence="Designers concentrate first on the building envelope."
            testId="book21-test1"
            onClose={() => (closed = true)}
          />
        </AuthContext>
      </ServicesContext>,
    );
    act(() => auth.emit(owner));
    const user = userEvent.setup();
    const dialog = screen.getByRole('dialog', { name: 'Save “envelope” to vocabulary' });
    expect(within(dialog).getByLabelText('Meaning')).toHaveFocus();
    await user.type(within(dialog).getByLabelText('Meaning'), 'the outer shell of a building');
    await user.click(within(dialog).getByRole('button', { name: 'Save word' }));
    expect(
      await within(dialog).findByText(/is saved\. It’s due for review today\./),
    ).toBeInTheDocument();
    expect(fake.saveWord).toHaveBeenCalledWith(
      expect.objectContaining({
        word: 'envelope',
        example: 'Designers concentrate first on the building envelope.',
        source: { testId: 'book21-test1' },
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Back to the test' }));
    expect(closed).toBe(true);
  });
});
