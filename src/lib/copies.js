// Individual physical copies, and what each one is doing right now.

const pad = (value, width = 2) => String(value).padStart(width, '0')

// The id of one physical copy, as BOOK-001-02.
export const copyId = (bookCode, number) => `${bookCode ?? 'BOOK-000'}-${pad(number)}`

// The accession number stamped in the book itself.
export const accessionOf = (sequence) => `ACC-${pad(sequence, 5)}`

// What a single copy can be doing.
export const COPY_STATUSES = ['Available', 'Issued', 'Under Repair', 'Reserved', 'Lost']

// Colours for each copy status.
export const COPY_BADGE = {
  Available:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
  'Issued':
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300',
  'Under Repair':
    'border-brass-300 bg-brass-50 text-brass-800 dark:border-brass-500/40 dark:bg-brass-500/10 dark:text-brass-300',
  Reserved:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300',
  Lost: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300',
  Withdrawn:
    'border-ink-200 bg-ink-50 text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300',
}

// States in which a copy cannot go out.
export const UNLENDABLE = new Set(['Issued', 'Under Repair', 'Lost'])

// The id of one shelf, as branch, floor, section and number.
export const locationId = (branch, floor, section, shelf) =>
  `${branch}/${floor}/${section}/${shelf}`.toUpperCase().replace(/\s+/g, '-')

// The shelf mark a reader would look for.
export const shelfLabel = (location) =>
  location ? `${location.section}-${pad(location.shelf)}` : '—'

// The full location, written out.
export const locationLabel = (location) =>
  location
    ? `${shelfLabel(location)} · ${location.floorName}, ${location.branch}`
    : 'Not shelved'

const FLOORS = { A: 1, B: 1, C: 1, D: 2, E: 2, F: 2, G: 2, H: 3, I: 3, J: 3 }

// What each floor is called.
export const FLOOR_NAMES = { 1: 'Ground floor', 2: 'First floor', 3: 'Second floor' }

// Which floor a section is on.
export const floorFor = (section) => FLOORS[section] ?? 1

// Builds the shelf list the whole library is arranged on.
export function buildLocations(categories, blockFor) {
  const rows = []
  for (const category of categories) {
    const section = blockFor(category)
    const floor = floorFor(section)
    for (let shelf = 1; shelf <= 12; shelf += 1) {
      rows.push({
        id: locationId('Central', floor, section, shelf),
        branch: 'Central',
        floor,
        floorName: FLOOR_NAMES[floor],
        section,
        sectionName: category,
        shelf,
      })
    }
  }
  return rows
}

// Every copy with its current state worked out from borrowings, repairs and losses.
export function composeCopies({
  copies = [],
  borrowings = [],
  repairs = [],
  lostReports = [],
  reservations = [],
  books = [],
  locations = [],
  now = new Date(),
}) {
  const bookById = new Map(books.map((book) => [book.id, book]))
  const locationById = new Map(locations.map((row) => [row.id, row]))

  const outNow = new Map()
  for (const borrowing of borrowings) {
    if (borrowing.returnedAt || !borrowing.copyId) continue
    outNow.set(borrowing.copyId, borrowing)
  }

  const onBench = new Map()
  for (const repair of repairs) {
    if (!repair.copyId) continue
    if (repair.status === 'Complete') continue
    onBench.set(repair.copyId, repair)
  }

  const lost = new Map()
  for (const report of lostReports) {
    if (report.recoveredAt || !report.copyId) continue
    lost.set(report.copyId, report)
  }

  const held = new Map()
  for (const row of reservations) {
    if (row.status === 'Ready for Pickup' && row.copyId) held.set(row.copyId, row)
  }

  return copies.map((copy) => {
    const book = bookById.get(copy.bookId)
    const location = locationById.get(copy.locationId) ?? null

    const borrowing = outNow.get(copy.copyId) ?? null
    const repair = onBench.get(copy.copyId) ?? null
    const loss = lost.get(copy.copyId) ?? null
    const hold = held.get(copy.copyId) ?? null

    const status =
      loss
          ? 'Lost'
          : repair
            ? 'Under Repair'
            : borrowing
              ? 'Issued'
              : hold
                ? 'Reserved'
                : 'Available'

    return {
      ...copy,
      book,
      title: book?.title ?? 'Unknown title',
      author: book?.author ?? '—',
      category: book?.category ?? '—',
      location,
      shelf: shelfLabel(location),
      where: locationLabel(location),
      status,
      lendable: !UNLENDABLE.has(status),
      borrowing,
      repair,
      loss,
      hold,
    }
  })
}

// Every copy of one title.
export const copiesOfBook = (copies, bookId) =>
  copies.filter((copy) => copy.bookId === bookId).sort((a, b) => a.number - b.number)

// The copy that should go out next.
export const nextLendable = (copies, bookId) =>
  copiesOfBook(copies, bookId).find((copy) => copy.status === 'Available') ?? null

// How many copies a title has, and how many are available.
export function stockOf(copies, bookId) {
  const rows = copiesOfBook(copies, bookId)
  return {
    copies: rows.length,
    available: rows.filter((copy) => copy.status === 'Available').length,
    outNow: rows.filter((copy) => copy.status === 'Issued').length,
    repairing: rows.filter((copy) => copy.status === 'Under Repair').length,
    lost: rows.filter((copy) => copy.status === 'Lost').length,
  }
}

// Narrows a copy list by status and location.
export function filterCopies(copies, { query = '', status = 'all', floor = 'all', section = 'all' } = {}) {
  const term = query.trim().toLowerCase()
  return copies.filter((copy) => {
    if (status !== 'all' && copy.status !== status) return false
    if (floor !== 'all' && String(copy.location?.floor) !== String(floor)) return false
    if (section !== 'all' && copy.location?.section !== section) return false
    if (!term) return true
    return [copy.copyId, copy.accession, copy.barcode, copy.title, copy.author, copy.shelf]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term))
  })
}
