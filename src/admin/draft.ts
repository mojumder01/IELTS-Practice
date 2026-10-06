import { checkTest, splitSentences, type ContentIssue } from '../schema/checks';
import type { MediaManifest } from '../schema/media';
import type {
  AnswerLocation,
  ListeningSection,
  QuestionGroup,
  QuestionType,
  ReadingSection,
  ScriptLine,
  SpeakingSection,
  TestFile,
  TestMeta,
  Track,
  WritingSection,
} from '../schema/test';
import { TestFileSchema } from '../schema/test';
import { zodIssues } from '../schema/validate';

// Pure helpers for the admin panel (SPEC section 8). A draft is a TestFile that may not pass the
// schema yet: strings can be empty and sections half-filled; the checklist says what's missing.

/** "Book 21", 2 → "book21-test2" (the sample's pattern). */
export function testIdFor(book: string, testNumber: number): string {
  const slug = book.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `${slug || 'test'}-test${testNumber}`;
}

export function blankTest(book: string, testNumber: number, track: Track): TestFile {
  const meta: TestMeta = {
    testId: testIdFor(book, testNumber),
    book,
    testNumber,
    track,
    status: 'draft',
    timing: {
      listening: { singlePartMin: 10, fullMockMin: 30, checkMin: 2 },
      reading: { singlePartMin: 20, fullMockMin: 60 },
      writing: { task1Min: 20, task2Min: 40, fullMockMin: 60 },
    },
    studentHelp: { allowReveal: true, showScriptInSinglePart: true, lockAudioInFullMock: true },
  };
  return { meta, sections: {} };
}

export function blankReading(part: 1 | 2 | 3): ReadingSection {
  return { kind: 'reading', part, title: '', paragraphs: [{ label: 'A', text: '' }], groups: [] };
}

export function blankListening(part: 1 | 2 | 3 | 4): ListeningSection {
  return {
    kind: 'listening',
    part,
    audio: '/media/audio/',
    durationSec: 1,
    script: [],
    groups: [],
  };
}

export function blankWriting(): WritingSection {
  return {
    kind: 'writing',
    task1: { prompt: '', image: '', imageDescription: '', minWords: 150 },
    task2: { prompt: '', minWords: 250 },
  };
}

export function blankSpeaking(): SpeakingSection {
  return {
    kind: 'speaking',
    part1: [],
    part2: { topic: '', points: ['', '', ''], closing: '', prepSec: 60, speakSec: 120 },
    part3: [],
  };
}

const TFNG: QuestionType[] = ['TRUE_FALSE_NOT_GIVEN', 'YES_NO_NOT_GIVEN'];

/** A new group of questions numbered from `first`. */
export function blankGroup(
  type: QuestionType,
  first: number,
  count: number,
  id: string,
): QuestionGroup {
  return {
    groupId: id,
    type,
    instructions: TFNG.includes(type)
      ? 'Do the following statements agree with the information given in the passage?'
      : '',
    ...(type === 'GAP_FILL' || type === 'SHORT_ANSWER' || type === 'DIAGRAM_LABEL'
      ? { wordLimit: 'ONE WORD ONLY', maxWords: 1 }
      : {}),
    questions: Array.from({ length: count }, (_, i) => ({
      numbers: [first + i],
      prompt: '',
      acceptedAnswers: [[]],
    })),
  };
}

/** The next free question number after a section's questions (or `start` for an empty one). */
export function nextNumber(groups: QuestionGroup[], start: number): number {
  const numbers = groups.flatMap((g) => g.questions.flatMap((q) => q.numbers));
  return numbers.length ? Math.max(...numbers) + 1 : start;
}

// ---- Reading passage text --------------------------------------------------------------------

/** "[A] text\n\n[B] text" → paragraphs. Text before the first label becomes paragraph A. */
export function parsePassage(text: string): { label: string; text: string }[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks.map((block, i) => {
    const m = /^\[([A-Z])\]\s*/.exec(block);
    return m
      ? { label: m[1]!, text: block.slice(m[0].length).replace(/\s*\n\s*/g, ' ') }
      : { label: String.fromCharCode(65 + i), text: block.replace(/\s*\n\s*/g, ' ') };
  });
}

export function formatPassage(paragraphs: { label: string; text: string }[]): string {
  return paragraphs.map((p) => `[${p.label}] ${p.text}`).join('\n\n');
}

/** The passage as sentences for linking answers: 1-based like AnswerLocation.sentence. */
export function passageSentences(
  paragraphs: { label: string; text: string }[],
): { label: string; sentences: string[] }[] {
  return paragraphs.map((p) => ({ label: p.label, sentences: splitSentences(p.text) }));
}

/**
 * Clicking a sentence links the question to it; clicking its own sentence again unlinks. The
 * highlight starts as the whole sentence, to be trimmed to the exact words.
 */
export function toggleLocation(
  current: AnswerLocation | null | undefined,
  paragraph: string,
  sentence: number,
  sentenceText: string,
): AnswerLocation | undefined {
  if (current && current.paragraph === paragraph && current.sentence === sentence) return undefined;
  return { paragraph, sentence, highlight: sentenceText };
}

// ---- Listening audioscript -------------------------------------------------------------------

/** "1:05" → 65, "75" → 75; null when it isn't a time. */
export function parseTime(text: string): number | null {
  const t = text.trim();
  const m = /^(\d+):([0-5]\d)(?:\.(\d))?$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(m[3]) / 10 : 0);
  return /^\d+(\.\d)?$/.test(t) ? Number(t) : null;
}

export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const tenths = Math.round((seconds - whole) * 10);
  const base = `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  return tenths ? `${base}.${tenths}` : base;
}

/**
 * A pasted script, one line each: "Speaker: words", optionally starting with a time
 * ("0:14 Daniel: It's Morgan."). Lines without a speaker keep the previous one's.
 */
export function parseScript(text: string): ScriptLine[] {
  const out: ScriptLine[] = [];
  let speaker = '';
  for (const raw of text.split('\n')) {
    let line = raw.trim();
    if (!line) continue;
    let start: number | null = null;
    const time = /^(\d+:[0-5]\d)\s+/.exec(line);
    if (time) {
      start = parseTime(time[1]!);
      line = line.slice(time[0].length);
    }
    const said = /^([^:]{1,40}):\s+(.*)$/.exec(line);
    if (said) {
      speaker = said[1]!.trim();
      line = said[2]!.trim();
    }
    out.push({ start: start ?? out.at(-1)?.start ?? 0, speaker: speaker || 'Speaker', text: line });
  }
  return out;
}

/** Indexes of lines whose start isn't after the line before, or is past the audio's end. */
export function badTimes(script: ScriptLine[], durationSec: number): Set<number> {
  const bad = new Set<number>();
  script.forEach((line, i) => {
    const prev = script[i - 1];
    if ((prev && line.start <= prev.start) || line.start >= durationSec) bad.add(i);
  });
  return bad;
}

// ---- Before publishing -----------------------------------------------------------------------

export interface CheckItem {
  id: string;
  area: string;
  text: string;
  /** null while the schema check fails: the others can't run yet. */
  ok: boolean | null;
  issues: ContentIssue[];
}

const ITEMS: { id: string; area: string; text: string; match: (i: ContentIssue) => boolean }[] = [
  {
    id: 'answers',
    area: 'Answers',
    text: 'Every question has at least one accepted answer',
    match: (i) => /accepted answer|isn't one of|word limit|needs options/.test(i.message),
  },
  {
    id: 'locations',
    area: 'Reading',
    text: 'Every answer has a location or is Not Given, with its words in the sentence',
    match: (i) => i.path.startsWith('sections.reading') && i.path.includes('.location'),
  },
  {
    id: 'script',
    area: 'Listening',
    text: 'Every question is marked on exactly one script line, with its words in the line',
    match: (i) =>
      i.path.startsWith('sections.listening') &&
      (/marked on exactly one|isn't in this part|isn't in the line/.test(i.message) ||
        i.path.includes('.location')),
  },
  {
    id: 'times',
    area: 'Listening',
    text: 'Script times increase and stay within the audio',
    match: (i) => /\.start$/.test(i.path) || /durationSec/.test(i.path),
  },
  {
    id: 'numbers',
    area: 'Numbering',
    text: 'Question numbers run 1–40 with no gaps or repeats',
    match: (i) => /more than once|should start|skip|cover questions|gap/.test(i.message),
  },
  {
    id: 'media',
    area: 'Media',
    text: 'Every audio and image file is in the media manifest',
    match: (i) => /media-manifest|npm run media/.test(i.message),
  },
  {
    id: 'image',
    area: 'Writing',
    text: 'The Task 1 image has a description',
    match: (i) => i.path === 'sections.writing.task1.imageDescription',
  },
];

/** The "Before publishing" list: the schema first, then the section 8 checks sorted into items. */
export function checklist(draft: TestFile, manifest: MediaManifest | null): CheckItem[] {
  const parsed = TestFileSchema.safeParse(draft);
  if (!parsed.success) {
    return [
      ...ITEMS.map(({ id, area, text }) => ({ id, area, text, ok: null, issues: [] })),
      { ...SCHEMA, ok: false, issues: zodIssues(parsed.error) },
    ];
  }
  const all = checkTest(parsed.data, manifest);
  const items: CheckItem[] = ITEMS.map(({ id, area, text, match }) => {
    const issues = all.filter(match);
    return { id, area, text, ok: issues.length === 0, issues };
  });
  // Anything the items don't cover still blocks publishing, shown with the schema line.
  const sorted = new Set(items.flatMap((i) => i.issues));
  const other = all.filter((i) => !sorted.has(i));
  return [...items, { ...SCHEMA, ok: other.length === 0, issues: other }];
}

const SCHEMA = { id: 'schema', area: 'Schema', text: 'Every section passes the schema' };

export function canPublish(items: CheckItem[]): boolean {
  return items.every((i) => i.ok === true);
}

// ---- Import ----------------------------------------------------------------------------------

export interface DiffLine {
  path: string;
  change: 'added' | 'removed' | 'changed';
}

/** What an import would change, by test setting and section. */
export function diffTests(before: TestFile, after: TestFile): DiffLine[] {
  const out: DiffLine[] = [];
  for (const key of Object.keys({ ...before.meta, ...after.meta }) as (keyof TestMeta)[]) {
    if (JSON.stringify(before.meta[key]) !== JSON.stringify(after.meta[key])) {
      out.push({ path: `meta.${key}`, change: 'changed' });
    }
  }
  const ids = new Set([...Object.keys(before.sections), ...Object.keys(after.sections)]);
  for (const id of [...ids].sort()) {
    const a = before.sections[id as keyof TestFile['sections']];
    const b = after.sections[id as keyof TestFile['sections']];
    if (!a && b) out.push({ path: `sections.${id}`, change: 'added' });
    else if (a && !b) out.push({ path: `sections.${id}`, change: 'removed' });
    else if (JSON.stringify(a) !== JSON.stringify(b))
      out.push({ path: `sections.${id}`, change: 'changed' });
  }
  return out;
}
