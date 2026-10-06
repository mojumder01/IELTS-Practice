// npm run seed: publishes content/ to Firestore with the Admin SDK. Run it on your
// laptop only. It refuses to run while npm run validate reports problems.
//   Real project: GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json npm run seed
//   Emulator:     FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed
//   Preview:      npm run seed -- --dry-run
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { formatProblems, loadContent } from './content';
import { planSeed } from './seed-plan';

const root = process.cwd();
const dryRun = process.argv.includes('--dry-run');
if (existsSync(path.join(root, '.env.local'))) process.loadEnvFile(path.join(root, '.env.local'));

function projectId(): string | undefined {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.VITE_FIREBASE_PROJECT_ID) return process.env.VITE_FIREBASE_PROJECT_ID;
  try {
    const rc = JSON.parse(readFileSync(path.join(root, '.firebaserc'), 'utf8')) as {
      projects?: { default?: string };
    };
    return rc.projects?.default;
  } catch {
    return undefined;
  }
}

const content = await loadContent(root);
if (content.problems.length) {
  console.error(
    `${formatProblems(content.problems)}\n\nFix these first (npm run validate); nothing was written.`,
  );
  process.exit(1);
}

const ownerUid = process.env.VITE_OWNER_UID?.trim() || null;
const plan = planSeed(content, ownerUid);
const project = projectId();
const emulator = process.env.FIRESTORE_EMULATOR_HOST;

console.log(
  `Project ${project ?? '(unknown)'}${emulator ? ` on the emulator at ${emulator}` : ''}`,
);
for (const write of plan.writes)
  console.log(`  ${write.mode === 'set' ? 'write ' : 'create'} ${write.path}`);
if (!ownerUid) console.log('  (vocabulary skipped: set VITE_OWNER_UID in .env.local to seed it)');
if (dryRun) process.exit(0);

if (!project || project === 'your-firebase-project-id') {
  console.error(
    'No Firebase project: run `npx firebase-tools use --add` or set VITE_FIREBASE_PROJECT_ID.',
  );
  process.exit(1);
}
if (!emulator && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    'Set GOOGLE_APPLICATION_CREDENTIALS to your service-account key file (see docs/SETUP.md).',
  );
  process.exit(1);
}

initializeApp(
  emulator ? { projectId: project } : { projectId: project, credential: applicationDefault() },
);
const db = getFirestore();

// Words already in your list keep their progress: "create" writes only new ones.
const creates = plan.writes.filter((w) => w.mode === 'create');
const existing = new Set(
  creates.length
    ? (await db.getAll(...creates.map((w) => db.doc(w.path))))
        .filter((d) => d.exists)
        .map((d) => d.ref.path)
    : [],
);
const writes = plan.writes.filter((w) => w.mode === 'set' || !existing.has(w.path));

for (let i = 0; i < writes.length; i += 500) {
  const batch = db.batch();
  for (const write of writes.slice(i, i + 500)) batch.set(db.doc(write.path), write.data);
  await batch.commit();
}
console.log(
  `✓ wrote ${writes.length} documents${existing.size ? ` (${existing.size} saved words left as they were)` : ''}`,
);
