import type { MediaManifest } from '../schema/media';
import {
  QUESTION_TYPES,
  SECTION_IDS,
  type AnswerLocation,
  type GapLayout,
  type ListeningSection,
  type QuestionGroup,
  type QuestionType,
  type ReadingSection,
  type ScriptLine,
  type SectionId,
  type SpeakingSection,
  type TestFile,
  type TestMeta,
  type WritingSection,
} from '../schema/test';
import {
  blankListening,
  blankReading,
  blankSpeaking,
  blankTest,
  blankWriting,
  formatTime,
  parseTime,
} from './draft';

// Bulk upload (admin): a test as an Excel workbook, one sheet per kind of row, and back. Pure:
// src/admin/xlsx.ts does the file reading and writing. A workbook becomes a draft like one typed
// into the editor, so it can still be incomplete: the publish checklist says what's missing. What
// stops a file here is only what can't be understood (an unknown type, a bad question number).

export type Cell = string | number | boolean | Date | null;

export interface Grid {
  name: string;
  rows: Cell[][];
  /** Columns (0-based) kept as text so Excel doesn't turn "1:05" into a clock time. */
  textColumns?: number[];
  /** Column widths in characters. */
  widths?: number[];
}

export interface SheetProblem {
  sheet: string;
  /** The Excel row number (the header is row 1); null for the whole sheet. */
  row: number | null;
  message: string;
}

export const SHEETS = {
  help: 'How to fill',
  test: 'Test',
  listening: 'Listening',
  script: 'Script',
  passages: 'Passages',
  groups: 'Groups',
  questions: 'Questions',
  writing: 'Writing',
  speaking: 'Speaking',
} as const;

const LISTENING_COLS = ['Part', 'Audio file', 'Length (m:ss)', 'Context'] as const;
const SCRIPT_COLS = [
  'Part',
  'Time (m:ss)',
  'Speaker',
  'Words',
  'Answer to question',
  'Answer words',
] as const;
const PASSAGE_COLS = ['Part', 'Title', 'Subtitle', 'Paragraph', 'Text'] as const;
const GROUP_COLS = [
  'Group',
  'Module',
  'Part',
  'Type',
  'Instructions',
  'Word limit',
  'Max words',
  'Numbers allowed',
  'Layout',
  'Layout title',
  'Layout text',
  'Options',
  'Answers per item',
] as const;
const QUESTION_COLS = [
  'Group',
  'Number',
  'Question',
  'Options',
  'Answer',
  'Explanation',
  'Paragraph',
  'Sentence',
  'Answer words',
] as const;
const SPEAKING_COLS = ['Part', 'Kind', 'Text'] as const;

/** How a type is written in the Type column; its code works too. */
export const TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE_SINGLE: 'Multiple choice (one answer)',
  MULTIPLE_CHOICE_MULTIPLE: 'Multiple choice (more than one answer)',
  TRUE_FALSE_NOT_GIVEN: 'True / False / Not Given',
  YES_NO_NOT_GIVEN: 'Yes / No / Not Given',
  MATCHING_HEADINGS: 'Matching headings',
  MATCHING_PARAGRAPH_INFO: 'Matching information to paragraphs',
  MATCHING_FEATURES: 'Matching features',
  MATCHING_SENTENCE_ENDINGS: 'Matching sentence endings',
  GAP_FILL: 'Gap fill',
  DIAGRAM_LABEL: 'Diagram labelling',
  SHORT_ANSWER: 'Short answer',
};

const LAYOUTS: GapLayout['kind'][] = ['summary', 'notes', 'table', 'form', 'flow'];

/** In the Writing sheet's image cell when the image is stored in the app, not as a media file. */
export const KEEP_IMAGE = '(image stored in the app: leave this to keep it)';

type TimingField = {
  label: string;
  get: (m: TestMeta) => number;
  set: (m: TestMeta, v: number) => void;
};
type HelpField = {
  label: string;
  get: (m: TestMeta) => boolean;
  set: (m: TestMeta, v: boolean) => void;
};

const TIMING_FIELDS: TimingField[] = [
  {
    label: 'Listening minutes per part',
    get: (m) => m.timing.listening.singlePartMin,
    set: (m, v) => (m.timing.listening.singlePartMin = v),
  },
  {
    label: 'Listening full test minutes',
    get: (m) => m.timing.listening.fullMockMin,
    set: (m, v) => (m.timing.listening.fullMockMin = v),
  },
  {
    label: 'Listening check minutes',
    get: (m) => m.timing.listening.checkMin,
    set: (m, v) => (m.timing.listening.checkMin = v),
  },
  {
    label: 'Reading minutes per passage',
    get: (m) => m.timing.reading.singlePartMin,
    set: (m, v) => (m.timing.reading.singlePartMin = v),
  },
  {
    label: 'Reading full test minutes',
    get: (m) => m.timing.reading.fullMockMin,
    set: (m, v) => (m.timing.reading.fullMockMin = v),
  },
  {
    label: 'Writing Task 1 minutes',
    get: (m) => m.timing.writing.task1Min,
    set: (m, v) => (m.timing.writing.task1Min = v),
  },
  {
    label: 'Writing Task 2 minutes',
    get: (m) => m.timing.writing.task2Min,
    set: (m, v) => (m.timing.writing.task2Min = v),
  },
  {
    label: 'Writing full test minutes',
    get: (m) => m.timing.writing.fullMockMin,
    set: (m, v) => (m.timing.writing.fullMockMin = v),
  },
];

const HELP_FIELDS: HelpField[] = [
  {
    label: 'Students can show answers',
    get: (m) => m.studentHelp.allowReveal,
    set: (m, v) => (m.studentHelp.allowReveal = v),
  },
  {
    label: 'Show the script in single-part practice',
    get: (m) => m.studentHelp.showScriptInSinglePart,
    set: (m, v) => (m.studentHelp.showScriptInSinglePart = v),
  },
  {
    label: 'Lock the audio in a full test',
    get: (m) => m.studentHelp.lockAudioInFullMock,
    set: (m, v) => (m.studentHelp.lockAudioInFullMock = v),
  },
];

const WRITING_FIELDS = [
  'Task 1 question',
  'Task 1 image',
  'Task 1 image description',
  'Task 1 minimum words',
  'Task 2 question',
  'Task 2 minimum words',
  'Task 2 model answer',
] as const;

// ---- Cells -----------------------------------------------------------------------------------

/** A cell as trimmed text: "" when empty. */
export function cellText(cell: Cell | undefined): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'string') return cell.trim();
  if (typeof cell === 'number') return String(cell);
  if (typeof cell === 'boolean') return cell ? 'Yes' : 'No';
  return cell.toISOString();
}

/**
 * Seconds from a time cell. "1:05" typed as text is 65. If a spreadsheet still turned it into a
 * clock time (1 h 05 min), that's read back as the minutes and seconds that were meant.
 */
export function cellSeconds(cell: Cell | undefined): number | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (cell instanceof Date) return cell.getUTCHours() * 60 + cell.getUTCMinutes();
  if (typeof cell === 'number') {
    if (cell > 0 && cell < 1) {
      const minutes = Math.round(cell * 24 * 60); // a clock fraction of a day
      return Math.floor(minutes / 60) * 60 + (minutes % 60);
    }
    return cell >= 0 ? cell : null;
  }
  return typeof cell === 'string' ? parseTime(cell) : null;
}

function yesNo(text: string): boolean | null | undefined {
  if (!text) return undefined;
  if (/^(y|yes|true|1)$/i.test(text)) return true;
  if (/^(n|no|false|0)$/i.test(text)) return false;
  return null;
}

function wholeNumber(text: string): number | null {
  return /^\d+$/.test(text) ? Number(text) : null;
}

/** "21", "21-22" or "21, 22" → [21, 22]; null when it isn't 1–3 numbers from 1 to 40. */
export function parseNumbers(text: string): number[] | null {
  const t = text.trim();
  let numbers: number[];
  const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(t);
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])];
    if (b < a || b - a > 2) return null;
    numbers = Array.from({ length: b - a + 1 }, (_, i) => a + i);
  } else {
    const parts = t.split(/\s*(?:,|;|\band\b|\s)\s*/).filter(Boolean);
    if (!parts.length || parts.some((p) => !/^\d+$/.test(p))) return null;
    numbers = parts.map(Number);
  }
  if (numbers.length > 3 || numbers.some((n) => n < 1 || n > 40)) return null;
  return numbers;
}

/** "Paris | paris city; London" → [["Paris", "paris city"], ["London"]]. */
export function parseAnswers(text: string): string[][] {
  if (!text.trim()) return [];
  return text.split(';').map((part) =>
    part
      .split('|')
      .map((a) => a.trim())
      .filter(Boolean),
  );
}

export function formatAnswers(lists: string[][]): string {
  return lists.map((l) => l.join(' | ')).join('; ');
}

/** "A. text" lines (or "A) text", "i: text"), one per line or separated by ";". */
export function parseOptions(text: string): { key: string; text: string }[] | null {
  const lines = text.includes('\n') ? text.split('\n') : text.split(';');
  const items = lines.map((l) => l.trim()).filter(Boolean);
  const out: { key: string; text: string }[] = [];
  for (const item of items) {
    const m = /^([A-Za-z]{1,2}|[ivxlIVXL]{1,6}|\d{1,2})\s*[.):]\s*(.+)$/.exec(item);
    if (!m) return null;
    out.push({ key: m[1]!, text: m[2]!.trim() });
  }
  return out;
}

export function formatOptions(options: { key: string; text: string }[]): string {
  return options.map((o) => `${o.key}. ${o.text}`).join('\n');
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** A Type cell → its code: the label, the code, or the name Results uses. */
export function parseType(text: string): QuestionType | null {
  const key = normalise(text);
  if (!key) return null;
  for (const type of QUESTION_TYPES) {
    if (normalise(type) === key || normalise(TYPE_LABELS[type]) === key) return type;
  }
  if (['multiplechoice', 'mcq'].includes(key)) return 'MULTIPLE_CHOICE_SINGLE';
  if (['tfng', 'truefalsenotgiven'].includes(key)) return 'TRUE_FALSE_NOT_GIVEN';
  if (['ynng', 'yesnonotgiven'].includes(key)) return 'YES_NO_NOT_GIVEN';
  if (['completion', 'gapfilling', 'sentencecompletion', 'summarycompletion'].includes(key))
    return 'GAP_FILL';
  return null;
}

/** A file name or Hosting path → the manifest's path for it, when the file has been added. */
export function resolveMedia(
  name: string,
  kind: 'audio' | 'img',
  manifest: MediaManifest | null,
): string {
  const t = name.trim();
  if (!t) return kind === 'audio' ? '/media/audio/' : '';
  if (t.startsWith('/media/') || t.startsWith('data:')) return t;
  // The stem npm run media gives a file: "B21T1 P1.mp3" → "b21t1-p1".
  const stem = t
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\.[0-9a-f]{8}$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const match = manifest?.files.find(
    (f) => f.path.startsWith(`/media/${kind}/`) && f.path.split('/').pop()?.split('.')[0] === stem,
  );
  return match?.path ?? `/media/${kind}/${t}`;
}

/** The name to show for a Hosting path: "b21t1-p1.28d1e3ca.mp3" → "b21t1-p1.mp3". */
function mediaName(path: string): string {
  const base = path.split('/').pop() ?? '';
  const m = /^(.+)\.[0-9a-f]{8}\.(\w+)$/.exec(base);
  return m ? `${m[1]}.${m[2]}` : base;
}

// ---- Workbook → draft ------------------------------------------------------------------------

interface Table {
  name: string;
  /** Data rows with their Excel row numbers; blank rows are left out. */
  rows: { row: number; get: (col: string) => Cell }[];
}

function table(
  grid: Grid | undefined,
  name: string,
  columns: readonly string[],
  problems: SheetProblem[],
): Table {
  if (!grid) return { name, rows: [] };
  const header = (grid.rows[0] ?? []).map((c) => normalise(cellText(c)));
  const index = new Map<string, number>();
  for (const col of columns) {
    const i = header.indexOf(normalise(col));
    if (i === -1)
      problems.push({ sheet: name, row: 1, message: `The "${col}" column is missing.` });
    else index.set(col, i);
  }
  const rows = grid.rows
    .slice(1)
    .flatMap((cells, i) =>
      cells.some((c) => cellText(c) !== '')
        ? [{ row: i + 2, get: (col: string) => cells[index.get(col) ?? -1] ?? null }]
        : [],
    );
  return { name, rows };
}

/** Field/Value sheets (Test, Writing): label → [value, row]. */
function fields(grid: Grid | undefined): Map<string, { value: Cell; row: number }> {
  const out = new Map<string, { value: Cell; row: number }>();
  for (const [i, cells] of (grid?.rows ?? []).entries()) {
    const key = normalise(cellText(cells[0] ?? null));
    if (key && i > 0) out.set(key, { value: cells[1] ?? null, row: i + 1 });
  }
  return out;
}

export interface BookResult {
  /** null when the Test sheet can't be read: no book or test number. */
  draft: TestFile | null;
  problems: SheetProblem[];
}

/**
 * A filled-in workbook → a draft. `existing` is the draft already saved under the same test ID,
 * if any: an image stored in the app (KEEP_IMAGE) is taken from it.
 */
export function bookToTest(
  grids: Grid[],
  manifest: MediaManifest | null,
  existing: TestFile | null = null,
): BookResult {
  const problems: SheetProblem[] = [];
  const byName = new Map(grids.map((g) => [normalise(g.name), g]));
  const sheet = (name: string) => byName.get(normalise(name));
  const problem = (sheetName: string, row: number | null, message: string) =>
    problems.push({ sheet: sheetName, row, message });

  // Test
  const testSheet = sheet(SHEETS.test);
  if (!testSheet) {
    problem(SHEETS.test, null, 'The Test sheet is missing: download the template again.');
    return { draft: null, problems };
  }
  const tf = fields(testSheet);
  const book = cellText(tf.get(normalise('Book'))?.value ?? null);
  const numberCell = tf.get(normalise('Test number'));
  const testNumber = wholeNumber(cellText(numberCell?.value ?? null));
  if (!book) problem(SHEETS.test, tf.get('book')?.row ?? null, 'Book is empty.');
  if (!testNumber)
    problem(SHEETS.test, numberCell?.row ?? null, 'Test number needs a whole number.');
  if (!book || !testNumber) return { draft: null, problems };

  const trackText = normalise(cellText(tf.get('track')?.value ?? null));
  const track = /^(general|generaltraining|gt)$/.test(trackText) ? 'general' : 'academic';
  if (trackText && !/^(academic|ac|general|generaltraining|gt)$/.test(trackText)) {
    problem(SHEETS.test, tf.get('track')?.row ?? null, 'Track is Academic or General Training.');
  }
  const draft = blankTest(book, testNumber, track);
  for (const f of TIMING_FIELDS) {
    const cell = tf.get(normalise(f.label));
    const text = cellText(cell?.value ?? null);
    if (!text) continue;
    const v = wholeNumber(text);
    if (v === null) problem(SHEETS.test, cell!.row, `${f.label} needs a whole number.`);
    else f.set(draft.meta, v);
  }
  for (const f of HELP_FIELDS) {
    const cell = tf.get(normalise(f.label));
    const v = yesNo(cellText(cell?.value ?? null));
    if (v === null) problem(SHEETS.test, cell!.row, `${f.label} is Yes or No.`);
    else if (v !== undefined) f.set(draft.meta, v);
  }

  const sections = new Map<SectionId, TestFile['sections'][SectionId]>();
  const listening = (part: 1 | 2 | 3 | 4) => {
    const id = `listening-${part}` as const;
    if (!sections.has(id)) sections.set(id, blankListening(part));
    return sections.get(id) as ListeningSection;
  };
  const reading = (part: 1 | 2 | 3) => {
    const id = `reading-${part}` as const;
    if (!sections.has(id)) sections.set(id, { ...blankReading(part), paragraphs: [] });
    return sections.get(id) as ReadingSection;
  };
  const partOf = (t: Table, row: number, cell: Cell, max: number) => {
    const n = wholeNumber(cellText(cell));
    if (n && n >= 1 && n <= max) return n;
    problem(t.name, row, `Part needs a number from 1 to ${max}.`);
    return null;
  };

  // Listening
  const lt = table(sheet(SHEETS.listening), SHEETS.listening, LISTENING_COLS, problems);
  const seenParts = new Set<number>();
  for (const r of lt.rows) {
    const part = partOf(lt, r.row, r.get('Part'), 4) as 1 | 2 | 3 | 4 | null;
    if (!part) continue;
    if (seenParts.has(part)) {
      problem(lt.name, r.row, `Part ${part} is listed twice.`);
      continue;
    }
    seenParts.add(part);
    const s = listening(part);
    s.audio = resolveMedia(cellText(r.get('Audio file')), 'audio', manifest);
    const lengthCell = r.get('Length (m:ss)');
    const length = cellSeconds(lengthCell);
    if (cellText(lengthCell) && !length) problem(lt.name, r.row, 'Length is a time like 6:40.');
    const fromManifest = manifest?.files.find((f) => f.path === s.audio)?.durationSec;
    s.durationSec = length || fromManifest || s.durationSec;
    const context = cellText(r.get('Context'));
    if (context) s.context = context;
  }

  // Script
  const st = table(sheet(SHEETS.script), SHEETS.script, SCRIPT_COLS, problems);
  for (const r of st.rows) {
    const part = partOf(st, r.row, r.get('Part'), 4) as 1 | 2 | 3 | 4 | null;
    if (!part) continue;
    const s = listening(part);
    const timeCell = r.get('Time (m:ss)');
    const time = cellSeconds(timeCell);
    if (cellText(timeCell) && time === null) problem(st.name, r.row, 'Time is like 1:05.');
    const line: ScriptLine = {
      start: time ?? s.script.at(-1)?.start ?? 0,
      speaker: cellText(r.get('Speaker')) || s.script.at(-1)?.speaker || 'Speaker',
      text: cellText(r.get('Words')),
    };
    const q = cellText(r.get('Answer to question'));
    const words = cellText(r.get('Answer words'));
    if (q || words) {
      const n = wholeNumber(q);
      if (!n || n > 40) problem(st.name, r.row, 'Answer to question needs a number from 1 to 40.');
      else if (!words) problem(st.name, r.row, 'Answer words is empty: copy the words from Words.');
      else line.answer = { question: n, highlight: words };
    }
    s.script.push(line);
  }

  // Passages
  const pt = table(sheet(SHEETS.passages), SHEETS.passages, PASSAGE_COLS, problems);
  for (const r of pt.rows) {
    const part = partOf(pt, r.row, r.get('Part'), 3) as 1 | 2 | 3 | null;
    if (!part) continue;
    const s = reading(part);
    const title = cellText(r.get('Title'));
    const subtitle = cellText(r.get('Subtitle'));
    if (title && !s.title) s.title = title;
    if (subtitle && !s.subtitle) s.subtitle = subtitle;
    const text = cellText(r.get('Text'));
    if (!text) {
      if (!title && !subtitle) problem(pt.name, r.row, 'Text is empty.');
      continue;
    }
    const label = cellText(r.get('Paragraph')) || String.fromCharCode(65 + s.paragraphs.length);
    s.paragraphs.push({ label, text: text.replace(/\s*\n\s*/g, ' ') });
  }

  // Groups
  const gt = table(sheet(SHEETS.groups), SHEETS.groups, GROUP_COLS, problems);
  const groups = new Map<string, QuestionGroup>();
  for (const r of gt.rows) {
    const id = cellText(r.get('Group'));
    if (!id) {
      problem(gt.name, r.row, 'Group is empty: give each group a name, like L1-A.');
      continue;
    }
    if (groups.has(id)) {
      problem(gt.name, r.row, `Group ${id} is listed twice.`);
      continue;
    }
    const moduleText = normalise(cellText(r.get('Module')));
    const module =
      moduleText === 'listening' || moduleText === 'l'
        ? 'listening'
        : moduleText === 'reading' || moduleText === 'r'
          ? 'reading'
          : null;
    if (!module) {
      problem(gt.name, r.row, 'Module is Listening or Reading.');
      continue;
    }
    const part = partOf(gt, r.row, r.get('Part'), module === 'listening' ? 4 : 3);
    const typeText = cellText(r.get('Type'));
    const type = parseType(typeText);
    if (!type) {
      problem(
        gt.name,
        r.row,
        typeText
          ? `"${typeText}" isn't a question type: see the list on How to fill.`
          : 'Type is empty.',
      );
    }
    if (!part || !type) continue;
    const group: QuestionGroup = {
      groupId: id,
      type,
      instructions: cellText(r.get('Instructions')),
      questions: [],
    };
    const wordLimit = cellText(r.get('Word limit'));
    if (wordLimit) group.wordLimit = wordLimit;
    const maxWords = cellText(r.get('Max words'));
    if (maxWords) {
      const n = wholeNumber(maxWords);
      if (!n || n > 5) problem(gt.name, r.row, 'Max words is a number from 1 to 5.');
      else group.maxWords = n;
    }
    const allowNumber = yesNo(cellText(r.get('Numbers allowed')));
    if (allowNumber === null) problem(gt.name, r.row, 'Numbers allowed is Yes or No.');
    else if (allowNumber !== undefined) group.allowNumber = allowNumber;
    const layoutText = cellText(r.get('Layout')).toLowerCase();
    if (layoutText) {
      const kind = LAYOUTS.find((k) => k === layoutText || `${k}s` === layoutText);
      const body = cellText(r.get('Layout text'));
      if (!kind) problem(gt.name, r.row, `Layout is one of: ${LAYOUTS.join(', ')}.`);
      else {
        group.layout = { kind, body };
        const title = cellText(r.get('Layout title'));
        if (title) group.layout.title = title;
      }
    }
    const optionsText = cellText(r.get('Options'));
    if (optionsText) {
      const options = parseOptions(optionsText);
      if (!options) problem(gt.name, r.row, 'Write each option as "A. text", one per line.');
      else group.options = options;
    }
    const perItem = cellText(r.get('Answers per item'));
    if (perItem) {
      const n = wholeNumber(perItem);
      if (n !== 2 && n !== 3) problem(gt.name, r.row, 'Answers per item is 2 or 3.');
      else group.answersPerItem = n;
    }
    groups.set(id, group);
    (module === 'listening'
      ? listening(part as 1 | 2 | 3 | 4)
      : reading(part as 1 | 2 | 3)
    ).groups.push(group);
  }

  // Questions
  const qt = table(sheet(SHEETS.questions), SHEETS.questions, QUESTION_COLS, problems);
  for (const r of qt.rows) {
    const groupId = cellText(r.get('Group'));
    const group = groups.get(groupId);
    if (!group) {
      problem(
        qt.name,
        r.row,
        groupId ? `Group ${groupId} isn't on the Groups sheet.` : 'Group is empty.',
      );
      continue;
    }
    const numbers = parseNumbers(cellText(r.get('Number')));
    if (!numbers) {
      problem(qt.name, r.row, 'Number is like 7, or 21-22 for a question with two answers.');
      continue;
    }
    const answerText = cellText(r.get('Answer'));
    let accepted = parseAnswers(answerText);
    if (!accepted.length) accepted = numbers.map(() => []);
    else if (accepted.length !== numbers.length) {
      problem(
        qt.name,
        r.row,
        `Answer needs ${numbers.length} parts separated by ";", one for each number.`,
      );
      continue;
    }
    const question: QuestionGroup['questions'][number] = {
      numbers,
      prompt: cellText(r.get('Question')),
      acceptedAnswers: accepted,
    };
    const optionsText = cellText(r.get('Options'));
    if (optionsText) {
      const options = parseOptions(optionsText);
      if (!options) problem(qt.name, r.row, 'Write each option as "A. text", one per line.');
      else question.options = options;
    }
    const explanation = cellText(r.get('Explanation'));
    if (explanation) question.explanation = explanation;
    const paragraph = cellText(r.get('Paragraph'));
    const sentence = cellText(r.get('Sentence'));
    const words = cellText(r.get('Answer words'));
    if (/^(not ?given|ng|none|-)$/i.test(paragraph)) question.location = null;
    else if (paragraph || sentence || words) {
      const n = wholeNumber(sentence);
      if (!paragraph || !n || !words) {
        problem(
          qt.name,
          r.row,
          'Paragraph, Sentence and Answer words go together (or write Not given in Paragraph).',
        );
      } else {
        question.location = { paragraph, sentence: n, highlight: words } satisfies AnswerLocation;
      }
    }
    group.questions.push(question);
  }

  // Writing
  const wf = fields(sheet(SHEETS.writing));
  const w = (label: (typeof WRITING_FIELDS)[number]) => wf.get(normalise(label));
  // The minimum words are filled in on the template, so they don't count as starting Writing.
  if (
    WRITING_FIELDS.some((label) => !label.includes('minimum') && cellText(w(label)?.value ?? null))
  ) {
    const writing: WritingSection = blankWriting();
    writing.task1.prompt = cellText(w('Task 1 question')?.value ?? null);
    const image = cellText(w('Task 1 image')?.value ?? null);
    const old = existing?.sections.writing;
    const kept = old?.kind === 'writing' ? old.task1.image : undefined;
    writing.task1.image =
      image === KEEP_IMAGE ? (kept ?? '') : resolveMedia(image, 'img', manifest);
    writing.task1.imageDescription = cellText(w('Task 1 image description')?.value ?? null);
    writing.task2.prompt = cellText(w('Task 2 question')?.value ?? null);
    for (const [label, set] of [
      ['Task 1 minimum words', (n: number) => (writing.task1.minWords = n)],
      ['Task 2 minimum words', (n: number) => (writing.task2.minWords = n)],
    ] as const) {
      const text = cellText(w(label)?.value ?? null);
      if (!text) continue;
      const n = wholeNumber(text);
      if (!n) problem(SHEETS.writing, w(label)!.row, `${label} needs a whole number.`);
      else set(n);
    }
    const model = cellText(w('Task 2 model answer')?.value ?? null);
    if (model) writing.task2.modelAnswer = model;
    sections.set('writing', writing);
  }

  // Speaking
  const sp = table(sheet(SHEETS.speaking), SHEETS.speaking, SPEAKING_COLS, problems);
  if (sp.rows.length) {
    const speaking: SpeakingSection = blankSpeaking();
    speaking.part2.points = [];
    for (const r of sp.rows) {
      const part = wholeNumber(cellText(r.get('Part')));
      const text = cellText(r.get('Text'));
      if (part === 1 || part === 3) {
        if (text) (part === 1 ? speaking.part1 : speaking.part3).push(text);
      } else if (part === 2) {
        const kind = normalise(cellText(r.get('Kind')));
        if (kind === 'topic') speaking.part2.topic = text;
        else if (kind === 'point') speaking.part2.points.push(text);
        else if (kind === 'closing') speaking.part2.closing = text;
        else problem(sp.name, r.row, 'For Part 2, Kind is Topic, Point or Closing.');
      } else {
        problem(sp.name, r.row, 'Part is 1, 2 or 3.');
      }
    }
    sections.set('speaking', speaking);
  }

  for (const id of SECTION_IDS) {
    const section = sections.get(id);
    if (section) draft.sections[id] = section;
  }
  if (!Object.keys(draft.sections).length) {
    problem(SHEETS.test, null, 'The file has no sections: fill in at least one sheet.');
  }
  return { draft, problems };
}

// ---- Draft → workbook ------------------------------------------------------------------------

const HELP_ROWS: Cell[][] = [
  ['How to fill this workbook'],
  [''],
  ['Fill the sheets you need and leave the others empty. Upload the file on Admin → Tests.'],
  [
    'Each uploaded file becomes a draft: preview it, finish the Before publishing list, then publish.',
  ],
  [''],
  ['Test', 'Book, test number and track. The timings and Yes/No settings can stay as they are.'],
  [
    'Listening',
    'One row per part: the audio file name (as uploaded), its length like 6:40, and an optional context line.',
  ],
  [
    'Script',
    'One row per line of the audioscript. Time is when the line starts, like 0:14 (blank = same as the line above).',
  ],
  [
    '',
    'Where a line holds an answer, put the question number in "Answer to question" and the exact words in "Answer words".',
  ],
  [
    'Passages',
    "One row per paragraph. Put the title on the passage's first row. Paragraph is its letter (blank = A, B, C… in order).",
  ],
  [
    'Groups',
    'One row per question group ("Questions 1–6"). Give each group a short name like L1-A or R2-B, used on Questions.',
  ],
  [
    '',
    'Options: one per line (or separated by ;) written as "A. text". For a shared list (headings, features, endings).',
  ],
  [
    '',
    "Layout: summary, notes, table, form or flow, with Layout text in Markdown and {{7}} where question 7's gap goes.",
  ],
  [
    'Questions',
    'One row per question. Number is like 7, or 21-22 for one question with two answers.',
  ],
  [
    '',
    'Answer: alternatives separated by |, like "colour | color". For 21-22, one part each separated by ;, like "B; D".',
  ],
  [
    '',
    "Reading only: Paragraph, Sentence (1 = the paragraph's first sentence) and Answer words locate the answer. Not given: write Not given in Paragraph.",
  ],
  [
    '',
    "Options here are for a question with its own A/B/C; a group's shared options go on Groups.",
  ],
  ['Writing', 'Task 1 image is the file name as uploaded. Minimum words can stay at 150 and 250.'],
  [
    'Speaking',
    'Part 1 and Part 3: one question per row. Part 2: Kind is Topic, Point (one row each) or Closing.',
  ],
  [''],
  [
    'Times',
    "Type times like 1:05. The template's time columns are text; if a sheet turns 1:05 into 01:05:00 it is still read as 1 min 5 s.",
  ],
  [''],
  ['Question types', 'Write either name in the Type column'],
  ...QUESTION_TYPES.map((t): Cell[] => [TYPE_LABELS[t], t]),
];

function sectionsOf<K extends 'listening' | 'reading'>(
  test: TestFile,
  kind: K,
): (K extends 'listening' ? ListeningSection : ReadingSection)[] {
  return SECTION_IDS.filter((id) => id.startsWith(kind)).flatMap((id) => {
    const s = test.sections[id];
    return s ? [s as never] : [];
  });
}

/** A test as a workbook: the template is the same with the sections left empty. */
export function testToBook(test: TestFile): Grid[] {
  const m = test.meta;
  const listeningSections = sectionsOf(test, 'listening');
  const readingSections = sectionsOf(test, 'reading');
  const allGroups = [
    ...listeningSections.map((s) => ({ module: 'Listening', part: s.part, groups: s.groups })),
    ...readingSections.map((s) => ({ module: 'Reading', part: s.part, groups: s.groups })),
  ];
  // Group names have to be unique across the workbook; the editor's are only unique per section.
  const groupName = new Map<QuestionGroup, string>();
  for (const { module, part, groups } of allGroups) {
    groups.forEach((g, i) =>
      groupName.set(g, `${module[0]}${part}-${String.fromCharCode(65 + i)}`),
    );
  }
  const w = test.sections.writing;
  const sp = test.sections.speaking;
  const writing = w?.kind === 'writing' ? w : undefined;
  const speaking = sp?.kind === 'speaking' ? sp : undefined;
  const image = writing?.task1.image ?? '';

  return [
    { name: SHEETS.help, rows: HELP_ROWS, widths: [22, 110] },
    {
      name: SHEETS.test,
      rows: [
        ['Field', 'Value'],
        ['Book', m.book],
        ['Test number', m.book ? m.testNumber : null],
        ['Track', m.track === 'general' ? 'General Training' : 'Academic'],
        ...TIMING_FIELDS.map((f): Cell[] => [f.label, f.get(m)]),
        ...HELP_FIELDS.map((f): Cell[] => [f.label, f.get(m) ? 'Yes' : 'No']),
      ],
      widths: [36, 30],
    },
    {
      name: SHEETS.listening,
      rows: [
        [...LISTENING_COLS],
        ...listeningSections.map((s): Cell[] => [
          s.part,
          s.audio === '/media/audio/' ? '' : mediaName(s.audio),
          formatTime(s.durationSec),
          s.context ?? '',
        ]),
      ],
      textColumns: [2],
      widths: [6, 28, 14, 60],
    },
    {
      name: SHEETS.script,
      rows: [
        [...SCRIPT_COLS],
        ...listeningSections.flatMap((s) =>
          s.script.map((l): Cell[] => [
            s.part,
            formatTime(l.start),
            l.speaker,
            l.text,
            l.answer?.question ?? '',
            l.answer?.highlight ?? '',
          ]),
        ),
      ],
      textColumns: [1],
      widths: [6, 12, 16, 80, 12, 30],
    },
    {
      name: SHEETS.passages,
      rows: [
        [...PASSAGE_COLS],
        ...readingSections.flatMap((s) =>
          s.paragraphs.map((p, i): Cell[] => [
            s.part,
            i === 0 ? s.title : '',
            i === 0 ? (s.subtitle ?? '') : '',
            p.label,
            p.text,
          ]),
        ),
      ],
      widths: [6, 30, 30, 10, 100],
    },
    {
      name: SHEETS.groups,
      rows: [
        [...GROUP_COLS],
        ...allGroups.flatMap(({ module, part, groups }) =>
          groups.map((g): Cell[] => [
            groupName.get(g)!,
            module,
            part,
            TYPE_LABELS[g.type],
            g.instructions,
            g.wordLimit ?? '',
            g.maxWords ?? '',
            g.allowNumber === undefined ? '' : g.allowNumber ? 'Yes' : 'No',
            g.layout?.kind ?? '',
            g.layout?.title ?? '',
            g.layout?.body ?? '',
            g.options ? formatOptions(g.options) : '',
            g.answersPerItem ?? '',
          ]),
        ),
      ],
      widths: [10, 11, 6, 34, 50, 18, 10, 10, 10, 20, 50, 40, 10],
    },
    {
      name: SHEETS.questions,
      rows: [
        [...QUESTION_COLS],
        ...allGroups.flatMap(({ groups }) =>
          groups.flatMap((g) =>
            g.questions.map((q): Cell[] => [
              groupName.get(g)!,
              q.numbers.join(', '),
              q.prompt ?? '',
              q.options ? formatOptions(q.options) : '',
              formatAnswers(q.acceptedAnswers),
              q.explanation ?? '',
              q.location === null ? 'Not given' : (q.location?.paragraph ?? ''),
              q.location?.sentence ?? '',
              q.location?.highlight ?? '',
            ]),
          ),
        ),
      ],
      textColumns: [1],
      widths: [10, 10, 50, 30, 24, 40, 10, 9, 30],
    },
    {
      name: SHEETS.writing,
      rows: [
        ['Field', 'Value'],
        ['Task 1 question', writing?.task1.prompt ?? ''],
        ['Task 1 image', image.startsWith('data:') ? KEEP_IMAGE : image ? mediaName(image) : ''],
        ['Task 1 image description', writing?.task1.imageDescription ?? ''],
        ['Task 1 minimum words', writing?.task1.minWords ?? 150],
        ['Task 2 question', writing?.task2.prompt ?? ''],
        ['Task 2 minimum words', writing?.task2.minWords ?? 250],
        ['Task 2 model answer', writing?.task2.modelAnswer ?? ''],
      ],
      widths: [28, 100],
    },
    {
      name: SHEETS.speaking,
      rows: [
        [...SPEAKING_COLS],
        ...(speaking
          ? [
              ...speaking.part1.map((t): Cell[] => [1, '', t]),
              [2, 'Topic', speaking.part2.topic],
              ...speaking.part2.points.map((t): Cell[] => [2, 'Point', t]),
              [2, 'Closing', speaking.part2.closing],
              ...speaking.part3.map((t): Cell[] => [3, '', t]),
            ]
          : []),
      ],
      widths: [6, 10, 90],
    },
  ];
}

/** The empty workbook offered as "Download the template". */
export function templateBook(): Grid[] {
  const blank = blankTest('', 1, 'academic');
  return testToBook(blank);
}

/** The file name for a test's workbook. */
export function bookFileName(test: TestFile): string {
  return `${test.meta.testId}.xlsx`;
}
