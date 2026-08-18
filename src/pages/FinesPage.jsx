// Fines owed and collected, and raising a new one.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLive } from '../hooks/useLive.js'
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx'
import Card from '../components/dashboard/Card.jsx'
import StatCard from '../components/dashboard/StatCard.jsx'
import TextField, { RequiredMark } from '../components/TextField.jsx'
import Alert from '../components/Alert.jsx'
import RowMenu, { ACTION_CELL, ACTION_HEAD } from '../components/dashboard/RowMenu.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { usePageSize } from '../hooks/useTablePrefs.js'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { useCirculation } from '../hooks/useCirculation.js'
import { library } from '../data/demoLibrary.js'
import { formatCurrency, formatDate } from '../lib/format.js'
import {
  FINE_BORROW_DAYS,
  FINE_REASONS,
  bookCode,
  buildFineRecords,
  LOST_REASON,
  reasonTotal,
  summarizeFines,
} from '../lib/fines.js'
import { downloadFile, toCSV } from '../lib/csv.js'
import { allBorrowings } from '../lib/books.js'
import * as booksService from '../services/books.js'
import { DAMAGE_FROM_FAULT, repairableFrom } from '../lib/repairs.js'
import * as repairsService from '../services/repairs.js'
import * as fines from '../services/fines.js'
import { getRules } from '../services/circulation.js'

const CSV_COLUMNS = [
  ['Fine ID', (row) => row.fineId],
  ['Member Name', (row) => row.memberName],
  ['Member ID', (row) => row.memberId],
  ['Book ID', (row) => row.bookId],
  ['Book Name', (row) => row.bookName],
  ['Issue Date', (row) => row.issueDate?.slice(0, 10) ?? ''],
  ['Due Date', (row) => row.dueDate?.slice(0, 10) ?? ''],
  ['Return Date', (row) => row.returnDate?.slice(0, 10) ?? ''],
  ['Days Overdue', (row) => row.daysOverdue],
  ['Fine Rate', (row) => row.rate ?? ''],
  ['Reason', (row) => row.reason],
  ['Fine Amount', (row) => row.amount],
  ['Status', (row) => row.status],
  ['Payment Date', (row) => row.settledAt?.slice(0, 10) ?? ''],
  ['Collected By', (row) => row.collectedBy ?? ''],
]

const COLUMNS = [
  'Fine ID',
  'Member Name',
  'Member ID',
  'Book ID',
  'Book Name',
  'Issue Date',
  'Due Date',
  'Return Date',
  'Days Overdue',
  'Reason',
  'Fine Amount',
  'Status',
  'Payment Date',
  'Collected By',
]

const REASONS = [
  'Damaged binding',
  'Torn or missing pages',
  'Water damage',
  'Marked or written in',
  'Lost book',
]

const EMPTY = {
  memberId: '',
  memberName: '',
  bookId: '',
  bookName: '',
  reasons: [],
  issueDate: '',
  dueDate: '',
}

const dateValue = (date) => new Date(date).toISOString().slice(0, 10)

const LABEL =
  'mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400'
const INPUT =
  'w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-white'

const dueFor = (issue) => {
  if (!issue) return ''
  const due = new Date(issue)
  due.setDate(due.getDate() + FINE_BORROW_DAYS)
  return dateValue(due)
}

const STICKY = {
  'Fine ID': 'sticky left-0 w-28 min-w-28',
  'Member Name': 'sticky left-28 w-44 min-w-44 border-r border-ink-100 dark:border-ink-800',
}

const stripeFor = (index) =>
  index % 2 === 0 ? 'bg-white dark:bg-ink-900' : 'bg-ink-50 dark:bg-ink-800'

const ROW_HOVER = 'hover:bg-brass-50 dark:hover:bg-ink-800'
const STICKY_HOVER = 'group-hover:bg-brass-50 dark:group-hover:bg-ink-800'

const PAGE_SIZES = [50, 100, 250, 500]

export default function FinesPage() {
  const { user } = useAuth()
  const { locale } = usePreferences()

  const [manual, setManual] = useState([])

  const [rules, setRules] = useState(null)
  const [payments, setPayments] = useState({})
  const [issued, setIssued] = useState([])
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePageSize(PAGE_SIZES)

  const now = useMemo(() => new Date(), [])

  // The composed catalogue and register, so a fine raised against someone added
  // at the desk is named rather than left as a dash.
  const desk = useCirculation()

  const refresh = useCallback(() => {
    Promise.all([
      fines.listManualFines(),
      fines.listPayments(),
      booksService.listIssuedBorrowings(),
      getRules(),
    ]).then(([rows, paid, borrowings, active]) => {
      setManual(rows)
      setPayments(paid)
      setIssued(borrowings)
      setRules(active)
    })
  }, [])

  useEffect(refresh, [refresh])

  useLive(['manualFines', 'issuedBorrowings', 'values/finePayments'], refresh)

  const withIssued = useMemo(() => ({ ...library, borrowings: allBorrowings(library, issued) }), [issued])

  const records = useMemo(
    () =>
      buildFineRecords({
        library: withIssued,
        books: desk.books,
        members: desk.members,
        manualFines: manual,
        payments,
        now,
        rate: rules?.finePerDay,
        cap: rules?.maxFine,
        grace: rules?.graceDays,
      }),
    [withIssued, desk.books, desk.members, manual, payments, now, rules],
  )

  const stats = useMemo(() => summarizeFines(records, now), [records, now])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return records.filter((record) => {
      if (filter === 'pending' && record.settled) return false
      if (filter === 'paid' && !record.settled) return false
      if (!term) return true
      return [record.fineId, record.memberId, record.memberName, record.bookId, record.bookName]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [records, filter, query])

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))

  useEffect(() => {
    setPage(1)
  }, [filter, query, pageSize])

  const paged = useMemo(() => {
    const safePage = Math.min(page, totalPages)
    return visible.slice((safePage - 1) * pageSize, safePage * pageSize)
  }, [visible, page, totalPages, pageSize])

  const firstRow = visible.length === 0 ? 0 : (Math.min(page, totalPages) - 1) * pageSize + 1
  const lastRow = Math.min(Math.min(page, totalPages) * pageSize, visible.length)

  const [pageInput, setPageInput] = useState('1')
  useEffect(() => setPageInput(String(Math.min(page, totalPages))), [page, totalPages])

  const commitPage = () => {
    const wanted = Number.parseInt(pageInput, 10)

    if (Number.isNaN(wanted)) return setPageInput(String(page))
    setPage(Math.min(Math.max(1, wanted), totalPages))
  }

  const setMemberById = (value) => {
    const match = withIssued.members.find(
      (row) => row.membershipNumber.toLowerCase() === value.trim().toLowerCase(),
    )
    setValues((current) => ({
      ...current,
      memberId: value,
      memberName: match ? match.name : current.memberName,

      ...(match ? { bookId: '', bookName: '', issueDate: '', dueDate: '' } : {}),
    }))
  }

  const setMemberByName = (value) => {
    const match = withIssued.members.find(
      (row) => row.name.toLowerCase() === value.trim().toLowerCase(),
    )
    setValues((current) => ({
      ...current,
      memberName: value,
      memberId: match ? match.membershipNumber : current.memberId,
      ...(match ? { bookId: '', bookName: '', issueDate: '', dueDate: '' } : {}),
    }))
  }

  const borrowed = useMemo(() => {
    const member = withIssued.members.find(
      (row) => row.membershipNumber.toLowerCase() === values.memberId.trim().toLowerCase(),
    )
    if (!member) return []

    return withIssued.borrowings
      .filter((borrowing) => borrowing.memberId === member.id && !borrowing.returnedAt)
      .map((borrowing) => ({ borrowing, book: withIssued.books.find((row) => row.id === borrowing.bookId) }))
      .filter((entry) => entry.book)
      .sort((a, b) => new Date(b.borrowing.issuedAt) - new Date(a.borrowing.issuedAt))
  }, [values.memberId, withIssued])

  const holders = useMemo(() => {
    const out = new Set(
      withIssued.borrowings.filter((borrowing) => !borrowing.returnedAt).map((borrowing) => borrowing.memberId),
    )
    return withIssued.members
      .filter((member) => out.has(member.id))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [withIssued])

  const chooseBook = (entry) =>
    setValues((current) => ({
      ...current,
      bookId: bookCode(entry.book.id),
      bookName: entry.book.title,
      issueDate: dateValue(entry.borrowing.issuedAt),
      dueDate: dueFor(entry.borrowing.issuedAt),
    }))

  const setBookById = (value) => {
    const entry = borrowed.find(
      (row) => bookCode(row.book.id).toLowerCase() === value.trim().toLowerCase(),
    )
    if (entry) return chooseBook(entry)
    setValues((current) => ({ ...current, bookId: value }))
  }

  const setBookByName = (value) => {
    const entry = borrowed.find((row) => row.book.title.toLowerCase() === value.trim().toLowerCase())
    if (entry) return chooseBook(entry)
    setValues((current) => ({ ...current, bookName: value }))
  }

  const toggleReason = (label) =>
    setValues((current) => ({
      ...current,
      reasons: current.reasons.includes(label)
        ? current.reasons.filter((entry) => entry !== label)
        : [...current.reasons, label],
    }))

  const chosenBook = useMemo(
    () => borrowed.find(({ book }) => bookCode(book.id) === values.bookId.trim())?.book ?? null,
    [borrowed, values.bookId],
  )

  const amount = reasonTotal(values.reasons, chosenBook?.price)

  async function handleAdd(event) {
    event.preventDefault()

    const member = withIssued.members.find(
      (row) => row.membershipNumber.toLowerCase() === values.memberId.trim().toLowerCase(),
    )
    const entry = borrowed.find(
      (row) => bookCode(row.book.id).toLowerCase() === values.bookId.trim().toLowerCase(),
    )

    const nextErrors = {
      memberId: member ? null : 'No member with that ID.',
      bookId: entry ? null : 'Choose a book this member currently has out.',
      reasons: values.reasons.length ? null : 'Choose at least one reason.',
      issueDate: values.issueDate ? null : 'Choose the issue date.',
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    const details = {
      memberId: member.membershipNumber,
      bookId: bookCode(entry.book.id),
      reasons: values.reasons,
      amount,
      issueDate: new Date(values.issueDate).toISOString(),
      dueDate: new Date(values.dueDate || dueFor(values.issueDate)).toISOString(),
    }

    if (editingId) {
      await fines.updateManualFine(editingId, details)
    } else {
      const fine = await fines.addManualFine(details)

      const faults = repairableFrom(values.reasons)
      if (faults.length > 0) {
        await repairsService.raiseRepair({
          bookId: entry.book.id,
          bookCode: bookCode(entry.book.id),
          bookName: entry.book.title,
          damageType: DAMAGE_FROM_FAULT[faults[0]] ?? 'Torn pages',
          description: faults.join(', '),
          severity: faults.length > 1 ? 'Major' : 'Moderate',
          reportedBy: user.name,
          source: 'Condition fine',
          memberId: entry.member?.id ?? null,
          memberName: values.memberName || entry.member?.name || null,
          fineId: fine.id,
        })
      }
    }

    setValues(EMPTY)
    setAdding(false)
    setEditingId(null)
    setNotice(
      editingId
        ? `Fine against ${member.name} updated.`
        : `Fine of ${formatCurrency(amount, locale)} raised against ${member.name}.`,
    )
    refresh()
  }

  function startEdit(record) {
    setValues({
      memberId: record.memberId,
      memberName: record.memberName,
      bookId: record.bookId,
      bookName: record.bookName,

      reasons: record.reasons ?? String(record.reason ?? '').split(', ').filter(Boolean),
      issueDate: record.issueDate ? record.issueDate.slice(0, 10) : '',
      dueDate: record.dueDate ? record.dueDate.slice(0, 10) : '',
    })
    setEditingId(record.manualId)
    setErrors({})
    setAdding(true)
    setNotice(null)
  }

  async function removeFine(record) {
    await fines.removeManualFine(record.manualId)
    setNotice(`${record.fineId} removed.`)
    refresh()
  }

  function handleExport() {
    downloadFile(
      `fines-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(visible, CSV_COLUMNS),
    )
  }

  async function markPaid(record) {
    await fines.recordPayment(record.key, user.name, {
      target: `${record.memberName} · ${record.bookName}`,
      fineId: record.fineId,
      amount: record.amount,
    })
    setNotice(`${record.fineId} marked as collected.`)
    refresh()
  }

  const cell = 'whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="mt-2 font-display text-2xl text-ink-900 dark:text-white">
            Fine Management
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Overdue charges and condition fines, and what has been collected.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setAdding((state) => !state)
              setNotice(null)
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brass-500"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
              <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Raise a fine
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={visible.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300 dark:bg-ink-700 dark:hover:bg-ink-600"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
              <path
                d="M10 3.5v9m0 0l-3-3m3 3l3-3M4 15.5h12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {notice && <Alert tone="info">{notice}</Alert>}

      <section aria-label="Fine statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          align="center"
          label="Total Fines Collected"
          value={formatCurrency(stats.totalCollected, locale)}
          tone="good"
          hint="All time"
        />
        <StatCard
          align="center"
          label="Pending Fines"
          value={formatCurrency(stats.pending, locale)}
          tone="alert"
          hint={`${stats.pendingCount} uncollected`}
        />
        <StatCard
          align="center"
          label="Today's Fine Collection"
          value={formatCurrency(stats.today, locale)}
          tone="brass"
          hint="Taken at the desk today"
        />
        <StatCard
          align="center"
          label="This Month's Collection"
          value={formatCurrency(stats.month, locale)}
          hint="Month to date"
        />
      </section>

      {adding && (
        <Card
          title={editingId ? 'Edit fine' : 'Raise a fine'}
          subtitle="For damage, poor condition, or a lost book"
        >
          <form onSubmit={handleAdd} noValidate className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Member ID"
                list="member-ids"
                value={values.memberId}
                onChange={(event) => setMemberById(event.target.value)}
                error={errors.memberId}
                placeholder="Athena-03.08.2026-001"
                hint={`${holders.length} members currently hold a book`}
                required
              />
              <TextField
                label="Member name"
                list="member-names"
                value={values.memberName}
                onChange={(event) => setMemberByName(event.target.value)}
                placeholder="Fills in from the ID"
              />
              <TextField
                label="Book ID"
                list="book-ids"
                value={values.bookId}
                onChange={(event) => setBookById(event.target.value)}
                error={errors.bookId}
                placeholder={values.memberId ? 'BK-001' : 'Choose a member first'}
                hint={
                  values.memberId
                    ? `${borrowed.length} book${borrowed.length === 1 ? '' : 's'} currently out with this member`
                    : undefined
                }
                required
              />
              <TextField
                label="Book name"
                list="book-names"
                value={values.bookName}
                onChange={(event) => setBookByName(event.target.value)}
                placeholder="Fills in from the ID"
              />

              <div>
                <label htmlFor="fine-issue" className={LABEL}>
                  Issue date
                  <RequiredMark />
                </label>
                <input
                  id="fine-issue"
                  type="date"
                  value={values.issueDate}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      issueDate: event.target.value,
                      dueDate: dueFor(event.target.value),
                    }))
                  }
                  className={INPUT}
                />
                {errors.issueDate && (
                  <p role="alert" className="mt-1.5 text-sm text-red-600">
                    {errors.issueDate}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="fine-due" className={LABEL}>
                  Due date
                </label>

                <input
                  id="fine-due"
                  type="date"
                  value={values.dueDate}
                  readOnly
                  tabIndex={-1}
                  className="w-full cursor-not-allowed rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-[0.95rem] text-ink-500 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-400"
                />
                <p className="mt-1.5 text-sm text-ink-400">
                  {FINE_BORROW_DAYS} days from the issue date.
                </p>
              </div>
            </div>

            <fieldset>
              <legend className={LABEL}>
                Reason for fine
                <RequiredMark />
              </legend>

              <div className="grid gap-2 sm:grid-cols-2">
                {FINE_REASONS.map((reason) => (
                  <label
                    key={reason.label}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      values.reasons.includes(reason.label)
                        ? 'border-brass-500 bg-brass-50 text-brass-900 dark:bg-brass-500/10 dark:text-brass-200'
                        : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={values.reasons.includes(reason.label)}
                        onChange={() => toggleReason(reason.label)}
                        className="h-4 w-4 rounded border-ink-300 accent-brass-600"
                      />
                      {reason.label}
                    </span>

                    <span className="font-semibold">
                      {reason.label === LOST_REASON && chosenBook?.price
                        ? formatCurrency(chosenBook.price, locale)
                        : formatCurrency(reason.amount, locale)}
                      {reason.label === LOST_REASON && (
                        <span className="ml-1.5 text-xs font-normal text-ink-400">
                          {chosenBook?.price ? 'this book' : 'choose a book'}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              {errors.reasons && (
                <p role="alert" className="mt-1.5 text-sm text-red-600">
                  {errors.reasons}
                </p>
              )}
            </fieldset>

            <div className="flex items-center justify-between rounded-lg border border-ink-100 bg-ink-50 px-4 py-3 dark:border-ink-700 dark:bg-ink-800">
              <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">
                Fine amount
              </span>
              <span className="text-xl font-semibold text-ink-900 dark:text-white">
                {formatCurrency(amount, locale)}
              </span>
            </div>

            <datalist id="member-ids">
              {holders.map((member) => (
                <option key={member.id} value={member.membershipNumber}>
                  {member.name}
                </option>
              ))}
            </datalist>
            <datalist id="member-names">
              {holders.map((member) => (
                <option key={member.id} value={member.name} />
              ))}
            </datalist>
            <datalist id="book-ids">
              {borrowed.map(({ book }) => (
                <option key={book.id} value={bookCode(book.id)}>
                  {book.title}
                </option>
              ))}
            </datalist>
            <datalist id="book-names">
              {borrowed.map(({ book }) => (
                <option key={book.id} value={book.title} />
              ))}
            </datalist>

            <div className="flex justify-end gap-3 border-t border-ink-100 pt-5 dark:border-ink-800">
              <button
                type="button"
                onClick={() => {
                  setAdding(false)
                  setEditingId(null)
                  setValues(EMPTY)
                  setErrors({})
                }}
                className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500"
              >
                {editingId ? 'Save changes' : 'Raise fine'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="Fine Records"

        subtitle={
          visible.length === records.length
            ? `${records.length} fines`
            : `${visible.length} of ${records.length} match`
        }
        padded={false}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search member, book, ..."
              aria-label="Search fines"

              className="h-9 w-52 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-white"
            />
            <div className="flex h-9 items-center rounded-lg border border-ink-200 p-0.5 dark:border-ink-700">
              {['all', 'pending', 'paid'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  aria-pressed={filter === option}
                  className={`flex h-full items-center rounded-md px-3 text-xs font-semibold capitalize transition-colors ${
                    filter === option
                      ? 'bg-ink-900 text-white dark:bg-brass-600'
                      : 'text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-900 text-left dark:bg-ink-950">
                {COLUMNS.map((column) => (
                  <th
                    key={column}
                    className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-brass-200 ${
                      STICKY[column] ? `${STICKY[column]} z-20 bg-ink-900 dark:bg-ink-950` : ''
                    }`}
                  >
                    {column}
                  </th>
                ))}
                <th className={ACTION_HEAD} />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-sm text-ink-400">
                    No fines match that view.
                  </td>
                </tr>
              )}
              {paged.map((record, index) => {
                const stripe = stripeFor(index)
                return (
                <tr
                  key={record.key}
                  className={`group border-b border-ink-100/70 transition-colors last:border-0 ${stripe} ${ROW_HOVER} dark:border-ink-800/60`}
                >
                  <td
                    className={`${cell} z-10 font-medium text-ink-900 dark:text-white ${STICKY['Fine ID']} ${stripe} ${STICKY_HOVER}`}
                  >
                    {record.fineId}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-ink-700 dark:text-ink-200 z-10 ${STICKY['Member Name']} ${stripe} ${STICKY_HOVER}`}
                  >
                    {record.memberName}
                  </td>
                  <td className={cell}>{record.memberId}</td>
                  <td className={cell}>{record.bookId}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-700 dark:text-ink-200">
                    {record.bookName}
                  </td>
                  <td className={cell}>
                    {record.issueDate ? formatDate(record.issueDate, locale) : '—'}
                  </td>
                  <td className={cell}>
                    {record.dueDate ? formatDate(record.dueDate, locale) : '—'}
                  </td>
                  <td className={cell}>
                    {record.returnDate ? formatDate(record.returnDate, locale) : 'Not returned'}
                  </td>
                  <td className={cell}>{record.daysOverdue || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-700 dark:text-ink-200">
                    {record.reason}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink-900 dark:text-white">
                    {formatCurrency(record.amount, locale)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        record.settled
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                          : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300'
                      }`}
                    >
                      {record.status}
                    </span>
                  </td>
                  <td className={cell}>
                    {record.settledAt ? formatDate(record.settledAt, locale) : '—'}
                  </td>
                  <td className={cell}>{record.collectedBy ?? '—'}</td>
                  <td className={`${ACTION_CELL} ${stripe} ${STICKY_HOVER}`}>
                    <RowMenu
                      label={`Actions for ${record.fineId}`}
                      items={[
                        ...(record.settled
                          ? []
                          : [{ label: 'Collect payment', onSelect: () => markPaid(record) }]),

                        ...(record.kind === 'manual'
                          ? [
                              { label: 'Edit fine', onSelect: () => startEdit(record) },
                              {
                                label: 'Delete fine',
                                tone: 'danger',
                                onSelect: () => removeFine(record),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {visible.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 dark:border-ink-800">
            <div className="flex items-center gap-3">
              <p className="text-xs text-ink-400">
                Showing {firstRow}–{lastRow} of {visible.length}
              </p>

              <label className="flex items-center gap-1.5 text-xs text-ink-400">
                Rows
                <div className="relative">
                  <select
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                    className="h-8 appearance-none rounded-lg border border-ink-200 bg-white bg-[length:0.8rem] bg-[position:right_0.6rem_center] bg-no-repeat py-0 pl-2.5 pr-8 text-xs font-semibold text-ink-700 focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <svg
                    viewBox="0 0 20 20"
                    className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              </label>
            </div>

            {totalPages > 1 && (
              <nav aria-label="Fine records pages" className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-white transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-400 dark:bg-ink-700 dark:hover:bg-ink-600 dark:disabled:bg-ink-800 dark:disabled:text-ink-600"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                    <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <span className="flex items-center gap-1.5 text-xs text-ink-400">
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={pageInput}
                    aria-label={`Page number, 1 to ${totalPages}`}
                    onChange={(event) => setPageInput(event.target.value)}
                    onBlur={commitPage}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commitPage()
                      }
                    }}
                    className="h-8 w-14 rounded-lg border border-ink-200 bg-white px-2 text-center text-xs font-semibold text-ink-900 focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-white"
                  />
                  of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                  aria-label="Next page"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-white transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-400 dark:bg-ink-700 dark:hover:bg-ink-600 dark:disabled:bg-ink-800 dark:disabled:text-ink-600"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                    <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </nav>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
