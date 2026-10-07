import { describe, expect, it } from 'vitest';
import manifestJson from '../../../content/media-manifest.json';
import sampleJson from '../../../content/tests/book21-test1.json';
import { checklist } from '../../../src/admin/draft';
import {
  bookToTest,
  cellSeconds,
  formatAnswers,
  KEEP_IMAGE,
  parseAnswers,
  parseNumbers,
  parseOptions,
  parseType,
  resolveMedia,
  SHEETS,
  templateBook,
  testToBook,
  type Cell,
  type Grid,
} from '../../../src/admin/sheets';
import { MediaManifestSchema } from '../../../src/schema/media';
import { TestFileSchema, type TestFile } from '../../../src/schema/test';

const sample = TestFileSchema.parse(sampleJson);
const manifest = MediaManifestSchema.parse(manifestJson);

/** The sample with group IDs as the workbook names them and the status a new draft gets. */
function asImported(test: TestFile): TestFile {
  const copy = structuredClone(test);
  copy.meta.status = 'draft';
  for (const [id, section] of Object.entries(copy.sections)) {
    if (section && 'groups' in section) {
      section.groups.forEach((g, i) => {
        g.groupId = `${id.startsWith('listening') ? 'L' : 'R'}${section.part}-${String.fromCharCode(65 + i)}`;
      });
    }
  }
  return copy;
}

function sheet(grids: Grid[], name: string): Grid {
  return grids.find((g) => g.name === name)!;
}

/** The template with rows added under a sheet's header. */
function filled(rows: Partial<Record<string, Cell[][]>>): Grid[] {
  const book = templateBook();
  for (const g of book) {
    if (g.name === SHEETS.test) {
      g.rows = g.rows.map((r) =>
        r[0] === 'Book' ? ['Book', 'Book 30'] : r[0] === 'Test number' ? ['Test number', 2] : r,
      );
    }
    const extra = rows[g.name];
    if (extra) g.rows = [...g.rows, ...extra];
  }
  return book;
}

describe('workbook round trip', () => {
  it('turns the sample into a workbook and back without losing anything', () => {
    const { draft, problems } = bookToTest(testToBook(sample), manifest);
    expect(problems).toEqual([]);
    expect(draft).toEqual(asImported(sample));
  });

  it('gives the round-tripped sample a clean publish checklist', () => {
    const { draft } = bookToTest(testToBook(sample), manifest);
    expect(checklist(draft!, manifest).every((i) => i.ok)).toBe(true);
  });

  it('shows media by their upload names', () => {
    const book = testToBook(sample);
    expect(sheet(book, SHEETS.listening).rows[1]![1]).toBe('b21t1-p1.mp3');
    expect(sheet(book, SHEETS.writing).rows[2]![1]).toBe('b21t1-w1.png');
  });

  it('keeps an image stored in the app when the cell says so', () => {
    const withData = structuredClone(sample);
    const writing = withData.sections.writing;
    if (writing?.kind !== 'writing') throw new Error('sample has writing');
    writing.task1.image = 'data:image/png;base64,AAAA';
    const book = testToBook(withData);
    expect(sheet(book, SHEETS.writing).rows[2]![1]).toBe(KEEP_IMAGE);
    const { draft } = bookToTest(book, manifest, withData);
    const back = draft!.sections.writing;
    expect(back?.kind === 'writing' && back.task1.image).toBe('data:image/png;base64,AAAA');
  });
});

describe('the template', () => {
  it('has every sheet, with a header and one sample row in each table', () => {
    const book = templateBook();
    expect(book.map((g) => g.name)).toEqual(Object.values(SHEETS));
    for (const name of [
      SHEETS.listening,
      SHEETS.script,
      SHEETS.passages,
      SHEETS.groups,
      SHEETS.questions,
      SHEETS.speaking,
    ]) {
      const rows = sheet(book, name).rows;
      expect(rows).toHaveLength(2);
      expect(String(rows[1]![0])).toMatch(/^e\.g\. /);
    }
    expect(sheet(book, SHEETS.test).rows[0]).toEqual(['Field', 'Value', 'Example']);
    expect(sheet(book, SHEETS.writing).rows[2]).toEqual(['Task 1 image', '', 'b22t1-w1.png']);
  });

  it('skips the sample rows when the template is uploaded as it is', () => {
    const { draft, problems } = bookToTest(filled({}), manifest);
    expect(Object.keys(draft!.sections)).toEqual([]);
    expect(problems.map((p) => p.message)).toEqual([
      'The file has no sections: fill in at least one sheet.',
    ]);
  });

  it('reads the sample rows as a small test once "e.g." is typed over', () => {
    const book = filled({});
    for (const g of book) {
      const first = g.rows[1]?.[0];
      if (typeof first === 'string' && first.startsWith('e.g. ')) g.rows[1]![0] = first.slice(5);
    }
    sheet(book, SHEETS.writing).rows = sheet(book, SHEETS.writing).rows.map((r, i) =>
      i === 0 ? r : [r[0]!, r[2]!],
    );
    const { draft, problems } = bookToTest(book, manifest);
    expect(problems).toEqual([]);
    expect(Object.keys(draft!.sections)).toEqual([
      'listening-1',
      'reading-1',
      'writing',
      'speaking',
    ]);
    expect(draft!.sections['reading-1']).toMatchObject({
      title: 'Urban Bees',
      groups: [
        {
          groupId: 'R1-A',
          questions: [
            {
              numbers: [1],
              acceptedAnswers: [['TRUE']],
              location: { paragraph: 'A', sentence: 2 },
            },
          ],
        },
      ],
    });
    expect(draft!.sections['listening-1']).toMatchObject({
      durationSec: 400,
      script: [{ start: 14, speaker: 'Woman', answer: { question: 1, highlight: 'Morgan' } }],
    });
  });

  it('marks time columns as text', () => {
    expect(sheet(templateBook(), SHEETS.script).textColumns).toEqual([1]);
  });

  it('needs a book and test number before anything else', () => {
    const { draft, problems } = bookToTest(templateBook(), manifest);
    expect(draft).toBeNull();
    expect(problems.map((p) => p.message)).toEqual([
      'Book is empty.',
      'Test number needs a whole number.',
    ]);
  });

  it('says so when a file has no sections', () => {
    const { draft, problems } = bookToTest(filled({}), manifest);
    expect(draft?.meta.testId).toBe('book30-test2');
    expect(problems).toEqual([
      {
        sheet: 'Test',
        row: null,
        message: 'The file has no sections: fill in at least one sheet.',
      },
    ]);
  });
});

describe('filling it in', () => {
  it('builds a reading passage with groups and questions', () => {
    const { draft, problems } = bookToTest(
      filled({
        [SHEETS.passages]: [
          [1, 'Bees', 'A short history', '', 'Bees dance. They tell others where food is.'],
          [1, '', '', '', 'Hives hold thousands.'],
        ],
        [SHEETS.groups]: [
          [
            'R1-A',
            'Reading',
            1,
            'TFNG',
            'Do the statements agree?',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
          ],
        ],
        [SHEETS.questions]: [
          ['R1-A', 1, 'Bees dance.', '', 'TRUE', '', 'A', 1, 'Bees dance.'],
          ['R1-A', '2', 'Bees sing.', '', 'NOT GIVEN', '', 'Not given', '', ''],
        ],
      }),
      manifest,
    );
    expect(problems).toEqual([]);
    const reading = draft!.sections['reading-1'];
    expect(reading).toMatchObject({
      title: 'Bees',
      subtitle: 'A short history',
      paragraphs: [
        { label: 'A', text: 'Bees dance. They tell others where food is.' },
        { label: 'B', text: 'Hives hold thousands.' },
      ],
      groups: [
        {
          groupId: 'R1-A',
          type: 'TRUE_FALSE_NOT_GIVEN',
          questions: [
            {
              numbers: [1],
              acceptedAnswers: [['TRUE']],
              location: { paragraph: 'A', sentence: 1, highlight: 'Bees dance.' },
            },
            { numbers: [2], acceptedAnswers: [['NOT GIVEN']], location: null },
          ],
        },
      ],
    });
  });

  it('builds listening from the audio name, the script and a two-answer question', () => {
    const { draft, problems } = bookToTest(
      filled({
        [SHEETS.listening]: [[1, 'B21T1 P1.mp3', '', 'A phone call']],
        [SHEETS.script]: [
          [1, '0:00', 'Anna', 'Hello.', '', ''],
          [1, '0:05', 'Ben', 'I need B and D.', 1, 'B and D'],
          [1, '', '', 'Thanks.', '', ''],
        ],
        [SHEETS.groups]: [
          [
            'L1-A',
            'listening',
            1,
            'Multiple choice (more than one answer)',
            'Choose TWO letters.',
            '',
            '',
            '',
            '',
            '',
            '',
            'A. one\nB. two\nC. three\nD. four',
            '',
          ],
        ],
        [SHEETS.questions]: [['L1-A', '1-2', 'Which two?', '', 'B | D; B | D', '', '', '', '']],
      }),
      manifest,
    );
    expect(problems).toEqual([]);
    const listening = draft!.sections['listening-1'];
    expect(listening).toMatchObject({
      audio: '/media/audio/b21t1-p1.28d1e3ca.mp3',
      durationSec: manifest.files.find((f) => f.kind === 'audio')!.durationSec,
      context: 'A phone call',
      script: [
        { start: 0, speaker: 'Anna', text: 'Hello.' },
        {
          start: 5,
          speaker: 'Ben',
          text: 'I need B and D.',
          answer: { question: 1, highlight: 'B and D' },
        },
        { start: 5, speaker: 'Ben', text: 'Thanks.' },
      ],
    });
    expect(listening && 'groups' in listening && listening.groups[0]).toMatchObject({
      options: [
        { key: 'A', text: 'one' },
        { key: 'B', text: 'two' },
        { key: 'C', text: 'three' },
        { key: 'D', text: 'four' },
      ],
      questions: [
        {
          numbers: [1, 2],
          acceptedAnswers: [
            ['B', 'D'],
            ['B', 'D'],
          ],
        },
      ],
    });
  });

  it('reads writing and speaking', () => {
    const book = filled({
      [SHEETS.speaking]: [
        [1, '', 'Where do you live?'],
        [2, 'Topic', 'Describe a park.'],
        [2, 'Point', 'where it is'],
        [2, 'Closing', 'and explain why you like it.'],
        [3, '', 'Why do cities need parks?'],
      ],
    });
    sheet(book, SHEETS.writing).rows[5] = ['Task 2 question', 'Discuss both views.'];
    const { draft, problems } = bookToTest(book, manifest);
    expect(problems).toEqual([]);
    expect(draft!.sections.writing).toMatchObject({
      task1: { prompt: '', image: '', minWords: 150 },
      task2: { prompt: 'Discuss both views.', minWords: 250 },
    });
    expect(draft!.sections.speaking).toMatchObject({
      part1: ['Where do you live?'],
      part2: {
        topic: 'Describe a park.',
        points: ['where it is'],
        closing: 'and explain why you like it.',
      },
      part3: ['Why do cities need parks?'],
    });
  });

  // Row 2 of each sheet is the template's sample row, so these rows start at 3.
  it('reports what it can’t read, by sheet and row', () => {
    const { problems } = bookToTest(
      filled({
        [SHEETS.groups]: [
          ['R1-A', 'Reading', 4, 'TFNG', '', '', '', '', '', '', '', '', ''],
          ['R1-B', 'Reading', 1, 'Crossword', '', '', '', '', '', '', '', '', ''],
          ['R1-C', 'Reading', 1, 'Short answer', '', '', '9', 'maybe', '', '', '', '', ''],
        ],
        [SHEETS.questions]: [
          ['R1-Z', 1, '', '', 'x', '', '', '', ''],
          ['R1-C', '41', '', '', 'x', '', '', '', ''],
          ['R1-C', '3-4', '', '', 'only one', '', '', '', ''],
          ['R1-C', '5', '', '', 'x', '', 'B', '', ''],
        ],
      }),
      manifest,
    );
    expect(problems).toEqual([
      { sheet: 'Groups', row: 3, message: 'Part needs a number from 1 to 3.' },
      {
        sheet: 'Groups',
        row: 4,
        message: '"Crossword" isn\'t a question type: see the list on How to fill.',
      },
      { sheet: 'Groups', row: 5, message: 'Max words is a number from 1 to 5.' },
      { sheet: 'Groups', row: 5, message: 'Numbers allowed is Yes or No.' },
      { sheet: 'Questions', row: 3, message: "Group R1-Z isn't on the Groups sheet." },
      {
        sheet: 'Questions',
        row: 4,
        message: 'Number is like 7, or 21-22 for a question with two answers.',
      },
      {
        sheet: 'Questions',
        row: 5,
        message: 'Answer needs 2 parts separated by ";", one for each number.',
      },
      {
        sheet: 'Questions',
        row: 6,
        message:
          'Paragraph, Sentence and Answer words go together (or write Not given in Paragraph).',
      },
    ]);
  });

  it('flags a missing column', () => {
    const book = filled({});
    sheet(book, SHEETS.speaking).rows[0] = ['Part', 'Text'];
    expect(bookToTest(book, manifest).problems[0]).toEqual({
      sheet: 'Speaking',
      row: 1,
      message: 'The "Kind" column is missing.',
    });
  });
});

describe('cells', () => {
  it('reads times typed as text, numbers and spreadsheet clock times', () => {
    expect(cellSeconds('1:05')).toBe(65);
    expect(cellSeconds(65)).toBe(65);
    expect(cellSeconds(new Date(Date.UTC(1899, 11, 30, 1, 5)))).toBe(65);
    expect(cellSeconds((1 * 60 + 5) / (24 * 60))).toBe(65);
    expect(cellSeconds('soon')).toBeNull();
    expect(cellSeconds('')).toBeNull();
  });

  it('reads question numbers', () => {
    expect(parseNumbers('7')).toEqual([7]);
    expect(parseNumbers('21-22')).toEqual([21, 22]);
    expect(parseNumbers('21, 22, 23')).toEqual([21, 22, 23]);
    expect(parseNumbers('21 and 22')).toEqual([21, 22]);
    expect(parseNumbers('0')).toBeNull();
    expect(parseNumbers('1-5')).toBeNull();
    expect(parseNumbers('seven')).toBeNull();
  });

  it('reads answers with alternatives', () => {
    expect(parseAnswers('colour | color')).toEqual([['colour', 'color']]);
    expect(parseAnswers('B; D')).toEqual([['B'], ['D']]);
    expect(parseAnswers('')).toEqual([]);
    expect(formatAnswers([['colour', 'color'], ['D']])).toBe('colour | color; D');
  });

  it('reads options on lines or separated by semicolons', () => {
    expect(parseOptions('A. one\nB) two')).toEqual([
      { key: 'A', text: 'one' },
      { key: 'B', text: 'two' },
    ]);
    expect(parseOptions('i: The start; ii: The end')).toEqual([
      { key: 'i', text: 'The start' },
      { key: 'ii', text: 'The end' },
    ]);
    expect(parseOptions('just words')).toBeNull();
  });

  it('reads question types by label, code or short name', () => {
    expect(parseType('Gap fill')).toBe('GAP_FILL');
    expect(parseType('MATCHING_HEADINGS')).toBe('MATCHING_HEADINGS');
    expect(parseType('true/false/not given')).toBe('TRUE_FALSE_NOT_GIVEN');
    expect(parseType('Completion')).toBe('GAP_FILL');
    expect(parseType('Crossword')).toBeNull();
  });

  it('finds uploaded media by name', () => {
    expect(resolveMedia('b21t1-p1.mp3', 'audio', manifest)).toBe(
      '/media/audio/b21t1-p1.28d1e3ca.mp3',
    );
    expect(resolveMedia('B21T1 P1', 'audio', manifest)).toBe('/media/audio/b21t1-p1.28d1e3ca.mp3');
    expect(resolveMedia('b21t1-w1.png', 'img', manifest)).toBe('/media/img/b21t1-w1.2e4b8323.png');
    expect(resolveMedia('new-part.mp3', 'audio', manifest)).toBe('/media/audio/new-part.mp3');
    expect(resolveMedia('', 'audio', null)).toBe('/media/audio/');
  });
});
