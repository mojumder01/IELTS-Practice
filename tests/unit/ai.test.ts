import { describe, expect, it, vi } from 'vitest';
import { essayWordCount, wordNote } from '../../src/engine/writing';
import {
  buildPrompt,
  FeedbackError,
  parseFeedback,
  requestFeedback,
  type FeedbackRequest,
} from '../../src/lib/ai';
import { SAMPLE_ESSAY, SAMPLE_MODEL_REPLY } from '../fixtures/writingSample';

const req: FeedbackRequest = { task: 2, prompt: 'Some people believe…', essay: SAMPLE_ESSAY };

describe('essay word count', () => {
  it('counts whitespace-separated words', () => {
    expect(essayWordCount('  A well-known  city,\nin 2025. ')).toBe(5);
    expect(essayWordCount('')).toBe(0);
    expect(essayWordCount(SAMPLE_ESSAY)).toBe(154);
  });

  it('says how far there is to go', () => {
    expect(wordNote(212, 250)).toBe('38 more to reach the minimum');
    expect(wordNote(260, 250)).toBe('Minimum reached');
  });
});

describe('AI feedback', () => {
  it('asks for JSON with the task’s four criteria, and sends the essay and word count', () => {
    const prompt = buildPrompt({ ...req, task: 1, imageDescription: 'Line graph…' });
    expect(prompt).toContain('"Task achievement"');
    expect(prompt).toContain('The chart, described in words:\nLine graph…');
    expect(buildPrompt(req)).toContain('"Task response"');
    expect(buildPrompt(req)).toContain('Word count: 154');
  });

  it('turns the sample reply into feedback, computing the overall band itself', () => {
    const feedback = parseFeedback(SAMPLE_MODEL_REPLY, req);
    expect(feedback.criteria.map((c) => [c.name, c.band])).toEqual([
      ['Task response', 6],
      ['Coherence and cohesion', 7],
      ['Lexical resource', 6.5],
      ['Grammatical range and accuracy', 6.5],
    ]);
    expect(feedback.overall).toBe(6.5); // mean 6.5, rounded down to the half
    expect(feedback.topFixes).toHaveLength(3);
    expect(feedback.corrections).toHaveLength(2);
  });

  it('ignores a model overall, drops corrections not in the essay and keeps at most 3 fixes and 5 corrections', () => {
    const raw = JSON.parse(SAMPLE_MODEL_REPLY) as {
      topFixes: string[];
      corrections: object[];
      overall?: number;
    };
    raw.overall = 9;
    raw.topFixes.push('A fourth fix');
    raw.corrections.push({ original: 'not in the essay', suggested: 'x', reason: 'y' });
    const feedback = parseFeedback(JSON.stringify(raw), req);
    expect(feedback.overall).toBe(6.5);
    expect(feedback.topFixes).toHaveLength(3);
    expect(feedback.corrections.map((c) => c.original)).not.toContain('not in the essay');
  });

  it('accepts JSON wrapped in a code fence and rounds odd bands to a half', () => {
    const raw = JSON.parse(SAMPLE_MODEL_REPLY) as { criteria: { band: number }[] };
    raw.criteria[0]!.band = 6.3;
    expect(parseFeedback('```json\n' + JSON.stringify(raw) + '\n```', req).criteria[0]!.band).toBe(
      6.5,
    );
  });

  it('rejects replies with missing or wrong criteria', () => {
    const raw = JSON.parse(SAMPLE_MODEL_REPLY) as { criteria: { name: string }[] };
    raw.criteria[0]!.name = 'Task achievement';
    expect(() => parseFeedback(JSON.stringify(raw), req)).toThrow(/Task response/);
    expect(() => parseFeedback('not json', req)).toThrow();
  });

  it('retries once on an unreadable reply', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce('{"criteria": []}')
      .mockResolvedValueOnce(SAMPLE_MODEL_REPLY);
    const feedback = await requestFeedback(req, generate);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(feedback.overall).toBe(6.5);
  });

  it('gives up with a retry message after two bad replies, never a crash', async () => {
    const generate = vi.fn().mockResolvedValue('Sorry, I cannot help with that.');
    await expect(requestFeedback(req, generate)).rejects.toThrow(
      new FeedbackError('The AI’s reply couldn’t be read. Please try again.'),
    );
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('reports a failed request without retrying', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('quota'));
    await expect(requestFeedback(req, generate)).rejects.toThrow(/couldn’t be reached/);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
