// Member logins, kept apart from the member record itself.

import { storage } from './storage.js'
import { AuthError, PBKDF2_ITERATIONS, derive, newSalt, sameHash } from './auth.js'
import { record as recordActivity } from './activity.js'
import { writeSession } from './session.js'

const LOGINS = 'memberLogins'

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase()

// Members who have been given a way in.
export async function listLogins() {
  return storage.list(LOGINS)
}

// Whether this member has a login.
export async function accessFor(memberId) {
  return storage.findOne(LOGINS, (row) => row.memberId === memberId)
}

// Gives a member a password, or resets it.
export async function issueAccess(member, password, { actor } = {}) {
  const email = normalizeEmail(member.email)
  if (!email) throw new AuthError('This member has no email address to sign in with.', 'email')

  const clash = await storage.findOne(
    LOGINS,
    (row) => row.email === email && row.memberId !== member.id,
  )
  if (clash) throw new AuthError('Another member already uses this email.', 'email')

  const salt = newSalt()
  const passwordHash = await derive(password, salt, PBKDF2_ITERATIONS)

  const existing = await accessFor(member.id)
  const shape = {
    memberId: member.id,
    email,
    membershipNumber: member.membershipNumber,
    name: member.name,
    passwordHash,
    salt,
    iterations: PBKDF2_ITERATIONS,

    mustChange: true,
    issuedAt: new Date().toISOString(),
    issuedBy: actor?.name ?? null,
    lastLogin: existing?.lastLogin ?? null,
  }

  const saved = existing
    ? await storage.update(LOGINS, existing.id, shape)
    : await storage.insert(LOGINS, shape)

  await recordActivity(existing ? 'MEMBER_ACCESS_RESET' : 'MEMBER_ACCESS_ISSUED', {
    target: member.name,
    targetType: 'member',
    targetId: member.membershipNumber,
    after: { email, issuedBy: actor?.name ?? null },
  })

  return saved
}

// Takes a member's login away.
export async function revokeAccess(member, { actor } = {}) {
  const existing = await accessFor(member.id)
  if (!existing) return null
  await storage.remove(LOGINS, existing.id)

  await recordActivity('MEMBER_ACCESS_REVOKED', {
    target: member.name,
    targetType: 'member',
    targetId: member.membershipNumber,
    before: { email: existing.email },
    after: { revokedBy: actor?.name ?? null },
  })
  return existing
}

// Checks a member's email and password.
export async function signInMember({ email, password, remember = false }) {
  const cleanEmail = normalizeEmail(email)
  const login = await storage.findOne(LOGINS, (row) => row.email === cleanEmail)

  const salt = login?.salt ?? '00000000000000000000000000000000'
  const iterations = login?.iterations ?? PBKDF2_ITERATIONS
  const candidate = await derive(password, salt, iterations)

  const unknown = !login?.passwordHash
  const wrongPassword = !unknown && !sameHash(candidate, login.passwordHash)

  if (unknown || wrongPassword) {
    await recordActivity('LOGIN_FAILED', {
      status: 'Failed',
      target: cleanEmail,
      targetType: 'account',
      reason: wrongPassword ? 'Wrong password' : 'No member account with that email',
      as: login
        ? { staffId: login.memberId, staffName: login.name, email: cleanEmail, role: 'member' }
        : null,
    })

    throw wrongPassword
      ? new AuthError('That password is not correct.', 'password')
      : new AuthError('Wrong ID and password.')
  }

  await storage.update(LOGINS, login.id, { lastLogin: new Date().toISOString() })

  const user = {
    id: login.memberId,
    memberId: login.memberId,
    name: login.name,
    email: cleanEmail,
    membershipNumber: login.membershipNumber,
    role: 'member',
    mustChange: Boolean(login.mustChange),
  }

  const hours = remember ? 24 * 30 : 8

  writeSession({
    userId: user.id,
    role: 'member',
    expiresAt: new Date(Date.now() + hours * 3600_000).toISOString(),
  })

  await recordActivity('LOGIN', {
    target: user.name,
    targetType: 'account',
    as: { staffId: user.id, staffName: user.name, email: cleanEmail, role: 'member' },
  })

  return user
}

// A member changing their own password, current one required.
export async function changeOwnPassword(memberId, { current, next }) {
  const login = await accessFor(memberId)
  if (!login) throw new AuthError('This account has no password set.')

  const candidate = await derive(current, login.salt, login.iterations)
  if (!sameHash(candidate, login.passwordHash)) {
    throw new AuthError('That is not your current password.', 'current')
  }

  const salt = newSalt()
  const passwordHash = await derive(next, salt, PBKDF2_ITERATIONS)
  await storage.update(LOGINS, login.id, {
    passwordHash,
    salt,
    iterations: PBKDF2_ITERATIONS,
    mustChange: false,
  })

  await recordActivity('PASSWORD_CHANGED', {
    target: login.name,
    targetType: 'account',
    targetId: login.membershipNumber,
    as: { staffId: memberId, staffName: login.name, email: login.email, role: 'member' },
  })
}

// Re-reads a member's account, so revoked access stops working at once.
export async function refreshMember(sessionUser) {
  const login = await accessFor(sessionUser.id)
  if (!login) return null
  return {
    ...sessionUser,
    name: login.name,
    email: login.email,
    membershipNumber: login.membershipNumber,
    mustChange: Boolean(login.mustChange),
    role: 'member',
  }
}
