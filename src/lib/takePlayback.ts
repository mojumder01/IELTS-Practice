import type { Take } from './recordings';

/** Plays one take at a time from its stored audio; publishes which take is playing. */
export class TakePlayback {
  private audio: HTMLAudioElement | null = null;
  private url: string | null = null;
  private playing: string | null = null;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** The key of the take playing now, or null. */
  getSnapshot = (): string | null => this.playing;

  private set(key: string | null) {
    if (key === this.playing) return;
    this.playing = key;
    this.listeners.forEach((l) => l());
  }

  toggle = (take: Take) => {
    if (this.playing === take.key) {
      this.audio?.pause();
      return;
    }
    this.stop();
    const audio = new Audio();
    this.audio = audio;
    this.url = URL.createObjectURL(take.blob);
    audio.src = this.url;
    audio.onplay = () => this.set(take.key);
    audio.onpause = () => this.set(null);
    audio.onended = () => this.set(null);
    void audio.play().catch((error: unknown) => {
      console.warn('The take could not play', error);
      this.set(null);
    });
  };

  stop = () => {
    this.audio?.pause();
    if (this.audio) this.audio.onpause = null;
    this.audio = null;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.set(null);
  };
}
