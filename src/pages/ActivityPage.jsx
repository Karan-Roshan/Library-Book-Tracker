// The audit trail: who did what, and when.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx'
import Card from '../components/dashboard/Card.jsx'
import FilterMenu from '../components/FilterMenu.jsx'
import { Pager } from '../components/circulation/Shared.jsx'
import { usePageSize } from '../hooks/useTablePrefs.js'
import StatCard from '../components/dashboard/StatCard.jsx'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { formatDate, formatTime } from '../lib/format.js'
import { downloadFile, toCSV } from '../lib/csv.js'
import { ROLE_LABELS } from '../lib/permissions.js'
import {
  ACTION_LABELS,
  MODULES,
  STATUSES,
  STATUS_BADGE,
  describeChanges,
  deviceLabel,
  filterActivity,
} from '../lib/activity.js'
import * as activityService from '../services/activity.js'

const COLUMNS = ['Time', 'Staff', 'Role', 'Action', 'Module', 'Target', 'Status']

const CSV_COLUMNS = [
  ['Time', (row) => row.at],
  ['Staff', (row) => row.staffName],
  ['Staff ID', (row) => row.staffNumber ?? ''],
  ['Email', (row) => row.email ?? ''],
  ['Role', (row) => ROLE_LABELS[row.role] ?? row.role ?? ''],
  ['Action', (row) => row.action],
  ['Module', (row) => row.module],
  ['Target', (row) => row.target ?? ''],
  ['Target ID', (row) => row.targetId ?? ''],
  ['Status', (row) => row.status],
  ['Reason', (row) => row.reason ?? ''],
  ['Changed from', (row) => (row.before ? JSON.stringify(row.before) : '')],
  ['Changed to', (row) => (row.after ? JSON.stringify(row.after) : '')],
  ['Device', (row) => deviceLabel(row)],
  ['IP', (row) => row.ip ?? ''],
]

const PAGE_SIZES = [25, 50, 100, 250]

const stripeFor = (index) =>
  index % 2 === 0 ? 'bg-white dark:bg-ink-900' : 'bg-ink-50 dark:bg-ink-800'

const SELECT =
  'h-9 rounded-lg border border-ink-200 bg-white px-2.5 text-sm text-ink-700 focus:border-brass-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200'

const CLEARED = {
  query: '',
  staffId: 'all',
  action: 'all',
  module: 'all',
  status: 'all',
  from: '',
  to: '',
}

export default function ActivityPage() {
  const { locale } = usePreferences()

  const [entries, setEntries] = useState([])
  const [filters, setFilters] = useState(CLEARED)
  const [open, setOpen] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePageSize(PAGE_SIZES)

  const refresh = useCallback(() => {
    activityService.listActivity().then(setEntries)
  }, [])

  useEffect(refresh, [refresh])

  const staff = useMemo(() => {
    const seen = new Map()
    for (const entry of entries) {
      if (entry.staffId && !seen.has(entry.staffId)) seen.set(entry.staffId, entry.staffName)
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [entries])

  const visible = useMemo(() => filterActivity(entries, filters), [entries, filters])

  useEffect(() => setPage(1), [filters])

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = visible.slice((safePage - 1) * pageSize, safePage * pageSize)

  const stats = useMemo(
    () => ({
      total: entries.length,
      failed: entries.filter((entry) => entry.status === 'Failed').length,
      today: entries.filter((entry) => entry.at.slice(0, 10) === new Date().toISOString().slice(0, 10))
        .length,
      staff: staff.length,
    }),
    [entries, staff],
  )

  const set = (field) => (event) =>
    setFilters((current) => ({ ...current, [field]: event.target.value }))

  const cell = 'whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="mt-2 font-display text-2xl text-ink-900 dark:text-white">
            Staff Activity Log
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Who did what, when, to which record — and whether it worked
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            downloadFile(
              `activity-${new Date().toISOString().slice(0, 10)}.csv`,
              toCSV(visible, CSV_COLUMNS),
            )
          }
          disabled={visible.length === 0}
          className="rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-800 disabled:bg-ink-300 dark:bg-ink-700 dark:hover:bg-ink-600"
        >
          Export CSV
        </button>
      </div>

      <section aria-label="Activity totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard align="center" label="All Entries" value={stats.total} />
        <StatCard align="center" label="Today" value={stats.today} tone="brass" />
        <StatCard align="center" label="Failed Actions" value={stats.failed} tone="alert" />
        <StatCard align="center" label="Staff Recorded" value={stats.staff} />
      </section>

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">

          <div className="mr-auto">
            <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Filters</p>
            <p className="text-xs text-ink-400">{visible.length} entries</p>
          </div>

          <input
            type="search"
            value={filters.query}
            onChange={set('query')}
            placeholder="Search staff, action, target…"
            aria-label="Search activity"
            className="h-9 w-full min-w-0 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brass-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white sm:w-64"
          />

          <FilterMenu
            values={filters}
            onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
            cleared={CLEARED}
            fields={[
              {
                key: 'staffId',
                label: 'Staff member',
                options: [
                  { value: 'all', label: 'All staff' },
                  ...staff.map(([id, name]) => ({ value: id, label: name })),
                ],
              },
              {
                key: 'action',
                label: 'Action',
                options: [
                  { value: 'all', label: 'All actions' },
                  ...ACTION_LABELS.map((label) => ({ value: label, label })),
                ],
              },
              {
                key: 'module',
                label: 'Module',
                options: [
                  { value: 'all', label: 'All modules' },
                  ...MODULES.map((name) => ({ value: name, label: name })),
                ],
              },
              {
                key: 'status',
                label: 'Status',
                options: [
                  { value: 'all', label: 'All statuses' },
                  ...STATUSES.map((name) => ({ value: name, label: name })),
                ],
              },
              { key: 'from', label: 'From', type: 'date' },
              { key: 'to', label: 'To', type: 'date' },
            ]}
          />

        </div>
      </Card>

      <Card
        title="Activity"
        subtitle={`${visible.length} of ${entries.length} entries`}
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-900 text-left dark:bg-ink-950">
                {COLUMNS.map((column) => (
                  <th
                    key={column}
                    className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-brass-200"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-sm text-ink-400">
                    No activity matches that view.
                  </td>
                </tr>
              )}
              {paged.map((entry, index) => (
                <tr
                  key={entry.id}
                  onClick={() => setOpen(entry)}
                  className={`cursor-pointer border-b border-ink-100/70 transition-colors last:border-0 dark:border-ink-800/60 ${stripeFor(index)} hover:bg-brass-50 dark:hover:bg-ink-800`}
                >
                  <td className={cell}>
                    {formatTime(entry.at, locale)}
                    <span className="ml-1.5 text-xs text-ink-400">
                      {formatDate(entry.at, locale)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-ink-900 dark:text-white">
                    {entry.staffName}
                  </td>
                  <td className={cell}>{ROLE_LABELS[entry.role] ?? entry.role ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-700 dark:text-ink-200">
                    {entry.action}
                  </td>
                  <td className={cell}>{entry.module}</td>
                  <td className="px-4 py-3 text-ink-700 dark:text-ink-200">{entry.target ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[entry.status]}`}
                    >
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 py-10 backdrop-blur-sm"
          onClick={() => setOpen(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="animate-rise w-full max-w-2xl rounded-xl border border-ink-100 bg-white shadow-xl dark:border-ink-800 dark:bg-ink-900"
          >
            <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
              <div>
                <h2 className="font-display text-lg text-ink-900 dark:text-white">{open.action}</h2>
                <p className="mt-0.5 text-xs text-ink-400">
                  {formatDate(open.at, locale)} · {formatTime(open.at, locale)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 dark:hover:bg-ink-800"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div className="space-y-5 px-5 py-5">
              <dl className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Staff', open.staffName],
                  ['Staff ID', open.staffNumber],
                  ['Email', open.email],
                  ['Role', ROLE_LABELS[open.role] ?? open.role],
                  ['Module', open.module],
                  ['Status', open.status],
                  ['Target', open.target],
                  ['Target ID', open.targetId],
                  ['Device', deviceLabel(open)],
                  ['IP address', open.ip],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-ink-400">{label}</dt>
                    <dd className="text-sm font-medium text-ink-800 dark:text-ink-100">
                      {value || '—'}
                    </dd>
                  </div>
                ))}
              </dl>

              {open.reason && (
                <div className="rounded-lg border border-ink-100 bg-ink-50 px-4 py-3 dark:border-ink-800 dark:bg-ink-800">
                  <p className="text-xs text-ink-400">Reason</p>
                  <p className="mt-0.5 text-sm text-ink-800 dark:text-ink-100">{open.reason}</p>
                </div>
              )}

              {describeChanges(open.before, open.after).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
                    Changes
                  </p>
                  <ul className="space-y-1.5">
                    {describeChanges(open.before, open.after).map((change) => (
                      <li
                        key={change.field}
                        className="flex flex-wrap items-baseline gap-2 rounded-lg bg-ink-50 px-3 py-2 text-sm dark:bg-ink-800"
                      >
                        <span className="font-medium text-ink-800 dark:text-ink-100">
                          {change.field}
                        </span>
                        <span className="text-red-600 line-through">
                          {String(change.from ?? '—')}
                        </span>
                        <span className="text-ink-400">→</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {String(change.to ?? '—')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
