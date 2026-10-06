import { useState, useSyncExternalStore } from 'react';
import { AudioDriver } from '../../lib/audioDriver';

/** An audio element's live state and controls; give `attach` to the <audio> element's ref. */
export function useAudio(durationSec: number, startAt: number) {
  const [driver] = useState(() => new AudioDriver(durationSec, startAt));
  const state = useSyncExternalStore(driver.subscribe, driver.getSnapshot);
  const controls = {
    ...state,
    play: driver.play,
    pause: driver.pause,
    seek: driver.seek,
    setSpeed: driver.setSpeed,
  };
  return { attach: driver.attach, controls };
}

export type AudioControls = ReturnType<typeof useAudio>['controls'];
