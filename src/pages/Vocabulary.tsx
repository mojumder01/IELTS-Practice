import { BookmarkPlus, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageSkeleton } from '../components/PageSkeleton';
import { card } from '../components/progress/styles';
import { DailyReview } from '../components/vocab/DailyReview';
import { WordForm } from '../components/vocab/WordForm';
import { WordRow } from '../components/vocab/WordRow';
import { masteredByTopic, setMastered, vocabStats } from '../engine/srs';
import { testName } from '../lib/links';
import { useServices } from '../lib/services';
import { useVocab } from '../lib/useVocab';
import { vocabIdOf, type VocabStatus } from '../schema/vocab';

const STATUSES: { id: VocabStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'learning', label: 'Learning' },
  { id: 'mastered', label: 'Mastered' },
];

/** "/vocabulary" — saved words with Bangla, filters and search, daily review (Vocabulary artboard). */
export function Vocabulary() {
  const services = useServices();
  const { state, save, saveError, today } = useVocab();
  const [topic, setTopic] = useState('All');
  const [status, setStatus] = useState<VocabStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [testNames, setTestNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    services
      .listTests()
      .then(
        (tests) => !cancelled && setTestNames(new Map(tests.map((t) => [t.testId, testName(t)]))),
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [services]);

  if (state.status === 'loading') return <PageSkeleton label="Loading your words…" />;
  if (state.status === 'error') {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-4 py-9 sm:px-8">
        <p role="alert" className="m-0 text-[15px] text-warn-text">
          {state.message}
        </p>
      </main>
    );
  }

  const words = state.words;
  const stats = vocabStats(words, today);
  const topics = ['All', ...[...new Set(words.map((w) => w.topic))].sort()];
  const q = query.trim().toLowerCase();
  const shown = words
    .filter(
      (w) =>
        (topic === 'All' || w.topic === topic) &&
        (status === 'all' || w.status === status) &&
        (!q ||
          w.word.toLowerCase().includes(q) ||
          w.meaning.toLowerCase().includes(q) ||
          w.bangla.includes(query.trim())),
    )
    .sort((a, b) => a.word.localeCompare(b.word));
  const saved = new Set(words.map((w) => vocabIdOf(w.word)));
  const statTiles = [
    { label: 'Saved', value: stats.saved },
    { label: 'Mastered', value: stats.mastered },
    { label: 'Learning', value: stats.learning },
    { label: 'New', value: stats.new },
    { label: 'Due today', value: stats.due },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-9 pb-12 sm:px-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[30px] leading-tight font-semibold text-navy">Vocabulary</h1>
          <p className="m-0 text-[15px] text-muted">
            Words for band 7, grouped by topic, with Bangla meanings and examples.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="#review"
            className="inline-flex min-h-11 items-center rounded-control bg-navy px-4 text-sm font-semibold text-on-navy no-underline hover:text-on-navy"
          >
            Review {stats.due} due {stats.due === 1 ? 'word' : 'words'}
          </a>
          <button
            type="button"
            aria-expanded={adding}
            onClick={() => setAdding(!adding)}
            className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold text-navy"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add word
          </button>
        </div>
      </section>
      {saveError && (
        <p role="alert" className="m-0 rounded-control bg-warn px-3 py-2 text-sm text-warn-text">
          {saveError}
        </p>
      )}
      {adding && (
        <section aria-label="Add a word" className={card}>
          <WordForm
            today={today}
            isSaved={(w) => saved.has(vocabIdOf(w))}
            onSave={(w) => {
              void save(w);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </section>
      )}

      <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {statTiles.map((t) => (
          <div
            key={t.label}
            className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4"
          >
            <dt className="text-[13px] text-muted">{t.label}</dt>
            <dd className="m-0 font-mono text-2xl font-semibold text-navy">{t.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-5 lg:grid-cols-[1.8fr_1fr]">
        <section aria-label="Word list" className="flex flex-col gap-3">
          <div role="group" aria-label="Topic" className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={topic === t}
                onClick={() => setTopic(t)}
                className={`min-h-11 rounded-pill border px-4 text-sm font-semibold ${
                  topic === t
                    ? 'border-navy bg-navy text-on-navy'
                    : 'border-border-strong bg-surface text-navy'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div
              role="group"
              aria-label="Status"
              className="flex gap-1 rounded-pill bg-surface-muted p-1"
            >
              {STATUSES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={status === s.id}
                  onClick={() => setStatus(s.id)}
                  className={`min-h-10 rounded-pill px-3.5 text-sm font-semibold ${
                    status === s.id ? 'bg-surface text-navy shadow-sm' : 'text-navy-3'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex w-full flex-col gap-1 sm:w-[260px]">
              <label htmlFor="vocab-search" className="text-sm font-semibold text-navy">
                Search words
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                />
                <input
                  id="vocab-search"
                  type="search"
                  placeholder="Search word or meaning"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="min-h-11 w-full rounded-control border border-border-strong bg-surface pr-3 pl-9 text-sm"
                />
              </div>
            </div>
          </div>
          <p role="status" className="m-0 text-sm text-muted">
            Showing {shown.length} {shown.length === 1 ? 'word' : 'words'}
            {topic !== 'All' && ` in ${topic}`}
          </p>
          <ul
            aria-label="Words"
            className="m-0 list-none overflow-hidden rounded-card border border-border bg-surface p-0"
          >
            {shown.map((w) => {
              const id = vocabIdOf(w.word);
              return (
                <WordRow
                  key={id}
                  word={w}
                  open={open === id}
                  onToggle={() => setOpen(open === id ? null : id)}
                  onToggleMastered={() => void save(setMastered(w, w.status !== 'mastered', today))}
                  sourceName={
                    w.source === 'manual'
                      ? null
                      : (testNames.get(w.source.testId) ?? w.source.testId)
                  }
                />
              );
            })}
            {shown.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted">
                {words.length === 0
                  ? 'No words yet. Add one, or double-tap a word in a Reading passage or Listening transcript.'
                  : 'No words match. Try another topic or clear the search.'}
              </li>
            )}
          </ul>
        </section>

        <aside id="review" aria-label="Daily review and progress" className="flex flex-col gap-4">
          <DailyReview words={words} today={today} onAnswer={(w) => void save(w)} />
          <section
            aria-labelledby="mastery-h"
            className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5"
          >
            <h2 id="mastery-h" className="m-0 text-lg font-semibold text-navy">
              Mastered by topic
            </h2>
            {masteredByTopic(words).map((t) => (
              <div key={t.topic} className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-3 text-sm">
                  <span>{t.topic}</span>
                  <span className="font-mono font-semibold text-navy">
                    {t.mastered} / {t.total}
                  </span>
                </div>
                <div aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-border">
                  <div
                    className="h-full bg-good-text"
                    style={{ width: `${(t.mastered / t.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </section>
          <section className="flex items-start gap-3 rounded-card bg-now-playing p-4 text-sm text-navy">
            <BookmarkPlus aria-hidden="true" className="size-5 shrink-0 text-answered" />
            <p className="m-0">
              Double-tap any word in a Reading passage or Listening transcript to save it here with
              its sentence.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
