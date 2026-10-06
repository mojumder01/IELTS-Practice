import { z } from 'zod';
import { roundToHalf, writingTaskBand } from '../engine/bands';
import { essayWordCount } from '../engine/writing';
import type { WritingFeedback } from '../schema/attempt';

// Writing AI feedback (SPEC section 7). The model only suggests criterion bands, comments,
// fixes and corrections; the app checks every field and computes the overall band itself.

export interface FeedbackRequest {
  task: 1 | 2;
  prompt: string;
  /** Task 1 only: the chart, described in words. */
  imageDescription?: string;
  essay: string;
}

/** Sends a prompt and returns the model's raw text. Firebase AI Logic in the app; a fake in tests. */
export type Generate = (prompt: string) => Promise<string>;

export class FeedbackError extends Error {}

const CRITERIA = {
  1: [
    'Task achievement',
    'Coherence and cohesion',
    'Lexical resource',
    'Grammatical range and accuracy',
  ],
  2: [
    'Task response',
    'Coherence and cohesion',
    'Lexical resource',
    'Grammatical range and accuracy',
  ],
} as const;

/** What the model is asked to return; also sent to it as the response JSON Schema. */
export const ModelFeedbackSchema = z.object({
  criteria: z
    .array(
      z.object({ name: z.string(), band: z.number().min(0).max(9), comment: z.string().min(1) }),
    )
    .length(4),
  topFixes: z.array(z.string().min(1)).min(3),
  corrections: z.array(
    z.object({
      original: z.string().min(1),
      suggested: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
});

export const modelFeedbackJsonSchema = z.toJSONSchema(ModelFeedbackSchema);

export function buildPrompt(req: FeedbackRequest): string {
  const names = CRITERIA[req.task];
  return [
    `You are an experienced IELTS examiner. Assess this Academic Writing Task ${req.task} response using the public IELTS band descriptors.`,
    'Reply with JSON only, matching the response schema:',
    `- "criteria": exactly four entries, in this order, with these exact names: ${names.map((n) => `"${n}"`).join(', ')}. Give each a band from 0 to 9 in half bands and a comment of one or two sentences that points to the essay.`,
    '- "topFixes": the three changes that would raise the score most, most important first, each one short sentence.',
    '- "corrections": up to five language errors. "original" must be copied exactly, character for character, from the essay; "suggested" is the corrected wording; "reason" names the rule in a few words.',
    'Be strict but fair, and judge the essay as written: under-length responses lose marks.',
    '',
    `Task prompt:\n${req.prompt}`,
    ...(req.imageDescription ? [`\nThe chart, described in words:\n${req.imageDescription}`] : []),
    `\nWord count: ${essayWordCount(req.essay)}`,
    `\nEssay:\n${req.essay}`,
  ].join('\n');
}

/** Checks the model's JSON and turns it into WritingFeedback; throws on anything unusable. */
export function parseFeedback(raw: string, req: FeedbackRequest): WritingFeedback {
  const json: unknown = JSON.parse(raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
  const model = ModelFeedbackSchema.parse(json);
  const names = CRITERIA[req.task];
  const criteria = names.map((name) => {
    const found = model.criteria.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
    if (!found) throw new Error(`The feedback has no "${name}" band`);
    return { name, band: roundToHalf(found.band), comment: found.comment.trim() };
  });
  return {
    task: req.task,
    criteria,
    overall: writingTaskBand(criteria.map((c) => c.band)), // never trusted from the model
    topFixes: model.topFixes.slice(0, 3),
    corrections: model.corrections.filter((c) => req.essay.includes(c.original)).slice(0, 5),
  };
}

/** Asks for feedback, retrying once if the reply can't be read. */
export async function requestFeedback(
  req: FeedbackRequest,
  generate: Generate,
): Promise<WritingFeedback> {
  const prompt = buildPrompt(req);
  for (let attempt = 1; attempt <= 2; attempt++) {
    let raw: string;
    try {
      raw = await generate(prompt);
    } catch (error) {
      console.error('AI feedback request failed', error);
      throw new FeedbackError('The AI couldn’t be reached. Check your connection, then try again.');
    }
    try {
      return parseFeedback(raw, req);
    } catch (error) {
      console.warn(`AI feedback attempt ${attempt} was unusable`, error);
    }
  }
  throw new FeedbackError('The AI’s reply couldn’t be read. Please try again.');
}
