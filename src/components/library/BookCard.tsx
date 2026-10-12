import { Link } from 'react-router';
import { bookHref, coverTitle } from '../../lib/links';
import { BookCover } from './BookCover';

interface BookCardProps {
  book: string;
  tests: number;
  /** Modules with a band, out of tests × 4. */
  done: number;
  started: boolean;
}

/** One book in the library: its cover, and how much of it is done. Opens the book's tests. */
export function BookCard({ book, tests, done, started }: BookCardProps) {
  const total = tests * 4;
  const status = done === total ? 'Completed' : started ? 'In progress' : null;
  const number = Number.parseInt(coverTitle(book).number, 10);

  return (
    <article aria-label={book} className="flex min-w-0 flex-col gap-2.5">
      <Link
        to={bookHref(book)}
        aria-label={`Open ${book}`}
        className="group block rounded-r-[16px] no-underline"
      >
        <BookCover
          book={book}
          colour={Number.isNaN(number) ? 1 : number}
          label={`${tests} ${tests === 1 ? 'test' : 'tests'}`}
          status={status}
          action="Open"
        />
      </Link>
      <h2 className="m-0 text-[15px] leading-snug font-semibold text-navy">{book}</h2>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] text-muted">
          {done} of {total} modules done
        </span>
        <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-pill bg-border">
          <span
            className="block h-full rounded-pill bg-good-text"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </span>
      </div>
    </article>
  );
}
