import type { ScriptLine, TestMeta } from '../schema/test';
import type { ExamMode } from './timer';

export const SPEEDS = [0.75, 1, 1.25, 1.5] as const;
export const SKIP_SEC = 5;

/** The current line is the last one whose start is at or before the audio time; -1 before the first. */
export function currentLine(script: ScriptLine[], seconds: number): number {
  let current = -1;
  for (let i = 0; i < script.length; i++) {
    if (script[i]!.start <= seconds) current = i;
    else break;
  }
  return current;
}

/** A word of a script line with the space after it; `start` and `end` are character offsets. */
export interface WordSpan {
  text: string;
  start: number;
  end: number;
}

/** A line's text as words, each keeping its following space, so joining them gives the text back. */
export function splitWords(text: string): WordSpan[] {
  const out: WordSpan[] = [];
  const re = /\S+\s*/g;
  const lead = /^\s*/.exec(text)![0].length;
  if (lead) out.push({ text: text.slice(0, lead), start: 0, end: lead });
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/**
 * How far into line `index` the speaker is, as a character offset. Scripts only time lines, so
 * the line's time (its start to the next line's start, or the audio's end) is shared out by
 * characters: long words take longer to say than short ones.
 */
export function spokenChars(
  script: ScriptLine[],
  index: number,
  seconds: number,
  durationSec: number,
): number {
  const line = script[index];
  if (!line) return 0;
  const end = Math.min(script[index + 1]?.start ?? durationSec, durationSec);
  const length = line.text.length;
  if (end <= line.start) return length;
  const share = (seconds - line.start) / (end - line.start);
  return Math.round(Math.min(Math.max(share, 0), 1) * length);
}

/** The word being said: the one holding the spoken position, or the last word once it's past. */
export function currentWord(words: WordSpan[], chars: number): number {
  for (let i = words.length - 1; i >= 0; i--) {
    if (words[i]!.start <= chars && words[i]!.text.trim()) return i;
  }
  return words.findIndex((w) => w.text.trim());
}

export function clampTime(seconds: number, durationSec: number): number {
  return Math.min(Math.max(0, seconds), durationSec);
}

/** "1:05" for script times and the player clock. */
export function formatAudioTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface AudioRules {
  /** Pause, ±5 s, the seek bar and speed. */
  controls: boolean;
  /** The audioscript: on demand in single-part mode (if the test allows it), hidden until submit in a full mock. */
  script: 'on-demand' | 'hidden' | 'shown';
  /** Highlighter and click-to-seek in the script. */
  interactiveScript: boolean;
}

/** SPEC section 7, Modes: a full mock plays once from the start with no pause, seek or speed. */
export function audioRules(
  mode: ExamMode,
  help: TestMeta['studentHelp'],
  submitted: boolean,
): AudioRules {
  if (submitted) return { controls: true, script: 'shown', interactiveScript: true };
  if (mode === 'full') {
    return { controls: !help.lockAudioInFullMock, script: 'hidden', interactiveScript: false };
  }
  return {
    controls: true,
    script: help.showScriptInSinglePart ? 'on-demand' : 'hidden',
    interactiveScript: true,
  };
}

/** Whether a part's audio has played to the end (a full mock can't play it again). */
export function audioFinished(position: number, durationSec: number): boolean {
  return position >= durationSec - 0.25;
}
