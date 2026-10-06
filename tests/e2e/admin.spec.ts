import { expect, test } from '@playwright/test';
import { admin, clearAttempts, signInAsOwner } from './emulators';
import { examUi } from './ui';

const ID = 'book99-test1';

test.beforeEach(async ({ page }) => {
  const { db } = admin();
  await db.recursiveDelete(db.doc(`drafts/${ID}`));
  await db.recursiveDelete(db.doc(`tests/${ID}`));
  await clearAttempts();
  await signInAsOwner(page);
});

test('enter a test from scratch, publish it, and a student sees its highlights', async ({
  page,
}, info) => {
  await page.getByRole('link', { name: 'Admin' }).click();
  await page.getByLabel('Book or collection').fill('Book 99');
  await page.getByLabel('Test number').fill('1');
  await page.getByRole('button', { name: 'Create test' }).click();
  await expect(page.getByRole('heading', { name: 'Book 99 · Test 1' })).toBeVisible();

  await page.getByRole('tab', { name: /Reading/ }).click();
  await page.getByRole('button', { name: 'Add passage 1' }).click();
  await page.getByLabel('Passage title').fill('Urban Bees');
  await page
    .getByLabel('Passage text')
    .fill(
      '[A] Cities are becoming refuges for bees. Rooftop hives now produce honey in many capitals.\n\n' +
        '[B] Pesticides are rarer in towns than on farms. Parks also flower for longer each year.',
    );

  // Two True/False/Not Given questions.
  const count = page.getByLabel('Questions', { exact: true });
  await count.fill('2');
  await page.getByRole('button', { name: 'Add group' }).click();
  // Every page works at 390px: adding a group mustn't widen it.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await page.getByLabel('Question 1 statement').fill('Bees are kept on roofs in big cities.');
  await page
    .getByRole('group', { name: 'Question 1 answer' })
    .getByRole('button', { name: 'TRUE' })
    .click();
  await page.getByLabel('Question 2 statement').fill('Urban honey tastes sweeter.');
  await page
    .getByRole('group', { name: 'Question 2 answer' })
    .getByRole('button', { name: 'NOT GIVEN' })
    .click();
  await page.getByRole('button', { name: 'No location (Not Given)' }).nth(1).click();

  // Link question 1 to its proof and trim the highlight to the exact words.
  await page.getByRole('button', { name: 'Link to passage' }).first().click();
  await page.getByRole('button', { name: /Paragraph A, sentence 2/ }).click();
  await expect(
    page.getByRole('button', { name: /Paragraph A, sentence 2.*question 1/ }),
  ).toBeVisible();
  await page.getByLabel('Question 1 words to highlight').fill('Rooftop hives');

  const checks = page.getByRole('region', { name: 'Before publishing' });
  await expect(checks.getByText('Every check passes: ready to publish.')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'autosaved' })).toBeVisible();
  await page.getByRole('button', { name: 'Publish test' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Published. It’s live in the library.')).toBeVisible();

  // The student side: it's in the library, and revealing shows the linked words in the passage.
  await page.goto('/library');
  await expect(page.getByRole('article', { name: 'Book 99 · Test 1' })).toBeVisible();
  await page.goto(`/test/${ID}/reading?mode=single&part=1`);
  await expect(page.getByRole('heading', { name: 'Urban Bees' })).toBeVisible();
  const ui = examUi(page, info);
  await ui.questions();
  await page.getByRole('button', { name: 'Show answer for question 1' }).click();
  await ui.passage();
  await expect(page.locator('mark', { hasText: 'Rooftop hives' })).toBeVisible();
});

test('import checks the file, shows a diff, and preview opens the draft', async ({ page }) => {
  await page.goto('/admin');
  await page.getByLabel('Book or collection').fill('Book 99');
  await page.getByRole('button', { name: 'Create test' }).click();
  await expect(page.getByRole('heading', { name: 'Book 99 · Test 1' })).toBeVisible();

  await page.getByLabel('Import a test JSON file').setInputFiles({
    name: 'wrong.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"meta": {}}'),
  });
  await expect(page.getByRole('alert')).toContainText('doesn’t match the test schema');

  const file = {
    meta: {
      testId: ID,
      book: 'Book 99',
      testNumber: 1,
      track: 'academic',
      status: 'draft',
      timing: {
        listening: { singlePartMin: 10, fullMockMin: 30, checkMin: 2 },
        reading: { singlePartMin: 20, fullMockMin: 60 },
        writing: { task1Min: 20, task2Min: 40, fullMockMin: 60 },
      },
      studentHelp: { allowReveal: true, showScriptInSinglePart: true, lockAudioInFullMock: true },
    },
    sections: {
      speaking: {
        kind: 'speaking',
        part1: ['Where do you live?'],
        part2: {
          topic: 'Describe a park.',
          points: ['where it is'],
          closing: 'and explain why you like it.',
          prepSec: 60,
          speakSec: 120,
        },
        part3: ['Why do cities need parks?'],
      },
    },
  };
  await page.getByLabel('Import a test JSON file').setInputFiles({
    name: `${ID}.json`,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file)),
  });
  await expect(page.getByText('+ sections.speaking (added)')).toBeVisible();
  await page.getByRole('button', { name: 'Replace the draft' }).click();

  await page.getByRole('tab', { name: /Speaking/ }).click();
  await expect(page.getByLabel('Cue card topic')).toHaveValue('Describe a park.');
  await expect(page.getByRole('status').filter({ hasText: 'autosaved' })).toBeVisible();
  await page.getByRole('button', { name: 'Preview as student' }).click();
  await expect(page.getByText('Preview of the draft: nothing you do here is saved.')).toBeVisible();
  await expect(page.getByText('Where do you live?')).toBeVisible(); // Speaking, Part 1
});
