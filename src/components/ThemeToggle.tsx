import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { currentTheme, saveTheme } from '../lib/theme';

/** Switches data-theme on <html> between the light and dark token sets, and remembers it. */
export function ThemeToggle({ className }: { className: string }) {
  const [theme, setTheme] = useState(currentTheme);
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      aria-label="Dark theme"
      aria-pressed={dark}
      onClick={() => {
        const next = dark ? 'light' : 'dark';
        setTheme(next);
        saveTheme(next);
      }}
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
