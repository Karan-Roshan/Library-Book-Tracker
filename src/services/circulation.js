// The writes behind the desk: issuing, returning, renewing, reserving, losing.

import { storage } from './storage.js'
import { record } from './activity.js'
import { raiseRepair } from './repairs.js'
import { SEVERITY_FROM_CONDITION } from '../lib/repairs.js'
import { nextLendable } from '../lib/copies.js'
import { renewalExpiry } from '../lib/members.js'
import { patchMember } from './members.js'
import { notifyMember, sendMessage } from './messages.js'
import { library } from '../data/demoLibrary.js'
import {
  RESERVATION_SEQUENCE_MAX,
  reservationNumber,
  reservationSequenceOf,
} from '../lib/ids.js'
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
const RESERVATION_SEQUENCE = 'reservationSequence'

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

// The next number in the reservation series. It is worked out from three
// things at once so it can never hand out a number twice: the counter we keep,
// the highest number already on a hold, and the seeded holds the demo library
// starts with. Whichever is highest wins, and the counter moves past it — so a
// number is not reused even after its reservation is deleted.
async function nextReservationNumber(placed) {
  const stored = Number(await storage.getValue(RESERVATION_SEQUENCE)) || 0
  const counter = stored > RESERVATION_SEQUENCE_MAX ? 0 : stored

  const highestPlaced = placed.reduce(
    (top, row) => Math.max(top, reservationSequenceOf(row.code)),
    0,
  )
  const seeded = library.reservations?.length ?? 0

  const next = Math.max(counter, highestPlaced, seeded) + 1
  await storage.setValue(RESERVATION_SEQUENCE, next)
  return next
}

// Holds placed before this ran were numbered off their database id, which was
// random. Give any that are still unnumbered — or that carry one of those old
// unreadable references — a real one, oldest first, so the series has no gaps
// and no repeats.
async function numberOlderHolds(placed) {
  const unnumbered = placed
    .filter((row) => !reservationSequenceOf(row.code))
    .sort((a, b) => new Date(a.reservedAt) - new Date(b.reservedAt))

  for (const row of unnumbered) {
    row.code = reservationNumber(await nextReservationNumber(placed))
    await storage.update(RESERVATIONS, row.id, { code: row.code })
  }
  return placed
}

// Puts a member in the queue for a title. A member reserving for themselves has
// already seen it happen on screen, so `byMember` suppresses the confirmation —
// only a hold placed for them at the desk is worth a notice.
export async function placeReservation({ book, member, staff, byMember = false }) {
  const placed = await numberOlderHolds(await listReservations())
  const code = reservationNumber(await nextReservationNumber(placed))

  const reservation = await storage.insert(RESERVATIONS, {
    code,
    bookId: book.id,
    memberId: member.id,
    reservedAt: new Date().toISOString(),
    status: 'Waiting',
    readyAt: null,
    expiresAt: null,
    notifiedAt: null,
    placedBy: staff ?? null,
  })

  if (!byMember) {
    await notifyMember('reservationPlaced', {
      member,
      subject: `Reservation placed: ${book.title}`,
      body:
        `The library has placed a hold on "${book.title}" (${book.code}) for you, reference ` +
        `${code}. You will be told again once a copy is on the counter.`,
    })
  }

  await record('RESERVATION_PLACED', {
    target: book.title,
    targetType: 'reservation',
    targetId: code,
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
    // The hold is marked notified, so the member has to actually be told.
    await notifyMember('reservationReady', {
      member: { id: reservation.memberId, name: reservation.memberName },
      subject: `Ready to collect: ${reservation.bookTitle}`,
      body:
        `"${reservation.bookTitle}" is on the counter for you. Please collect it by ` +
        `${expiresAt.slice(0, 10)}, after which the hold lapses and the copy goes to the next ` +
        `member in the queue.`,
    })

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

  await notifyMember('reservationCancelled', {
    member: { id: reservation.memberId, name: reservation.memberName },
    subject: `Reservation cancelled: ${reservation.bookTitle}`,
    body:
      `Your hold on "${reservation.bookTitle}" has been cancelled` +
      `${reason ? ` — ${reason}` : ''}. Ask at the desk if you would like it placed again.`,
  })

  await record('RESERVATION_CANCELLED', {
    target: reservation.bookTitle,
    targetType: 'reservation',
    targetId: reservation.code,
    reason: reason ?? null,
    before: { status: reservation.status, position: reservation.position },
    after: { member: reservation.memberName },
  })
}

// Removes a hold for good. A hold placed at the desk is a row of its own and
// simply goes; a seeded one cannot be deleted from the demo catalogue, so it is
// written down as deleted instead. Either way the change lands in the
// reservations collection, which every open dashboard is listening to.
export async function deleteReservation(reservation, { staff } = {}) {
  if (reservation.isDesk) await storage.remove(RESERVATIONS, reservation.id)
  else await carryOver(reservation, { deleted: true })

  await record('RESERVATION_DELETED', {
    target: reservation.bookTitle,
    targetType: 'reservation',
    targetId: reservation.code,
    before: {
      member: reservation.memberName,
      memberId: reservation.memberNumber,
      book: reservation.bookCode,
      status: reservation.status,
      placed: reservation.reservedAt,
    },
  })
}

async function carryOver(reservation, patch) {
  return storage.insert(RESERVATIONS, {
    id: reservation.id,
    code: reservation.code,
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
