import { recorderClock, type RecorderPhase } from '../engine/speaking';
import { MicrophoneError, type Capture, type CaptureResult, type Microphone } from './microphone';

export interface RecorderSnapshot {
  phase: RecorderPhase['kind'];
  prepLeftSec: number | null;
  elapsedSec: number | null;
  /** Recent input levels (0–1), newest last, for the meter. */
  levels: number[];
  liveTranscript: string;
  error: string | null;
  /** How many takes this recorder has saved; the takes list reloads when it changes. */
  saved: number;
}

export interface RecorderDeps {
  microphone: Microphone;
  now: () => number;
  limits: { prepSec: number; maxSec: number };
  /** Stores a finished take (IndexedDB and the attempt). */
  save: (result: CaptureResult & { durationSec: number }) => Promise<void>;
  setInterval?: (fn: () => void, ms: number) => number;
  clearInterval?: (id: number) => void;
}

const METER_BARS = 32;
const TICK_MS = 200;

/**
 * Prepare → Speak → Review for one part, outside React: it keeps its own clock, starts speaking
 * when preparation runs out and stops at the maximum, as the examiner would.
 */
export class SpeakingRecorder {
  private phaseState: RecorderPhase = { kind: 'idle' };
  private capture: Capture | null = null;
  private interval: number | null = null;
  private listeners = new Set<() => void>();
  private snapshot: RecorderSnapshot = {
    phase: 'idle',
    prepLeftSec: null,
    elapsedSec: null,
    levels: [],
    liveTranscript: '',
    error: null,
    saved: 0,
  };
  private readonly deps: RecorderDeps;

  constructor(deps: RecorderDeps) {
    this.deps = deps;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): RecorderSnapshot => this.snapshot;

  private publish(patch: Partial<RecorderSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  private setPhase(phase: RecorderPhase, patch: Partial<RecorderSnapshot> = {}) {
    this.phaseState = phase;
    const clock = recorderClock(phase, this.deps.now(), this.deps.limits);
    this.publish({
      phase: phase.kind,
      prepLeftSec: clock.prepLeftSec,
      elapsedSec: clock.elapsedSec,
      ...patch,
    });
    const ticking = phase.kind === 'prepare' || phase.kind === 'record';
    if (ticking && this.interval === null) {
      this.interval = (this.deps.setInterval ?? window.setInterval)(this.tick, TICK_MS);
    } else if (!ticking) {
      this.stopTicking();
    }
  }

  private stopTicking() {
    if (this.interval !== null) (this.deps.clearInterval ?? window.clearInterval)(this.interval);
    this.interval = null;
  }

  private tick = () => {
    const clock = recorderClock(this.phaseState, this.deps.now(), this.deps.limits);
    const levels =
      this.capture && this.phaseState.kind === 'record'
        ? [...this.snapshot.levels, this.capture.level()].slice(-METER_BARS)
        : this.snapshot.levels;
    this.publish({ prepLeftSec: clock.prepLeftSec, elapsedSec: clock.elapsedSec, levels });
    if (clock.due === 'start') void this.startSpeaking();
    if (clock.due === 'stop') void this.stop();
  };

  /** Part 2: the minute to prepare. Parts 1 and 3 start speaking straight away. */
  begin = () => {
    if (this.phaseState.kind !== 'idle' && this.phaseState.kind !== 'review') return;
    if (this.deps.limits.prepSec > 0) {
      this.setPhase({ kind: 'prepare', since: this.deps.now() }, { error: null });
    } else {
      void this.startSpeaking();
    }
  };

  startSpeaking = async () => {
    const from = this.phaseState.kind;
    if (from !== 'idle' && from !== 'prepare' && from !== 'review') return;
    this.setPhase({ kind: 'starting' }, { error: null, levels: [], liveTranscript: '' });
    try {
      this.capture = await this.deps.microphone.start((text) =>
        this.publish({ liveTranscript: text }),
      );
      this.setPhase({ kind: 'record', since: this.deps.now() });
    } catch (error) {
      const message =
        error instanceof MicrophoneError ? error.message : 'Recording couldn’t start. Try again.';
      this.setPhase({ kind: from === 'prepare' ? 'idle' : from }, { error: message });
    }
  };

  stop = async () => {
    if (this.phaseState.kind !== 'record' || !this.capture) return;
    const clock = recorderClock(this.phaseState, this.deps.now(), this.deps.limits);
    const capture = this.capture;
    this.capture = null;
    this.setPhase({ kind: 'saving' });
    try {
      const result = await capture.stop();
      await this.deps.save({ ...result, durationSec: Math.round(clock.elapsedSec ?? 0) });
      this.setPhase({ kind: 'review' }, { saved: this.snapshot.saved + 1 });
    } catch (error) {
      console.error(error);
      this.setPhase(
        { kind: 'review' },
        {
          error: 'The take couldn’t be saved on this device. Check the browser has storage space.',
        },
      );
    }
  };

  /** Leaving the part or the page: a take still recording is dropped. */
  dispose = () => {
    this.stopTicking();
    this.capture?.cancel();
    this.capture = null;
    if (this.phaseState.kind !== 'idle') this.setPhase({ kind: 'idle' });
  };
}
