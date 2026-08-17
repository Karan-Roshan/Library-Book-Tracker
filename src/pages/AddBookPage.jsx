// Add a title by hand, or upload a list of them.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDismiss } from '../hooks/useDismiss.js'
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx'
import Card from '../components/dashboard/Card.jsx'
import TextField, { RequiredMark } from '../components/TextField.jsx'
import Alert from '../components/Alert.jsx'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { library } from '../data/demoLibrary.js'
import { formatDate } from '../lib/format.js'
import { parseCSV } from '../lib/csv.js'
import {
  CATEGORY_NAMES,
  COPIES_PER_TITLE,
  blockFor,
  byAddedDate,
  composeBooks,
} from '../lib/books.js'
import * as booksService from '../services/books.js'

const EMPTY = {
  title: '',
  author: '',
  category: CATEGORY_NAMES[0],
  price: '',
}

const LABEL =
  'mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400'
const INPUT =
  'w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-white'

export default function AddBookPage() {
  const { locale } = usePreferences()

  const [added, setAdded] = useState([])
  const [issued, setIssued] = useState([])
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [importResult, setImportResult] = useState(null)

  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const fileInput = useRef(null)
  const closeDialog = useCallback(() => setAdding(false), [])
  const dialogRef = useDismiss(adding, closeDialog)

  const now = useMemo(() => new Date(), [])

  const refresh = useCallback(() => {
    Promise.all([booksService.listAddedBooks(), booksService.listIssuedBorrowings()]).then(
      ([books, borrowings]) => {
        setAdded(books)
        setIssued(borrowings)
      },
    )
  }, [])

  useEffect(refresh, [refresh])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  const books = useMemo(
    () => composeBooks({ library, added, issued, now }),
    [added, issued, now],
  )

  const shelfFor = useCallback(
    (category) => {
      const counts = new Map(Array.from({ length: 12 }, (_, index) => [index + 1, 0]))
      for (const book of books) {
        if (book.category !== category) continue
        counts.set(Number(book.shelfNumber) || 1, (counts.get(Number(book.shelfNumber) || 1) ?? 0) + 1)
      }
      return [...counts.entries()].reduce((best, entry) => (entry[1] < best[1] ? entry : best))
    },
    [books],
  )

  const shelf = useMemo(() => {
    const block = blockFor(values.category)
    const [number, count] = shelfFor(values.category)
    return { block, number, count, label: `${block}-${String(number).padStart(2, '0')}` }
  }, [values.category, shelfFor])

  const days = useMemo(() => byAddedDate(books).slice(0, 40), [books])

  const update = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: null }))
  }

  async function handleAdd(event) {
    event.preventDefault()

    const next = {
      title: values.title.trim() ? null : 'Enter the book name.',
      author: values.author.trim() ? null : 'Enter the author.',
      price: Number(values.price) > 0 ? null : 'Enter the price.',
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    const book = await booksService.addBook({
      ...values,
      shelfNumber: shelf.number,
      copies: COPIES_PER_TITLE,
    })
    setValues(EMPTY)
    setNotice(`${book.title} accessioned as ${book.code}.`)
    refresh()
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)
    setImportResult(null)

    try {
      const { records } = parseCSV(await file.text())
      if (records.length === 0) {
        setError('That file has no rows below the header.')
        return
      }

      const skipped = []
      let count = 0

      for (const [index, record] of records.entries()) {
        const line = index + 2
        const title = record.title ?? record['book name'] ?? ''
        const author = record.author ?? ''
        const category = CATEGORY_NAMES.find(
          (name) => name.toLowerCase() === (record.category ?? '').trim().toLowerCase(),
        )

        if (!title.trim()) {
          skipped.push(`Row ${line}: no book name`)
          continue
        }
        if (!author.trim()) {
          skipped.push(`Row ${line}: no author`)
          continue
        }
        if (!category) {
          skipped.push(`Row ${line}: unknown category “${record.category ?? ''}”`)
          continue
        }

        await booksService.addBook({
          title,
          author,
          category,

          shelfNumber: shelfFor(category)[0],
          price: Number(record.price ?? record['price (₹)'] ?? 0),
        })
        count += 1
      }

      refresh()
      setImportResult({ added: count, skipped, file: file.name })
    } catch {
      setError('That file could not be read as CSV.')
    }
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div
          role="status"
          className="animate-rise fixed left-1/2 top-20 z-50 w-[min(28rem,90vw)] -translate-x-1/2 lg:left-[calc(50%+8rem)]"
        >
          <div className="rounded-lg border border-brass-200 bg-brass-50 px-4 py-3 text-sm text-brass-900 shadow-lg dark:border-brass-500/30 dark:bg-ink-800 dark:text-brass-200">
            {notice}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="mt-2 font-display text-2xl text-ink-900 dark:text-white">Add Book</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            Upload list
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            onChange={handleUpload}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => setAdding((current) => !current)}
            aria-expanded={adding}
            className="rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500"
          >
            {adding ? 'Close' : 'Add book'}
          </button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {importResult && (
        <Alert tone={importResult.skipped.length > 0 ? 'error' : 'info'}>
          <span className="block font-semibold">
            {importResult.file}: {importResult.added} added
            {importResult.skipped.length > 0 && `, ${importResult.skipped.length} skipped`}.
          </span>
          {importResult.skipped.length > 0 && (
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs">
              {importResult.skipped.slice(0, 8).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
              {importResult.skipped.length > 8 && (
                <li>…and {importResult.skipped.length - 8} more</li>
              )}
            </ul>
          )}
        </Alert>
      )}

      {adding && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 py-10 backdrop-blur-sm">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Add a book"
            className="animate-rise w-full max-w-lg rounded-xl border border-ink-100 bg-white shadow-xl dark:border-ink-800 dark:bg-ink-900"
          >
            <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
              <div>
                <h2 className="font-display text-lg text-ink-900 dark:text-white">Add a book</h2>
                <p className="mt-0.5 text-xs text-ink-400">One title at a time</p>
              </div>
              <button
                type="button"
                onClick={() => setAdding(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <form id="add-book" onSubmit={handleAdd} noValidate className="space-y-5 px-5 py-5">
              <TextField
                label="Book name"
                value={values.title}
                onChange={update('title')}
                error={errors.title}
                placeholder="A Brief History of Time"
                required
              />
              <TextField
                label="Author"
                value={values.author}
                onChange={update('author')}
                error={errors.author}
                placeholder="Stephen Hawking"
                required
              />

              <div>
                <label htmlFor="book-category" className={LABEL}>
                  Category
                  <RequiredMark />
                </label>
                <select
                  id="book-category"
                  value={values.category}
                  onChange={update('category')}
                  className={INPUT}
                >
                  {CATEGORY_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className={LABEL}>Shelf</p>

                  <p className="rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-[0.95rem] text-ink-600 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-300">
                    {shelf.label}
                  </p>
                  <p className="mt-1.5 text-xs text-ink-400">
                    {shelf.count === 0
                      ? 'An empty shelf in this block.'
                      : `${shelf.count} title${shelf.count === 1 ? '' : 's'} already there.`}
                  </p>
                </div>

                <TextField
                  label="Price (₹)"
                  type="number"
                  min="0"
                  value={values.price}
                  onChange={update('price')}
                  error={errors.price}
                  hint="What a lost copy is charged at."
                  required
                />
              </div>

              <div>
                <p className={LABEL}>Copies</p>

                <p className="rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-[0.95rem] text-ink-600 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-300">
                  {COPIES_PER_TITLE} copies
                </p>
              </div>
            </form>

            <div className="flex justify-end gap-3 border-t border-ink-100 px-5 py-4 dark:border-ink-800">
              <button
                type="button"
                onClick={() => {
                  setValues(EMPTY)
                  setErrors({})
                }}
                className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
              >
                Clear
              </button>
              <button
                type="submit"
                form="add-book"
                className="rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500"
              >
                Add to catalogue
              </button>
            </div>
          </div>
        </div>
      )}

      <Card title="Accessions log" subtitle="Grouped by the day they were added" padded={false}>
        <ul className="max-h-[46rem] divide-y divide-ink-100 overflow-y-auto dark:divide-ink-800">
          {days.map((day) => (
            <li key={day.date} className="grid gap-4 px-5 py-4 sm:grid-cols-[8rem_minmax(0,1fr)]">

              <p className="text-sm font-semibold text-ink-900 dark:text-white">
                {formatDate(day.date, locale)}
                <span className="mt-0.5 block text-xs font-normal text-ink-400">
                  {day.titles.length} title{day.titles.length === 1 ? '' : 's'}
                </span>
              </p>

              <ul className="space-y-2">
                {day.titles.map((book) => (
                  <li
                    key={book.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-ink-50 px-3 py-2 dark:bg-ink-800"
                  >
                    <span className="text-sm text-ink-900 dark:text-white">
                      {book.title}
                      <span className="ml-2 text-xs text-ink-400">{book.author}</span>
                    </span>
                    <span className="text-xs text-ink-400">
                      {book.code} · {book.category} · {book.shelf} · {book.copies} copies
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
