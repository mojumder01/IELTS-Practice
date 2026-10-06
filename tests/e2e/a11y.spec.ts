import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { clearAttempts, signInAsOwner } from './emulators';

// Lighthouse's accessibility score is axe underneath: no serious or critical WCAG 2.1 AA
// violation on any page, in either theme, keeps it in the high 90s.

const PAGES: { name: string; path: string; ready: (page: Page) => Promise<void> }[] = [
  {
    name: 'Dashboard',
    path: '/',
    ready: (p) => p.getByRole('heading', { name: /Welcome back/ }).waitFor(),
  },
  {
    name: 'Library',
    path: '/library',
    ready: (p) => p.getByRole('heading', { name: 'Test library' }).waitFor(),
  },
  {
    name: 'Vocabulary',
    path: '/vocabulary',
    ready: (p) => p.getByRole('heading', { name: 'Vocabulary' }).waitFor(),
  },
  {
    name: 'Bands',
    path: '/bands',
    ready: (p) => p.getByRole('heading', { name: 'Band breakdown' }).waitFor(),
  },
  {
    name: 'History',
    path: '/history',
    ready: (p) => p.getByRole('heading', { name: 'History' }).waitFor(),
  },
  {
    name: 'Reading',
    path: '/test/book21-test1/reading?mode=single&part=1',
    ready: (p) => p.getByRole('heading', { name: 'Green Building Trends' }).waitFor(),
  },
  {
    name: 'Listening',
    path: '/test/book21-test1/listening?mode=single&part=1',
    ready: (p) => p.getByRole('textbox', { name: 'Question 1', exact: true }).waitFor(),
  },
  {
    name: 'Writing',
    path: '/test/book21-test1/writing?mode=single&part=1',
    ready: (p) => p.getByRole('textbox', { name: /Your answer/ }).waitFor(),
  },
  {
    name: 'Speaking',
    path: '/test/book21-test1/speaking?part=2',
    ready: (p) =>
      p.getByText('Describe a public place in your city that you enjoy visiting.').waitFor(),
  },
  {
    name: 'Admin',
    path: '/admin',
    ready: (p) => p.getByRole('heading', { name: 'Tests', exact: true }).waitFor(),
  },
  {
    name: 'Admin reading',
    path: '/admin/tests/book21-test1/reading',
    ready: (p) => p.getByRole('heading', { name: 'Book 21 · Test 1' }).waitFor(),
  },
];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }, info) => {
      test.skip(theme === 'dark' && info.project.name === 'phone', 'dark theme checked on desktop');
      await page.addInitScript((t) => localStorage.setItem('ielts:theme', t), theme);
      await clearAttempts();
      await signInAsOwner(page);
    });

    for (const p of PAGES) {
      test(`${p.name} has no serious accessibility problems`, async ({ page }) => {
        await page.goto(p.path);
        await p.ready(page);
        await page.waitForTimeout(300); // let fonts and late styles settle for contrast checks
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        const serious = results.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => ({
            rule: v.id,
            help: v.help,
            nodes: v.nodes
              .slice(0, 3)
              .map((n) => `${n.target.join(' ')} — ${n.failureSummary ?? ''}`),
          }));
        expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
      });
    }
  });
}
