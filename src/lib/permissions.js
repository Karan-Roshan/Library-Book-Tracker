// Who may see and do what, as one table the whole app reads.

export const ROLE_LABELS = {
  owner: 'Library Administrator',
  librarian: 'Library Assistant',
  shelving: 'Shelving Assistant',
  housekeeping: 'Housekeeping',
  security: 'Security',
  member: 'Member',
}

// Staff roles, in the order the personnel page lists them.
export const PERSONNEL_ROLES = ['owner', 'librarian', 'shelving', 'housekeeping', 'security']

// A colour per role, so a long register can be read by scanning.
export const ROLE_BADGE = {
  owner:
    'border-brass-300 bg-brass-50 text-brass-800 dark:border-brass-500/40 dark:bg-brass-500/10 dark:text-brass-300',
  librarian:
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300',
  shelving:
    'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300',
  housekeeping:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
  security:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300',

  member:
    'border-ink-200 bg-white text-ink-500 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400',
}

// The colour for a role, with a neutral fallback for anything unknown.
export const badgeForRole = (role) =>
  ROLE_BADGE[role] ??
  'border-ink-200 bg-ink-50 text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200'

// What each role may do, in one sentence.
export const ROLE_DESCRIPTIONS = {
  owner: 'Full access to manage the system, staff, books, members, and fines.',
  librarian: 'Runs the desk day to day, and sees the reports and settings.',
  member: 'Borrow, reserve, and track your own books.',
}

// The identities the login screen offers.
export const SIGN_IN_ROLES = ['owner', 'librarian', 'member']

// Every permission in the system, named once here.
export const CAPABILITIES = {
  CIRCULATION: 'circulation.operate',
  CATALOG: 'catalog.manage',
  MEMBERS: 'members.manage',

  FINANCE: 'dashboard.finance',
  MEMBERSHIP_STATS: 'dashboard.membership',
  ACQUISITIONS: 'dashboard.acquisitions',
  TRENDS: 'dashboard.trends',
  SYSTEM: 'dashboard.system',
  FINES: 'fines.manage',
  ACCOUNTS: 'accounts.manage',

  EXPORT: 'data.export',

  ACTIVITY: 'activity.view',

  RULES: 'circulation.rules',

  REPORTS: 'reports.view',

  REPORTS_STAFF: 'reports.staff',

  SETTINGS: 'settings.manage',

  MEMBERS_REMOVE: 'members.remove',

  COMPLAINTS: 'complaints.manage',
  COMPLAINTS_REMOVE: 'complaints.remove',

  COMPLAINTS_RAISE: 'complaints.raise',

  CHANGE_EMAIL: 'account.email.change',

  MY_LIBRARY: 'member.library',
  MY_REQUESTS: 'member.requests',
  MY_FINES: 'member.fines',
  BROWSE: 'member.browse',

  MY_COMPLAINTS: 'member.complaints',
}

const DESK = [
  CAPABILITIES.CIRCULATION,
  CAPABILITIES.CATALOG,
  CAPABILITIES.MEMBERS,
  CAPABILITIES.FINES,

  CAPABILITIES.COMPLAINTS,
]

const GRANTS = {
  owner: new Set([
    ...DESK,
    CAPABILITIES.FINANCE,
    CAPABILITIES.MEMBERSHIP_STATS,
    CAPABILITIES.ACQUISITIONS,
    CAPABILITIES.TRENDS,
    CAPABILITIES.SYSTEM,
    CAPABILITIES.ACCOUNTS,
    CAPABILITIES.MEMBERS_REMOVE,
    CAPABILITIES.EXPORT,
    CAPABILITIES.ACTIVITY,
    CAPABILITIES.RULES,
    CAPABILITIES.REPORTS,
    CAPABILITIES.REPORTS_STAFF,
    CAPABILITIES.SETTINGS,
    CAPABILITIES.CHANGE_EMAIL,
    CAPABILITIES.COMPLAINTS_REMOVE,
  ]),

  librarian: new Set([
    ...DESK,
    CAPABILITIES.REPORTS,
    CAPABILITIES.SETTINGS,
    CAPABILITIES.COMPLAINTS_RAISE,
  ]),

  shelving: new Set(),
  housekeeping: new Set(),
  security: new Set(),

  member: new Set([
    CAPABILITIES.MY_LIBRARY,
    CAPABILITIES.MY_REQUESTS,
    CAPABILITIES.MY_FINES,
    CAPABILITIES.BROWSE,
    CAPABILITIES.MY_COMPLAINTS,
  ]),
}

let overrides = {}

// Replaces a role's permissions with what Settings says.
export function setPermissionOverrides(table = {}) {
  overrides = Object.fromEntries(
    Object.entries(table)
      .filter(([, list]) => Array.isArray(list))
      .map(([role, list]) => [role, new Set(list)]),
  )
}

// Everything a role may do.
export const grantsFor = (role) => overrides[role] ?? GRANTS[role] ?? new Set()

// Whether this person holds this permission. The one check every guard uses.
export function can(user, capability) {
  return grantsFor(user?.role).has(capability) ?? false
}

// The permissions Settings offers, grouped for the screen.
export const CAPABILITY_LIST = [
  { key: CAPABILITIES.CIRCULATION, label: 'Operate the circulation desk', group: 'Desk' },
  { key: CAPABILITIES.CATALOG, label: 'Manage the catalogue', group: 'Desk' },
  { key: CAPABILITIES.MEMBERS, label: 'Register and edit members', group: 'Desk' },
  { key: CAPABILITIES.FINES, label: 'Raise and collect fines', group: 'Desk' },
  { key: CAPABILITIES.MEMBERS_REMOVE, label: 'Remove or suspend a member', group: 'Oversight' },
  { key: CAPABILITIES.EXPORT, label: 'Export data', group: 'Oversight' },
  { key: CAPABILITIES.REPORTS, label: 'View reports and analytics', group: 'Oversight' },
  { key: CAPABILITIES.ACTIVITY, label: 'View the activity log', group: 'Oversight' },
  { key: CAPABILITIES.ACCOUNTS, label: 'Manage personnel and accounts', group: 'Administration' },
  { key: CAPABILITIES.RULES, label: 'Change circulation rules', group: 'Administration' },
  { key: CAPABILITIES.SETTINGS, label: 'Change system settings', group: 'Administration' },
  { key: CAPABILITIES.FINANCE, label: 'See institution-wide finances', group: 'Administration' },
  { key: CAPABILITIES.MEMBERSHIP_STATS, label: 'See membership statistics', group: 'Administration' },
  { key: CAPABILITIES.ACQUISITIONS, label: 'See acquisition statistics', group: 'Administration' },
  { key: CAPABILITIES.TRENDS, label: 'See borrowing trends', group: 'Administration' },
  { key: CAPABILITIES.SYSTEM, label: 'See system health', group: 'Administration' },
  { key: CAPABILITIES.CHANGE_EMAIL, label: 'Change their own sign-in address', group: 'Account' },
]

// Whether this is a member rather than staff.
export const isMember = (user) => user?.role === 'member'

// Roles an administrator may assign.
export const EDITABLE_ROLES = ['librarian', 'shelving', 'housekeeping', 'security']

// Filters a list of menu items down to what this person may reach.
export function allowed(user, items) {
  return items.filter((item) => !item.capability || can(user, item.capability))
}
