import type { MediaManifest } from './media';
import type {
  ListeningSection,
  QuestionGroup,
  ReadingSection,
  TestFile,
  WritingSection,
} from './test';

// The "Before publishing" checks (SPEC section 8) beyond what the Zod schema can
// express. Pure functions: the validate script runs them now, the admin
// checklist reuses them in Phase 9.

export interface ContentIssue {
  /** Where the problem is, e.g. "sections.reading-1.groups[0].questions[2].location". */
  path: string;
  message: string;
}

const MAX_INLINE_IMAGE_BYTES = 700 * 1024;
const TFNG = ['TRUE', 'FALSE', 'NOT GIVEN'];
const YNNG = ['YES', 'NO', 'NOT GIVEN'];
const CHOICE_TYPES = new Set([
  'MULTIPLE_CHOICE_SINGLE',
  'MULTIPLE_CHOICE_MULTIPLE',
  'MATCHING_HEADINGS',
  'MATCHING_PARAGRAPH_INFO',
  'MATCHING_FEATURES',
  'MATCHING_SENTENCE_ENDINGS',
]);

/**
 * Splits a paragraph into sentences on . ! or ? followed by a space (closing quotes and
 * brackets stay with their sentence). Decimals like 3.5 don't split; abbreviations like
 * "e.g. this" do, so avoid them in passage text or count sentences the same way.
 */
export function splitSentences(paragraph: string): string[] {
  const trimmed = paragraph.trim();
  return trimmed ? trimmed.split(/(?<=[.!?]["'”’)\]]*)\s+/) : [];
}

/** Words an answer takes, ignoring optional words in brackets: "(the) envelope" → 1. */
export function answerWordCount(answer: string): number {
  return answer
    .replace(/\([^)]*\)/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

// The schema guarantees each key holds its own kind of section; these narrow the type.
function readingPart(file: TestFile, part: 1 | 2 | 3): ReadingSection | undefined {
  const section = file.sections[`reading-${part}`];
  return section?.kind === 'reading' ? section : undefined;
}

function listeningPart(file: TestFile, part: 1 | 2 | 3 | 4): ListeningSection | undefined {
  const section = file.sections[`listening-${part}`];
  return section?.kind === 'listening' ? section : undefined;
}

export function checkTest(file: TestFile, manifest: MediaManifest | null): ContentIssue[] {
  const issues: ContentIssue[] = [];

  for (const [id, section] of Object.entries(file.sections)) {
    if (section?.kind !== 'reading' && section?.kind !== 'listening') continue;
    section.groups.forEach((group, g) =>
      checkGroup(group, `sections.${id}.groups[${g}]`, section.kind, issues),
    );
  }

  const reading = ([1, 2, 3] as const).map((part) => readingPart(file, part));
  reading.forEach((section, i) => {
    if (!section) return;
    const previous = reading[i - 1];
    const start = i === 0 ? 1 : previous ? lastNumber(previous) + 1 : undefined;
    checkNumbering(section, `sections.reading-${i + 1}`, start, issues);
    checkReadingLocations(section, `sections.reading-${i + 1}`, issues);
  });
  const listening = ([1, 2, 3, 4] as const).map((part) => listeningPart(file, part));
  listening.forEach((section, i) => {
    if (!section) return;
    checkNumbering(section, `sections.listening-${i + 1}`, i * 10 + 1, issues);
    checkScript(section, `sections.listening-${i + 1}`, manifest, issues);
  });
  checkWholeModule('reading', reading, issues);
  checkWholeModule('listening', listening, issues);

  const writing = file.sections.writing;
  if (writing?.kind === 'writing') checkWriting(writing, manifest, issues);
  return issues;
}

function numbersOf(section: ReadingSection | ListeningSection): number[] {
  return section.groups.flatMap((g) => g.questions.flatMap((q) => q.numbers));
}

function lastNumber(section: ReadingSection): number {
  return Math.max(...numbersOf(section));
}

function checkGroup(
  group: QuestionGroup,
  path: string,
  kind: 'reading' | 'listening',
  issues: ContentIssue[],
) {
  group.questions.forEach((question, q) => {
    const qPath = `${path}.questions[${q}]`;
    const label = `Question ${question.numbers.join('–')}`;
    const optionKeys = (question.options ?? group.options)?.map((o) => o.key);
    if (CHOICE_TYPES.has(group.type) && !optionKeys) {
      issues.push({
        path: `${qPath}.options`,
        message: `${label}: ${group.type} needs options on the question or its group`,
      });
    }
    const allowed =
      group.type === 'TRUE_FALSE_NOT_GIVEN'
        ? TFNG
        : group.type === 'YES_NO_NOT_GIVEN'
          ? YNNG
          : CHOICE_TYPES.has(group.type)
            ? optionKeys
            : undefined;
    question.acceptedAnswers.forEach((answers, i) => {
      const aPath = `${qPath}.acceptedAnswers[${i}]`;
      if (answers.length === 0 || answers.some((a) => a.trim() === '')) {
        issues.push({
          path: aPath,
          message: `${label} needs at least one accepted answer, with no blanks`,
        });
      }
      for (const answer of answers) {
        if (allowed && !allowed.includes(answer)) {
          issues.push({ path: aPath, message: `"${answer}" isn't one of ${allowed.join(', ')}` });
        }
        if (group.maxWords && answerWordCount(answer) > group.maxWords) {
          issues.push({
            path: aPath,
            message: `"${answer}" is longer than the ${group.maxWords}-word limit, so it could never be marked correct`,
          });
        }
      }
    });
    if (kind === 'listening' && question.location !== undefined) {
      issues.push({
        path: `${qPath}.location`,
        message: `${label}: Listening answers are marked on a script line, not with a location`,
      });
    }
  });

  if (group.layout) {
    const inGroup = new Set(group.questions.flatMap((q) => q.numbers));
    const slots = [...group.layout.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    for (const n of inGroup) {
      if (!slots.includes(n)) {
        issues.push({
          path: `${path}.layout.body`,
          message: `has no {{${n}}} gap for question ${n}`,
        });
      }
    }
    for (const n of slots) {
      if (!inGroup.has(n)) {
        issues.push({
          path: `${path}.layout.body`,
          message: `has a {{${n}}} gap but no question ${n} in this group`,
        });
      }
    }
  }
}

function checkNumbering(
  section: ReadingSection | ListeningSection,
  path: string,
  start: number | undefined, // Listening is always 10 a part; Reading follows the previous passage
  issues: ContentIssue[],
) {
  const numbers = numbersOf(section);
  const seen = new Set<number>();
  for (const n of numbers) {
    if (seen.has(n)) issues.push({ path, message: `question ${n} appears more than once` });
    seen.add(n);
  }
  const sorted = [...seen].sort((a, b) => a - b);
  const first = sorted[0];
  if (first === undefined) return;
  if (start !== undefined && first !== start) {
    issues.push({ path, message: `questions should start at ${start}, not ${first}` });
  }
  const missing: number[] = [];
  for (let n = first; n <= sorted[sorted.length - 1]!; n++) if (!seen.has(n)) missing.push(n);
  if (missing.length) issues.push({ path, message: `question numbers skip ${missing.join(', ')}` });
}

function checkWholeModule(
  kind: 'reading' | 'listening',
  parts: (ReadingSection | ListeningSection | undefined)[],
  issues: ContentIssue[],
) {
  const sections = parts.filter((section) => section !== undefined);
  if (sections.length < parts.length) return; // only a complete module must cover 1–40
  const numbers = new Set(sections.flatMap(numbersOf));
  const missing = Array.from({ length: 40 }, (_, i) => i + 1).filter((n) => !numbers.has(n));
  if (missing.length || numbers.size !== 40) {
    issues.push({
      path: 'sections',
      message: `${kind} parts together must cover questions 1–40${missing.length ? `; missing ${missing.join(', ')}` : ''}`,
    });
  }
}

function checkReadingLocations(section: ReadingSection, path: string, issues: ContentIssue[]) {
  const paragraphs = new Map(section.paragraphs.map((p) => [p.label, splitSentences(p.text)]));
  section.groups.forEach((group, g) =>
    group.questions.forEach((question, q) => {
      const where = `${path}.groups[${g}].questions[${q}].location`;
      const label = `Question ${question.numbers.join('–')}`;
      const { location } = question;
      if (location === undefined) {
        issues.push({
          path: where,
          message: `${label} needs a location, or null if the answer is NOT GIVEN`,
        });
        return;
      }
      if (location === null) {
        if (!question.acceptedAnswers.flat().every((a) => a === 'NOT GIVEN')) {
          issues.push({
            path: where,
            message: `${label} has no location, but its answer isn't NOT GIVEN`,
          });
        }
        return;
      }
      const sentences = paragraphs.get(location.paragraph);
      if (!sentences) {
        issues.push({
          path: where,
          message: `${label}: there is no paragraph ${location.paragraph}`,
        });
        return;
      }
      const sentence = sentences[location.sentence - 1];
      if (sentence === undefined) {
        issues.push({
          path: where,
          message: `${label}: paragraph ${location.paragraph} has ${sentences.length} sentences, not ${location.sentence}`,
        });
      } else if (!sentence.includes(location.highlight)) {
        issues.push({
          path: where,
          message: `${label}: "${location.highlight}" isn't in paragraph ${location.paragraph}, sentence ${location.sentence}: "${sentence}"`,
        });
      }
    }),
  );
}

function checkScript(
  section: ListeningSection,
  path: string,
  manifest: MediaManifest | null,
  issues: ContentIssue[],
) {
  section.script.forEach((line, i) => {
    const previous = section.script[i - 1];
    if (previous && line.start <= previous.start) {
      issues.push({
        path: `${path}.script[${i}].start`,
        message: `starts at ${line.start}s, not after the previous line (${previous.start}s)`,
      });
    }
    if (line.start >= section.durationSec) {
      issues.push({
        path: `${path}.script[${i}].start`,
        message: `starts at ${line.start}s, past the end of the ${section.durationSec}s audio`,
      });
    }
    if (line.answer && !line.text.includes(line.answer.highlight)) {
      issues.push({
        path: `${path}.script[${i}].answer.highlight`,
        message: `"${line.answer.highlight}" isn't in the line "${line.text}"`,
      });
    }
  });

  const numbers = new Set(numbersOf(section));
  for (const n of numbers) {
    const lines = section.script.filter((line) => line.answer?.question === n);
    if (lines.length !== 1) {
      issues.push({
        path: `${path}.script`,
        message: `question ${n} must be marked on exactly one script line (found ${lines.length})`,
      });
    }
  }
  section.script.forEach((line, i) => {
    if (line.answer && !numbers.has(line.answer.question)) {
      issues.push({
        path: `${path}.script[${i}].answer.question`,
        message: `marks question ${line.answer.question}, which isn't in this part`,
      });
    }
  });

  checkMediaPath(section.audio, `${path}.audio`, manifest, issues);
  const measured = manifest?.files.find((f) => f.path === section.audio)?.durationSec;
  if (measured !== undefined && Math.abs(measured - section.durationSec) > 1) {
    issues.push({
      path: `${path}.durationSec`,
      message: `says ${section.durationSec}s, but the audio file is ${measured}s long`,
    });
  }
}

function checkWriting(
  section: WritingSection,
  manifest: MediaManifest | null,
  issues: ContentIssue[],
) {
  const { image, imageDescription } = section.task1;
  if (imageDescription.trim() === '') {
    issues.push({
      path: 'sections.writing.task1.imageDescription',
      message: 'Task 1 image needs a description (the AI feedback reads it instead of the image)',
    });
  }
  if (image.startsWith('data:')) {
    const bytes = Math.floor(((image.length - image.indexOf(',') - 1) * 3) / 4);
    if (bytes > MAX_INLINE_IMAGE_BYTES) {
      issues.push({
        path: 'sections.writing.task1.image',
        message: `inline image is ${Math.round(bytes / 1024)} KB; over 700 KB, add it with npm run media instead`,
      });
    }
  } else {
    checkMediaPath(image, 'sections.writing.task1.image', manifest, issues);
  }
}

function checkMediaPath(
  mediaPath: string,
  path: string,
  manifest: MediaManifest | null,
  issues: ContentIssue[],
) {
  if (!manifest?.files.some((f) => f.path === mediaPath)) {
    issues.push({
      path,
      message: `${mediaPath} isn't in content/media-manifest.json; add the file to public/media and run npm run media`,
    });
  }
}
