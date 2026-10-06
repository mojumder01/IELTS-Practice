import { SectionSchema, type QuestionGroup, type Section } from './test';

// Firestore can't store an array inside an array, so a question's acceptedAnswers
// (string[][], one list per number) is stored as [{ answers: string[] }]. Everything
// else is stored as authored. The seed script and src/lib/db.ts share these.

type StoredGroup = Omit<QuestionGroup, 'questions'> & {
  questions: (Omit<QuestionGroup['questions'][number], 'acceptedAnswers'> & {
    acceptedAnswers: { answers: string[] }[];
  })[];
};

function encodeGroup(group: QuestionGroup): StoredGroup {
  return {
    ...group,
    questions: group.questions.map((q) => ({
      ...q,
      acceptedAnswers: q.acceptedAnswers.map((answers) => ({ answers })),
    })),
  };
}

function decodeGroup(group: StoredGroup): QuestionGroup {
  return {
    ...group,
    questions: group.questions.map((q) => ({
      ...q,
      acceptedAnswers: q.acceptedAnswers.map((item) => item.answers),
    })),
  };
}

export function encodeSection(section: Section): Record<string, unknown> {
  if (section.kind === 'reading' || section.kind === 'listening') {
    return { ...section, groups: section.groups.map(encodeGroup) };
  }
  return { ...section };
}

/** Rebuilds a section from its Firestore document and validates it; throws on bad data. */
export function decodeSection(data: unknown): Section {
  const record = data as { kind?: unknown; groups?: StoredGroup[] };
  const restored =
    (record.kind === 'reading' || record.kind === 'listening') && Array.isArray(record.groups)
      ? { ...record, groups: record.groups.map(decodeGroup) }
      : data;
  return SectionSchema.parse(restored);
}
