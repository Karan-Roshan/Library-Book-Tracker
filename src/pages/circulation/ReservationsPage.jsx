// The queue for titles that are all out.

import { useMemo, useState } from 'react'
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx'
import Card from '../../components/dashboard/Card.jsx'
import StatCard from '../../components/dashboard/StatCard.jsx'
import RowMenu, { ACTION_CELL, ACTION_HEAD } from '../../components/dashboard/RowMenu.jsx'
import FilterMenu from '../../components/FilterMenu.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePageSize } from '../../hooks/useTablePrefs.js'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { useSettings } from '../../context/SettingsContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { formatDate } from '../../lib/format.js'
import { CAPABILITIES, can } from '../../lib/permissions.js'
import { downloadFile, toCSV } from '../../lib/csv.js'
import {
  RESERVATION_BADGE,
  RESERVATION_STATUSES,
  filterReservations,
} from '../../lib/circulation.js'
import * as circulation from '../../services/circulation.js'
import { useCirculation } from '../../hooks/useCirculation.js'
import {
  Action,
  Empty,
  Lookup,
  Pager,
  Pill,
  stripeFor,
} from '../../components/circulation/Shared.jsx'

const COLUMNS = ['Reservation', 'Member', 'Book', 'Placed', 'Queue', 'Collect by', 'Notified', 'Status']

const CSV_COLUMNS = [
  ['Reservation ID', (row) => row.code],
  ['Member Name', (row) => row.memberName],
  ['Member ID', (row) => row.memberNumber],
  ['Book ID', (row) => row.bookCode],
  ['Book Title', (row) => row.bookTitle],
  ['Reserved On', (row) => row.reservedAt?.slice(0, 10) ?? ''],
  ['Queue Position', (row) => row.position ?? ''],
  ['Expiry Date', (row) => row.expiresAt?.slice(0, 10) ?? ''],
  ['Notified', (row) => (row.notified ? 'Yes' : 'No')],
  ['Status', (row) => row.status],
]

const PAGE_SIZES = [25, 50, 100]

const CLEARED = {
  query: '',
  status: 'all',
  category: 'all',
  queue: 'all',
  notified: 'all',
  deadline: 'all',
  from: '',
  to: '',
}

export default function ReservationsPage() {
  const { user } = useAuth()
  const { locale } = usePreferences()
  const { settings } = useSettings()
  const desk = useCirculation()
  const { toast } = useToast()

  const [filters, setFilters] = useState(CLEARED)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePageSize()
  const [placing, setPlacing] = useState(false)
  const [member, setMember] = useState(null)
  const [book, setBook] = useState(null)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const mayExport = can(user, CAPABILITIES.EXPORT)
  const askFirst = settings.system.confirmDestructive

  const visible = useMemo(
    () => filterReservations(desk.reservations, { ...filters, now: desk.now }),
    [desk.reservations, filters, desk.now],
  )

  const categories = useMemo(
    () => [...new Set(desk.reservations.map((row) => row.book?.category).filter(Boolean))].sort(),
    [desk.reservations],
  )

  const set = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  const stats = useMemo(() => {
    const rows = desk.reservations
    return {
      waiting: rows.filter((row) => row.status === 'Waiting').length,
      ready: rows.filter((row) => row.status === 'Ready for Pickup').length,
      expired: rows.filter((row) => row.status === 'Expired').length,
      collected: rows.filter((row) => row.status === 'Collected').length,
    }
  }, [desk.reservations])

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = visible.slice((safePage - 1) * pageSize, safePage * pageSize)

  async function run(work, message) {
    setBusy(true)
    try {
      await work()
      await desk.refresh()
      toast(message)
    } finally {
      setBusy(false)
    }
  }

  async function placeHold() {
    await run(
      () => circulation.placeReservation({ book, member, staff: user.name }),
      `${member.name} added to the queue for ${book.title}.`,
    )
    setMember(null)
    setBook(null)
    setPlacing(false)
  }

  const destroy = (row) =>
    run(
      () => circulation.deleteReservation(row, { staff: user.name }),
      `Reservation ${row.code} deleted.`,
    )

  const actionsFor = (row) => {
    const actions = []
    if (row.status === 'Waiting') {
      actions.push({
        label: 'Mark ready & notify',
        onSelect: () =>
          run(
            () => circulation.markReady(row, { rules: desk.rules, staff: user.name }),
            `${row.memberName} notified that ${row.bookTitle} is ready.`,
          ),
      })
    }
    if (['Waiting', 'Ready for Pickup'].includes(row.status)) {
      actions.push({
        label: 'Mark collected',
        onSelect: () =>
          run(
            () => circulation.collectReservation(row, { staff: user.name }),
            `${row.bookTitle} collected by ${row.memberName}.`,
          ),
      })
      actions.push({
        label: 'Cancel reservation',
        tone: 'danger',
        onSelect: () =>
          run(
            () => circulation.cancelReservation(row, { staff: user.name, reason: 'Cancelled at the desk' }),
            `Reservation ${row.code} cancelled.`,
          ),
      })
    }

    actions.push({
      label: 'Delete reservation',
      tone: 'danger',
      onSelect: () => (askFirst ? setDeleting(row) : destroy(row)),
    })

    return actions
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="mt-1 font-display text-2xl font-bold text-ink-900 dark:text-white">
            Reservations
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Holds on titles that are all out. When a copy comes back, the front of the queue is
            called automatically.
          </p>
        </div>

        <div className="flex gap-3">
          {mayExport && (
            <Action
              tone="ink"
              onClick={() => downloadFile('reservations.csv', toCSV(visible, CSV_COLUMNS))}
            >
              Export CSV
            </Action>
          )}
          <Action onClick={() => setPlacing((open) => !open)}>
            {placing ? 'Close' : 'Place a hold'}
          </Action>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Waiting" value={stats.waiting} />
        <StatCard label="Ready for pickup" value={stats.ready} />
        <StatCard label="Expired" value={stats.expired} />
        <StatCard label="Collected" value={stats.collected} />
      </div>

      {placing && (
        <Card title="Place a hold">
          <div className="space-y-5 p-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <Lookup
                label="Member"
                required
                autoFocus
                placeholder="Card number, name or email"
                items={desk.members}
                value={member}
                onSelect={setMember}
                search={(row) => [row.membershipNumber, row.name, row.email]}
                describe={(row) => `${row.name} · ${row.membershipNumber}`}
              />
              <Lookup
                label="Book"
                required
                placeholder="Title, book ID or author"
                items={desk.books}
                value={book}
                onSelect={setBook}
                search={(row) => [row.title, row.code, row.author, row.isbn]}
                describe={(row) => `${row.title} · ${row.code} · ${row.available} available`}
              />
            </div>

            {book && book.available > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                {book.available} copies are on the shelf right now — this could be issued instead of
                reserved.
              </p>
            )}

            <div className="flex justify-end gap-3 border-t border-ink-100 pt-5 dark:border-ink-800">
              <Action tone="ink" onClick={() => setPlacing(false)}>
                Cancel
              </Action>
              <Action onClick={placeHold} disabled={busy || !member || !book}>
                {busy ? 'Placing…' : 'Place hold'}
              </Action>
            </div>
          </div>
        </Card>
      )}

      <Card padded={false}>

        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-auto">
            <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Filters</p>
            <p className="text-xs text-ink-400">{visible.length} reservations</p>
          </div>

          <input
            type="search"
            value={filters.query}
            onChange={(event) => set('query', event.target.value)}
            placeholder="Search reservation, member, card number or title…"
            aria-label="Search reservations"
            className="h-9 w-full min-w-0 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brass-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white sm:w-72"
          />

          <FilterMenu
            values={filters}
            onChange={set}
            cleared={CLEARED}
            fields={[
              {
                key: 'status',
                label: 'Status',
                options: [
                  { value: 'all', label: 'All statuses' },
                  ...RESERVATION_STATUSES.map((option) => ({ value: option, label: option })),
                ],
              },
              {
                key: 'queue',
                label: 'Place in queue',
                options: [
                  { value: 'all', label: 'Anywhere in the queue' },
                  { value: 'front', label: 'Front of the queue' },
                  { value: 'behind', label: 'Waiting behind someone' },
                  { value: 'none', label: 'No longer queuing' },
                ],
              },
              {
                key: 'notified',
                label: 'Collection notice',
                options: [
                  { value: 'all', label: 'Sent or not' },
                  { value: 'yes', label: 'Member has been told' },
                  { value: 'no', label: 'Not yet told' },
                ],
              },
              {
                key: 'deadline',
                label: 'Collect by',
                options: [
                  { value: 'all', label: 'Any deadline' },
                  { value: 'today', label: 'Today' },
                  { value: 'soon', label: 'Within 2 days' },
                  { value: 'lapsed', label: 'Deadline passed' },
                ],
              },
              {
                key: 'category',
                label: 'Category',
                options: [
                  { value: 'all', label: 'All categories' },
                  ...categories.map((name) => ({ value: name, label: name })),
                ],
              },
              { key: 'from', label: 'Placed on or after', type: 'date' },
              { key: 'to', label: 'Placed on or before', type: 'date' },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[62rem] border-collapse text-sm">
            <thead>
              <tr className="bg-ink-900 text-left text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-white dark:bg-ink-950">
                {COLUMNS.map((column) => (
                  <th key={column} className="px-4 py-3">
                    {column}
                  </th>
                ))}
                <th className={ACTION_HEAD}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((row, index) => (
                <tr
                  key={row.id}
                  className={`group border-b border-ink-100 transition-colors hover:bg-brass-50 dark:border-ink-800 dark:hover:bg-ink-800 ${stripeFor(index)}`}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-ink-800 dark:text-ink-100">
                    {row.code}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-600 dark:text-ink-300">
                    {row.memberName}
                    <span className="block text-xs text-ink-400">{row.memberNumber}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-600 dark:text-ink-300">
                    {row.bookTitle}
                    <span className="block text-xs text-ink-400">{row.bookCode}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                    {formatDate(row.reservedAt, locale)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                    {row.position ? `#${row.position}` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                    {row.expiresAt ? formatDate(row.expiresAt, locale) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                    {row.notified ? 'Yes' : 'No'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Pill tone={RESERVATION_BADGE[row.status]}>{row.status}</Pill>
                  </td>
                  <td className={ACTION_CELL}>
                    <RowMenu label={`Actions for ${row.code}`} items={actionsFor(row)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {visible.length === 0 && <Empty>No reservations match this search.</Empty>}
        </div>

        <Pager
          page={safePage}
          totalPages={totalPages}
          total={visible.length}
          first={visible.length === 0 ? 0 : (safePage - 1) * pageSize + 1}
          last={Math.min(safePage * pageSize, visible.length)}
          pageSize={pageSize}
          sizes={PAGE_SIZES}
          onPage={setPage}
          onSize={setPageSize}
        />
      </Card>

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-reservation-title"
            className="animate-rise w-full max-w-md rounded-xl border border-ink-100 bg-white p-5 shadow-xl dark:border-ink-800 dark:bg-ink-900"
          >
            <h2
              id="delete-reservation-title"
              className="font-display text-lg text-ink-900 dark:text-white"
            >
              Delete reservation {deleting.code}?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
              {deleting.memberName}&rsquo;s hold on {deleting.bookTitle} goes from every
              screen, the member&rsquo;s included, and the queue behind it moves up. Cancelling
              instead keeps the record. This cannot be undone.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const row = deleting
                  setDeleting(null)
                  await destroy(row)
                }}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:bg-red-300"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
