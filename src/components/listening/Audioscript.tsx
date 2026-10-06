import { useEffect, useRef } from 'react';
import { currentLine, formatAudioTime } from '../../engine/audio';
import type { ScriptLine } from '../../schema/test';

interface AudioscriptProps {
  part: number;
  script: ScriptLine[];
  time: number;
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
          const at = answer ? line.text.indexOf(answer.highlight) : -1;
          const body =
            answer && at >= 0 ? (
              <>
                {line.text.slice(0, at)}
                <mark className="rounded-[3px] bg-answer-hl px-0.5 text-inherit ring-[1.5px] ring-answer-hl-outline">
                  {answer.highlight}
                </mark>
                <span className="mx-1 inline-flex size-5 items-center justify-center rounded-full bg-navy align-[2px] text-[11px] font-bold text-on-navy">
                  <span className="sr-only">answer to question </span>
                  {answer.question}
                </span>
                {line.text.slice(at + answer.highlight.length)}
              </>
            ) : (
              line.text
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
                <span className="text-[15px] leading-[1.55] text-text">{body}</span>
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
