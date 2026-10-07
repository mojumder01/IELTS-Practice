import { describe, expect, it } from 'vitest';
import {
  audioFinished,
  audioRules,
  clampTime,
  currentLine,
  currentWord,
  formatAudioTime,
  splitWords,
  spokenChars,
} from '../../../src/engine/audio';
import { sample } from '../examHarness';

const listening = sample.sections['listening-1'];
const script = listening?.kind === 'listening' ? listening.script : [];
const help = sample.meta.studentHelp;

describe('audio engine', () => {
  it('follows the last line whose start is at or before the time', () => {
    expect(currentLine(script, 0)).toBe(0);
    expect(currentLine(script, 13.9)).toBe(2);
    expect(currentLine(script, 14)).toBe(3);
    expect(currentLine(script, 109)).toBe(16);
    expect(currentLine([{ start: 2, speaker: 'A', text: 'x' }], 1)).toBe(-1);
  });

  it('splits a line into words that join back into it', () => {
    const words = splitWords('My surname is Morgan.');
    expect(words.map((w) => w.text)).toEqual(['My ', 'surname ', 'is ', 'Morgan.']);
    expect(words[1]).toEqual({ text: 'surname ', start: 3, end: 11 });
    expect(
      splitWords('  Hi there')
        .map((w) => w.text)
        .join(''),
    ).toBe('  Hi there');
  });

  it('shares a line’s time out by characters', () => {
    const lines = [
      { start: 10, speaker: 'A', text: 'abcdefghij' },
      { start: 20, speaker: 'B', text: 'xyz' },
    ];
    expect(spokenChars(lines, 0, 10, 60)).toBe(0);
    expect(spokenChars(lines, 0, 15, 60)).toBe(5);
    expect(spokenChars(lines, 0, 25, 60)).toBe(10);
    expect(spokenChars(lines, 0, 5, 60)).toBe(0);
    // The last line runs to the end of the audio.
    expect(spokenChars(lines, 1, 40, 60)).toBe(2);
    expect(spokenChars(lines, 5, 40, 60)).toBe(0);
  });

  it('finds the word being said', () => {
    const words = splitWords('My surname is Morgan.');
    expect(currentWord(words, 0)).toBe(0);
    expect(currentWord(words, 3)).toBe(1);
    expect(currentWord(words, 10)).toBe(1);
    expect(currentWord(words, 11)).toBe(2);
    expect(currentWord(words, 99)).toBe(3);
    expect(currentWord(splitWords('  Hi'), 0)).toBe(1);
  });

  it('clamps seeking to the audio', () => {
    expect(clampTime(-3, 110)).toBe(0);
    expect(clampTime(200, 110)).toBe(110);
  });

  it('formats m:ss', () => {
    expect(formatAudioTime(82.7)).toBe('1:22');
    expect(formatAudioTime(5)).toBe('0:05');
  });

  it('locks a full mock: no controls, script hidden until submit', () => {
    expect(audioRules('full', help, false)).toEqual({
      controls: false,
      script: 'hidden',
      interactiveScript: false,
    });
    expect(audioRules('full', help, true).script).toBe('shown');
  });

  it('gives single-part practice every control and the script on demand', () => {
    expect(audioRules('single', help, false)).toEqual({
      controls: true,
      script: 'on-demand',
      interactiveScript: true,
    });
    expect(audioRules('single', { ...help, showScriptInSinglePart: false }, false).script).toBe(
      'hidden',
    );
  });

  it('only locks a full mock when the test says so', () => {
    expect(audioRules('full', { ...help, lockAudioInFullMock: false }, false).controls).toBe(true);
  });

  it('knows when a part has played to the end', () => {
    expect(audioFinished(109.9, 110)).toBe(true);
    expect(audioFinished(100, 110)).toBe(false);
  });
});
