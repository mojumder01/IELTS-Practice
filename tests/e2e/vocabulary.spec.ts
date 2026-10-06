import { expect, test, type Page } from '@playwright/test';
import { clearAttempts, resetVocab, signInAsOwner } from './emulators';

test.beforeEach(async ({ page }) => {
  await clearAttempts();
  await signInAsOwner(page);
});

test('the daily review holds due words only, and answers stick', async ({ page }) => {
  const due = await resetVocab();
  await page.goto('/vocabulary');
  await expect(page.getByRole('link', { name: `Review ${due} due words` })).toBeVisible();
  const review = page.getByRole('region', { name: 'Daily review' });
  await expect(review.getByText(`1 of ${due}`)).toBeVisible();
  for (let i = 0; i < due; i++) {
    await review.getByRole('button', { name: 'Show meaning' }).click();
    await review.getByRole('button', { name: i === 0 ? 'Again' : 'Got it' }).click();
  }
  await expect(review.getByText('Review done for today')).toBeVisible();
  await expect(review.getByText(`${due - 1} remembered · 1 to repeat tomorrow`)).toBeVisible();

  // Saved to Firestore: nothing is due after a reload.
  await page.reload();
  await expect(page.getByText('Nothing is due today.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review 0 due words' })).toBeVisible();
});

/** Double-clicks (or double-taps on a phone) a word in the passage. */
async function doubleTapWord(page: Page, word: string, phone: boolean) {
  const box = await page.evaluate((w) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent?.search(new RegExp(`\\b${w}\\b`)) ?? -1;
      if (at >= 0 && node.parentElement?.closest('[data-word-root]')) {
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + w.length);
        range.startContainer.parentElement?.scrollIntoView({ block: 'center' });
        const r = range.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    }
    return null;
  }, word);
  if (!box) throw new Error(`"${word}" isn't in the passage`);
  if (phone) {
    await page.touchscreen.tap(box.x, box.y);
    await page.touchscreen.tap(box.x, box.y);
  } else {
    await page.mouse.dblclick(box.x, box.y);
  }
}

test('double-tap a word in the passage to save it with its sentence', async ({ page }, info) => {
  await resetVocab();
  await page.goto('/test/book21-test1/reading?mode=single&part=1');
  await expect(page.getByRole('heading', { name: 'Green Building Trends' })).toBeVisible();
  await doubleTapWord(page, 'envelope', info.project.name === 'phone');

  const dialog = page.getByRole('dialog', { name: 'Save “envelope” to vocabulary' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Meaning').fill('the outer shell of a building');
  await dialog.getByLabel('Topic').fill('Urban life');
  await dialog.getByRole('button', { name: 'Save word' }).click();
  await expect(dialog.getByText('is saved', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Back to the test' }).click();
  await expect(dialog).toBeHidden();

  await page.goto('/vocabulary');
  await page.getByRole('searchbox', { name: 'Search words' }).fill('envelope');
  await page.getByRole('button', { name: 'Show example for envelope' }).click();
  await expect(page.getByText(/Urban life · Saved from Book 21 · Test 1/)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Words' })).toContainText('envelope');
});
