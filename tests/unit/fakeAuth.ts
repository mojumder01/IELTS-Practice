import { vi } from 'vitest';
import type { AuthAdapter, AuthUser } from '../../src/lib/auth';

/** An AuthAdapter whose auth state the test drives by hand. */
export function fakeAuth() {
  let listener: ((user: AuthUser | null) => void) | null = null;
  const emit = (user: AuthUser | null) => listener?.(user);
  const adapter = {
    onChange: vi.fn((next: (user: AuthUser | null) => void) => {
      listener = next;
      return () => {
        listener = null;
      };
    }),
    signIn: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => {
      emit(null);
      return Promise.resolve();
    }),
  } satisfies AuthAdapter;
  return { adapter, emit };
}

export const OWNER_UID = 'ownerUid1234567890abcdefghij';
export const owner: AuthUser = {
  uid: OWNER_UID,
  email: 'owner@example.com',
  displayName: 'Alex Morgan',
};
export const stranger: AuthUser = {
  uid: 'strangerUid1234567890abcdefg',
  email: 'stranger@example.com',
  displayName: 'Someone Else',
};
