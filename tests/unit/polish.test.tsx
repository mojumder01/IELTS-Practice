import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { applyTheme, initialTheme } from '../../src/lib/theme';
import { RouteError } from '../../src/pages/RouteError';

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
});

describe('theme', () => {
  it('follows the system until the owner chooses', () => {
    const matchMedia = vi.fn((q: string) => ({ matches: q.includes('dark') }) as MediaQueryList);
    vi.stubGlobal('matchMedia', matchMedia);
    expect(initialTheme()).toBe('dark');
    localStorage.setItem('ielts:theme', 'light');
    expect(initialTheme()).toBe('light');
    vi.unstubAllGlobals();
  });

  it('toggles the dark token set and remembers it', async () => {
    applyTheme('light');
    render(<ThemeToggle className="" />);
    const toggle = screen.getByRole('button', { name: 'Dark theme' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('ielts:theme')).toBe('dark');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('offline banner', () => {
  it('appears while the browser is offline', () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    online.mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event('offline')));
    expect(screen.getByRole('status')).toHaveTextContent('You’re offline.');
    online.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('route errors', () => {
  it('shows a recoverable message instead of a blank page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Broken(): never {
      throw new Error('Kaboom');
    }
    const router = createMemoryRouter([
      { path: '/', element: <Broken />, errorElement: <RouteError /> },
    ]);
    render(<RouterProvider router={router} />);
    expect(
      await screen.findByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Kaboom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});
