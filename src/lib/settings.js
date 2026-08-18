// The library's editable rules, with a sensible value for anything unset.

export const DATE_FORMATS = [
  { value: 'medium', label: '14 Aug 2026', hint: 'Day, short month, year' },
  { value: 'dmy', label: '14/08/2026', hint: 'DD/MM/YYYY' },
]

// 12-hour or 24-hour.
export const TIME_FORMATS = [
  { value: '12', label: '9:32 pm' },
  { value: '24', label: '21:32' },
]

// The currency figures are shown in.
export const CURRENCIES = [{ value: 'INR', label: '₹ Indian Rupee', symbol: '₹' }]

// The time zone the library runs on.
export const TIMEZONES = ['Asia/Kolkata']

// The days of the week, for the opening-days setting.
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Where signing in takes you.
export const LANDING_PAGES = [
  { value: '/dashboard', label: 'Dashboard' },
  { value: '/circulation/issue', label: 'Issue Book' },
  { value: '/books', label: 'All Books' },
  { value: '/members', label: 'Members' },
  { value: '/reports', label: 'Reports' },
]

// The things the library can notify people about.
export const NOTIFICATION_EVENTS = [
  { key: 'bookIssued', label: 'Book issued', hint: 'A receipt when a book leaves the desk.' },
  { key: 'bookReturned', label: 'Book returned', hint: 'Confirmation that a copy came back.' },
  {
    key: 'dueSoon',
    label: 'Due date approaching',
    hint: 'A reminder before the book falls due.',
    lead: true,
  },
  { key: 'overdue', label: 'Book overdue', hint: 'Chasing a book that is already late.' },
  { key: 'fineRaised', label: 'Fine generated', hint: 'When a charge is raised against a member.' },
  { key: 'finePaid', label: 'Fine payment received', hint: 'A receipt for money taken.' },
  {
    key: 'reservationPlaced',
    label: 'Reservation placed',
    hint: 'Confirmation when the desk holds a book for a member.',
  },
  { key: 'reservationReady', label: 'Reservation available', hint: 'The held copy is on the counter.' },
  {
    key: 'reservationCancelled',
    label: 'Reservation cancelled',
    hint: 'When a hold is called off before it is collected.',
  },
  {
    key: 'reservationExpiring',
    label: 'Reservation expiring',
    hint: 'The hold is about to lapse.',
    lead: true,
  },
  { key: 'repairDone', label: 'Book repair completed', hint: 'A mended copy is back on the shelf.' },
  { key: 'announcements', label: 'Announcements', hint: 'General notices to members and staff.' },
]

// How a notification can be sent.
export const CHANNELS = [
  { key: 'inApp', label: 'In-app', available: true },
  { key: 'email', label: 'Email', available: false },
  { key: 'sms', label: 'SMS', available: false },
  { key: 'push', label: 'Push', available: false },
]

// Every setting with a sensible starting value.
export const DEFAULT_SETTINGS = {
  library: {
    name: 'Athenaeum',
    tagline: 'Where Knowledge Finds Its Home.',
    description:
      'A public lending library serving readers of every age, with a general collection across fiction, science, history and reference.',
    logo: null,
    address: '14 Tagore Road, Pune, Maharashtra 411001',
    phone: '+91 20 2612 4400',
    email: 'contact@athenaeum.library',
    website: 'https://athenaeum.library',
    branch: 'Central Branch',
    opensAt: '09:00',
    closesAt: '20:00',

    openDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    holidays: [],
  },

  system: {
    dateFormat: 'medium',
    timeFormat: '12',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    locale: 'en-IN',
    theme: 'light',
    landingPage: '/dashboard',
    pageSize: 50,

    reportPeriod: 'quarter',
    confirmDestructive: true,

    autoLogoutMinutes: 60,
  },

  circulation: {
    borrowDays: 14,
    maxBooks: 2,

    borrowImmediately: true,

    borrowWhenOverdue: false,
    borrowWithFine: true,
    blockAtFine: 100,

    referenceCategories: [],
    reservationDays: 3,

    renewalsAllowed: true,
    maxRenewals: 2,
    renewalDays: 7,

    renewBeforeDue: true,
    renewWhenOverdue: false,
    renewWhenReserved: false,
    renewWithFine: false,
  },

  finance: {
    finePerDay: 5,
    maxFine: 300,

    graceDays: 2,

    fineByCategory: {},

    damageCharges: {
      'Marked or written in': 50,
      'Torn or missing pages': 100,
      'Damaged binding': 150,
      'Water damage': 200,
    },

    replacementCost: 500,
    processingFee: 50,

    chargeOverdueOnLoss: false,
  },

  notifications: {
    events: Object.fromEntries(
      NOTIFICATION_EVENTS.map((event) => [
        event.key,
        { enabled: !['bookReturned', 'announcements'].includes(event.key), channels: ['inApp'] },
      ]),
    ),

    dueSoonDays: 2,
    reservationExpiryDays: 1,

    overdueRepeatDays: 7,
    signature: 'Athenaeum',

    emailFrom: 'noreply@athenaeum.library',
    emailEnabled: false,
  },

  security: {
    grants: {},
    minPasswordLength: 10,
    requireMixedCase: true,
    requireNumber: true,
    requireSymbol: false,

    lockoutAttempts: 5,
    lockoutMinutes: 15,
    sessionHours: 12,

    activityPageSize: 50,
    activityRetentionDays: 0,
  },
}

const flatten = (value, fallback) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (value && typeof value === 'object') {
    const first = value.Public ?? Object.values(value).find((entry) => Number.isFinite(entry))
    return Number.isFinite(first) ? first : fallback
  }
  return fallback
}

// Stored settings with anything missing filled in, so no screen reads undefined.
export function withDefaults(saved) {
  const stored = saved ?? {}

  const merge = (key) => ({ ...DEFAULT_SETTINGS[key], ...(stored[key] ?? {}) })

  const circulation = merge('circulation')
  const finance = merge('finance')
  const notifications = merge('notifications')

  return {
    library: { ...merge('library'), openDays: stored.library?.openDays ?? DEFAULT_SETTINGS.library.openDays, holidays: stored.library?.holidays ?? [] },
    system: merge('system'),
    circulation: {
      ...circulation,

      borrowDays: flatten(stored.circulation?.borrowDays, DEFAULT_SETTINGS.circulation.borrowDays),
      maxBooks: flatten(stored.circulation?.maxBooks, DEFAULT_SETTINGS.circulation.maxBooks),
      referenceCategories: stored.circulation?.referenceCategories ?? [],
    },
    finance: {
      ...finance,
      fineByCategory: { ...(stored.finance?.fineByCategory ?? {}) },
      damageCharges: {
        ...DEFAULT_SETTINGS.finance.damageCharges,
        ...(stored.finance?.damageCharges ?? {}),
      },
    },
    notifications: {
      ...notifications,
      events: Object.fromEntries(
        NOTIFICATION_EVENTS.map((event) => [
          event.key,
          {
            ...DEFAULT_SETTINGS.notifications.events[event.key],
            ...(stored.notifications?.events?.[event.key] ?? {}),
          },
        ]),
      ),
    },
    security: { ...merge('security'), grants: stored.security?.grants ?? {} },
  }
}

// Turns the settings into the rules the desk enforces.
export const circulationRules = (settings) => ({
  borrowDays: settings.circulation.borrowDays,
  maxBooks: settings.circulation.maxBooks,
  maxRenewals: settings.circulation.renewalsAllowed ? settings.circulation.maxRenewals : 0,
  renewalDays: settings.circulation.renewalDays,
  finePerDay: settings.finance.finePerDay,
  maxFine: settings.finance.maxFine,
  graceDays: settings.finance.graceDays,
  blockAtFine: settings.circulation.blockAtFine,
  borrowWithFine: settings.circulation.borrowWithFine,
  borrowWhenOverdue: settings.circulation.borrowWhenOverdue,
  borrowImmediately: settings.circulation.borrowImmediately,
  referenceCategories: settings.circulation.referenceCategories,
  renewalsAllowed: settings.circulation.renewalsAllowed,
  renewWithFine: settings.circulation.renewWithFine,
  renewWhenOverdue: settings.circulation.renewWhenOverdue,
  renewWhenReserved: settings.circulation.renewWhenReserved,
  reservationDays: settings.circulation.reservationDays,
  replacementCost: settings.finance.replacementCost,
  processingFee: settings.finance.processingFee,
})

// The daily fine rate for a category, falling back to the standard one.
export function fineRateFor(settings, { category } = {}) {
  const byCategory = settings.finance.fineByCategory?.[category]
  if (byCategory !== undefined && byCategory !== null && byCategory !== '') return Number(byCategory)

  return settings.finance.finePerDay
}

// Days actually charged for, once the grace period is taken off.
export const chargeableDays = (daysOverdue, settings) =>
  Math.max(0, daysOverdue - (settings.finance.graceDays ?? 0))

// Whether this event is switched on for this channel.
export const notificationOn = (settings, key) =>
  Boolean(settings.notifications.events?.[key]?.enabled)

// Whether the library is open on a given day.
export const isOpenOn = (settings, date) => {
  const day = WEEKDAYS[(new Date(date).getDay() + 6) % 7]
  if (!settings.library.openDays.includes(day)) return false
  const iso = new Date(date).toISOString().slice(0, 10)
  return !settings.library.holidays.some((holiday) => holiday.date === iso)
}

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value)

// What changed between two versions, for the history.
export function diffSettings(before, after, prefix = '') {
  const changes = []
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])

  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key
    const from = before?.[key]
    const to = after?.[key]

    if (isObject(from) || isObject(to)) {
      changes.push(...diffSettings(from ?? {}, to ?? {}, path))
      continue
    }
    if (JSON.stringify(from) === JSON.stringify(to)) continue
    changes.push({ path, from, to })
  }

  return changes
}

// What each settings section is called.
export const SECTION_LABELS = {
  library: 'Library Information',
  system: 'System Preferences',
  circulation: 'Circulation Rules',
  finance: 'Fines & Charges',
  notifications: 'Notifications',
  security: 'Security & Permissions',
}

// Names a setting in words, for the history.
export function describePath(path) {
  return path
    .split('.')
    .map((part, index) =>
      index === 0
        ? (SECTION_LABELS[part] ?? part)
        : part.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()),
    )
    .join(' · ')
}

// Writes a setting's value readably, for the history.
export const describeValue = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'On' : 'Off'
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'None'
  return String(value)
}
