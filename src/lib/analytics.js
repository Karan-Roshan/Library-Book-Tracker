// Dashboard figures, all worked out from the records rather than stored.

const DAY = 86_400_000

const startOfDay = (date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime()
const isOutstanding = (borrowing) => !borrowing.returnedAt && borrowing.status !== 'Lost'
const monthKey = (date) => `${new Date(date).getFullYear()}-${new Date(date).getMonth()}`

// A count that survives a record written at the desk, where the seeded columns
// the demo catalogue carries may simply not be there.
const count = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

// Holds the library is still keeping a copy back for. The seed writes these in
// lower case, the desk in title case, so both readings are accepted.
const HELD = new Set(['waiting', 'ready', 'ready for pickup'])
const isHeld = (reservation) => HELD.has(String(reservation.status ?? 'waiting').toLowerCase())

// When the hold was placed — again, under either name.
const placedOn = (reservation) => reservation.placedAt ?? reservation.reservedAt ?? null

// Indexes the library once, so the widgets below are lookups rather than scans.
export function buildIndex(library) {
  return {
    bookById: new Map(library.books.map((book) => [book.id, book])),
    memberById: new Map(library.members.map((member) => [member.id, member])),
  }
}

// The headline figures for the dashboard.
export function summarize(library, now = new Date()) {
  const { books, members, borrowings, reservations } = library
  const today = startOfDay(now)
  const thisMonth = monthKey(now)

  const totalCopies = books.reduce((sum, book) => sum + count(book.copies), 0)
  const lost = books.reduce((sum, book) => sum + count(book.lost), 0)
  const maintenance = books.reduce(
    (sum, book) => sum + count(book.maintenance) + count(book.repairing),
    0,
  )

  const outstanding = borrowings.filter(isOutstanding)
  const issued = outstanding.length
  const overdue = outstanding.filter((borrowing) => new Date(borrowing.dueAt) < today).length
  const reserved = reservations.filter(isHeld).length

  const pendingFines = borrowings.reduce(
    (sum, borrowing) => (borrowing.fine > 0 && !borrowing.finePaid ? sum + borrowing.fine : sum),
    0,
  )

  return {
    totalBooks: totalCopies,
    available: Math.max(0, totalCopies - issued - reserved - lost - maintenance),
    issued,
    overdue,
    totalMembers: members.length,
    newMembersThisMonth: members.filter((member) => monthKey(member.joinedAt) === thisMonth)
      .length,
    reserved,
    pendingFines,
    booksAddedThisMonth: books
      .filter((book) => book.addedAt && monthKey(book.addedAt) === thisMonth)
      .reduce((sum, book) => sum + count(book.copies), 0),
    returnedToday: borrowings.filter((borrowing) => borrowing.returnedAt && isSameDay(borrowing.returnedAt, now))
      .length,
    lost,
    maintenance,
  }
}

// How many copies are out, on the shelf, lost or being mended.
export function bookStatus(library, now = new Date()) {
  const stats = summarize(library, now)
  return [
    { key: 'available', label: 'Available', value: stats.available },
    { key: 'issued', label: 'Issued', value: stats.issued },
    { key: 'reserved', label: 'Reserved', value: stats.reserved },
    { key: 'lost', label: 'Lost', value: stats.lost },
    { key: 'maintenance', label: 'Under maintenance', value: stats.maintenance },
  ]
}

// Borrowings and returns per month.
export function monthlyTransactions(library, now = new Date()) {
  const months = []
  const index = new Map()

  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const bucket = { date: date.toISOString(), issued: 0, returned: 0 }
    months.push(bucket)
    index.set(monthKey(date), bucket)
  }

  for (const borrowing of library.borrowings) {
    const issuedBucket = index.get(monthKey(borrowing.issuedAt))
    if (issuedBucket) issuedBucket.issued += 1
    if (borrowing.returnedAt) {
      const returnedBucket = index.get(monthKey(borrowing.returnedAt))
      if (returnedBucket) returnedBucket.returned += 1
    }
  }

  return months
}

// Which subjects are borrowed most.
export function categoryBorrows(library) {
  const { bookById } = buildIndex(library)
  const counts = new Map()

  for (const borrowing of library.borrowings) {
    const category = bookById.get(borrowing.bookId)?.category
    if (category) counts.set(category, (counts.get(category) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
}

// The last few weeks, day by day.
export function weeklyActivity(library, now = new Date()) {
  const days = []
  const index = new Map()

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = startOfDay(new Date(now.getTime() - offset * DAY))
    const bucket = { date: date.toISOString(), issued: 0, returned: 0, newMembers: 0 }
    days.push(bucket)
    index.set(date.getTime(), bucket)
  }

  const bucketFor = (date) => index.get(startOfDay(date).getTime())

  for (const borrowing of library.borrowings) {
    const issuedBucket = bucketFor(borrowing.issuedAt)
    if (issuedBucket) issuedBucket.issued += 1
    if (borrowing.returnedAt) {
      const returnedBucket = bucketFor(borrowing.returnedAt)
      if (returnedBucket) returnedBucket.returned += 1
    }
  }
  for (const member of library.members) {
    const bucket = bucketFor(member.joinedAt)
    if (bucket) bucket.newMembers += 1
  }

  return days
}

// Today's issues, returns and fines.
export function todaySummary(library, now = new Date()) {
  const issued = library.borrowings.filter((borrowing) => isSameDay(borrowing.issuedAt, now)).length
  const returned = library.borrowings.filter(
    (borrowing) => borrowing.returnedAt && isSameDay(borrowing.returnedAt, now),
  ).length
  const newMembers = library.members.filter((member) => isSameDay(member.joinedAt, now)).length
  const fineCollected = library.borrowings
    .filter((borrowing) => borrowing.finePaid && borrowing.returnedAt && isSameDay(borrowing.returnedAt, now))
    .reduce((sum, borrowing) => sum + count(borrowing.fine), 0)

  return { issued, returned, newMembers, fineCollected }
}

// The last few things anybody did.
export function recentActivity(library, now = new Date(), limit = 8) {
  const { bookById, memberById } = buildIndex(library)
  const entries = []

  for (const borrowing of library.borrowings) {
    const member = memberById.get(borrowing.memberId)?.name ?? 'A member'
    const book = bookById.get(borrowing.bookId)?.title ?? 'a book'

    if (isSameDay(borrowing.issuedAt, now)) {
      entries.push({ at: borrowing.issuedAt, kind: 'issue', text: `${member} issued ${book}` })
    }
    if (borrowing.returnedAt && isSameDay(borrowing.returnedAt, now)) {
      entries.push({ at: borrowing.returnedAt, kind: 'return', text: `${member} returned ${book}` })
      if (borrowing.finePaid && borrowing.fine > 0) {
        entries.push({
          at: borrowing.returnedAt,
          kind: 'fine',
          text: `Fine collected from ${member}`,
          amount: borrowing.fine,
        })
      }
    }
  }

  for (const member of library.members) {
    if (isSameDay(member.joinedAt, now)) {
      entries.push({ at: member.joinedAt, kind: 'member', text: `${member.name} registered` })
    }
  }

  return entries.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit)
}

// The titles borrowed most often.
export function popularBooks(library, limit = 5) {
  const borrows = new Map()
  const out = new Map()

  for (const borrowing of library.borrowings) {
    borrows.set(borrowing.bookId, (borrows.get(borrowing.bookId) ?? 0) + 1)
    if (isOutstanding(borrowing)) out.set(borrowing.bookId, (out.get(borrowing.bookId) ?? 0) + 1)
  }

  return library.books
    .map((book) => ({
      ...book,
      borrows: borrows.get(book.id) ?? 0,
      availableCopies: Math.max(
        0,
        book.available ??
          count(book.copies) - (out.get(book.id) ?? 0) - count(book.lost) - count(book.maintenance),
      ),
    }))
    .sort((a, b) => b.borrows - a.borrows)
    .slice(0, limit)
}

// Who borrows the most.
export function mostActiveMembers(library, limit = 5) {
  const { memberById } = buildIndex(library)
  const counts = new Map()

  for (const borrowing of library.borrowings) {
    counts.set(borrowing.memberId, (counts.get(borrowing.memberId) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([memberId, borrowed]) => ({
      id: memberId,
      name: memberById.get(memberId)?.name ?? 'Unknown',
      membershipNumber: memberById.get(memberId)?.membershipNumber ?? '—',
      borrowed,
    }))
}

// Books expected back today.
export function dueToday(library, now = new Date(), limit = 6) {
  const { bookById, memberById } = buildIndex(library)

  return library.borrowings
    .filter((borrowing) => isOutstanding(borrowing) && isSameDay(borrowing.dueAt, now))
    .slice(0, limit)
    .map((borrowing) => ({
      id: borrowing.id,
      member: memberById.get(borrowing.memberId)?.name ?? 'Unknown',
      book: bookById.get(borrowing.bookId)?.title ?? 'Unknown',
      dueAt: borrowing.dueAt,
    }))
}

// What the dashboard should be warning about.
export function notifications(library, now = new Date()) {
  const stats = summarize(library, now)
  const dueTodayCount = library.borrowings.filter(
    (borrowing) => isOutstanding(borrowing) && isSameDay(borrowing.dueAt, now),
  ).length
  const readyReservations = library.reservations.filter(isHeld).length

  const lowStock = popularBooks(library, 12).filter((book) => book.availableCopies <= 2)

  const expiringMemberships = library.members.filter((member) => {
    const age = (startOfDay(now) - startOfDay(member.joinedAt)) / DAY
    return age >= 351 && age <= 365
  }).length

  const plural = (count, singular, pluralForm = `${singular}s`) =>
    `${count} ${count === 1 ? singular : pluralForm}`

  return [
    {
      id: 'overdue',
      tone: 'critical',
      text: `${plural(stats.overdue, 'book')} overdue`,

      to: '/fines',
    },
    {
      id: 'reservations',
      tone: 'warning',
      text: `${plural(readyReservations, 'reservation')} waiting for collection`,
      to: '/transactions/reservations',
    },
    {
      id: 'due',
      tone: 'warning',
      text: `${plural(dueTodayCount, 'book')} due today`,
      to: '/transactions',
    },
    {
      id: 'lost',
      tone: 'serious',
      text: `${plural(stats.lost, 'book')} reported lost`,
      to: '/books',
    },
    {
      id: 'stock',
      tone: 'serious',
      text: `Low stock on ${plural(lowStock.length, 'popular title')}`,
      to: '/books',
    },
    {
      id: 'membership',
      tone: 'good',
      text: `${plural(expiringMemberships, 'membership')} expiring this week`,
      to: '/members',
    },
  ]
}

// A month laid out for the calendar widget.
export function calendarMonth(library, now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth()
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const marks = new Map()
  const mark = (date, kind) => {
    const day = new Date(date)
    if (day.getFullYear() !== year || day.getMonth() !== month) return
    const existing = marks.get(day.getDate()) ?? new Set()
    existing.add(kind)
    marks.set(day.getDate(), existing)
  }

  const events = library.events ?? []

  for (const borrowing of library.borrowings) if (isOutstanding(borrowing)) mark(borrowing.dueAt, 'due')
  for (const reservation of library.reservations) {
    const placed = placedOn(reservation)
    if (placed) mark(placed, 'reservation')
  }
  for (const event of events) mark(event.date, event.kind)

  return {
    year,
    month,
    daysInMonth,

    leadingBlanks: (first.getDay() + 6) % 7,
    marks,
    events: events
      .filter((event) => new Date(event.date) >= startOfDay(now))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 3),
  }
}

const FREE_TIER_BYTES = 512 * 1024 * 1024

const PER_RECORD = 900

// Where the data lives and how much of it there is.
export function systemHealth(library) {
  const records =
    library.books.length + library.members.length + library.borrowings.length
  const usedBytes = records * PER_RECORD

  return {
    usedBytes,
    quotaBytes: FREE_TIER_BYTES,
    usedPercent: Math.min(100, (usedBytes / FREE_TIER_BYTES) * 100),
    driver: 'MongoDB',
    records,
    backup: 'Not configured',
    lastSync: library.generatedAt,
  }
}

// Searches titles, authors, members and categories at once.
export function search(library, query, limit = 6) {
  const term = query.trim().toLowerCase()
  if (term.length < 2) return []

  const results = []
  const push = (type, label, detail, to) => results.push({ type, label, detail, to })

  for (const book of library.books) {
    if (results.length >= limit * 3) break
    if (
      [book.title, book.author, book.isbn, book.code]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    ) {
      push('Book', book.title, `${book.author} · ${book.category} · ${book.isbn ?? '—'}`, '/books')
    }
  }

  for (const member of library.members) {
    if (results.length >= limit * 3) break
    if (
      [member.name, member.membershipNumber, member.email]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    ) {
      push('Member', member.name, member.membershipNumber, '/members')
    }
  }

  for (const category of new Set(library.books.map((book) => book.category))) {
    if (category.toLowerCase().includes(term)) {
      push('Category', category, 'Browse this shelf', '/books')
    }
  }

  return results.slice(0, limit)
}
