import { useState } from 'react';
import { reviewQueue, reviewWord, type Grade } from '../../engine/srs';
import { vocabIdOf, type VocabWord } from '../../schema/vocab';

interface DailyReviewProps {
  words: VocabWord[];
  today: string;
  onAnswer: (word: VocabWord) => void;
}

/** Flashcards for today's due words: Show meaning, then Again or Got it (Vocabulary artboard). */
export function DailyReview({ words, today, onAnswer }: DailyReviewProps) {
  // The deck is fixed when the review starts, so answered words don't reshuffle it.
  const [deck, setDeck] = useState(() => reviewQueue(words, today).map((w) => vocabIdOf(w.word)));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [tally, setTally] = useState({ gotIt: 0, again: 0 });

  const byId = new Map(words.map((w) => [vocabIdOf(w.word), w]));
  const card = deck[index] ? byId.get(deck[index]) : undefined;
  const done = index >= deck.length;
  const answer = (grade: Grade) => {
    if (!card) return;
    onAnswer(reviewWord(card, grade, today));
    setTally((t) => ({ ...t, [grade]: t[grade] + 1 }));
    setIndex(index + 1);
    setFlipped(false);
  };
  const due = reviewQueue(words, today).length;

  return (
    <section
      aria-labelledby="review-h"
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="review-h" className="m-0 text-lg font-semibold text-navy">
          Daily review
        </h2>
        {deck.length > 0 && (
          <span className="font-mono text-sm text-muted">
            {Math.min(index + 1, deck.length)} of {deck.length}
          </span>
        )}
      </div>
      {deck.length > 0 && (
        <div
          role="progressbar"
          aria-label="Review progress"
          aria-valuemin={0}
          aria-valuemax={deck.length}
          aria-valuenow={Math.min(index, deck.length)}
          className="h-1.5 overflow-hidden rounded-pill bg-border"
        >
          <div
            className="h-full bg-navy"
            style={{ width: `${(Math.min(index, deck.length) / deck.length) * 100}%` }}
          />
        </div>
      )}
      {deck.length === 0 ? (
        <p className="m-0 text-sm text-muted">
          Nothing is due today. Words come back when they’re due.
        </p>
      ) : !done && card ? (
        <div className="flex flex-col gap-3">
          <div className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-card bg-canvas p-5 text-center">
            <span className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">
              {card.topic}
            </span>
            <span className="text-2xl font-semibold text-navy">{card.word}</span>
            {card.ipa && <span className="font-mono text-sm text-muted">{card.ipa}</span>}
            {flipped && (
              <div className="mt-2 flex flex-col gap-1">
                <p className="m-0 text-[15px] text-text">{card.meaning}</p>
                {card.bangla && (
                  <p lang="bn" className="m-0 font-bangla text-[15px] text-navy-3">
                    {card.bangla}
                  </p>
                )}
                {card.example && (
                  <p className="m-0 font-serif text-sm text-muted italic">{card.example}</p>
                )}
              </div>
            )}
          </div>
          {flipped ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => answer('again')}
                className="min-h-11 rounded-control border border-border-strong bg-surface text-sm font-semibold text-navy"
              >
                Again
              </button>
              <button
                type="button"
                onClick={() => answer('gotIt')}
                className="min-h-11 rounded-control bg-navy text-sm font-semibold text-on-navy"
              >
                Got it
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFlipped(true)}
              className="min-h-11 rounded-control bg-navy text-sm font-semibold text-on-navy"
            >
              Show meaning
            </button>
          )}
        </div>
      ) : (
        <div
          role="status"
          className="flex flex-col items-center gap-2 rounded-card bg-good p-5 text-center text-good-text"
        >
          <span className="font-semibold">Review done for today</span>
          <span className="text-sm">
            {tally.gotIt} remembered · {tally.again} to repeat tomorrow
          </span>
          {due > 0 && (
            <button
              type="button"
              onClick={() => {
                setDeck(reviewQueue(words, today).map((w) => vocabIdOf(w.word)));
                setIndex(0);
                setTally({ gotIt: 0, again: 0 });
              }}
              className="min-h-11 rounded-control border border-good-text bg-surface px-4 text-sm font-semibold"
            >
              Review {due} more
            </button>
          )}
        </div>
      )}
    </section>
  );
}
