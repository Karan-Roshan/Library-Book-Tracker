// Invites a new member of staff and activates their account.

import { storage } from './storage.js'
import { record } from './activity.js'
import { AuthError, PBKDF2_ITERATIONS, derive, newSalt } from './auth.js'
import { compose } from '../lib/onboarding.js'
import { INVITE_DAYS } from '../lib/onboarding.js'

const INVITATIONS = 'invitations'
const OUTBOX = 'outbox'
const USERS = 'users'

const API = import.meta.env?.VITE_API_URL ?? '/api'

function newToken() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

// Activation invites that have been issued.
export const listInvitations = () => storage.list(INVITATIONS)
// Emails the system has queued or sent.
export const listOutbox = () => storage.list(OUTBOX)

// The invite belonging to one account.
export const invitationFor = (userId) =>
  storage.findOne(INVITATIONS, (row) => row.userId === userId && !row.usedAt)

// The link a new member of staff follows to set their password.
export const activationLink = (token) =>
  `${globalThis.location?.origin ?? ''}/activate/${token}`

async function send(message, { actor, about } = {}) {
  let status = 'Queued'
  let detail = 'No email provider is configured, so this was not delivered.'

  try {
    const response = await fetch(`${API}/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: message.to, subject: message.subject, body: message.body }),
      signal: AbortSignal.timeout(10_000),
    })
    if (response.ok) {
      status = 'Delivered'
      detail = 'Delivered by the configured provider.'
    } else if (response.status !== 503) {
      status = 'Failed'
      detail = `The provider rejected it (${response.status}).`
    }
  } catch {
  }

  return storage.insert(OUTBOX, {
    ...message,
    aboutUserId: about ?? null,
    status,
    detail,
    at: new Date().toISOString(),
    by: actor?.name ?? null,
  })
}

// Invites somebody to activate their account.
export async function invite(user, { actor, settings, event = 'ACCOUNT_CREATED' } = {}) {
  if (!user.email) throw new AuthError('That account has no email address to write to.', 'email')

  const existing = await storage.list(INVITATIONS)
  for (const row of existing) {
    if (row.userId === user.id && !row.usedAt) await storage.remove(INVITATIONS, row.id)
  }

  const token = newToken()
  const invitation = await storage.insert(INVITATIONS, {
    userId: user.id,
    email: user.email,
    token,
    purpose: event === 'PASSWORD_RESET' ? 'reset' : 'activation',
    issuedAt: new Date().toISOString(),
    issuedBy: actor?.name ?? null,
    expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
    usedAt: null,
  })

  const message = compose(event, { user, settings, link: activationLink(token) })
  const delivery = await send(message, { actor, about: user.id })

  await record(event === 'PASSWORD_RESET' ? 'STAFF_RESET_SENT' : 'STAFF_INVITED', {
    target: user.name,
    targetType: 'account',
    targetId: user.membershipNumber ?? user.id,
    after: {
      email: user.email,
      role: user.role,
      expires: invitation.expiresAt.slice(0, 10),
      delivery: delivery.status,
    },
  })

  return { invitation, message, delivery, link: activationLink(token) }
}

// Whether an activation link is still valid.
export async function checkToken(token) {
  const invitation = await storage.findOne(INVITATIONS, (row) => row.token === token)
  if (!invitation) return { ok: false, reason: 'This activation link is not valid.' }
  if (invitation.usedAt) return { ok: false, reason: 'This link has already been used.' }
  if (new Date(invitation.expiresAt) < new Date()) {
    return { ok: false, reason: 'This link has expired. Ask the administrator for a new one.' }
  }

  const user = await storage.findOne(USERS, (row) => row.id === invitation.userId)
  if (!user) return { ok: false, reason: 'The account this link belongs to no longer exists.' }
  if (user.suspendedAt) return { ok: false, reason: 'This account is suspended.' }

  return {
    ok: true,
    invitation,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, membershipNumber: user.membershipNumber },
  }
}

// Sets the password and opens the account.
export async function activate(token, password, { settings } = {}) {
  const check = await checkToken(token)
  if (!check.ok) throw new AuthError(check.reason)

  const minimum = settings?.security?.minPasswordLength ?? 10
  if ((password ?? '').length < minimum) {
    throw new AuthError(`Choose a password of at least ${minimum} characters.`, 'password')
  }

  const salt = newSalt()
  const passwordHash = await derive(password, salt, PBKDF2_ITERATIONS)

  await storage.update(USERS, check.user.id, {
    passwordHash,
    salt,
    iterations: PBKDF2_ITERATIONS,

    passwordPlain: null,
    activatedAt: new Date().toISOString(),
  })
  await storage.update(INVITATIONS, check.invitation.id, { usedAt: new Date().toISOString() })

  const message = compose('ACCOUNT_ACTIVATED', { user: check.user, settings })
  await send(message, { about: check.user.id })

  await record('STAFF_ACTIVATED', {
    target: check.user.name,
    targetType: 'account',
    targetId: check.user.membershipNumber ?? check.user.id,
    after: { role: check.user.role },
    as: {
      staffId: check.user.id,
      staffName: check.user.name,
      email: check.user.email,
      role: check.user.role,
    },
  })

  return check.user
}

// Suspends an account, which stops it signing in at once.
export async function suspend(user, { actor, settings, reason } = {}) {
  await storage.update(USERS, user.id, {
    suspendedAt: new Date().toISOString(),
    suspendedBy: actor?.name ?? null,
    suspendReason: reason ?? null,
  })

  const message = compose('ACCOUNT_SUSPENDED', { user, settings })
  await send(message, { actor, about: user.id })

  await record('STAFF_SUSPENDED', {
    target: user.name,
    targetType: 'account',
    targetId: user.membershipNumber ?? user.id,
    reason: reason ?? null,
    before: { status: 'Active' },
    after: { status: 'Suspended' },
  })
}

// Lifts a suspension.
export async function restore(user, { actor, settings } = {}) {
  await storage.update(USERS, user.id, {
    suspendedAt: null,
    suspendedBy: null,
    suspendReason: null,
  })

  const message = compose('ACCOUNT_RESTORED', { user, settings })
  await send(message, { actor, about: user.id })

  await record('STAFF_RESTORED', {
    target: user.name,
    targetType: 'account',
    targetId: user.membershipNumber ?? user.id,
    before: { status: 'Suspended' },
    after: { status: 'Active' },
  })
}

// Changes what somebody may do.
export async function changeRole(user, role, { actor, settings } = {}) {
  if (user.role === role) return null
  const from = user.role

  await storage.update(USERS, user.id, { role })

  const message = compose('ROLE_CHANGED', { user: { ...user, role }, settings, from, to: role })
  await send(message, { actor, about: user.id })

  await record('STAFF_ROLE_CHANGED', {
    target: user.name,
    targetType: 'account',
    targetId: user.membershipNumber ?? user.id,
    before: { role: from },
    after: { role },
  })

  return { from, to: role }
}

// Emails sent to one person.
export const outboxFor = async (userId) =>
  (await storage.list(OUTBOX))
    .filter((row) => row.aboutUserId === userId)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
