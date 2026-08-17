// What is wrong right now, each line clickable.

import { Link } from 'react-router-dom'

const TONES = {
  alert: 'text-red-600 dark:text-red-400',
  warn: 'text-amber-700 dark:text-amber-400',
  brass: 'text-brass-700 dark:text-brass-300',
}

export default function NeedsAttention({ items }) {
  const live = items.filter((item) => item.count > 0)

  if (live.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-ink-400">
        Nothing is waiting. No overdue books, no repairs on the bench, nothing to collect.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-ink-100 dark:divide-ink-800">
      {live.map((item) => (
        <li key={item.label}>
          <Link
            to={item.to}
            className="group flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-brass-50 dark:hover:bg-ink-800"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink-800 dark:text-ink-100">
                {item.label}
              </span>
              <span className="block text-xs text-ink-400">{item.hint}</span>
            </span>

            <span className="flex shrink-0 items-center gap-2">
              <span className={`text-lg font-semibold tabular-nums ${TONES[item.tone] ?? 'text-ink-700 dark:text-ink-200'}`}>
                {item.display ?? item.count}
              </span>
              <svg
                viewBox="0 0 20 20"
                className="h-4 w-4 text-ink-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink-500"
                fill="none"
                aria-hidden="true"
              >
                <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
