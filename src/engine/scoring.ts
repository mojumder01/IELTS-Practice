import type { QuestionGroup, QuestionType, TestFile, Track } from '../schema/test';
import { isCorrect, markPaired } from './answers';
import { listeningReadingBand, tableFor, type BandResult } from './bands';
import type { PartInfo } from './parts';

export interface QuestionResult {
  number: number;
  type: QuestionType;
  given: string;
  /** What to show as the answer: the first accepted alternative (all of them for paired items). */
  expected: string;
  correct: boolean;
  status: 'correct' | 'incorrect' | 'skipped';
}

export interface Score {
  raw: number;
  total: number;
  band: number;
  estimate: boolean;
  byType: Partial<Record<QuestionType, { correct: number; total: number }>>;
}

/** Marks one group's questions against the student's answers. */
export function markGroup(group: QuestionGroup, answers: Record<string, string>): QuestionResult[] {
  return group.questions.flatMap((question) => {
    const given = question.numbers.map((n) => answers[String(n)] ?? '');
    const marks =
      question.numbers.length > 1
        ? markPaired(given, question.acceptedAnswers)
        : [isCorrect(given[0]!, question.acceptedAnswers[0] ?? [], group.maxWords)];
    const expectedAll = question.acceptedAnswers.map((list) => list[0] ?? '').join(', ');
    return question.numbers.map((number, i) => ({
      number,
      type: group.type,
      given: given[i]!,
      expected:
        question.numbers.length > 1 ? expectedAll : (question.acceptedAnswers[i]?.[0] ?? ''),
      correct: marks[i]!,
      status: marks[i] ? 'correct' : given[i]!.trim() ? 'incorrect' : 'skipped',
    }));
  });
}

/** Every question in the given parts of a Reading or Listening module, marked. */
export function markParts(
  test: TestFile,
  module: 'reading' | 'listening',
  parts: PartInfo[],
  answers: Record<string, string>,
): QuestionResult[] {
  return parts.flatMap((part) => {
    const section = test.sections[`${module}-${part.part}` as 'reading-1'];
    if (section?.kind !== 'reading' && section?.kind !== 'listening') return [];
    return section.groups.flatMap((group) => markGroup(group, answers));
  });
}

export function scoreResults(
  results: QuestionResult[],
  module: 'reading' | 'listening',
  track: Track,
): Score {
  const byType: Score['byType'] = {};
  for (const r of results) {
    const entry = (byType[r.type] ??= { correct: 0, total: 0 });
    entry.total++;
    if (r.correct) entry.correct++;
  }
  const raw = results.filter((r) => r.correct).length;
  const band: BandResult = listeningReadingBand(raw, results.length, tableFor(module, track));
  return { raw, total: results.length, band: band.band, estimate: band.estimate, byType };
}
