import { describe, expect, it } from 'vitest';
import { coverTitle } from '../../src/lib/links';

describe('book cover titles', () => {
  it('splits a book name into its series and number', () => {
    expect(coverTitle('Cambridge 19')).toEqual({ series: 'CAMBRIDGE IELTS', number: '19' });
    expect(coverTitle('Book 21')).toEqual({ series: 'IELTS', number: '21' });
    expect(coverTitle('21')).toEqual({ series: 'IELTS', number: '21' });
  });

  it('uses initials when the name has no number', () => {
    expect(coverTitle('Mock Tests')).toEqual({ series: 'MOCK TESTS IELTS', number: 'MT' });
  });
});
