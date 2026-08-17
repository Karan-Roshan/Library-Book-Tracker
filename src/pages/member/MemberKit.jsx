// The pieces the member screens share: cards, tiles, headings.

import { Link } from 'react-router-dom'
import Card from '../../components/dashboard/Card.jsx'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatCurrency, formatDate } from '../../lib/format.js'
import { BORROWING_BADGE } from '../../lib/circulation.js'
import { Pill } from '../../components/circulation/Shared.jsx'

export function Tile({ label, value, hint, to, tone }) {
  const tones = {
    bad: 'text-red-600 dark:text-red-400',
    warn: 'text-amber-700 dark:text-amber-400',
    good: 'text-emerald-700 dark:text-emerald-400',
  }

  const body = (
    <>
      <p className="text-sm font-bold leading-snug text-ink-600 dark:text-ink-300">{label}</p>
      <p className={`mt-2 text-3xl font-semibold leading-none ${tones[tone] ?? 'text-ink-900 dark:text-white'}`}>
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-ink-400">{hint}</p>}
    </>
  )

  const shell =
    'rounded-xl border border-ink-100 bg-white p-4 shadow-sm dark:border-ink-800 dark:bg-ink-900'

  return to ? (
    <Link to={to} className={`${shell} block transition-shadow hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  )
}

export function Spine({ book, className = '' }) {
  const hue = [...(book?.title ?? '')].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 5
  const shades = [
    'from-brass-500 to-brass-700',
    'from-ink-500 to-ink-700',
    'from-emerald-600 to-emerald-800',
    'from-sky-600 to-sky-800',
    'from-red-500 to-red-700',
  ]

  return (
    <div
      aria-hidden="true"
      className={`flex h-20 w-14 shrink-0 items-end rounded-sm bg-gradient-to-br ${shades[hue]} p-1.5 shadow-sm ${className}`}
    >
      <span className="line-clamp-3 text-[0.55rem] font-semibold leading-tight text-white/90">
        {book?.title}
      </span>
    </div>
  )
}

export function BorrowingCard({ borrowing, children }) {
  const { locale, system } = usePreferences()

  const urgency =
    borrowing.status === 'Overdue'
      ? { tone: 'text-red-600 dark:text-red-400', text: `${borrowing.daysOverdue} days overdue` }
      : borrowing.daysRemaining <= 2
        ? {
            tone: 'text-amber-700 dark:text-amber-400',
            text:
              borrowing.daysRemaining === 0
                ? 'Due today'
                : `Due in ${borrowing.daysRemaining} day${borrowing.daysRemaining === 1 ? '' : 's'}`,
          }
        : {
            tone: 'text-ink-500 dark:text-ink-400',
            text: `${borrowing.daysRemaining} days remaining`,
          }

  return (
    <div className="flex gap-4 rounded-xl border border-ink-100 bg-white p-4 shadow-sm dark:border-ink-800 dark:bg-ink-900">
      <Spine book={borrowing.book} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-display text-base text-ink-900 dark:text-white">
              {borrowing.bookTitle}
            </p>
            <p className="truncate text-sm text-ink-500 dark:text-ink-400">
              {borrowing.book?.author ?? '—'}
            </p>
          </div>
          <Pill tone={BORROWING_BADGE[borrowing.status]}>{borrowing.status}</Pill>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          {[
            ['Book ID', borrowing.book?.code],
            ['Issued', formatDate(borrowing.issuedAt, locale, system)],
            ['Due', formatDate(borrowing.dueAt, locale, system)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-ink-400">{label}</dt>
              <dd className="text-ink-700 dark:text-ink-200">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className={`text-sm font-semibold ${urgency.tone}`}>
            {urgency.text}
            {borrowing.status === 'Overdue' && borrowing.fine > 0 && (
              <span className="font-normal"> · fine {formatCurrency(borrowing.fine, locale, system)}</span>
            )}
          </p>

          {children}
        </div>
      </div>
    </div>
  )
}

export function Availability({ book, waiting = 0 }) {
  if (book.available <= 0) {
    return (
      <span className="text-sm font-medium text-red-600 dark:text-red-400">
        Currently unavailable
        {waiting > 0 && (
          <span className="font-normal text-ink-400"> · {waiting} waiting</span>
        )}
      </span>
    )
  }

  const tone =
    book.available === book.copies
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-amber-700 dark:text-amber-400'

  return (
    <span className={`text-sm font-medium ${tone}`}>
      {book.available} of {book.copies} copies available
    </span>
  )
}

export function Empty({ title, children, action }) {
  return (
    <Card>
      <div className="px-4 py-12 text-center">
        <p className="font-display text-base text-ink-700 dark:text-ink-200">{title}</p>
        {children && <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-400">{children}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </Card>
  )
}

export function PageHead({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export { Card }
