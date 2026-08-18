// What is owed and why, worked out from the dates rather than stored.

import { indexById } from './join.js'

import { bookCode } from './books.js'

export { bookCode }

// The standard daily rate, used when the rules are not to hand.
export const FINE_RATE_PER_DAY = 5
// The most a single overdue charge can grow to.
export const FINE_CAP = 300

// Days a book may be kept before a condition fine is raised.
export const FINE_BORROW_DAYS = 7

// Damage charges, each at a fixed price. More than one can apply at once.
export const FINE_REASONS = [
  { label: 'Marked or written in', amount: 50 },
  { label: 'Torn or missing pages', amount: 100 },
  { label: 'Damaged binding', amount: 150 },
  { label: 'Water damage', amount: 200 },
  { label: 'Lost book', amount: 500 },
]

// The one reason charged at the book's own value rather than a flat price.
export const LOST_REASON = 'Lost book'

// What a set of reasons comes to, with the book's price standing in for a loss.
export const reasonTotal = (labels = [], lostPrice = null) =>
  FINE_REASONS.filter((reason) => labels.includes(reason.label)).reduce(
    (sum, reason) =>
      sum +
      (reason.label === LOST_REASON && Number(lostPrice) > 0 ? Number(lostPrice) : reason.amount),
    0,
  )

const DAY = 86_400_000

const startOfDay = (date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime()
const isSameMonth = (a, b) =>
  new Date(a).getFullYear() === new Date(b).getFullYear() &&
  new Date(a).getMonth() === new Date(b).getMonth()

// How many days past due, counted to today or to the day it came back.
export function daysOverdue(borrowing, now = new Date()) {
  const end = borrowing.returnedAt ? new Date(borrowing.returnedAt) : now
  const days = Math.round((startOfDay(end) - startOfDay(borrowing.dueAt)) / DAY)
  return Math.max(0, days)
}

const REGISTER_LIMIT = 295

// The whole fines register, built from borrowings, hand-raised fines and payments.
export function buildFineRecords({
  library,
  books = [],
  members = [],
  manualFines = [],
  payments = {},
  now = new Date(),

  rate = FINE_RATE_PER_DAY,
  cap = FINE_CAP,

  grace = 0,
}) {
  // The register has to name people and titles added after the seed, so index the
  // composed lists first and fall back to the seeded catalogue.
  const bookById = indexById(books, library.books)
  const memberById = indexById(members, library.members)
  const everyMember = [...memberById.values()]
  const everyBook = [...bookById.values()]
  const overdue = []
  const records = []

  for (const borrowing of library.borrowings) {
    const late = daysOverdue(borrowing, now)

    const derived = Math.min(Math.max(0, late - grace) * rate, cap)
    const amount = borrowing.returnedAt ? (borrowing.fine ?? derived) : derived
    if (amount <= 0) continue

    const member = memberById.get(borrowing.memberId)
    const book = bookById.get(borrowing.bookId)

    overdue.push({
      key: borrowing.id,
      kind: 'overdue',
      sortAt: borrowing.dueAt,
      memberId: member?.membershipNumber ?? '—',
      memberName: member?.name ?? 'Unknown',
      bookId: bookCode(borrowing.bookId),
      bookName: book?.title ?? 'Unknown',
      issueDate: borrowing.issuedAt,
      dueDate: borrowing.dueAt,
      returnDate: borrowing.returnedAt,
      daysOverdue: late,
      rate,
      reason: 'Overdue return',
      amount,

      settled: Boolean(borrowing.finePaid),
      settledAt: borrowing.finePaid ? borrowing.returnedAt : null,
      collectedBy: borrowing.finePaid ? '—' : null,
    })
  }

  const stillOwed = overdue.filter((record) => !record.settled)
  const room = Math.max(0, REGISTER_LIMIT - manualFines.length - stillOwed.length)
  const history = overdue
    .filter((record) => record.settled)
    .sort((a, b) => new Date(b.sortAt) - new Date(a.sortAt))
    .slice(0, room)

  records.push(...stillOwed, ...history)

  for (const fine of manualFines) {
    const member = everyMember.find((row) => row.membershipNumber === fine.memberId)
    const book = everyBook.find((row) => bookCode(row.id) === fine.bookId)

    records.push({
      key: fine.id,
      kind: 'manual',
      manualId: fine.id,
      sortAt: fine.createdAt,
      memberId: fine.memberId,
      memberName: member?.name ?? '—',
      bookId: fine.bookId,
      bookName: book?.title ?? '—',

      issueDate: fine.issueDate ?? null,
      dueDate: fine.dueDate ?? null,
      returnDate: null,

      daysOverdue: fine.dueDate
        ? Math.max(0, Math.round((startOfDay(now) - startOfDay(fine.dueDate)) / DAY))
        : 0,
      rate: null,
      reason: fine.reason,
      amount: fine.amount,
      settled: false,
      settledAt: null,
      collectedBy: null,
    })
  }

  for (const record of records) {
    const payment = payments[record.key]
    if (!payment) continue
    record.settled = true
    record.settledAt = payment.paidAt
    record.collectedBy = payment.collectedBy
  }

  records.sort((a, b) => new Date(a.sortAt) - new Date(b.sortAt))
  records.forEach((record, index) => {
    record.fineId = `Fine-${String(index + 1).padStart(2, '0')}`
    record.status = record.settled ? 'Paid' : 'Pending'
  })

  return records.reverse()
}

// Owed, collected and written off, for the top of the fines page.
export function summarizeFines(records, now = new Date()) {
  const paid = records.filter((record) => record.settled)

  return {
    totalCollected: paid.reduce((sum, record) => sum + record.amount, 0),
    pending: records
      .filter((record) => !record.settled)
      .reduce((sum, record) => sum + record.amount, 0),
    today: paid
      .filter((record) => record.settledAt && isSameDay(record.settledAt, now))
      .reduce((sum, record) => sum + record.amount, 0),
    month: paid
      .filter((record) => record.settledAt && isSameMonth(record.settledAt, now))
      .reduce((sum, record) => sum + record.amount, 0),
    pendingCount: records.filter((record) => !record.settled).length,
  }
}
