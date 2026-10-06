import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExamShell } from '../../src/components/exam/ExamShell';
import { SpeakingContent } from '../../src/components/speaking/SpeakingContent';
import { MicrophoneError, type Microphone } from '../../src/lib/microphone';
import { memoryRecordings, type RecordingStore } from '../../src/lib/recordings';
import { ServicesContext, type Services } from '../../src/lib/services';
import type { SpeakingSection } from '../../src/schema/test';
import { ExamStoreContext, useExam } from '../../src/store/examContext';
import type { ExamStore } from '../../src/store/examStore';
import { examWorld, sample } from './examHarness';

const TRANSCRIPT =
  'One public place I really enjoy is the riverside park. It is, um, near my office and I go there, like, twice a week. You know, it is quiet.';

function speakingSection(): SpeakingSection {
  const section = sample.sections.speaking;
  if (section?.kind !== 'speaking') throw new Error('the sample test needs a Speaking section');
  return section;
}
const section = speakingSection();

function fakeMicrophone({
  canTranscribe = true,
  fail,
}: { canTranscribe?: boolean; fail?: string } = {}) {
  const cancel = vi.fn();
  const microphone: Microphone = {
    canTranscribe: () => canTranscribe,
    start: vi.fn((onTranscript: (text: string) => void) => {
      if (fail) return Promise.reject(new MicrophoneError(fail));
      onTranscript('One public place');
      return Promise.resolve({
        level: () => 0.5,
        stop: () =>
          Promise.resolve({
            blob: new Blob(['audio'], { type: 'audio/webm' }),
            mimeType: 'audio/webm',
            transcript: canTranscribe ? TRANSCRIPT : null,
          }),
        cancel,
      });
    }),
  };
  return { microphone, cancel };
}

function Content() {
  const part = useExam((s) => s.session!.part);
  return <SpeakingContent key={part} section={section} />;
}

/** Lets the microphone and IndexedDB promises settle under fake timers. */
const settle = () => act(() => vi.advanceTimersByTimeAsync(0));
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

async function renderSpeaking({
  part = 2,
  microphone = fakeMicrophone().microphone,
  recordings = memoryRecordings(),
  store,
}: {
  part?: number;
  microphone?: Microphone;
  recordings?: RecordingStore;
  store?: ExamStore;
} = {}) {
  const world = examWorld();
  const exam = store ?? world.newStore();
  if (!store) await exam.getState().open({ test: sample, module: 'speaking', mode: 'full', part });
  const services = {
    microphone,
    recordings,
    now: () => Date.now(),
  } as unknown as Services;
  const router = createMemoryRouter([
    {
      path: '*',
      element: (
        <ServicesContext value={services}>
          <ExamStoreContext value={exam}>
            <ExamShell>
              <Content />
            </ExamShell>
          </ExamStoreContext>
        </ServicesContext>
      ),
    },
  ]);
  const view = render(<RouterProvider router={router} />);
  // No delays between steps: the clock only moves when a test moves it.
  const user = userEvent.setup({ delay: null });
  return { store: exam, recordings, user, view };
}

beforeEach(() => {
  // Testing Library's async helpers wait on a setTimeout(0), which they only move along under
  // fake timers when they see Jest's API; this lends them Vitest's.
  Object.assign(globalThis, { jest: { advanceTimersByTime: vi.advanceTimersByTime } });
  // React schedules work with setImmediate here, so that stays real.
  vi.useFakeTimers({
    now: new Date('2026-10-06T10:00:00Z'),
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(globalThis, 'jest');
});

describe('Speaking page', () => {
  it('shows the part tabs and the cue card, with no timer or mode switch', async () => {
    const { user } = await renderSpeaking();
    expect(screen.getByText('Book 21 · Test 1 · Speaking')).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Single part' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Notes' })).not.toBeInTheDocument();
    expect(screen.getByText('Recordings stay on this device')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Part 2/ })).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByText('Describe a public place in your city that you enjoy visiting.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Preparation notes' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Part 1/ }));
    expect(screen.getByText('Do you work, or are you a student?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
  });

  it('runs Prepare → Speak → Review: starts after a minute and stops at two', async () => {
    const { user, store } = await renderSpeaking();
    await user.click(screen.getByRole('button', { name: 'Start preparing' }));
    expect(screen.getByText('Preparation time left')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('01:00');
    await wait(18_000);
    expect(screen.getByRole('timer')).toHaveTextContent('00:42');

    await wait(42_200);
    await settle();
    expect(screen.getByText('Recording')).toBeInTheDocument();
    expect(screen.getByText('of 2:00 maximum')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Speak');

    await wait(120_200);
    await settle();
    expect(screen.getByText('Take 1 saved')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Review');
    expect(screen.getByRole('button', { name: 'Play take 1' })).toBeInTheDocument();
    expect(store.getState().session!.speaking.recordingKeys).toEqual([
      `${store.getState().session!.attemptId}:p2:t1`,
    ]);

    const review = screen.getByRole('complementary', { name: 'Self-review' });
    expect(within(review).getByText('2:00')).toBeInTheDocument();
    expect(within(review).getAllByText(/filler:/)).toHaveLength(3);
    expect(within(review).getByText('Filler words').nextSibling).toHaveTextContent('3');
    expect(within(review).getByText('Pace').nextSibling).toHaveTextContent(/^15\s*wpm$/); // 30 words in 2 minutes;
  });

  it('starts speaking early and coaches a short take', async () => {
    const { user } = await renderSpeaking();
    await user.click(screen.getByRole('button', { name: 'Start preparing' }));
    await user.click(screen.getByRole('button', { name: 'Start speaking now' }));
    await settle();
    await wait(91_000);
    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    await settle();

    expect(screen.getByText('Take 1 saved')).toBeInTheDocument();
    const review = screen.getByRole('complementary', { name: 'Self-review' });
    await user.click(within(review).getByRole('checkbox', { name: 'Where it is' }));
    await user.click(within(review).getByRole('checkbox', { name: 'How often you go there' }));
    await user.click(within(review).getByRole('checkbox', { name: 'What people do there' }));
    expect(within(review).getByText('3 of 4')).toBeInTheDocument();
    expect(
      within(review).getByText(
        'Take 1 stopped at 1:31 and skipped why you enjoy visiting it. Use the full two minutes.',
      ),
    ).toBeInTheDocument();

    // Record again: a second take joins the list.
    await user.click(screen.getByRole('button', { name: 'Record again' }));
    await user.click(screen.getByRole('button', { name: 'Start speaking now' }));
    await settle();
    await wait(5_000);
    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    await settle();
    expect(screen.getByText('Take 2 saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play take 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play take 2' })).toBeInTheDocument();
  });

  it('keeps takes when the page reloads', async () => {
    const recordings = memoryRecordings();
    const first = await renderSpeaking({ part: 1, recordings });
    await first.user.click(screen.getByRole('button', { name: 'Start recording' }));
    await settle();
    await wait(30_000);
    await first.user.click(screen.getByRole('button', { name: 'Stop recording' }));
    await settle();
    first.view.unmount();

    await renderSpeaking({ part: 1, recordings, store: first.store });
    await settle();
    expect(screen.getByRole('button', { name: 'Play take 1' })).toBeInTheDocument();
    const takes = screen.getByRole('list', { name: 'Your takes' });
    expect(takes).toHaveTextContent(/Take 1\s*0:30/);
  });

  it('says when this browser can’t transcribe; the recording still works', async () => {
    const { user } = await renderSpeaking({
      part: 3,
      microphone: fakeMicrophone({ canTranscribe: false }).microphone,
    });
    const review = screen.getByRole('complementary', { name: 'Self-review' });
    expect(
      within(review).getByText(/Transcript not available in this browser/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    await settle();
    await wait(20_000);
    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    await settle();
    expect(screen.getByText('Take 1 saved')).toBeInTheDocument();
    expect(
      within(review).getByText(/Transcript not available in this browser/),
    ).toBeInTheDocument();
    expect(within(review).getByText('Filler words').nextSibling).toHaveTextContent('—');
  });

  it('explains a blocked microphone', async () => {
    const { user } = await renderSpeaking({
      part: 1,
      microphone: fakeMicrophone({ fail: 'Microphone access is blocked.' }).microphone,
    });
    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    await settle();
    expect(screen.getByRole('alert')).toHaveTextContent('Microphone access is blocked.');
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
  });

  it('drops a take still recording when the part changes', async () => {
    const { microphone, cancel } = fakeMicrophone();
    const { user } = await renderSpeaking({ part: 1, microphone });
    await user.click(screen.getByRole('button', { name: 'Start recording' }));
    await settle();
    await user.click(screen.getByRole('button', { name: /Part 3/ }));
    expect(cancel).toHaveBeenCalled();
  });

  it('bands the self-scores and finishes, after which nothing changes', async () => {
    const { user, store } = await renderSpeaking();
    expect(screen.getByText('Score all four to see your speaking band.')).toBeInTheDocument();
    const scores = { 'Fluency and coherence': '7', 'Lexical resource': '6', Pronunciation: '7' };
    for (const [label, band] of Object.entries(scores)) {
      await user.selectOptions(screen.getByRole('combobox', { name: label }), band);
    }
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Grammatical range and accuracy' }),
      '6',
    );
    expect(screen.getByText('Speaking band 6.5 (self-assessed)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Finish speaking' }));
    await settle();
    expect(store.getState().session!.status).toBe('submitted');
    expect(screen.getByRole('combobox', { name: 'Pronunciation' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Start preparing' })).not.toBeInTheDocument();
    expect(screen.getByText(/Speaking is finished/)).toBeInTheDocument();
  });
});
