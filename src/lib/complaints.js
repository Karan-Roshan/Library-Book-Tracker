// Complaints and their three stages, and who each one is for.

import { ROLE_LABELS } from './permissions.js'

const DAY = 86_400_000

// The three stages a complaint moves through.
export const COMPLAINT_STATUSES = ['Received', 'In Process', 'Completed']

// Stages that are still somebody's job.
export const OPEN_STATUSES = new Set(['Received', 'In Process'])

// Whether this complaint is still open.
export const isOpen = (complaint) => OPEN_STATUSES.has(statusOf(complaint))

// The one move available from each stage.
export const NEXT_STEP = {
  Received: { to: 'In Process', label: 'Start work' },
  'In Process': { to: 'Completed', label: 'Mark completed' },
}

const LEGACY_STATUS = {
  Open: 'Received',
  New: 'Received',
  Pending: 'Received',
  Processing: 'In Process',
  'In Progress': 'In Process',
  Resolved: 'Completed',
  Closed: 'Completed',
  Complete: 'Completed',
}

// The stage a record is in, reading older vocabulary forward.
export const statusOf = (complaint) =>
  COMPLAINT_STATUSES.includes(complaint?.status)
    ? complaint.status
    : (LEGACY_STATUS[complaint?.status] ?? 'Received')

// What each stage means, in plain words.
export const STATUS_MEANING = {
  Received: 'Logged, and waiting for somebody to pick it up.',
  'In Process': 'Somebody is dealing with it now.',
  Completed: 'Dealt with, and the complainant told.',
}

// Colours for each stage.
export const STATUS_BADGE = {
  Received:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300',
  'In Process':
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300',
  Completed:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
}

// What a complaint can be about — kept short so the counts mean something.
export const COMPLAINT_CATEGORIES = [
  'Book condition',
  'Book not available',
  'Service at the desk',
  'Staff behaviour',
  'Fine or charge',
  'Facilities',
  'Something else',
]

// How urgent a complaint is.
export const PRIORITIES = ['Low', 'Normal', 'High']

// Colours for each priority.
export const PRIORITY_BADGE = {
  Low: 'border-ink-200 bg-ink-50 text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300',
  Normal:
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300',
  High: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300',
}

// Who has to deal with it: a member's goes to the desk, an assistant's to the administrator.
export const addressedTo = (complaint) =>
  (complaint?.raisedByRole ?? 'member') === 'member' ? 'desk' : 'administrator'

// How each addressee is written on screen.
export const ADDRESSEE_LABEL = {
  desk: 'The desk',
  administrator: 'The administrator',
}

// Whether this person may move this complaint along — an assistant may not settle their own.
export const mayWork = (complaint, role) =>
  role === 'owner' || addressedTo(complaint) === 'desk'

// The reference on a complaint.
export const complaintRef = (index) => `CMP-${String(index + 1).padStart(4, '0')}`

// How long a complaint may sit open before the list should be shouting about it.
export const STALE_DAYS = 7

const daysBetween = (from, to) => Math.max(0, Math.round((new Date(to) - new Date(from)) / DAY))

// Complaints joined to the people involved, with age and source worked out.
export function composeComplaints({ complaints = [], members = [], staff = [], now = new Date() }) {
  const memberById = new Map(members.map((member) => [member.id, member]))
  const staffById = new Map(staff.map((person) => [person.id, person]))

  const ordered = [...complaints].sort(
    (a, b) => new Date(a.raisedAt ?? a.createdAt) - new Date(b.raisedAt ?? b.createdAt),
  )

  const composed = ordered.map((complaint, index) => {
    const status = statusOf(complaint)
    const raisedAt = complaint.raisedAt ?? complaint.createdAt ?? null
    const open = OPEN_STATUSES.has(status)

    const member = complaint.memberId ? (memberById.get(complaint.memberId) ?? null) : null
    const author = complaint.raisedById ? (staffById.get(complaint.raisedById) ?? null) : null

    const age = raisedAt ? daysBetween(raisedAt, open ? now : (complaint.completedAt ?? now)) : 0

    return {
      ...complaint,
      ref: complaintRef(index),
      status,
      raisedAt,
      member,
      author,

      raisedByName: member?.name ?? author?.name ?? complaint.raisedByName ?? 'Unknown',
      raisedByRole: complaint.raisedByRole ?? (member ? 'member' : 'staff'),

      sourceRole: member ? 'member' : (author?.role ?? 'librarian'),

      addressedTo: addressedTo(complaint),
      sourceLabel: member
        ? 'Member'
        : (ROLE_LABELS[author?.role] ?? 'Staff'),
      contact: member?.email ?? author?.email ?? complaint.contact ?? null,
      category: complaint.category ?? 'Something else',
      priority: complaint.priority ?? 'Normal',
      open,
      age,

      stale: open && age >= STALE_DAYS,
      history: complaint.history ?? [],
    }
  })

  return composed.reverse()
}

// Narrows the register by stage, source, category, priority, age and date.
export function filterComplaints(
  rows,
  {
    query = '',
    status = 'all',
    category = 'all',
    priority = 'all',
    raisedBy = 'all',
    addressed = 'all',
    age = 'all',
    from = '',
    to = '',
  } = {},
) {
  const term = query.trim().toLowerCase()
  const startOfDay = (value) => {
    const date = new Date(value)
    date.setHours(0, 0, 0, 0)
    return date
  }

  return rows.filter((row) => {
    if (status !== 'all' && row.status !== status) return false
    if (category !== 'all' && row.category !== category) return false
    if (priority !== 'all' && row.priority !== priority) return false

    if (raisedBy === 'member' && row.raisedByRole !== 'member') return false
    if (raisedBy === 'staff' && row.raisedByRole === 'member') return false

    if (addressed !== 'all' && row.addressedTo !== addressed) return false

    if (age === 'stale' && !row.stale) return false
    if (age === 'today' && row.age !== 0) return false

    if (from && startOfDay(row.raisedAt) < startOfDay(from)) return false
    if (to && startOfDay(row.raisedAt) > startOfDay(to)) return false

    if (!term) return true
    return [row.ref, row.subject, row.details, row.raisedByName, row.category, row.assignedTo]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term))
  })
}

// The counts across the top of the complaints page.
export function summarizeComplaints(rows) {
  return {
    total: rows.length,
    received: rows.filter((row) => row.status === 'Received').length,
    inProcess: rows.filter((row) => row.status === 'In Process').length,
    completed: rows.filter((row) => row.status === 'Completed').length,
    stale: rows.filter((row) => row.stale).length,
    forAdministrator: rows.filter((row) => row.addressedTo === 'administrator' && row.open).length,
  }
}
