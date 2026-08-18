// A member's own front page.

import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatCurrency, formatDate, greeting } from '../../lib/format.js'
import { isUnread } from '../../lib/messages.js'
import { useMyLibrary } from '../../hooks/useMyLibrary.js'
import { Card, Empty, BorrowingCard, PageHead, Tile } from './MemberKit.jsx'

export default function MemberDashboard() {
  const { user } = useAuth()
  const { locale, system } = usePreferences()
  const my = useMyLibrary()

  if (my.loading) return <p className="py-20 text-center text-sm text-ink-400">Reading your account…</p>

  const unread = my.messages.filter((message) => isUnread(message, user.id)).length
  const expired = my.me?.expiresAt && new Date(my.me.expiresAt) < my.now

  return (
    <div className="space-y-6">
      <PageHead
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        subtitle={
          my.me
            ? `${my.me.membershipNumber} · ${my.me.type} member · ${my.remaining} of ${my.limit} borrowing slots free`
            : 'Your membership record could not be found.'
        }
      />

      {expired && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          <strong>Your membership expired on {formatDate(my.me.expiresAt, locale, system)}.</strong>{' '}
          You cannot borrow again until the library renews it — bring your card to the desk.
        </div>
      )}

      {my.ready.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-500/40 dark:bg-emerald-500/10">
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">
            {my.ready.length === 1
              ? `${my.ready[0].bookTitle} is ready to collect`
              : `${my.ready.length} reserved books are ready to collect`}
          </p>
          <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
            {my.ready.length === 1 && my.ready[0].expiresAt
              ? `Please collect it before ${formatDate(my.ready[0].expiresAt, locale, system)}.`
              : 'Collect them from the desk before the hold lapses.'}{' '}
            <Link to="/my/reservations" className="font-semibold underline">
              View reservations
            </Link>
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Tile label="My books" value={my.out.length} hint={`${my.remaining} slots free`} to="/my/books" />
        <Tile
          label="Due soon"
          value={my.dueSoon.length}
          tone={my.dueSoon.length ? 'warn' : undefined}
          to="/my/due"
        />
        <Tile
          label="Overdue"
          value={my.overdue.length}
          tone={my.overdue.length ? 'bad' : undefined}
          to="/my/due"
        />
        <Tile
          label="My fines"
          value={formatCurrency(my.owed, locale, system)}
          tone={my.owed > 0 ? 'bad' : 'good'}
          to="/my/fines"
        />
        <Tile
          label="Reservations"
          value={my.activeReservations.length}
          hint={my.ready.length ? `${my.ready.length} ready` : undefined}
          to="/my/reservations"
        />
        <Tile
          label="Notifications"
          value={unread}
          hint={unread ? 'unread' : 'all read'}
          to="/my/notifications"
        />
      </div>

      <Card title="Borrowing" subtitle="How many books you may hold at once">
        <dl className="grid gap-4 sm:grid-cols-3">
          {[
            ['Borrowing limit', my.limit],
            ['Currently borrowed', my.out.length],
            ['Remaining capacity', my.remaining],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-ink-400">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold leading-none text-ink-900 dark:text-white">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card
        title="Currently issued"
        subtitle={`${my.out.length} of ${my.limit} allowed`}
        action={
          <Link
            to="/my/books"
            className="shrink-0 text-sm font-semibold text-brass-700 hover:underline dark:text-brass-300"
          >
            See all
          </Link>
        }
      >
        <div className="space-y-3 p-5">
          {my.out.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">
              Nothing out at the moment.{' '}
              <Link to="/my/browse" className="font-semibold text-brass-700 dark:text-brass-300">
                Browse the catalogue
              </Link>
              .
            </p>
          ) : (
            [...my.out]
              .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
              .slice(0, 3)
              .map((borrowing) => <BorrowingCard key={borrowing.id} borrowing={borrowing} />)
          )}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Recently returned">
          {my.history.filter((borrowing) => borrowing.returnedAt).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-400">No returns yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {my.history
                .filter((borrowing) => borrowing.returnedAt)
                .slice(0, 5)
                .map((borrowing) => (
                  <li key={borrowing.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <span className="min-w-0 truncate text-sm text-ink-700 dark:text-ink-200">
                      {borrowing.bookTitle}
                    </span>
                    <span className="shrink-0 text-xs text-ink-400">
                      {formatDate(borrowing.returnedAt, locale, system)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card title="Latest notices">
          {my.messages.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-400">Nothing from the library yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {my.messages.slice(0, 5).map((message) => (
                <li key={message.id} className="px-5 py-3">
                  <p className="flex items-center gap-2 text-sm text-ink-800 dark:text-ink-100">
                    {isUnread(message, user.id) && (
                      <span
                        aria-label="Unread"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-brass-500"
                      />
                    )}
                    <span className="truncate font-medium">{message.subject}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {formatDate(message.sentAt, locale, system)} · {message.fromName}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
