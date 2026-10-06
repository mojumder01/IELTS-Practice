import { expect, test, type Page } from '@playwright/test';
import { admin, clearAttempts, OWNER_UID, signInAsOwner } from './emulators';
import { examUi } from './ui';

test.beforeEach(async ({ page }) => {
  await clearAttempts();
  await signInAsOwner(page);
});

const timer = (page: Page) => page.getByRole('timer');

test('the owner opens a Reading test in the exam shell', async ({ page }) => {
  await page.goto('/test/book21-test1/reading');
  await expect(page.getByRole('heading', { name: 'Green Building Trends' })).toBeVisible();
  await expect(page).toHaveURL(/mode=single&part=1/);
  await expect(timer(page)).toHaveText(/^(20:00|19:5\d)$/);
});

test('a reload restores the attempt exactly', async ({ page }, info) => {
  const ui = examUi(page, info);
  await page.goto('/test/book21-test1/reading?mode=single&part=1');
  await ui.questions();
  await page.getByRole('button', { name: 'Question 1: TRUE' }).click();
  await page.getByRole('textbox', { name: 'Question 6' }).fill('envelope');
  await page.getByRole('button', { name: 'Flag question 3 for review' }).click();
  await ui.openNotes();
  await page.getByRole('textbox', { name: 'Notes' }).fill('B2: building envelope');
  await (await ui.control('Pause')).click();
  await expect(page.getByRole('dialog', { name: 'Test paused' })).toBeVisible();
  const pausedAt = await timer(page).textContent();

  await page.reload();

  await expect(page.getByRole('dialog', { name: 'Test paused' })).toBeVisible();
  await expect(timer(page)).toHaveText(pausedAt!);
  await page.getByRole('button', { name: 'Resume test' }).click();
  await ui.questions();
  await expect(page.getByRole('button', { name: 'Question 1: TRUE' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('textbox', { name: 'Question 6' })).toHaveValue('envelope');
  await expect(page.getByRole('button', { name: 'Flag question 3 for review' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  if (!ui.phone)
    await expect(
      page.getByRole('button', { name: 'Question 3, unanswered, flagged' }),
    ).toBeVisible();
  await ui.openNotes();
  await expect(page.getByRole('textbox', { name: 'Notes' })).toHaveValue('B2: building envelope');
});

test('the countdown keeps its place across a reload', async ({ page }) => {
  await page.goto('/test/book21-test1/reading');
  await expect(timer(page)).toHaveText(/^19:5\d$/, { timeout: 5_000 });
  await page.waitForTimeout(3_000);
  const before = await timer(page).textContent();
  await page.reload();
  const toSeconds = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  await expect(timer(page)).toHaveText(/^\d\d:\d\d$/);
  const after = toSeconds((await timer(page).textContent())!);
  expect(toSeconds(before!) - after).toBeLessThanOrEqual(3);
  expect(after).toBeLessThan(20 * 60);
});

test('answers reach Firestore', async ({ page }) => {
  await page.goto('/test/book21-test1/listening');
  await page.getByRole('textbox', { name: 'Question 1', exact: true }).fill('Morgan');
  await expect
    .poll(async () => {
      const snapshot = await admin().db.collection(`users/${OWNER_UID}/attempts`).get();
      return snapshot.docs.map((d) => d.data().answers as Record<string, string>);
    })
    .toContainEqual(expect.objectContaining({ '1': 'Morgan' }));
});

test('a full mock Listening runs 30 + 2 minutes with no pause', async ({ page }, info) => {
  const ui = examUi(page, info);
  await page.goto('/test/book21-test1/listening?mode=full');
  await expect(timer(page)).toHaveText(/^(32:00|31:5\d)$/);
  await expect(await ui.control('Pause')).toHaveCount(0);
});

test('switching mode asks first, then restarts', async ({ page }, info) => {
  const ui = examUi(page, info);
  await page.goto('/test/book21-test1/reading');
  await ui.questions();
  await page.getByRole('button', { name: 'Question 1: TRUE' }).click();
  await (await ui.control('Full mock')).click();
  await page.getByRole('button', { name: 'Switch and restart' }).click();
  await expect(page).toHaveURL(/mode=full&part=1/);
  await expect(timer(page)).toHaveText(/^(60:00|59:5\d)$/);
  await ui.questions();
  await expect(page.getByRole('button', { name: 'Question 1: TRUE' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
