// The repair bench: damaged copies and their three stages.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx'
import Card from '../components/dashboard/Card.jsx'
import { RequiredMark } from '../components/TextField.jsx'
import StatCard from '../components/dashboard/StatCard.jsx'
import RowMenu, { ACTION_CELL, ACTION_HEAD } from '../components/dashboard/RowMenu.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { usePageSize } from '../hooks/useTablePrefs.js'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { library } from '../data/demoLibrary.js'
import { formatCurrency, formatDate } from '../lib/format.js'
import { downloadFile, toCSV } from '../lib/csv.js'
import { CAPABILITIES, ROLE_LABELS, can } from '../lib/permissions.js'
import { composeBooks } from '../lib/books.js'
import { composeMembers } from '../lib/members.js'
import {
  ALL_STATUSES,
  DAMAGE_TYPES,
  NEXT_STEP,
  SEVERITIES,
  SEVERITY_BADGE,
  SEVERITY_MEANING,
  STATUS_BADGE,
  STATUS_MEANING,
  composeRepairs,
  filterRepairs,
  historyFor,
  repairableCopies,
  sortRepairs,
  summarizeRepairs,
} from '../lib/repairs.js'
import * as repairsService from '../services/repairs.js'
import * as booksService from '../services/books.js'
import * as membersService from '../services/members.js'
import * as circulation from '../services/circulation.js'
import * as fines from '../services/fines.js'
import * as auth from '../services/auth.js'
import {
  Action,
  Empty,
  Facts,
  INPUT,
  LABEL,
  Lookup,
  Pager,
  Pill,
  SELECT,
  SELECT_ARROW,
  stripeFor,
} from '../components/circulation/Shared.jsx'

const COLUMNS = [
  'Repair',
  'Book',
  'Copy',
  'Damage',
  'Severity',
  'Assigned',
  'Cost',
  'Expected',
  'Status',
]

const CSV_COLUMNS = [
  ['Repair Ref', (row) => row.ref],
  ['Book ID', (row) => row.bookCode],
  ['Book Title', (row) => row.bookName],
  ['ISBN', (row) => row.isbn],
  ['Copy ID', (row) => row.copyCode],
  ['Category', (row) => row.category],
  ['Shelf', (row) => row.shelf],
  ['Repair No. For Copy', (row) => row.sequence],
  ['Damage Type', (row) => row.damageType],
  ['Description', (row) => row.description],
  ['Severity', (row) => row.severity],
  ['Reported By', (row) => row.reportedBy],
  ['Reported On', (row) => row.reportedAt?.slice(0, 10) ?? ''],
  ['Source', (row) => row.source ?? ''],
  ['Member Responsible', (row) => row.memberName ?? ''],
  ['Inspected On', (row) => row.inspectedAt?.slice(0, 10) ?? ''],
  ['Inspector', (row) => row.inspectedBy ?? ''],
  ['Assigned To', (row) => row.assignedTo ?? ''],
  ['Assigned Role', (row) => row.assignedRole ?? ''],
  ['Assigned On', (row) => row.assignedAt?.slice(0, 10) ?? ''],
  ['Repair Started', (row) => row.startedAt?.slice(0, 10) ?? ''],
  ['Expected Completion', (row) => row.expectedAt?.slice(0, 10) ?? ''],
  ['Actual Completion', (row) => row.completedAt?.slice(0, 10) ?? ''],
  ['Available From', (row) => row.availableAt?.slice(0, 10) ?? ''],
  ['Turnaround (days)', (row) => row.turnaround ?? ''],
  ['Estimated Cost', (row) => row.estimatedCost ?? ''],
  ['Actual Cost', (row) => row.actualCost ?? ''],
  ['Charged To Member', (row) => row.chargeAmount ?? ''],
  ['Final Condition', (row) => row.finalCondition ?? ''],
  ['Approved By', (row) => row.approvedBy ?? ''],
  ['Status', (row) => row.status],
]

const PAGE_SIZES = [25, 50, 100]

const dateValue = (date) => new Date(date).toISOString().slice(0, 10)

export default function RepairsPage() {
  const { user } = useAuth()
  const { locale } = usePreferences()

  const [raw, setRaw] = useState({ repairs: [], added: [], issued: [], lost: [], extra: [], overrides: {}, staff: [] })
  const [query, setQuery] = useState('')

  const [status, setStatus] = useState('all')
  const [severity, setSeverity] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePageSize(PAGE_SIZES)
  const [raising, setRaising] = useState(false)
  const [detail, setDetail] = useState(null)
  const [stage, setStage] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const now = useMemo(() => new Date(), [])
  const mayExport = can(user, CAPABILITIES.EXPORT)
  const mayCharge = can(user, CAPABILITIES.FINES)

  const refresh = useCallback(
    () =>
      Promise.all([
        repairsService.listRepairs(),
        booksService.listAddedBooks(),
        booksService.listIssuedBorrowings(),
        circulation.listLostReports(),
        membersService.listAddedMembers(),
        membersService.listOverrides(),
        auth.listAccounts(),
      ]).then(([repairs, added, issued, lost, extra, overrides, staff]) =>
        setRaw({ repairs, added, issued, lost, extra, overrides, staff }),
      ),
    [],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  const books = useMemo(
    () =>
      composeBooks({
        library,
        added: raw.added,
        issued: raw.issued,
        lostReports: raw.lost,
        repairs: raw.repairs,
        now,
      }),
    [raw, now],
  )

  const members = useMemo(
    () =>
      composeMembers({
        library,
        added: raw.extra,
        overrides: raw.overrides,
        issued: raw.issued,
        now,
      }),
    [raw, now],
  )

  const repairs = useMemo(
    () => composeRepairs({ repairs: raw.repairs, books, members }),
    [raw.repairs, books, members],
  )

  const stats = useMemo(() => summarizeRepairs(repairs), [repairs])

  const visible = useMemo(
    () => sortRepairs(filterRepairs(repairs, { query, status, severity })),
    [repairs, query, status, severity],
  )

  useEffect(() => setPage(1), [query, status, severity])

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = visible.slice((safePage - 1) * pageSize, safePage * pageSize)

  const live = detail ? (repairs.find((row) => row.id === detail.id) ?? null) : null

  async function run(work, message) {
    setBusy(true)
    try {
      await work()
      await refresh()
      setNotice(message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(timer)
  }, [notice])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="mt-1 font-display text-2xl font-bold text-ink-900 dark:text-white">
            Book Repairs
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Every damaged copy from the moment it is reported to the day it goes back on the shelf.
            A copy on the bench cannot be issued.
          </p>
        </div>

        <div className="flex gap-3">
          {mayExport && (
            <Action tone="ink" onClick={() => downloadFile('book-repairs.csv', toCSV(visible, CSV_COLUMNS))}>
              Export CSV
            </Action>
          )}
          <Action tone="gold" onClick={() => setRaising(true)}>
            Report damage
          </Action>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total repairs" value={stats.total} />
        <StatCard label="Reported" value={stats.reported} />
        <StatCard label="In process" value={stats.inProcess} />
        <StatCard label="Completed" value={stats.completed} />
        <StatCard
          className="sm:col-span-2 lg:col-span-1"
          label="Total repair cost"
          value={formatCurrency(stats.spend, locale)}
          hint={
            stats.recovered > 0
              ? `${formatCurrency(stats.recovered, locale)} recovered from members`
              : undefined
          }
        />
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {(stats.overdue > 0 || stats.turnaround !== null) && (
        <div className="flex flex-wrap gap-4 text-sm text-ink-500 dark:text-ink-400">
          {stats.turnaround !== null && (
            <span>
              Average turnaround{' '}
              <strong className="text-ink-800 dark:text-ink-100">{stats.turnaround} days</strong>
            </span>
          )}
          {stats.committed > 0 && (
            <span>
              Committed on open jobs{' '}
              <strong className="text-ink-800 dark:text-ink-100">
                {formatCurrency(stats.committed, locale)}
              </strong>
            </span>
          )}
          {stats.overdue > 0 && (
            <span className="font-semibold text-red-600 dark:text-red-400">
              {stats.overdue} past their expected completion date
            </span>
          )}
        </div>
      )}

      {raising && (
        <ReportDialog
          books={books}
          repairs={raw.repairs}
          user={user}
          onClose={() => setRaising(false)}
          onDone={(message) => {
            setRaising(false)
            refresh().then(() => setNotice(message))
          }}
        />
      )}

      {stage && (
        <StageDialog
          repair={stage.repair}
          to={stage.to}
          staff={raw.staff}
          user={user}
          locale={locale}
          onClose={() => setStage(null)}
          onDone={(message) => {
            setStage(null)
            refresh().then(() => setNotice(message))
          }}
        />
      )}

      {live && (
        <DetailPanel
          repair={live}
          repairs={repairs}
          locale={locale}
          mayCharge={mayCharge}
          busy={busy}
          onClose={() => setDetail(null)}

          onStage={(to) => {
            setStage({ repair: live, to })
            setDetail(null)
          }}
          onCharge={() =>
            run(async () => {
              const amount = live.actualCost ?? live.estimatedCost ?? 0
              const fine = await fines.addManualFine({
                memberId: live.member?.membershipNumber ?? live.memberId,
                bookId: live.bookCode,
                reasons: [live.damageType],
                amount,
                issueDate: live.reportedAt,
                dueDate: live.reportedAt,
              })
              await repairsService.markCharged(live, { fineId: fine.id, amount }, user.name)
            }, `${live.memberName} charged for ${live.bookName}. Collect it in Fine Management.`)
          }
        />
      )}

      <Card padded={false}>

        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-56 flex-1">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search repair, copy, book, damage or staff…"
            className={INPUT}
            aria-label="Search repairs"
          />
          </div>
          <div className="w-52 shrink-0">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            style={SELECT_ARROW}
            className={SELECT}
            aria-label="Status"
          >
            <option value="all">All repairs</option>
            <option value="open">Open jobs only</option>
            {ALL_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          </div>
          <div className="w-48 shrink-0">
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
            style={SELECT_ARROW}
            className={SELECT}
            aria-label="Severity"
          >
            <option value="all">All severities</option>
            {SEVERITIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[76rem] border-collapse text-sm">
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
              {paged.map((row, index) => {
                const next = NEXT_STEP[row.status]
                const actions = [{ label: 'Open record', onSelect: () => setDetail(row) }]
                if (next) {
                  actions.push({ label: next.label, onSelect: () => setStage({ repair: row, to: next.to }) })
                }
                if (row.open) {
                  actions.push({
                    label: 'Delete record',
                    tone: 'danger',
                    onSelect: () =>
                      run(
                        () => repairsService.removeRepair(row.id),
                        `${row.ref} deleted; ${row.copyCode} is back on the shelf.`,
                      ),
                  })
                }

                return (
                  <tr
                    key={row.id}
                    onClick={() => setDetail(row)}
                    className={`group cursor-pointer border-b border-ink-100 transition-colors hover:bg-brass-50 dark:border-ink-800 dark:hover:bg-ink-800 ${stripeFor(index)}`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-ink-800 dark:text-ink-100">
                      {row.ref}
                      {row.sequence > 1 && (
                        <span className="block text-xs text-ink-400">
                          repair #{row.sequence} for this copy
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-600 dark:text-ink-300">
                      {row.bookName}
                      <span className="block text-xs text-ink-400">{row.bookCode}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-ink-700 dark:text-ink-200">
                      {row.copyCode}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-600 dark:text-ink-300">{row.damageType}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Pill tone={SEVERITY_BADGE[row.severity]}>{row.severity}</Pill>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-600 dark:text-ink-300">
                      {row.assignedTo ?? <span className="text-ink-400">Unassigned</span>}
                      {row.assignedRole && (
                        <span className="block text-xs text-ink-400">{row.assignedRole}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-600 dark:text-ink-300">
                      {row.actualCost !== null ? (
                        formatCurrency(row.actualCost, locale)
                      ) : row.estimatedCost !== null ? (
                        <span className="text-ink-400">
                          est. {formatCurrency(row.estimatedCost, locale)}
                        </span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                      {row.expectedAt ? (
                        <span className={row.overdueRepair ? 'font-semibold text-red-600 dark:text-red-400' : ''}>
                          {formatDate(row.expectedAt, locale)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Pill tone={STATUS_BADGE[row.status]}>{row.status}</Pill>
                    </td>
                    <td className={ACTION_CELL} onClick={(event) => event.stopPropagation()}>
                      <RowMenu label={`Actions for ${row.ref}`} items={actions} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {visible.length === 0 && (
            <Empty>
              {repairs.length === 0
                ? 'Nothing has been reported damaged.'
                : 'No repairs match this search.'}
            </Empty>
          )}
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

function ReportDialog({ books, repairs, user, onClose, onDone }) {
  const [book, setBook] = useState(null)
  const [copyNumber, setCopyNumber] = useState('')
  const [damageType, setDamageType] = useState(DAMAGE_TYPES[0])
  const [severity, setSeverity] = useState('Moderate')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const copies = useMemo(
    () => (book ? repairableCopies(book, repairs) : []),
    [book, repairs],
  )

  useEffect(() => setCopyNumber(copies[0] ? String(copies[0].number) : ''), [copies])

  async function submit() {
    setBusy(true)
    try {
      await repairsService.raiseRepair({
        bookId: book.id,
        bookCode: book.code,
        bookName: book.title,
        copyNumber: Number(copyNumber),
        damageType,
        description,
        severity,
        reportedBy: user.name,
        reportedByRole: ROLE_LABELS[user.role],
        source: 'Inventory check',
      })
      onDone(
        `${book.title} copy ${copyNumber} reported as ${damageType.toLowerCase()} and taken off the shelf.`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Report damage">
      <div className="space-y-5 p-5">
        <Lookup
          label="Book"
          required
          autoFocus
          placeholder="Title, book ID, ISBN or author"
          items={books}
          value={book}
          onSelect={setBook}
          search={(row) => [row.title, row.code, row.isbn, row.author]}
          describe={(row) => `${row.title} · ${row.code} · ${row.copies} copies`}
        />

        {book && (
          <>
            {copies.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                Every copy of this title is already on the bench.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="repair-copy" className={LABEL}>
                    Which copy
                  </label>
                  <select
                    id="repair-copy"
                    value={copyNumber}
                    onChange={(event) => setCopyNumber(event.target.value)}
                    style={SELECT_ARROW}
                    className={SELECT}
                  >
                    {copies.map((copy) => (
                      <option key={copy.number} value={copy.number}>
                        {copy.code} — {copy.status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="repair-damage" className={LABEL}>
                    Damage type
                  </label>
                  <select
                    id="repair-damage"
                    value={damageType}
                    onChange={(event) => setDamageType(event.target.value)}
                    style={SELECT_ARROW}
                    className={SELECT}
                  >
                    {DAMAGE_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="repair-severity" className={LABEL}>
                    Severity
                  </label>
                  <select
                    id="repair-severity"
                    value={severity}
                    onChange={(event) => setSeverity(event.target.value)}
                    style={SELECT_ARROW}
                    className={SELECT}
                  >
                    {SEVERITIES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-ink-400">{SEVERITY_MEANING[severity]}</p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="repair-description" className={LABEL}>
                Description
              </label>
              <textarea
                id="repair-description"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Pages 142–150 are partially torn and the binding is loose."
                className={INPUT}
              />
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 border-t border-ink-100 pt-5 dark:border-ink-800">
          <Action tone="ink" onClick={onClose} disabled={busy}>
            Cancel
          </Action>
          <Action onClick={submit} disabled={busy || !book || !copyNumber}>
            {busy ? 'Reporting…' : 'Report damage'}
          </Action>
        </div>
      </div>
    </Card>
  )
}

function StageDialog({ repair, to, staff, user, locale, onClose, onDone }) {
  const [severity, setSeverity] = useState(repair.severity)
  const [damageType, setDamageType] = useState(repair.damageType)
  const [estimatedCost, setEstimatedCost] = useState(repair.estimatedCost ?? '')
  const [assignee, setAssignee] = useState(repair.assignedToId ?? '')
  const [expectedAt, setExpectedAt] = useState(
    repair.expectedAt ? dateValue(repair.expectedAt) : dateValue(new Date(Date.now() + 3 * 86_400_000)),
  )
  const [actions, setActions] = useState(repair.actions ?? '')
  const [actualCost, setActualCost] = useState(repair.actualCost ?? '')
  const [finalCondition, setFinalCondition] = useState(repair.finalCondition ?? 'Good')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})

  const people = useMemo(
    () => [...staff].sort((a, b) => a.name.localeCompare(b.name)),
    [staff],
  )

  async function submit() {
    if (to === 'In Process') {
      const next = {
        estimatedCost: Number(estimatedCost) > 0 ? null : 'Enter the estimated cost.',
        assignee: assignee ? null : 'Choose who is doing the repair.',
        expectedAt: expectedAt ? null : 'Set the expected completion date.',
      }
      setErrors(next)
      if (Object.values(next).some(Boolean)) return
    }
    if (to === 'Complete') {
      const next = { actualCost: Number(actualCost) > 0 ? null : 'Enter the repair cost.' }
      setErrors(next)
      if (next.actualCost) return
    }
    setErrors({})

    setBusy(true)
    try {
      const person = people.find((row) => (row.staffNumber ?? row.id) === assignee)
      await repairsService.advance(
        repair,
        to,
        {
          severity,
          damageType,
          estimatedCost: estimatedCost === '' ? undefined : estimatedCost,
          assignedTo: person?.name,
          assignedToId: person ? (person.staffNumber ?? person.id) : undefined,
          assignedRole: person ? ROLE_LABELS[person.role] : undefined,
          expectedAt,
          actions,
          actualCost: actualCost === '' ? undefined : actualCost,
          finalCondition,
          note: note || undefined,
        },
        user.name,
      )

      let extra = ''
      if (to === 'Complete') {
        const placed = await circulation.listReservations()
        const waiting = placed.find(
          (row) => row.bookId === repair.bookId && row.status === 'Waiting',
        )
        if (waiting) {
          await circulation.markReady(
            { ...waiting, isDesk: true, bookTitle: repair.bookName, memberName: '', code: waiting.id },
            { staff: user.name },
          )
          extra = ' The next member waiting has been notified.'
        }
      }

      onDone(
        to === 'Complete'
          ? `${repair.copyCode} approved and back in circulation.${extra}`
            : `${repair.ref} moved to ${to}.`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (

    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 py-10 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${repair.ref} — move to ${to}`}
        className="animate-rise w-full max-w-2xl rounded-xl border border-ink-100 bg-white shadow-xl dark:border-ink-800 dark:bg-ink-900"
      >
        <header className="border-b border-ink-100 px-5 py-4 dark:border-ink-800">
          <h2 className="font-display text-lg text-ink-900 dark:text-white">
            {repair.ref} · {repair.bookName} ({repair.copyCode})
          </h2>
          <p className="mt-0.5 text-xs text-ink-400">{STATUS_MEANING[to]}</p>
        </header>
      <div className="space-y-5 p-5">
        {to === 'In Process' && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="stage-damage" className={LABEL}>
                  Damage type
                  <RequiredMark />
                </label>
                <select
                  id="stage-damage"
                  value={damageType}
                  onChange={(event) => setDamageType(event.target.value)}
                  style={SELECT_ARROW}
                  className={SELECT}
                >
                  {DAMAGE_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="stage-severity" className={LABEL}>
                  Severity
                  <RequiredMark />
                </label>
                <select
                  id="stage-severity"
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value)}
                  style={SELECT_ARROW}
                  className={SELECT}
                >
                  {SEVERITIES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-ink-400">{SEVERITY_MEANING[severity]}</p>
              </div>
              <div>
                <label htmlFor="stage-estimate" className={LABEL}>
                  Estimated cost (₹)
                  <RequiredMark />
                </label>
                <input
                  id="stage-estimate"
                  type="number"
                  min="0"
                  value={estimatedCost}
                  onChange={(event) => setEstimatedCost(event.target.value)}
                  className={INPUT}
                />
                {errors.estimatedCost && (
                  <p role="alert" className="mt-1.5 text-sm text-red-600">
                    {errors.estimatedCost}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="stage-assignee" className={LABEL}>
                  Assigned to
                  <RequiredMark />
                </label>
                <select
                  id="stage-assignee"
                  value={assignee}
                  onChange={(event) => setAssignee(event.target.value)}
                  style={SELECT_ARROW}
                  className={SELECT}
                >
                  <option value="">Nobody yet</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.staffNumber ?? person.id}>
                      {person.name} — {ROLE_LABELS[person.role]}
                    </option>
                  ))}
                </select>
                {errors.assignee && (
                  <p role="alert" className="mt-1.5 text-sm text-red-600">
                    {errors.assignee}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="stage-expected" className={LABEL}>
                  Expected completion
                  <RequiredMark />
                </label>
                <input
                  id="stage-expected"
                  type="date"
                  value={expectedAt}
                  onChange={(event) => setExpectedAt(event.target.value)}
                  className={INPUT}
                />
                {errors.expectedAt && (
                  <p role="alert" className="mt-1.5 text-sm text-red-600">
                    {errors.expectedAt}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="stage-actions" className={LABEL}>
                Repair actions
              </label>
              <textarea
                id="stage-actions"
                rows={2}
                value={actions}
                onChange={(event) => setActions(event.target.value)}
                placeholder="Rebind, replace endpapers, reprint pages 142–150."
                className={INPUT}
              />
            </div>
          </>
        )}

        {to === 'Complete' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="stage-actual" className={LABEL}>
                  Repair cost (₹)
                  <RequiredMark />
                </label>
                <input
                  id="stage-actual"
                  type="number"
                  min="0"
                  value={actualCost}
                  onChange={(event) => setActualCost(event.target.value)}
                  className={INPUT}
                />
                <p className="mt-1.5 text-xs text-ink-400">
                  Estimated {formatCurrency(repair.estimatedCost ?? 0, locale)}.
                </p>
                {errors.actualCost && (
                  <p role="alert" className="mt-1.5 text-sm text-red-600">
                    {errors.actualCost}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="stage-condition" className={LABEL}>
                  Condition after repair
                  <RequiredMark />
                </label>
                <select
                  id="stage-condition"
                  value={finalCondition}
                  onChange={(event) => setFinalCondition(event.target.value)}
                  style={SELECT_ARROW}
                  className={SELECT}
                >
                  {['Good', 'Fair', 'Serviceable'].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
              Completing this returns {repair.copyCode} to the shelf. If anyone is waiting for this
              title, they will be notified that it is ready.
            </p>
          </>
        )}

        <div>
          <label htmlFor="stage-note" className={LABEL}>
            Note
          </label>
          <input
            id="stage-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Anything worth recording against this step"
            className={INPUT}
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-ink-100 pt-5 dark:border-ink-800">
          <Action tone="ink" onClick={onClose} disabled={busy}>
            Cancel
          </Action>
          <Action onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : NEXT_STEP[repair.status]?.label ?? `Move to ${to}`}
          </Action>
        </div>
      </div>
      </div>
    </div>
  )
}

function DetailPanel({ repair, repairs, locale, mayCharge, busy, onClose, onStage, onCharge }) {
  const history = historyFor(repairs, repair.bookId, repair.copyNumber).filter(
    (row) => row.id !== repair.id,
  )
  const next = NEXT_STEP[repair.status]

  const dates = [
    ['Damage reported', repair.reportedAt],
    ['Inspected', repair.inspectedAt],
    ['Repair started', repair.startedAt],
    ['Expected completion', repair.expectedAt],
    ['Actual completion', repair.completedAt],
    ['Back on the shelf', repair.availableAt],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 py-10 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Repair ${repair.ref}`}
        className="animate-rise w-full max-w-4xl rounded-xl border border-ink-100 bg-white shadow-xl dark:border-ink-800 dark:bg-ink-900"
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg text-ink-900 dark:text-white">{repair.ref}</h2>
              <Pill tone={STATUS_BADGE[repair.status]}>{repair.status}</Pill>
              <Pill tone={SEVERITY_BADGE[repair.severity]}>{repair.severity}</Pill>
            </div>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              {repair.bookName} · {repair.copyCode} · repair #{repair.sequence} for this copy
            </p>
            <p className="mt-0.5 text-xs text-ink-400">{STATUS_MEANING[repair.status]}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="space-y-5 px-5 py-5">
          <Facts
            legend="The copy"
            rows={[
              ['Book ID', repair.bookCode],
              ['Title', repair.bookName],
              ['Author', repair.author],
              ['ISBN', repair.isbn],
              ['Copy ID', repair.copyCode],
              ['Category', repair.category],
              ['Shelf', repair.shelf],
              ['Currently', repair.open ? 'Off the shelf' : repair.status],
            ]}
          />

          <Facts
            legend="The damage"
            rows={[
              ['Damage type', repair.damageType],
              ['Severity', repair.severity],
              ['Reported by', repair.reportedBy],
              ['Reported on', formatDate(repair.reportedAt, locale)],
              ['Source', repair.source ?? 'Desk'],
              ['Member responsible', repair.memberName ?? 'Not attributed'],
              ['Inspector', repair.inspectedBy ?? '—'],
            ]}
          />

          {repair.description && (
            <p className="rounded-lg border border-ink-100 px-4 py-3 text-sm text-ink-600 dark:border-ink-800 dark:text-ink-300">
              {repair.description}
            </p>
          )}

          <Facts
            legend="Assigned"
            rows={[
              ['Assigned to', repair.assignedTo ?? 'Nobody yet'],
              ['Staff ID', repair.assignedToId ?? '—'],
              ['Role', repair.assignedRole ?? '—'],
              ['Assigned on', repair.assignedAt ? formatDate(repair.assignedAt, locale) : '—'],
            ]}
          />

          {repair.actions && (
            <div className="rounded-lg border border-ink-100 px-4 py-3 dark:border-ink-800">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
                Repair actions
              </p>
              <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{repair.actions}</p>
            </div>
          )}

          <div className="rounded-lg border border-ink-100 p-4 dark:border-ink-800">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
              Cost
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-ink-400">Estimated</p>
                <p className="text-sm text-ink-700 dark:text-ink-200">
                  {repair.estimatedCost === null ? '—' : formatCurrency(repair.estimatedCost, locale)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-400">Actual</p>
                <p className="text-sm font-semibold text-ink-900 dark:text-white">
                  {repair.actualCost === null ? '—' : formatCurrency(repair.actualCost, locale)}
                </p>
              </div>
            </div>
            {repair.chargeAmount ? (
              <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
                {formatCurrency(repair.chargeAmount, locale)} charged to {repair.memberName}.
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-ink-100 p-4 dark:border-ink-800">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
              Dates
            </p>
            <dl className="mt-2 grid gap-3 sm:grid-cols-3">
              {dates.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-ink-400">{label}</dt>
                  <dd className="text-sm text-ink-700 dark:text-ink-200">
                    {value ? formatDate(value, locale) : '—'}
                  </dd>
                </div>
              ))}
            </dl>
            {repair.turnaround !== null && (
              <p className="mt-3 text-sm text-ink-500 dark:text-ink-400">
                Turnaround: <strong className="text-ink-800 dark:text-ink-100">{repair.turnaround} days</strong>{' '}
                from report to completion.
              </p>
            )}
          </div>

          {repair.history.length > 0 && (
            <div className="rounded-lg border border-ink-100 p-4 dark:border-ink-800">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
                This repair, step by step
              </p>
              <ol className="mt-2 space-y-2">
                {repair.history.map((entry) => (
                  <li key={entry.at} className="text-sm text-ink-600 dark:text-ink-300">
                    <span className="text-ink-400">{formatDate(entry.at, locale)}</span>{' '}
                    {entry.from ? `${entry.from} → ` : ''}
                    <strong className="text-ink-800 dark:text-ink-100">{entry.to}</strong>
                    {entry.by ? ` · ${entry.by}` : ''}
                    {entry.note ? ` — ${entry.note}` : ''}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {history.length > 0 && (
            <div className="rounded-lg border border-ink-100 p-4 dark:border-ink-800">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
                {repair.copyCode} has been repaired {history.length + 1} times
              </p>
              <ul className="mt-2 space-y-2">
                {history.map((row) => (
                  <li key={row.id} className="text-sm text-ink-600 dark:text-ink-300">
                    <strong className="text-ink-800 dark:text-ink-100">Repair #{row.sequence}</strong>{' '}
                    · {row.damageType} · {formatDate(row.reportedAt, locale)} ·{' '}
                    {row.actualCost === null ? 'no cost recorded' : formatCurrency(row.actualCost, locale)}{' '}
                    · {row.status}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-ink-500 dark:text-ink-400">
                Spent on this copy so far:{' '}
                <strong className="text-ink-800 dark:text-ink-100">
                  {formatCurrency(
                    [repair, ...history].reduce((sum, row) => sum + (row.actualCost ?? 0), 0),
                    locale,
                  )}
                </strong>
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-ink-100 px-5 py-4 dark:border-ink-800">
          {mayCharge && repair.memberId && !repair.chargeAmount && (
            <Action tone="ink" onClick={onCharge} disabled={busy}>
              Charge {repair.memberName}
            </Action>
          )}
          {next && <Action onClick={() => onStage(next.to)}>{next.label}</Action>}
          <Action tone="ink" onClick={onClose}>
            Close
          </Action>
        </div>
      </div>
    </div>
  )
}
