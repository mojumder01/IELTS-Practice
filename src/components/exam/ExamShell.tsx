import { Check, CloudOff } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { moduleName, neighbourModules, partWord, partsOf, rangeLabel } from '../../engine/parts';
import { canPause, hasAnswers } from '../../engine/session';
import { timeLeftSec, type ExamMode } from '../../engine/timer';
import { useExam } from '../../store/examContext';
import { ConfirmDialog } from './ConfirmDialog';
import { ExamHeader } from './ExamHeader';
import { NotesPopover } from './NotesPopover';
import { PausedOverlay } from './PausedOverlay';
import { QuestionGrid } from './QuestionGrid';
import { RevealBanner } from './RevealBanner';
import { SectionNav } from './SectionNav';

const HIDDEN_WHILE_PAUSED = {
  reading: 'passage',
  listening: 'question paper',
  writing: 'task',
  speaking: 'cue card',
};
const REVEAL_WHERE = {
  reading: 'passage',
  listening: 'audioscript',
  writing: 'task',
  speaking: 'cue card',
};

const clockTime = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

/** The frame every exam page shares (SPEC section 6); `children` is the module's own content. */
export function ExamShell({ children }: { children: ReactNode }) {
  const test = useExam((s) => s.test);
  const session = useExam((s) => s.session);
  const clockNow = useExam((s) => s.clockNow);
  const lastSavedAt = useExam((s) => s.lastSavedAt);
  const saveError = useExam((s) => s.saveError);
  const actions = useExam((s) => s);
  const navigate = useNavigate();

  const [notesOpen, setNotesOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [confirm, setConfirm] = useState<
    null | { kind: 'mode'; mode: ExamMode } | { kind: 'clear' }
  >(null);

  if (!test || !session) return null;
  const { module, mode } = session;
  const single = mode === 'single';
  const parts = partsOf(test, module);
  const currentPart = parts.find((p) => p.part === session.part) ?? parts[0];
  const shownParts = single ? parts.filter((p) => p.part === session.part) : parts;
  const word = partWord(module);
  const secondsLeft = session.timer
    ? timeLeftSec(session.timer, Math.max(clockNow, session.timer.runningSince ?? 0))
    : null;
  const submitted = session.status === 'submitted';

  const range = currentPart ? rangeLabel(currentPart) : '';
  const minutes = module === 'reading' ? test.meta.timing.reading.singlePartMin : null;
  const revealLabel =
    single &&
    !submitted &&
    test.meta.studentHelp.allowReveal &&
    (module === 'reading' || module === 'listening')
      ? module === 'reading'
        ? 'Show answers in the passage'
        : 'Show answers'
      : null;

  const { previous, next } = neighbourModules(module);
  const moduleHref = (m: string) =>
    `/test/${test.meta.testId}/${m}?mode=${mode}${single ? '&part=1' : ''}`;
  const lastPart = parts[parts.length - 1]?.part ?? 1;

  const action = submitted
    ? null
    : single
      ? {
          label: `Evaluate my ${moduleName(module)}`,
          kind: 'evaluate' as const,
          onClick: () => void actions.submit(),
        }
      : session.part < lastPart
        ? {
            label: `Next ${word.toLowerCase()}`,
            kind: 'next' as const,
            onClick: () => actions.goToPart(session.part + 1),
          }
        : next
          ? {
              label: `Next: ${moduleName(next)}`,
              kind: 'next' as const,
              onClick: () => void actions.submit().then(() => navigate(moduleHref(next))),
            }
          : {
              label: 'Submit test',
              kind: 'evaluate' as const,
              onClick: () => void actions.submit(),
            };

  const changeMode = (target: ExamMode) => {
    if (hasAnswers(session)) setConfirm({ kind: 'mode', mode: target });
    else actions.switchMode(target, target === 'full' ? 1 : session.part);
  };

  const toggleReveal = () => {
    if (!revealing) actions.reveal();
    setRevealing(!revealing);
  };

  return (
    <div className="relative flex h-dvh min-h-[600px] flex-col bg-canvas text-text">
      <ExamHeader
        title={`${test.meta.book} · Test ${test.meta.testNumber} · ${moduleName(module)}`}
        partLabel={`${word} ${session.part} of ${single ? 1 : parts.length}`}
        mode={mode}
        onModeChange={changeMode}
        notesOpen={notesOpen}
        onToggleNotes={() => setNotesOpen(!notesOpen)}
        revealLabel={revealLabel}
        revealing={revealing}
        onToggleReveal={toggleReveal}
        secondsLeft={secondsLeft}
        canPause={canPause(session)}
        paused={session.paused}
        onTogglePause={session.paused ? actions.resume : actions.pause}
        onClear={() => setConfirm({ kind: 'clear' })}
        focus={focus}
        onToggleFocus={() => setFocus(!focus)}
      />

      {/* Anchored to the header's bottom edge, which moves as the header wraps on a phone. */}
      <div className="relative z-[6] h-0">
        {notesOpen && <NotesPopover notes={session.notes} onChange={actions.setNotes} />}
      </div>

      {!focus && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border bg-surface px-4 py-2 sm:px-5">
          <div className="flex flex-col gap-px">
            <span className="text-sm font-semibold text-navy">
              {word} {session.part}
              {range && ` · Questions ${range}`}
            </span>
            {minutes && range && (
              <span className="text-[13px] text-muted">
                Spend about {minutes} minutes on Questions {range}, which are based on the passage
                below.
              </span>
            )}
          </div>
          <span role="status" className="inline-flex items-center gap-1.5 text-xs text-muted">
            {saveError ? (
              <>
                <CloudOff aria-hidden="true" className="size-3.5" />
                {saveError}
              </>
            ) : (
              lastSavedAt && (
                <>
                  <Check aria-hidden="true" className="size-3.5" />
                  Autosaved at {clockTime(lastSavedAt)}
                </>
              )
            )}
          </span>
        </div>
      )}

      {revealing && (
        <RevealBanner where={REVEAL_WHERE[module]} onHide={() => setRevealing(false)} />
      )}

      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-auto">
          {submitted ? (
            <div
              role="status"
              className="mx-auto flex max-w-[520px] flex-col gap-2 px-6 py-12 text-center"
            >
              <h2 className="m-0 text-xl font-semibold text-navy">
                Your {moduleName(module)} answers are submitted
              </h2>
              <p className="m-0 text-[15px] text-muted">They’re saved with this attempt.</p>
            </div>
          ) : (
            children
          )}
        </div>
        {/* Outside the scroller, so it covers the content however far it's scrolled. */}
        {session.paused && secondsLeft !== null && (
          <PausedOverlay
            secondsLeft={secondsLeft}
            hidden={HIDDEN_WHILE_PAUSED[module]}
            onResume={actions.resume}
          />
        )}
      </div>

      <QuestionGrid
        parts={shownParts}
        answers={session.answers}
        flagged={session.flagged}
        current={session.current}
        onPick={actions.goTo}
      />
      <SectionNav
        parts={shownParts}
        currentPart={session.part}
        onPickPart={actions.goToPart}
        previous={previous ? { label: moduleName(previous), href: moduleHref(previous) } : null}
        next={next ? { label: moduleName(next), href: moduleHref(next) } : null}
        action={action}
      />

      {confirm?.kind === 'mode' && (
        <ConfirmDialog
          title={`Switch to ${confirm.mode === 'full' ? 'Full mock' : 'Single part'}?`}
          message="This starts the module again: your answers, flags and notes are cleared and the timer restarts."
          confirmLabel="Switch and restart"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            actions.switchMode(confirm.mode, confirm.mode === 'full' ? 1 : session.part);
            setRevealing(false);
            setConfirm(null);
          }}
        />
      )}
      {confirm?.kind === 'clear' && (
        <ConfirmDialog
          title={`Clear ${word.toLowerCase()} ${session.part}?`}
          message={`This removes your answers, flags and highlights for ${word.toLowerCase()} ${session.part}.`}
          confirmLabel="Clear"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            actions.clearPart();
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}
