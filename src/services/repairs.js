// The repair bench: raising a job and walking it through its stages.

import { storage } from './storage.js'
import { record } from './activity.js'

const REPAIRS = 'repairs'

// Every repair job.
export async function listRepairs() {
  return storage.list(REPAIRS)
}

const step = (by, from, to, note = null) => ({
  at: new Date().toISOString(),
  by: by ?? null,
  from,
  to,
  note,
})

// Opens a repair and takes the copy off the shelf immediately.
export async function raiseRepair({
  bookId,
  bookCode,
  bookName,
  copyId = null,
  copyNumber = 1,
  damageType,
  description = '',
  severity = 'Moderate',
  reportedBy,
  reportedByRole = null,

  source = 'Desk',
  borrowingId = null,
  memberId = null,
  memberName = null,
  fineId = null,

  fault = null,
  raisedBy = null,
}) {
  const now = new Date().toISOString()

  const repair = await storage.insert(REPAIRS, {
    bookId,
    bookCode,
    bookName,

    copyId: copyId ?? `${bookCode}-${String(copyNumber).padStart(2, '0')}`,
    copyNumber,
    damageType: damageType ?? fault ?? 'Torn pages',
    description,
    severity,

    status: 'Reported',
    reportedAt: now,
    reportedBy: reportedBy ?? raisedBy ?? 'Unknown',
    reportedByRole,
    source,

    borrowingId,
    memberId,
    memberName,

    inspectedAt: null,
    inspectedBy: null,
    repairable: null,
    estimatedCost: null,

    assignedTo: null,
    assignedToId: null,
    assignedRole: null,
    assignedAt: null,

    startedAt: null,
    expectedAt: null,
    actions: '',

    completedAt: null,
    actualCost: null,
    finalCondition: null,
    approvedBy: null,
    approvedAt: null,
    availableAt: null,

    fineId,
    chargeAmount: null,

    history: [step(reportedBy ?? raisedBy, null, 'Reported', description || null)],
  })

  await record('REPAIR_CREATED', {
    target: `${bookName} · copy ${copyNumber}`,
    targetType: 'repair',
    targetId: repair.id,
    reason: damageType ?? fault,
    after: {
      copy: copyNumber,
      damage: damageType ?? fault,
      severity,
      source,
      reportedBy: reportedBy ?? raisedBy,
      member: memberName,
    },
  })
  return repair
}

// Moves a job to its next stage, stamping that stage's own fields.
export async function advance(repair, to, details = {}, staff) {
  const now = new Date().toISOString()
  const patch = { status: to, history: [...(repair.history ?? []), step(staff, repair.status, to, details.note)] }

  if (to === 'In Process') {
    patch.inspectedAt = now
    patch.inspectedBy = staff ?? null
    patch.startedAt = now
    if (details.severity) patch.severity = details.severity
    if (details.damageType) patch.damageType = details.damageType
    if (details.estimatedCost !== undefined) patch.estimatedCost = Number(details.estimatedCost) || 0
    if (details.assignedTo) {
      patch.assignedTo = details.assignedTo
      patch.assignedToId = details.assignedToId ?? null
      patch.assignedRole = details.assignedRole ?? null
      patch.assignedAt = now
    }
    if (details.expectedAt) patch.expectedAt = new Date(details.expectedAt).toISOString()
    if (details.actions !== undefined) patch.actions = details.actions
  }

  if (to === 'Complete') {
    patch.completedAt = now
    patch.availableAt = now
    patch.approvedBy = staff ?? null
    patch.approvedAt = now
    if (details.actualCost !== undefined) patch.actualCost = Number(details.actualCost) || 0
    if (details.finalCondition) patch.finalCondition = details.finalCondition
  }

  const updated = await storage.update(REPAIRS, repair.id, patch)

  await record('REPAIR_UPDATED', {
    target: `${repair.bookName} · ${repair.copyCode ?? `copy ${repair.copyNumber}`}`,
    targetType: 'repair',
    targetId: repair.id,
    reason: details.note ?? null,
    before: { status: repair.status },
    after: {
      status: to,
      ...(patch.estimatedCost !== undefined ? { estimatedCost: patch.estimatedCost } : {}),
      ...(patch.actualCost !== undefined && patch.actualCost !== null
        ? { actualCost: patch.actualCost }
        : {}),
      ...(patch.assignedTo ? { assignedTo: patch.assignedTo } : {}),
      ...(patch.finalCondition ? { condition: patch.finalCondition } : {}),
      by: staff ?? null,
    },
  })
  return updated
}

// Hands a job to somebody without moving it along.
export async function assign(repair, person, staff) {
  const updated = await storage.update(REPAIRS, repair.id, {
    assignedTo: person.name,
    assignedToId: person.staffNumber ?? person.id ?? null,
    assignedRole: person.roleLabel ?? person.role ?? null,
    assignedAt: new Date().toISOString(),
    history: [
      ...(repair.history ?? []),
      step(staff, repair.status, repair.status, `Assigned to ${person.name}`),
    ],
  })

  await record('REPAIR_ASSIGNED', {
    target: `${repair.bookName} · ${repair.copyCode ?? `copy ${repair.copyNumber}`}`,
    targetType: 'repair',
    targetId: repair.id,
    before: { assignedTo: repair.assignedTo ?? null },
    after: { assignedTo: person.name, role: person.roleLabel ?? person.role ?? null },
  })
  return updated
}

// Revises the estimate or the final cost.
export async function setCosts(repair, { estimatedCost, actualCost, note }, staff) {
  const patch = {
    history: [...(repair.history ?? []), step(staff, repair.status, repair.status, note ?? 'Costs revised')],
  }
  if (estimatedCost !== undefined) patch.estimatedCost = Number(estimatedCost) || 0
  if (actualCost !== undefined) patch.actualCost = Number(actualCost) || 0

  const updated = await storage.update(REPAIRS, repair.id, patch)

  await record('REPAIR_COSTED', {
    target: `${repair.bookName} · ${repair.copyCode ?? `copy ${repair.copyNumber}`}`,
    targetType: 'repair',
    targetId: repair.id,
    reason: note ?? null,
    before: { estimated: repair.estimatedCost ?? null, actual: repair.actualCost ?? null },
    after: {
      estimated: patch.estimatedCost ?? repair.estimatedCost ?? null,
      actual: patch.actualCost ?? repair.actualCost ?? null,
    },
  })
  return updated
}

// Notes that the member was charged for the damage.
export async function markCharged(repair, { fineId, amount }, staff) {
  const updated = await storage.update(REPAIRS, repair.id, {
    fineId,
    chargeAmount: Number(amount) || 0,
    history: [
      ...(repair.history ?? []),
      step(staff, repair.status, repair.status, `Charged ₹${amount} to ${repair.memberName}`),
    ],
  })

  await record('REPAIR_CHARGED', {
    target: `${repair.bookName} · ${repair.copyCode ?? `copy ${repair.copyNumber}`}`,
    targetType: 'repair',
    targetId: repair.id,
    after: { member: repair.memberName, amount: Number(amount) || 0, fineId },
  })
  return updated
}

// Deletes a repair job.
export async function removeRepair(id) {
  const before = await storage.findOne(REPAIRS, (row) => row.id === id)
  await storage.remove(REPAIRS, id)

  await record('REPAIR_DELETED', {
    target: before?.bookName ?? id,
    targetType: 'repair',
    targetId: id,
    before: {
      status: before?.status ?? null,
      damage: before?.damageType ?? before?.fault ?? null,
      copy: before?.copyNumber ?? null,
    },
  })
}

// Moves a job by status alone, for the older call sites.
export async function setRepairStatus(id, status, staff) {
  const repair = await storage.findOne(REPAIRS, (row) => row.id === id)
  if (!repair) return null
  return advance(repair, status, {}, staff)
}
