// The pages the assistant can send you to, and the words that mean each one.

import { CAPABILITIES } from '../permissions.js'

// Everywhere the assistant can take you, and the words that mean each place.
export const DESTINATIONS = [

  {
    key: 'issue',
    label: 'Issue a book',
    hint: 'Lend a copy to a member',
    to: '/circulation/issue',
    needs: CAPABILITIES.CIRCULATION,
    group: 'At the counter',
    words: ['issue', 'issu', 'lend', 'give book', 'borrow out', 'check out', 'checkout', 'de do', 'dena', 'jari'],
  },
  {
    key: 'return',
    label: 'Return a book',
    hint: 'Take a copy back',
    to: '/circulation/return',
    needs: CAPABILITIES.CIRCULATION,
    group: 'At the counter',
    words: ['return', 'retrun', 'give back', 'take back', 'wapas', 'wapis', 'vapas'],
  },
  {
    key: 'reservations',
    label: 'Reservations',
    hint: 'Holds on titles that are all out',
    to: '/circulation/reservations',
    needs: CAPABILITIES.CIRCULATION,
    group: 'At the counter',
    words: ['reserve', 'reservation', 'hold', 'queue', 'waiting list', 'book kara'],
  },
  {
    key: 'overdue',
    label: 'Overdue books',
    hint: 'Everything past its due date',
    to: '/circulation/overdue',
    needs: CAPABILITIES.CIRCULATION,
    group: 'At the counter',
    words: ['overdue', 'late', 'due', 'not returned', 'der', 'deri'],
  },

  {
    key: 'books',
    label: 'All books',
    hint: 'The catalogue',
    to: '/books',
    needs: CAPABILITIES.CATALOG,
    group: 'The shelves',
    words: ['book', 'books', 'catalogue', 'catalog', 'title', 'search book', 'kitab', 'pustak'],
  },
  {
    key: 'add-book',
    label: 'Add a book',
    hint: 'Accession a new title',
    to: '/books/add',
    needs: CAPABILITIES.CATALOG,
    group: 'The shelves',
    words: ['add book', 'new book', 'accession', 'naya', 'nayi kitab'],
  },
  {
    key: 'repairs',
    label: 'Book repairs',
    hint: 'Damaged copies on the bench',
    to: '/books/repairs',
    needs: CAPABILITIES.CATALOG,
    group: 'The shelves',
    words: ['repair', 'damage', 'damaged', 'torn', 'broken', 'mend', 'kharab', 'tuta'],
  },

  {
    key: 'members',
    label: 'Members',
    hint: 'The membership register',
    to: '/members',
    needs: CAPABILITIES.MEMBERS,
    group: 'People',
    words: ['member', 'members', 'card', 'membership', 'sadasya'],
  },
  {
    key: 'personnel',
    label: 'Personnel',
    hint: 'Staff accounts and roles',
    to: '/staff',
    needs: CAPABILITIES.ACCOUNTS,
    group: 'People',
    words: ['staff', 'personnel', 'employee', 'assistant', 'karmchari'],
  },

  {
    key: 'fines',
    label: 'Fine management',
    hint: 'Charges owed and collected',
    to: '/fines',
    needs: CAPABILITIES.FINES,
    group: 'Money and messages',
    words: ['fine', 'fines', 'charge', 'penalty', 'payment', 'pay', 'jurmana', 'paisa'],
  },
  {
    key: 'complaints',
    label: 'Complaints',
    hint: 'What the library has been told is wrong',
    to: '/complaints',
    needs: CAPABILITIES.COMPLAINTS,
    group: 'Money and messages',
    words: ['complain', 'complaint', 'complaints', 'complian', 'complaine', 'grievance', 'problem', 'issue with', 'shikayat', 'shikayt'],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    hint: 'Messages to and from the desk',
    to: '/notifications',
    needs: null,
    group: 'Money and messages',
    words: ['message', 'messages', 'notification', 'notify', 'mail', 'inbox', 'send message', 'sandesh'],
  },

  {
    key: 'reports',
    label: 'Reports & analytics',
    hint: 'Figures across every module',
    to: '/reports',
    needs: CAPABILITIES.REPORTS,
    group: 'Oversight',
    words: ['report', 'reports', 'analytics', 'statistics', 'stats', 'graph', 'chart', 'rapat'],
  },
  {
    key: 'activity',
    label: 'Activity log',
    hint: 'Who did what, and when',
    to: '/activity',
    needs: CAPABILITIES.ACTIVITY,
    group: 'Oversight',
    words: ['activity', 'log', 'audit', 'history', 'who did'],
  },
  {
    key: 'settings',
    label: 'Settings',
    hint: 'Rules the whole library runs on',
    to: '/settings',
    needs: CAPABILITIES.SETTINGS,
    group: 'Oversight',
    words: ['setting', 'settings', 'rule', 'rules', 'configure', 'preference'],
  },

  {
    key: 'my-books',
    label: 'My books',
    hint: 'What you have out right now',
    to: '/my/books',
    needs: CAPABILITIES.MY_LIBRARY,
    group: 'Your account',
    words: ['my book', 'my books', 'issued to me', 'borrowed', 'meri kitab'],
  },
  {
    key: 'my-browse',
    label: 'Browse the catalogue',
    hint: 'Find something to borrow',
    to: '/my/browse',
    needs: CAPABILITIES.BROWSE,
    group: 'Your account',
    words: ['browse', 'search', 'find book', 'reserve a book', 'request book', 'issue', 'dhundo'],
  },
  {
    key: 'my-due',
    label: 'Due and overdue',
    hint: 'What to bring back, and when',
    to: '/my/due',
    needs: CAPABILITIES.MY_LIBRARY,
    group: 'Your account',
    words: ['due', 'overdue', 'return date', 'kab wapas'],
  },
  {
    key: 'my-fines',
    label: 'My fines',
    hint: 'What you owe',
    to: '/my/fines',
    needs: CAPABILITIES.MY_FINES,
    group: 'Your account',
    words: ['fine', 'my fine', 'owe', 'charge', 'jurmana'],
  },
  {
    key: 'my-complaints',
    label: 'My complaints',
    hint: 'Raise one, or see what happened',
    to: '/my/complaints',
    needs: CAPABILITIES.MY_COMPLAINTS,
    group: 'Your account',
    words: ['complain', 'complaint', 'complian', 'problem', 'shikayat', 'shikayt', 'grievance'],
  },
]

// Only the places this person may actually go.
export const destinationsFor = (user, can) =>
  DESTINATIONS.filter((entry) => !entry.needs || can(user, entry.needs))

// Ranks destinations against what somebody typed, misspellings included.
export function matchDestinations(text, available, limit = 4) {
  const term = String(text ?? '').trim().toLowerCase()
  if (term.length < 2) return []

  const words = term.split(/\s+/).filter(Boolean)

  const scored = available.map((entry) => {
    let score = 0

    if (entry.label.toLowerCase() === term) score += 100
    if (entry.label.toLowerCase().includes(term)) score += 40

    for (const word of entry.words) {
      if (term === word) score += 60
      else if (words.includes(word)) score += 45
      else if (term.includes(word)) score += 25
      else if (word.startsWith(term) && term.length >= 3) score += 20
    }

    for (const word of words) {
      if (entry.label.toLowerCase().includes(word)) score += 10
    }

    return { entry, score }
  })

  return scored
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.entry)
}

// The menu, grouped in the order the groups appear.
export function groupDestinations(available) {
  const groups = new Map()
  for (const entry of available) {
    groups.set(entry.group, [...(groups.get(entry.group) ?? []), entry])
  }
  return [...groups.entries()].map(([group, items]) => ({ group, items }))
}
