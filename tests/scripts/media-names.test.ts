// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { HASHED_MEDIA_NAME, hashedName, sourceName } from '../../scripts/media-names';

describe('media names', () => {
  it('normalises source names', () => {
    expect(sourceName('B21T1 P1.WAV')).toEqual({ stem: 'b21t1-p1', ext: 'wav' });
    expect(sourceName('.mp3')).toBeNull();
  });

  it('adds an 8-character content hash', () => {
    const name = hashedName('b21t1-p1', '28d1e3ca9f00aa', 'mp3');
    expect(name).toBe('b21t1-p1.28d1e3ca.mp3');
    expect(HASHED_MEDIA_NAME.test(name)).toBe(true);
    expect(HASHED_MEDIA_NAME.test('b21t1-p1.mp3')).toBe(false);
  });
});
