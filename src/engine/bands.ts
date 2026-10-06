import type { Track } from '../schema/test';

// The commonly published raw-score tables (SPEC section 7). They are approximate: edit them here.
// Each row is [band, lowest raw score for that band].
export type BandTable = readonly (readonly [band: number, minRaw: number])[];

export const LISTENING: BandTable = [
  [9, 39],
  [8.5, 37],
  [8, 35],
  [7.5, 32],
  [7, 30],
  [6.5, 26],
  [6, 23],
  [5.5, 18],
  [5, 16],
  [4.5, 13],
  [4, 10],
  [3.5, 8],
  [3, 6],
  [2.5, 4],
];
export const ACADEMIC_READING: BandTable = [
  [9, 39],
  [8.5, 37],
  [8, 35],
  [7.5, 33],
  [7, 30],
  [6.5, 27],
  [6, 23],
  [5.5, 19],
  [5, 15],
  [4.5, 13],
  [4, 10],
  [3.5, 8],
  [3, 6],
  [2.5, 4],
];
export const GENERAL_READING: BandTable = [
  [9, 40],
  [8.5, 39],
  [8, 37],
  [7.5, 36],
  [7, 34],
  [6.5, 32],
  [6, 30],
  [5.5, 27],
  [5, 23],
  [4.5, 19],
  [4, 15],
  [3.5, 12],
  [3, 9],
  [2.5, 6],
];

/** Below the table's lowest row: 2.0 for any correct answer, 0 for none (not in the tables). */
const BELOW_TABLE_BAND = 2;

export function tableFor(module: 'listening' | 'reading', track: Track): BandTable {
  if (module === 'listening') return LISTENING;
  return track === 'general' ? GENERAL_READING : ACADEMIC_READING;
}

/** Raw score out of 40 to band. */
export function bandFor(raw: number, table: BandTable): number {
  for (const [band, min] of table) if (raw >= min) return band;
  return raw > 0 ? BELOW_TABLE_BAND : 0;
}

export interface BandResult {
  band: number;
  /** True when scaled from fewer than 40 questions (a single part): label it "estimate". */
  estimate: boolean;
  /** The raw score out of 40 the band was read from. */
  scaledRaw: number;
}

/** Single part estimate: scale to 40 (round(raw × 40 / questions)), then look up the band. */
export function listeningReadingBand(raw: number, questions: number, table: BandTable): BandResult {
  if (questions >= 40) return { band: bandFor(raw, table), estimate: false, scaledRaw: raw };
  const scaledRaw = questions > 0 ? Math.round((raw * 40) / questions) : 0;
  return { band: bandFor(scaledRaw, table), estimate: true, scaledRaw };
}

const EPSILON = 1e-9;

/** Below .25 rounds down, .25 to below .75 becomes .5, .75 or more rounds up: 6.625 → 6.5, 6.75 → 7. */
export function roundToHalf(value: number): number {
  return Math.round(value * 2 + EPSILON) / 2;
}

/** Rounded down to the nearest half: the Writing task and Speaking rule. */
export function roundDownToHalf(value: number): number {
  return Math.floor(value * 2 + EPSILON) / 2;
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/** A Writing task: the mean of its four criterion bands, rounded down to the nearest half. */
export function writingTaskBand(criteria: number[]): number {
  return roundDownToHalf(mean(criteria));
}

/** Writing module: (Task 1 + 2 × Task 2) ÷ 3, to the nearest half. Task 2 alone is an estimate. */
export function writingBand(task1: number | null, task2: number): BandResult {
  if (task1 === null) return { band: task2, estimate: true, scaledRaw: task2 };
  return { band: roundToHalf((task1 + 2 * task2) / 3), estimate: false, scaledRaw: task2 };
}

/** Speaking: the mean of the four self-assessed criteria, rounded down to the nearest half. */
export function speakingBand(criteria: number[]): number {
  return roundDownToHalf(mean(criteria));
}

/** Overall: the mean of the four module bands, rounded as above. Bands and the what-if calculator share it. */
export function overallBand(modules: [number, number, number, number]): number {
  return roundToHalf(mean(modules));
}
