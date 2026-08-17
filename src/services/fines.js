// Raising fines and recording payments.

import { storage } from './storage.js'
import { record } from './activity.js'

const FINES = 'manualFines'
const PAYMENTS = 'finePayments'

// Fines raised by hand at the desk.
export async function listManualFines() {
  return storage.list(FINES)
}

// Raises a damage or loss charge.
export async function addManualFine({ memberId, bookId, reasons, amount, issueDate, dueDate }) {
  const fine = await storage.insert(FINES, {
    memberId,
    bookId,
    reasons,

    reason: reasons.join(', '),
    amount: Number(amount),
    issueDate,
    dueDate,
  })

  await record('FINE_CREATED', {
    target: `${memberId} · ${bookId}`,
    targetType: 'fine',
    targetId: fine.id,
    reason: reasons.join(', '),
    after: { amount },
  })
  return fine
}

// Edits a hand-raised fine.
export async function updateManualFine(id, { memberId, bookId, reasons, amount, issueDate, dueDate }) {
  const before = await storage.findOne(FINES, (row) => row.id === id)
  const updated = await storage.update(FINES, id, {
    memberId,
    bookId,
    reasons,
    reason: reasons.join(', '),
    amount: Number(amount),
    issueDate,
    dueDate,
  })

  await record('FINE_UPDATED', {
    target: `${memberId} · ${bookId}`,
    targetType: 'fine',
    targetId: id,
    before: { amount: before?.amount ?? null, reason: before?.reason ?? null },
    after: { amount: Number(amount), reason: reasons.join(', ') },
  })
  return updated
}

// Removes a hand-raised fine.
export async function removeManualFine(id) {
  const before = await storage.findOne(FINES, (row) => row.id === id)
  await storage.remove(FINES, id)
  await record('FINE_DELETED', {
    target: before ? `${before.memberId} · ${before.bookId}` : id,
    targetType: 'fine',
    targetId: id,
    before: { amount: before?.amount ?? null, reason: before?.reason ?? null },
  })
}

// Which fines have been paid.
export async function listPayments() {
  return (await storage.getValue(PAYMENTS)) ?? {}
}

// Records money taken against a fine.
export async function recordPayment(key, collectedBy, context = {}) {
  const payments = await listPayments()
  payments[key] = { paidAt: new Date().toISOString(), collectedBy }
  await storage.setValue(PAYMENTS, payments)

  await record('FINE_COLLECTED', {
    target: context.target ?? key,
    targetType: 'fine',
    targetId: context.fineId ?? key,
    after: { amount: context.amount ?? null, collectedBy },
  })
  return payments
}

// Undoes a payment recorded in error.
export async function clearPayment(key) {
  const payments = await listPayments()
  delete payments[key]
  await storage.setValue(PAYMENTS, payments)
  return payments
}
