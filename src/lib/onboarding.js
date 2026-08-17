// The steps a new staff account goes through before it can be used.

import { ROLE_LABELS } from './permissions.js'

// The steps a new staff account goes through.
export const ONBOARDING_STEPS = [
  { key: 'created', label: 'Account created' },
  { key: 'invited', label: 'Invitation issued' },
  { key: 'sent', label: 'Welcome email sent' },
  { key: 'activated', label: 'Account activated' },
]

// Where an account has got to.
export const ACCOUNT_STATUSES = ['Pending', 'Active', 'Suspended']

// Colours for each account status.
export const STATUS_BADGE = {
  Active:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
  Pending:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300',
  Suspended:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300',
}

// How long an activation link stays valid.
export const INVITE_DAYS = 7

// Which step an account has reached.
export function onboardingOf(user, invitation, deliveries = []) {
  const activated = Boolean(user?.hasLogin)
  const invited = Boolean(invitation)
  const sent = deliveries.some((row) => row.status === 'Delivered')
  const expired =
    invited && !activated && invitation.expiresAt && new Date(invitation.expiresAt) < new Date()

  const status = user?.suspendedAt
    ? 'Suspended'
    : activated
      ? 'Active'
      : 'Pending'

  return {
    status,
    activated,
    invited,
    sent,
    expired,

    applicable: SIGN_IN_CAPABLE.has(user?.role),
    steps: ONBOARDING_STEPS.map((step) => ({
      ...step,
      done:
        step.key === 'created'
          ? true
          : step.key === 'invited'
            ? invited
            : step.key === 'sent'
              ? sent
              : activated,
    })),
    summary: user?.suspendedAt
      ? 'Suspended'
      : activated
        ? 'Complete'
        : expired
          ? 'Invitation expired'
          : sent
            ? 'Email sent'
            : invited
              ? 'Invitation ready'
              : 'Not invited',
  }
}

// Roles that can actually sign in.
export const SIGN_IN_CAPABLE = new Set(['owner', 'librarian'])

// The emails onboarding sends.
export const EMAIL_EVENTS = {
  ACCOUNT_CREATED: {
    label: 'Account created',
    subject: (ctx) => `Welcome to ${ctx.library} — activate your account`,
    body: (ctx) =>
      [
        `Welcome to ${ctx.library}, ${ctx.firstName}.`,
        ``,
        `Your ${ROLE_LABELS[ctx.role]} account has been created.`,
        ``,
        `Staff ID: ${ctx.staffNumber}`,
        `Role: ${ROLE_LABELS[ctx.role]}`,
        `Email: ${ctx.email}`,
        ``,
        `To activate your account and choose your own password, open the link below.`,
        `It can be used once and expires in ${INVITE_DAYS} days.`,
        ``,
        ctx.link,
        ``,
        `Once activated you can sign in and reach the tools your role allows —`,
        `circulation, member assistance, reservations, repairs and notifications.`,
        ``,
        `We have not set a password for you and nobody here can see the one you choose.`,
        ``,
        `Welcome to the team.`,
        ctx.signature,
      ].join('\n'),
  },

  ACCOUNT_ACTIVATED: {
    label: 'Account activated',
    subject: (ctx) => `Your ${ctx.library} account is active`,
    body: (ctx) =>
      [
        `${ctx.firstName}, your account is now active.`,
        ``,
        `Staff ID: ${ctx.staffNumber}`,
        `Role: ${ROLE_LABELS[ctx.role]}`,
        ``,
        `If you did not do this, tell the library administrator immediately.`,
        ``,
        ctx.signature,
      ].join('\n'),
  },

  ROLE_CHANGED: {
    label: 'Role changed',
    subject: (ctx) => `Your role at ${ctx.library} has changed`,
    body: (ctx) =>
      [
        `${ctx.firstName}, your role has been updated.`,
        ``,
        `From: ${ROLE_LABELS[ctx.from] ?? ctx.from}`,
        `To: ${ROLE_LABELS[ctx.to] ?? ctx.to}`,
        ``,
        `Your permissions have changed to match, and take effect the next time you sign in.`,
        ``,
        ctx.signature,
      ].join('\n'),
  },

  PASSWORD_RESET: {
    label: 'Password reset',
    subject: (ctx) => `Reset your ${ctx.library} password`,
    body: (ctx) =>
      [
        `${ctx.firstName}, a password reset was requested for your account.`,
        ``,
        `Open the link below to choose a new one. It can be used once and expires`,
        `in ${INVITE_DAYS} days.`,
        ``,
        ctx.link,
        ``,
        `If you did not request this, you can ignore this message — your current`,
        `password still works.`,
        ``,
        ctx.signature,
      ].join('\n'),
  },

  ACCOUNT_SUSPENDED: {
    label: 'Account suspended',
    subject: (ctx) => `Your ${ctx.library} account has been suspended`,
    body: (ctx) =>
      [
        `${ctx.firstName}, your account has been temporarily suspended and you`,
        `cannot sign in at the moment.`,
        ``,
        `Speak to the library administrator if you think this is a mistake.`,
        ``,
        ctx.signature,
      ].join('\n'),
  },

  ACCOUNT_RESTORED: {
    label: 'Account restored',
    subject: (ctx) => `Your ${ctx.library} account has been restored`,
    body: (ctx) =>
      [`${ctx.firstName}, your account is active again and you can sign in as before.`, ``, ctx.signature].join(
        '\n',
      ),
  },
}

// Staff records with their onboarding progress attached.
export function compose(event, { user, settings, link = null, from = null, to = null }) {
  const template = EMAIL_EVENTS[event]
  if (!template) return null

  const context = {
    library: settings?.library?.name ?? 'Athenaeum',
    signature: settings?.notifications?.signature ?? settings?.library?.name ?? 'Athenaeum',
    firstName: (user.name ?? '').split(' ')[0] || user.name,
    name: user.name,
    email: user.email,
    role: user.role,
    staffNumber: user.membershipNumber ?? '—',
    link,
    from,
    to,
  }

  return {
    event,
    label: template.label,
    to: user.email,
    subject: template.subject(context),
    body: template.body(context),
  }
}

// What goes on a printed library card.
export const cardPayload = (user) =>
  `ATHENAEUM:STAFF:${user.membershipNumber ?? user.id}`

// Arranges cards for printing a sheet at a time.
export function cardGrid(payload, size = 11) {
  let hash = 2166136261
  for (const character of payload) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619) >>> 0
  }

  const cells = []
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      hash ^= hash << 13
      hash ^= hash >>> 17
      hash ^= hash << 5
      hash >>>= 0
      cells.push({ x, y, on: (hash & 7) > 3 })
    }
  }
  return cells
}
