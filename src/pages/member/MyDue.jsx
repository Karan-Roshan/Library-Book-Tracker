// What the member must bring back, and when.

import { useAuth } from '../../context/AuthContext.jsx'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatCurrency, formatDate } from '../../lib/format.js'
import { useMyLibrary } from '../../hooks/useMyLibrary.js'
import { Card, Empty, BorrowingCard, PageHead, Tile } from './MemberKit.jsx'

export default function MyDue() {
  const { user } = useAuth()
  const { locale, system } = usePreferences()
  const my = useMyLibrary()

  if (my.loading) return <p className="py-20 text-center text-sm text-ink-400">Reading your account…</p>

  const later = my.out.filter(
    (borrowing) => borrowing.status === 'Issued' && !my.dueSoon.some((row) => row.id === borrowing.id),
  )

  return (
    <div className="space-y-6">
      <PageHead title="Due & overdue" subtitle="Your upcoming deadlines, soonest first." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Due soon" value={my.dueSoon.length} tone={my.dueSoon.length ? 'warn' : undefined} />
        <Tile label="Overdue" value={my.overdue.length} tone={my.overdue.length ? 'bad' : undefined} />
        <Tile
          label="Fines accruing"
          value={formatCurrency(my.overdue.reduce((sum, borrowing) => sum + borrowing.fine, 0), locale, system)}
          tone={my.overdue.length ? 'bad' : 'good'}
        />
      </div>

      {my.overdue.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg text-red-700 dark:text-red-400">Overdue</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400">
            Charged at {formatCurrency(my.settings.finance.finePerDay, locale, system)} a day after a{' '}
            {my.settings.finance.graceDays}-day grace period, up to{' '}
            {formatCurrency(my.settings.finance.maxFine, locale, system)}.
          </p>
          {[...my.overdue]
            .sort((a, b) => b.daysOverdue - a.daysOverdue)
            .map((borrowing) => (
              <BorrowingCard key={borrowing.id} borrowing={borrowing} />
            ))}
        </section>
      )}

      {my.dueSoon.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg text-amber-700 dark:text-amber-400">Due soon</h2>
          {[...my.dueSoon]
            .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
            .map((borrowing) => (
              <BorrowingCard key={borrowing.id} borrowing={borrowing} />
            ))}
        </section>
      )}

      {later.length > 0 && (
        <Card title="Later" subtitle="Nothing to do yet.">
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {[...later]
              .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
              .map((borrowing) => (
                <li key={borrowing.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <span className="min-w-0 truncate text-sm text-ink-700 dark:text-ink-200">
                    {borrowing.bookTitle}
                  </span>
                  <span className="shrink-0 text-xs text-ink-400">
                    Due {formatDate(borrowing.dueAt, locale, system)} · {borrowing.daysRemaining} days
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      )}

      {my.out.length === 0 && (
        <Empty title="No deadlines">You have nothing out, so nothing is due.</Empty>
      )}
    </div>
  )
}
