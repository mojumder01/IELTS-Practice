import { useEffect, useState, useSyncExternalStore } from 'react';
import { recordingKey, recordingLimits } from '../../engine/speaking';
import { useServices } from '../../lib/services';
import { SpeakingRecorder } from '../../lib/speakingRecorder';
import { TakePlayback } from '../../lib/takePlayback';
import type { SpeakingSection } from '../../schema/test';
import { useExam, useExamStore } from '../../store/examContext';
import { Recorder } from './Recorder';
import { SelfReview } from './SelfReview';
import { SpeakingQuestions } from './SpeakingQuestions';
import { useTakes } from './useTakes';

/** One Speaking part: questions or cue card, the recorder and the self-review (Speaking artboard). */
export function SpeakingContent({ section }: { section: SpeakingSection }) {
  const services = useServices();
  const store = useExamStore();
  const session = useExam((s) => s.session)!;
  const clockNow = useExam((s) => s.clockNow);
  const setNotes = useExam((s) => s.setNotes);
  const toggleCovered = useExam((s) => s.toggleCovered);
  const setSelfScore = useExam((s) => s.setSelfScore);
  const part = session.part;
  const limits = recordingLimits(part, section);
  const finished = session.status === 'submitted';

  // One recorder per part (this component is keyed by part); it saves each take on the device.
  const [recorder] = useState(
    () =>
      new SpeakingRecorder({
        microphone: services.microphone,
        now: services.now,
        limits,
        save: async (result) => {
          const { session: s, addRecording } = store.getState();
          if (!s) return;
          const earlier = (await services.recordings.list(s.attemptId)).filter(
            (t) => t.part === part,
          );
          const number = earlier.length + 1;
          const key = recordingKey(s.attemptId, part, number);
          await services.recordings.save({
            key,
            attemptId: s.attemptId,
            part,
            number,
            createdAt: services.now(),
            ...result,
          });
          addRecording(key);
        },
      }),
  );
  const state = useSyncExternalStore(recorder.subscribe, recorder.getSnapshot);
  useEffect(() => recorder.dispose, [recorder]);

  const [playback] = useState(() => new TakePlayback());
  const playing = useSyncExternalStore(playback.subscribe, playback.getSnapshot);
  useEffect(() => playback.stop, [playback]);

  const takes = useTakes(session.attemptId, part, state.saved);
  const latest = takes?.at(-1) ?? null;

  return (
    // One column on a phone, two on a tablet (self-review below), three on a wide screen.
    <div className="grid min-h-full grid-cols-1 items-start gap-5 px-4 py-6 sm:px-6 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_minmax(320px,1.4fr)_minmax(280px,1.1fr)]">
      <SpeakingQuestions
        section={section}
        part={part}
        notes={session.notes}
        onNotes={setNotes}
        readOnly={finished}
      />
      <Recorder
        limits={limits}
        state={state}
        finished={finished}
        takes={takes}
        playing={playing}
        now={clockNow}
        onBegin={recorder.begin}
        onStartSpeaking={() => void recorder.startSpeaking()}
        onStop={() => void recorder.stop()}
        onToggleTake={(take) => {
          if (state.phase === 'record') return;
          playback.toggle(take);
        }}
      />
      <SelfReview
        section={section}
        part={part}
        maxSec={limits.maxSec}
        take={latest}
        canTranscribe={services.microphone.canTranscribe()}
        covered={session.speaking.covered}
        onToggleCovered={toggleCovered}
        selfScores={session.speaking.selfScores}
        onSelfScore={setSelfScore}
        finished={finished}
      />
    </div>
  );
}
