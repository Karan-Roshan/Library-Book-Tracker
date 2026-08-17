// Adding and editing members.

import { storage } from './storage.js'
import { record } from './activity.js'

const ADDED = 'addedMembers'
const OVERRIDES = 'memberOverrides'

// Members registered at the desk.
export async function listAddedMembers() {
  return storage.list(ADDED)
}

// Registers a new member.
export async function addMember(details) {
  const member = await storage.insert(ADDED, details)
  await record('MEMBER_ADDED', {
    target: member.name,
    targetType: 'member',
    targetId: member.membershipNumber ?? member.id,
    after: { email: member.email, expires: member.expiresAt?.slice(0, 10) },
  })
  return member
}

// Removes a desk-registered member.
export async function removeAddedMember(id) {
  await storage.remove(ADDED, id)
}

// Edits made to the seeded members.
export async function listOverrides() {
  return (await storage.getValue(OVERRIDES)) ?? {}
}

// Edits any member, seeded or added.
export async function patchMember(id, patch, context = {}) {
  const overrides = await listOverrides()
  const before = overrides[id] ?? {}
  overrides[id] = { ...before, ...patch }
  await storage.setValue(OVERRIDES, overrides)

  await record(patch.renewedAt ? 'MEMBER_RENEWED' : 'MEMBER_UPDATED', {
    target: context.name ?? id,
    targetType: 'member',
    targetId: context.memberId ?? id,
    reason: context.reason ?? null,
    before: Object.fromEntries(Object.keys(patch).map((key) => [key, before[key] ?? null])),
    after: patch,
  })
  return overrides
}

// Removes a member from the register.
export async function deleteMember(id, isAdded, context = {}) {
  await record('MEMBER_DELETED', {
    target: context.name ?? id,
    targetType: 'member',
    targetId: context.memberId ?? id,
    reason: context.reason ?? null,
  })

  if (isAdded) {
    await removeAddedMember(id)
    return listOverrides()
  }

  const overrides = await listOverrides()
  overrides[id] = { ...(overrides[id] ?? {}), deleted: true }
  await storage.setValue(OVERRIDES, overrides)
  return overrides
}
