// The catalogue: every title, its copies and where they are.

import { useMemo, useState } from 'react'
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx'
import Card from '../components/dashboard/Card.jsx'
import StatCard from '../components/dashboard/StatCard.jsx'
import RowMenu, { ACTION_CELL, ACTION_HEAD } from '../components/dashboard/RowMenu.jsx'
import IssueBookDialog from '../components/dashboard/IssueBookDialog.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCirculation } from '../hooks/useCirculation.js'
import { formatCurrency } from '../lib/format.js'
import { downloadFile, toCSV } from '../lib/csv.js'
import { CATEGORY_NAMES, filterBooks } from '../lib/books.js'
import { issueEligibility } from '../lib/circulation.js'
import * as circulation from '../services/circulation.js'

const COLUMNS = [
  'Book ID',
  'Book Name',
  'Author',
  'Category',
  'Shelf',
  'Quantity',
  'Available',
  'Price',
]

const CSV_COLUMNS = [
  ['Book ID', (row) => row.code],
  ['Book Name', (row) => row.title],
  ['Author', (row) => row.author],
  ['Category', (row) => row.category],
  ['Shelf', (row) => row.shelf],
  ['Quantity', (row) => row.copies],
  ['Available', (row) => row.available],
  ['Price', (row) => row.price ?? ''],
]

const STICKY = {
  'Book ID': 'sticky left-0 w-28 min-w-28',
  'Book Name': 'sticky left-28 w-64 min-w-64 border-r border-ink-100 dark:border-ink-800',
}

const stripeFor = (index) =>
  index % 2 === 0 ? 'bg-white dark:bg-ink-900' : 'bg-ink-50 dark:bg-ink-800'
const STICKY_HOVER = 'group-hover:bg-brass-50 dark:group-hover:bg-ink-800'

export default function BooksPage() {
  const { user } = useAuth()
  const { locale } = usePreferences()

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [issuing, setIssuing] = useState(null)

  // The catalogue reads the desk's copy of the library, so what it calls
  // available is what the issue counter would allow.
  const desk = useCirculation()
  const { toast } = useToast()
  const { books, members } = desk

  const visible = useMemo(
    () => filterBooks(books, { query, category }),
    [books, query, category],
  )

  const stats = useMemo(
    () => ({
      titles: books.length,
      copies: books.reduce((sum, book) => sum + book.copies, 0),
      available: books.reduce((sum, book) => sum + book.available, 0),
    }),
    [books],
  )

  async function handleIssue({ book, member, issuedAt }) {
    if (!desk.rules) throw new Error('The borrowing rules are still loading — try again in a moment.')

    // The same test the issue counter and the assistant apply, so a book cannot
    // be lent here on terms that would be refused there.
    const verdict = issueEligibility({
      member,
      book,
      borrowings: desk.borrowings,
      owed: desk.owedBy(member.membershipNumber),
      reservations: desk.reservations,
      rules: desk.rules,
      now: desk.now,
    })

    // Thrown rather than announced, so the reason appears in the dialog beside the
    // form the person is still filling in.
    if (!verdict.ok) throw new Error(verdict.blocks.join(' '))

    await circulation.issueBook({
      book,
      member,
      issuedAt,
      rules: desk.rules,
      staff: user.name,
      reservations: desk.reservations,
      copies: desk.copies,
    })
    await desk.refresh()
    toast(`${book.title} issued to ${member.name}.`)
    verdict.warnings?.forEach((warning) => toast(warning, 'info'))
  }

  const cell = 'whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="mt-2 font-display text-2xl text-ink-900 dark:text-white">All Books</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Everything on the shelves, and where to find it
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            downloadFile(
              `books-${new Date().toISOString().slice(0, 10)}.csv`,
              toCSV(visible, CSV_COLUMNS),
            )
          }
          disabled={visible.length === 0}
          className="rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500 disabled:bg-brass-200"
        >
          Export CSV
        </button>
      </div>

      <IssueBookDialog
        open={issuing !== null}
        book={issuing}
        members={members}
        onClose={() => setIssuing(null)}
        onIssue={handleIssue}
      />

      <section aria-label="Catalogue totals" className="grid gap-4 sm:grid-cols-3">
        <StatCard align="center" label="Titles" value={stats.titles} />
        <StatCard align="center" label="Total Copies" value={stats.copies} />
        <StatCard align="center" label="On the Shelf" value={stats.available} tone="good" />
      </section>

      <Card
        title="Catalogue"
        subtitle={`${visible.length} of ${books.length} titles`}
        padded={false}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ID, title, author, shelf..."
              aria-label="Search books"
              className="h-9 w-56 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brass-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white"
            />

            <div className="relative">
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-label="Filter by category"
                className="h-9 appearance-none rounded-lg border border-ink-200 bg-white bg-[length:0.9rem] bg-[position:right_0.75rem_center] bg-no-repeat py-0 pl-3 pr-10 text-sm text-ink-700 focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
              >
                <option value="all">All Categories</option>
                {CATEGORY_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 20 20"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                fill="none"
                aria-hidden="true"
              >
                <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
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
                    No books match that view.
                  </td>
                </tr>
              )}
              {visible.map((book, index) => {
                const stripe = stripeFor(index)
                return (
                  <tr
                    key={book.id}
                    className={`group border-b border-ink-100/70 transition-colors last:border-0 dark:border-ink-800/60 ${stripe} hover:bg-brass-50 dark:hover:bg-ink-800`}
                  >
                    <td
                      className={`${cell} z-10 font-medium text-ink-900 dark:text-white ${STICKY['Book ID']} ${stripe} ${STICKY_HOVER}`}
                    >
                      {book.code}
                    </td>
                    <td
                      className={`px-4 py-3 font-medium text-ink-900 dark:text-white z-10 ${STICKY['Book Name']} ${stripe} ${STICKY_HOVER}`}
                    >
                      {book.title}
                    </td>
                    <td className={cell}>{book.author}</td>
                    <td className={cell}>{book.category}</td>
                    <td className={`${cell} font-semibold text-ink-700 dark:text-ink-200`}>
                      {book.shelf}
                    </td>
                    <td className={cell}>{book.copies}</td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 font-semibold ${
                        book.available === 0
                          ? 'text-red-600'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {book.available}
                      {book.outNow > 0 && (
                        <span className="ml-1.5 text-xs font-normal text-ink-400">
                          ({book.outNow} out)
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-600 dark:text-ink-300">
                      {book.price ? formatCurrency(book.price, locale) : '—'}
                    </td>
                    <td className={`${ACTION_CELL} ${stripe} ${STICKY_HOVER}`}>
                      <RowMenu
                        label={`Actions for ${book.title}`}
                        items={[

                          ...(book.available > 0
                            ? [{ label: 'Issue book', onSelect: () => setIssuing(book) }]
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
      </Card>
    </div>
  )
}
