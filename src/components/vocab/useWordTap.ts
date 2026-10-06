import { useEffect, type RefObject } from 'react';
import { wordFromPoint } from './wordFromPoint';

const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_PX = 24;

/**
 * Double-click or double-tap a word inside `ref` (in an element with data-word-root) to get it
 * with its sentence. Touch double-taps are timed by hand: mobile browsers don't all send dblclick.
 */
export function useWordTap(
  ref: RefObject<HTMLElement | null>,
  onWord: (found: { word: string; sentence: string }) => void,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last: { at: number; x: number; y: number } | null = null;
    const found = (x: number, y: number) => {
      const hit = wordFromPoint(x, y);
      if (hit) onWord(hit);
    };
    const onDoubleClick = (e: MouseEvent) => found(e.clientX, e.clientY);
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      const now = e.timeStamp;
      if (
        last &&
        now - last.at < DOUBLE_TAP_MS &&
        Math.hypot(e.clientX - last.x, e.clientY - last.y) < DOUBLE_TAP_PX
      ) {
        last = null;
        found(e.clientX, e.clientY);
      } else {
        last = { at: now, x: e.clientX, y: e.clientY };
      }
    };
    el.addEventListener('dblclick', onDoubleClick);
    el.addEventListener('pointerup', onPointerUp);
    return () => {
      el.removeEventListener('dblclick', onDoubleClick);
      el.removeEventListener('pointerup', onPointerUp);
    };
  }, [ref, onWord]);
}
