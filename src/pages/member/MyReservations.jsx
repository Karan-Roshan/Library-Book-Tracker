// Titles the member is queuing for.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatDate } from '../../lib/format.js'
import { RESERVATION_BADGE } from '../../lib/circulation.js'
import * as circulation from '../../services/circulation.js'
import { useMyLibrary } from '../../hooks/useMyLibrary.js'
import { Pill } from '../../components/circulation/Shared.jsx'
import { Card, Empty, PageHead, Spine, Tile } from './MemberKit.jsx'

export default function MyReservations() {
  const { locale, system } = usePreferences()
  const my = useMyLibrary()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  async function cancel(row) {
    setBusy(true)
    try {
      await circulation.cancelReservation(row, {
        reason: 'Cancelled by the member',
        staff: `${my.me.name} (member)`,
      })
      await my.refresh()
      setNotice(`Your reservation for ${row.bookTitle} has been cancelled.`)
    } finally {
      setBusy(false)
    }
  }

  if (my.loading) return <p className="py-20 text-center text-sm text-ink-400">Reading your account…</p>

  const past = my.reservations.filter(
    (row) => !['Waiting', 'Ready for Pickup'].includes(row.status),
  )

  return (
    <div className="space-y-6">
      <PageHead
        title="My reservations"
        subtitle="Books you have asked the library to hold for you."
        action={
          <Link
            to="/my/browse"
            className="rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500"
          >
            Reserve a book
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile
          label="Ready to collect"
          value={my.ready.length}
          tone={my.ready.length ? 'good' : undefined}
        />
        <Tile label="Waiting" value={my.activeReservations.length - my.ready.length} />
        <Tile label="Past requests" value={past.length} />
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {my.activeReservations.length === 0 ? (
        <Empty
          title="No active reservations"
          action={
            <Link
              to="/my/browse"
              className="inline-block rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500"
            >
              Browse the catalogue
            </Link>
          }
        >
          If a book you want is all out, reserve it and the library will call you when a copy comes
          back.
        </Empty>
      ) : (
        <div className="space-y-3">
          {my.activeReservations.map((row) => (
            <div
              key={row.id}
              className={`flex gap-4 rounded-xl border p-4 shadow-sm ${
                row.status === 'Ready for Pickup'
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10'
                  : 'border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900'
              }`}
            >
              <Spine book={row.book} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-base text-ink-900 dark:text-white">
                      {row.bookTitle}
                    </p>
                    <p className="truncate text-sm text-ink-500 dark:text-ink-400">
                      {row.book?.author ?? '—'} · {row.code}
                    </p>
                  </div>
                  <Pill tone={RESERVATION_BADGE[row.status]}>{row.status}</Pill>
                </div>

                <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">
                  {row.status === 'Ready for Pickup' ? (
                    <>
                      <strong className="text-emerald-800 dark:text-emerald-300">
                        Ready at the desk.
                      </strong>{' '}
                      {row.expiresAt &&
                        `Please collect it before ${formatDate(row.expiresAt, locale, system)}, after which it goes to the next person waiting.`}
                    </>
                  ) : (
                    <>
                      You are <strong>#{row.position}</strong> in the queue. Requested{' '}
                      {formatDate(row.reservedAt, locale, system)}.
                    </>
                  )}
                </p>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => cancel(row)}
                    disabled={busy}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-500/10"
                  >
                    Cancel reservation
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <Card title="Past requests" padded={false}>
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {past.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="min-w-0 truncate text-sm text-ink-700 dark:text-ink-200">
                  {row.bookTitle}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-ink-400">
                    {formatDate(row.reservedAt, locale, system)}
                  </span>
                  <Pill tone={RESERVATION_BADGE[row.status]}>{row.status}</Pill>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
