import { expect, test, type Page } from '@playwright/test';
import { clearAttempts, signInAsOwner } from './emulators';

const SAID =
  'One public place I enjoy is, um, the riverside park, and I go there, like, every week.';

/**
 * Chrome's speech recognition needs Google's servers, which tests can't reach: this stands in
 * for it, or removes it to act like a browser without one.
 */
async function speechRecognition(page: Page, available: boolean) {
  await page.addInitScript(
    ({ available, said }) => {
      const w = window as unknown as Record<string, unknown>;
      if (!available) {
        delete w.SpeechRecognition;
        delete w.webkitSpeechRecognition;
        return;
      }
      class FakeRecognition {
        onresult: ((e: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((e: unknown) => void) | null = null;
        continuous = false;
        interimResults = false;
        lang = '';
        start() {
          setTimeout(
            () => this.onresult?.({ results: [{ 0: { transcript: said }, isFinal: true }] }),
            300,
          );
        }
        stop() {
          setTimeout(() => this.onend?.(), 10);
        }
        abort() {}
      }
      w.SpeechRecognition = FakeRecognition;
      w.webkitSpeechRecognition = FakeRecognition;
    },
    { available, said: SAID },
  );
}

test.beforeEach(async ({ page }) => {
  await clearAttempts();
  await signInAsOwner(page);
});

test('Part 2: prepare, speak, review; the take survives a reload', async ({ page }) => {
  await speechRecognition(page, true);
  await page.goto('/test/book21-test1/speaking?part=2');
  await expect(
    page.getByText('Describe a public place in your city that you enjoy visiting.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Start preparing' }).click();
  await expect(page.getByText('Preparation time left')).toBeVisible();
  await page.getByRole('button', { name: 'Start speaking now' }).click();
  await expect(page.getByText('Recording', { exact: true })).toBeVisible();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await expect(page.getByText('Take 1 saved')).toBeVisible();

  const review = page.getByRole('complementary', { name: 'Self-review' });
  await expect(review.getByText('riverside park', { exact: false })).toBeVisible();
  await expect(review.locator('mark')).toHaveCount(2); // "um", "like"
  await review.getByRole('checkbox', { name: 'Where it is' }).check();
  await expect(review.getByText('1 of 4')).toBeVisible();

  // Kept in IndexedDB on this device: still there after a reload, and it plays.
  await page.reload();
  const takes = page.getByRole('list', { name: 'Your takes' });
  await expect(takes.getByText('Take 1')).toBeVisible();
  await expect(review.getByRole('checkbox', { name: 'Where it is' })).toBeChecked();
  await expect(review.getByText('riverside park', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Play take 1' }).click();
  await expect(page.getByRole('button', { name: 'Pause take 1' })).toBeVisible();
});

test('without speech recognition: “transcript not available”, recording still works', async ({
  page,
}) => {
  await speechRecognition(page, false);
  await page.goto('/test/book21-test1/speaking?part=1');
  const review = page.getByRole('complementary', { name: 'Self-review' });
  await expect(review.getByText(/Transcript not available in this browser/)).toBeVisible();

  await page.getByRole('button', { name: 'Start recording' }).click();
  await expect(page.getByText('Recording', { exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await expect(page.getByText('Take 1 saved')).toBeVisible();
  await expect(review.getByText(/Transcript not available in this browser/)).toBeVisible();
});

test('self-scores give a band, and Finish locks the sitting', async ({ page }, info) => {
  await speechRecognition(page, true);
  await page.goto('/test/book21-test1/speaking?part=3');
  await expect(
    page.getByText('Why do some cities have more public spaces than others?'),
  ).toBeVisible();
  for (const [label, band] of [
    ['Fluency and coherence', '7'],
    ['Lexical resource', '6'],
    ['Grammatical range and accuracy', '6'],
    ['Pronunciation', '7'],
  ] as const) {
    await page.getByRole('combobox', { name: label }).selectOption(band);
  }
  await expect(page.getByText('Speaking band 6.5 (self-assessed)')).toBeVisible();

  await page
    .getByRole('button', { name: info.project.name === 'phone' ? 'Finish' : 'Finish speaking' })
    .first()
    .click();
  await expect(page.getByText(/Speaking is finished/)).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Pronunciation' })).toBeDisabled();
  // A finished sitting is closed: coming back starts a new one, as in the other modules.
  await page.reload();
  await expect(page.getByText('Score all four to see your speaking band.')).toBeVisible();
});
