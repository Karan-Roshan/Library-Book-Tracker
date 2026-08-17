// Writes the audit trail. Append-only: entries are never edited or removed.

import { storage } from './storage.js'
import { ACTIONS, describeDevice } from '../lib/activity.js'

const COLLECTION = 'activity'

let actor = null

// Tells the logger who is signed in, so every entry is written against them.
export function setActor(user) {
  actor = user
    ? {
        staffId: user.id,
        staffName: user.name,
        staffNumber: user.membershipNumber ?? null,
        email: user.email ?? null,
        role: user.role,
      }
    : null
}

// The whole audit trail.
export async function listActivity() {
  const rows = await storage.list(COLLECTION)
  return rows.sort((a, b) => new Date(b.at) - new Date(a.at))
}

// Writes one entry. Append-only: nothing here is ever edited or removed.
export async function record(
  key,
  { target = null, targetType = null, targetId = null, before = null, after = null, reason = null, status = 'Success', as = null } = {},
) {
  const definition = ACTIONS[key]
  if (!definition) return null

  const who = as ?? actor
  try {
    return await storage.insert(COLLECTION, {
      at: new Date().toISOString(),
      action: definition.label,
      module: definition.module,
      status,

      staffId: who?.staffId ?? null,
      staffName: who?.staffName ?? 'Unknown',
      staffNumber: who?.staffNumber ?? null,
      email: who?.email ?? null,
      role: who?.role ?? null,
      target,
      targetType,
      targetId,
      before,
      after,
      reason,
      device: describeDevice(),
    })
  } catch {
    return null
  }
}

// Reduces a user to the fields an entry stores about them.
export const asPerson = (user) =>
  user
    ? {
        staffId: user.id,
        staffName: user.name,
        staffNumber: user.membershipNumber ?? null,
        email: user.email ?? null,
        role: user.role,
      }
    : null
