import { describe, expect, it } from 'vitest';
import manifestJson from '../../content/media-manifest.json';
import sampleJson from '../../content/tests/book21-test1.json';
import vocabJson from '../../content/vocab/seed.json';
import { answerWordCount, checkTest, splitSentences } from '../../src/schema/checks';
import { decodeSection, encodeSection } from '../../src/schema/firestore';
import { MediaManifestSchema } from '../../src/schema/media';
import { TestFileSchema, type TestFile } from '../../src/schema/test';
import { formatPath, validateTestFile, validateVocabSeed } from '../../src/schema/validate';
import { vocabIdOf } from '../../src/schema/vocab';

const manifest = MediaManifestSchema.parse(manifestJson);
const sample = TestFileSchema.parse(sampleJson);

/** A fresh copy of the sample to break in one place. */
function broken(edit: (file: TestFile) => void): TestFile {
  const copy = structuredClone(sample);
  edit(copy);
  return copy;
}
const reading = (f: TestFile) => {
  const s = f.sections['reading-1'];
  if (s?.kind !== 'reading') throw new Error('sample has no reading-1');
  return s;
};
const listening = (f: TestFile) => {
  const s = f.sections['listening-1'];
  if (s?.kind !== 'listening') throw new Error('sample has no listening-1');
  return s;
};
const messages = (file: TestFile) =>
  checkTest(file, manifest).map((i) => `${i.path}: ${i.message}`);

describe('the Book 21 Test 1 sample', () => {
  it('passes the schema and every publishing check', () => {
    expect(validateTestFile(sampleJson, manifest, 'book21-test1.json').issues).toEqual([]);
  });

  it('holds the canvas sections', () => {
    expect(Object.keys(sample.sections).sort()).toEqual([
      'listening-1',
      'reading-1',
      'speaking',
      'writing',
    ]);
    expect(reading(sample).paragraphs.map((p) => p.label)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(listening(sample).script).toHaveLength(17);
  });

  it('has a valid vocabulary seed', () => {
    expect(validateVocabSeed(vocabJson).issues).toEqual([]);
  });
});

describe('splitSentences', () => {
  it('splits on . ! and ? followed by a space', () => {
    expect(splitSentences('One. Two! Three? Four')).toEqual(['One.', 'Two!', 'Three?', 'Four']);
  });

  it('keeps decimals and closing quotes with their sentence', () => {
    expect(splitSentences('It rose 3.5 times. He said “stop.” Then he left.')).toEqual([
      'It rose 3.5 times.',
      'He said “stop.”',
      'Then he left.',
    ]);
  });

  it('returns nothing for blank text', () => {
    expect(splitSentences('  ')).toEqual([]);
  });
});

describe('answerWordCount', () => {
  it('ignores optional bracketed words', () => {
    expect(answerWordCount('(the) envelope')).toBe(1);
    expect(answerWordCount('thirty-eight pounds')).toBe(2);
  });
});

describe('publishing checks', () => {
  it('needs an accepted answer for every number', () => {
    const file = broken((f) => (reading(f).groups[1]!.questions[0]!.acceptedAnswers = [[]]));
    expect(messages(file)).toContainEqual(
      expect.stringContaining('Question 6 needs at least one accepted answer'),
    );
  });

  it('rejects answers that aren’t TRUE / FALSE / NOT GIVEN', () => {
    const file = broken((f) => (reading(f).groups[0]!.questions[0]!.acceptedAnswers = [['YES']]));
    expect(messages(file)).toContainEqual(
      expect.stringContaining('"YES" isn\'t one of TRUE, FALSE, NOT GIVEN'),
    );
  });

  it('rejects multiple-choice answers that aren’t options', () => {
    const file = broken((f) => (listening(f).groups[1]!.questions[0]!.acceptedAnswers = [['D']]));
    expect(messages(file)).toContainEqual(expect.stringContaining('"D" isn\'t one of A, B, C'));
  });

  it('rejects answers over the word limit', () => {
    const file = broken(
      (f) => (reading(f).groups[1]!.questions[0]!.acceptedAnswers = [['building envelope']]),
    );
    expect(messages(file)).toContainEqual(expect.stringContaining('longer than the 1-word limit'));
  });

  it('needs every Reading answer located or marked NOT GIVEN', () => {
    const file = broken((f) => delete reading(f).groups[1]!.questions[0]!.location);
    expect(messages(file)).toContainEqual(expect.stringContaining('Question 6 needs a location'));
  });

  it('allows a null location only for NOT GIVEN', () => {
    const file = broken((f) => (reading(f).groups[0]!.questions[0]!.location = null));
    expect(messages(file)).toContainEqual(expect.stringContaining("its answer isn't NOT GIVEN"));
  });

  it('needs highlight words inside the linked sentence', () => {
    const file = broken((f) => {
      reading(f).groups[0]!.questions[0]!.location = {
        paragraph: 'A',
        sentence: 1,
        highlight: 'oil crisis',
      };
    });
    expect(messages(file)).toContainEqual(
      expect.stringContaining('"oil crisis" isn\'t in paragraph A, sentence 1'),
    );
  });

  it('reports a missing paragraph or sentence', () => {
    const file = broken((f) => {
      reading(f).groups[0]!.questions[0]!.location = {
        paragraph: 'Z',
        sentence: 1,
        highlight: 'x',
      };
      reading(f).groups[0]!.questions[1]!.location = {
        paragraph: 'B',
        sentence: 9,
        highlight: 'x',
      };
    });
    expect(messages(file)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('there is no paragraph Z'),
        expect.stringContaining('paragraph B has 3 sentences, not 9'),
      ]),
    );
  });

  it('needs each Listening answer on exactly one script line', () => {
    const file = broken((f) => {
      const script = listening(f).script;
      script[0]!.answer = { question: 1, highlight: 'Good morning' };
    });
    expect(messages(file)).toContainEqual(
      expect.stringContaining('question 1 must be marked on exactly one script line (found 2)'),
    );
  });

  it('needs script highlights inside their line', () => {
    const file = broken(
      (f) => (listening(f).script[3]!.answer = { question: 1, highlight: 'Smith' }),
    );
    expect(messages(file)).toContainEqual(expect.stringContaining('"Smith" isn\'t in the line'));
  });

  it('needs start times to increase and stay inside the audio', () => {
    const file = broken((f) => {
      listening(f).script[2]!.start = 1;
      listening(f).script[16]!.start = 120;
    });
    expect(messages(file)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('starts at 1s, not after the previous line (5s)'),
        expect.stringContaining('past the end of the 110s audio'),
      ]),
    );
  });

  it('needs question numbers without gaps or duplicates', () => {
    const file = broken((f) => {
      const q = reading(f).groups[0]!.questions;
      q[1]!.numbers = [1];
      q[2]!.numbers = [12];
    });
    expect(messages(file)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('question 1 appears more than once'),
        expect.stringContaining('question numbers skip 2, 3, 10, 11'),
      ]),
    );
  });

  it('needs a gap in the layout for every question in the group', () => {
    const file = broken((f) => {
      const layout = reading(f).groups[1]!.layout!;
      layout.body = layout.body.replace('{{9}}', '___');
    });
    expect(messages(file)).toContainEqual(
      expect.stringContaining('has no {{9}} gap for question 9'),
    );
  });

  it('needs every media path in the manifest', () => {
    const file = broken((f) => (listening(f).audio = '/media/audio/b21t1-p1.00000000.mp3'));
    expect(messages(file)).toContainEqual(
      expect.stringContaining("isn't in content/media-manifest.json"),
    );
  });

  it('needs the audio duration to match the file', () => {
    const file = broken((f) => (listening(f).durationSec = 95));
    expect(messages(file)).toContainEqual(expect.stringContaining('the audio file is 110.1s long'));
  });

  it('needs a Task 1 image description', () => {
    const file = broken((f) => {
      if (f.sections.writing?.kind === 'writing') f.sections.writing.task1.imageDescription = '';
    });
    expect(messages(file)).toContainEqual(
      expect.stringContaining('Task 1 image needs a description'),
    );
  });

  it('checks 1–40 only once every part of a module exists', () => {
    expect(messages(sample).some((m) => m.includes('1–40'))).toBe(false);
  });
});

describe('validateTestFile', () => {
  it('reports schema errors with their path', () => {
    const raw = structuredClone(sampleJson) as { meta: { track: string } };
    raw.meta.track = 'ielts';
    const { value, issues } = validateTestFile(raw, manifest);
    expect(value).toBeNull();
    expect(issues[0]?.path).toBe('meta.track');
  });

  it('rejects a section stored under the wrong key', () => {
    const raw = structuredClone(sampleJson) as { sections: Record<string, unknown> };
    raw.sections['reading-2'] = raw.sections['reading-1'];
    expect(validateTestFile(raw, manifest).issues).toContainEqual({
      path: 'sections.reading-2',
      message: 'holds a reading-1 section; its key must be "reading-1"',
    });
  });

  it('wants the file named after its test ID', () => {
    expect(validateTestFile(sampleJson, manifest, 'test1.json').issues[0]?.message).toContain(
      'should be named book21-test1.json',
    );
  });

  it('formats paths the way the checks do', () => {
    expect(formatPath(['sections', 'reading-1', 'groups', 0, 'questions', 2])).toBe(
      'sections.reading-1.groups[0].questions[2]',
    );
  });
});

describe('Firestore encoding', () => {
  it('stores no array inside an array and decodes back exactly', () => {
    for (const section of Object.values(sample.sections)) {
      const stored = encodeSection(section);
      expect(JSON.stringify(stored)).not.toMatch(/\[\s*\[/);
      expect(decodeSection(stored)).toEqual(section);
    }
  });

  it('refuses a document that isn’t a valid section', () => {
    expect(() => decodeSection({ kind: 'reading' })).toThrow();
  });
});

describe('vocabulary', () => {
  it('derives document IDs from words', () => {
    expect(vocabIdOf('well-being')).toBe('well-being');
    expect(vocabIdOf(' Carbon Footprint ')).toBe('carbon-footprint');
  });

  it('rejects duplicate words', () => {
    const words = [vocabJson[0], vocabJson[0]];
    expect(validateVocabSeed(words).issues[0]?.message).toContain('duplicates entry 0');
  });
});
