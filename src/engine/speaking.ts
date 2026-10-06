import type { SpeakingSection } from '../schema/test';
import { speakingBand } from './bands';

export const SPEAKING_CRITERIA = [
  { id: 'fluency', label: 'Fluency and coherence' },
  { id: 'lexical', label: 'Lexical resource' },
  { id: 'grammar', label: 'Grammatical range and accuracy' },
  { id: 'pronunciation', label: 'Pronunciation' },
] as const;

export type SpeakingCriterion = (typeof SPEAKING_CRITERIA)[number]['id'];
export type SelfScores = Partial<Record<SpeakingCriterion, number>>;

/** The band once all four criteria are scored; null until then. */
export function selfScoreBand(scores: SelfScores): number | null {
  const values = SPEAKING_CRITERIA.map((c) => scores[c.id]);
  return values.every((v) => v !== undefined) ? speakingBand(values) : null;
}

/** The part tabs: what each part is and how long it lasts in the test (Speaking artboard). */
export const SPEAKING_PARTS = [
  { part: 1, label: 'Part 1', sub: 'Interview · 4–5 min', heading: 'Part 1 · Interview' },
  { part: 2, label: 'Part 2', sub: 'Long turn · 3–4 min', heading: 'Part 2 · Cue card' },
  { part: 3, label: 'Part 3', sub: 'Discussion · 4–5 min', heading: 'Part 3 · Discussion' },
] as const;

/** Part 2 prepares and speaks to the cue card's limits; Parts 1 and 3 record up to 5 minutes. */
export function recordingLimits(
  part: number,
  section: SpeakingSection,
): { prepSec: number; maxSec: number } {
  return part === 2
    ? { prepSec: section.part2.prepSec, maxSec: section.part2.speakSec }
    : { prepSec: 0, maxSec: 5 * 60 };
}

// ---- Transcript ------------------------------------------------------------------------------

/** Filler words and phrases (SPEC section 7). Longer phrases first, so "you know" wins over "you". */
export const FILLERS = ['you know', 'i mean', 'um', 'uh', 'like'] as const;

const fillerPattern = new RegExp(
  `\\b(${FILLERS.map((f) => f.replace(' ', '\\s+')).join('|')})\\b`,
  'gi',
);

export interface TranscriptPiece {
  text: string;
  filler: boolean;
}

/** The transcript cut into plain text and filler words, for highlighting. */
export function transcriptPieces(text: string): TranscriptPiece[] {
  const pieces: TranscriptPiece[] = [];
  let last = 0;
  for (const m of text.matchAll(fillerPattern)) {
    if (m.index > last) pieces.push({ text: text.slice(last, m.index), filler: false });
    pieces.push({ text: m[0], filler: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last), filler: false });
  return pieces;
}

export function fillerCount(text: string): number {
  return transcriptPieces(text).filter((p) => p.filler).length;
}

export function spokenWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Words per minute; null for a take too short to judge. */
export function paceWpm(words: number, seconds: number): number | null {
  return seconds >= 5 ? Math.round(words / (seconds / 60)) : null;
}

// ---- Part 2 checklist ------------------------------------------------------------------------

export interface CoveragePoint {
  id: string;
  label: string;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The cue card's points plus its closing line, as a checklist: "and explain why…" → "Why…". */
export function coveragePoints(part2: SpeakingSection['part2']): CoveragePoint[] {
  const closing = part2.closing
    .replace(/^and\s+(explain|say|describe)\s+/i, '')
    .replace(/[.?!]\s*$/, '');
  return [...part2.points, closing].map((label, i) => ({
    id: `point-${i + 1}`,
    label: capitalise(label.trim()),
  }));
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "a", "a and b", "a, b and c". */
function listWords(items: string[]): string {
  return items.length < 2
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Part 2's coaching line under the checklist, from the take's length and the unticked points. */
export function reviewNote(
  take: { number: number; durationSec: number },
  maxSec: number,
  missed: CoveragePoint[],
): string {
  const short = take.durationSec < maxSec - 10;
  const what = [
    short ? `stopped at ${formatSpeakingTime(take.durationSec)}` : '',
    missed.length ? `skipped ${listWords(missed.map((p) => lowerFirst(p.label)))}` : '',
  ].filter(Boolean);
  if (what.length === 0) return `Take ${take.number} used the time and covered every point.`;
  return `Take ${take.number} ${what.join(' and ')}.${short ? ' Use the full two minutes.' : ''}`;
}

/** m:ss for the recorder and takes ("1:31"). */
export function formatSpeakingTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---- Recorder phases -------------------------------------------------------------------------

export type RecorderPhase =
  | { kind: 'idle' }
  | { kind: 'prepare'; since: number }
  | { kind: 'starting' }
  | { kind: 'record'; since: number }
  | { kind: 'saving' }
  | { kind: 'review' };

export interface RecorderClock {
  /** Seconds of preparation left, or of recording done. */
  prepLeftSec: number | null;
  elapsedSec: number | null;
  /** What the recorder should do next on its own. */
  due: 'start' | 'stop' | null;
}

/** Where a phase is at `now` (ms): Prepare runs out into Speak, Speak stops at the maximum. */
export function recorderClock(
  phase: RecorderPhase,
  now: number,
  limits: { prepSec: number; maxSec: number },
): RecorderClock {
  if (phase.kind === 'prepare') {
    const left = Math.max(0, limits.prepSec - (now - phase.since) / 1000);
    return { prepLeftSec: left, elapsedSec: null, due: left <= 0 ? 'start' : null };
  }
  if (phase.kind === 'record') {
    const elapsed = Math.min(limits.maxSec, Math.max(0, (now - phase.since) / 1000));
    return {
      prepLeftSec: null,
      elapsedSec: elapsed,
      due: elapsed >= limits.maxSec ? 'stop' : null,
    };
  }
  return { prepLeftSec: null, elapsedSec: null, due: null };
}

/** IndexedDB key for one take: attempt, part and take number. */
export function recordingKey(attemptId: string, part: number, take: number): string {
  return `${attemptId}:p${part}:t${take}`;
}
