// The Writing artboard's sample Task 2 essay and its feedback, as model JSON.
export const SAMPLE_ESSAY =
  'In many growing cities, traffic congestion has become a daily problem. Some people argue that governments should spend more money on buses and trains rather than building new roads.\n\nThere are several reasons why public transport deserves more investment. Firstly, a single bus can carry as many passengers as forty private cars, so it uses road space far more efficiently. Secondly, the number of cars are rising every year, and new roads often fill up again within a short time. For example, when a new highway opened in my city, the traffic jams returned after only a few months.\n\nOn the other hand, roads are still necessary. Goods are delivered by trucks, and people in rural areas may have no access to trains. Emergency services also depend on a reliable road network.\n\nIn conclusion, I agree that public transport should receive the larger share of funding, although some road maintenance will always be needed.';

export const SAMPLE_MODEL_REPLY = JSON.stringify({
  criteria: [
    {
      name: 'Task response',
      band: 6,
      comment:
        'Clear view, but stated only in the conclusion. Under 250 words, which can hold this score down.',
    },
    {
      name: 'Coherence and cohesion',
      band: 7,
      comment: 'Logical paragraphs with clear linking: Firstly, Secondly, On the other hand.',
    },
    {
      name: 'Lexical resource',
      band: 6.5,
      comment: 'Accurate but repetitive: road or roads appears 6 times.',
    },
    {
      name: 'Grammatical range and accuracy',
      band: 6.5,
      comment: 'Good mix of complex sentences, with one agreement error.',
    },
  ],
  topFixes: [
    'State your position in the introduction, not only in the conclusion.',
    'Add about 100 words: give the counter-argument paragraph its own example.',
    'Vary your wording: road network, infrastructure, highways.',
  ],
  corrections: [
    {
      original: 'the number of cars are rising',
      suggested: 'the number of cars is rising',
      reason: 'Subject–verb agreement',
    },
    {
      original: 'as many passengers as forty private cars',
      suggested: 'as many passengers as around forty cars',
      reason: 'Soften figures you cannot support',
    },
  ],
});
