import type { Page, TestInfo } from '@playwright/test';

/** Steps that differ between the desktop layout and the 390px phone layout. */
export function examUi(page: Page, info: TestInfo) {
  const phone = info.project.name === 'phone';
  const options = async () => {
    if (phone) await page.getByRole('button', { name: 'Test options' }).click();
  };
  return {
    phone,
    /** Phone: switch to the Questions tab (Reading). */
    questions: async () => {
      if (phone) await page.getByRole('button', { name: /^Questions \d/ }).click();
    },
    /** Phone: switch to the Passage tab (Reading). */
    passage: async () => {
      if (phone) await page.getByRole('button', { name: 'Passage', exact: true }).click();
    },
    /** A header control; on a phone it lives under Test options. */
    control: async (name: string) => {
      await options();
      return page.getByRole('button', { name, exact: true });
    },
    openNotes: async () => {
      await options();
      await page.getByRole('button', { name: 'Notes' }).click();
    },
    submit: async (label: string) => {
      await page.getByRole('button', { name: phone ? 'Submit' : label }).click();
    },
  };
}
