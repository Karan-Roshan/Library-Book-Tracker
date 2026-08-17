// Raising complaints and moving them through their stages.

import { storage } from './storage.js'
import { record } from './activity.js'

const COMPLAINTS = 'complaints'

// Every complaint.
export async function listComplaints() {
  return storage.list(COMPLAINTS)
}

const step = (by, from, to, note = null) => ({
  at: new Date().toISOString(),
  by: by ?? null,
  from,
  to,
  note,
})

// Logs a new complaint, from a member or from staff.
export async function raiseComplaint({
  subject,
  details,
  category = 'Something else',
  priority = 'Normal',

  memberId = null,
  memberName = null,

  raisedById = null,
  raisedByName = null,
  raisedByRole = 'member',
  contact = null,
}) {
  const now = new Date().toISOString()

  const complaint = await storage.insert(COMPLAINTS, {
    subject: String(subject ?? '').trim(),
    details: String(details ?? '').trim(),
    category,
    priority,

    status: 'Received',
    raisedAt: now,
    memberId,
    memberName,
    raisedById,
    raisedByName,
    raisedByRole,
    contact,

    assignedTo: null,
    assignedAt: null,
    startedAt: null,
    completedAt: null,
    resolution: null,
    completedBy: null,

    history: [step(raisedByName ?? memberName, null, 'Received', null)],
  })

  await record('COMPLAINT_RAISED', {
    target: complaint.subject || '(no subject)',
    targetType: 'complaint',
    targetId: complaint.id,
    reason: category,
    after: {
      category,
      priority,
      raisedBy: raisedByName ?? memberName,
      role: raisedByRole,
    },
  })

  return complaint
}

// Moves a complaint to its next stage, stamping that stage's own fields.
export async function advanceComplaint(complaint, to, details = {}, staff) {
  const now = new Date().toISOString()
  const patch = {
    status: to,
    history: [...(complaint.history ?? []), step(staff, complaint.status, to, details.note)],
  }

  if (to === 'In Process') {
    patch.startedAt = now
    patch.assignedTo = details.assignedTo ?? staff ?? null
    patch.assignedAt = now
    if (details.priority) patch.priority = details.priority
  }

  if (to === 'Completed') {
    patch.completedAt = now
    patch.completedBy = staff ?? null

    if (details.resolution !== undefined) patch.resolution = details.resolution
  }

  const updated = await storage.update(COMPLAINTS, complaint.id, patch)

  await record('COMPLAINT_UPDATED', {
    target: complaint.subject || '(no subject)',
    targetType: 'complaint',
    targetId: complaint.id,
    reason: details.note ?? null,
    before: { status: complaint.status },
    after: {
      status: to,
      ...(patch.assignedTo ? { assignedTo: patch.assignedTo } : {}),
      ...(patch.resolution ? { resolution: patch.resolution } : {}),
      by: staff ?? null,
    },
  })

  return updated
}

// Hands a complaint to somebody without moving it along.
export async function assignComplaint(complaint, person, staff) {
  const updated = await storage.update(COMPLAINTS, complaint.id, {
    assignedTo: person?.name ?? null,
    assignedAt: new Date().toISOString(),
    history: [
      ...(complaint.history ?? []),
      step(staff, complaint.status, complaint.status, `Assigned to ${person?.name ?? 'nobody'}`),
    ],
  })

  await record('COMPLAINT_ASSIGNED', {
    target: complaint.subject || '(no subject)',
    targetType: 'complaint',
    targetId: complaint.id,
    before: { assignedTo: complaint.assignedTo ?? null },
    after: { assignedTo: person?.name ?? null },
  })

  return updated
}

// Deletes a complaint. The administrator's alone, and still logged.
export async function removeComplaint(id) {
  const before = await storage.findOne(COMPLAINTS, (row) => row.id === id)
  await storage.remove(COMPLAINTS, id)

  await record('COMPLAINT_DELETED', {
    target: before?.subject || id,
    targetType: 'complaint',
    targetId: id,
    before: {
      status: before?.status ?? null,
      category: before?.category ?? null,
      raisedBy: before?.raisedByName ?? before?.memberName ?? null,
    },
  })
}
