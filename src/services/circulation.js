// The writes behind the desk: issuing, returning, renewing, reserving, losing.

import { storage } from './storage.js'
import { record } from './activity.js'
import { raiseRepair } from './repairs.js'
import { SEVERITY_FROM_CONDITION } from '../lib/repairs.js'
import { nextLendable } from '../lib/copies.js'
import { renewalExpiry } from '../lib/members.js'
import { patchMember } from './members.js'
import { sendMessage } from './messages.js'
import {
  DEFAULT_RULES,
  NEEDS_REPAIR,
  addDays,
  lostCharge,
  nextInQueue,
  withDefaults,
} from '../lib/circulation.js'

const BORROWINGS = 'issuedBorrowings'
const OVERRIDES = 'borrowingOverrides'
const RESERVATIONS = 'reservations'
const LOST = 'lostReports'
const RULES = 'circulationRules'

let ruleSource = null

// Points the desk at the rules Settings holds.
export function setRuleSource(read) {
  ruleSource = read
}

// The circulation rules in force.
export async function getRules() {
  if (ruleSource) return withDefaults(ruleSource())

  const settings = await storage.getValue('settings')
  if (settings?.circulation) {
    return withDefaults({
      ...settings.circulation,
      finePerDay: settings.finance?.finePerDay,
      maxFine: settings.finance?.maxFine,
      graceDays: settings.finance?.graceDays,
      replacementCost: settings.finance?.replacementCost,
      processingFee: settings.finance?.processingFee,
    })
  }
  return withDefaults(await storage.getValue(RULES))
}

// Saves changed rules.
export async function saveRules(rules, before) {
  const next = withDefaults(rules)
  await storage.setValue(RULES, next)

  await record('RULES_UPDATED', {
    target: 'Circulation rules',
    targetType: 'rules',
    targetId: 'circulation',
    before,
    after: next,
  })
  return next
}

// Borrowings written at the desk.
export async function listIssuedBorrowings() {
  return storage.list(BORROWINGS)
}

// Returns and renewals recorded against the seeded borrowings.
export async function listBorrowingOverrides() {
  return (await storage.getValue(OVERRIDES)) ?? {}
}

async function patchBorrowing(borrowing, patch) {
  if (borrowing.isDesk) return storage.update(BORROWINGS, borrowing.id, patch)

  const overrides = await listBorrowingOverrides()
  overrides[borrowing.id] = { ...(overrides[borrowing.id] ?? {}), ...patch }
  await storage.setValue(OVERRIDES, overrides)
  return overrides[borrowing.id]
}

// Issues a copy, renewing a lapsed membership on the way through.
export async function issueBook({ book, member, issuedAt = new Date().toISOString(), rules, staff, reservations = [], copies = [] }) {
  const active = rules ?? (await getRules())
  const days = Number(active.borrowDays) || DEFAULT_RULES.borrowDays

  const chosen = new Date(issuedAt)
  const clock = new Date()
  const stamp =
    chosen.toDateString() === clock.toDateString() ? clock.toISOString() : chosen.toISOString()

  if (member.expiresAt && new Date(member.expiresAt) < new Date(issuedAt)) {
    await patchMember(
      member.id,
      {
        renewedAt: issuedAt,
        idIssuedAt: issuedAt,
        expiresAt: renewalExpiry(issuedAt).toISOString(),
      },
      { name: member.name, memberId: member.membershipNumber, reason: 'Renewed automatically on issue' },
    )
  }

  const copy = nextLendable(copies, book.id)

  const borrowing = await storage.insert(BORROWINGS, {
    bookId: book.id,
    copyId: copy?.copyId ?? null,
    copyNumber: copy?.number ?? null,
    memberId: member.id,
    issuedAt: stamp,
    dueAt: addDays(stamp, days).toISOString(),
    returnedAt: null,
    renewals: [],
    issuedBy: staff ?? null,
  })

  const holding = reservations.find(
    (row) =>
      row.bookId === book.id &&
      row.memberId === member.id &&
      ['Waiting', 'Ready for Pickup'].includes(row.status),
  )
  if (holding) await collectReservation(holding, { silent: true })

  await record('BOOK_ISSUED', {
    target: book.title,
    targetType: 'borrowing',

    targetId: borrowing.id,
    after: {
      member: member.name,
      memberId: member.membershipNumber,
      book: book.code,
      copy: copy?.copyId ?? null,
      issued: issuedAt.slice(0, 10),
      due: borrowing.dueAt.slice(0, 10),
      borrowDays: days,
    },
  })
  return borrowing
}

// Takes a copy back: charges the fine, raises a repair, calls the next in the queue.
export async function returnBook(borrowing, { condition = 'Good', notes = '', staff, reservations = [], openRepairs = [], returnedAt = new Date().toISOString() } = {}) {
  await patchBorrowing(borrowing, {
    returnedAt,
    returnCondition: condition,
    returnNotes: notes,
    returnedBy: staff ?? null,
  })

  if (NEEDS_REPAIR.has(condition)) {
    await raiseRepair({
      bookId: borrowing.bookId,
      bookCode: borrowing.book?.code ?? borrowing.bookId,
      bookName: borrowing.bookTitle,
      copyId: borrowing.copyId ?? null,
      copyNumber: borrowing.copyNumber ?? freeCopy(borrowing.book, openRepairs),
      damageType: 'Torn pages',
      description: notes.trim() || `Recorded as ${condition} when returned.`,
      severity: SEVERITY_FROM_CONDITION[condition] ?? 'Moderate',
      reportedBy: staff ?? 'Circulation desk',
      source: 'Return',
      borrowingId: borrowing.id,
      memberId: borrowing.memberId,
      memberName: borrowing.memberName,
    })
  }

  const next = nextInQueue(reservations, borrowing.bookId)
  if (next) await markReady(next, { silent: true })

  await record('BOOK_RETURNED', {
    target: borrowing.bookTitle,
    targetType: 'borrowing',
    targetId: borrowing.transaction,
    reason: notes || null,
    before: { status: borrowing.status, due: borrowing.dueAt?.slice(0, 10) },
    after: {
      member: borrowing.memberName,
      returned: returnedAt.slice(0, 10),
      condition,
      daysOverdue: borrowing.daysOverdue,
      fine: borrowing.daysOverdue > 0 ? borrowing.fine : 0,
    },
  })

  return { calledNext: next ?? null, repairRaised: NEEDS_REPAIR.has(condition) }
}

function freeCopy(book, openRepairs = []) {
  const taken = new Set(
    openRepairs.filter((row) => row.bookId === book?.id).map((row) => row.copyNumber ?? 1),
  )
  for (let number = 1; number <= (book?.copies ?? 1); number += 1) {
    if (!taken.has(number)) return number
  }
  return 1
}

// Sends an overdue reminder, through Notifications.
export async function sendReminder(borrowing, { author, locale = 'en-IN' } = {}) {
  const due = new Date(borrowing.dueAt).toLocaleDateString(locale)

  await sendMessage(
    {
      subject: `Overdue: ${borrowing.bookTitle}`,
      body:
        `${borrowing.memberName}, "${borrowing.bookTitle}" (${borrowing.book?.code ?? ''}) was due on ${due} and is ` +
        `now ${borrowing.daysOverdue} days overdue. The fine currently stands at ₹${borrowing.fine}. ` +
        `Please return it at your earliest convenience.`,
      recipients: [{ id: borrowing.memberId, name: borrowing.memberName, kind: 'member' }],
    },
    author,
  )

  const remindedAt = new Date().toISOString()
  await patchBorrowing(borrowing, { remindedAt, reminders: (borrowing.reminders ?? 0) + 1 })

  await record('REMINDER_SENT', {
    target: borrowing.bookTitle,
    targetType: 'borrowing',
    targetId: borrowing.transaction,
    after: {
      member: borrowing.memberName,
      daysOverdue: borrowing.daysOverdue,
      fine: borrowing.fine,
      reminders: (borrowing.reminders ?? 0) + 1,
    },
  })
  return remindedAt
}

// Holds placed at the desk.
export async function listReservations() {
  return storage.list(RESERVATIONS)
}

// Puts a member in the queue for a title.
export async function placeReservation({ book, member, staff }) {
  const reservation = await storage.insert(RESERVATIONS, {
    bookId: book.id,
    memberId: member.id,
    reservedAt: new Date().toISOString(),
    status: 'Waiting',
    readyAt: null,
    expiresAt: null,
    notifiedAt: null,
    placedBy: staff ?? null,
  })

  await record('RESERVATION_PLACED', {
    target: book.title,
    targetType: 'reservation',
    targetId: reservation.id,
    after: { member: member.name, memberId: member.membershipNumber, book: book.code },
  })
  return reservation
}

// Marks a hold ready and tells the member.
export async function markReady(reservation, { rules, staff, silent = false } = {}) {
  const active = rules ?? (await getRules())
  const readyAt = new Date().toISOString()
  const expiresAt = addDays(readyAt, active.reservationDays).toISOString()

  const patch = { status: 'Ready for Pickup', readyAt, expiresAt, notifiedAt: readyAt }
  if (reservation.isDesk) await storage.update(RESERVATIONS, reservation.id, patch)
  else await carryOver(reservation, patch)

  if (!silent) {
    await record('RESERVATION_READY', {
      target: reservation.bookTitle,
      targetType: 'reservation',
      targetId: reservation.code,
      after: { member: reservation.memberName, collectBy: expiresAt.slice(0, 10), notified: true },
    })
  }
  return { readyAt, expiresAt }
}

// Records that a hold was collected.
export async function collectReservation(reservation, { staff, silent = false } = {}) {
  const patch = { status: 'Collected', collectedAt: new Date().toISOString() }
  if (reservation.isDesk) await storage.update(RESERVATIONS, reservation.id, patch)
  else await carryOver(reservation, patch)

  if (!silent) {
    await record('RESERVATION_COLLECTED', {
      target: reservation.bookTitle,
      targetType: 'reservation',
      targetId: reservation.code,
      after: { member: reservation.memberName },
    })
  }
}

// Cancels a hold and moves the queue up.
export async function cancelReservation(reservation, { reason, staff } = {}) {
  const patch = { status: 'Cancelled', cancelledAt: new Date().toISOString(), cancelReason: reason ?? null }
  if (reservation.isDesk) await storage.update(RESERVATIONS, reservation.id, patch)
  else await carryOver(reservation, patch)

  await record('RESERVATION_CANCELLED', {
    target: reservation.bookTitle,
    targetType: 'reservation',
    targetId: reservation.code,
    reason: reason ?? null,
    before: { status: reservation.status, position: reservation.position },
    after: { member: reservation.memberName },
  })
}

async function carryOver(reservation, patch) {
  return storage.insert(RESERVATIONS, {
    id: reservation.id,
    bookId: reservation.bookId,
    memberId: reservation.memberId,
    reservedAt: reservation.reservedAt,
    status: reservation.status,
    readyAt: reservation.readyAt ?? null,
    expiresAt: reservation.expiresAt ?? null,
    notifiedAt: reservation.notifiedAt ?? null,
    ...patch,
  })
}

// Books reported lost.
export async function listLostReports() {
  return storage.list(LOST)
}

// Records a book lost and raises the replacement charge.
export async function reportLost({ borrowing, book, member, reason, replacementCost, rules, staff }) {
  replacementCost = replacementCost ?? book?.price ?? rules?.replacementCost
  const active = rules ?? (await getRules())
  const charge = lostCharge(active, replacementCost)

  const report = await storage.insert(LOST, {
    borrowingId: borrowing?.id ?? null,
    bookId: book.id,
    copyId: borrowing?.copyId ?? null,
    memberId: member?.id ?? null,
    reportedAt: new Date().toISOString(),
    reportedBy: staff ?? null,
    reason,
    replacementCost: charge.replacement,
    processingFee: charge.processing,
    total: charge.total,
    paymentStatus: 'Unpaid',
    resolution: 'Open',
    recoveredAt: null,
  })

  await record('BOOK_LOST', {
    target: book.title,
    targetType: 'book',
    targetId: book.code,
    reason,
    before: borrowing ? { status: borrowing.status, transaction: borrowing.transaction } : undefined,
    after: {
      member: member?.name ?? '—',
      replacement: charge.replacement,
      processing: charge.processing,
      total: charge.total,
    },
  })
  return report
}

// Edits how a lost book is being settled.
export async function updateLostReport(id, patch) {
  const before = await storage.findOne(LOST, (row) => row.id === id)
  const updated = await storage.update(LOST, id, patch)

  await record('LOST_UPDATED', {
    target: before?.bookId ?? id,
    targetType: 'lost',
    targetId: id,
    before: { resolution: before?.resolution ?? null, paymentStatus: before?.paymentStatus ?? null },
    after: patch,
  })
  return updated
}

// Records that a lost book turned up after all.
export async function recoverLost(report, { condition = 'Good', staff } = {}) {
  await storage.update(LOST, report.id, {
    recoveredAt: new Date().toISOString(),
    resolution: 'Recovered',
    recoveredCondition: condition,
  })

  if (NEEDS_REPAIR.has(condition)) {
    await raiseRepair({
      bookId: report.bookId,
      bookCode: report.bookCode,
      bookName: report.bookTitle,
      fault: `${condition} — recovered after being reported lost`,
      raisedBy: staff ?? 'Circulation desk',
    })
  }

  await record('BOOK_RECOVERED', {
    target: report.bookTitle,
    targetType: 'book',
    targetId: report.bookCode,
    before: { resolution: report.resolution, status: 'Lost' },
    after: { condition, backOnShelf: !NEEDS_REPAIR.has(condition) },
  })
}

export { DEFAULT_RULES }
