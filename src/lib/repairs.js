// Damaged copies and the three stages of getting them mended.

export const REPAIR_STATUSES = ['Reported', 'In Process', 'Complete']

// The same three, under the older name some screens still import.
export const ALL_STATUSES = REPAIR_STATUSES

// Stages in which the copy is not lendable.
export const OFF_SHELF = new Set(['Reported', 'In Process'])

// The stage that means the work is finished.
export const CLOSED = new Set(['Complete'])

const LEGACY_STATUS = {
  Pending: 'Reported',
  Processing: 'In Process',
  Finished: 'Complete',
  'Under Inspection': 'Reported',
  'Under Repair': 'In Process',
  Repaired: 'In Process',
  Available: 'Complete',
  Withdrawn: 'Complete',
}

// The stage a record is in, reading older vocabulary forward.
export const statusOf = (repair) =>
  REPAIR_STATUSES.includes(repair?.status)
    ? repair.status
    : (LEGACY_STATUS[repair?.status] ?? 'Reported')

// Whether this repair is still somebody's job.
export const isOpen = (repair) => !CLOSED.has(statusOf(repair))

// What each stage means, in plain words.
export const STATUS_MEANING = {
  Reported: 'Damage recorded. The copy is off the shelf until it is dealt with.',
  'In Process': 'Being repaired. Still off the shelf.',
  Complete: 'Repaired, checked, and back in circulation.',
}

// The one move available from each stage.
export const NEXT_STEP = {
  Reported: { to: 'In Process', label: 'Start repair' },
  'In Process': { to: 'Complete', label: 'Mark complete' },
}

// Colours for each stage.
export const STATUS_BADGE = {
  Reported:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300',
  'In Process':
    'border-brass-300 bg-brass-50 text-brass-800 dark:border-brass-500/40 dark:bg-brass-500/10 dark:text-brass-300',
  Complete:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
}

// What can be wrong with a copy.
export const DAMAGE_TYPES = [
  'Torn pages',
  'Broken binding',
  'Damaged cover',
  'Damaged spine',
  'Water damage',
  'Missing pages',
  'Writing or marking',
  'Stained pages',
  'Loose pages',
  'Damaged barcode',
]

// How bad the damage is.
export const SEVERITIES = ['Minor', 'Moderate', 'Major', 'Critical']

// What each severity means.
export const SEVERITY_MEANING = {
  Minor: 'Small damage, easily put right at the desk.',
  Moderate: 'Needs proper repair work by staff.',
  Major: 'Significant damage; the copy may be off the shelf for a while.',
  Critical: 'May be beyond repair — consider replacing the copy.',
}

// Colours for each severity.
export const SEVERITY_BADGE = {
  Minor:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
  Moderate:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300',
  Major: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300',
  Critical:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300',
}

// Orders severities so the worst sorts first.
export const severityRank = (severity) => SEVERITIES.indexOf(severity)

// Fines whose fault can actually be mended.
export const REPAIRABLE_FAULTS = [
  'Marked or written in',
  'Torn or missing pages',
  'Damaged binding',
  'Water damage',
]

// Whether a fine's reasons mean a repair should be raised.
export const repairableFrom = (reasons = []) =>
  reasons.filter((reason) => REPAIRABLE_FAULTS.includes(reason))

// Turns a fine's wording into a damage type.
export const DAMAGE_FROM_FAULT = {
  'Marked or written in': 'Writing or marking',
  'Torn or missing pages': 'Torn pages',
  'Damaged binding': 'Broken binding',
  'Water damage': 'Water damage',
}

// Turns a return condition into a severity.
export const SEVERITY_FROM_CONDITION = {
  Damaged: 'Moderate',
  'Heavily Damaged': 'Major',
}

// The printed code for one physical copy.
export const copyCode = (bookCode, copyNumber) =>
  `${bookCode ?? 'BOOK-000'}-${String(copyNumber ?? 1).padStart(2, '0')}`

// Every copy of a title, with any open repair attached.
export function copiesOf(book, repairs = []) {
  const claimed = new Map()
  for (const repair of repairs) {
    if (repair.bookId === book.id && isOpen(repair)) claimed.set(repair.copyNumber, repair)
  }

  const total = book.copies ?? 0
  const outNow = book.outNow ?? 0
  let lent = 0

  return Array.from({ length: total }, (_, index) => {
    const number = index + 1
    const repair = claimed.get(number) ?? null

    if (repair) {
      return { number, code: copyCode(book.code, number), status: repair.status, repair }
    }
    if (lent < outNow) {
      lent += 1
      return { number, code: copyCode(book.code, number), status: 'Issued', repair: null }
    }
    return { number, code: copyCode(book.code, number), status: 'Available', repair: null }
  })
}

// Copies that could be sent to the bench.
export const repairableCopies = (book, repairs = []) =>
  copiesOf(book, repairs).filter((copy) => !copy.repair)

// The reference on a repair job.
export const repairRef = (index) => `REP-${String(index + 1).padStart(4, '0')}`

const DAY = 86_400_000

const days = (from, to) =>
  from && to ? Math.max(0, Math.round((new Date(to) - new Date(from)) / DAY)) : null

function normalise(repair) {
  if (REPAIR_STATUSES.includes(repair.status)) return repair
  return {
    ...repair,
    status: statusOf(repair),
    damageType: repair.damageType ?? repair.fault ?? 'Torn pages',
    severity: repair.severity ?? 'Moderate',
  }
}

// Repairs joined to their book and copy, with turnaround worked out.
export function composeRepairs({ repairs = [], books = [], members = [] }) {
  const bookById = new Map(books.map((book) => [book.id, book]))
  const memberById = new Map(members.map((member) => [member.id, member]))

  const ordered = [...repairs]
    .map(normalise)
    .sort((a, b) => new Date(a.reportedAt ?? a.raisedAt) - new Date(b.reportedAt ?? b.raisedAt))

  const seen = new Map()

  const composed = ordered.map((repair, index) => {
    const book = bookById.get(repair.bookId)
    const code = book?.code ?? repair.bookCode ?? 'BOOK-000'
    const copyNumber = repair.copyNumber ?? 1
    const key = `${repair.bookId}#${copyNumber}`
    const sequence = (seen.get(key) ?? 0) + 1
    seen.set(key, sequence)

    const reportedAt = repair.reportedAt ?? repair.raisedAt ?? null
    const completedAt = repair.completedAt ?? null
    const actual = repair.actualCost ?? null

    return {
      ...repair,
      ref: repairRef(index),

      sequence,
      book,
      member: repair.memberId ? (memberById.get(repair.memberId) ?? null) : null,
      bookCode: code,
      bookName: book?.title ?? repair.bookName ?? 'Unknown title',
      author: book?.author ?? '—',
      isbn: book?.isbn ?? '—',
      category: book?.category ?? '—',
      shelf: book?.shelf ?? '—',
      copyNumber,
      copyCode: copyCode(code, copyNumber),
      damageType: repair.damageType ?? repair.fault ?? 'Torn pages',
      severity: repair.severity ?? 'Moderate',
      description: repair.description ?? '',
      reportedAt,
      reportedBy: repair.reportedBy ?? repair.raisedBy ?? 'Unknown',
      estimatedCost: repair.estimatedCost ?? null,
      actualCost: actual,
      totalCost: actual ?? repair.estimatedCost ?? 0,
      open: isOpen({ ...repair, status: repair.status ?? 'Reported' }),
      history: repair.history ?? [],

      turnaround: days(reportedAt, completedAt),
      onShelfAfter: days(reportedAt, repair.availableAt),
      overdueRepair:
        repair.expectedAt && !completedAt && new Date(repair.expectedAt) < new Date(),
    }
  })

  return composed.reverse()
}

// Every repair one copy has ever had.
export const historyFor = (repairs, bookId, copyNumber) =>
  repairs
    .filter((repair) => repair.bookId === bookId && repair.copyNumber === copyNumber)
    .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt))

// Every repair any copy of a title has had.
export const historyForTitle = (repairs, bookId) =>
  repairs
    .filter((repair) => repair.bookId === bookId)
    .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt))

// Worst and oldest first.
export function sortRepairs(repairs) {
  return [...repairs].sort((a, b) => {
    if (a.open !== b.open) return a.open ? -1 : 1
    if (a.open) {
      return (
        severityRank(b.severity) - severityRank(a.severity) ||
        new Date(a.reportedAt) - new Date(b.reportedAt)
      )
    }
    return new Date(b.reportedAt) - new Date(a.reportedAt)
  })
}

// Narrows the bench by search, stage, severity and who has it.
export function filterRepairs(repairs, { query = '', status = 'all', severity = 'all', assignee = 'all' } = {}) {
  const term = query.trim().toLowerCase()

  return repairs.filter((repair) => {
    if (status === 'open' ? !repair.open : status !== 'all' && repair.status !== status) return false
    if (severity !== 'all' && repair.severity !== severity) return false
    if (assignee !== 'all' && (repair.assignedTo ?? '') !== assignee) return false
    if (!term) return true
    return [
      repair.ref,
      repair.copyCode,
      repair.bookCode,
      repair.bookName,
      repair.damageType,
      repair.description,
      repair.assignedTo,
      repair.reportedBy,
    ]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term))
  })
}

// The counts across the top of the repairs page.
export function summarizeRepairs(repairs) {
  const spend = repairs.reduce((sum, repair) => sum + (repair.actualCost ?? 0), 0)

  return {
    total: repairs.length,
    reported: repairs.filter((repair) => repair.status === 'Reported').length,
    inProcess: repairs.filter((repair) => repair.status === 'In Process').length,
    completed: repairs.filter((repair) => repair.status === 'Complete').length,
    open: repairs.filter((repair) => repair.open).length,
    overdue: repairs.filter((repair) => repair.overdueRepair).length,
    spend,
    committed: repairs
      .filter((repair) => repair.open)
      .reduce((sum, repair) => sum + (repair.estimatedCost ?? 0), 0),
    recovered: repairs.reduce((sum, repair) => sum + (repair.chargeAmount ?? 0), 0),

    turnaround: (() => {
      const done = repairs.filter((repair) => repair.turnaround !== null)
      if (!done.length) return null
      return Math.round(done.reduce((sum, repair) => sum + repair.turnaround, 0) / done.length)
    })(),
  }
}

// What breaks most often.
export function damageBreakdown(repairs) {
  const counts = new Map()
  for (const repair of repairs) {
    const entry = counts.get(repair.damageType) ?? { type: repair.damageType, count: 0, cost: 0 }
    entry.count += 1
    entry.cost += repair.actualCost ?? 0
    counts.set(repair.damageType, entry)
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)
}
