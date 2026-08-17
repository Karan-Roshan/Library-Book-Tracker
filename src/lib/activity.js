// The audit trail's vocabulary: what each recorded action is called.

export const MODULES = [
  'Assistant',
  'Security',
  'Books',
  'Circulation',
  'Members',
  'Finance',
  'Repairs',
  'Complaints',
  'Staff',
  'Messages',
]

// Whether the recorded action worked.
export const STATUSES = ['Success', 'Failed']

// Every action the system records, with the module it belongs to.
export const ACTIONS = {
  LOGIN: { label: 'Login', module: 'Security' },
  LOGIN_FAILED: { label: 'Login Failed', module: 'Security' },
  LOGOUT: { label: 'Logout', module: 'Security' },
  PASSWORD_CHANGED: { label: 'Password Changed', module: 'Security' },

  BOOK_ADDED: { label: 'Book Added', module: 'Books' },
  BOOK_IMPORTED: { label: 'Books Imported', module: 'Books' },

  BOOK_ISSUED: { label: 'Book Issued', module: 'Circulation' },
  BOOK_RETURNED: { label: 'Book Returned', module: 'Circulation' },
  BOOK_RENEWED: { label: 'Borrowing Renewed', module: 'Circulation' },
  REMINDER_SENT: { label: 'Overdue Reminder Sent', module: 'Circulation' },
  RESERVATION_PLACED: { label: 'Reservation Placed', module: 'Circulation' },
  RESERVATION_READY: { label: 'Reservation Ready', module: 'Circulation' },
  RESERVATION_COLLECTED: { label: 'Reservation Collected', module: 'Circulation' },
  RESERVATION_CANCELLED: { label: 'Reservation Cancelled', module: 'Circulation' },
  BOOK_LOST: { label: 'Book Reported Lost', module: 'Circulation' },
  BOOK_RECOVERED: { label: 'Lost Book Recovered', module: 'Circulation' },
  LOST_UPDATED: { label: 'Lost Report Updated', module: 'Circulation' },
  RULES_UPDATED: { label: 'Circulation Rules Updated', module: 'Circulation' },

  MEMBER_ADDED: { label: 'Member Added', module: 'Members' },
  MEMBER_UPDATED: { label: 'Member Updated', module: 'Members' },
  MEMBER_DELETED: { label: 'Member Deleted', module: 'Members' },
  MEMBER_RENEWED: { label: 'Membership Renewed', module: 'Members' },
  MEMBER_ACCESS_ISSUED: { label: 'Member Access Issued', module: 'Members' },
  MEMBER_ACCESS_RESET: { label: 'Member Password Reset', module: 'Members' },
  MEMBER_ACCESS_REVOKED: { label: 'Member Access Revoked', module: 'Members' },

  FINE_CREATED: { label: 'Fine Created', module: 'Finance' },
  FINE_UPDATED: { label: 'Fine Updated', module: 'Finance' },
  FINE_DELETED: { label: 'Fine Deleted', module: 'Finance' },
  FINE_COLLECTED: { label: 'Fine Collected', module: 'Finance' },

  REPAIR_CREATED: { label: 'Damage Reported', module: 'Repairs' },
  REPAIR_UPDATED: { label: 'Repair Status Changed', module: 'Repairs' },
  REPAIR_ASSIGNED: { label: 'Repair Assigned', module: 'Repairs' },
  REPAIR_COSTED: { label: 'Repair Cost Revised', module: 'Repairs' },
  REPAIR_CHARGED: { label: 'Damage Charged To Member', module: 'Repairs' },
  REPAIR_DELETED: { label: 'Repair Deleted', module: 'Repairs' },

  STAFF_ADDED: { label: 'Staff Added', module: 'Staff' },
  STAFF_INVITED: { label: 'Staff Invitation Issued', module: 'Staff' },
  STAFF_ACTIVATED: { label: 'Staff Account Activated', module: 'Staff' },
  STAFF_RESET_SENT: { label: 'Staff Password Reset Sent', module: 'Staff' },
  STAFF_ROLE_CHANGED: { label: 'Staff Role Changed', module: 'Staff' },
  STAFF_SUSPENDED: { label: 'Staff Account Suspended', module: 'Staff' },
  STAFF_RESTORED: { label: 'Staff Account Restored', module: 'Staff' },
  STAFF_UPDATED: { label: 'Staff Updated', module: 'Staff' },
  STAFF_DELETED: { label: 'Staff Deleted', module: 'Staff' },
  PROFILE_UPDATED: { label: 'Profile Updated', module: 'Staff' },

  MESSAGE_SENT: { label: 'Notification Sent', module: 'Messages' },
  MESSAGE_DELETED: { label: 'Notification Deleted', module: 'Messages' },

  COMPLAINT_RAISED: { label: 'Complaint Raised', module: 'Complaints' },
  COMPLAINT_UPDATED: { label: 'Complaint Updated', module: 'Complaints' },
  COMPLAINT_ASSIGNED: { label: 'Complaint Assigned', module: 'Complaints' },
  COMPLAINT_DELETED: { label: 'Complaint Deleted', module: 'Complaints' },

  AGENT_ACTION: { label: 'Assistant Action', module: 'Assistant' },
  AGENT_REFUSED: { label: 'Assistant Refused', module: 'Assistant' },
}

// Every action's name, for the filter menu.
export const ACTION_LABELS = [...new Set(Object.values(ACTIONS).map((a) => a.label))].sort()

// Reads a browser's user-agent into browser, system and device.
export function describeDevice(userAgent = globalThis.navigator?.userAgent ?? '') {
  const browser =
    /Edg\//.test(userAgent) ? 'Edge'
    : /OPR\//.test(userAgent) ? 'Opera'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Safari\//.test(userAgent) ? 'Safari'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : 'Unknown'

  const os =
    /Windows/.test(userAgent) ? 'Windows'
    : /Mac OS X/.test(userAgent) ? 'macOS'
    : /Android/.test(userAgent) ? 'Android'
    : /(iPhone|iPad|iPod)/.test(userAgent) ? 'iOS'
    : /Linux/.test(userAgent) ? 'Linux'
    : 'Unknown'

  const device =
    /(iPad|Tablet)/.test(userAgent) ? 'Tablet'
    : /(Mobi|iPhone|Android)/.test(userAgent) ? 'Mobile'
    : 'Desktop'

  return { browser, os, device }
}

// That description, written on one line.
export const deviceLabel = (entry) =>
  [entry.device?.browser, entry.device?.os, entry.device?.device].filter(Boolean).join(' · ') ||
  '—'

// Turns a before-and-after into readable lines.
export function describeChanges(before, after) {
  if (!before || !after) return []
  return Object.keys(after)
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ field: key, from: before[key], to: after[key] }))
}

// Narrows the audit trail by staff, action, module, status and date.
export function filterActivity(entries, filters = {}) {
  const { query = '', staffId = 'all', action = 'all', module = 'all', status = 'all', from, to } =
    filters
  const term = query.trim().toLowerCase()

  return entries.filter((entry) => {
    if (staffId !== 'all' && entry.staffId !== staffId) return false
    if (action !== 'all' && entry.action !== action) return false
    if (module !== 'all' && entry.module !== module) return false
    if (status !== 'all' && entry.status !== status) return false

    if (from && entry.at.slice(0, 10) < from) return false
    if (to && entry.at.slice(0, 10) > to) return false

    if (!term) return true
    return [entry.staffName, entry.action, entry.module, entry.target, entry.reason, entry.role]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term))
  })
}

// Colours for success and failure.
export const STATUS_BADGE = {
  Success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
  Failed:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300',
}
