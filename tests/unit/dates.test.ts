import { describe, expect, it } from 'vitest';
import { formatToday } from '../../src/lib/dates';

describe('formatToday', () => {
  it('matches the Dashboard date line', () => {
    expect(formatToday(new Date(2026, 9, 6))).toBe('Tuesday, 6 October');
  });
});
