import { useEffect, useState } from 'react';
import { audioFinished, audioRules, formatAudioTime } from '../../engine/audio';
import { useIsPhone } from '../../lib/useMediaQuery';
import type { ListeningSection } from '../../schema/test';
import { useExam } from '../../store/examContext';
import { WordSaver } from '../vocab/WordSaver';
import { AnswerSourceContext } from '../questions/answerContext';
import { QuestionGroupView } from '../questions/QuestionGroupView';
import { useQuestionState } from '../questions/useQuestionState';
import { AudioPlayer } from './AudioPlayer';
import { Audioscript } from './Audioscript';
import { useAudio } from './useAudio';

/** Player, questions and (on demand) the audioscript for one Listening part. */
export function ListeningContent({ section }: { section: ListeningSection }) {
  const phone = useIsPhone();
  const q = useQuestionState();
  const session = useExam((s) => s.session)!;
  const help = useExam((s) => s.test!.meta.studentHelp);
  const setAudioPosition = useExam((s) => s.setAudioPosition);
  const toggleScriptMark = useExam((s) => s.toggleScriptMark);
  const clockRunning = session.timer?.runningSince != null;

  const saved = session.audioPositions[String(section.part)] ?? 0;
  const { attach, controls: audio } = useAudio(section.durationSec, saved);
  const rules = audioRules(session.mode, help, session.status === 'submitted');
  const finished =
    !rules.controls && audioFinished(Math.max(saved, audio.time), section.durationSec);

  const [scriptChoice, setScriptChoice] = useState(false);
  const [highlighter, setHighlighter] = useState(false);
  const [tab, setTab] = useState<'questions' | 'script'>('questions');

  // Revealed answers are marked in the script, so revealing opens it.
  const revealed = new Set(
    section.groups.flatMap((g) =>
      g.questions.flatMap((x) => x.numbers.filter(() => q.isShown(`q${x.numbers[0]}`, g.groupId))),
    ),
  );
  const scriptOpen =
    rules.script === 'shown' ||
    (rules.script === 'on-demand' && (scriptChoice || revealed.size > 0));

  // The audio stops whenever the clock does: a pause, or the page going out of view.
  const { pause } = audio;
  useEffect(() => {
    if (!clockRunning) pause();
  }, [clockRunning, pause]);

  // Keep the position on the device (each second, and when playback stops) for a reload.
  const second = Math.floor(audio.time);
  useEffect(() => {
    setAudioPosition(section.part, second);
  }, [second, section.part, setAudioPosition]);
  useEffect(() => {
    if (!audio.playing) setAudioPosition(section.part, Math.round(audio.time * 10) / 10);
    // Only when playback stops; the per-second effect covers the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.playing]);

  const at = new Map(
    section.script.filter((l) => l.answer).map((l) => [l.answer!.question, l.start]),
  );
  const where = (_: unknown, n: number) => {
    const start = at.get(n);
    return start === undefined ? '' : `at ${formatAudioTime(start)} in the audioscript`;
  };

  const questions = (
    <section aria-label="Questions" className="flex flex-col gap-6">
      {section.context && <p className="m-0 text-[15px] text-navy-3">{section.context}</p>}
      {section.groups.map((group) => (
        <QuestionGroupView key={group.groupId} group={group} />
      ))}
    </section>
  );
  const script = (
    <WordSaver testId={session.testId}>
      <Audioscript
        part={section.part}
        script={section.script}
        time={audio.time}
        revealed={revealed}
        marks={session.scriptMarks}
        highlighter={highlighter}
        interactive={rules.interactiveScript}
        onSeek={(t) => {
          audio.seek(t);
          if (clockRunning) audio.play();
        }}
        onToggleMark={toggleScriptMark}
      />
    </WordSaver>
  );

  return (
    <AnswerSourceContext value={{ where }}>
      <div className="flex h-full flex-col">
        {/* The audioscript is the transcript (hidden until submit in a full mock, as in the exam). */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio ref={attach} src={section.audio} preload="auto" />
        <AudioPlayer
          part={section.part}
          durationSec={section.durationSec}
          audio={audio}
          rules={rules}
          finished={finished}
          scriptOpen={scriptOpen}
          onToggleScript={() => {
            setScriptChoice(!scriptOpen);
            setTab(scriptOpen ? 'questions' : 'script'); // on a phone, go straight to it
          }}
          highlighter={highlighter}
          onToggleHighlighter={() => setHighlighter(!highlighter)}
        />
        {phone ? (
          <>
            {scriptOpen && (
              <div className="grid shrink-0 grid-cols-2 gap-1 border-b border-border bg-surface p-2">
                {(['questions', 'script'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tab === t}
                    onClick={() => setTab(t)}
                    className={`min-h-11 rounded-[7px] text-sm font-semibold ${tab === t ? 'bg-navy text-on-navy' : 'bg-surface-muted text-navy'}`}
                  >
                    {t === 'questions' ? 'Questions' : 'Audioscript'}
                  </button>
                ))}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
              {scriptOpen && tab === 'script' ? script : questions}
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-[3] overflow-y-auto px-7 pt-[22px] pb-10">{questions}</div>
            {scriptOpen && (
              <aside
                aria-label="Audioscript"
                className="min-w-0 flex-[2] overflow-y-auto border-l border-border bg-surface px-5 pt-[18px] pb-9"
              >
                {script}
              </aside>
            )}
          </div>
        )}
      </div>
    </AnswerSourceContext>
  );
}
