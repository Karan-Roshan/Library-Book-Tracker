// The counter: lending a copy to a member.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx'
import CounterActions, { useOpenOnArrival } from '../../components/circulation/CounterActions.jsx'
import RecentTable, { VISIBLE_ROWS } from '../../components/circulation/RecentTable.jsx'
import Card from '../../components/dashboard/Card.jsx'
import StatCard from '../../components/dashboard/StatCard.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatDate } from '../../lib/format.js'
import {
  addDays,
  filterIssues,
  issueEligibility,
  filterReturns,
  issueHistory,
  returnHistory,
  borrowDaysFor,
  maxBooksFor,
  openBorrowings,
} from '../../lib/circulation.js'
import { renewalExpiry } from '../../lib/members.js'
import * as circulation from '../../services/circulation.js'
import { useCirculation } from '../../hooks/useCirculation.js'
import { Action, Facts, LABEL, Lookup, INPUT, Verdict } from '../../components/circulation/Shared.jsx'

const dateValue = (date) => new Date(date).toISOString().slice(0, 10)

const ISSUE_FILTERS = {
  query: '',
  status: 'all',
  renewed: 'all',
  origin: 'all',
  category: 'all',
  from: '',
  to: '',
}

const RETURN_FILTERS = {
  query: '',
  timing: 'all',
  condition: 'all',
  fine: 'all',
  category: 'all',
  from: '',
  to: '',
}

export default function IssuePage() {
  const { user } = useAuth()
  const { locale } = usePreferences()
  const desk = useCirculation()

  const [member, setMember] = useState(null)
  const [book, setBook] = useState(null)
  const [issuedAt, setIssuedAt] = useState(dateValue(new Date()))
  const [saving, setSaving] = useState(false)
  const [issued, setIssued] = useState(null)
  const [error, setError] = useState(null)

  const [open, setOpen] = useState(false)

  useOpenOnArrival(useCallback(() => setOpen(true), []))

  useEffect(() => {
    if (!issued) return undefined
    const timer = setTimeout(() => setIssued(null), 5000)
    return () => clearTimeout(timer)
  }, [issued])

  const rules = desk.rules
  const owed = member ? desk.owedBy(member.membershipNumber) : 0

  const current = useMemo(
    () => (member ? (desk.members.find((row) => row.id === member.id) ?? member) : null),
    [member, desk.members],
  )
  const currentBook = useMemo(
    () => (book ? (desk.books.find((row) => row.id === book.id) ?? book) : null),
    [book, desk.books],
  )

  const held = useMemo(
    () => (current ? openBorrowings(desk.borrowings).filter((borrowing) => borrowing.memberId === current.id) : []),
    [current, desk.borrowings],
  )

  const issues = useMemo(() => issueHistory(desk.borrowings), [desk.borrowings])

  const RECENT = VISIBLE_ROWS * 5
  const recentIssues = useMemo(() => issues.slice(0, RECENT), [issues, RECENT])
  const recentReturns = useMemo(
    () => returnHistory(desk.borrowings).slice(0, RECENT),
    [desk.borrowings, RECENT],
  )

  const issueCategories = useMemo(
    () => [...new Set(desk.borrowings.map((row) => row.book?.category).filter(Boolean))].sort(),
    [desk.borrowings],
  )

  const issuedTransaction = useMemo(
    () => (issued ? (desk.borrowings.find((row) => row.id === issued.borrowingId)?.transaction ?? '—') : null),
    [issued, desk.borrowings],
  )

  const ISSUE_FIELDS = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        options: [
          { value: 'all', label: 'Any status' },
          { value: 'Issued', label: 'Still out' },
          { value: 'Returned', label: 'Come back' },
          { value: 'Overdue', label: 'Overdue' },
          { value: 'Lost', label: 'Reported lost' },
        ],
      },
      {
        key: 'renewed',
        label: 'Renewals',
        options: [
          { value: 'all', label: 'Any' },
          { value: 'never', label: 'Never renewed' },
          { value: 'some', label: 'Renewed at least once' },
        ],
      },
      {
        key: 'origin',
        label: 'Written by',
        options: [
          { value: 'all', label: 'Anywhere' },
          { value: 'desk', label: 'This desk' },
          { value: 'seeded', label: 'Opening records' },
        ],
      },
      {
        key: 'category',
        label: 'Category',
        options: [
          { value: 'all', label: 'All categories' },
          ...issueCategories.map((name) => ({ value: name, label: name })),
        ],
      },
      { key: 'from', label: 'Issued on or after', type: 'date' },
      { key: 'to', label: 'Issued on or before', type: 'date' },
    ],
    [issueCategories],
  )

  const RETURN_FIELDS = useMemo(
    () => [
      {
        key: 'timing',
        label: 'Timing',
        options: [
          { value: 'all', label: 'Any' },
          { value: 'ontime', label: 'On time' },
          { value: 'late', label: 'Came back late' },
        ],
      },
      {
        key: 'condition',
        label: 'Condition',
        options: [
          { value: 'all', label: 'Any condition' },
          { value: 'good', label: 'Fit for the shelf' },
          { value: 'damaged', label: 'Sent for repair' },
          { value: 'unrecorded', label: 'Not recorded' },
        ],
      },
      {
        key: 'fine',
        label: 'Fine',
        options: [
          { value: 'all', label: 'Any' },
          { value: 'none', label: 'Nothing owed' },
          { value: 'some', label: 'A charge was raised' },
        ],
      },
      {
        key: 'category',
        label: 'Category',
        options: [
          { value: 'all', label: 'All categories' },
          ...issueCategories.map((name) => ({ value: name, label: name })),
        ],
      },
      { key: 'from', label: 'Returned on or after', type: 'date' },
      { key: 'to', label: 'Returned on or before', type: 'date' },
    ],
    [issueCategories],
  )

  const verdict = useMemo(() => {
    if (!current || !rules) return null
    return issueEligibility({
      member: current,
      book: currentBook,
      borrowings: desk.borrowings,
      owed,
      reservations: desk.reservations,
      rules,
      now: desk.now,
    })
  }, [current, currentBook, desk.borrowings, desk.reservations, owed, rules, desk.now])

  const dueAt = useMemo(
    () => (current && rules ? addDays(issuedAt, borrowDaysFor(current, rules)) : null),
    [current, rules, issuedAt],
  )

  async function handleIssue() {
    setSaving(true)
    setError(null)
    try {
      const lapsed = current.expiresAt && new Date(current.expiresAt) < new Date(issuedAt)

      const borrowing = await circulation.issueBook({
        book: currentBook,
        member: current,
        issuedAt: new Date(issuedAt).toISOString(),
        rules,
        staff: user.name,
        reservations: desk.reservations,
        copies: desk.copies,
      })
      await desk.refresh()
      setIssued({
        borrowingId: borrowing.id,
        book: currentBook,
        member: current,
        dueAt: borrowing.dueAt,
        renewed: lapsed ? renewalExpiry(issuedAt).toISOString() : null,
      })
      setBook(null)
      setMember(null)

      setOpen(false)
    } catch (problem) {
      setError(problem.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="mt-1 font-display text-2xl font-bold text-ink-900 dark:text-white">
            Issue / Return
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Lend a copy to a member, or take one back — the checks run before the book leaves the desk.
          </p>
        </div>

        <CounterActions here="issue" onOpen={() => setOpen(true)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Currently borrowed" value={desk.stats.outNow} />
        <StatCard label="Issued today" value={desk.stats.issuedToday} />
        <StatCard label="Due today" value={desk.stats.dueToday} />
        <StatCard label="Overdue" value={desk.stats.overdue} />
      </div>

      {issued && (
        <div
          role="status"
          className="animate-rise fixed left-1/2 top-20 z-50 w-[min(32rem,90vw)] -translate-x-1/2 lg:left-[calc(50%+8rem)]"
        >
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-lg dark:border-emerald-500/40 dark:bg-ink-800">
            <p className="font-semibold text-emerald-900 dark:text-emerald-200">
              {issuedTransaction} — {issued.book.title} issued to {issued.member.name}
            </p>
            <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
              Due back {formatDate(issued.dueAt, locale)}. The member can be sent a confirmation
              from Notifications.
            </p>

            {issued.renewed && (
              <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
                Their lapsed membership was renewed, valid until{' '}
                {formatDate(issued.renewed, locale)}.
              </p>
            )}
          </div>
        </div>
      )}

      {open && (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 py-10 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Issue a book"
          className="animate-rise w-full max-w-2xl rounded-xl border border-ink-100 bg-white shadow-xl dark:border-ink-800 dark:bg-ink-900"
        >
          <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
            <div>
              <h2 className="font-display text-lg text-ink-900 dark:text-white">At the counter</h2>
              <p className="mt-0.5 text-xs text-ink-400">Borrower first, then the copy.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
                <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </header>
        <div className="space-y-5 p-5">
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Lookup
              label="Member"
              required
              autoFocus
              placeholder="Card number, name, email or phone"
              items={desk.members}
              value={current}
              onSelect={setMember}
              search={(row) => [row.membershipNumber, row.name, row.email, row.phone]}
              describe={(row) => `${row.name} · ${row.membershipNumber} · ${row.email}`}
            />

            <Lookup
              label="Book copy"
              required
              placeholder="Title, book ID, ISBN, author or shelf"
              items={desk.books}
              value={currentBook}
              onSelect={setBook}
              search={(row) => [row.title, row.code, row.isbn, row.author, row.shelf]}
              describe={(row) =>
                `${row.title} · ${row.code} · ${row.available}/${row.copies} on the shelf`
              }
            />
          </div>

          {current && rules && (
            <Facts
              legend="The borrower"
              rows={[
                ['Member ID', current.membershipNumber],
                ['Status', current.status],
                ['Membership expires', current.expiresAt ? formatDate(current.expiresAt, locale) : '—'],
                ['Books out', `${held.length} of ${maxBooksFor(current, rules)}`],
                ['Unpaid fines', owed > 0 ? `₹${owed}` : 'None'],
              ]}
            />
          )}

          {currentBook && (
            <Facts
              legend="The copy in hand"
              rows={[
                ['Book ID', currentBook.code],
                ['Title', currentBook.title],
                ['Author', currentBook.author],
                ['Category', currentBook.category],
                ['Shelf', currentBook.shelf],
                ['Available', `${currentBook.available} of ${currentBook.copies}`],
              ]}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="issue-date" className={LABEL}>
                Issue date
              </label>
              <input
                id="issue-date"
                type="date"
                value={issuedAt}
                onChange={(event) => setIssuedAt(event.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Due date</label>

              <p className="rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-[0.95rem] text-ink-700 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-200">
                {dueAt ? formatDate(dueAt, locale) : '—'}
              </p>
              <p className="mt-1.5 text-xs text-ink-400">
                {`${borrowDaysFor(current, rules ?? desk.rules)} days from the issue date.`}
              </p>
            </div>
            <div>
              <label className={LABEL}>Issued by</label>
              <p className="rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-[0.95rem] text-ink-700 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-200">
                {user.name}
              </p>
            </div>
          </div>

          <Verdict result={verdict} />

          <div className="flex justify-end gap-3 border-t border-ink-100 pt-5 dark:border-ink-800">
            <Action
              tone="ink"
              onClick={() => {
                setMember(null)
                setBook(null)
                setIssued(null)
              }}
              disabled={saving}
            >
              Clear
            </Action>
            <Action
              onClick={handleIssue}
              disabled={saving || !current || !currentBook || !verdict?.ok}
            >
              {saving ? 'Issuing…' : 'Issue book'}
            </Action>
          </div>
        </div>
        </div>
      </div>
      )}

      {current && held.length > 0 && (
        <Card title={`${current.name} currently has ${held.length} out`}>
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {held.map((borrowing) => (
              <li key={borrowing.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="text-sm text-ink-700 dark:text-ink-200">
                  {borrowing.bookTitle}{' '}
                  <span className="text-ink-400">· {borrowing.transaction}</span>
                </span>
                <span
                  className={`text-sm ${borrowing.status === 'Overdue' ? 'font-semibold text-red-600 dark:text-red-400' : 'text-ink-400'}`}
                >
                  {borrowing.status === 'Overdue'
                    ? `${borrowing.daysOverdue} days overdue · ₹${borrowing.fine}`
                    : `Due ${formatDate(borrowing.dueAt, locale)}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6">
        <RecentTable
          title="Recent issues"
          subtitle={`Last ${VISIBLE_ROWS} shown · scroll for more`}
          rows={recentIssues}
          noun="issues"
          empty="Nothing has gone out yet."
          apply={filterIssues}
          cleared={ISSUE_FILTERS}
          placeholder="Search transaction, member, card number, title or copy…"
          fields={ISSUE_FIELDS}
          columns={[
            {
              label: 'Transaction',
              cell: (row) => (
                <span className="font-medium text-ink-800 dark:text-ink-100">{row.transaction}</span>
              ),
            },
            {
              label: 'Book',
              cell: (row) => (
                <>
                  <span className="font-medium text-ink-800 dark:text-ink-100">{row.bookTitle}</span>
                  <span className="block text-xs text-ink-400">{row.copyId ?? '—'}</span>
                </>
              ),
            },
            {
              label: 'Member',
              cell: (row) => (
                <>
                  {row.memberName}
                  <span className="block text-xs text-ink-400">{row.memberNumber}</span>
                </>
              ),
            },
            { label: 'Issued', cell: (row) => formatDate(row.issuedAt, locale) },
            {
              label: 'Due',
              align: 'right',
              cell: (row) => (
                <span
                  className={
                    row.status === 'Overdue' ? 'font-semibold text-red-600 dark:text-red-400' : ''
                  }
                >
                  {formatDate(row.dueAt, locale)}
                </span>
              ),
            },
          ]}
        />

        <RecentTable
          title="Recent returns"
          subtitle={`Last ${VISIBLE_ROWS} shown · scroll for more`}
          rows={recentReturns}
          noun="returns"
          empty="Nothing has come back yet."
          apply={filterReturns}
          cleared={RETURN_FILTERS}
          placeholder="Search transaction, member, card number, title or copy…"
          fields={RETURN_FIELDS}
          columns={[
            {
              label: 'Transaction',
              cell: (row) => (
                <span className="font-medium text-ink-800 dark:text-ink-100">{row.transaction}</span>
              ),
            },
            {
              label: 'Book',
              cell: (row) => (
                <>
                  <span className="font-medium text-ink-800 dark:text-ink-100">{row.bookTitle}</span>
                  <span className="block text-xs text-ink-400">{row.copyId ?? '—'}</span>
                </>
              ),
            },
            {
              label: 'Member',
              cell: (row) => (
                <>
                  {row.memberName}
                  <span className="block text-xs text-ink-400">{row.memberNumber}</span>
                </>
              ),
            },
            { label: 'Returned', cell: (row) => formatDate(row.returnedAt, locale) },
            {
              label: 'Condition',
              align: 'right',

              cell: (row) =>
                row.lateBy > 0 ? (
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {row.lateBy} day{row.lateBy === 1 ? '' : 's'} late
                  </span>
                ) : (
                  <span className="text-ink-400">{row.returnCondition ?? 'On time'}</span>
                ),
            },
          ]}
        />
      </div>

    </div>
  )
}
