/** What one finished take gives back. */
export interface CaptureResult {
  blob: Blob;
  mimeType: string;
  /** null when the browser can't transcribe (only Chrome-family browsers can). */
  transcript: string | null;
}

/** A take being recorded. */
export interface Capture {
  /** The input level now, 0–1, for the meter. */
  level: () => number;
  stop: () => Promise<CaptureResult>;
  /** Drops the take: used when the page closes mid-recording. */
  cancel: () => void;
}

export interface Microphone {
  /** Whether this browser has speech recognition for a transcript. */
  canTranscribe: () => boolean;
  /** Asks for the microphone (the first time) and starts recording. */
  start: (onTranscript: (text: string) => void) => Promise<Capture>;
}

/** A message to show when recording can't start. */
export class MicrophoneError extends Error {}

// The Web Speech API isn't in TypeScript's DOM types: just the parts used here.
interface RecognitionResultList {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: RecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionClass = new () => Recognition;

function recognitionClass(): RecognitionClass | undefined {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionClass;
    webkitSpeechRecognition?: RecognitionClass;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Errors after which recognition won't work for this take (no permission, no network). */
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'network', 'audio-capture']);

/** Keeps a transcript while recording; Chrome ends recognition after a pause, so it restarts. */
function startTranscript(onText: (text: string) => void) {
  const Recognition = recognitionClass();
  if (!Recognition) return null;
  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-GB';
  // Each recognition session reports all its results so far; earlier sessions' text is kept here.
  let earlier = '';
  let session = '';
  let text = '';
  let running = true;
  let failed = false;
  let ended: () => void = () => {};

  recognition.onresult = (event) => {
    let interim = '';
    let sessionFinals = '';
    for (let i = 0; i < event.results.length; i++) {
      const r = event.results[i]!;
      if (r.isFinal) sessionFinals += `${r[0].transcript.trim()} `;
      else interim += `${r[0].transcript.trim()} `;
    }
    session = sessionFinals;
    text = `${earlier}${sessionFinals}${interim}`.replace(/\s+/g, ' ').trim();
    onText(text);
  };
  recognition.onerror = (event) => {
    if (FATAL.has(event.error)) {
      failed = true;
      running = false;
    }
  };
  recognition.onend = () => {
    earlier += session;
    session = '';
    if (running) {
      try {
        recognition.start();
        return;
      } catch {
        running = false;
      }
    }
    ended();
  };
  try {
    recognition.start();
  } catch {
    return null;
  }

  return {
    /** Stops listening and waits (up to 1.5 s) for the last words. */
    finish: () =>
      new Promise<string | null>((resolve) => {
        const done = () => resolve(failed && !text ? null : text);
        if (!running) return done();
        running = false;
        const timeout = window.setTimeout(done, 1500);
        ended = () => {
          window.clearTimeout(timeout);
          done();
        };
        recognition.stop();
      }),
    cancel: () => {
      running = false;
      recognition.abort();
    },
  };
}

/** A rough input level from the waveform, for the meter. */
function startLevel(stream: MediaStream) {
  try {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    return {
      level: () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const v of samples) sum += ((v - 128) / 128) ** 2;
        return Math.min(1, Math.sqrt(sum / samples.length) * 4);
      },
      close: () => void context.close(),
    };
  } catch {
    return { level: () => 0, close: () => {} };
  }
}

function micMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Microphone access is blocked. Allow it in your browser’s site settings, then try again.';
  if (name === 'NotFoundError') return 'No microphone was found. Connect one, then try again.';
  return 'The microphone couldn’t start. Check it isn’t in use by another app, then try again.';
}

/** MediaRecorder for the audio, the Web Speech API for the transcript where there is one. */
export const browserMicrophone: Microphone = {
  canTranscribe: () => recognitionClass() !== undefined,
  start: async (onTranscript) => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new MicrophoneError('This browser can’t record audio. Try Chrome, Edge or Safari.');
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      throw new MicrophoneError(micMessage(error));
    }
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.start(1000);
    const meter = startLevel(stream);
    const transcript = startTranscript(onTranscript);
    const release = () => {
      stream.getTracks().forEach((t) => t.stop());
      meter.close();
    };

    return {
      level: meter.level,
      stop: async () => {
        // A recorder that already stopped (the device went away) has nothing left to wait for.
        const stopped =
          recorder.state === 'inactive'
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                recorder.onstop = () => resolve();
                recorder.stop();
              });
        const [, text] = await Promise.all([stopped, transcript?.finish() ?? null]);
        release();
        const mimeType = recorder.mimeType || chunks[0]?.type || 'audio/webm';
        return { blob: new Blob(chunks, { type: mimeType }), mimeType, transcript: text };
      },
      cancel: () => {
        transcript?.cancel();
        if (recorder.state !== 'inactive') recorder.stop();
        release();
      },
    };
  },
};
