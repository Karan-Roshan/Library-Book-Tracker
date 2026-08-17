// Builds every report from the raw records.

import { daysBetween } from './circulation.js'
import { isOpen } from './repairs.js'

const DAY = 86_400_000

const startOfDay = (date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

const endOfDay = (date) => {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy
}

// The periods a report can cover.
export const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'quarter', label: 'Last 3 months' },
  { key: 'halfYear', label: 'Last 6 months' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom range' },
]

// Turns a chosen period into a pair of dates.
export function resolveRange(key, now = new Date(), custom = {}) {
  const today = startOfDay(now)

  switch (key) {
    case 'today':
      return { from: today, to: endOfDay(now), label: 'Today' }

    case 'week': {
      const weekday = (today.getDay() + 6) % 7
      return { from: new Date(today.getTime() - weekday * DAY), to: endOfDay(now), label: 'This week' }
    }

    case 'month':
      return {
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: endOfDay(now),
        label: 'This month',
      }

    case 'lastMonth': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      return {
        from,
        to: endOfDay(new Date(today.getFullYear(), today.getMonth(), 0)),
        label: 'Last month',
      }
    }

    case 'quarter':
      return {
        from: new Date(today.getFullYear(), today.getMonth() - 2, 1),
        to: endOfDay(now),
        label: 'Last 3 months',
      }

    case 'halfYear':
      return {
        from: new Date(today.getFullYear(), today.getMonth() - 5, 1),
        to: endOfDay(now),
        label: 'Last 6 months',
      }

    case 'year':
      return { from: new Date(today.getFullYear(), 0, 1), to: endOfDay(now), label: 'This year' }

    case 'custom':
      return {
        from: custom.from ? startOfDay(custom.from) : new Date(today.getFullYear(), 0, 1),
        to: custom.to ? endOfDay(custom.to) : endOfDay(now),
        label: 'Custom range',
      }

    default:

      return { from: new Date(2000, 0, 1), to: endOfDay(now), label: 'All time' }
  }
}

// Whether a date falls inside the period.
export const inRange = (date, range) => {
  if (!date) return false
  const time = new Date(date).getTime()
  return time >= range.from.getTime() && time <= range.to.getTime()
}

// The same length of time immediately before, for comparison.
export function previousRange(range) {
  const span = range.to.getTime() - range.from.getTime()
  return {
    from: new Date(range.from.getTime() - span - 1),
    to: new Date(range.from.getTime() - 1),
    label: 'Previous period',
  }
}

// The percentage difference between two figures.
export const change = (current, before) => {
  if (!before) return current > 0 ? { direction: 'up', percent: null } : { direction: 'flat', percent: 0 }
  const percent = Math.round(((current - before) / before) * 100)
  return { direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat', percent }
}

// Daily, weekly, monthly — how a series is bucketed.
export const GRANULARITIES = [
  { key: 'day', label: 'Daily' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'quarter', label: 'Quarterly' },
  { key: 'year', label: 'Yearly' },
]

function bucketOf(date, granularity) {
  const value = new Date(date)

  switch (granularity) {
    case 'day':
      return { key: value.toISOString().slice(0, 10), at: startOfDay(value) }
    case 'week': {
      const weekday = (value.getDay() + 6) % 7
      const monday = startOfDay(new Date(value.getTime() - weekday * DAY))
      return { key: monday.toISOString().slice(0, 10), at: monday }
    }
    case 'quarter': {
      const quarter = Math.floor(value.getMonth() / 3)
      const at = new Date(value.getFullYear(), quarter * 3, 1)
      return { key: `${value.getFullYear()}-Q${quarter + 1}`, at }
    }
    case 'year':
      return { key: String(value.getFullYear()), at: new Date(value.getFullYear(), 0, 1) }
    default: {
      const at = new Date(value.getFullYear(), value.getMonth(), 1)
      return { key: at.toISOString().slice(0, 7), at }
    }
  }
}

function nextBucket(start, granularity) {
  const next = new Date(start)
  if (granularity === 'day') next.setDate(next.getDate() + 1)
  else if (granularity === 'week') next.setDate(next.getDate() + 7)
  else if (granularity === 'month') next.setMonth(next.getMonth() + 1)
  else if (granularity === 'quarter') next.setMonth(next.getMonth() + 3)
  else next.setFullYear(next.getFullYear() + 1)
  return next
}

// Groups records into evenly spaced buckets across the period.
export function bucketSeries({ range, granularity = 'month', series }) {
  const buckets = new Map()

  let cursor = bucketOf(range.from, granularity).at
  const guard = 400
  for (let step = 0; cursor <= range.to && step < guard; step += 1) {
    const bucket = bucketOf(cursor, granularity)
    if (!buckets.has(bucket.key)) {
      buckets.set(bucket.key, {
        key: bucket.key,
        date: bucket.at,
        ...Object.fromEntries(series.map((entry) => [entry.key, 0])),
      })
    }
    cursor = nextBucket(bucket.at, granularity)
  }

  for (const entry of series) {
    for (const row of entry.rows) {
      const date = entry.dateOf(row)
      if (!date || !inRange(date, range)) continue
      const bucket = buckets.get(bucketOf(date, granularity).key)

      if (bucket) bucket[entry.key] += entry.amountOf ? entry.amountOf(row) : 1
    }
  }

  return [...buckets.values()].sort((a, b) => a.date - b.date)
}

// What was borrowed, returned and renewed.
export function circulationReport({ borrowings, reservations, range }) {
  const issued = borrowings.filter((borrowing) => inRange(borrowing.issuedAt, range))
  const returned = borrowings.filter((borrowing) => inRange(borrowing.returnedAt, range))

  const renewals = borrowings.flatMap((borrowing) =>
    (borrowing.renewals ?? []).filter((renewal) => inRange(renewal.at, range)),
  )

  const reserved = reservations.filter((row) => inRange(row.reservedAt, range))

  return {
    issued: issued.length,
    returned: returned.length,
    renewals: renewals.length,
    reservations: reserved.length,

    currentlyIssued: borrowings.filter((borrowing) => !borrowing.returnedAt && borrowing.status !== 'Lost').length,
    lateReturns: returned.filter((borrowing) => borrowing.daysOverdue > 0).length,
    onTimeRate: returned.length
      ? Math.round(((returned.length - returned.filter((l) => l.daysOverdue > 0).length) / returned.length) * 100)
      : null,
    rows: { issued, returned, renewals, reserved },
  }
}

// Circulation split by category or by member type.
export function circulationBy(borrowings, range, dimension) {
  const issued = borrowings.filter((borrowing) => inRange(borrowing.issuedAt, range))
  const counts = new Map()

  const keyOf = {
    category: (borrowing) => borrowing.bookCategory ?? '—',
    staff: (borrowing) => borrowing.issuedBy ?? 'Not recorded',
    book: (borrowing) => borrowing.bookTitle,
  }[dimension]

  for (const borrowing of issued) {
    const key = keyOf(borrowing)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

// How overdue, in bands.
export const OVERDUE_BANDS = [
  { key: 'all', label: 'All overdue', test: () => true },
  { key: 'week', label: '1–7 days', test: (row) => row.daysOverdue <= 7 },
  { key: 'month', label: '8–30 days', test: (row) => row.daysOverdue > 7 && row.daysOverdue <= 30 },
  { key: 'long', label: 'Over 30 days', test: (row) => row.daysOverdue > 30 },
]

// What is late, and by how much.
export function overdueReport({ borrowings, band = 'all', category = 'all' }) {
  const test = OVERDUE_BANDS.find((entry) => entry.key === band)?.test ?? (() => true)

  const rows = borrowings
    .filter((borrowing) => borrowing.status === 'Overdue')
    .filter(test)
    .filter((borrowing) => category === 'all' || borrowing.bookCategory === category)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)

  return {
    rows,
    count: rows.length,
    fines: rows.reduce((sum, row) => sum + row.fine, 0),
    members: new Set(rows.map((row) => row.memberId)).size,
    longest: rows.reduce((worst, row) => Math.max(worst, row.daysOverdue), 0),
    reminded: rows.filter((row) => row.remindedAt).length,
    bands: OVERDUE_BANDS.slice(1).map((entry) => ({
      label: entry.label,
      count: borrowings.filter((borrowing) => borrowing.status === 'Overdue' && entry.test(borrowing)).length,
    })),
  }
}

// What was charged and what was collected.
export function fineReport({ fineRecords, lost, repairs, range }) {
  const generated = fineRecords.filter((row) => inRange(row.sortAt, range))
  const collected = fineRecords.filter((row) => row.settled && inRange(row.settledAt, range))
  const pending = fineRecords.filter((row) => !row.settled)

  const generatedTotal = generated.reduce((sum, row) => sum + row.amount, 0)
  const collectedTotal = collected.reduce((sum, row) => sum + row.amount, 0)

  const lostCharges = lost.filter((row) => inRange(row.reportedAt, range))
  const waived = lost.filter((row) => row.paymentStatus === 'Waived' && inRange(row.reportedAt, range))

  return {
    generated: generatedTotal,
    generatedCount: generated.length,
    collected: collectedTotal,
    collectedCount: collected.length,
    pending: pending.reduce((sum, row) => sum + row.amount, 0),
    pendingCount: pending.length,

    waived: waived.reduce((sum, row) => sum + (row.total ?? 0), 0),
    damageCharges: repairs
      .filter((row) => row.chargeAmount && inRange(row.reportedAt, range))
      .reduce((sum, row) => sum + row.chargeAmount, 0),
    lostCharges: lostCharges.reduce((sum, row) => sum + (row.total ?? 0), 0),

    collectionRate: generatedTotal > 0 ? Math.round((collectedTotal / generatedTotal) * 100) : null,
    rows: { generated, collected, pending },
  }
}

// The most borrowed titles over the period.
export function popularBooksReport({ borrowings, reservations, range, limit = 20 }) {
  const issued = borrowings.filter((borrowing) => inRange(borrowing.issuedAt, range))
  const stats = new Map()

  const entry = (borrowing) => {
    const existing = stats.get(borrowing.bookId)
    if (existing) return existing
    const fresh = {
      bookId: borrowing.bookId,
      title: borrowing.bookTitle,
      code: borrowing.book?.code ?? '—',
      category: borrowing.bookCategory,
      copies: borrowing.book?.copies ?? 0,
      issues: 0,
      renewals: 0,
      reservations: 0,
      members: new Set(),
      days: 0,
    }
    stats.set(borrowing.bookId, fresh)
    return fresh
  }

  for (const borrowing of issued) {
    const row = entry(borrowing)
    row.issues += 1
    row.renewals += borrowing.renewalCount
    row.members.add(borrowing.memberId)

    row.days += Math.max(0, daysBetween(borrowing.issuedAt, borrowing.returnedAt ?? new Date()))
  }

  for (const hold of reservations) {
    if (!inRange(hold.reservedAt, range)) continue
    const row = stats.get(hold.bookId)
    if (row) row.reservations += 1
  }

  return [...stats.values()]
    .map((row) => ({
      ...row,
      uniqueMembers: row.members.size,

      pressure: row.copies > 0 ? Number(((row.issues + row.reservations) / row.copies).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.issues - a.issues || b.reservations - a.reservations)
    .slice(0, limit)
}

// Who borrowed, and how much.
export function activeMembersReport({ borrowings, reservations, members, range, limit = 20 }) {
  const memberById = new Map(members.map((member) => [member.id, member]))
  const stats = new Map()

  const entry = (id) => {
    const existing = stats.get(id)
    if (existing) return existing
    const member = memberById.get(id)
    const fresh = {
      memberId: id,
      name: member?.name ?? 'Unknown member',
      number: member?.membershipNumber ?? '—',
      status: member?.status ?? '—',
      borrowed: 0,
      returned: 0,
      renewals: 0,
      reservations: 0,
      outstanding: 0,
      titles: new Set(),
    }
    stats.set(id, fresh)
    return fresh
  }

  for (const borrowing of borrowings) {
    if (inRange(borrowing.issuedAt, range)) {
      const row = entry(borrowing.memberId)
      row.borrowed += 1
      row.renewals += (borrowing.renewals ?? []).filter((renewal) => inRange(renewal.at, range)).length
      row.titles.add(borrowing.bookId)
    }
    if (inRange(borrowing.returnedAt, range)) entry(borrowing.memberId).returned += 1
    if (!borrowing.returnedAt && borrowing.status !== 'Lost') entry(borrowing.memberId).outstanding += 1
  }

  for (const hold of reservations) {
    if (inRange(hold.reservedAt, range)) entry(hold.memberId).reservations += 1
  }

  const span = Math.max(1, Math.round((range.to - range.from) / DAY))

  return [...stats.values()]
    .map((row) => ({
      ...row,
      distinctTitles: row.titles.size,

      frequency: Number(((row.borrowed / span) * 30).toFixed(1)),
    }))
    .filter((row) => row.borrowed > 0 || row.outstanding > 0)
    .sort((a, b) => b.borrowed - a.borrowed || b.renewals - a.renewals)
    .slice(0, limit)
}

// Members who joined, lapsed or went quiet.
export function memberActivity({ borrowings, members, range }) {
  const borrowed = new Set(
    borrowings.filter((borrowing) => inRange(borrowing.issuedAt, range)).map((borrowing) => borrowing.memberId),
  )

  const active = members.filter((member) => borrowed.has(member.id)).length
  const registered = members.filter((member) => inRange(member.joinedAt, range)).length
  const expired = members.filter(
    (member) => member.expiresAt && new Date(member.expiresAt) < range.to,
  ).length

  return {
    total: members.length,
    active,
    dormant: members.length - active,
    joined: registered,
    expired,
    suspended: members.filter((member) => member.status === 'Suspended').length,
  }
}

// What the library holds and where it is.
export function inventoryReport({ books, borrowings, reservations, repairs, lost }) {
  const openRepairs = repairs.filter(isOpen)
  const unrecoveredLoss = lost.filter((row) => !row.recoveredAt)

  const copies = books.reduce((sum, book) => sum + book.copies, 0)

  return {
    titles: books.length,
    copies,
    available: books.reduce((sum, book) => sum + book.available, 0),
    issued: borrowings.filter((borrowing) => !borrowing.returnedAt && borrowing.status !== 'Lost').length,
    reserved: reservations.filter((row) => row.status === 'Ready for Pickup').length,
    underRepair: openRepairs.length,

    lost: books.reduce((sum, book) => sum + (book.lost ?? 0), 0),
    lostReports: unrecoveredLoss.length,
    damaged: openRepairs.filter((row) => ['Major', 'Critical'].includes(row.severity)).length,
    byCategory: [...new Set(books.map((book) => book.category))].sort().map((category) => {
      const inCategory = books.filter((book) => book.category === category)
      return {
        label: category,
        titles: inCategory.length,
        copies: inCategory.reduce((sum, book) => sum + book.copies, 0),
        available: inCategory.reduce((sum, book) => sum + book.available, 0),
        outNow: inCategory.reduce((sum, book) => sum + book.outNow, 0),
        repairing: inCategory.reduce((sum, book) => sum + (book.repairing ?? 0), 0),
      }
    }),
  }
}

// What broke and what was mended.
export function repairReport({ repairs, range }) {
  const raised = repairs.filter((row) => inRange(row.reportedAt, range))
  const completed = repairs.filter((row) => inRange(row.completedAt, range))
  const done = repairs.filter((row) => row.turnaround !== null)

  const byStaff = new Map()
  for (const repair of repairs) {
    if (!repair.assignedTo || !inRange(repair.reportedAt, range)) continue
    const row = byStaff.get(repair.assignedTo) ?? {
      label: repair.assignedTo,
      role: repair.assignedRole,
      count: 0,
      cost: 0,
    }
    row.count += 1
    row.cost += repair.actualCost ?? 0
    byStaff.set(repair.assignedTo, row)
  }

  const byBook = new Map()
  for (const repair of repairs) {
    const row = byBook.get(repair.bookId) ?? {
      title: repair.bookName,
      code: repair.bookCode,
      count: 0,
      cost: 0,
    }
    row.count += 1
    row.cost += repair.actualCost ?? 0
    byBook.set(repair.bookId, row)
  }

  const damage = new Map()
  for (const repair of raised) {
    const row = damage.get(repair.damageType) ?? { label: repair.damageType, count: 0, cost: 0 }
    row.count += 1
    row.cost += repair.actualCost ?? 0
    damage.set(repair.damageType, row)
  }

  return {
    total: raised.length,
    active: repairs.filter(isOpen).length,
    completed: completed.length,
    cost: repairs
      .filter((row) => inRange(row.completedAt, range))
      .reduce((sum, row) => sum + (row.actualCost ?? 0), 0),
    committed: repairs
      .filter(isOpen)
      .reduce((sum, row) => sum + (row.estimatedCost ?? 0), 0),
    recovered: repairs
      .filter((row) => inRange(row.reportedAt, range))
      .reduce((sum, row) => sum + (row.chargeAmount ?? 0), 0),
    averageDays: done.length
      ? Number((done.reduce((sum, row) => sum + row.turnaround, 0) / done.length).toFixed(1))
      : null,
    overdue: repairs.filter((row) => row.overdueRepair).length,
    damage: [...damage.values()].sort((a, b) => b.count - a.count),
    byStaff: [...byStaff.values()].sort((a, b) => b.count - a.count),
    byBook: [...byBook.values()].filter((row) => row.count > 1).sort((a, b) => b.count - a.count),
    rows: raised,
  }
}

// Books lost or damaged, and their cost.
export function lossReport({ lost, repairs, books, range }) {
  const reported = lost.filter((row) => inRange(row.reportedAt, range))
  const open = reported.filter((row) => !row.recoveredAt)

  const damaged = repairs.filter((row) => inRange(row.reportedAt, range))

  return {
    lost: {
      total: reported.length,
      byMember: reported.filter((row) => row.memberId).length,
      inInventory: reported.filter((row) => !row.memberId).length,
      unresolved: open.filter((row) => row.resolution === 'Open').length,
      recovered: reported.filter((row) => row.recoveredAt).length,
      cost: reported.reduce((sum, row) => sum + (row.total ?? 0), 0),
      recoveredAmount: reported
        .filter((row) => row.paymentStatus === 'Paid')
        .reduce((sum, row) => sum + (row.total ?? 0), 0),
      rows: reported,
    },
    damaged: {
      total: damaged.length,
      bySeverity: ['Minor', 'Moderate', 'Major', 'Critical'].map((severity) => ({
        label: severity,
        count: damaged.filter((row) => row.severity === severity).length,
      })),
      beyondRepair: damaged.filter((row) => row.repairable === false).length,
      cost: damaged.reduce((sum, row) => sum + (row.actualCost ?? 0), 0),
      rows: damaged,
    },

    byCategory: [...new Set(books.map((book) => book.category))]
      .map((category) => {
        const ids = new Set(books.filter((book) => book.category === category).map((book) => book.id))
        return {
          label: category,
          lost: reported.filter((row) => ids.has(row.bookId)).length,
          damaged: damaged.filter((row) => ids.has(row.bookId)).length,
        }
      })
      .filter((row) => row.lost > 0 || row.damaged > 0)
      .sort((a, b) => b.lost + b.damaged - (a.lost + a.damaged)),
  }
}

// What each member of staff did.
export function staffReport({ activity, range }) {
  const entries = activity.filter((row) => inRange(row.at, range))
  const byStaff = new Map()

  const COUNTED = {
    'Book Issued': 'issued',
    'Book Returned': 'returned',
    'Borrowing Renewed': 'renewals',

    'Borrowing Renewed': 'renewals',
    'Reservation Placed': 'reservations',
    'Member Added': 'membersAdded',
    'Fine Collected': 'finesCollected',
    'Fine Created': 'finesRaised',
    'Damage Reported': 'repairsRaised',
    'Repair Status Changed': 'repairsManaged',
    'Notification Sent': 'notifications',
    'Overdue Reminder Sent': 'reminders',
    'Book Reported Lost': 'lostReported',
  }

  for (const row of entries) {
    if (!row.staffName || row.staffName === 'Unknown') continue
    const person = byStaff.get(row.staffName) ?? {
      name: row.staffName,
      staffNumber: row.staffNumber,
      role: row.role,
      total: 0,
      failed: 0,
      logins: 0,
      issued: 0,
      returned: 0,
      renewals: 0,
      reservations: 0,
      membersAdded: 0,
      finesCollected: 0,
      finesRaised: 0,
      repairsRaised: 0,
      repairsManaged: 0,
      notifications: 0,
      reminders: 0,
      lostReported: 0,
      modules: new Set(),
      lastSeen: row.at,
    }

    person.total += 1
    person.modules.add(row.module)
    if (row.status === 'Failed') person.failed += 1
    if (row.action === 'Login') person.logins += 1
    const field = COUNTED[row.action]
    if (field) person[field] += 1
    if (new Date(row.at) > new Date(person.lastSeen)) person.lastSeen = row.at

    byStaff.set(row.staffName, person)
  }

  const byModule = new Map()
  for (const row of entries) {
    byModule.set(row.module, (byModule.get(row.module) ?? 0) + 1)
  }

  return {
    entries: entries.length,
    staff: [...byStaff.values()]
      .map((person) => ({ ...person, moduleCount: person.modules.size }))
      .sort((a, b) => b.total - a.total),
    byModule: [...byModule.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    failed: entries.filter((row) => row.status === 'Failed').length,
    byAction: [...entries.reduce((map, row) => map.set(row.action, (map.get(row.action) ?? 0) + 1), new Map())]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
  }
}

// The whole period in one set of figures.
export function periodicStats({ borrowings, members, books, fineRecords, repairs, lost, reservations, range, granularity }) {
  return bucketSeries({
    range,
    granularity,
    series: [
      { key: 'issued', rows: borrowings, dateOf: (row) => row.issuedAt },
      { key: 'returned', rows: borrowings, dateOf: (row) => row.returnedAt },
      {
        key: 'renewals',
        rows: borrowings.flatMap((borrowing) => borrowing.renewals ?? []),
        dateOf: (row) => row.at,
      },
      { key: 'reservations', rows: reservations, dateOf: (row) => row.reservedAt },
      { key: 'newMembers', rows: members, dateOf: (row) => row.joinedAt },
      { key: 'newBooks', rows: books, dateOf: (row) => row.addedAt },
      {
        key: 'finesCollected',
        rows: fineRecords.filter((row) => row.settled),
        dateOf: (row) => row.settledAt,
        amountOf: (row) => row.amount,
      },
      {
        key: 'finesGenerated',
        rows: fineRecords,
        dateOf: (row) => row.sortAt,
        amountOf: (row) => row.amount,
      },
      { key: 'repairs', rows: repairs, dateOf: (row) => row.reportedAt },
      {
        key: 'repairCost',
        rows: repairs,
        dateOf: (row) => row.completedAt,
        amountOf: (row) => row.actualCost ?? 0,
      },
      { key: 'lost', rows: lost, dateOf: (row) => row.reportedAt },
    ],
  })
}

// Overdue counts over time.
export function overdueSeries({ borrowings, range, granularity }) {
  return bucketSeries({
    range,
    granularity,
    series: [
      {
        key: 'overdue',
        rows: borrowings.filter((borrowing) => borrowing.daysOverdue > 0),
        dateOf: (row) => row.dueAt,
      },
    ],
  })
}
