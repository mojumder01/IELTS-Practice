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
