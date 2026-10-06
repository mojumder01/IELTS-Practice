import { useCallback, useRef, useState, type ReactNode } from 'react';
import { SaveWordDialog } from './SaveWordDialog';
import { useWordTap } from './useWordTap';

/** Wraps a passage or transcript: double-tap a word to save it to vocabulary. */
export function WordSaver({ testId, children }: { testId: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<{ word: string; sentence: string } | null>(null);
  const onWord = useCallback((found: { word: string; sentence: string }) => {
    window.getSelection()?.removeAllRanges();
    setPicked(found);
  }, []);
  useWordTap(ref, onWord);
  return (
    <div ref={ref}>
      {children}
      {picked && (
        <SaveWordDialog
          word={picked.word}
          sentence={picked.sentence}
          testId={testId}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}
