import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { AUTH, FIRESTORE, loadRules, OWNER_UID, PROJECT_ID } from './emulators';

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../..');

async function waitFor(url: string) {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} didn't come up`);
}

/** Rules with the e2e owner, and the sample test seeded exactly as `npm run seed` would. */
export default async function globalSetup() {
  await waitFor(`http://${FIRESTORE}/`);
  await waitFor(`http://${AUTH}/`);
  await loadRules(root);
  await run('npx', ['tsx', 'scripts/seed.ts'], {
    cwd: root,
    env: {
      ...process.env,
      FIRESTORE_EMULATOR_HOST: FIRESTORE,
      VITE_FIREBASE_PROJECT_ID: PROJECT_ID,
      GCLOUD_PROJECT: PROJECT_ID,
      VITE_OWNER_UID: OWNER_UID,
    },
  });
}
