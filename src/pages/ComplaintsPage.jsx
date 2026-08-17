// Every complaint the library has received, and what became of it.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLive } from '../hooks/useLive.js'
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx'
import Card from '../components/dashboard/Card.jsx'
import StatCard from '../components/dashboard/StatCard.jsx'
import RowMenu, { ACTION_CELL, ACTION_HEAD } from '../components/dashboard/RowMenu.jsx'
import FilterMenu from '../components/FilterMenu.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { usePageSize } from '../hooks/useTablePrefs.js'
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus.js'
import { formatDate, formatTime } from '../lib/format.js'
import { CAPABILITIES, badgeForRole, can } from '../lib/permissions.js'
import { downloadFile, toCSV } from '../lib/csv.js'
import {
  ADDRESSEE_LABEL,
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
  NEXT_STEP,
  PRIORITIES,
  PRIORITY_BADGE,
  STATUS_BADGE,
  STATUS_MEANING,
  composeComplaints,
  filterComplaints,
  mayWork,
  summarizeComplaints,
} from '../lib/complaints.js'
import * as complaintsService from '../services/complaints.js'
import * as membersService from '../services/members.js'
import * as auth from '../services/auth.js'
import { library } from '../data/demoLibrary.js'
import {
  Action,
  Empty,
  INPUT,
  LABEL,
  Lookup,
  Pager,
  Pill,
  SELECT,
  SELECT_ARROW,
  stripeFor,
} from '../components/circulation/Shared.jsx'

const COLUMNS = ['Reference', 'Subject', 'Category', 'Raised by', 'Raised', 'Age', 'Priority', 'Status']

const CSV_COLUMNS = [
  ['Reference', (row) => row.ref],
  ['Subject', (row) => row.subject],
  ['Details', (row) => row.details],
  ['Category', (row) => row.category],
  ['Raised By', (row) => row.raisedByName],
  ['Role', (row) => row.raisedByRole],
  ['Contact', (row) => row.contact ?? ''],
  ['Raised', (row) => row.raisedAt?.slice(0, 10) ?? ''],
  ['Age (days)', (row) => row.age],
  ['Priority', (row) => row.priority],
  ['Status', (row) => row.status],
  ['For', (row) => row.addressedTo],
  ['Assigned To', (row) => row.assignedTo ?? ''],
  ['Resolution', (row) => row.resolution ?? ''],
]

const PAGE_SIZES = [10, 25, 50]

const CLEARED = {
  query: '',
  status: 'all',
  category: 'all',
  priority: 'all',
  raisedBy: 'all',
  addressed: 'all',
  age: 'all',
  from: '',
  to: '',
}

const EMPTY_FORM = {
  subject: '',
  details: '',
  category: COMPLAINT_CATEGORIES[0],
  priority: 'Normal',
  member: null,
}

export default function ComplaintsPage() {
  const { user } = useAuth()
  const { locale } = usePreferences()

  const [rows, setRows] = useState([])
  const [members, setMembers] = useState([])
  const [staff, setStaff] = useState([])

  const [filters, setFilters] = useState(CLEARED)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePageSize(PAGE_SIZES)

  const [raising, setRaising] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)

  const [detail, setDetail] = useState(null)
  const [staging, setStaging] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const mayDelete = can(user, CAPABILITIES.COMPLAINTS_REMOVE)

  const mayRaise = can(user, CAPABILITIES.COMPLAINTS_RAISE)
  const mayExport = can(user, CAPABILITIES.EXPORT)

  const refresh = useCallback(() => {
    Promise.all([
      complaintsService.listComplaints(),
      membersService.listAddedMembers(),
      auth.listAccounts(),
    ]).then(([complaints, added, accounts]) => {
      setRows(complaints)
      setMembers([...library.members, ...added])
      setStaff(accounts)
    })
  }, [])

  useEffect(refresh, [refresh])

  useLive(['complaints'], refresh)

  useRefreshOnFocus(refresh)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  const composed = useMemo(
    () => composeComplaints({ complaints: rows, members, staff }),
    [rows, members, staff],
  )

  const visible = useMemo(() => filterComplaints(composed, filters), [composed, filters])
  const stats = useMemo(() => summarizeComplaints(composed), [composed])

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = visible.slice((safePage - 1) * pageSize, safePage * pageSize)

  const set = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  async function run(work, message) {
    setBusy(true)
    try {
      await work()
      refresh()
      setNotice(message)
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!form.subject.trim()) return setFormError('Give the complaint a subject.')
    if (!form.details.trim()) return setFormError('Describe what happened.')
    setFormError(null)

    await run(
      () =>
        complaintsService.raiseComplaint({
          subject: form.subject,
          details: form.details,
          category: form.category,
          priority: form.priority,

          memberId: form.member?.id ?? null,
          memberName: form.member?.name ?? null,
          raisedById: form.member ? null : user.id,
          raisedByName: form.member?.name ?? user.name,
          raisedByRole: form.member ? 'member' : 'staff',
          contact: form.member?.email ?? user.email ?? null,
        }),
      'Complaint logged.',
    )
    setForm(EMPTY_FORM)
    setRaising(false)
  }

  const actionsFor = (row) => {
    const actions = [{ label: 'Open record', onSelect: () => setDetail(row) }]

    const next = mayWork(row, user.role) ? NEXT_STEP[row.status] : null
    if (next) {
      actions.push({
        label: next.label,
        onSelect: () => {
          setDetail(null)
          setStaging({ row, to: next.to, note: '', resolution: '', assignedTo: user.name })
        },
      })
    }

    if (mayDelete) {
      actions.push({
        label: 'Delete complaint',
        tone: 'danger',
        onSelect: () => setDeleting(row),
      })
    }
    return actions
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="mt-1 font-display text-2xl font-bold text-ink-900 dark:text-white">
            Complaints
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Everything raised by members and staff, and what became of it.
          </p>
        </div>

        <div className="flex gap-3">
          {mayExport && (
            <Action
              tone="ink"
              onClick={() => downloadFile('complaints.csv', toCSV(visible, CSV_COLUMNS))}
              disabled={visible.length === 0}
            >
              Export CSV
            </Action>
          )}
          {mayRaise && (
            <Action tone="gold" onClick={() => setRaising(true)}>
              Raise a complaint
            </Action>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Received" value={stats.received} hint="Waiting to be picked up" />
        <StatCard label="In process" value={stats.inProcess} />
        <StatCard label="Completed" value={stats.completed} />
        <StatCard
          label="For the administrator"
          value={stats.forAdministrator}
          hint="Raised by staff, open"
        />
      </div>

      {notice && (
        <div
          role="status"
          className="animate-rise fixed left-1/2 top-20 z-50 w-[min(28rem,90vw)] -translate-x-1/2 lg:left-[calc(50%+8rem)]"
        >
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-lg dark:border-emerald-500/40 dark:bg-ink-800 dark:text-emerald-200">
            {notice}
          </div>
        </div>
      )}

      <Card
        title="The register"
        subtitle={
          <>
            Oldest reference first; newest at the top
            <span className="mt-0.5 block">{visible.length} complaints</span>
          </>
        }
        padded={false}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              type="search"
              value={filters.query}
              onChange={(event) => set('query', event.target.value)}
              placeholder="Search reference, subject, person…"
              aria-label="Search complaints"
              className="h-9 w-44 min-w-0 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brass-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white sm:w-64"
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
                    { value: 'all', label: 'Any status' },
                    ...COMPLAINT_STATUSES.map((value) => ({ value, label: value })),
                  ],
                },
                {
                  key: 'raisedBy',
                  label: 'Raised by',
                  options: [
                    { value: 'all', label: 'Anyone' },
                    { value: 'member', label: 'A member' },
                    { value: 'staff', label: 'Staff' },
                  ],
                },
                {
                  key: 'category',
                  label: 'Category',
                  options: [
                    { value: 'all', label: 'All categories' },
                    ...COMPLAINT_CATEGORIES.map((value) => ({ value, label: value })),
                  ],
                },
                {
                  key: 'priority',
                  label: 'Priority',
                  options: [
                    { value: 'all', label: 'Any priority' },
                    ...PRIORITIES.map((value) => ({ value, label: value })),
                  ],
                },
                {
                  key: 'addressed',
                  label: 'For',
                  options: [
                    { value: 'all', label: 'Anyone' },
                    { value: 'desk', label: 'The desk' },
                    { value: 'administrator', label: 'The administrator' },
                  ],
                },
                {
                  key: 'age',
                  label: 'Waiting',
                  options: [
                    { value: 'all', label: 'Any length' },
                    { value: 'today', label: 'Raised today' },
                    { value: 'stale', label: 'Open over a week' },
                  ],
                },
                { key: 'from', label: 'Raised on or after', type: 'date' },
                { key: 'to', label: 'Raised on or before', type: 'date' },
              ]}
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[62rem] border-collapse text-sm">
            <thead>
              <tr className="bg-ink-900 text-left text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-white dark:bg-ink-950">
                {COLUMNS.map((column) => (
                  <th key={column} className="whitespace-nowrap px-4 py-3">
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
                    {row.ref}
                  </td>
                  <td className="max-w-[18rem] px-4 py-3 text-ink-700 dark:text-ink-200">
                    <span className="block truncate font-medium">{row.subject || '—'}</span>
                    <span className="block truncate text-xs text-ink-400">{row.details}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-600 dark:text-ink-300">
                    {row.category}
                    <span className="block text-xs text-ink-400">
                      for {ADDRESSEE_LABEL[row.addressedTo].toLowerCase()}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-600 dark:text-ink-300">
                    {row.raisedByName}

                    <span className="mt-0.5 block">
                      <Pill tone={badgeForRole(row.sourceRole)}>{row.sourceLabel}</Pill>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                    {row.raisedAt ? formatDate(row.raisedAt, locale) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">

                    <span
                      className={
                        row.stale
                          ? 'font-semibold text-red-600 dark:text-red-400'
                          : 'text-ink-500 dark:text-ink-400'
                      }
                    >
                      {row.age === 0 ? 'Today' : `${row.age} days`}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Pill tone={PRIORITY_BADGE[row.priority]}>{row.priority}</Pill>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Pill tone={STATUS_BADGE[row.status]}>{row.status}</Pill>
                  </td>
                  <td className={ACTION_CELL}>
                    <RowMenu label={`Actions for ${row.ref}`} items={actionsFor(row)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {visible.length === 0 && <Empty>No complaints match these filters.</Empty>}
        </div>

        <Pager
          page={safePage}
          totalPages={totalPages}
          total={visible.length}
          first={(safePage - 1) * pageSize + 1}
          last={Math.min(safePage * pageSize, visible.length)}
          pageSize={pageSize}
          sizes={PAGE_SIZES}
          onPage={setPage}
          onSize={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      </Card>

      {raising && mayRaise && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 py-10 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Raise a complaint"
            className="animate-rise w-full max-w-2xl rounded-xl border border-ink-100 bg-white shadow-xl dark:border-ink-800 dark:bg-ink-900"
          >
            <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
              <div>
                <h2 className="font-display text-lg text-ink-900 dark:text-white">
                  Raise a complaint
                </h2>
                <p className="mt-0.5 text-xs text-ink-400">
                  Leave the member blank if this is your own.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRaising(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div className="space-y-5 p-5">
              {formError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
                  {formError}
                </div>
              )}

              <Lookup
                label="On behalf of (member)"
                placeholder="Card number, name or email — leave blank for your own"
                items={members}
                value={form.member}
                onSelect={(member) => setForm((current) => ({ ...current, member }))}
                search={(row) => [row.membershipNumber, row.name, row.email]}
                describe={(row) => `${row.name} · ${row.membershipNumber}`}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="complaint-category" className={LABEL}>
                    Category
                  </label>
                  <select
                    id="complaint-category"
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, category: event.target.value }))
                    }
                    style={SELECT_ARROW}
                    className={SELECT}
                  >
                    {COMPLAINT_CATEGORIES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="complaint-priority" className={LABEL}>
                    Priority
                  </label>
                  <select
                    id="complaint-priority"
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, priority: event.target.value }))
                    }
                    style={SELECT_ARROW}
                    className={SELECT}
                  >
                    {PRIORITIES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="complaint-subject" className={LABEL}>
                  Subject
                </label>
                <input
                  id="complaint-subject"
                  value={form.subject}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, subject: event.target.value }))
                  }
                  placeholder="In one line, what is wrong"
                  className={INPUT}
                />
              </div>

              <div>
                <label htmlFor="complaint-details" className={LABEL}>
                  What happened
                </label>
                <textarea
                  id="complaint-details"
                  rows={5}
                  value={form.details}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, details: event.target.value }))
                  }
                  placeholder="Dates, names, and what was expected instead"
                  className={INPUT}
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-ink-100 pt-5 dark:border-ink-800">
                <Action tone="ink" onClick={() => setForm(EMPTY_FORM)} disabled={busy}>
                  Clear
                </Action>
                <Action tone="gold" onClick={submit} disabled={busy}>
                  {busy ? 'Logging…' : 'Log complaint'}
                </Action>
              </div>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 py-10 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Complaint ${detail.ref}`}
            className="animate-rise w-full max-w-2xl rounded-xl border border-ink-100 bg-white shadow-xl dark:border-ink-800 dark:bg-ink-900"
          >
            <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg text-ink-900 dark:text-white">{detail.ref}</h2>
                  <Pill tone={STATUS_BADGE[detail.status]}>{detail.status}</Pill>
                  <Pill tone={PRIORITY_BADGE[detail.priority]}>{detail.priority}</Pill>
                </div>
                <p className="mt-0.5 text-xs text-ink-400">{STATUS_MEANING[detail.status]}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div className="space-y-5 p-5">
              <div>
                <h3 className="font-display text-base text-ink-900 dark:text-white">
                  {detail.subject}
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-700 dark:text-ink-200">
                  {detail.details}
                </p>
              </div>

              <dl className="grid gap-3 rounded-lg border border-ink-100 p-4 text-sm sm:grid-cols-2 dark:border-ink-800">
                {[
                  ['Raised by', `${detail.raisedByName} — ${detail.sourceLabel}`],
                  ['For', ADDRESSEE_LABEL[detail.addressedTo]],
                  ['Contact', detail.contact ?? '—'],
                  ['Category', detail.category],
                  ['Raised', detail.raisedAt ? `${formatDate(detail.raisedAt, locale)}, ${formatTime(detail.raisedAt, locale)}` : '—'],
                  ['Assigned to', detail.assignedTo ?? 'Nobody yet'],
                  ['Open for', detail.age === 0 ? 'Today' : `${detail.age} days`],
                  ['Completed', detail.completedAt ? formatDate(detail.completedAt, locale) : '—'],
                  ['Settled by', detail.completedBy ?? '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs uppercase tracking-[0.08em] text-ink-400">{label}</dt>
                    <dd className="mt-0.5 text-ink-700 dark:text-ink-200">{value}</dd>
                  </div>
                ))}
              </dl>

              {detail.resolution && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/40 dark:bg-emerald-500/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
                    How it was settled
                  </p>
                  <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-200">
                    {detail.resolution}
                  </p>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
                  History
                </p>
                <ol className="space-y-2">
                  {detail.history.map((entry) => (
                    <li key={entry.at} className="flex flex-wrap gap-2 text-sm text-ink-600 dark:text-ink-300">
                      <span className="text-ink-400">
                        {formatDate(entry.at, locale)}, {formatTime(entry.at, locale)}
                      </span>
                      <span>
                        {entry.from ? `${entry.from} → ${entry.to}` : `Raised as ${entry.to}`}
                        {entry.by ? ` · ${entry.by}` : ''}
                      </span>
                      {entry.note && <span className="text-ink-400">“{entry.note}”</span>}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {staging && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 py-10 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Move ${staging.row.ref} to ${staging.to}`}
            className="animate-rise w-full max-w-lg rounded-xl border border-ink-100 bg-white p-5 shadow-xl dark:border-ink-800 dark:bg-ink-900"
          >
            <h2 className="font-display text-lg text-ink-900 dark:text-white">
              {staging.row.ref} → {staging.to}
            </h2>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{staging.row.subject}</p>

            <div className="mt-4 space-y-4">
              {staging.to === 'In Process' && (
                <div>
                  <label htmlFor="stage-assigned" className={LABEL}>
                    Who is dealing with it
                  </label>
                  <input
                    id="stage-assigned"
                    value={staging.assignedTo}
                    onChange={(event) =>
                      setStaging((current) => ({ ...current, assignedTo: event.target.value }))
                    }
                    className={INPUT}
                  />
                </div>
              )}

              {staging.to === 'Completed' && (
                <div>
                  <label htmlFor="stage-resolution" className={LABEL}>
                    How it was settled
                  </label>
                  <textarea
                    id="stage-resolution"
                    rows={4}
                    value={staging.resolution}
                    onChange={(event) =>
                      setStaging((current) => ({ ...current, resolution: event.target.value }))
                    }
                    placeholder="What was done, and what the complainant was told"
                    className={INPUT}
                  />
                </div>
              )}

              <div>
                <label htmlFor="stage-note" className={LABEL}>
                  Note for the history
                </label>
                <input
                  id="stage-note"
                  value={staging.note}
                  onChange={(event) =>
                    setStaging((current) => ({ ...current, note: event.target.value }))
                  }
                  placeholder="Optional"
                  className={INPUT}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <Action tone="ink" onClick={() => setStaging(null)} disabled={busy}>
                Cancel
              </Action>
              <Action
                tone="gold"
                disabled={busy || (staging.to === 'Completed' && !staging.resolution.trim())}
                onClick={async () => {
                  const { row, to, note, resolution, assignedTo } = staging
                  setStaging(null)
                  await run(
                    () =>
                      complaintsService.advanceComplaint(
                        row,
                        to,
                        { note: note || null, resolution, assignedTo },
                        user.name,
                      ),
                    `${row.ref} moved to ${to}.`,
                  )
                }}
              >
                {busy ? 'Saving…' : `Move to ${staging.to}`}
              </Action>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-complaint-title"
            className="animate-rise w-full max-w-md rounded-xl border border-ink-100 bg-white p-5 shadow-xl dark:border-ink-800 dark:bg-ink-900"
          >
            <h2 id="delete-complaint-title" className="font-display text-lg text-ink-900 dark:text-white">
              Delete {deleting.ref}?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
              The complaint and its history leave the register permanently. The Activity Log will
              still show that you removed it, and by whom it was raised.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Action tone="ink" onClick={() => setDeleting(null)} disabled={busy}>
                Cancel
              </Action>
              <Action
                tone="red"
                disabled={busy}
                onClick={async () => {
                  const row = deleting
                  setDeleting(null)
                  await run(() => complaintsService.removeComplaint(row.id), `${row.ref} deleted.`)
                }}
              >
                Delete
              </Action>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
