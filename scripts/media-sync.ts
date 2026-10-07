// After a deploy: publishes content/media-manifest.json to Firestore as media/manifest and
// points every test and draft at the current version of its audio and image files
// (scripts/media-relink.ts). Run by the Deploy workflow; locally:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json npx tsx scripts/media-sync.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { MediaManifestSchema } from '../src/schema/media';
import { MANIFEST_FILE } from './content';
import { relinkSection } from './media-relink';

const root = process.cwd();
const project = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
const emulator = process.env.FIRESTORE_EMULATOR_HOST;
if (!project) {
  console.error('Set VITE_FIREBASE_PROJECT_ID.');
  process.exit(1);
}

const manifest = MediaManifestSchema.parse(
  JSON.parse(readFileSync(path.join(root, MANIFEST_FILE), 'utf8')),
);
initializeApp(
  emulator ? { projectId: project } : { projectId: project, credential: applicationDefault() },
);
const db = getFirestore();

const batch = db.batch();
batch.set(db.doc('media/manifest'), { ...manifest });
let relinked = 0;

// Live tests store sections as objects; drafts store them as JSON text.
for (const test of (await db.collection('tests').get()).docs) {
  for (const section of (await test.ref.collection('sections').get()).docs) {
    const next = relinkSection(section.data(), manifest);
    if (next) {
      batch.set(section.ref, next);
      console.log(`  ${section.ref.path}`);
      relinked++;
    }
  }
}
for (const draft of (await db.collection('drafts').get()).docs) {
  for (const section of (await draft.ref.collection('sections').get()).docs) {
    const json: unknown = section.get('json');
    if (typeof json !== 'string') continue;
    const next = relinkSection(JSON.parse(json) as Record<string, unknown>, manifest);
    if (next) {
      batch.set(section.ref, { json: JSON.stringify(next) });
      console.log(`  ${section.ref.path}`);
      relinked++;
    }
  }
}
await batch.commit();
console.log(
  `✓ media/manifest lists ${manifest.files.length} files; ${relinked} section${relinked === 1 ? '' : 's'} relinked`,
);
