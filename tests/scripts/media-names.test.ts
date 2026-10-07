// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { HASHED_MEDIA_NAME, hashedName, inboxName, sourceName } from '../../scripts/media-names';

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

  it('renames Cambridge book audio by book, test and part', () => {
    expect(inboxName('Cambridge IELTS 10.1.1 [@ieltsxpress].mp3')).toBe('b10t1-p1.mp3');
    expect(inboxName('Cambridge IELTS 10.4.3 [@ieltsxpress].MP3')).toBe('b10t4-p3.mp3');
    expect(inboxName('IELTS 18 Test 2 Part 4.m4a')).toBe('b18t2-p4.m4a');
    expect(inboxName('Cambridge_IELTS_9_3_2 (1).wav')).toBe('b9t3-p2.wav');
  });

  it('drops tags but keeps other names', () => {
    expect(inboxName('b22t1-p1.mp3')).toBe('b22t1-p1.mp3');
    expect(inboxName('chart [final].png')).toBe('chart.png');
    expect(inboxName('[x].mp3')).toBe('[x].mp3');
  });
});
