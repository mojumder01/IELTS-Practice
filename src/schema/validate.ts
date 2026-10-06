import type { z } from 'zod';
import { checkTest, type ContentIssue } from './checks';
import { MediaManifestSchema, type MediaManifest } from './media';
import { TestFileSchema, type TestFile } from './test';
import { VocabSeedSchema, type VocabWord } from './vocab';

export type { ContentIssue } from './checks';

/** Formats a Zod path like ["sections", "reading-1", "groups", 0] as "sections.reading-1.groups[0]". */
export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((out, key) => {
    if (typeof key === 'number') return `${out}[${key}]`;
    return out ? `${out}.${String(key)}` : String(key);
  }, '');
}

export function zodIssues(error: z.ZodError): ContentIssue[] {
  return error.issues.map((issue) => ({
    path: formatPath(issue.path) || '(file)',
    message: issue.message,
  }));
}

export interface Validated<T> {
  value: T | null;
  issues: ContentIssue[];
}

/** Schema first; the section 8 checks only run on a file that matches the schema. */
export function validateTestFile(
  raw: unknown,
  manifest: MediaManifest | null,
  fileName?: string,
): Validated<TestFile> {
  const parsed = TestFileSchema.safeParse(raw);
  if (!parsed.success) return { value: null, issues: zodIssues(parsed.error) };

  const issues = checkTest(parsed.data, manifest);
  const expected = `${parsed.data.meta.testId}.json`;
  if (fileName && fileName !== expected) {
    issues.unshift({
      path: 'meta.testId',
      message: `is "${parsed.data.meta.testId}", so the file should be named ${expected}`,
    });
  }
  return { value: issues.length ? null : parsed.data, issues };
}

export function validateManifest(raw: unknown): Validated<MediaManifest> {
  const parsed = MediaManifestSchema.safeParse(raw);
  return parsed.success
    ? { value: parsed.data, issues: [] }
    : { value: null, issues: zodIssues(parsed.error) };
}

export function validateVocabSeed(raw: unknown): Validated<VocabWord[]> {
  const parsed = VocabSeedSchema.safeParse(raw);
  return parsed.success
    ? { value: parsed.data, issues: [] }
    : { value: null, issues: zodIssues(parsed.error) };
}
