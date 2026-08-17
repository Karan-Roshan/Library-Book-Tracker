// Signing in, staff accounts, and password hashing.

import { storage, COLLECTIONS, StorageError } from './storage.js'
import { clearSession, readSession, writeSession } from './session.js'
import { normalizeName } from '../lib/validation.js'
import { PERSONNEL_ID_PATTERN, personnelId } from '../lib/ids.js'
import { asPerson, record as recordActivity } from './activity.js'

const PBKDF2_ITERATIONS = 210_000
const SESSION_HOURS = { default: 8, remembered: 24 * 30 }

export class AuthError extends Error {
  constructor(message, field = null) {
    super(message)
    this.name = 'AuthError'
    this.field = field
  }
}

const encoder = new TextEncoder()

function requireCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new AuthError(
      'Secure browser crypto is unavailable. Open the app over https:// or http://localhost.',
    )
  }
  return globalThis.crypto
}

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

async function derive(password, saltHex, iterations) {
  const cryptoApi = requireCrypto()
  const salt = Uint8Array.from(saltHex.match(/.{2}/g).map((byte) => parseInt(byte, 16)))
  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await cryptoApi.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return toHex(bits)
}

export { derive, PBKDF2_ITERATIONS }
// A fresh random salt for one password.
export const newSalt = () => toHex(requireCrypto().getRandomValues(new Uint8Array(16)))
// Compares two hashes without leaking how much matched through timing.
export const sameHash = (a, b) => timingSafeEqual(a, b)

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const normalizeEmail = (email) => email.trim().toLowerCase()
const normalizePhone = (phone) => String(phone ?? '').replace(/\D/g, '')

async function assertContactUnique({ email, phone }, excludeId = null) {
  const rows = await storage.list(COLLECTIONS.users)
  const others = rows.filter((row) => row.id !== excludeId)

  if (email && others.some((row) => row.email === email)) {
    throw new AuthError('Another record already uses this email.', 'email')
  }
  if (phone && others.some((row) => normalizePhone(row.phone) === phone)) {
    throw new AuthError('Another record already uses this phone number.', 'phone')
  }
}

const membershipNumber = personnelId

function toPublicUser(record) {
  const { passwordHash, salt, iterations, ...safe } = record
  return { ...safe, hasLogin: Boolean(passwordHash) }
}

// Whether the library has any accounts yet.
export async function accountsExist() {
  const users = await storage.list(COLLECTIONS.users)
  return users.length > 0
}

// Creates an account with a hashed password.
export async function createAccount({ name, email, password, role = 'member' }, actor) {
  if (actor?.role !== 'owner') {
    throw new AuthError('Only the library owner can issue accounts.')
  }
  return insertUser({ name, email, password, role })
}

const DESK_FIELDS = ['shift']

async function credentials(password) {
  const saltHex = toHex(requireCrypto().getRandomValues(new Uint8Array(16)))
  return {
    passwordHash: await derive(password, saltHex, PBKDF2_ITERATIONS),
    salt: saltHex,
    iterations: PBKDF2_ITERATIONS,
    passwordPlain: password,
  }
}

// Adds a member of staff and issues their staff number.
export async function createPersonnel(
  {
    name,
    email,
    role,
    phone = '',
    avatar = null,
    password = '',
    joinedAt = null,
    ...rest
  },
  actor,
) {
  if (actor?.role !== 'owner') {
    throw new AuthError('Only the library owner can add personnel.')
  }

  const cleanEmail = normalizeEmail(email)
  const cleanPhone = normalizePhone(phone)
  await assertContactUnique({ email: cleanEmail, phone: cleanPhone })

  if (password && !cleanEmail) {
    throw new AuthError('An email address is needed to give someone a login.', 'email')
  }
  const login = password
    ? await credentials(password)
    : { passwordHash: null, salt: null, iterations: null, passwordPlain: null }

  const joined = joinedAt ? new Date(joinedAt) : new Date()

  const users = await storage.list(COLLECTIONS.users)
  const record = await storage.insert(COLLECTIONS.users, {
    createdAt: joined.toISOString(),
    name: normalizeName(name),
    email: cleanEmail,
    role,
    phone: cleanPhone,
    avatar,
    ...Object.fromEntries(
      DESK_FIELDS.filter((field) => field in rest).map((field) => [field, rest[field]]),
    ),
    membershipNumber: membershipNumber(users.length + 1, joined),
    ...login,
  })

  const created = toPublicUser(record)
  await recordActivity('STAFF_ADDED', {
    target: created.name,
    targetType: 'personnel',
    targetId: created.id,
    after: { role: created.role, email: created.email, hasLogin: created.hasLogin },
  })
  return created
}

// Edits a staff record.
export async function updatePersonnel(id, patch, actor) {
  if (actor?.role !== 'owner') {
    throw new AuthError('Only the library owner can edit personnel.')
  }

  const record = await storage.findOne(COLLECTIONS.users, (user) => user.id === id)
  if (!record) throw new AuthError('That personnel record no longer exists.')

  const changes = {}
  if ('name' in patch) changes.name = normalizeName(patch.name)
  if ('role' in patch) changes.role = patch.role
  if ('phone' in patch) changes.phone = normalizePhone(patch.phone)
  if ('avatar' in patch) changes.avatar = patch.avatar
  for (const field of DESK_FIELDS) if (field in patch) changes[field] = patch[field]

  if (patch.joinedAt) {
    const joined = new Date(patch.joinedAt)
    if (!Number.isNaN(joined.getTime())) {
      changes.createdAt = joined.toISOString()
      const sequence = Number(String(record.membershipNumber ?? '').slice(-3))
      if (Number.isInteger(sequence) && sequence > 0) {
        changes.membershipNumber = membershipNumber(sequence, joined)
      }
    }
  }

  if (patch.password) {
    const email = 'email' in changes ? changes.email : record.email
    if (!email) throw new AuthError('An email address is needed to set a password.', 'email')
    Object.assign(changes, await credentials(patch.password))
  }
  if ('email' in patch) changes.email = normalizeEmail(patch.email)
  await assertContactUnique({ email: changes.email, phone: changes.phone }, id)

  if (changes.role && record.role === 'owner' && changes.role !== 'owner') {
    await assertNotLastOwner(id)
  }

  const updated = await storage.update(COLLECTIONS.users, id, changes)
  await recordActivity('STAFF_UPDATED', {
    target: updated.name,
    targetType: 'personnel',
    targetId: id,

    before: Object.fromEntries(Object.keys(changes).map((key) => [key, record[key] ?? null])),
    after: changes,
  })
  return toPublicUser(updated)
}

// Removes a staff account.
export async function deletePersonnel(id, actor) {
  if (actor?.role !== 'owner') {
    throw new AuthError('Only the library owner can remove personnel.')
  }
  if (actor.id === id) {
    throw new AuthError('You cannot delete the account you are signed in with.')
  }

  const record = await storage.findOne(COLLECTIONS.users, (user) => user.id === id)
  if (!record) throw new AuthError('That personnel record no longer exists.')
  if (record.role === 'owner') await assertNotLastOwner(id)

  await storage.remove(COLLECTIONS.users, id)
  await recordActivity('STAFF_DELETED', {
    target: record.name,
    targetType: 'personnel',
    targetId: id,
    before: { role: record.role, email: record.email },
  })
  return record.name
}

async function assertNotLastOwner(id) {
  const users = await storage.list(COLLECTIONS.users)
  const otherOwners = users.filter((user) => user.role === 'owner' && user.id !== id)
  if (otherOwners.length === 0) {
    throw new AuthError('This is the only administrator — the library must keep one.')
  }
}

// Creates the first administrator, once, when there is nobody.
export async function claimLibrary({ name, email, password }) {
  if (await accountsExist()) {
    throw new AuthError(
      'This library has already been set up. Ask the owner to issue you an account.',
    )
  }
  const owner = await insertUser({ name, email, password, role: 'owner' })
  await startSession(owner, false)
  return owner
}

async function insertUser({ name, email, password, role, phone = '' }) {
  const cleanEmail = normalizeEmail(email)
  const cleanPhone = normalizePhone(phone)
  await assertContactUnique({ email: cleanEmail, phone: cleanPhone })

  const saltHex = toHex(requireCrypto().getRandomValues(new Uint8Array(16)))
  const passwordHash = await derive(password, saltHex, PBKDF2_ITERATIONS)
  const users = await storage.list(COLLECTIONS.users)

  try {
    const record = await storage.insert(COLLECTIONS.users, {
      name: normalizeName(name),
      email: cleanEmail,
      role,
      phone: cleanPhone,
      membershipNumber: membershipNumber(users.length + 1),
      passwordHash,
      salt: saltHex,
      iterations: PBKDF2_ITERATIONS,
      passwordPlain: password,
    })
    return toPublicUser(record)
  } catch (error) {
    if (error instanceof StorageError) throw new AuthError(error.message)
    throw error
  }
}

// Checks an email and password, and starts a session.
export async function signIn({ email, password, remember = false, expectedRole = null }) {
  const cleanEmail = normalizeEmail(email)
  const record = await storage.findOne(
    COLLECTIONS.users,
    (user) => user.email === cleanEmail,
  )

  const salt = record?.salt ?? '00000000000000000000000000000000'
  const iterations = record?.iterations ?? PBKDF2_ITERATIONS
  const candidate = await derive(password, salt, iterations)

  const unknown = !record?.passwordHash
  const wrongPassword = !unknown && !timingSafeEqual(candidate, record.passwordHash)

  if (unknown || wrongPassword) {
    await recordActivity('LOGIN_FAILED', {
      status: 'Failed',
      target: cleanEmail,
      targetType: 'account',
      reason: wrongPassword ? 'Wrong password' : 'No account with that email',
      as: asPerson(record ? toPublicUser(record) : null),
    })

    throw wrongPassword
      ? new AuthError('That password is not correct.', 'password')
      : new AuthError('Wrong ID and password.')
  }

  if (expectedRole && record.role !== expectedRole) {
    await recordActivity('LOGIN_FAILED', {
      status: 'Failed',
      target: cleanEmail,
      targetType: 'account',
      reason: 'Signed in as the wrong role',
      as: asPerson(toPublicUser(record)),
    })

    throw new AuthError('Wrong ID and password.')
  }

  if (record.suspendedAt) {
    await recordActivity('LOGIN_FAILED', {
      status: 'Failed',
      target: cleanEmail,
      targetType: 'account',
      reason: 'Account suspended',
      as: asPerson(toPublicUser(record)),
    })
    throw new AuthError('This account is suspended. Speak to the library administrator.')
  }

  const user = toPublicUser(record)
  await storage.update(COLLECTIONS.users, record.id, {
    lastLoginAt: new Date().toISOString(),
  })
  await startSession(user, remember)
  await recordActivity('LOGIN', { target: user.name, targetType: 'account', targetId: user.id, as: asPerson(user) })
  return user
}

async function startSession(user, remember) {
  const hours = remember ? SESSION_HOURS.remembered : SESSION_HOURS.default

  writeSession({
    userId: user.id,
    role: user.role,
    expiresAt: new Date(Date.now() + hours * 3600_000).toISOString(),
  })
}

const ID_PATTERN = PERSONNEL_ID_PATTERN

// Renumbers old staff records into the current format.
export async function migratePersonnelIds() {
  const users = await storage.list(COLLECTIONS.users)
  if (users.every((user) => ID_PATTERN.test(user.membershipNumber ?? ''))) return 0

  const ordered = [...users].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  let changed = 0

  for (const [index, user] of ordered.entries()) {
    const issued = membershipNumber(index + 1, new Date(user.createdAt))
    if (user.membershipNumber === issued) continue
    await storage.update(COLLECTIONS.users, user.id, { membershipNumber: issued })
    changed += 1
  }

  return changed
}

// Every account, safe fields only.
export async function listAccounts() {
  const users = await storage.list(COLLECTIONS.users)
  return users
    .map(toPublicUser)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

const EDITABLE_FIELDS = ['name', 'email', 'phone', 'address', 'accountNumber', 'avatar']

// Saves somebody's own edits to their profile.
export async function updateProfile(userId, patch) {
  const record = await storage.findOne(COLLECTIONS.users, (user) => user.id === userId)
  if (!record) throw new AuthError('This account no longer exists. Sign in again.')

  const changes = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in patch) changes[field] = patch[field]
  }

  if ('email' in changes) changes.email = normalizeEmail(changes.email)
  if ('phone' in changes) changes.phone = normalizePhone(changes.phone)
  if ('name' in changes) changes.name = normalizeName(changes.name)

  await assertContactUnique({ email: changes.email, phone: changes.phone }, userId)

  try {
    const updated = await storage.update(COLLECTIONS.users, userId, changes)
    const user = toPublicUser(updated)
    await recordActivity('PROFILE_UPDATED', {
      target: user.name,
      targetType: 'personnel',
      targetId: userId,
      before: Object.fromEntries(Object.keys(changes).map((key) => [key, record[key] ?? null])),
      after: changes,
    })
    return user
  } catch (error) {
    if (error instanceof StorageError) throw new AuthError(error.message)
    throw error
  }
}

// The signed-in account, read fresh from the database on every load.
export async function currentUser() {
  const session = readSession()
  if (!session) return null

  if (session.role === 'member') {
    const { refreshMember } = await import('./memberAccess.js')
    const refreshed = await refreshMember({ id: session.userId, memberId: session.userId })
    if (!refreshed) {
      clearSession()
      return null
    }
    return refreshed
  }

  const live = await storage.findOne(COLLECTIONS.users, (row) => row.id === session.userId)

  if (!live || live.suspendedAt) {
    clearSession()
    return null
  }

  return toPublicUser(live)
}

// Ends the session on this browser.
export async function signOut() {
  await recordActivity('LOGOUT', { targetType: 'account' })
  clearSession()
}
