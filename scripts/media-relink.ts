import type { MediaManifest } from '../src/schema/media';

// After npm run media, tests and drafts in Firestore may still name a file's old version
// ("b21t1-p1.28d1e3ca.mp3") or its upload name from an Excel sheet ("b21t1-p1.mp3"). These
// helpers point them at the manifest's current file with the same name. Pure, for the deploy's
// media sync (scripts/media-sync.ts).

/** "/media/audio/B21T1 P1.28d1e3ca.mp3" → "b21t1-p1". */
export function mediaStem(path: string): string {
  const base = path.split('/').pop() ?? '';
  return base
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\.[0-9a-f]{8}$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The manifest's file for a path's name, if it has one. */
export function currentFile(path: string, manifest: MediaManifest) {
  const dir = /^\/media\/(audio|img)\//.exec(path)?.[1];
  if (!dir) return undefined;
  const stem = mediaStem(path);
  return manifest.files.find(
    (f) => f.path.startsWith(`/media/${dir}/`) && mediaStem(f.path) === stem,
  );
}

/**
 * A section as stored (a test's section document, or a draft's parsed JSON) with its audio or
 * image pointed at the current file, and a listening part's length set from that file. Returns
 * null when nothing changes.
 */
export function relinkSection(
  section: Record<string, unknown>,
  manifest: MediaManifest,
): Record<string, unknown> | null {
  if (section.kind === 'listening' && typeof section.audio === 'string') {
    const file = currentFile(section.audio, manifest);
    if (!file) return null;
    const length = typeof section.durationSec === 'number' ? section.durationSec : 0;
    // A length within a second of the file's is a rounding, not a new recording.
    const durationSec =
      file.durationSec !== undefined && Math.abs(file.durationSec - length) >= 1
        ? file.durationSec
        : section.durationSec;
    if (file.path === section.audio && durationSec === section.durationSec) return null;
    return { ...section, audio: file.path, durationSec };
  }
  const task1 = section.task1 as Record<string, unknown> | undefined;
  if (section.kind === 'writing' && typeof task1?.image === 'string') {
    const file = currentFile(task1.image, manifest);
    if (!file || file.path === task1.image) return null;
    return { ...section, task1: { ...task1, image: file.path } };
  }
  return null;
}
