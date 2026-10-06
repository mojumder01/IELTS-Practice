import { useSyncExternalStore } from 'react';

/** Live result of a CSS media query; false where matchMedia doesn't exist (tests). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  );
}

/** Phone layout below 768px (SPEC section 9: every layout works at 390px). */
export function useIsPhone(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
