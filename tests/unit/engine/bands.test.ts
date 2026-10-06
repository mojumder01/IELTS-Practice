import { describe, expect, it } from 'vitest';
import {
  ACADEMIC_READING,
  bandFor,
  GENERAL_READING,
  LISTENING,
  listeningReadingBand,
  overallBand,
  roundToHalf,
  speakingBand,
  writingBand,
  writingTaskBand,
} from '../../../src/engine/bands';

describe('band tables', () => {
  it('reads each table at its boundaries', () => {
    expect(bandFor(40, LISTENING)).toBe(9);
    expect(bandFor(30, LISTENING)).toBe(7);
    expect(bandFor(29, LISTENING)).toBe(6.5);
    expect(bandFor(4, LISTENING)).toBe(2.5);
    expect(bandFor(32, ACADEMIC_READING)).toBe(7);
    expect(bandFor(33, ACADEMIC_READING)).toBe(7.5);
    expect(bandFor(39, GENERAL_READING)).toBe(8.5);
    expect(bandFor(34, GENERAL_READING)).toBe(7);
  });

  it('covers every raw score from 4 to 40 with no gaps', () => {
    for (const table of [LISTENING, ACADEMIC_READING, GENERAL_READING]) {
      const lowest = table[table.length - 1]![1];
      for (let raw = lowest; raw <= 40; raw++) expect(bandFor(raw, table)).toBeGreaterThan(0);
    }
  });

  it('gives 0 for nothing right and 2.0 below the table', () => {
    expect(bandFor(0, LISTENING)).toBe(0);
    expect(bandFor(3, LISTENING)).toBe(2);
  });
});

describe('single part estimate', () => {
  it('scales to 40 and labels it an estimate', () => {
    expect(listeningReadingBand(7, 9, ACADEMIC_READING)).toEqual({
      band: 7,
      estimate: true,
      scaledRaw: 31,
    });
    expect(listeningReadingBand(13, 13, ACADEMIC_READING)).toEqual({
      band: 9,
      estimate: true,
      scaledRaw: 40,
    });
  });

  it('is exact for a full 40 questions', () => {
    expect(listeningReadingBand(30, 40, LISTENING)).toEqual({
      band: 7,
      estimate: false,
      scaledRaw: 30,
    });
  });
});

describe('rounding', () => {
  it('rounds the overall band: 6.625 → 6.5, 6.75 → 7.0', () => {
    expect(roundToHalf(6.625)).toBe(6.5);
    expect(roundToHalf(6.75)).toBe(7);
    expect(roundToHalf(6.24)).toBe(6);
    expect(roundToHalf(6.25)).toBe(6.5);
    expect(overallBand([6.5, 6.5, 7, 6.5])).toBe(6.5); // 6.625
    expect(overallBand([7, 6.5, 7, 6.5])).toBe(7); // 6.75
  });

  it('rounds a Writing task down to the nearest half', () => {
    expect(writingTaskBand([6, 7, 6, 6])).toBe(6); // 6.25
    expect(writingTaskBand([7, 7, 6, 7])).toBe(6.5); // 6.75
  });

  it('weights Writing Task 2 double, or estimates from Task 2 alone', () => {
    expect(writingBand(6, 7)).toEqual({ band: 6.5, estimate: false, scaledRaw: 7 }); // 6.67
    expect(writingBand(null, 6.5).estimate).toBe(true);
  });

  it('rounds Speaking down to the nearest half', () => {
    expect(speakingBand([6, 6.5, 7, 6.5])).toBe(6.5);
    expect(speakingBand([6, 6, 6, 6.5])).toBe(6);
  });
});
