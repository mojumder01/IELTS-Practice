import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { AuthContext, createAuthStore } from '../../src/lib/auth';
import { ServicesContext } from '../../src/lib/services';
import { routes } from '../../src/routes';
import { fakeAuth, owner, OWNER_UID, stranger } from './fakeAuth';
import { fakeServices } from './fakeServices';

function renderApp(path: string) {
  const auth = fakeAuth();
  const store = createAuthStore(auth.adapter, OWNER_UID);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <ServicesContext value={fakeServices().services}>
      <AuthContext value={store}>
        <RouterProvider router={router} />
      </AuthContext>
    </ServicesContext>,
  );
  return {
    ...auth,
    router,
    emit: (user: Parameters<typeof auth.emit>[0]) => act(() => auth.emit(user)),
  };
}

describe('auth guard', () => {
  it('waits for Firebase before deciding', () => {
    renderApp('/');
    expect(screen.getByRole('status')).toHaveTextContent('Checking sign-in…');
  });

  it('sends a signed-out visitor to the sign-in page', () => {
    const { emit, router } = renderApp('/');
    emit(null);
    expect(router.state.location.pathname).toBe('/signin');
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument();
  });

  it('shows the owner the dashboard', async () => {
    const { emit } = renderApp('/');
    emit(owner);
    expect(await screen.findByRole('heading', { name: 'Welcome back, Alex' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('refuses any other Google account', () => {
    const { emit, adapter, router } = renderApp('/');
    emit(stranger);
    expect(adapter.signOut).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe('/signin');
    expect(screen.getByRole('alert')).toHaveTextContent('This app is private');
    expect(screen.getByRole('alert')).toHaveTextContent('stranger@example.com');
    expect(screen.queryByRole('heading', { name: /Welcome back/ })).not.toBeInTheDocument();
  });

  it('sends unknown paths home', () => {
    const { emit, router } = renderApp('/nowhere');
    emit(owner);
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('sign-in page', () => {
  it('starts Google sign-in from the button', async () => {
    const { emit, adapter } = renderApp('/signin');
    emit(null);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
    expect(adapter.signIn).toHaveBeenCalledOnce();
  });

  it('returns the owner to the page they asked for', () => {
    const { emit, router } = renderApp('/?from=bookmark');
    emit(null);
    expect(router.state.location.pathname).toBe('/signin');
    emit(owner);
    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.search).toBe('?from=bookmark');
  });

  it('signs the owner out from the header', async () => {
    const { emit, adapter, router } = renderApp('/');
    emit(owner);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(adapter.signOut).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe('/signin');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
