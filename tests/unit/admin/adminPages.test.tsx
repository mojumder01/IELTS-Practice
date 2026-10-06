import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { blankTest } from '../../../src/admin/draft';
import { AuthContext, createAuthStore } from '../../../src/lib/auth';
import { ServicesContext } from '../../../src/lib/services';
import { routes } from '../../../src/routes';
import type { TestFile } from '../../../src/schema/test';
import { sample } from '../examHarness';
import { fakeAuth, owner, OWNER_UID } from '../fakeAuth';
import { fakeServices } from '../fakeServices';

function renderAdmin(path: string, drafts: TestFile[] = []) {
  const auth = fakeAuth();
  const authStore = createAuthStore(auth.adapter, OWNER_UID);
  const fake = fakeServices();
  for (const d of drafts) fake.drafts.set(d.meta.testId, structuredClone(d));
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <ServicesContext value={fake.services}>
      <AuthContext value={authStore}>
        <RouterProvider router={router} />
      </AuthContext>
    </ServicesContext>,
  );
  act(() => auth.emit(owner));
  return { ...fake, router, user: userEvent.setup() };
}

describe('Admin home', () => {
  it('lists tests and creates a new draft', async () => {
    const { user, saveDraft, router } = renderAdmin('/admin');
    const list = await screen.findByRole('region', { name: 'All tests' });
    expect(await within(list).findByRole('link', { name: 'Book 21 · Test 1' })).toBeInTheDocument();
    expect(within(list).getByText('Live')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Book or collection'), 'Book 22');
    expect(screen.getByText('Test ID: book22-test1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create test' }));
    expect(saveDraft.mock.lastCall?.[0].meta.testId).toBe('book22-test1');
    expect(router.state.location.pathname).toBe('/admin/tests/book22-test1/settings');
  });

  it('refuses a test that already exists', async () => {
    const { user } = renderAdmin('/admin');
    await screen.findByRole('link', { name: 'Book 21 · Test 1' });
    await user.type(screen.getByLabelText('Book or collection'), 'Book 21');
    await user.click(screen.getByRole('button', { name: 'Create test' }));
    expect(screen.getByRole('alert')).toHaveTextContent('book21-test1 already exists.');
  });
});

describe('Admin test page', () => {
  it('opens the live test, passes every check and publishes', async () => {
    const { user, publish } = renderAdmin('/admin/tests/book21-test1/settings');
    expect(await screen.findByRole('heading', { name: 'Book 21 · Test 1' })).toBeInTheDocument();
    const checks = await screen.findByRole('region', { name: 'Before publishing' });
    expect(within(checks).getByText('Every check passes: ready to publish.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Publish test' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Publish the changes?' })).getByRole(
        'button',
        {
          name: 'Publish',
        },
      ),
    );
    expect(await screen.findByText('Published. It’s live in the library.')).toBeInTheDocument();
    expect(publish.mock.lastCall?.[0].meta.testId).toBe('book21-test1');
  });

  it('keeps Publish locked while the schema fails, and shows why', async () => {
    renderAdmin('/admin/tests/book22-test1/reading', [blankTest('Book 22', 1, 'academic')]);
    await screen.findByRole('heading', { name: 'Book 22 · Test 1' });
    // An empty test has nothing wrong yet but nothing to publish either: add a passage.
    await userEvent.click(screen.getByRole('button', { name: 'Add passage 1' }));
    const checks = screen.getByRole('region', { name: 'Before publishing' });
    expect(within(checks).getByText(/Fails:/)).toBeInTheDocument();
    expect(within(checks).getAllByText(/Not checked yet:/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Publish test' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Preview as student' })).toBeDisabled();
  });

  it('edits settings and shows them in the live JSON', async () => {
    const { user, saveDraft } = renderAdmin('/admin/tests/book22-test1/settings', [
      blankTest('Book 22', 1, 'academic'),
    ]);
    const minutes = await screen.findByRole('textbox', { name: 'Reading full mock minutes' });
    await user.clear(minutes);
    await user.type(minutes, '55');
    expect(screen.getByRole('region', { name: 'Settings JSON' })).toHaveTextContent(
      '"fullMockMin": 55',
    );
    await user.click(screen.getByRole('checkbox', { name: 'Show answers in Single part' }));
    expect(screen.getByRole('checkbox', { name: 'Show answers in Single part' })).not.toBeChecked();
    await screen.findByText(/autosaved/, {}, { timeout: 3000 });
    expect(saveDraft.mock.lastCall?.[0].meta.studentHelp.allowReveal).toBe(false);
    expect(saveDraft.mock.lastCall?.[0].meta.timing.reading.fullMockMin).toBe(55);
  });

  it('builds a Listening script from pasted text and marks answers on it', async () => {
    const { user } = renderAdmin('/admin/tests/book22-test1/listening', [
      blankTest('Book 22', 1, 'academic'),
    ]);
    await user.click(await screen.findByRole('button', { name: 'Add part 1' }));
    const length = screen.getByLabelText('Length (s)');
    await user.clear(length);
    await user.type(length, '120');
    await user.click(screen.getByRole('button', { name: 'Paste full script' }));
    await user.type(
      screen.getByLabelText(/One line each/),
      '0:00 Receptionist: Good morning.{enter}0:05 Daniel: My name is Morgan.{enter}0:03 Receptionist: Thanks.',
    );
    await user.click(screen.getByRole('button', { name: 'Replace the script' }));
    expect(screen.getByRole('textbox', { name: 'Line 2 text' })).toHaveValue('My name is Morgan.');
    expect(screen.getByRole('textbox', { name: 'Line 3 start time' })).toHaveValue('0:03');
    expect(screen.getByText('Time out of order')).toBeInTheDocument();

    // A gap question, answered on line 2.
    await user.selectOptions(screen.getByLabelText('New group type'), 'GAP_FILL');
    await user.clear(screen.getByLabelText('Questions', { selector: 'input' }));
    await user.type(screen.getByLabelText('Questions', { selector: 'input' }), '1');
    await user.click(screen.getByRole('button', { name: 'Add group' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Question 1 accepted answers' }),
      'Morgan / morgan',
    );
    expect(screen.getByRole('textbox', { name: 'Question 1 accepted answers' })).toHaveValue(
      'Morgan / morgan',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Line 2 answers question' }),
      '1',
    );
    await user.type(screen.getByRole('textbox', { name: 'Line 2 words to highlight' }), 'Morgan');
    const json = screen.getByRole('region', { name: 'Listening JSON' });
    expect(json).toHaveTextContent('"question": 1');
    expect(json).toHaveTextContent(/\[\s*"Morgan",\s*"morgan"\s*\]/); // pretty-printed array
  });

  it('links a Reading answer to its sentence', async () => {
    const { user } = renderAdmin('/admin/tests/book21-test1/reading');
    await user.click(await screen.findByRole('button', { name: 'Link answers' }));
    await user.selectOptions(screen.getByLabelText('Linking answer for'), '1');
    const linked = screen.getByRole('button', {
      name: /Paragraph A, sentence 2: .*Linked to question 1/,
    });
    expect(linked).toHaveAttribute('aria-pressed', 'true');
    // Click again to unlink: question 1 now needs a location.
    await user.click(linked);
    expect(screen.getAllByText('Needs a location').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Publish test' })).toBeDisabled();
  });
});

describe('Preview as student', () => {
  it('opens the draft without saving the attempt anywhere', async () => {
    const draft = structuredClone(sample);
    const { router, world } = renderAdmin(
      '/test/book21-test1/reading?mode=single&part=1&preview=draft',
      [draft],
    );
    expect(
      await screen.findByText('Preview of the draft: nothing you do here is saved.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Green Building Trends' })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Question 6' }), 'envelope');
    expect(world.remote.save).not.toHaveBeenCalled();
    expect(world.localData.size).toBe(0);
    expect(router.state.location.search).toContain('preview=draft');
  });
});
