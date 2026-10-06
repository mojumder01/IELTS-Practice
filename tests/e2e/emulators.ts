import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// The e2e build talks to the Firebase emulators as this project and owner.
export const PROJECT_ID = 'demo-ielts-practice';
export const OWNER_UID = 'e2eOwnerUid000000000000000000';
export const FIRESTORE = '127.0.0.1:8080';
export const AUTH = '127.0.0.1:9099';

process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH;

export function admin() {
  const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
  return { db: getFirestore(app) };
}

/** The Auth emulator accepts unsigned custom tokens, the same shape firebase-admin makes for it. */
function emulatorCustomToken(uid: string): string {
  const now = Math.floor(Date.now() / 1000);
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const issuer = 'firebase-auth-emulator@example.com';
  return `${part({ alg: 'none', typ: 'JWT' })}.${part({
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    iss: issuer,
    sub: issuer,
    uid,
  })}.`;
}

/** Loads the real rules with the e2e owner in place of the placeholder, as the deploy does. */
export async function loadRules(root: string) {
  const rules = (await readFile(path.join(root, 'firestore.rules'), 'utf8')).replace(
    '"OWNER_UID"',
    `"${OWNER_UID}"`,
  );
  const response = await fetch(
    `http://${FIRESTORE}/emulator/v1/projects/${PROJECT_ID}:securityRules`,
    {
      method: 'PUT',
      body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: rules }] } }),
    },
  );
  if (!response.ok)
    throw new Error(`Could not load rules: ${response.status} ${await response.text()}`);
}

/** Signs the browser in as the owner through the emulator, then waits for the app to notice. */
export async function signInAsOwner(page: Page) {
  const token = emulatorCustomToken(OWNER_UID);
  await page.goto('/signin');
  await page.waitForFunction(() => 'e2eSignIn' in window);
  await page.evaluate(
    (t) => (window as unknown as { e2eSignIn: (t: string) => Promise<unknown> }).e2eSignIn(t),
    token,
  );
  await page.waitForURL((url) => url.pathname === '/');
}

/** Each test starts with no saved attempts. */
export async function clearAttempts() {
  const { db } = admin();
  await db.recursiveDelete(db.collection(`users/${OWNER_UID}/attempts`));
}
