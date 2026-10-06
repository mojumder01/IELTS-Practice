import { useExam } from '../../store/examContext';

/** What every question component needs from the sitting. */
export function useQuestionState() {
  const session = useExam((s) => s.session);
  const revealAll = useExam((s) => s.revealAll);
  const shown = useExam((s) => s.shown);
  const allowReveal = useExam((s) => s.test?.meta.studentHelp.allowReveal ?? false);
  const answer = useExam((s) => s.answer);
  const toggleFlag = useExam((s) => s.toggleFlag);
  const goTo = useExam((s) => s.goTo);
  const toggleShown = useExam((s) => s.toggleShown);

  const answers = session?.answers ?? {};
  const open = session?.status === 'in_progress';
  return {
    answers,
    value: (n: number) => answers[String(n)] ?? '',
    flagged: (n: number) => session?.flagged.includes(n) ?? false,
    current: session?.current ?? null,
    /** Per-question and per-group lightbulbs: single-part mode, when the test allows it. */
    canShow: open && session?.mode === 'single' && allowReveal,
    isShown: (...keys: string[]) => revealAll || keys.some((k) => shown[k]),
    answer,
    toggleFlag,
    goTo,
    toggleShown,
  };
}
