import type { Module, QuestionType } from '../schema/test';
import { overallBand, writingBand, type BandTable } from './bands';
import { MODULE_ORDER, partWord } from './parts';
import type { AttemptRecord } from './session';
import { selfScoreBand } from './speaking';

/** A module band from one attempt, and what it rests on. */
export interface AttemptBand {
  band: number;
  /** Scaled from one part, or Writing from Task 2 alone. */
  estimate: boolean;
  /** "31 / 40 correct · auto-scored", "AI estimate · Task 2 only", "Self-assessed". */
  basis: string;
}

/** The band an attempt earned, or null when it has none (not submitted, unscored). */
export function attemptBand(a: AttemptRecord): AttemptBand | null {
  if (a.status !== 'submitted') return null;
  switch (a.module) {
    case 'listening':
    case 'reading':
      if (!a.score) return null;
      return {
        band: a.score.band,
        estimate: a.score.estimate ?? false,
        basis: `${a.score.raw} / ${a.score.total} correct · ${a.score.estimate ? 'estimate' : 'auto-scored'}`,
      };
    case 'writing': {
      const task1 = a.writing?.ai?.task1?.overall ?? null;
      const task2 = a.writing?.ai?.task2?.overall;
      if (task2 === undefined) return null;
      const result = writingBand(task1, task2);
      return {
        band: result.band,
        estimate: result.estimate,
        basis: result.estimate ? 'AI estimate · Task 2 only' : 'AI estimate · both tasks',
      };
    }
    case 'speaking': {
      const band = a.speaking ? selfScoreBand(a.speaking.selfScores) : null;
      if (band === null) return null;
      const takes = a.speaking?.recordingKeys.length ?? 0;
      return {
        band,
        estimate: false,
        basis: `Self-assessed · ${takes} ${takes === 1 ? 'take' : 'takes'}`,
      };
    }
  }
}

/** Band history counts submitted, scored attempts where no answer was shown (SPEC section 7). */
export function countsTowardBands(a: AttemptRecord): boolean {
  return !a.revealUsed && attemptBand(a) !== null;
}

const finishedAt = (a: AttemptRecord) => a.submittedAt ?? a.updatedAt;

/** Newest first. */
export function byNewest(attempts: AttemptRecord[]): AttemptRecord[] {
  return [...attempts].sort((a, b) => finishedAt(b) - finishedAt(a));
}

export interface ModuleStanding {
  module: Module;
  attempt: AttemptRecord;
  band: AttemptBand;
  /** The band from the counted attempt before it, for "Up 0.5 from last test". */
  previous: number | null;
}

/** The latest counted band per module, with the one before it. */
export function latestBands(attempts: AttemptRecord[]): Partial<Record<Module, ModuleStanding>> {
  const counted = byNewest(attempts).filter(countsTowardBands);
  const out: Partial<Record<Module, ModuleStanding>> = {};
  for (const module of MODULE_ORDER) {
    const mine = counted.filter((a) => a.module === module);
    const [latest, before] = mine;
    if (!latest) continue;
    out[module] = {
      module,
      attempt: latest,
      band: attemptBand(latest)!,
      previous: before ? attemptBand(before)!.band : null,
    };
  }
  return out;
}

/** "Up 0.5 from last test", "Down 0.5…", "Same as last test", "First attempt". */
export function trendText(current: number, previous: number | null): string {
  if (previous === null) return 'First attempt';
  const diff = current - previous;
  if (diff === 0) return 'Same as last test';
  return `${diff > 0 ? 'Up' : 'Down'} ${Math.abs(diff).toFixed(1)} from last test`;
}

/** "On target", "0.5 to target". */
export function targetGapText(band: number, target: number): string {
  return band >= target ? 'On target' : `${(target - band).toFixed(1)} to target`;
}

// ---- Overall band ----------------------------------------------------------------------------

export type ModuleBands = Record<Module, number>;

export interface OverallExplained {
  overall: number;
  mean: number;
  /** "(7.0 + 7.0 + 6.5 + 6.0) ÷ 4 = 6.625" */
  formula: string;
  /** "6.625 rounds down to 6.5", "6.75 rounds up to 7.0", "6.5 needs no rounding" */
  rule: string;
}

/** Up to three decimals with no trailing zeros, but at least one: 6.625, 6.75, 6.5, 7.0. */
function meanText(mean: number): string {
  const text = mean.toFixed(3).replace(/0+$/, '');
  return text.endsWith('.') ? `${text}0` : text;
}

export function explainOverall(bands: ModuleBands): OverallExplained {
  const values = MODULE_ORDER.map((m) => bands[m]) as [number, number, number, number];
  const mean = values.reduce((a, b) => a + b, 0) / 4;
  const overall = overallBand(values);
  const m = meanText(mean);
  const rule =
    Math.abs(overall - mean) < 1e-9
      ? `${m} needs no rounding`
      : `${m} rounds ${overall > mean ? 'up' : 'down'} to ${overall.toFixed(1)}`;
  return {
    overall,
    mean,
    formula: `(${values.map((v) => v.toFixed(1)).join(' + ')}) ÷ 4 = ${m}`,
    rule,
  };
}

/** The four latest bands, or null until every module has one. */
export function currentBands(
  standings: Partial<Record<Module, ModuleStanding>>,
): ModuleBands | null {
  const bands: Partial<ModuleBands> = {};
  for (const m of MODULE_ORDER) {
    const s = standings[m];
    if (!s) return null;
    bands[m] = s.band.band;
  }
  return bands as ModuleBands;
}

/** What-if steppers move by half a band within 0–9. */
export function stepBand(band: number, direction: 1 | -1): number {
  return Math.min(9, Math.max(0, band + direction * 0.5));
}

export interface RouteOption {
  module: Module;
  from: number;
  to: number;
}

/**
 * The fewest half-band steps that lift the overall band to the target, from one module below the
 * target if possible (biggest gap first); if no one module can do it alone, the lowest rise together.
 */
export function routeToTarget(
  bands: ModuleBands,
  target: number,
): { reached: boolean; options: RouteOption[][] } {
  if (explainOverall(bands).overall >= target) return { reached: true, options: [] };
  const single: { option: RouteOption; steps: number }[] = [];
  for (const module of MODULE_ORDER) {
    for (let to = bands[module] + 0.5; to <= 9; to += 0.5) {
      if (explainOverall({ ...bands, [module]: to }).overall >= target) {
        single.push({
          option: { module, from: bands[module], to },
          steps: (to - bands[module]) * 2,
        });
        break;
      }
    }
  }
  // Modules already on target stay steady when a module below it can do the job.
  const below = single.filter((s) => s.option.from < target);
  const candidates = below.length ? below : single;
  if (candidates.length) {
    const fewest = Math.min(...candidates.map((s) => s.steps));
    return {
      reached: false,
      options: candidates
        .filter((s) => s.steps === fewest)
        .sort((a, b) => a.option.from - b.option.from)
        .map((s) => [s.option]),
    };
  }
  // Raise the lowest module half a band at a time until the target is met.
  const next = { ...bands };
  while (explainOverall(next).overall < target) {
    const lowest = MODULE_ORDER.filter((m) => next[m] < 9).sort((a, b) => next[a] - next[b])[0];
    if (!lowest) break;
    next[lowest] += 0.5;
  }
  const combined = MODULE_ORDER.filter((m) => next[m] !== bands[m]).map((module) => ({
    module,
    from: bands[module],
    to: next[module],
  }));
  return { reached: false, options: combined.length ? [combined] : [] };
}

// ---- Distance to the next band ---------------------------------------------------------------

export interface BandRow {
  band: number;
  min: number;
  max: number;
}

/** The table as ranges: 7.0 ← 30–32. */
export function bandRows(table: BandTable): BandRow[] {
  return table.map(([band, min], i) => ({
    band,
    min,
    max: i === 0 ? 40 : table[i - 1]![1] - 1,
  }));
}

/**
 * How many more correct answers (out of this attempt's questions) would reach the next band,
 * scaling a single part to 40 the same way the band was read. null at 9.0.
 */
export function moreForNextBand(
  raw: number,
  questions: number,
  band: number,
  table: BandTable,
): { more: number; band: number } | null {
  const higher = [...table].reverse().find(([b]) => b > band);
  if (!higher) return null;
  const [nextBand, nextMin] = higher;
  for (let more = 1; raw + more <= questions; more++) {
    const scaled = questions >= 40 ? raw + more : Math.round(((raw + more) * 40) / questions);
    if (scaled >= nextMin) return { more, band: nextBand };
  }
  return null;
}

// ---- Summaries for the dashboard, library and history ----------------------------------------

/** "Passage 1 · 4 answered · 1 flagged", "Task 2 · 154 words", "Part 2 · 2 takes". */
export function progressLine(a: AttemptRecord): string {
  const part = `${partWord(a.module)} ${a.part ?? 1}${a.mode === 'full' && a.module !== 'speaking' ? ' (full mock)' : ''}`;
  switch (a.module) {
    case 'listening':
    case 'reading': {
      const answered = Object.values(a.answers).filter((v) => v.trim()).length;
      const flagged = a.flagged.length;
      return `${part} · ${answered} answered${flagged ? ` · ${flagged} flagged` : ''}`;
    }
    case 'writing': {
      const words = ['task1', 'task2'].map((k) => {
        const text = a.writing?.[k as 'task1' | 'task2'] ?? '';
        return text.trim() ? text.trim().split(/\s+/).length : 0;
      });
      return `${part} · ${words[0]} + ${words[1]} words`;
    }
    case 'speaking': {
      const takes = a.speaking?.recordingKeys.length ?? 0;
      return `${part} · ${takes} ${takes === 1 ? 'take' : 'takes'}`;
    }
  }
}

/** "31 / 40" for scored modules, otherwise how the band was reached. */
export function scoreText(a: AttemptRecord): string {
  if (a.score) return `${a.score.raw} / ${a.score.total}`;
  const band = attemptBand(a);
  if (a.module === 'writing')
    return band ? (band.estimate ? 'Task 2 only' : 'Both tasks') : 'No feedback';
  if (a.module === 'speaking') return band ? 'Self-assessed' : 'Not scored';
  return '—';
}

/** Tests in book order: Book 21 Test 1, Test 2 … */
export function sortTests<T extends { book: string; testNumber: number }>(tests: T[]): T[] {
  return [...tests].sort(
    (a, b) => b.book.localeCompare(a.book, 'en', { numeric: true }) || a.testNumber - b.testNumber,
  );
}

/** Where "Start <module>" goes: the first test this module hasn't been finished on, else the first. */
export function nextTestFor<T extends { testId: string; book: string; testNumber: number }>(
  module: Module,
  tests: T[],
  attempts: AttemptRecord[],
): T | null {
  const sorted = sortTests(tests);
  const done = new Set(
    attempts.filter((a) => a.module === module && a.status === 'submitted').map((a) => a.testId),
  );
  return sorted.find((t) => !done.has(t.testId)) ?? sorted[0] ?? null;
}

/** A test's state for one module in the library: its latest band, in progress, or not started. */
export function moduleState(
  testId: string,
  module: Module,
  attempts: AttemptRecord[],
): { kind: 'band'; band: number; attempt: AttemptRecord } | { kind: 'resume' } | { kind: 'start' } {
  const mine = byNewest(attempts.filter((a) => a.testId === testId && a.module === module));
  if (mine.some((a) => a.status === 'in_progress')) return { kind: 'resume' };
  const scored = mine.find(countsTowardBands);
  return scored
    ? { kind: 'band', band: attemptBand(scored)!.band, attempt: scored }
    : { kind: 'start' };
}

type ByType = Partial<Record<QuestionType, { correct: number; total: number }>>;

/** The question type with the lowest accuracy: the "Focus area". Null with fewer than two types. */
export function focusArea(byType: ByType): QuestionType | null {
  const entries = Object.entries(byType) as [QuestionType, { correct: number; total: number }][];
  if (entries.length < 2) return null;
  return entries.reduce((worst, cur) =>
    cur[1].correct / cur[1].total < worst[1].correct / worst[1].total ? cur : worst,
  )[0];
}
