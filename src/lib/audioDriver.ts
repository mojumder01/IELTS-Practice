import { clampTime } from '../engine/audio';

export interface AudioSnapshot {
  time: number;
  playing: boolean;
  speed: number;
}

/**
 * Owns one <audio> element outside React and publishes its state. While playing, time is read
 * every animation frame, so the audioscript's current line follows the audio closely.
 */
export class AudioDriver {
  private element: HTMLAudioElement | null = null;
  private snapshot: AudioSnapshot;
  private listeners = new Set<() => void>();
  private frame = 0;
  private detach: (() => void) | null = null;

  private readonly durationSec: number;
  private readonly startAt: number;

  constructor(durationSec: number, startAt: number) {
    this.durationSec = durationSec;
    this.startAt = startAt;
    this.snapshot = { time: startAt, playing: false, speed: 1 };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): AudioSnapshot => this.snapshot;

  private publish(patch: Partial<AudioSnapshot>) {
    const next = { ...this.snapshot, ...patch };
    if (
      next.time === this.snapshot.time &&
      next.playing === this.snapshot.playing &&
      next.speed === this.snapshot.speed
    )
      return;
    this.snapshot = next;
    this.listeners.forEach((l) => l());
  }

  private follow = () => {
    const t = this.element?.currentTime ?? 0;
    if (Math.abs(t - this.snapshot.time) >= 0.05) this.publish({ time: t });
    this.frame = requestAnimationFrame(this.follow);
  };

  /** The <audio> element's ref callback. */
  attach = (element: HTMLAudioElement | null) => {
    this.detach?.();
    this.detach = null;
    this.element = element;
    if (!element) return;
    const restore = () => {
      if (this.startAt > 0) element.currentTime = this.startAt;
    };
    const onPlay = () => {
      this.publish({ playing: true });
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(this.follow);
    };
    const onStop = () => {
      cancelAnimationFrame(this.frame);
      this.publish({ playing: false, time: element.currentTime });
    };
    const onTime = () => this.publish({ time: element.currentTime });
    element.addEventListener('loadedmetadata', restore);
    element.addEventListener('play', onPlay);
    element.addEventListener('pause', onStop);
    element.addEventListener('ended', onStop);
    element.addEventListener('timeupdate', onTime);
    if (element.readyState >= 1) restore();
    this.detach = () => {
      cancelAnimationFrame(this.frame);
      element.removeEventListener('loadedmetadata', restore);
      element.removeEventListener('play', onPlay);
      element.removeEventListener('pause', onStop);
      element.removeEventListener('ended', onStop);
      element.removeEventListener('timeupdate', onTime);
    };
  };

  play = () => {
    void this.element
      ?.play()
      .catch((error: unknown) => console.warn('Audio could not play', error));
  };

  pause = () => this.element?.pause();

  seek = (seconds: number) => {
    const t = clampTime(seconds, this.durationSec);
    if (this.element) this.element.currentTime = t;
    this.publish({ time: t });
  };

  setSpeed = (speed: number) => {
    if (this.element) this.element.playbackRate = speed;
    this.publish({ speed });
  };
}
