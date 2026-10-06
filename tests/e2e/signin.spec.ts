import { expect, test } from '@playwright/test';

test('a signed-out visitor is sent to the sign-in page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});

test('deep links fall back to the app, then to sign-in', async ({ page }) => {
  await page.goto('/test/book21-test1/reading?mode=single&part=1');
  await expect(page).toHaveURL(/\/signin$/);
});

test('the sign-in page never scrolls sideways', async ({ page }) => {
  await page.goto('/signin');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the sign-in button meets the 44px tap target', async ({ page }) => {
  await page.goto('/signin');
  const box = await page.getByRole('button', { name: 'Sign in with Google' }).boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
});

test('search engines are told to stay away', async ({ page, request }) => {
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /');

  await page.goto('/signin');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});
