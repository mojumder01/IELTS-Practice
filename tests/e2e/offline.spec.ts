import { expect, test } from '@playwright/test';
import { clearAttempts, signInAsOwner } from './emulators';
import { examUi } from './ui';

test.beforeEach(async ({ page }) => {
  await clearAttempts();
  await signInAsOwner(page);
});

test('a test opened once works offline, audio included', async ({ page, context }, info) => {
  const ui = examUi(page, info);
  // Online: open the Listening and Reading tests once, so the service worker and Firestore keep them.
  await page.goto('/test/book21-test1/listening?mode=single&part=1');
  await expect(page.getByRole('textbox', { name: 'Question 1', exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now the page and its audio go through the service worker
  await expect
    .poll(() => page.evaluate(() => document.querySelector('audio')?.readyState ?? 0), {
      timeout: 15_000,
    })
    .toBeGreaterThanOrEqual(1);
  await page.goto('/test/book21-test1/reading?mode=single&part=1');
  await expect(page.getByRole('heading', { name: 'Green Building Trends' })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Green Building Trends' })).toBeVisible({
    timeout: 30_000,
  });
  await ui.questions();
  await page.getByRole('textbox', { name: 'Question 6' }).fill('envelope');
  await expect(page.getByRole('textbox', { name: 'Question 6' })).toHaveValue('envelope');

  await page.goto('/test/book21-test1/listening?mode=single&part=1');
  await expect(page.getByRole('textbox', { name: 'Question 1', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  // The recording plays from the cache.
  await expect
    .poll(() => page.evaluate(() => document.querySelector('audio')?.duration ?? 0), {
      timeout: 15_000,
    })
    .toBeGreaterThan(100);
  await context.setOffline(false);
});
