import { describe, expect, it } from 'vitest';
import manifestJson from '../../../content/media-manifest.json';
import sampleJson from '../../../content/tests/book21-test1.json';
import {
  badTimes,
  blankGroup,
  blankReading,
  blankTest,
  canPublish,
  checklist,
  diffTests,
  formatPassage,
  formatTime,
  nextNumber,
  parsePassage,
  parseScript,
  parseTime,
  passageSentences,
  testIdFor,
  toggleLocation,
} from '../../../src/admin/draft';
import { MediaManifestSchema } from '../../../src/schema/media';
import { TestFileSchema, type TestFile } from '../../../src/schema/test';

const sample = TestFileSchema.parse(sampleJson);
const manifest = MediaManifestSchema.parse(manifestJson);

describe('new tests', () => {
  it('names a test from its book and number', () => {
    expect(testIdFor('Book 21', 2)).toBe('book21-test2');
    expect(testIdFor('Cambridge 19 General', 1)).toBe('cambridge19general-test1');
  });

  it('starts a draft with the usual timings and no sections', () => {
    const t = blankTest('Book 22', 1, 'academic');
    expect(t.meta).toMatchObject({ testId: 'book22-test1', status: 'draft', track: 'academic' });
    expect(t.meta.timing.reading.fullMockMin).toBe(60);
    expect(t.sections).toEqual({});
  });

  it('numbers a new group after the last question', () => {
    const group = blankGroup('TRUE_FALSE_NOT_GIVEN', 1, 5, 'g1');
    expect(group.questions.map((q) => q.numbers)).toEqual([[1], [2], [3], [4], [5]]);
    expect(nextNumber([group], 1)).toBe(6);
    expect(nextNumber([], 14)).toBe(14);
    expect(blankGroup('GAP_FILL', 6, 1, 'g2')).toMatchObject({ maxWords: 1 });
  });
});

describe('passage text', () => {
  it('reads [A] [B] paragraphs and writes them back', () => {
    const text = '[A] First one. Second one.\n\n[B] Third\nline joined.';
    const paragraphs = parsePassage(text);
    expect(paragraphs).toEqual([
      { label: 'A', text: 'First one. Second one.' },
      { label: 'B', text: 'Third line joined.' },
    ]);
    expect(formatPassage(paragraphs)).toBe('[A] First one. Second one.\n\n[B] Third line joined.');
    expect(parsePassage('No labels.\n\nStill none.').map((p) => p.label)).toEqual(['A', 'B']);
  });

  it('splits sentences for linking, and toggles a link', () => {
    const [a] = passageSentences([{ label: 'A', text: 'One here. Two there! Three?' }]);
    expect(a!.sentences).toEqual(['One here.', 'Two there!', 'Three?']);
    const linked = toggleLocation(undefined, 'A', 2, 'Two there!');
    expect(linked).toEqual({ paragraph: 'A', sentence: 2, highlight: 'Two there!' });
    expect(toggleLocation(linked, 'A', 2, 'Two there!')).toBeUndefined();
    expect(toggleLocation(linked, 'A', 3, 'Three?')).toMatchObject({ sentence: 3 });
    expect(toggleLocation(null, 'B', 1, 'x')).toMatchObject({ paragraph: 'B' });
  });
});

describe('audioscript', () => {
  it('reads and writes m:ss times', () => {
    expect(parseTime('1:05')).toBe(65);
    expect(parseTime('0:14.5')).toBe(14.5);
    expect(parseTime('75')).toBe(75);
    expect(parseTime('1:75')).toBeNull();
    expect(parseTime('soon')).toBeNull();
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(14.5)).toBe('0:14.5');
  });

  it('turns a pasted script into lines', () => {
    const lines = parseScript(
      '0:00 Receptionist: Good morning.\n\n0:05 Daniel: Hi there.\nI’d like to join.\nReceptionist: Lovely.',
    );
    expect(lines).toEqual([
      { start: 0, speaker: 'Receptionist', text: 'Good morning.' },
      { start: 5, speaker: 'Daniel', text: 'Hi there.' },
      { start: 5, speaker: 'Daniel', text: 'I’d like to join.' },
      { start: 5, speaker: 'Receptionist', text: 'Lovely.' },
    ]);
  });

  it('flags times out of order or past the end', () => {
    const lines = [0, 5, 5, 3, 12].map((start) => ({ start, speaker: 'S', text: 't' }));
    expect([...badTimes(lines, 10)]).toEqual([2, 3, 4]);
  });
});

describe('before publishing', () => {
  it('passes the sample test', () => {
    const items = checklist(sample, manifest);
    expect(items.every((i) => i.ok)).toBe(true);
    expect(canPublish(items)).toBe(true);
  });

  it('holds everything else until the schema passes', () => {
    const draft = blankTest('Book 22', 1, 'academic');
    draft.sections['reading-1'] = blankReading(1);
    const items = checklist(draft, manifest);
    const schema = items.find((i) => i.id === 'schema')!;
    expect(schema.ok).toBe(false);
    expect(schema.issues.length).toBeGreaterThan(0);
    expect(items.filter((i) => i.id !== 'schema').every((i) => i.ok === null)).toBe(true);
    expect(canPublish(items)).toBe(false);
  });

  it('sorts problems into the checklist', () => {
    const broken = structuredClone<TestFile>(sample);
    const reading = broken.sections['reading-1']!;
    if (reading.kind !== 'reading') throw new Error('sample changed');
    reading.groups[0]!.questions[0]!.location = undefined; // Q1 loses its location
    const listening = broken.sections['listening-1']!;
    if (listening.kind !== 'listening') throw new Error('sample changed');
    listening.script[3]!.start = 0; // out of order
    if (broken.sections.writing?.kind === 'writing')
      broken.sections.writing.task1.imageDescription = '';
    const items = checklist(broken, manifest);
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId.locations!.ok).toBe(false);
    expect(byId.times!.ok).toBe(false);
    expect(byId.image!.ok).toBe(false);
    expect(byId.answers!.ok).toBe(true);
    expect(byId.media!.ok).toBe(true);
    expect(canPublish(items)).toBe(false);
    expect(checklist(sample, null).find((i) => i.id === 'media')!.ok).toBe(false);
  });
});

describe('import diff', () => {
  it('lists changed settings and added, removed or changed sections', () => {
    const after = structuredClone<TestFile>(sample);
    after.meta.testNumber = 2;
    delete after.sections.speaking;
    if (after.sections.writing?.kind === 'writing') after.sections.writing.task2.minWords = 260;
    after.sections['reading-2'] = blankReading(2);
    expect(diffTests(sample, after)).toEqual([
      { path: 'meta.testNumber', change: 'changed' },
      { path: 'sections.reading-2', change: 'added' },
      { path: 'sections.speaking', change: 'removed' },
      { path: 'sections.writing', change: 'changed' },
    ]);
    expect(diffTests(sample, sample)).toEqual([]);
  });
});
