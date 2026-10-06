import { z } from 'zod';
import { ModuleSchema, QuestionTypeSchema } from './test';

/** A Firestore Timestamp, read by its fields so this schema doesn't depend on the SDK. */
export const TimestampSchema = z.custom<{ seconds: number; nanoseconds: number }>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { seconds?: unknown }).seconds === 'number' &&
    typeof (value as { nanoseconds?: unknown }).nanoseconds === 'number',
  'expected a Firestore Timestamp',
);

const band = z.number().min(0).max(9).multipleOf(0.5);

/** Writing AI feedback (SPEC section 7). `overall` is computed in the app, never trusted from the model. */
export const WritingFeedbackSchema = z.strictObject({
  task: z.union([z.literal(1), z.literal(2)]),
  criteria: z
    .array(
      z.strictObject({
        name: z.enum([
          'Task achievement',
          'Task response',
          'Coherence and cohesion',
          'Lexical resource',
          'Grammatical range and accuracy',
        ]),
        band,
        comment: z.string(),
      }),
    )
    .length(4),
  overall: band,
  topFixes: z.array(z.string()).length(3),
  corrections: z
    .array(z.strictObject({ original: z.string(), suggested: z.string(), reason: z.string() }))
    .max(5),
});

export const SpeakingCriterionSchema = z.enum(['fluency', 'lexical', 'grammar', 'pronunciation']);

/** users/{uid}/attempts/{attemptId}: one sitting of one module in one mode. */
export const AttemptSchema = z.strictObject({
  attemptId: z.string().min(1),
  testId: z.string().min(1),
  module: ModuleSchema,
  mode: z.enum(['single', 'full']),
  part: z.number().int().min(1).max(4).optional(),
  status: z.enum(['in_progress', 'submitted']),
  startedAt: TimestampSchema,
  updatedAt: TimestampSchema,
  submittedAt: TimestampSchema.optional(),
  timeLeftSec: z.number().nonnegative(),
  answers: z.record(z.string().regex(/^([1-9]|[1-3][0-9]|40)$/), z.string()),
  flagged: z.array(z.number().int().min(1).max(40)),
  notes: z.string().optional(),
  scriptMarks: z.array(z.number().int().nonnegative()).optional(),
  revealUsed: z.boolean(),
  score: z
    .strictObject({
      raw: z.number().int().nonnegative(),
      total: z.number().int().positive(),
      band,
      estimate: z.boolean().optional(), // scaled from a single part
      byType: z.partialRecord(
        QuestionTypeSchema,
        z.strictObject({
          correct: z.number().int().nonnegative(),
          total: z.number().int().nonnegative(),
        }),
      ),
    })
    .optional(),
  // Feedback is kept per task (the SPEC sketch has a single `ai`).
  writing: z
    .strictObject({
      task1: z.string(),
      task2: z.string(),
      ai: z
        .strictObject({
          task1: WritingFeedbackSchema.optional(),
          task2: WritingFeedbackSchema.optional(),
        })
        .optional(),
    })
    .optional(),
  speaking: z
    .strictObject({
      selfScores: z.record(SpeakingCriterionSchema, band),
      covered: z.array(z.string()),
      recordingKeys: z.array(z.string()),
    })
    .optional(),
});

export type Timestamp = z.infer<typeof TimestampSchema>;
export type WritingFeedback = z.infer<typeof WritingFeedbackSchema>;
export type Attempt = z.infer<typeof AttemptSchema>;
