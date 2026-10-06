import { z } from 'zod';

const text = z.string().trim().min(1);

export const VocabStatusSchema = z.enum(['new', 'learning', 'mastered']);

/** Spaced-review schedule (SM-2 style; Phase 8). `due` is a calendar date, YYYY-MM-DD. */
export const SrsSchema = z.strictObject({
  due: z.iso.date(),
  intervalDays: z.number().int().nonnegative(),
  ease: z.number().min(1.3).max(5),
  reps: z.number().int().nonnegative(),
});

/** users/{uid}/vocab/{wordId} (SPEC section 4). */
export const VocabWordSchema = z.strictObject({
  word: text,
  // A word saved from a passage may wait for its part of speech and Bangla.
  pos: z.string().trim(),
  ipa: z.string(),
  topic: text,
  meaning: text,
  bangla: z.string().trim(),
  example: z.string(),
  source: z.union([
    z.literal('manual'),
    z.strictObject({ testId: text, question: z.number().int().min(1).max(40).optional() }),
  ]),
  status: VocabStatusSchema,
  srs: SrsSchema,
});

/** content/vocab/seed.json: the starter word list. */
export const VocabSeedSchema = z
  .array(VocabWordSchema.extend({ pos: text, bangla: text }))
  .superRefine((words, ctx) => {
    const seen = new Map<string, number>();
    words.forEach((w, i) => {
      const id = vocabIdOf(w.word);
      const first = seen.get(id);
      if (first !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [i, 'word'],
          message: `duplicates entry ${first} ("${w.word}")`,
        });
      }
      seen.set(id, i);
    });
  });

/** Document ID for a word: "well-being" → "well-being", "Carbon Footprint" → "carbon-footprint". */
export function vocabIdOf(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export type VocabStatus = z.infer<typeof VocabStatusSchema>;
export type Srs = z.infer<typeof SrsSchema>;
export type VocabWord = z.infer<typeof VocabWordSchema>;
