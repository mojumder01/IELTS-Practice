import { describe, expect, it } from 'vitest';
import { readEnv } from '../../src/lib/env';

const complete = {
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo',
  VITE_FIREBASE_APP_ID: '1:2:web:3',
  VITE_OWNER_UID: 'ownerUid',
};

describe('readEnv', () => {
  it('builds the Firebase config and owner UID', () => {
    expect(readEnv({ ...complete, VITE_FIREBASE_MESSAGING_SENDER_ID: '42' })).toEqual({
      ok: true,
      env: {
        firebase: {
          apiKey: 'key',
          authDomain: 'demo.firebaseapp.com',
          projectId: 'demo',
          appId: '1:2:web:3',
          messagingSenderId: '42',
        },
        ownerUid: 'ownerUid',
      },
    });
  });

  it('treats the messaging sender ID as optional', () => {
    const result = readEnv(complete);
    expect(result.ok && result.env.firebase).not.toHaveProperty('messagingSenderId');
  });

  it('names every missing or blank setting', () => {
    expect(readEnv({ ...complete, VITE_OWNER_UID: '  ', VITE_FIREBASE_APP_ID: undefined })).toEqual(
      { ok: false, missing: ['VITE_FIREBASE_APP_ID', 'VITE_OWNER_UID'] },
    );
  });

  it('trims whitespace from values', () => {
    const result = readEnv({ ...complete, VITE_OWNER_UID: ' ownerUid\n' });
    expect(result.ok && result.env.ownerUid).toBe('ownerUid');
  });
});
