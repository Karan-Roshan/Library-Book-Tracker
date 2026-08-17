// Everything past its due date, worst first.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx'
import Card from '../../components/dashboard/Card.jsx'
import StatCard from '../../components/dashboard/StatCard.jsx'
import RowMenu, { ACTION_CELL, ACTION_HEAD } from '../../components/dashboard/RowMenu.jsx'
import FilterMenu from '../../components/FilterMenu.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePageSize } from '../../hooks/useTablePrefs.js'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatCurrency, formatDate } from '../../lib/format.js'
import { CAPABILITIES, can } from '../../lib/permissions.js'
import { downloadFile, toCSV } from '../../lib/csv.js'
import {
  LOST_REASONS,
  OVERDUE_BANDS,
  filterOverdue,
} from '../../lib/circulation.js'
import * as circulation from '../../services/circulation.js'
import { useCirculation } from '../../hooks/useCirculation.js'
import {
  Action,
  Empty,
  Pager,
  SELECT,
  SELECT_ARROW,
  stripeFor,
} from '../../components/circulation/Shared.jsx'

const COLUMNS = [
  'Transaction',
  'Member',
  'Book',
  'Issued',
  'Due',
  'Days Overdue',
  'Fine',
  'Reminded',
]

const CSV_COLUMNS = [
  ['Transaction', (row) => row.transaction],
  ['Member Name', (row) => row.memberName],
  ['Member ID', (row) => row.memberNumber],
  ['Phone', (row) => row.member?.phone ?? ''],
  ['Email', (row) => row.member?.email ?? ''],
  ['Book ID', (row) => row.book?.code ?? ''],
  ['Book Title', (row) => row.bookTitle],
  ['Issue Date', (row) => row.issuedAt?.slice(0, 10) ?? ''],
  ['Due Date', (row) => row.dueAt?.slice(0, 10) ?? ''],
  ['Days Overdue', (row) => row.daysOverdue],
  ['Fine', (row) => row.fine],
  ['Reminder Sent', (row) => (row.remindedAt ? row.remindedAt.slice(0, 10) : 'No')],
]

const PAGE_SIZES = [25, 50, 100]

const CLEARED = {
  query: '',
  band: 'all',
  reminded: 'all',
  fine: 'all',
  renewals: 'all',
  contact: 'all',
  category: 'all',
  from: '',
  to: '',
}

export default function OverduePage() {
  const { user } = useAuth()
  const { locale } = usePreferences()
  const desk = useCirculation()
  const navigate = useNavigate()

  const [filters, setFilters] = useState(CLEARED)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePageSize()
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [losing, setLosing] = useState(null)
  const [lostReason, setLostReason] = useState(LOST_REASONS[0])

  const mayExport = can(user, CAPABILITIES.EXPORT)

  const overdue = useMemo(
    () => desk.borrowings.filter((borrowing) => borrowing.status === 'Overdue'),
    [desk.borrowings],
  )

  const visible = useMemo(
    () =>
      filterOverdue(overdue, { ...filters, rules: desk.rules }).sort(
        (a, b) => b.daysOverdue - a.daysOverdue,
      ),
    [overdue, filters, desk.rules],
  )

  const categories = useMemo(
    () => [...new Set(overdue.map((row) => row.book?.category).filter(Boolean))].sort(),
    [overdue],
  )

  const set = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  const totals = useMemo(
    () => ({
      count: overdue.length,
      fines: overdue.reduce((sum, row) => sum + row.fine, 0),
      longest: overdue.reduce((worst, row) => Math.max(worst, row.daysOverdue), 0),
      members: new Set(overdue.map((row) => row.memberId)).size,
    }),
    [overdue],
  )

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = visible.slice((safePage - 1) * pageSize, safePage * pageSize)

  async function run(work, message) {
    setBusy(true)
    try {
      await work()
      await desk.refresh()
      setNotice(message)
    } finally {
      setBusy(false)
    }
  }

  async function remind(row) {
    await run(
      () => circulation.sendReminder(row, { author: user, locale }),
      `Reminder sent to ${row.memberName}.`,
    )
  }

  async function markLost() {
    const row = losing
    await run(
      () =>
        circulation.reportLost({
          borrowing: row,
          book: row.book,
          member: row.member,
          reason: lostReason,
          rules: desk.rules,
          staff: user.name,
        }),
      `${row.bookTitle} reported lost; the replacement charge has been raised.`,
    )
    setLosing(null)
  }

  const actionsFor = (row) => {
    const actions = [
      { label: 'Send reminder', onSelect: () => remind(row) },
      { label: 'Return book', onSelect: () => navigate('/circulation/return') },
      { label: 'View member', onSelect: () => navigate(`/members/${row.memberId}`) },
      { label: 'Report lost', tone: 'danger', onSelect: () => setLosing(row) },
    ]
    if (can(user, CAPABILITIES.FINES)) {
      actions.push({ label: 'Collect fine', onSelect: () => navigate('/fines') })
    }
    return actions
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="mt-1 font-display text-2xl font-bold text-ink-900 dark:text-white">
            Overdue Books
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Worked out from today’s date — nothing here is stored, so the list is never stale.
          </p>
        </div>

        {mayExport && (
          <Action tone="ink" onClick={() => downloadFile('overdue-books.csv', toCSV(visible, CSV_COLUMNS))}>
            Export CSV
          </Action>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Books overdue" value={totals.count} />
        <StatCard label="Members affected" value={totals.members} />
        <StatCard label="Fines accruing" value={formatCurrency(totals.fines, locale)} />
        <StatCard label="Longest overdue" value={`${totals.longest} days`} />
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {losing && (
        <Card title={`Report “${losing.bookTitle}” lost`}>
          <div className="space-y-4 p-5">
            <p className="text-sm text-ink-600 dark:text-ink-300">
              {losing.memberName} has held this copy for {losing.daysOverdue} days past its due date.
              Reporting it lost takes the copy out of circulation and raises a replacement charge of
              ₹{(desk.rules?.replacementCost ?? 0) + (desk.rules?.processingFee ?? 0)}.
            </p>
            <select
              value={lostReason}
              onChange={(event) => setLostReason(event.target.value)}
              style={SELECT_ARROW}
              className={`${SELECT} max-w-md`}
              aria-label="Reason"
            >
              {LOST_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <Action tone="ink" onClick={() => setLosing(null)}>
                Cancel
              </Action>
              <Action tone="red" onClick={markLost} disabled={busy}>
                Report lost
              </Action>
            </div>
          </div>
        </Card>
      )}

      <Card padded={false}>

        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-auto">
            <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Filters</p>
            <p className="text-xs text-ink-400">{visible.length} overdue</p>
          </div>

          <input
            type="search"
            value={filters.query}
            onChange={(event) => set('query', event.target.value)}
            placeholder="Search member, card number, book or transaction…"
            aria-label="Search overdue books"
            className="h-9 w-full min-w-0 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brass-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white sm:w-72"
          />

          <FilterMenu
            values={filters}
            onChange={set}
            cleared={CLEARED}
            fields={[
              {
                key: 'band',
                label: 'How overdue',
                options: OVERDUE_BANDS.map((entry) => ({ value: entry.key, label: entry.label })),
              },
              {
                key: 'reminded',
                label: 'Reminder',
                options: [
                  { value: 'all', label: 'Sent or not' },
                  { value: 'yes', label: 'Reminder sent' },
                  { value: 'no', label: 'No reminder yet' },
                ],
              },
              {
                key: 'fine',
                label: 'Fine owed',
                options: [
                  { value: 'all', label: 'Any amount' },
                  { value: 'none', label: 'Nothing yet (in grace)' },
                  { value: 'under', label: 'Under ₹100' },
                  { value: 'over', label: '₹100 and over' },
                  { value: 'capped', label: `At the ₹${desk.rules?.maxFine ?? 300} ceiling` },
                ],
              },
              {
                key: 'renewals',
                label: 'Renewals used',
                options: [
                  { value: 'all', label: 'Any' },
                  { value: 'never', label: 'Never renewed' },
                  { value: 'some', label: 'Renewed at least once' },
                  { value: 'limit', label: 'At the renewal limit' },
                ],
              },
              {
                key: 'contact',
                label: 'Contact on file',
                options: [
                  { value: 'all', label: 'Reachable or not' },
                  { value: 'yes', label: 'Has phone or email' },
                  { value: 'no', label: 'No way to reach them' },
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
              { key: 'from', label: 'Due on or after', type: 'date' },
              { key: 'to', label: 'Due on or before', type: 'date' },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[68rem] border-collapse text-sm">
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
                    {row.transaction}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-600 dark:text-ink-300">
                    {row.memberName}
                    <span className="block text-xs text-ink-400">
                      {row.memberNumber} · {row.member?.phone ?? '—'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-600 dark:text-ink-300">
                    {row.bookTitle}
                    <span className="block text-xs text-ink-400">{row.book?.code ?? '—'}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                    {formatDate(row.issuedAt, locale)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                    {formatDate(row.dueAt, locale)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-red-600 dark:text-red-400">
                    {row.daysOverdue}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-ink-800 dark:text-ink-100">
                    {formatCurrency(row.fine, locale)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                    {row.remindedAt ? formatDate(row.remindedAt, locale) : 'No'}
                  </td>
                  <td className={ACTION_CELL}>
                    <RowMenu label={`Actions for ${row.transaction}`} items={actionsFor(row)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {visible.length === 0 && <Empty>Nothing overdue in this band.</Empty>}
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
    </div>
  )
}
