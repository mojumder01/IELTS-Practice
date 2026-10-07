import { useEffect, useRef } from 'react';
import {
  currentLine,
  currentWord,
  formatAudioTime,
  splitWords,
  spokenChars,
} from '../../engine/audio';
import type { ScriptLine } from '../../schema/test';

interface AudioscriptProps {
  part: number;
  script: ScriptLine[];
  time: number;
  durationSec: number;
  /** Questions whose answers are showing: their words are marked in the script. */
  revealed: Set<number>;
  marks: number[];
  highlighter: boolean;
  interactive: boolean;
  onSeek: (seconds: number) => void;
  onToggleMark: (line: number) => void;
}

/** Follows the audio, seeks on click, and takes the student's highlights (Listening artboards). */
export function Audioscript({
  part,
  script,
  time,
  durationSec,
  revealed,
  marks,
  highlighter,
  interactive,
  onSeek,
  onToggleMark,
}: AudioscriptProps) {
  const now = currentLine(script, time);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [now]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-base font-semibold text-navy">Audioscript · Part {part}</h2>
        <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-navy-3">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-3.5 rounded-[4px] border-[1.5px] border-now-playing-border bg-now-playing"
            />
            Now playing
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3.5 rounded-[4px] bg-user-hl" />
            Your highlight
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="text-[13px] font-semibold text-navy underline decoration-now-playing-border decoration-2 underline-offset-2"
            >
              Ab
            </span>
            Word being said
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-3.5 rounded-[4px] bg-answer-hl ring-[1.5px] ring-answer-hl-outline"
            />
            Answer
          </span>
        </div>
        {interactive && (
          <p className="m-0 text-xs text-muted">
            {highlighter
              ? 'Highlighter on: select a line to mark or unmark it.'
              : 'Select a line to play from there.'}
          </p>
        )}
      </div>
      <ol ref={listRef} className="m-0 flex list-none flex-col gap-0.5 p-0">
        {script.map((line, i) => {
          const isNow = i === now;
          const marked = marks.includes(i);
          const answer = line.answer && revealed.has(line.answer.question) ? line.answer : null;
          const body = (
            <LineText
              text={line.text}
              answer={answer}
              spoken={isNow ? spokenChars(script, i, time, durationSec) : null}
            />
          );
          const style = `grid w-full grid-cols-[44px_1fr] items-start gap-2.5 rounded-control border-[1.5px] px-2.5 py-2 text-left ${
            isNow
              ? 'border-now-playing-border bg-now-playing'
              : marked
                ? 'border-transparent bg-user-hl'
                : 'border-transparent bg-surface'
          }`;
          const content = (
            <>
              <span className="pt-[3px] font-mono text-xs text-muted">
                {formatAudioTime(line.start)}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-xs font-bold tracking-[0.04em] text-navy-3 uppercase">
                  {line.speaker}
                  {isNow && <span className="sr-only"> (now playing)</span>}
                  {marked && <span className="sr-only"> (highlighted)</span>}
                </span>
                <span data-word-root className="text-[15px] leading-[1.55] text-text">
                  {body}
                </span>
              </span>
            </>
          );
          return (
            <li key={i} aria-current={isNow ? 'true' : undefined} data-line={i}>
              {interactive ? (
                <button
                  type="button"
                  aria-pressed={highlighter ? marked : undefined}
                  onClick={() => (highlighter ? onToggleMark(i) : onSeek(line.start))}
                  className={style}
                >
                  {content}
                </button>
              ) : (
                <div className={style}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

interface LineTextProps {
  text: string;
  answer: { question: number; highlight: string } | null;
  /** Characters already said, for the line now playing; null for every other line. */
  spoken: number | null;
}

const markStyle =
  'rounded-[3px] bg-answer-hl px-0.5 text-inherit ring-[1.5px] ring-answer-hl-outline';

/** A word piece: part of one word, split where the answer mark starts or ends. */
interface Piece {
  text: string;
  /** Its character offset in the line. */
  from: number;
  word: number;
  inAnswer: boolean;
}

/**
 * A line's words. On the line now playing, the word being said is underlined and shaded, words
 * already said are in full colour and the rest are muted, so the student can follow along.
 */
function LineText({ text, answer, spoken }: LineTextProps) {
  const at = answer ? text.indexOf(answer.highlight) : -1;
  if (spoken === null && at < 0) return <>{text}</>;
  const badge = answer && (
    <span className="mx-1 inline-flex size-5 items-center justify-center rounded-full bg-navy align-[2px] text-[11px] font-bold text-on-navy">
      <span className="sr-only">answer to question </span>
      {answer.question}
    </span>
  );
  if (spoken === null) {
    return (
      <>
        {text.slice(0, at)}
        <mark className={markStyle}>{answer!.highlight}</mark>
        {badge}
        {text.slice(at + answer!.highlight.length)}
      </>
    );
  }

  const words = splitWords(text);
  const now = currentWord(words, spoken);
  const markStart = at;
  const markEnd = at < 0 ? -1 : at + answer!.highlight.length;
  const pieces: Piece[] = [];
  words.forEach((w, word) => {
    const cuts = [w.start, w.end];
    for (const c of [markStart, markEnd]) if (c > w.start && c < w.end) cuts.push(c);
    cuts.sort((a, b) => a - b);
    for (let k = 0; k < cuts.length - 1; k++) {
      const [from, to] = [cuts[k]!, cuts[k + 1]!];
      pieces.push({
        text: text.slice(from, to),
        from,
        word,
        inAnswer: from >= markStart && to <= markEnd,
      });
    }
  });

  const render = (p: Piece, key: number) => {
    const word = p.text.trimEnd();
    const space = p.text.slice(word.length);
    const style =
      p.word === now
        ? 'rounded-[3px] bg-now-playing font-semibold text-navy underline decoration-now-playing-border decoration-2 underline-offset-[3px]'
        : p.word > now
          ? 'text-muted'
          : '';
    return (
      <span key={key}>
        <span className={style}>{word}</span>
        {space}
      </span>
    );
  };

  if (!answer || at < 0) return <>{pieces.map(render)}</>;
  const before = pieces.filter((p) => p.from < markStart);
  const inside = pieces.filter((p) => p.inAnswer);
  const after = pieces.filter((p) => p.from >= markEnd);
  return (
    <>
      {before.map(render)}
      <mark className={markStyle}>{inside.map((p, k) => render(p, before.length + k))}</mark>
      {badge}
      {after.map((p, k) => render(p, before.length + inside.length + k))}
    </>
  );
}
