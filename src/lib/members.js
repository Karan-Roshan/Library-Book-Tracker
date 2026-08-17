// Member records with their borrowing, fines and membership dates attached.

import { FINE_RATE_PER_DAY } from './fines.js'

const DAY = 86_400_000

const startOfDay = (date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

const sameMonth = (a, b) =>
  new Date(a).getFullYear() === new Date(b).getFullYear() &&
  new Date(a).getMonth() === new Date(b).getMonth()

// Whole years old, counting back from the birthday already passed.
export function ageFrom(dob, now = new Date()) {
  if (!dob) return null
  const born = new Date(dob)
  let age = now.getFullYear() - born.getFullYear()
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())
  if (beforeBirthday) age -= 1
  return age >= 0 ? age : null
}

// The member filters: any within a group, all groups together.
export const FILTER_GROUPS = [
  { key: 'status', label: 'Status', options: ['Active', 'Inactive'] },
  { key: 'membership', label: 'Membership', options: ['Valid', 'Expired'] },
  { key: 'joined', label: 'Joined', options: ['This month', 'Earlier'] },
]

// How the register records gender. Optional — blank stays blank.
export const GENDERS = ['Female', 'Male', 'Other']

// How long a membership runs before it needs renewing.
export const MEMBERSHIP_MONTHS = 6

// The date a membership renewed now would run to.
export function renewalExpiry(from = new Date()) {
  const expires = new Date(from)
  expires.setMonth(expires.getMonth() + MEMBERSHIP_MONTHS)
  return expires
}

const GROUP_VALUE = {
  status: (member) => member.status,
  membership: (member, now) =>
    member.expiresAt && new Date(member.expiresAt) < now ? 'Expired' : 'Valid',
  joined: (member, now) => (sameMonth(member.joinedAt, now) ? 'This month' : 'Earlier'),
}

// How many filters are switched on.
export const countFilters = (filters) =>
  Object.values(filters).reduce((total, values) => total + values.length, 0)

function borrowingsByMember(borrowings) {
  const map = new Map()
  for (const borrowing of borrowings) {
    const list = map.get(borrowing.memberId) ?? []
    list.push(borrowing)
    map.set(borrowing.memberId, list)
  }
  return map
}

// Members with their borrowing, fines and overdue counts attached.
export function composeMembers({ library, added = [], overrides = {}, now = new Date() }) {
  const byMember = borrowingsByMember(library.borrowings)
  const today = startOfDay(now)

  const seeded = library.members.map((member) => ({ ...member, isAdded: false }))
  const manual = added.map((member) => ({ ...member, isAdded: true, appetite: 0 }))

  return [...seeded, ...manual]
    .map((member) => ({ ...member, ...(overrides[member.id] ?? {}) }))
    .filter((member) => !member.deleted)
    .map((member) => {
      const borrowings = byMember.get(member.id) ?? []
      const outstanding = borrowings.filter((borrowing) => borrowing.returnedAt === null)
      const overdue = outstanding.filter((borrowing) => new Date(borrowing.dueAt) < today)
      const pendingFine = borrowings.reduce(
        (sum, borrowing) => (borrowing.fine > 0 && !borrowing.finePaid ? sum + borrowing.fine : sum),
        0,
      )
      const paidFine = borrowings.reduce(
        (sum, borrowing) => (borrowing.fine > 0 && borrowing.finePaid ? sum + borrowing.fine : sum),
        0,
      )

      return {
        ...member,
        age: ageFrom(member.dob, now),

        status: member.status ?? (member.active === false ? 'Inactive' : 'Active'),
        borrowings,
        totalBorrowed: borrowings.length,
        currentlyBorrowed: outstanding.length,
        returnedCount: borrowings.length - outstanding.length,
        overdueCount: overdue.length,
        reservations: library.reservations.filter((r) => r.memberId === member.id).length,
        pendingFine,
        paidFine,
      }
    })
}

// The counts across the top of the members page.
export function summarizeMembers(members, now = new Date()) {
  return {
    total: members.length,
    active: members.filter((member) => member.status === 'Active').length,
    inactive: members.filter((member) => member.status !== 'Active').length,
    newThisMonth: members.filter((member) => sameMonth(member.joinedAt, now)).length,
    withOverdue: members.filter((member) => member.overdueCount > 0).length,
    withFines: members.filter((member) => member.pendingFine > 0).length,
  }
}

// Narrows the register by the filter groups and the search box.
export function filterMembers(members, { filters = {}, query = '', now = new Date() } = {}) {
  const term = query.trim().toLowerCase()
  const active = Object.entries(filters).filter(([, values]) => values?.length)

  return members.filter((member) => {
    for (const [group, values] of active) {
      if (!values.includes(GROUP_VALUE[group](member, now))) return false
    }

    if (!term) return true

    return [member.membershipNumber, member.name, member.email, member.phone]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term))
  })
}

// One member's borrowing, newest first.
export function borrowingHistory(member, library, now = new Date()) {
  const bookById = new Map(library.books.map((book) => [book.id, book]))
  const today = startOfDay(now)

  return [...member.borrowings]
    .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))
    .map((borrowing) => {
      const overdue = borrowing.returnedAt === null && new Date(borrowing.dueAt) < today
      return {
        id: borrowing.id,
        title: bookById.get(borrowing.bookId)?.title ?? 'Unknown',
        author: bookById.get(borrowing.bookId)?.author ?? '',
        issuedAt: borrowing.issuedAt,
        dueAt: borrowing.dueAt,
        returnedAt: borrowing.returnedAt,
        status: borrowing.returnedAt ? 'Returned' : overdue ? 'Overdue' : 'Borrowed',
        daysLeft:
          borrowing.returnedAt === null
            ? Math.round((startOfDay(borrowing.dueAt) - today) / DAY)
            : null,
        fine: borrowing.fine,
      }
    })
}

export { FINE_RATE_PER_DAY }
