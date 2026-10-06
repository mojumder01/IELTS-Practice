import { FileText, Highlighter, Lock, Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { formatAudioTime, SKIP_SEC, SPEEDS, type AudioRules } from '../../engine/audio';
import type { AudioControls } from './useAudio';

interface AudioPlayerProps {
  part: number;
  durationSec: number;
  audio: AudioControls;
  rules: AudioRules;
  /** A full mock part that has already played through. */
  finished: boolean;
  scriptOpen: boolean;
  onToggleScript: () => void;
  highlighter: boolean;
  onToggleHighlighter: () => void;
}

const round =
  'flex size-11 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-navy disabled:text-unanswered';
const toggle =
  'inline-flex min-h-11 items-center gap-2 rounded-control border px-3 text-sm font-semibold';

/** The Listening player bar (Listening artboard). In a locked full mock it only starts the audio. */
export function AudioPlayer(props: AudioPlayerProps) {
  const { audio, rules, durationSec } = props;
  const locked = !rules.controls;
  const playLabel = audio.playing
    ? 'Pause audio'
    : props.finished
      ? 'Audio finished'
      : audio.time > 0
        ? 'Continue audio'
        : 'Play audio';

  return (
    <section
      aria-label="Audio player"
      className="flex shrink-0 flex-col gap-2 border-b border-border bg-surface px-4 py-3 sm:px-5"
    >
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
        <span className="min-w-14 text-sm font-bold tracking-[0.04em] text-navy">
          PART {props.part}
        </span>
        <button
          type="button"
          aria-label="Back 5 seconds"
          disabled={locked}
          onClick={() => audio.seek(audio.time - SKIP_SEC)}
          className={round}
        >
          <RotateCcw aria-hidden="true" className="size-[17px]" />
        </button>
        <button
          type="button"
          aria-label={playLabel}
          // A locked full mock plays straight through: once started it can't be paused.
          disabled={props.finished || (locked && audio.playing)}
          onClick={audio.playing ? audio.pause : audio.play}
          className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-navy text-on-navy disabled:bg-navy-3"
        >
          {audio.playing ? (
            <Pause aria-hidden="true" className="size-[18px] fill-current" />
          ) : (
            <Play aria-hidden="true" className="size-[18px] fill-current" />
          )}
        </button>
        <button
          type="button"
          aria-label="Forward 5 seconds"
          disabled={locked}
          onClick={() => audio.seek(audio.time + SKIP_SEC)}
          className={round}
        >
          <RotateCw aria-hidden="true" className="size-[17px]" />
        </button>
        <label htmlFor="audio-seek" className="sr-only">
          Audio position
        </label>
        <input
          id="audio-seek"
          type="range"
          min={0}
          max={durationSec}
          step={1}
          value={Math.round(audio.time)}
          disabled={locked}
          onChange={(e) => audio.seek(Number(e.target.value))}
          className="h-11 min-w-40 flex-[1_1_260px] accent-navy"
        />
        <span className="font-mono text-sm whitespace-nowrap text-navy-3">
          {formatAudioTime(audio.time)} / {formatAudioTime(durationSec)}
        </span>
        <label htmlFor="audio-speed" className="sr-only">
          Playback speed
        </label>
        <select
          id="audio-speed"
          value={String(audio.speed)}
          disabled={locked}
          onChange={(e) => audio.setSpeed(Number(e.target.value))}
          className="h-11 rounded-control border border-border-strong bg-surface px-2.5 font-mono text-sm text-navy"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={String(s)}>
              {s}x
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {rules.script === 'on-demand' && (
          <>
            <button
              type="button"
              aria-expanded={props.scriptOpen}
              onClick={props.onToggleScript}
              className={`${toggle} ${props.scriptOpen ? 'border-now-playing-border bg-now-playing text-navy' : 'border-border-strong bg-surface text-navy'}`}
            >
              <FileText aria-hidden="true" className="size-4" />
              {props.scriptOpen ? 'Hide audioscript' : 'Show audioscript'}
            </button>
            {props.scriptOpen && (
              <button
                type="button"
                aria-pressed={props.highlighter}
                onClick={props.onToggleHighlighter}
                className={`${toggle} ${props.highlighter ? 'border-flag bg-user-hl text-flag-stroke' : 'border-border-strong bg-surface text-navy'}`}
              >
                <Highlighter aria-hidden="true" className="size-4" />
                Highlighter
              </button>
            )}
          </>
        )}
        {locked && (
          <span className="inline-flex min-h-10 items-center gap-2 rounded-control bg-surface-muted px-3 text-[13px] text-navy-3">
            <Lock aria-hidden="true" className="size-[15px]" />
            Full mock: audio plays once, no seeking. Audioscript unlocks after you submit.
          </span>
        )}
      </div>
    </section>
  );
}
