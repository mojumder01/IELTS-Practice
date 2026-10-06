export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
}

export interface AppEnv {
  firebase: FirebaseWebConfig;
  ownerUid: string;
}

export type EnvResult = { ok: true; env: AppEnv } | { ok: false; missing: string[] };

const REQUIRED = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_OWNER_UID',
] as const;

type EnvSource = Partial<Record<string, unknown>>;

function read(source: EnvSource, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** Reads the build-time config; anything missing is reported by name, never by value. */
export function readEnv(source: EnvSource): EnvResult {
  const missing = REQUIRED.filter((key) => read(source, key) === '');
  if (missing.length > 0) return { ok: false, missing };

  const messagingSenderId = read(source, 'VITE_FIREBASE_MESSAGING_SENDER_ID');
  return {
    ok: true,
    env: {
      firebase: {
        apiKey: read(source, 'VITE_FIREBASE_API_KEY'),
        authDomain: read(source, 'VITE_FIREBASE_AUTH_DOMAIN'),
        projectId: read(source, 'VITE_FIREBASE_PROJECT_ID'),
        appId: read(source, 'VITE_FIREBASE_APP_ID'),
        ...(messagingSenderId ? { messagingSenderId } : {}),
      },
      ownerUid: read(source, 'VITE_OWNER_UID'),
    },
  };
}
