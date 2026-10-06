import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { MediaManifest } from '../src/schema/media';
import type { TestFile } from '../src/schema/test';
import {
  validateManifest,
  validateTestFile,
  validateVocabSeed,
  type ContentIssue,
} from '../src/schema/validate';
import type { VocabWord } from '../src/schema/vocab';
import { HASHED_MEDIA_NAME } from './media-names';

/** Every content file, validated, with problems listed per file. */
export interface LoadedContent {
  manifest: MediaManifest | null;
  tests: { file: string; test: TestFile | null }[];
  vocab: VocabWord[] | null;
  problems: { file: string; issues: ContentIssue[] }[];
}

export const MANIFEST_FILE = 'content/media-manifest.json';
export const VOCAB_FILE = 'content/vocab/seed.json';

async function readJson(
  root: string,
  file: string,
): Promise<{ data?: unknown; issue?: ContentIssue }> {
  let source: string;
  try {
    source = await readFile(path.join(root, file), 'utf8');
  } catch {
    return { issue: { path: '(file)', message: 'not found' } };
  }
  try {
    return { data: JSON.parse(source) as unknown };
  } catch (error) {
    return { issue: { path: '(file)', message: `isn't valid JSON: ${(error as Error).message}` } };
  }
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((name) => !name.startsWith('.')).sort();
  } catch {
    return [];
  }
}

/** Manifest and public/media must agree: every listed file exists and every file is listed. */
async function checkMediaOnDisk(root: string, manifest: MediaManifest): Promise<ContentIssue[]> {
  const issues: ContentIssue[] = [];
  const listed = new Set(manifest.files.map((f) => f.path));
  for (const [i, file] of manifest.files.entries()) {
    try {
      await stat(path.join(root, 'public', file.path));
    } catch {
      issues.push({
        path: `files[${i}]`,
        message: `${file.path} is listed but missing from public/media`,
      });
    }
  }
  for (const dir of ['audio', 'img']) {
    for (const name of await listFiles(path.join(root, 'public/media', dir))) {
      const mediaPath = `/media/${dir}/${name}`;
      if (!HASHED_MEDIA_NAME.test(name)) {
        issues.push({ path: mediaPath, message: 'has no content hash yet; run npm run media' });
      } else if (!listed.has(mediaPath)) {
        issues.push({ path: mediaPath, message: 'isn’t in the manifest; run npm run media' });
      }
    }
  }
  return issues;
}

export async function loadContent(root: string): Promise<LoadedContent> {
  const problems: LoadedContent['problems'] = [];
  const report = (file: string, issues: ContentIssue[]) => {
    if (issues.length) problems.push({ file, issues });
  };

  const manifestJson = await readJson(root, MANIFEST_FILE);
  let manifest: MediaManifest | null = null;
  if (manifestJson.issue) {
    report(MANIFEST_FILE, [manifestJson.issue]);
  } else {
    const result = validateManifest(manifestJson.data);
    manifest = result.value;
    report(MANIFEST_FILE, result.issues);
    if (manifest) report(MANIFEST_FILE, await checkMediaOnDisk(root, manifest));
  }

  const tests: LoadedContent['tests'] = [];
  const testFiles = (await listFiles(path.join(root, 'content/tests'))).filter((f) =>
    f.endsWith('.json'),
  );
  if (testFiles.length === 0)
    report('content/tests', [{ path: '(folder)', message: 'has no test files' }]);
  for (const name of testFiles) {
    const file = `content/tests/${name}`;
    const json = await readJson(root, file);
    if (json.issue) {
      report(file, [json.issue]);
      tests.push({ file, test: null });
      continue;
    }
    const result = validateTestFile(json.data, manifest, name);
    report(file, result.issues);
    tests.push({ file, test: result.value });
  }

  let vocab: VocabWord[] | null = null;
  const vocabJson = await readJson(root, VOCAB_FILE);
  if (vocabJson.issue) {
    report(VOCAB_FILE, [vocabJson.issue]);
  } else {
    const result = validateVocabSeed(vocabJson.data);
    vocab = result.value;
    report(VOCAB_FILE, result.issues);
  }

  return { manifest, tests, vocab, problems };
}

export function formatProblems(problems: LoadedContent['problems']): string {
  return problems
    .map(({ file, issues }) =>
      [`✗ ${file}`, ...issues.map((i) => `    ${i.path}: ${i.message}`)].join('\n'),
    )
    .join('\n');
}
