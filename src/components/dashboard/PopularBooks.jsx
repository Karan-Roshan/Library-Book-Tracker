// The titles borrowed most often.

import { formatNumber } from '../../lib/format.js'

export default function PopularBooks({ books, locale }) {
  const max = Math.max(1, ...books.map((book) => book.borrows))

  return (
    <ol className="space-y-3.5">
      {books.map((book, index) => (
        <li key={book.id} className="flex items-center gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-50 text-xs font-semibold tabular-nums text-ink-500 dark:bg-ink-800 dark:text-ink-300">
            {index + 1}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900 dark:text-white" title={book.title}>
              {book.title}
            </p>
            <div className="mt-1.5 flex items-center gap-2">

              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                <span
                  className="block h-full rounded-full bg-[var(--viz-series-1)]"
                  style={{ width: `${(book.borrows / max) * 100}%` }}
                />
              </span>
              <span className="text-xs tabular-nums text-ink-400">
                {formatNumber(book.borrows, locale)} borrowings
              </span>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${
              book.availableCopies <= 2
                ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
            }`}
            title="Copies available right now"
          >
            {formatNumber(book.availableCopies, locale)} left
          </span>
        </li>
      ))}
    </ol>
  )
}
