// Book records joined to their copies, with availability worked out.

import { BOOK_CONDITIONS, CATEGORY_NAMES, COPIES_PER_TITLE, blockFor } from '../data/demoLibrary.js'
import { composeCopies, stockOf } from './copies.js'

export { BOOK_CONDITIONS, CATEGORY_NAMES, COPIES_PER_TITLE, blockFor }

// The default borrowing length, when the rules are not to hand.
export const BORROW_DAYS = 7

// The printed code for a title, as BOOK-001.
export const bookCode = (bookId) =>
  `BOOK-${String(bookId ?? '').replace(/\D/g, '').padStart(3, '0')}`

// The shelf mark a reader would look for.
export const shelfLabel = (book) =>
  `${book.block ?? blockFor(book.category)}-${String(book.shelfNumber ?? 1).padStart(2, '0')}`

// The due date a book issued now would carry.
export const dueDateFor = (issuedAt) => {
  const due = new Date(issuedAt)
  due.setDate(due.getDate() + BORROW_DAYS)
  return due
}

// Seeded and desk-written borrowings as one list.
export const allBorrowings = (library, issued = []) => [...library.borrowings, ...issued]

// Titles with copies, availability and demand worked out.
export function composeBooks({
  library,
  added = [],
  issued = [],

  lostReports = [],

  repairs = [],

  copies = library.copies ?? [],
  reservations = [],
  now = new Date(),
}) {
  const borrowings = allBorrowings(library, issued)

  const stock = composeCopies({
    copies,
    borrowings,
    repairs,
    lostReports,
    reservations,
    books: library.books,
    locations: library.locations ?? [],
    now,
  })
  const hasCopies = new Set(stock.map((copy) => copy.bookId))

  const outNow = new Map()
  const borrowed = new Map()
  for (const borrowing of borrowings) {
    borrowed.set(borrowing.bookId, (borrowed.get(borrowing.bookId) ?? 0) + 1)
    if (borrowing.returnedAt === null) outNow.set(borrowing.bookId, (outNow.get(borrowing.bookId) ?? 0) + 1)
  }

  const onBench = new Map()
  for (const repair of repairs) {
    if (repair.status === 'Complete') continue
    onBench.set(repair.bookId, (onBench.get(repair.bookId) ?? 0) + 1)
  }

  const reportedLost = new Map()
  for (const report of lostReports) {
    if (report.recoveredAt) continue
    reportedLost.set(report.bookId, (reportedLost.get(report.bookId) ?? 0) + 1)
  }

  const seeded = library.books.map((book) => ({ ...book, isAdded: false }))
  const manual = added.map((book) => ({
    ...book,
    copies: Math.min(book.copies ?? COPIES_PER_TITLE, COPIES_PER_TITLE),
    block: book.block ?? blockFor(book.category),
    isAdded: true,
  }))

  return [...seeded, ...manual].map((book) => {
    if (hasCopies.has(book.id)) {
      const counted = stockOf(stock, book.id)
      return {
        ...book,
        code: book.code ?? bookCode(book.id),
        shelf: shelfLabel(book),
        outNow: counted.outNow,
        lost: counted.lost,
        repairing: counted.repairing,
        withdrawn: counted.withdrawn,
        available: counted.available,
        copies: counted.copies,
        borrowedTotal: borrowed.get(book.id) ?? 0,
        condition: book.condition ?? 'Good',
      }
    }

    const out = outNow.get(book.id) ?? 0
    const lost = (book.lost ?? 0) + (reportedLost.get(book.id) ?? 0)
    const repairing = onBench.get(book.id) ?? 0
    const unavailable = lost + repairing + (book.maintenance ?? 0)
    return {
      ...book,
      code: book.code ?? bookCode(book.id),
      shelf: shelfLabel(book),
      outNow: out,
      lost,
      repairing,
      available: Math.max(0, book.copies - out - unavailable),
      borrowedTotal: borrowed.get(book.id) ?? 0,
      condition: book.condition ?? 'Good',
    }
  })
}

// Narrows the catalogue by search, category and availability.
export function filterBooks(books, { query = '', category = 'all', condition = 'all' } = {}) {
  const term = query.trim().toLowerCase()

  return books.filter((book) => {
    if (category !== 'all' && book.category !== category) return false
    if (condition !== 'all' && book.condition !== condition) return false
    if (!term) return true
    return [book.code, book.title, book.author, book.category, book.shelf, book.isbn]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term))
  })
}

// Newest addition first.
export function byAddedDate(books) {
  const days = new Map()
  for (const book of books) {
    const day = (book.addedAt ?? '').slice(0, 10)
    if (!day) continue
    const list = days.get(day) ?? []
    list.push(book)
    days.set(day, list)
  }

  return [...days.entries()]
    .map(([date, titles]) => ({
      date,
      titles: [...titles].sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}
