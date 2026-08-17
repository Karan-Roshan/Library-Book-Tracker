// What the assistant is allowed to do, and what each action needs.

import { CAPABILITIES } from '../permissions.js'

// How dangerous an action is, and whether it must be confirmed.
export const RISK = {
  READ: 'read',
  ACT: 'act',
  CONFIRM: 'confirm',
}

// Every action the assistant may take, with the permission each needs.
export const TOOLS = {
  search_books: {
    summary: 'Find books in the catalogue by title, author, category, ISBN or shelf.',
    risk: RISK.READ,
    capability: null,
    params: {
      query: { type: 'string', description: 'What to search for.' },
      category: { type: 'string', optional: true },
      availableOnly: { type: 'boolean', optional: true },
      limit: { type: 'number', optional: true },
    },
    examples: ['do we have Atomic Habits', 'find available books on machine learning'],
  },

  book_availability: {
    summary: 'How many copies of a title are on the shelf, out, reserved or under repair.',
    risk: RISK.READ,
    capability: null,
    params: { title: { type: 'string', description: 'The book title or book ID.' } },
    examples: ['is Clean Code available', 'how many copies of Sapiens do we have'],
  },

  who_has_book: {
    summary: 'Which members are holding copies of a title, and who is waiting for it.',
    risk: RISK.READ,

    capability: CAPABILITIES.CIRCULATION,
    params: { title: { type: 'string' } },
    examples: ['who has Atomic Habits', 'who is waiting for Clean Code'],
  },

  find_member: {
    summary: "Look up a member's account: their status, limit, books out and what they owe.",
    risk: RISK.READ,
    capability: CAPABILITIES.MEMBERS,
    params: { member: { type: 'string', description: 'Name, member ID, email or phone.' } },
    examples: ["show Karan's library account", 'find member Athena-03.08.2026-001'],
  },

  member_borrowings: {
    summary: 'The books a member currently has out, with due dates.',
    risk: RISK.READ,
    capability: CAPABILITIES.MEMBERS,
    params: { member: { type: 'string' } },
    examples: ["find Karan's active books", 'what does Priya have out'],
  },

  can_borrow: {
    summary: 'Whether a member may borrow right now, and if not, exactly why.',
    risk: RISK.READ,
    capability: CAPABILITIES.CIRCULATION,
    params: {
      member: { type: 'string' },
      title: { type: 'string', optional: true },
    },
    examples: ['can Karan borrow another book', 'is Priya allowed to take Clean Code'],
  },

  my_borrowings: {
    summary: 'The books I currently have out, with due dates and days remaining.',
    risk: RISK.READ,
    capability: CAPABILITIES.MY_LIBRARY,
    scope: 'self',
    params: {},
    examples: ['what books do I have', 'when is my next book due'],
  },

  my_fines: {
    summary: 'What I owe and what I have already paid.',
    risk: RISK.READ,
    capability: CAPABILITIES.MY_FINES,
    scope: 'self',
    params: {},
    examples: ['do I have any fines', 'how much do I owe'],
  },

  my_reservations: {
    summary: 'Books I have reserved and my place in each queue.',
    risk: RISK.READ,
    capability: CAPABILITIES.MY_REQUESTS,
    scope: 'self',
    params: {},
    examples: ['show my reservations', 'is my reserved book ready'],
  },

  my_history: {
    summary: 'Everything I have borrowed.',
    risk: RISK.READ,
    capability: CAPABILITIES.MY_LIBRARY,
    scope: 'self',
    params: { limit: { type: 'number', optional: true } },
    examples: ['show my borrowing history', 'what have I read this year'],
  },

  overdue_books: {
    summary: 'Books past their due date, with the member, days overdue and fine.',
    risk: RISK.READ,
    capability: CAPABILITIES.CIRCULATION,
    params: {
      minDays: { type: 'number', optional: true },
      limit: { type: 'number', optional: true },
    },
    examples: ["show today's overdue books", 'which books are more than 30 days overdue'],
  },

  due_today: {
    summary: 'Books due back today or within a given number of days.',
    risk: RISK.READ,
    capability: CAPABILITIES.CIRCULATION,
    params: { days: { type: 'number', optional: true } },
    examples: ['what is due today', 'what is due this week'],
  },

  issue_book: {
    summary: 'Issue a copy to a member. Checks every borrowing rule first.',
    risk: RISK.CONFIRM,
    capability: CAPABILITIES.CIRCULATION,
    params: {
      title: { type: 'string' },
      member: { type: 'string' },
    },
    examples: ['issue Atomic Habits to Karan', 'give Clean Code to member 1024'],
  },

  return_book: {
    summary: 'Take a book back from a member and work out any overdue charge.',
    risk: RISK.CONFIRM,
    capability: CAPABILITIES.CIRCULATION,
    params: {
      title: { type: 'string' },
      member: { type: 'string' },
      condition: { type: 'string', optional: true, enum: ['Good', 'Damaged', 'Heavily Damaged'] },
    },
    examples: ['return Atomic Habits for Karan', 'take back Clean Code from Priya, damaged'],
  },

  reserve_book: {
    summary: 'Put a book on hold for me and join the queue.',
    risk: RISK.ACT,
    capability: CAPABILITIES.MY_REQUESTS,
    scope: 'self',
    params: { title: { type: 'string' } },
    examples: ['reserve Clean Code', 'put me down for Atomic Habits'],
  },

  reservation_queue: {
    summary: 'Who is waiting for a title, in order.',
    risk: RISK.READ,
    capability: CAPABILITIES.CIRCULATION,
    params: { title: { type: 'string' } },
    examples: ['who is waiting for Atomic Habits'],
  },

  member_fines: {
    summary: "A member's outstanding and settled charges.",
    risk: RISK.READ,
    capability: CAPABILITIES.FINES,
    params: { member: { type: 'string' } },
    examples: ['what does Karan owe', "show Priya's fines"],
  },

  fine_summary: {
    summary: 'Fines generated, collected and outstanding over a period.',
    risk: RISK.READ,
    capability: CAPABILITIES.FINANCE,
    params: { period: { type: 'string', optional: true } },
    examples: ['how much fine was collected this month'],
  },

  report_damage: {
    summary: 'Take a copy off the shelf and open a repair record against it.',
    risk: RISK.CONFIRM,
    capability: CAPABILITIES.CATALOG,
    params: {
      title: { type: 'string' },
      damageType: { type: 'string', optional: true },
      severity: { type: 'string', optional: true, enum: ['Minor', 'Moderate', 'Major', 'Critical'] },
      note: { type: 'string', optional: true },
    },
    examples: ['mark Clean Code as damaged', 'this copy of Sapiens has torn pages'],
  },

  repair_summary: {
    summary: 'What is on the repair bench, what it has cost, and how long it takes.',
    risk: RISK.READ,
    capability: CAPABILITIES.CATALOG,
    params: { minDays: { type: 'number', optional: true } },
    examples: ['show repair statistics', 'which books have been under repair for over 7 days'],
  },

  library_summary: {
    summary: 'How the library is performing over a period, with the change on the last one.',
    risk: RISK.READ,
    capability: CAPABILITIES.REPORTS,
    params: { period: { type: 'string', optional: true } },
    examples: ["give me today's library summary", 'how is the library performing this month'],
  },

  popular_books: {
    summary: 'The most borrowed titles over a period, and which need more copies.',
    risk: RISK.READ,
    capability: CAPABILITIES.REPORTS,
    params: { period: { type: 'string', optional: true }, limit: { type: 'number', optional: true } },
    examples: ['show the top 10 most borrowed books this month', 'what should we buy more of'],
  },

  inventory_summary: {
    summary: 'The collection: titles, copies, and where every copy is.',
    risk: RISK.READ,
    capability: CAPABILITIES.REPORTS,
    params: { category: { type: 'string', optional: true } },
    examples: ['how many Computer Science books are available'],
  },

  staff_activity: {
    summary: 'What each member of staff did over a period.',
    risk: RISK.READ,
    capability: CAPABILITIES.ACTIVITY,
    params: { period: { type: 'string', optional: true }, staff: { type: 'string', optional: true } },
    examples: ['show staff activity from yesterday'],
  },

  update_fine_rate: {
    summary: 'Change the overdue fine charged per day, library-wide.',
    risk: RISK.CONFIRM,
    capability: CAPABILITIES.SETTINGS,
    params: { amount: { type: 'number', description: 'Rupees per overdue day.' } },
    examples: ['change the fine rate to ₹10 a day'],
  },
}

// The names of all tools.
export const toolNames = () => Object.keys(TOOLS)

// Tools this person's role may use.
export function toolsFor(user, can) {
  return Object.entries(TOOLS)
    .filter(([, tool]) => !tool.capability || can(user, tool.capability))
    .map(([name, tool]) => ({ name, ...tool }))
}

// The tool list, written out for the language model.
export function describeTools(tools) {
  return tools
    .map((tool) => {
      const params = Object.entries(tool.params)
        .map(([key, spec]) => `${key}${spec.optional ? '?' : ''}: ${spec.type}`)
        .join(', ')
      return `${tool.name}(${params}) — ${tool.summary}`
    })
    .join('\n')
}

// Example questions, per role.
export const SUGGESTIONS = {
  owner: [
    "Give me today's library summary",
    'Show overdue books',
    'How much fine was collected this month?',
    'Show the top 10 most borrowed books',
    'Show repair statistics',
    'How many Fiction books are available?',
  ],
  librarian: [
    "Show today's overdue books",
    'Do we have Atomic Habits?',
    'Who has Clean Code?',
    'Can Karan borrow another book?',
    'What is due today?',
    'Find available books on history',
  ],
  member: [
    'What books do I have?',
    "What's due this week?",
    'Do I have any fines?',
    'Find available books on science',
    'Show my reservations',
    'Show my borrowing history',
  ],
}

// Suggestions for this role.
export const suggestionsFor = (role) => SUGGESTIONS[role] ?? SUGGESTIONS.member
