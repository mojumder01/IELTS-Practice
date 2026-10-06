import type { LocalAttempts } from '../store/examStore';

/** The live sitting in localStorage. Reads and writes never throw: storage can be full or blocked. */
export const localAttempts: LocalAttempts = {
  load: (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  },
  save: (key, session) => {
    try {
      localStorage.setItem(key, JSON.stringify(session));
    } catch (error) {
      console.error('Could not save the attempt on this device', error);
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to do: the entry is gone or storage is unavailable.
    }
  },
};
