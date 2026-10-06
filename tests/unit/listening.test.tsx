import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { ExamShell } from '../../src/components/exam/ExamShell';
import { ListeningContent } from '../../src/components/listening/ListeningContent';
import type { ListeningSection } from '../../src/schema/test';
import { ExamStoreContext } from '../../src/store/examContext';
import { examWorld, sample } from './examHarness';

function listeningSection(): ListeningSection {
  const s = sample.sections['listening-1'];
  if (s?.kind !== 'listening') throw new Error('sample has no listening-1');
  return s;
}
const section = listeningSection();

async function renderListening(mode: 'single' | 'full' = 'single', world = examWorld()) {
  const store = world.newStore();
  await store.getState().open({ test: sample, module: 'listening', mode, part: 1 });
  const router = createMemoryRouter([
    {
      path: '*',
      element: (
        <ExamStoreContext value={store}>
          <ExamShell>
            <ListeningContent section={section} />
          </ExamShell>
        </ExamStoreContext>
      ),
    },
  ]);
  const view = render(<RouterProvider router={router} />);
  const audio = view.container.querySelector('audio')!;
  /** Moves the audio to a time, as playback would. */
  const playTo = (seconds: number) =>
    act(() => {
      audio.currentTime = seconds;
      audio.dispatchEvent(new Event('timeupdate'));
    });
  return { store, world, audio, playTo, user: userEvent.setup(), unmount: view.unmount };
}

const nowPlaying = () =>
  screen.getByRole('complementary', { name: 'Audioscript' }).querySelector('[aria-current="true"]');

describe('Listening', () => {
  it('offers every control in single-part mode and keeps the script closed until asked', async () => {
    await renderListening();
    for (const name of ['Back 5 seconds', 'Forward 5 seconds', 'Play audio']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
    expect(screen.getByRole('slider', { name: 'Audio position' })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: 'Playback speed' })).toBeEnabled();
    expect(screen.queryByRole('complementary', { name: 'Audioscript' })).not.toBeInTheDocument();
  });

  it('follows the audio in the script, line by line', async () => {
    const { user, playTo } = await renderListening();
    await user.click(screen.getByRole('button', { name: 'Show audioscript' }));
    playTo(15);
    expect(nowPlaying()).toHaveTextContent('It’s Morgan');
    playTo(39.2);
    expect(nowPlaying()).toHaveTextContent('Swimming, mostly');
  });

  it('seeks to a line when you select it', async () => {
    const { user, audio } = await renderListening();
    await user.click(screen.getByRole('button', { name: 'Show audioscript' }));
    await user.click(screen.getByRole('button', { name: /Can we park at the centre/ }));
    expect(audio.currentTime).toBe(66);
    expect(nowPlaying()).toHaveTextContent('Can we park at the centre');
  });

  it('marks lines with the highlighter instead of seeking', async () => {
    const { user, store, audio } = await renderListening();
    await user.click(screen.getByRole('button', { name: 'Show audioscript' }));
    await user.click(screen.getByRole('button', { name: 'Highlighter' }));
    const line = screen.getByRole('button', { name: /Lovely. And your surname/ });
    await user.click(line);
    expect(line).toHaveAttribute('aria-pressed', 'true');
    expect(store.getState().session!.scriptMarks).toEqual([2]);
    expect(audio.currentTime).toBe(0);
  });

  it('skips 5 seconds and changes speed', async () => {
    const { user, audio } = await renderListening();
    await user.click(screen.getByRole('button', { name: 'Forward 5 seconds' }));
    expect(audio.currentTime).toBe(5);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Playback speed' }), '1.5');
    expect(audio.playbackRate).toBe(1.5);
  });

  it('marks revealed answers in the script, opening it', async () => {
    const { user } = await renderListening();
    await user.click(screen.getByRole('button', { name: 'Show answers for questions 1–6' }));
    const script = screen.getByRole('complementary', { name: 'Audioscript' });
    const mark = within(script).getByText('fourteenth');
    expect(mark.tagName).toBe('MARK');
    expect(screen.getByText('at 0:50 in the audioscript', { exact: false })).toBeInTheDocument();
  });

  it('locks a full mock: no seeking, speed or script, and no pausing once it plays', async () => {
    const { user } = await renderListening('full');
    expect(screen.getByRole('button', { name: 'Back 5 seconds' })).toBeDisabled();
    expect(screen.getByRole('slider', { name: 'Audio position' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Playback speed' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Show audioscript' })).not.toBeInTheDocument();
    expect(screen.getByText(/audio plays once, no seeking/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Play audio' }));
    expect(screen.getByRole('button', { name: 'Pause audio' })).toBeDisabled();
  });

  it('pauses the audio when the test is paused', async () => {
    const { user, audio } = await renderListening();
    await user.click(screen.getByRole('button', { name: 'Play audio' }));
    expect(screen.getByRole('button', { name: 'Pause audio' })).toBeInTheDocument();
    let paused = false;
    audio.addEventListener('pause', () => (paused = true));
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(paused).toBe(true);
  });

  it('remembers where the audio got to', async () => {
    const world = examWorld();
    const first = await renderListening('single', world);
    first.playTo(42.4);
    expect(first.store.getState().session!.audioPositions).toEqual({ '1': 42 });
    first.unmount();
    const again = await renderListening('single', world);
    expect(again.store.getState().session!.audioPositions['1']).toBe(42);
    expect(screen.getByRole('button', { name: 'Continue audio' })).toBeInTheDocument();
  });
});
