import { z } from 'zod';

// Test content (SPEC section 4). Authored as JSON in content/tests/, published to
// Firestore as tests/{testId} plus one tests/{testId}/sections/{sectionId} doc each.

export const TRACKS = ['academic', 'general'] as const;
export const MODULES = ['listening', 'reading', 'writing', 'speaking'] as const;
export const QUESTION_TYPES = [
  'MULTIPLE_CHOICE_SINGLE',
  'MULTIPLE_CHOICE_MULTIPLE',
  'TRUE_FALSE_NOT_GIVEN',
  'YES_NO_NOT_GIVEN',
  'MATCHING_HEADINGS',
  'MATCHING_PARAGRAPH_INFO',
  'MATCHING_FEATURES',
  'MATCHING_SENTENCE_ENDINGS',
  'GAP_FILL', // sentence, summary, note, table, flow-chart, form
  'DIAGRAM_LABEL',
  'SHORT_ANSWER',
] as const;

const text = z.string().trim().min(1);
const minutes = z.number().int().positive();
const questionNumber = z.number().int().min(1).max(40);

export const TrackSchema = z.enum(TRACKS);
export const ModuleSchema = z.enum(MODULES);
export const QuestionTypeSchema = z.enum(QUESTION_TYPES);

export const TestMetaSchema = z.strictObject({
  testId: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use lower-case words joined by hyphens'),
  book: text,
  testNumber: z.number().int().positive(),
  track: TrackSchema,
  status: z.enum(['draft', 'live']),
  timing: z.strictObject({
    listening: z.strictObject({
      singlePartMin: minutes,
      fullMockMin: minutes,
      checkMin: z.number().int().nonnegative(),
    }),
    reading: z.strictObject({ singlePartMin: minutes, fullMockMin: minutes }),
    writing: z.strictObject({ task1Min: minutes, task2Min: minutes, fullMockMin: minutes }),
  }),
  studentHelp: z.strictObject({
    allowReveal: z.boolean(),
    showScriptInSinglePart: z.boolean(),
    lockAudioInFullMock: z.boolean(),
  }),
});

/** Summary, note, table, form or flow-chart template: Markdown with {{n}} where question n's input goes. */
export const GapLayoutSchema = z.strictObject({
  kind: z.enum(['summary', 'notes', 'table', 'form', 'flow']),
  title: text.optional(),
  body: text,
});

export const AnswerLocationSchema = z.strictObject({
  paragraph: text,
  sentence: z.number().int().positive(), // 1-based within the paragraph
  highlight: text, // exact words; must occur in that sentence
});

const OptionSchema = z.strictObject({ key: text, text: text });

export const QuestionSchema = z
  .strictObject({
    numbers: z.array(questionNumber).min(1).max(3),
    prompt: z.string().optional(),
    // Multiple choice where each question has its own A/B/C (Listening Q7–8). Not in the
    // SPEC's shape, which only has group-level options for shared lists.
    options: z.array(OptionSchema).min(2).optional(),
    acceptedAnswers: z.array(z.array(z.string())), // one list per number; alternatives allowed
    explanation: z.string().optional(),
    location: AnswerLocationSchema.nullable().optional(), // Reading only; null = Not Given
  })
  .refine((q) => q.acceptedAnswers.length === q.numbers.length, {
    message: 'acceptedAnswers needs one list per question number',
    path: ['acceptedAnswers'],
  });

export const QuestionGroupSchema = z.strictObject({
  groupId: text,
  type: QuestionTypeSchema,
  instructions: text,
  wordLimit: text.optional(),
  maxWords: z.number().int().min(1).max(5).optional(),
  allowNumber: z.boolean().optional(),
  layout: GapLayoutSchema.optional(),
  options: z.array(OptionSchema).min(2).optional(), // shared list: A–G, i–x, headings, features
  answersPerItem: z.number().int().min(2).max(3).optional(),
  questions: z.array(QuestionSchema).min(1),
});

export const ReadingSectionSchema = z.strictObject({
  kind: z.literal('reading'),
  part: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: text,
  subtitle: text.optional(),
  paragraphs: z.array(z.strictObject({ label: text, text: text })).min(1),
  groups: z.array(QuestionGroupSchema).min(1),
});

export const ScriptLineSchema = z.strictObject({
  start: z.number().nonnegative(), // seconds from the start of the audio
  speaker: text,
  text: text,
  answer: z.strictObject({ question: questionNumber, highlight: text }).optional(),
});

export const ListeningSectionSchema = z.strictObject({
  kind: z.literal('listening'),
  part: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  audio: z.string().startsWith('/media/audio/'),
  durationSec: z.number().positive(),
  context: text.optional(),
  script: z.array(ScriptLineSchema).min(1),
  groups: z.array(QuestionGroupSchema).min(1),
});

/** A Hosting path from npm run media, or an inline data URL for images under 700 KB. */
const imageRef = z.union([
  z.string().startsWith('/media/img/'),
  z.string().regex(/^data:image\/(png|jpeg|webp|svg\+xml);base64,/, 'expected an image data URL'),
]);

export const WritingSectionSchema = z.strictObject({
  kind: z.literal('writing'),
  task1: z.strictObject({
    prompt: text,
    image: imageRef,
    imageDescription: z.string(),
    minWords: z.number().int().positive(),
  }),
  task2: z.strictObject({
    prompt: text,
    minWords: z.number().int().positive(),
    modelAnswer: text.optional(),
  }),
});

export const SpeakingSectionSchema = z.strictObject({
  kind: z.literal('speaking'),
  part1: z.array(text).min(1),
  part2: z.strictObject({
    topic: text,
    points: z.array(text).min(1),
    closing: text,
    prepSec: z.literal(60),
    speakSec: z.literal(120),
  }),
  part3: z.array(text).min(1),
});

export const SectionSchema = z.discriminatedUnion('kind', [
  ReadingSectionSchema,
  ListeningSectionSchema,
  WritingSectionSchema,
  SpeakingSectionSchema,
]);

export const SECTION_IDS = [
  'listening-1',
  'listening-2',
  'listening-3',
  'listening-4',
  'reading-1',
  'reading-2',
  'reading-3',
  'writing',
  'speaking',
] as const;
export const SectionIdSchema = z.enum(SECTION_IDS);

export type Track = z.infer<typeof TrackSchema>;
export type Module = z.infer<typeof ModuleSchema>;
export type QuestionType = z.infer<typeof QuestionTypeSchema>;
export type TestMeta = z.infer<typeof TestMetaSchema>;
export type GapLayout = z.infer<typeof GapLayoutSchema>;
export type AnswerLocation = z.infer<typeof AnswerLocationSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type QuestionGroup = z.infer<typeof QuestionGroupSchema>;
export type ReadingSection = z.infer<typeof ReadingSectionSchema>;
export type ScriptLine = z.infer<typeof ScriptLineSchema>;
export type ListeningSection = z.infer<typeof ListeningSectionSchema>;
export type WritingSection = z.infer<typeof WritingSectionSchema>;
export type SpeakingSection = z.infer<typeof SpeakingSectionSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type SectionId = z.infer<typeof SectionIdSchema>;

/** The Firestore document ID a section is stored under. */
export function sectionIdOf(section: Section): SectionId {
  switch (section.kind) {
    case 'reading':
      return `reading-${section.part}`;
    case 'listening':
      return `listening-${section.part}`;
    default:
      return section.kind;
  }
}

/** One file in content/tests/: the test's metadata and the sections written so far. */
export const TestFileSchema = z
  .strictObject({
    meta: TestMetaSchema,
    sections: z.partialRecord(SectionIdSchema, SectionSchema),
  })
  .superRefine((file, ctx) => {
    for (const [id, section] of Object.entries(file.sections)) {
      if (section && sectionIdOf(section) !== id) {
        ctx.addIssue({
          code: 'custom',
          path: ['sections', id],
          message: `holds a ${sectionIdOf(section)} section; its key must be "${sectionIdOf(section)}"`,
        });
      }
    }
    if (Object.keys(file.sections).length === 0) {
      ctx.addIssue({ code: 'custom', path: ['sections'], message: 'add at least one section' });
    }
  });

export type TestFile = z.infer<typeof TestFileSchema>;
