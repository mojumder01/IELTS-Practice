import { expect, test } from '@playwright/test';
import { SAMPLE_ESSAY } from '../fixtures/writingSample';
import { clearAttempts, signInAsOwner } from './emulators';
import { examUi } from './ui';

// e2e builds answer with src/lib/aiFake.ts: the real model needs App Check and a quota.

test.beforeEach(async ({ page }) => {
  await clearAttempts();
  await signInAsOwner(page);
});

test('Practice: write, get feedback for the sample essay, evaluate', async ({ page }, info) => {
  const ui = examUi(page, info);
  await page.goto('/test/book21-test1/writing?mode=single&part=2');
  await expect(page.getByText('Writing Task 2', { exact: true })).toBeVisible();

  const editor = page.getByRole('textbox', { name: 'Your answer · Task 2' });
  await editor.fill(SAMPLE_ESSAY);
  await expect(page.getByText('154 / 250 words')).toBeVisible();
  await expect(page.getByText('96 more to reach the minimum')).toBeVisible();

  await page.getByRole('button', { name: 'Get AI feedback' }).click();
  const panel = page.getByRole('complementary', { name: 'AI feedback' });
  await expect(panel.getByText('Estimated band for Task 2')).toBeVisible();
  await expect(panel.getByText('6.5', { exact: true }).first()).toBeVisible();
  await expect(panel.getByText('Top 3 fixes')).toBeVisible();
  await expect(panel.getByText('the number of cars is rising')).toBeVisible();

  // The essay and its feedback survive a reload.
  await page.reload();
  await expect(editor).toHaveValue(SAMPLE_ESSAY);
  await page.getByRole('button', { name: 'Show AI feedback' }).click();
  await expect(panel.getByText('Estimated band for Task 2')).toBeVisible();

  await ui.submit('Evaluate my essay');
  await expect(editor).toHaveAttribute('readonly', '');
  await expect(page).toHaveURL(/\/writing/);
});

test('bad model output shows a retry message, never a crash', async ({ page }) => {
  await page.goto('/test/book21-test1/writing?mode=single&part=2');
  const editor = page.getByRole('textbox', { name: 'Your answer · Task 2' });
  await editor.fill(`${SAMPLE_ESSAY} [unreadable]`);
  await page.getByRole('button', { name: 'Get AI feedback' }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('The AI’s reply couldn’t be read. Please try again.');
  // Fix the essay and try again: the page carries on.
  await editor.fill(SAMPLE_ESSAY);
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Estimated band for Task 2')).toBeVisible();
});

test('Exam: feedback unlocks after submitting', async ({ page }) => {
  await page.goto('/test/book21-test1/writing?mode=full');
  await expect(page.getByRole('timer')).toHaveText(/60:00|59:5\d/);
  await expect(page.getByText('AI feedback unlocks after you submit')).toBeVisible();

  await page.getByRole('button', { name: 'Enlarge the chart' }).click();
  const chart = page.getByRole('dialog', { name: 'Enlarged chart' });
  await chart.getByRole('button', { name: 'Zoom in' }).click();
  await expect(chart.getByRole('button', { name: 'Reset zoom (now 150%)' })).toBeVisible();
  await chart.getByRole('button', { name: 'Close chart' }).click();

  await page.getByRole('textbox', { name: 'Your answer · Task 1' }).fill('The graph shows…');
  // Phones show the task tabs and actions in the bottom bar too, as Writing has no question grid.
  await page.getByRole('button', { name: 'Next task' }).click();
  await page.getByRole('textbox', { name: 'Your answer · Task 2' }).fill(SAMPLE_ESSAY);
  await page.getByRole('button', { name: 'Submit writing' }).click();

  await expect(page.getByText('Estimated band for Task 2')).toBeVisible();
  await expect(page.getByText('AI feedback unlocks after you submit')).toBeHidden();
});
