import { expect, test } from '@playwright/test';
import { clearAttempts, signInAsOwner } from './emulators';
import { examUi } from './ui';

test.beforeEach(async ({ page }) => {
  await clearAttempts();
  await signInAsOwner(page);
});

test('answer, reveal, submit and see Results', async ({ page }, info) => {
  const ui = examUi(page, info);
  await page.goto('/test/book21-test1/reading?mode=single&part=1');
  await ui.questions();

  await page.getByRole('button', { name: 'Question 1: TRUE' }).click();
  await page.getByRole('button', { name: 'Question 2: FALSE' }).click();
  await page.getByRole('textbox', { name: 'Question 6' }).fill('envelope');
  await page.getByRole('textbox', { name: 'Question 7' }).fill('winter');
  await page.getByRole('textbox', { name: 'Question 8' }).fill('the embodied');
  await expect(page.getByText('Too many words: ONE WORD ONLY')).toBeVisible();

  // Reveal one answer: verdict, where, the banner, and the highlight in the passage.
  await page.getByRole('button', { name: 'Show answer for question 4' }).click();
  await expect(page.getByText('Not answered')).toBeVisible();
  await expect(page.getByText('Paragraph C, highlighted', { exact: false })).toBeVisible();
  await expect(page.getByText(/won’t count toward your band history/)).toBeVisible();
  await ui.passage();
  await expect(page.locator('mark', { hasText: 'costs little to implement' })).toBeVisible();

  await ui.submit('Evaluate my Reading');
  await expect(page).toHaveURL(/\/results\//);
  const band = page.getByRole('region', { name: 'Band score' });
  await expect(band.getByText('5.0', { exact: true })).toBeVisible();
  await expect(band.getByText('4 / 9 correct', { exact: false })).toBeVisible();
  await expect(page.getByText(/Practice: answers were shown/)).toBeVisible();

  const review = page.getByRole('table');
  await expect(review.getByRole('row')).toHaveCount(10);
  await expect(review.getByText('Paragraph A:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /^Incorrect/ }).click();
  await expect(review.getByRole('row')).toHaveCount(2); // header + Q8 ("the embodied", over the limit)
  await expect(review.getByRole('row').nth(1)).toContainText('the embodied');
});

test('the phone layout has Passage / Questions tabs and a question sheet', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'phone', 'phone layout only');
  await page.goto('/test/book21-test1/reading');
  await expect(page.getByRole('heading', { name: 'Green Building Trends' })).toBeVisible();
  await page.getByRole('button', { name: /answered$/ }).click();
  const sheet = page.getByRole('dialog', { name: 'All questions' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: /^Question 7,/ }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Question 7' })).toBeVisible();
  await page.getByRole('button', { name: 'Next question' }).click();
  await expect(page.getByRole('button', { name: /^Q8 ·/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
