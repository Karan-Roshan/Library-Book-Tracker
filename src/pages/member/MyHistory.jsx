// Everything the member has ever borrowed.

import { useMemo, useState } from 'react'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatCurrency, formatDate } from '../../lib/format.js'
import { BORROWING_BADGE } from '../../lib/circulation.js'
import { downloadFile, toCSV } from '../../lib/csv.js'
import { useMyLibrary } from '../../hooks/useMyLibrary.js'
import { Pill, INPUT, SELECT, SELECT_ARROW } from '../../components/circulation/Shared.jsx'
import { ReportTable } from '../../components/reports/ReportKit.jsx'
import { Card, Empty, PageHead } from './MemberKit.jsx'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'out', label: 'Currently borrowed' },
  { key: 'returned', label: 'Returned' },
  { key: 'late', label: 'Returned late' },
]

export default function MyHistory() {
  const { locale, system } = usePreferences()
  const my = useMyLibrary()
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return my.history
      .filter((borrowing) => {
        if (filter === 'out') return !borrowing.returnedAt && borrowing.status !== 'Lost'
        if (filter === 'returned') return Boolean(borrowing.returnedAt)
        if (filter === 'late') return Boolean(borrowing.returnedAt) && borrowing.daysOverdue > 0
        return true
      })
      .filter((borrowing) =>
        term
          ? [borrowing.bookTitle, borrowing.book?.author, borrowing.book?.code, borrowing.bookCategory]
              .filter(Boolean)
              .some((field) => String(field).toLowerCase().includes(term))
          : true,
      )
  }, [my.history, filter, query])

  if (my.loading) return <p className="py-20 text-center text-sm text-ink-400">Reading your account…</p>

  return (
    <div className="space-y-6">
      <PageHead
        title="Borrowing history"
        subtitle={`${my.history.length} books borrowed on your account`}
        action={
          <button
            type="button"
            onClick={() =>
              downloadFile(
                'my-borrowing-history.csv',
                toCSV(visible, [
                  ['Book', (row) => row.bookTitle],
                  ['Author', (row) => row.book?.author ?? ''],
                  ['Book ID', (row) => row.book?.code ?? ''],
                  ['Category', (row) => row.bookCategory],
                  ['Issued', (row) => row.issuedAt?.slice(0, 10) ?? ''],
                  ['Due', (row) => row.dueAt?.slice(0, 10) ?? ''],
                  ['Returned', (row) => row.returnedAt?.slice(0, 10) ?? ''],
                  ['Renewals', (row) => row.renewalCount],
                  ['Days overdue', (row) => row.daysOverdue],
                  ['Status', (row) => row.status],
                ]),
              )
            }
            disabled={visible.length === 0}
            className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:text-ink-300 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            Download my history
          </button>
        }
      />

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div role="group" aria-label="Filter" className="flex rounded-lg border border-ink-100 p-0.5 dark:border-ink-700">
            {FILTERS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                aria-pressed={filter === option.key}
                className={`rounded-[0.4rem] px-3 py-1.5 text-sm font-semibold transition-colors ${
                  filter === option.key
                    ? 'bg-ink-900 text-white dark:bg-brass-600'
                    : 'text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your history…"
            className={`${INPUT} max-w-xs`}
            aria-label="Search history"
          />
          <span className="ml-auto text-xs text-ink-400">{visible.length} borrowings</span>
        </div>

        <ReportTable
          columns={[
            { label: 'Book', render: (row) => row.bookTitle },
            { label: 'Author', render: (row) => row.book?.author ?? '—' },
            { label: 'Category', render: (row) => row.bookCategory },
            { label: 'Issued', render: (row) => formatDate(row.issuedAt, locale, system) },
            { label: 'Due', render: (row) => formatDate(row.dueAt, locale, system) },
            {
              label: 'Returned',
              render: (row) => (row.returnedAt ? formatDate(row.returnedAt, locale, system) : '—'),
            },
            { label: 'Renewals', align: 'right', render: (row) => row.renewalCount || '—' },
            {
              label: 'Fine',
              align: 'right',
              render: (row) => (row.fine > 0 ? formatCurrency(row.fine, locale, system) : '—'),
            },
            { label: 'Status', render: (row) => <Pill tone={BORROWING_BADGE[row.status]}>{row.status}</Pill> },
          ]}
          rows={visible.map((row) => ({ ...row, key: row.id }))}
          empty="Nothing matches this filter."
        />
      </Card>
    </div>
  )
}
