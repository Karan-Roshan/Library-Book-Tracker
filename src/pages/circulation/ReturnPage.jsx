// The counter: taking a copy back and recording its condition.

import { useCallback, useMemo, useState } from 'react'
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx'
import CounterActions, { useOpenOnArrival } from '../../components/circulation/CounterActions.jsx'
import History from '../../components/circulation/History.jsx'
import Card from '../../components/dashboard/Card.jsx'
import StatCard from '../../components/dashboard/StatCard.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { CAPABILITIES, can } from '../../lib/permissions.js'
import { formatCurrency, formatDate } from '../../lib/format.js'
import {
  BORROWING_BADGE,
  NEEDS_REPAIR,
  RETURN_CONDITIONS,
  filterReturns,
  openBorrowings,
  returnHistory,
} from '../../lib/circulation.js'
import * as circulation from '../../services/circulation.js'
import { useCirculation } from '../../hooks/useCirculation.js'
import {
  Action,
  Facts,
  INPUT,
  LABEL,
  Lookup,
  Pill,
  SELECT,
  SELECT_ARROW,
} from '../../components/circulation/Shared.jsx'

const RETURN_FILTERS = {
  query: '',
  timing: 'all',
  condition: 'all',
  fine: 'all',
  category: 'all',
  from: '',
  to: '',
}

export default function ReturnPage() {
  const { user } = useAuth()
  const { locale } = usePreferences()
  const desk = useCirculation()

  const [borrowing, setBorrowing] = useState(null)
  const [condition, setCondition] = useState('Good')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)
  const [error, setError] = useState(null)

  const [counterOpen, setCounterOpen] = useState(false)

  useOpenOnArrival(useCallback(() => setCounterOpen(true), []))

  const open = useMemo(() => openBorrowings(desk.borrowings), [desk.borrowings])

  const returns = useMemo(() => returnHistory(desk.borrowings), [desk.borrowings])

  const returnCategories = useMemo(
    () => [...new Set(returns.map((row) => row.book?.category).filter(Boolean))].sort(),
    [returns],
  )

  const current = useMemo(
    () => (borrowing ? (desk.borrowings.find((row) => row.id === borrowing.id) ?? borrowing) : null),
    [borrowing, desk.borrowings],
  )

  async function handleReturn() {
    setSaving(true)
    setError(null)
    try {
      const result = await circulation.returnBook(current, {
        condition,
        notes,
        staff: user.name,
        reservations: desk.reservations,

        openRepairs: desk.openRepairs,
      })
      await desk.refresh()
      setDone({
        borrowing: current,
        condition,
        fine: current.daysOverdue > 0 ? current.fine : 0,
        ...result,
      })
      setBorrowing(null)
      setCondition('Good')
      setNotes('')

      setCounterOpen(false)
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
            Take a copy back, or lend one out — the overdue charge is worked out from the borrowing's own dates.
          </p>
        </div>

        <CounterActions here="return" onOpen={() => setCounterOpen(true)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Currently borrowed" value={desk.stats.outNow} />
        <StatCard label="Returned today" value={desk.stats.returnedToday} />
        <StatCard label="Due today" value={desk.stats.dueToday} />
        <StatCard label="Overdue" value={desk.stats.overdue} />
      </div>

      {done && (
        <div className="space-y-1 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-500/40 dark:bg-emerald-500/10">
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">
            {done.borrowing.bookTitle} returned by {done.borrowing.memberName}.
          </p>
          {done.fine > 0 && (
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              {done.borrowing.daysOverdue} days overdue — ₹{done.fine} is now pending in Fine Management.
            </p>
          )}
          {done.repairRaised && (
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              Recorded as {done.condition}; a repair job has been raised and the copy is held back
              from the shelf.
            </p>
          )}
          {done.calledNext && (
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              {done.calledNext.memberName} was next in the queue and has been notified to collect it.
            </p>
          )}
        </div>
      )}

      {counterOpen && (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 py-10 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Return a book"
          className="animate-rise w-full max-w-2xl rounded-xl border border-ink-100 bg-white shadow-xl dark:border-ink-800 dark:bg-ink-900"
        >
          <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
            <div>
              <h2 className="font-display text-lg text-ink-900 dark:text-white">At the counter</h2>
              <p className="mt-0.5 text-xs text-ink-400">The book first, then its condition.</p>
            </div>
            <button
              type="button"
              onClick={() => setCounterOpen(false)}
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

          <Lookup
            label="Borrowed book"
            required
            autoFocus
            placeholder="Transaction ID, member, card number, book ID or title"
            items={open}
            value={current}
            onSelect={setBorrowing}
            search={(row) => [
              row.transaction,
              row.memberName,
              row.memberNumber,
              row.bookTitle,
              row.book?.code,
            ]}
            describe={(row) =>
              `${row.transaction} · ${row.bookTitle} · ${row.memberName} · due ${formatDate(row.dueAt, locale)}`
            }
          />

          {current && (
            <>
              <Facts
                legend="The borrowing"
                rows={[
                  ['Transaction', current.transaction],
                  ['Book', `${current.bookTitle} (${current.book?.code ?? '—'})`],
                  ['Member', `${current.memberName} · ${current.memberNumber}`],
                  ['Issued', formatDate(current.issuedAt, locale)],
                  ['Due', formatDate(current.dueAt, locale)],
                  ['Renewed', current.renewalCount ? `${current.renewalCount} time(s)` : 'No'],
                ]}
              />

              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  current.daysOverdue > 0
                    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                }`}
              >
                {current.daysOverdue > 0 ? (
                  <>
                    <span className="font-semibold">
                      {current.daysOverdue} days overdue — ₹{current.fine} due.
                    </span>{' '}
                    Charged at ₹{desk.rules?.finePerDay ?? 5} a day, capped at ₹
                    {desk.rules?.maxFine ?? 300}. Collect it in Fine Management.
                  </>
                ) : (
                  <span className="font-semibold">Returned on time — nothing to charge.</span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="return-condition" className={LABEL}>
                    Condition on return
                  </label>
                  <select
                    id="return-condition"
                    value={condition}
                    onChange={(event) => setCondition(event.target.value)}
                    style={SELECT_ARROW}
                    className={SELECT}
                  >
                    {RETURN_CONDITIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-ink-400">
                    {NEEDS_REPAIR.has(condition)
                      ? 'Raises a repair job; the copy is held back from the shelf.'
                      : 'The copy goes straight back into stock.'}
                  </p>
                </div>

                <div>
                  <label htmlFor="return-notes" className={LABEL}>
                    Notes
                  </label>
                  <input
                    id="return-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={
                      NEEDS_REPAIR.has(condition) ? 'What is damaged?' : 'Anything worth recording'
                    }
                    className={INPUT}
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 border-t border-ink-100 pt-5 dark:border-ink-800">
            <Action tone="ink" onClick={() => setBorrowing(null)} disabled={saving || !current}>
              Clear
            </Action>
            <Action tone="gold" onClick={handleReturn} disabled={saving || !current}>
              {saving ? 'Returning…' : 'Return book'}
            </Action>
          </div>
        </div>
        </div>
      </div>
      )}

      <Card title="Still out" subtitle={`${open.length} books out right now`} padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="bg-ink-900 text-left text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-white dark:bg-ink-950">
                {['Transaction', 'Book', 'Member', 'Issued', 'Due', 'Status'].map((column) => (
                  <th key={column} className="px-4 py-3">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...open]
                .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
                .slice(0, 25)
                .map((row, index) => (
                  <tr
                    key={row.id}
                    onClick={() => setBorrowing(row)}
                    className={`cursor-pointer border-b border-ink-100 transition-colors hover:bg-brass-50 dark:border-ink-800 dark:hover:bg-ink-800 ${
                      index % 2 === 0 ? 'bg-white dark:bg-ink-900' : 'bg-ink-50 dark:bg-ink-800'
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-ink-800 dark:text-ink-100">
                      {row.transaction}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-600 dark:text-ink-300">{row.bookTitle}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-600 dark:text-ink-300">
                      {row.memberName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                      {formatDate(row.issuedAt, locale)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                      {formatDate(row.dueAt, locale)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Pill tone={BORROWING_BADGE[row.status]}>
                        {row.status === 'Overdue' ? `${row.daysOverdue}d overdue` : row.status}
                      </Pill>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <History
        title="Return history"
        subtitle="Every copy taken back over the counter, newest first"
        noun="returns"
        rows={returns}
        apply={filterReturns}
        cleared={RETURN_FILTERS}
        placeholder="Search transaction, member, card number, title or copy…"
        mayExport={can(user, CAPABILITIES.EXPORT)}
        filename="return-history.csv"
        empty="No returns match these filters."
        columns={[
          { label: 'Transaction', cell: (row) => row.transaction },
          {
            label: 'Member',
            cell: (row) => (
              <>
                {row.memberName}
                <span className="block text-xs text-ink-400">{row.memberNumber}</span>
              </>
            ),
          },
          {
            label: 'Book',
            wrap: true,
            cell: (row) => (
              <>
                {row.bookTitle}
                <span className="block text-xs text-ink-400">
                  {row.copyId ?? row.book?.code ?? '—'}
                </span>
              </>
            ),
          },
          { label: 'Due', cell: (row) => formatDate(row.dueAt, locale) },
          { label: 'Returned', cell: (row) => formatDate(row.returnedAt, locale) },
          {
            label: 'Late by',
            cell: (row) =>
              row.lateBy > 0 ? (
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {row.lateBy} days
                </span>
              ) : (
                <span className="text-ink-400">On time</span>
              ),
          },
          {
            label: 'Condition',
            cell: (row) =>
              row.returnCondition ? (
                <Pill
                  tone={
                    NEEDS_REPAIR.has(row.returnCondition)
                      ? 'border-brass-300 bg-brass-50 text-brass-800 dark:border-brass-500/40 dark:bg-brass-500/10 dark:text-brass-300'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                  }
                >
                  {row.returnCondition}
                </Pill>
              ) : (
                <span className="text-ink-400">Not recorded</span>
              ),
          },
          {
            label: 'Fine',
            cell: (row) => (row.fine > 0 ? formatCurrency(row.fine, locale) : '—'),
          },
        ]}
        csv={[
          ['Transaction', (row) => row.transaction],
          ['Member Name', (row) => row.memberName],
          ['Member ID', (row) => row.memberNumber],
          ['Book Title', (row) => row.bookTitle],
          ['Copy ID', (row) => row.copyId ?? ''],
          ['Category', (row) => row.book?.category ?? ''],
          ['Issued', (row) => row.issuedAt?.slice(0, 10) ?? ''],
          ['Due', (row) => row.dueAt?.slice(0, 10) ?? ''],
          ['Returned', (row) => row.returnedAt?.slice(0, 10) ?? ''],
          ['Days Late', (row) => row.lateBy],
          ['Condition', (row) => row.returnCondition ?? ''],
          ['Fine', (row) => row.fine],
        ]}
        fields={[
          {
            key: 'timing',
            label: 'Timing',
            options: [
              { value: 'all', label: 'Late or on time' },
              { value: 'ontime', label: 'Back on time' },
              { value: 'late', label: 'Back late' },
            ],
          },
          {
            key: 'condition',
            label: 'Condition',
            options: [
              { value: 'all', label: 'Any condition' },
              { value: 'good', label: 'Fit for the shelf' },
              { value: 'damaged', label: 'Needed repair' },
              { value: 'unrecorded', label: 'Not recorded' },
            ],
          },
          {
            key: 'fine',
            label: 'Fine charged',
            options: [
              { value: 'all', label: 'Charged or not' },
              { value: 'some', label: 'A fine was raised' },
              { value: 'none', label: 'Nothing to pay' },
            ],
          },
          {
            key: 'category',
            label: 'Category',
            options: [
              { value: 'all', label: 'All categories' },
              ...returnCategories.map((name) => ({ value: name, label: name })),
            ],
          },
          { key: 'from', label: 'Returned on or after', type: 'date' },
          { key: 'to', label: 'Returned on or before', type: 'date' },
        ]}
      />
    </div>
  )
}
