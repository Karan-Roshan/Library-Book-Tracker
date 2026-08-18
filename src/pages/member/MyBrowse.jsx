// The catalogue as a member sees it, with reserving.

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatDate } from '../../lib/format.js'
import { issueEligibility } from '../../lib/circulation.js'
import * as circulation from '../../services/circulation.js'
import { useMyLibrary } from '../../hooks/useMyLibrary.js'
import { INPUT, SELECT, SELECT_ARROW } from '../../components/circulation/Shared.jsx'
import { Availability, Card, Empty, PageHead, Spine } from './MemberKit.jsx'

export default function MyBrowse({ mode = 'browse' }) {
  const { user } = useAuth()
  const { locale, system } = usePreferences()
  const my = useMyLibrary()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()

  const query = params.get('q') ?? ''
  const category = params.get('category') ?? 'all'
  const availability = params.get('have') ?? 'all'

  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [detail, setDetail] = useState(null)

  const set = (patch) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (!value || value === 'all') next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  const categories = useMemo(
    () => [...new Set(my.books.map((book) => book.category))].sort(),
    [my.books],
  )

  const queues = useMemo(() => {
    const map = new Map()
    for (const row of my.allReservations ?? []) {
      if (['Waiting', 'Ready for Pickup'].includes(row.status)) {
        map.set(row.bookId, (map.get(row.bookId) ?? 0) + 1)
      }
    }
    return map
  }, [my.allReservations])

  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    return my.books
      .filter((book) => category === 'all' || book.category === category)
      .filter((book) =>
        availability === 'available'
          ? book.available > 0
          : availability === 'unavailable'
            ? book.available <= 0
            : true,
      )
      .filter((book) =>
        term
          ? [book.title, book.author, book.isbn, book.category, book.code, book.shelf]
              .filter(Boolean)
              .some((field) => String(field).toLowerCase().includes(term))
          : true,
      )
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [my.books, query, category, availability])

  const myHolds = new Set(my.activeReservations.map((row) => row.bookId))
  const myBorrowings = new Set(my.out.map((borrowing) => borrowing.bookId))

  async function reserve(book) {
    // Without a membership record there is nobody to put in the queue, and the
    // desk has to sort it out.
    if (!my.me) {
      toast('Your membership record could not be found. Ask at the desk.', 'error')
      return
    }

    setBusy(true)
    try {
      await circulation.placeReservation({
        book,
        member: my.me,
        staff: `${my.me.name} (member)`,
        byMember: true,
      })
      await my.refresh()
      setNotice(`You are in the queue for ${book.title}. You will be notified when it is ready.`)
      setDetail(null)
    } catch (problem) {
      // A hold that fails has to say so. Swallowing it leaves the button looking
      // as though nothing happened at all.
      toast(problem.message || `${book.title} could not be reserved. Try again.`, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (my.loading) return <p className="py-20 text-center text-sm text-ink-400">Loading the catalogue…</p>

  return (
    <div className="space-y-6">
      <PageHead
        title={mode === 'categories' ? 'Categories' : 'Browse books'}
        subtitle={`${my.books.length} titles in the collection`}
      />

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {mode === 'categories' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((name) => {
            const inCategory = my.books.filter((book) => book.category === name)
            const free = inCategory.reduce((sum, book) => sum + book.available, 0)
            return (
              <button
                key={name}
                type="button"
                onClick={() => set({ category: name })}
                className={`rounded-xl border p-4 text-left shadow-sm transition-shadow hover:shadow-md ${
                  category === name
                    ? 'border-brass-300 bg-brass-50 dark:border-brass-500/40 dark:bg-brass-500/10'
                    : 'border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900'
                }`}
              >
                <p className="font-display text-base text-ink-900 dark:text-white">{name}</p>
                <p className="mt-1 text-xs text-ink-400">
                  {inCategory.length} titles · {free} on the shelf
                </p>
              </button>
            )
          })}
        </div>
      )}

      <Card padded={false}>
        <div className="grid grid-cols-[minmax(8rem,1fr)_minmax(9rem,12rem)_minmax(9rem,12rem)] items-center gap-3 overflow-x-auto px-4 py-3">
          <input
            type="search"
            value={query}
            onChange={(event) => set({ q: event.target.value })}
            placeholder="Search by title, author, ISBN, category or shelf…"
            className={INPUT}
            aria-label="Search the catalogue"
            autoFocus={mode === 'search'}
          />
          <select
            value={category}
            onChange={(event) => set({ category: event.target.value })}
            style={SELECT_ARROW}
            className={SELECT}
            aria-label="Category"
          >
            <option value="all">All categories</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={availability}
            onChange={(event) => set({ have: event.target.value })}
            style={SELECT_ARROW}
            className={SELECT}
            aria-label="Availability"
          >
            <option value="all">Any availability</option>
            <option value="available">On the shelf now</option>
            <option value="unavailable">Currently out</option>
          </select>
        </div>
      </Card>

      {results.length === 0 ? (
        <Empty title="Nothing matched">
          Try a different word, or clear the filters.
        </Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {results.slice(0, 60).map((book) => {
            const waiting = queues.get(book.id) ?? 0
            const held = myHolds.has(book.id)
            const borrowed = myBorrowings.has(book.id)

            return (
              <div
                key={book.id}
                className="flex gap-4 rounded-xl border border-ink-100 bg-white p-4 shadow-sm dark:border-ink-800 dark:bg-ink-900"
              >
                <Spine book={book} />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base text-ink-900 dark:text-white">
                    {book.title}
                  </p>
                  <p className="truncate text-sm text-ink-500 dark:text-ink-400">{book.author}</p>

                  <p className="mt-1.5 text-xs text-ink-400">
                    {book.category} · Shelf {book.shelf} · {book.code}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <Availability book={book} waiting={waiting} />

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDetail(book)}
                        className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
                      >
                        Details
                      </button>
                      {borrowed ? (
                        <span className="self-center text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          You have this
                        </span>
                      ) : held ? (
                        <span className="self-center text-xs font-semibold text-brass-700 dark:text-brass-300">
                          Reserved
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => reserve(book)}
                          disabled={busy}
                          className="rounded-lg bg-brass-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500 disabled:bg-brass-200"
                        >
                          Reserve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {detail && (
        <BookDetail
          book={detail}
          my={my}
          waiting={queues.get(detail.id) ?? 0}
          held={myHolds.has(detail.id)}
          borrowed={myBorrowings.has(detail.id)}
          busy={busy}
          onReserve={reserve}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}

function BookDetail({ book, my, waiting, held, borrowed, busy, onReserve, onClose }) {
  const verdict = issueEligibility({
    member: my.me,
    book,
    borrowings: my.borrowings,
    owed: my.owed,
    reservations: my.allReservations,
    rules: my.rules,
    now: my.now,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 py-10 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={book.title}
        className="animate-rise w-full max-w-2xl rounded-xl border border-ink-100 bg-white shadow-xl dark:border-ink-800 dark:bg-ink-900"
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
          <div className="flex gap-4">
            <Spine book={book} />
            <div>
              <h2 className="font-display text-lg text-ink-900 dark:text-white">{book.title}</h2>
              <p className="text-sm text-ink-500 dark:text-ink-400">{book.author}</p>
              <div className="mt-2">
                <Availability book={book} waiting={waiting} />
              </div>
            </div>
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

        <dl className="grid gap-4 px-5 py-5 sm:grid-cols-3">
          {[
            ['Book ID', book.code],
            ['ISBN', book.isbn || '—'],
            ['Category', book.category],
            ['Shelf', book.shelf],
            ['Total copies', book.copies],
            ['On the shelf', book.available],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-ink-400">{label}</dt>
              <dd className="text-sm font-medium text-ink-800 dark:text-ink-100">{value}</dd>
            </div>
          ))}
        </dl>

        {!borrowed && !held && !verdict.ok && (
          <div className="mx-5 mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
            <p className="font-semibold">You could reserve this, but not borrow it yet</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">
              {verdict.blocks.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-ink-100 px-5 py-4 dark:border-ink-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            Close
          </button>
          {!borrowed && !held && (
            <button
              type="button"
              onClick={() => onReserve(book)}
              disabled={busy}
              className="rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500 disabled:bg-brass-200"
            >
              {book.available > 0 ? 'Reserve a copy' : 'Join the queue'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
