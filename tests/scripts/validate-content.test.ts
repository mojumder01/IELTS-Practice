// @vitest-environment node
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadContent } from '../../scripts/content';
import { planSeed } from '../../scripts/seed-plan';

const run = promisify(execFile);
const repo = path.resolve(import.meta.dirname, '../..');
let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'ielts-content-'));
  await cp(path.join(repo, 'content'), path.join(root, 'content'), { recursive: true });
  await cp(path.join(repo, 'public/media'), path.join(root, 'public/media'), { recursive: true });
});
afterEach(() => rm(root, { recursive: true, force: true }));

async function validate() {
  try {
    const { stdout } = await run(
      'npx',
      ['tsx', path.join(repo, 'scripts/validate-content.ts'), root],
      { cwd: repo },
    );
    return { code: 0, output: stdout };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { code: e.code, output: e.stdout + e.stderr };
  }
}

describe('npm run validate', () => {
  it('passes the committed content', async () => {
    const { code, output } = await validate();
    expect(code).toBe(0);
    expect(output).toContain('✓ content/tests/book21-test1.json');
  });

  it('fails a broken file with a message naming the problem', async () => {
    const file = path.join(root, 'content/tests/book21-test1.json');
    const json = JSON.parse(await readFile(file, 'utf8')) as {
      sections: { 'reading-1': { groups: { questions: { location?: unknown }[] }[] } };
    };
    delete json.sections['reading-1'].groups[0]!.questions[0]!.location;
    await writeFile(file, JSON.stringify(json));

    const { code, output } = await validate();
    expect(code).toBe(1);
    expect(output).toContain('✗ content/tests/book21-test1.json');
    expect(output).toContain('Question 1 needs a location, or null if the answer is NOT GIVEN');
  });

  it('fails a file that isn’t JSON', async () => {
    await writeFile(path.join(root, 'content/tests/book21-test1.json'), '{ "meta": ');
    const { code, output } = await validate();
    expect(code).toBe(1);
    expect(output).toContain("isn't valid JSON");
  });

  it('flags media that skipped npm run media', async () => {
    await writeFile(path.join(root, 'public/media/audio/part2.mp3'), '');
    const { code, output } = await validate();
    expect(code).toBe(1);
    expect(output).toContain('/media/audio/part2.mp3: has no content hash yet; run npm run media');
  }, 30_000);
});

describe('planSeed', () => {
  it('writes the test, each section, the manifest and new words only', async () => {
    const plan = planSeed(await loadContent(root), 'owner123');
    expect(plan.writes.map((w) => `${w.mode} ${w.path}`)).toEqual([
      'set tests/book21-test1',
      'set tests/book21-test1/sections/listening-1',
      'set tests/book21-test1/sections/reading-1',
      'set tests/book21-test1/sections/writing',
      'set tests/book21-test1/sections/speaking',
      'set media/manifest',
      ...[
        'sustainable',
        'mitigate',
        'embodied',
        'infrastructure',
        'congestion',
        'renovate',
        'curriculum',
        'vocational',
        'obsolete',
        'well-being',
        'remuneration',
      ].map((id) => `create users/owner123/vocab/${id}`),
    ]);
  });

  it('skips vocabulary without an owner UID', async () => {
    const plan = planSeed(await loadContent(root), null);
    expect(plan.writes.some((w) => w.path.startsWith('users/'))).toBe(false);
  });
});
