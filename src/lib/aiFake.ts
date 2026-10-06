import type { Generate } from './ai';

/**
 * e2e builds only (VITE_USE_EMULATORS): AI Logic has no emulator, so this answers like the
 * model would. An essay containing "[unreadable]" gets an unusable reply every time.
 */
export const fakeGenerate: Generate = (prompt) => {
  if (prompt.includes('[unreadable]')) return Promise.resolve('Sorry, I can’t help with that.');
  const task1 = prompt.includes('Task 1 response');
  return Promise.resolve(
    JSON.stringify({
      criteria: [
        {
          name: task1 ? 'Task achievement' : 'Task response',
          band: 6,
          comment: 'Clear view, but stated only in the conclusion.',
        },
        {
          name: 'Coherence and cohesion',
          band: 7,
          comment: 'Logical paragraphs with clear linking.',
        },
        { name: 'Lexical resource', band: 6.5, comment: 'Accurate but repetitive.' },
        {
          name: 'Grammatical range and accuracy',
          band: 6.5,
          comment: 'Good mix of complex sentences, with one agreement error.',
        },
      ],
      topFixes: [
        'State your position in the introduction, not only in the conclusion.',
        'Give the counter-argument paragraph its own example.',
        'Vary your wording.',
      ],
      corrections: [
        {
          original: 'the number of cars are rising',
          suggested: 'the number of cars is rising',
          reason: 'Subject–verb agreement',
        },
      ],
    }),
  );
};
