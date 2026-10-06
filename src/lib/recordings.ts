/** One recorded answer, kept on this device only (SPEC section 7: IndexedDB, never uploaded). */
export interface Take {
  key: string;
  attemptId: string;
  part: number;
  /** 1, 2, 3… within the part. */
  number: number;
  blob: Blob;
  mimeType: string;
  durationSec: number;
  /** null when the browser can't transcribe; "" when it could but heard nothing. */
  transcript: string | null;
  createdAt: number;
}

export interface RecordingStore {
  /** Every take for an attempt, oldest first. */
  list: (attemptId: string) => Promise<Take[]>;
  save: (take: Take) => Promise<void>;
}

const DB_NAME = 'ielts-practice';
const STORE = 'recordings';

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });
}

let opened: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const store = r.result.createObjectStore(STORE, { keyPath: 'key' });
      store.createIndex('attemptId', 'attemptId');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB could not open'));
  });
  return opened;
}

const byAge = (a: Take, b: Take) => a.createdAt - b.createdAt;

/** The browser's IndexedDB. */
export const idbRecordings: RecordingStore = {
  list: async (attemptId) => {
    const db = await database();
    const index = db.transaction(STORE, 'readonly').objectStore(STORE).index('attemptId');
    return ((await request(index.getAll(attemptId))) as Take[]).sort(byAge);
  },
  save: async (take) => {
    const db = await database();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(take);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('The recording could not be saved'));
      tx.onabort = () => reject(tx.error ?? new Error('The recording could not be saved'));
    });
  },
};

/** For tests and browsers without IndexedDB: lives as long as the page. */
export function memoryRecordings(): RecordingStore {
  const takes = new Map<string, Take>();
  return {
    list: (attemptId) =>
      Promise.resolve([...takes.values()].filter((t) => t.attemptId === attemptId).sort(byAge)),
    save: (take) => {
      takes.set(take.key, take);
      return Promise.resolve();
    },
  };
}
