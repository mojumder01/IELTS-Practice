import type { ListeningSection, Module, ReadingSection, TestFile } from '../schema/test';

/** One question-grid cell: a single number, or paired numbers that share one ("21–22"). */
export interface GridItem {
  numbers: number[];
  label: string;
}

export interface PartInfo {
  part: number;
  /** "Passage 1", "Part 1", "Task 1". */
  label: string;
  items: GridItem[];
  /** Every question number in the part, in order. */
  numbers: number[];
}

const PART_WORD: Record<Module, string> = {
  reading: 'Passage',
  listening: 'Part',
  writing: 'Task',
  speaking: 'Part',
};

export function partWord(module: Module): string {
  return PART_WORD[module];
}

function questionPart(
  part: number,
  module: Module,
  section: ReadingSection | ListeningSection,
): PartInfo {
  const items = section.groups.flatMap((g) =>
    g.questions.map((q) => ({ numbers: q.numbers, label: q.numbers.join('–') })),
  );
  return {
    part,
    label: `${PART_WORD[module]} ${part}`,
    items,
    numbers: items.flatMap((i) => i.numbers),
  };
}

/** The parts of a module this test has, in exam order. */
export function partsOf(test: TestFile, module: Module): PartInfo[] {
  const parts: PartInfo[] = [];
  if (module === 'reading' || module === 'listening') {
    const count = module === 'reading' ? 3 : 4;
    for (let part = 1; part <= count; part++) {
      const section = test.sections[`${module}-${part}` as 'reading-1'];
      if (section?.kind === 'reading' || section?.kind === 'listening') {
        parts.push(questionPart(part, module, section));
      }
    }
  } else if (module === 'writing' && test.sections.writing) {
    for (const part of [1, 2]) parts.push({ part, label: `Task ${part}`, items: [], numbers: [] });
  } else if (module === 'speaking' && test.sections.speaking) {
    for (const part of [1, 2, 3])
      parts.push({ part, label: `Part ${part}`, items: [], numbers: [] });
  }
  return parts;
}

/** "1–13", or "" for a part without numbered questions. */
export function rangeLabel(info: PartInfo): string {
  if (info.numbers.length === 0) return '';
  const first = Math.min(...info.numbers);
  const last = Math.max(...info.numbers);
  return first === last ? String(first) : `${first}–${last}`;
}

export const MODULE_ORDER: Module[] = ['listening', 'reading', 'writing', 'speaking'];

export function moduleName(module: Module): string {
  return module.charAt(0).toUpperCase() + module.slice(1);
}

export function neighbourModules(module: Module): { previous: Module | null; next: Module | null } {
  const i = MODULE_ORDER.indexOf(module);
  return { previous: MODULE_ORDER[i - 1] ?? null, next: MODULE_ORDER[i + 1] ?? null };
}
