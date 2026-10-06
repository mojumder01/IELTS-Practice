import { expect, test, type Page } from '@playwright/test';
import sample from '../../content/tests/book21-test1.json' with { type: 'json' };
import { clearAttempts, signInAsOwner } from './emulators';

const starts = sample.sections['listening-1'].script.map((line) => line.start);
const lineAt = (t: number) => starts.reduce((current, start, i) => (start <= t ? i : current), -1);

test.beforeEach(async ({ page }) => {
  await clearAttempts();
  await signInAsOwner(page);
});

/** The audio's time and the line the script shows as now playing, read together. */
async function sample_(page: Page) {
  return page.evaluate(() => ({
    t: document.querySelector('audio')!.currentTime,
    line: Number(
      document.querySelector('[aria-current="true"][data-line]')?.getAttribute('data-line') ?? -1,
    ),
  }));
}

test('the current script line follows the audio within 0.5 s', async ({ page }) => {
  await page.goto('/test/book21-test1/listening?mode=single&part=1');
  await page.getByRole('button', { name: 'Show audioscript' }).click();
  await page.getByRole('button', { name: /^0:46/ }).click(); // seek to "When would you like to start?" and play
  await expect(page.getByRole('button', { name: 'Pause audio' })).toBeVisible();

  // Sample for a few seconds as it plays through the 0:50 boundary.
  for (let i = 0; i < 12; i++) {
    const { t, line } = await sample_(page);
    expect(line).toBeGreaterThanOrEqual(lineAt(t - 0.5));
    expect(line).toBeLessThanOrEqual(lineAt(t + 0.5));
    await page.waitForTimeout(400);
  }
  const { t } = await sample_(page);
  expect(t).toBeGreaterThan(50); // it really played past the next line
});

test('a full mock plays once with no seeking', async ({ page }) => {
  await page.goto('/test/book21-test1/listening?mode=full');
  await expect(page.getByRole('slider', { name: 'Audio position' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Back 5 seconds' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Forward 5 seconds' })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Playback speed' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Show audioscript' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Play audio' }).click();
  await expect(page.getByRole('button', { name: 'Pause audio' })).toBeDisabled();
});

test('the audio position survives a reload', async ({ page }) => {
  await page.goto('/test/book21-test1/listening?mode=single&part=1');
  await page.getByRole('slider', { name: 'Audio position' }).fill('64');
  await expect(page.getByText('1:04 / 1:50')).toBeVisible();
  await page.waitForTimeout(1_200); // the position is saved every second
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue audio' })).toBeVisible();
  await expect(page.getByText('1:04 / 1:50')).toBeVisible();
});

test('the highlighter marks script lines and they stay after a reload', async ({ page }) => {
  await page.goto('/test/book21-test1/listening?mode=single&part=1');
  await page.getByRole('button', { name: 'Show audioscript' }).click();
  await page.getByRole('button', { name: 'Highlighter' }).click();
  const line = page.getByRole('button', { name: /^0:26/ });
  await line.click();
  await expect(line).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.getByRole('button', { name: 'Show audioscript' }).click();
  await page.getByRole('button', { name: 'Highlighter' }).click();
  await expect(page.getByRole('button', { name: /^0:26/ })).toHaveAttribute('aria-pressed', 'true');
});
