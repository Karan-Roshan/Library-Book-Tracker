// The life of a borrowing: issue, return, renew, reserve, and the rules behind them.

import { MEMBERSHIP_MONTHS } from './members.js'

const DAY = 86_400_000

const startOfDay = (date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

// Adds whole days to a date, returning a new one.
export const addDays = (date, days) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

// The daily fine for one borrowing — a category rate beats the standard one.
export function fineRate(rules, member, book) {
  const byCategory = rules.fineByCategory?.[book?.category]
  if (byCategory !== undefined && byCategory !== null && byCategory !== '') return Number(byCategory)

  return rules.finePerDay
}

// Whole days between two dates, counted by calendar day rather than by hour.
export const daysBetween = (from, to) =>
  Math.round((startOfDay(to) - startOfDay(from)) / DAY)

// What the library allows, as one table the administrator can edit.
export const DEFAULT_RULES = {
  borrowDays: 14,
  maxBooks: 2,

  maxRenewals: 2,
  renewalDays: 7,

  finePerDay: 5,
  maxFine: 300,

  graceDays: 2,

  blockAtFine: 100,

  borrowWithFine: true,
  renewWithFine: false,

  renewWhenOverdue: false,

  renewWhenReserved: false,

  reservationDays: 3,

  replacementCost: 500,
  processingFee: 50,
}

const oneNumber = (value, fallback) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : value && typeof value === 'object'
      ? (value.Public ?? Object.values(value).find(Number.isFinite) ?? fallback)
      : fallback

// Rules from storage with every missing field filled in.
export const withDefaults = (rules) => ({
  ...DEFAULT_RULES,
  ...(rules ?? {}),
  borrowDays: oneNumber(rules?.borrowDays, DEFAULT_RULES.borrowDays),
  maxBooks: oneNumber(rules?.maxBooks, DEFAULT_RULES.maxBooks),
})

// How long this member may keep a book.
export const borrowDaysFor = (member, rules) => Number(rules.borrowDays) || 14

// How many books this member may hold at once.
export const maxBooksFor = (member, rules) => Number(rules.maxBooks) || 2

// The due date a book issued today would carry.
export const dueDateFor = (member, rules, issuedAt = new Date()) =>
  addDays(issuedAt, borrowDaysFor(member, rules))

// The four states a borrowing can be in.
export const BORROWING_STATUSES = ['Issued', 'Overdue', 'Returned', 'Lost']

// What condition a copy can come back in.
export const RETURN_CONDITIONS = ['Good', 'Damaged', 'Heavily Damaged']

// Conditions that send a copy to the bench instead of the shelf.
export const NEEDS_REPAIR = new Set(['Damaged', 'Heavily Damaged'])

// Colours for each borrowing status.
export const BORROWING_BADGE = {
  'Issued': 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300',
  Overdue: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300',
  Returned: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
  Lost: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300',
}

// The counter number: date, then minute and second, then the day's count.
export const transactionNumber = (issuedAt, sequence) => {
  const date = new Date(issuedAt)
  const pad = (value) => String(value).padStart(2, '0')

  return [
    'TXN-',
    pad(date.getDate()),
    pad(date.getMonth() + 1),
    date.getFullYear(),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    pad(sequence),
  ].join('')
}

// Numbers every borrowing by the day it was issued, oldest first.
export function numberByDay(rows) {
  const numbers = new Map()
  const perDay = new Map()

  for (const row of [...rows].sort((a, b) => new Date(a.issuedAt) - new Date(b.issuedAt))) {
    const date = new Date(row.issuedAt)
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const next = (perDay.get(key) ?? 0) + 1
    perDay.set(key, next)
    numbers.set(row.id, transactionNumber(row.issuedAt, next))
  }
  return numbers
}

// Every borrowing joined to its book and member, with its state worked out.
export function composeBorrowings({
  library,
  issued = [],
  overrides = {},
  lostReports = [],
  books = [],
  rules = DEFAULT_RULES,
  now = new Date(),
}) {
  const bookById = new Map(books.map((book) => [book.id, book]))
  for (const book of library.books) if (!bookById.has(book.id)) bookById.set(book.id, book)
  const memberById = new Map(library.members.map((member) => [member.id, member]))

  const lostByBorrowing = new Map()
  for (const report of lostReports) {
    if (!report.recoveredAt) lostByBorrowing.set(report.borrowingId, report)
  }

  const raw = [
    ...library.borrowings.map((borrowing) => ({ ...borrowing, isDesk: false })),
    ...issued.map((borrowing) => ({ ...borrowing, isDesk: true })),
  ]

  const numbers = numberByDay(raw)

  return raw.map((borrowing) => {
    const patch = overrides[borrowing.id] ?? {}
    const merged = { ...borrowing, ...patch }

    const book = bookById.get(merged.bookId)
    const member = memberById.get(merged.memberId)
    const renewals = merged.renewals ?? []
    const lost = lostByBorrowing.get(merged.id) ?? null

    const dueAt = renewals.length ? renewals[renewals.length - 1].to : merged.dueAt

    const late = merged.returnedAt
      ? Math.max(0, daysBetween(dueAt, merged.returnedAt))
      : Math.max(0, daysBetween(dueAt, now))

    const status = lost
      ? 'Lost'
      : merged.returnedAt
        ? 'Returned'
        : late > 0
          ? 'Overdue'
          : 'Issued'

    return {
      ...merged,
      dueAt,
      renewals,
      renewalCount: renewals.length,
      book,
      member,
      transaction: numbers.get(borrowing.id),
      bookTitle: book?.title ?? 'Unknown title',
      bookCategory: book?.category ?? '—',
      memberName: member?.name ?? 'Unknown member',
      memberNumber: member?.membershipNumber ?? '—',
      status,
      daysOverdue: late,

      chargeableDays: Math.max(0, late - (rules.graceDays ?? 0)),

      fine: Math.min(
        Math.max(0, late - (rules.graceDays ?? 0)) * fineRate(rules, member, book),
        rules.maxFine,
      ),
      lostReport: lost,
      returnCondition: merged.returnCondition ?? null,
    }
  })
}

// Only what is still out.
export const openBorrowings = (borrowings) => borrowings.filter((borrowing) => !borrowing.returnedAt && borrowing.status !== 'Lost')

// Only what is past its due date.
export const overdueBorrowings = (borrowings) => borrowings.filter((borrowing) => borrowing.status === 'Overdue')

// What falls due within the next few days.
export const dueSoon = (borrowings, days, now = new Date()) =>
  borrowings.filter(
    (borrowing) =>
      borrowing.status === 'Issued' &&
      daysBetween(now, borrowing.dueAt) >= 0 &&
      daysBetween(now, borrowing.dueAt) <= days,
  )

// Narrows the borrowing list by search, status and member.
export function filterBorrowings(borrowings, { query = '', status = 'all', member = 'all' } = {}) {
  const term = query.trim().toLowerCase()
  return borrowings.filter((borrowing) => {
    if (status !== 'all' && borrowing.status !== status) return false
    if (member !== 'all' && borrowing.memberId !== member) return false
    if (!term) return true
    return [borrowing.transaction, borrowing.memberName, borrowing.memberNumber, borrowing.bookTitle, borrowing.book?.code]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term))
  })
}

// Whether this member may take this copy, and if not, why — in sentences the desk can read out.
export function issueEligibility({ member, book, borrowings, owed = 0, reservations = [], rules, now = new Date() }) {
  const blocks = []
  const warnings = []

  if (!member) return { ok: false, blocks: ['No member selected.'], warnings }

  if (rules.borrowImmediately === false && member.joinedAt) {
    if (daysBetween(member.joinedAt, now) < 1) {
      blocks.push('New memberships cannot borrow on the day they are registered.')
    }
  }

  if (member.status === 'Suspended') blocks.push('This membership is suspended.')
  else if (member.active === false || member.status === 'Inactive') {
    blocks.push('This membership is not active.')
  }

  if (member.expiresAt && new Date(member.expiresAt) < now) {
    warnings.push(
      `Membership lapsed on ${new Date(member.expiresAt).toLocaleDateString()} — issuing renews it for ${MEMBERSHIP_MONTHS} months.`,
    )
  }

  const held = openBorrowings(borrowings).filter((borrowing) => borrowing.memberId === member.id)
  const limit = maxBooksFor(member, rules)
  if (held.length >= limit) {
    blocks.push(`${held.length} books already out; the limit is ${limit}.`)
  }

  const late = held.filter((borrowing) => borrowing.status === 'Overdue')
  if (late.length && rules.borrowWhenOverdue === false) {
    blocks.push(
      `${late.length} book${late.length === 1 ? ' is' : 's are'} already overdue — those must come back first.`,
    )
  } else if (late.length) {
    warnings.push(`${late.length} book${late.length === 1 ? '' : 's'} already overdue.`)
  }

  if (owed > 0) {
    if (rules.blockAtFine > 0 && owed >= rules.blockAtFine) {
      blocks.push(`₹${owed} in unpaid fines — the limit is ₹${rules.blockAtFine}.`)
    } else if (!rules.borrowWithFine) {
      blocks.push(`₹${owed} in unpaid fines must be cleared before borrowing.`)
    } else {
      warnings.push(`₹${owed} in unpaid fines.`)
    }
  }

  if (book) {
    if (rules.referenceCategories?.includes(book.category)) {
      blocks.push(`${book.category} is reference stock and cannot be issued.`)
    }

    if (book.available <= 0) {
      const mending = (book.repairing ?? 0) + (book.maintenance ?? 0)
      const shelf = book.copies - (book.lost ?? 0) - mending
      blocks.push(
        shelf <= 0
          ? `No lendable copy: ${book.lost ?? 0} lost, ${mending} on the repair bench.`
          : 'Every copy of this title is already out.',
      )
    }

    const onHold = reservations.find(
      (row) => row.bookId === book.id && row.status === 'Ready for Pickup' && row.memberId !== member.id,
    )
    if (onHold) {
      blocks.push(
        `This copy is being held for ${onHold.memberName} until ${new Date(onHold.expiresAt).toLocaleDateString()}.`,
      )
    }

    const waiting = reservations.filter(
      (row) => row.bookId === book.id && row.status === 'Waiting' && row.memberId !== member.id,
    )
    if (waiting.length) warnings.push(`${waiting.length} member(s) waiting for this title.`)
  }

  return { ok: blocks.length === 0, blocks, warnings }
}

// The states a hold moves through.
export const RESERVATION_STATUSES = ['Waiting', 'Ready for Pickup', 'Collected', 'Expired', 'Cancelled']

// Colours for each hold status.
export const RESERVATION_BADGE = {
  Waiting: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300',
  'Ready for Pickup': 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
  Collected: 'border-ink-200 bg-ink-50 text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300',
  Expired: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300',
  Cancelled: 'border-ink-200 bg-ink-50 text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-400',
}

// The reference printed on a hold.
export const reservationCode = (id) => {
  const digits = String(id ?? '').replace(/\D/g, '')
  return digits ? `RES-${digits.padStart(4, '0')}` : `RES-${String(id ?? '').slice(-4)}`
}

// Holds joined to their book and member, with queue position worked out.
export function composeReservations({
  library,
  placed = [],
  books = [],
  now = new Date(),
  rules = DEFAULT_RULES,
}) {
  const bookById = new Map(books.map((book) => [book.id, book]))
  for (const book of library.books) if (!bookById.has(book.id)) bookById.set(book.id, book)
  const memberById = new Map(library.members.map((member) => [member.id, member]))

  const seeded = library.reservations.map((row) => ({
    id: row.id,
    bookId: row.bookId,
    memberId: row.memberId,
    reservedAt: row.placedAt,

    status: row.status === 'ready' ? 'Ready for Pickup' : 'Waiting',
    readyAt: row.status === 'ready' ? row.placedAt : null,
    isDesk: false,
  }))

  const byId = new Map(seeded.map((row) => [row.id, row]))
  for (const row of placed) byId.set(row.id, { ...row, isDesk: true })
  const all = [...byId.values()]

  const composed = all.map((row) => {
    const book = bookById.get(row.bookId)
    const member = memberById.get(row.memberId)

    const expiresAt =
      row.expiresAt ?? (row.readyAt ? addDays(row.readyAt, rules.reservationDays).toISOString() : null)
    const lapsed =
      row.status === 'Ready for Pickup' && expiresAt && new Date(expiresAt) < startOfDay(now)

    return {
      ...row,
      code: reservationCode(row.id),
      book,
      member,
      bookTitle: book?.title ?? 'Unknown title',
      bookCode: book?.code ?? '—',
      memberName: member?.name ?? 'Unknown member',
      memberNumber: member?.membershipNumber ?? '—',
      expiresAt,
      status: lapsed ? 'Expired' : row.status,
      notified: Boolean(row.notifiedAt),
    }
  })

  const queues = new Map()
  for (const row of [...composed].sort((a, b) => new Date(a.reservedAt) - new Date(b.reservedAt))) {
    if (!['Waiting', 'Ready for Pickup'].includes(row.status)) {
      row.position = null
      continue
    }
    const next = (queues.get(row.bookId) ?? 0) + 1
    queues.set(row.bookId, next)
    row.position = next
  }

  return composed.sort((a, b) => new Date(b.reservedAt) - new Date(a.reservedAt))
}

// Who gets a copy when one comes back.
export const nextInQueue = (reservations, bookId) =>
  reservations
    .filter((row) => row.bookId === bookId && row.status === 'Waiting')
    .sort((a, b) => new Date(a.reservedAt) - new Date(b.reservedAt))[0] ?? null

// Narrows the queue by status, place in line, notice sent, deadline and date.
export function filterReservations(
  rows,
  {
    query = '',
    status = 'all',
    category = 'all',
    queue = 'all',
    notified = 'all',
    deadline = 'all',
    from = '',
    to = '',
    now = new Date(),
  } = {},
) {
  const term = query.trim().toLowerCase()
  const today = startOfDay(now)

  return rows.filter((row) => {
    if (status !== 'all' && row.status !== status) return false
    if (category !== 'all' && (row.book?.category ?? '—') !== category) return false

    if (queue === 'front' && row.position !== 1) return false
    if (queue === 'behind' && !(row.position > 1)) return false

    if (queue === 'none' && row.position) return false

    if (notified === 'yes' && !row.notified) return false
    if (notified === 'no' && row.notified) return false

    if (deadline !== 'all') {
      if (!row.expiresAt) return false
      const days = Math.round((startOfDay(row.expiresAt) - today) / DAY)
      if (deadline === 'today' && days !== 0) return false
      if (deadline === 'soon' && !(days >= 0 && days <= 2)) return false
      if (deadline === 'lapsed' && days >= 0) return false
    }

    if (from && startOfDay(row.reservedAt) < startOfDay(from)) return false
    if (to && startOfDay(row.reservedAt) > startOfDay(to)) return false

    if (!term) return true
    return [row.code, row.memberName, row.memberNumber, row.bookTitle, row.bookCode]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term))
  })
}

// How overdue, in the bands the desk chases in.
export const OVERDUE_BANDS = [
  { key: 'all', label: 'Any length', test: () => true },
  { key: 'week', label: '1–7 days', test: (row) => row.daysOverdue <= 7 },
  { key: 'fortnight', label: '8–30 days', test: (row) => row.daysOverdue > 7 && row.daysOverdue <= 30 },
  { key: 'long', label: 'Over 30 days', test: (row) => row.daysOverdue > 30 },
]

// Narrows the overdue list by how late, reminder, fine, renewals and contact.
export function filterOverdue(
  rows,
  {
    query = '',
    band = 'all',
    reminded = 'all',
    fine = 'all',
    renewals = 'all',
    contact = 'all',
    category = 'all',
    from = '',
    to = '',
    rules = DEFAULT_RULES,
  } = {},
) {
  const term = query.trim().toLowerCase()
  const inBand = OVERDUE_BANDS.find((entry) => entry.key === band)?.test ?? (() => true)
  const cap = Number(rules?.maxFine) || DEFAULT_RULES.maxFine
  const limit = Number(rules?.maxRenewals) || DEFAULT_RULES.maxRenewals

  return rows.filter((row) => {
    if (!inBand(row)) return false

    if (reminded === 'yes' && !row.remindedAt) return false
    if (reminded === 'no' && row.remindedAt) return false

    const owed = Number(row.fine) || 0
    if (fine === 'none' && owed > 0) return false
    if (fine === 'under' && !(owed > 0 && owed < 100)) return false
    if (fine === 'over' && owed < 100) return false

    if (fine === 'capped' && owed < cap) return false

    const used = Number(row.renewalCount) || 0
    if (renewals === 'never' && used > 0) return false
    if (renewals === 'some' && used === 0) return false
    if (renewals === 'limit' && used < limit) return false

    const reachable = Boolean(row.member?.email || row.member?.phone)
    if (contact === 'yes' && !reachable) return false
    if (contact === 'no' && reachable) return false

    if (category !== 'all' && (row.book?.category ?? '—') !== category) return false

    if (from && startOfDay(row.dueAt) < startOfDay(from)) return false
    if (to && startOfDay(row.dueAt) > startOfDay(to)) return false

    if (!term) return true
    return [row.transaction, row.memberName, row.memberNumber, row.bookTitle, row.book?.code]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term))
  })
}

const matches = (row, term, fields) =>
  !term ||
  fields
    .map((field) => row[field] ?? row.book?.[field] ?? null)
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term))

const SEARCH = ['transaction', 'memberName', 'memberNumber', 'bookTitle', 'copyId', 'code']

// Everything ever issued, newest first.
export function issueHistory(borrowings) {
  return [...borrowings]
    .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))
    .map((borrowing) => ({ ...borrowing, key: borrowing.id }))
}

// Narrows the issue register.
export function filterIssues(
  rows,
  { query = '', status = 'all', category = 'all', renewed = 'all', origin = 'all', from = '', to = '' } = {},
) {
  const term = query.trim().toLowerCase()

  return rows.filter((row) => {
    if (status !== 'all' && row.status !== status) return false
    if (category !== 'all' && (row.book?.category ?? '—') !== category) return false

    const used = Number(row.renewalCount) || 0
    if (renewed === 'never' && used > 0) return false
    if (renewed === 'some' && used === 0) return false

    if (origin === 'desk' && !row.isDesk) return false
    if (origin === 'seeded' && row.isDesk) return false

    if (from && startOfDay(row.issuedAt) < startOfDay(from)) return false
    if (to && startOfDay(row.issuedAt) > startOfDay(to)) return false

    return matches(row, term, SEARCH)
  })
}

// Only what has actually come back, with how late it was on the day.
export function returnHistory(borrowings) {
  return borrowings
    .filter((borrowing) => borrowing.returnedAt)
    .sort((a, b) => new Date(b.returnedAt) - new Date(a.returnedAt))
    .map((borrowing) => ({
      ...borrowing,
      key: borrowing.id,

      lateBy: Math.max(0, daysBetween(borrowing.dueAt, borrowing.returnedAt)),
    }))
}

// Narrows the return register by timing, condition and fine.
export function filterReturns(
  rows,
  { query = '', timing = 'all', condition = 'all', fine = 'all', category = 'all', from = '', to = '' } = {},
) {
  const term = query.trim().toLowerCase()

  return rows.filter((row) => {
    if (timing === 'ontime' && row.lateBy > 0) return false
    if (timing === 'late' && row.lateBy === 0) return false

    if (condition === 'good' && NEEDS_REPAIR.has(row.returnCondition)) return false

    if (condition === 'damaged' && !NEEDS_REPAIR.has(row.returnCondition)) return false
    if (condition === 'unrecorded' && row.returnCondition) return false

    const owed = Number(row.fine) || 0
    if (fine === 'none' && owed > 0) return false
    if (fine === 'some' && owed === 0) return false

    if (category !== 'all' && (row.book?.category ?? '—') !== category) return false

    if (from && startOfDay(row.returnedAt) < startOfDay(from)) return false
    if (to && startOfDay(row.returnedAt) > startOfDay(to)) return false

    return matches(row, term, SEARCH)
  })
}

// Why a book is recorded as lost.
export const LOST_REASONS = [
  'Reported lost by member',
  'Missing from shelf',
  'Not returned after reminders',
  'Damaged beyond repair',
]

// How a lost book is finally settled.
export const LOST_RESOLUTIONS = ['Open', 'Charged', 'Paid', 'Written Off', 'Recovered']

// Colours for each lost-book outcome.
export const LOST_BADGE = {
  Open: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300',
  Charged: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300',
  Paid: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
  'Written Off': 'border-ink-200 bg-ink-50 text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300',
  Recovered: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
}

// The reference on a lost-book report.
export const lostCode = (id) => {
  const digits = String(id ?? '').replace(/\D/g, '')
  return digits ? `LOST-${digits.padStart(4, '0')}` : `LOST-${String(id ?? '').slice(-4)}`
}

// What a lost book costs: replacement plus handling.
export const lostCharge = (rules, replacementCost) => ({
  replacement: Number(replacementCost ?? rules.replacementCost),
  processing: Number(rules.processingFee),
  total: Number(replacementCost ?? rules.replacementCost) + Number(rules.processingFee),
})

// Lost reports joined to their book, member and borrowing.
export function composeLostReports({ reports = [], library, books = [], borrowings = [] }) {
  const transactionFor = new Map(borrowings.map((row) => [row.id, row.transaction]))
  const bookById = new Map(books.map((book) => [book.id, book]))
  for (const book of library.books) if (!bookById.has(book.id)) bookById.set(book.id, book)
  const memberById = new Map(library.members.map((member) => [member.id, member]))

  return reports
    .map((report) => {
      const book = bookById.get(report.bookId)
      const member = memberById.get(report.memberId)
      return {
        ...report,
        code: lostCode(report.id),
        book,
        member,
        bookTitle: book?.title ?? 'Unknown title',
        bookCode: book?.code ?? '—',
        memberName: member?.name ?? '—',
        memberNumber: member?.membershipNumber ?? '—',
        transaction: transactionFor.get(report.borrowingId) ?? '—',
        status: report.recoveredAt ? 'Recovered' : (report.resolution ?? 'Open'),
      }
    })
    .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt))
}

// The day's figures for the top of the desk screens.
export function summarizeCirculation(borrowings, now = new Date()) {
  const open = openBorrowings(borrowings)
  const today = startOfDay(now).getTime()

  return {
    outNow: open.length,
    overdue: open.filter((borrowing) => borrowing.status === 'Overdue').length,
    dueToday: open.filter((borrowing) => startOfDay(borrowing.dueAt).getTime() === today).length,
    issuedToday: borrowings.filter((borrowing) => startOfDay(borrowing.issuedAt).getTime() === today).length,
    returnedToday: borrowings.filter(
      (borrowing) => borrowing.returnedAt && startOfDay(borrowing.returnedAt).getTime() === today,
    ).length,
    outstandingFines: open
      .filter((borrowing) => borrowing.status === 'Overdue')
      .reduce((sum, borrowing) => sum + borrowing.fine, 0),
  }
}

// What one member currently owes.
export const owedBy = (fineRecords, memberNumber) =>
  fineRecords
    .filter((record) => !record.settled && record.memberId === memberNumber)
    .reduce((sum, record) => sum + record.amount, 0)
