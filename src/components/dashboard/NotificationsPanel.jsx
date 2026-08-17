// Recent notifications, in the corner of the dashboard.

import { Link } from 'react-router-dom'

const TONES = {
  critical: {
    dot: 'bg-red-500',
    ring: 'border-red-200 dark:border-red-500/30',
    icon: 'M10 6v4.5m0 3h.01M10 2.5l7.5 13H2.5z',
  },
  serious: {
    dot: 'bg-orange-500',
    ring: 'border-orange-200 dark:border-orange-500/30',
    icon: 'M10 6v4.5m0 3h.01M10 2.5l7.5 13H2.5z',
  },
  warning: {
    dot: 'bg-amber-500',
    ring: 'border-amber-200 dark:border-amber-500/30',
    icon: 'M10 5.5v5M10 3a7 7 0 100 14 7 7 0 000-14zm0 11.5h.01',
  },
  good: {
    dot: 'bg-emerald-600',
    ring: 'border-emerald-200 dark:border-emerald-500/30',
    icon: 'M10 3a7 7 0 100 14 7 7 0 000-14zm-3 7l2 2 4-4',
  },
}

export default function NotificationsPanel({ messages = [] }) {
  return (
    <ul className="space-y-2.5">

      {messages.map((message) => (
        <li key={message.id}>
          <Link
            to="/notifications"
            className="flex items-start gap-3 rounded-lg border border-brass-200 px-3 py-2.5 transition-colors hover:bg-brass-50 dark:border-brass-500/30 dark:hover:bg-ink-800"
          >
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brass-500" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink-900 dark:text-white">
                {message.subject || '(no subject)'}
              </span>
              <span className="block truncate text-xs text-ink-400">From {message.fromName}</span>
            </span>
          </Link>
        </li>
      ))}
      {messages.length === 0 && (
        <li className="px-1 py-8 text-center text-sm text-ink-400">
          Nothing from anyone yet. Notices the library sends you appear here.
        </li>
      )}
    </ul>
  )
}
