import { describe, expect, it, vi } from 'vitest';
import { createAuthStore, isOwner, signInErrorMessage } from '../../src/lib/auth';
import { fakeAuth, owner, OWNER_UID, stranger } from './fakeAuth';

describe('isOwner', () => {
  it('accepts only the configured UID', () => {
    expect(isOwner(owner, OWNER_UID)).toBe(true);
    expect(isOwner(stranger, OWNER_UID)).toBe(false);
  });

  it('refuses everyone when no owner UID is configured', () => {
    expect(isOwner({ ...owner, uid: '' }, '')).toBe(false);
  });
});

describe('createAuthStore', () => {
  it('starts loading, then reports signed out', () => {
    const { adapter, emit } = fakeAuth();
    const store = createAuthStore(adapter, OWNER_UID);
    expect(store.getState()).toEqual({ status: 'loading' });

    emit(null);
    expect(store.getState()).toEqual({ status: 'signedOut', refusedEmail: null, error: null });
  });

  it('lets the owner in', () => {
    const { adapter, emit } = fakeAuth();
    const store = createAuthStore(adapter, OWNER_UID);
    emit(owner);
    expect(store.getState()).toEqual({ status: 'owner', user: owner });
    expect(adapter.signOut).not.toHaveBeenCalled();
  });

  it('signs any other account out and remembers who was refused', () => {
    const { adapter, emit } = fakeAuth();
    const store = createAuthStore(adapter, OWNER_UID);
    emit(stranger);

    expect(adapter.signOut).toHaveBeenCalledOnce();
    // The fake adapter's signOut emits null; the refusal must survive it.
    expect(store.getState()).toEqual({
      status: 'signedOut',
      refusedEmail: 'stranger@example.com',
      error: null,
    });
  });

  it('never reports a refused account as the owner, even with no owner configured', () => {
    const { adapter, emit } = fakeAuth();
    const store = createAuthStore(adapter, '');
    emit(owner);
    expect(store.getState().status).toBe('signedOut');
  });

  it('clears the refusal when signing in again', async () => {
    const { adapter, emit } = fakeAuth();
    const store = createAuthStore(adapter, OWNER_UID);
    emit(stranger);

    await store.signIn();
    expect(adapter.signIn).toHaveBeenCalledOnce();
    expect(store.getState()).toEqual({ status: 'signedOut', refusedEmail: null, error: null });
  });

  it('stays quiet when the user closes the Google popup', async () => {
    const { adapter, emit } = fakeAuth();
    adapter.signIn.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    const store = createAuthStore(adapter, OWNER_UID);
    emit(null);

    await store.signIn();
    expect(store.getState()).toEqual({ status: 'signedOut', refusedEmail: null, error: null });
  });

  it('shows a message when sign-in fails', async () => {
    const { adapter, emit } = fakeAuth();
    adapter.signIn.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    const store = createAuthStore(adapter, OWNER_UID);
    emit(null);

    await store.signIn();
    expect(store.getState()).toEqual({
      status: 'signedOut',
      refusedEmail: null,
      error: 'Couldn’t reach Google. Check your connection and try again.',
    });
  });

  it('notifies subscribers until they unsubscribe', () => {
    const { adapter, emit } = fakeAuth();
    const store = createAuthStore(adapter, OWNER_UID);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    emit(owner);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    emit(null);
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe('signInErrorMessage', () => {
  it('ignores cancellations', () => {
    expect(signInErrorMessage({ code: 'auth/cancelled-popup-request' })).toBeNull();
    expect(signInErrorMessage({ code: 'auth/user-cancelled' })).toBeNull();
  });

  it('explains an unauthorised domain', () => {
    expect(signInErrorMessage({ code: 'auth/unauthorized-domain' })).toMatch(/Authorised domains/);
  });

  it('falls back to a generic message', () => {
    expect(signInErrorMessage(new Error('boom'))).toMatch(/try again/);
  });
});
