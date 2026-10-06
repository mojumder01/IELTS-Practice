import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { ExamState, ExamStore } from './examStore';

export const ExamStoreContext = createContext<ExamStore | null>(null);

/** Reads from the sitting's store; re-renders only when the selected value changes. */
export function useExam<T>(selector: (state: ExamState) => T): T {
  const store = useContext(ExamStoreContext);
  if (!store) throw new Error('useExam() needs an ExamStoreContext provider');
  return useStore(store, selector);
}
