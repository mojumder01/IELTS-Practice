import { expect, test } from '@playwright/test';
import { clearAttempts, signInAsOwner } from './emulators';

test.beforeEach(async ({ page }) => {
  await clearAttempts();
  await signInAsOwner(page);
});

test('a finished test shows on the dashboard, history, bands and library', async ({
  page,
}, info) => {
  const phone = info.project.name === 'phone';
  // Finish a Reading passage without revealing anything: it counts toward bands.
  await page.goto('/test/book21-test1/reading?mode=single&part=1');
  if (phone) await page.getByRole('button', { name: /^Questions \d/ }).click();
  await page.getByRole('button', { name: 'Question 1: TRUE' }).click();
  await page.getByRole('textbox', { name: 'Question 6' }).fill('envelope');
  await page.getByRole('button', { name: phone ? 'Submit' : 'Evaluate my Reading' }).click();
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.getByRole('heading', { name: 'Green Building Trends' })).toBeVisible();

  await page.getByRole('link', { name: 'Back to dashboard' }).click();
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  const bands = page.getByRole('region', { name: 'Latest band by module' });
  await expect(bands.getByText('Reading').locator('..')).toContainText(/\d\.\d/);
  await expect(
    bands.getByText('Overall band appears once all four modules have a score.'),
  ).toBeVisible();

  // Goals save to the profile and come back after a reload.
  await page.getByRole('button', { name: 'Edit goals' }).click();
  await page.getByRole('combobox', { name: 'Target band' }).selectOption('7.5');
  await page.getByRole('button', { name: 'Save goals' }).click();
  // The form closes once Firestore has the goals; reloading sooner can beat the write.
  await expect(page.getByRole('form', { name: 'Your goals' })).toBeHidden();
  await page.reload();
  await expect(page.getByText('Target band 7.5')).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'History' })
    .click();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Band breakdown' })
    .click();
  await expect(page.getByText(/Appears once all four modules have a score/)).toBeVisible();
  await page.getByRole('button', { name: 'Raise Writing by half a band' }).click();
  await expect(page.getByRole('button', { name: 'Reset to my scores' })).toBeEnabled();

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Test library' })
    .click();
  const card = page.getByRole('article', { name: 'Book 21 · Test 1' });
  await expect(card.getByRole('link', { name: /Reading: band/ })).toBeVisible();
  await expect(card.getByText('In progress')).toBeVisible();
});
