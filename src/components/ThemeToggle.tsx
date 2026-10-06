import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';

const KEY = 'ielts:theme';

function storedTheme(): 'light' | 'dark' {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Sets data-theme on <html>; the dark token values arrive in Phase 10 (SPEC section 13). */
export function ThemeToggle({ className }: { className: string }) {
  const [theme, setTheme] = useState(storedTheme);
  const dark = theme === 'dark';

  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // The choice just won't persist.
    }
  };

  return (
    <button
      type="button"
      aria-label="Dark theme"
      aria-pressed={dark}
      onClick={toggle}
      className={className}
    >
      {dark ? (
        <Sun aria-hidden="true" className="size-[17px]" />
      ) : (
        <Moon aria-hidden="true" className="size-[17px]" />
      )}
    </button>
  );
}
