import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import readXlsxFile from 'read-excel-file/node';
import writeXlsxFile from 'write-excel-file/node';
import { testToBook } from '../../src/admin/sheets';
import { toSheets } from '../../src/admin/xlsx';
import { TestFileSchema } from '../../src/schema/test';
import { admin, signInAsOwner } from './emulators';

const ID = 'book98-test3';

/** The sample test as a filled-in workbook for Book 98 Test 3. */
async function filledWorkbook(): Promise<Buffer> {
  const sample = TestFileSchema.parse(
    JSON.parse(readFileSync('content/tests/book21-test1.json', 'utf8')),
  );
  const grids = testToBook(sample);
  const test = grids.find((g) => g.name === 'Test')!;
  test.rows = test.rows.map((r) =>
    r[0] === 'Book' ? ['Book', 'Book 98'] : r[0] === 'Test number' ? ['Test number', 3] : r,
  );
  return writeXlsxFile(toSheets(grids) as never).toBuffer();
}

test.beforeEach(async ({ page }) => {
  const { db } = admin();
  await db.recursiveDelete(db.doc(`drafts/${ID}`));
  await signInAsOwner(page);
  await page.getByRole('link', { name: 'Admin' }).click();
});

test('download the template, upload a filled-in workbook, and get a draft', async ({ page }) => {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download the template' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('ielts-test-template.xlsx');
  const sheets = await readXlsxFile(await file.path());
  expect(sheets.map((s) => s.sheet)).toContain('Questions');

  await page.getByLabel('Upload filled-in files (.xlsx)').setInputFiles([
    { name: 'book98.xlsx', mimeType: 'application/octet-stream', buffer: await filledWorkbook() },
    { name: 'notes.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('not excel') },
  ]);
  const files = page.getByRole('list', { name: 'Uploaded files' });
  await expect(files.getByText('Saved as a draft. Ready to publish.')).toBeVisible();
  await expect(
    files.getByText('This isn’t an Excel workbook (.xlsx).', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Book 98 · Test 3', exact: true })).toBeVisible();
  // Every page works at 390px, results included.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );

  // Uploading it again offers to replace the draft rather than making a second one.
  await page.getByLabel('Upload filled-in files (.xlsx)').setInputFiles({
    name: 'book98.xlsx',
    mimeType: 'application/octet-stream',
    buffer: await filledWorkbook(),
  });
  await page.getByRole('button', { name: 'Replace the draft' }).click();
  await expect(files.getByText('Saved as a draft. Ready to publish.')).toBeVisible();

  await files.getByRole('link', { name: 'Open Book 98 · Test 3' }).click();
  await expect(page.getByRole('heading', { name: 'Book 98 · Test 3' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish test' })).toBeEnabled();
});

test('lists what to fix, by sheet and row', async ({ page }) => {
  const grids = testToBook(
    TestFileSchema.parse(JSON.parse(readFileSync('content/tests/book21-test1.json', 'utf8'))),
  );
  grids.find((g) => g.name === 'Test')!.rows[1] = ['Book', 'Book 98'];
  grids.find((g) => g.name === 'Test')!.rows[2] = ['Test number', 3];
  grids.find((g) => g.name === 'Groups')!.rows[1]![3] = 'Crossword';
  const buffer = await writeXlsxFile(toSheets(grids) as never).toBuffer();
  await page
    .getByLabel('Upload filled-in files (.xlsx)')
    .setInputFiles({ name: 'broken.xlsx', mimeType: 'application/octet-stream', buffer });
  const files = page.getByRole('list', { name: 'Uploaded files' });
  await expect(files.getByText('Not uploaded: fix', { exact: false })).toBeVisible();
  await expect(files.getByText('Groups row 2:')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Book 98 · Test 3', exact: true })).toHaveCount(0);
});

test('delete a test after the warning, and it leaves Firestore', async ({ page }) => {
  await page.getByLabel('Upload filled-in files (.xlsx)').setInputFiles({
    name: 'book98.xlsx',
    mimeType: 'application/octet-stream',
    buffer: await filledWorkbook(),
  });
  const files = page.getByRole('list', { name: 'Uploaded files' });
  await files.getByRole('link', { name: 'Open Book 98 · Test 3' }).click();
  await page.getByRole('button', { name: 'Delete test' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete Book 98 · Test 3?' });
  await expect(dialog.getByText('Warning: this can’t be undone.')).toBeVisible();
  // The dialog fits a phone screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await dialog.getByLabel('Type DELETE to confirm').fill('DELETE');
  await dialog.getByRole('button', { name: 'Delete test' }).click();

  await expect(
    page.getByRole('status').filter({ hasText: 'Book 98 · Test 3 was deleted.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Book 98 · Test 3', exact: true })).toHaveCount(0);
  const { db } = admin();
  expect((await db.doc(`drafts/${ID}`).get()).exists).toBe(false);
  expect((await db.collection(`drafts/${ID}/sections`).get()).size).toBe(0);
});
