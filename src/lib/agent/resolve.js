// Turns a typed sentence into the assistant tool it is asking for.

import { TOOLS } from './tools.js'

const clean = (text) => String(text ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

function score(needle, haystack) {
  const a = clean(needle)
  const b = clean(haystack)
  if (!a || !b) return 0
  if (a === b) return 1
  if (b.startsWith(a)) return 0.9
  if (b.includes(a)) return 0.75

  const words = a.split(' ').filter((word) => word.length > 2)
  if (words.length && words.every((word) => b.includes(word))) return 0.6

  const hits = words.filter((word) => b.includes(word)).length
  return words.length ? (hits / words.length) * 0.5 : 0
}

// The closest match to a typed phrase, or nothing if none is close.
export function bestMatch(phrase, items, fields, floor = 0.5) {
  const ranked = items
    .map((item) => ({
      item,
      score: Math.max(...fields.map((field) => score(phrase, field(item)))),
    }))
    .filter((row) => row.score >= floor)
    .sort((a, b) => b.score - a.score)

  return {
    match: ranked[0]?.item ?? null,
    confident: ranked.length === 1 || (ranked[0]?.score ?? 0) - (ranked[1]?.score ?? 0) > 0.15,
    alternatives: ranked.slice(0, 5).map((row) => row.item),
  }
}

// Finds the book a phrase names.
export const matchBook = (phrase, books) =>
  bestMatch(phrase, books, [(b) => b.title, (b) => b.code, (b) => b.isbn, (b) => b.author])

// Finds the member a phrase names.
export const matchMember = (phrase, members) =>
  bestMatch(phrase, members, [
    (m) => m.name,
    (m) => m.membershipNumber,
    (m) => m.email,
    (m) => m.phone,
  ])

const PERIODS = [
  [/\btoday\b/, 'today'],
  [/\byesterday\b/, 'yesterday'],
  [/\bthis week\b/, 'week'],
  [/\blast month\b/, 'lastMonth'],
  [/\bthis month\b/, 'month'],
  [/\bthis year\b/, 'year'],
  [/\blast (?:6|six) months\b/, 'halfYear'],
  [/\blast (?:3|three) months\b|\bquarter\b/, 'quarter'],
  [/\ball time\b|\bever\b/, 'all'],
]

const periodIn = (text) => PERIODS.find(([pattern]) => pattern.test(text))?.[1] ?? null

const numberIn = (text, fallback = null) => {
  const match = text.match(/\b(\d+)\b/)
  return match ? Number(match[1]) : fallback
}

function subjectOf(text, { after = [], before = [] } = {}) {
  const quoted = text.match(/["'“”‘’](.+?)["'“”‘’]/)
  if (quoted) return quoted[1].trim()

  let rest = text
  for (const word of after) {
    const at = rest.search(new RegExp(`\\b${word}\\b`, 'i'))
    if (at >= 0) {
      rest = rest.slice(at + word.length)
      break
    }
  }
  for (const word of before) {
    const at = rest.search(new RegExp(`\\b${word}\\b`, 'i'))

    if (at > 0) {
      const kept = rest.slice(0, at).trim()
      if (kept) rest = kept
    }
  }

  return rest
    .replace(/[?.!,]+$/, '')

    .replace(/,?\s*(?:heavily damaged|damaged|good|please|thanks?)\s*$/i, '')
    .replace(/^(?:the|a|an|me|us|my)\s+/i, '')
    .trim()
}

const INTENTS = [

  {
    test: /\b(?:my|i)\b.*\b(?:books?|borrow\w*|issued|out|borrowings?|due|reading)\b|\bwhat.*do i have\b/,
    exclude: /\bfines?\b|\bowe|\breserv|\bhold|\bhistor/,
    build: () => ({ tool: 'my_borrowings', args: {} }),
  },
  {
    test: /\bmy\b.*\b(?:fines?|owe|charges?)\b|\bdo i (?:have|owe) any\b.*\b(?:fines?|money|charges?)\b|\bhow much do i owe\b/,
    build: () => ({ tool: 'my_fines', args: {} }),
  },
  {
    test: /\bmy\b.*\b(?:reservations?|holds?|requests?)\b|\bis my reserved\b/,
    build: () => ({ tool: 'my_reservations', args: {} }),
  },
  {
    test: /\bmy\b.*\bhistor\w*|\bwhat have i (?:read|borrowed)\b/,
    build: (text) => ({ tool: 'my_history', args: { limit: numberIn(text, 25) } }),
  },
  {
    test: /\b(reserve|hold|put me down for|request)\b/,
    role: 'member',
    build: (text) => ({
      tool: 'reserve_book',
      args: { title: subjectOf(text, { after: ['reserve', 'for', 'request', 'hold'] }) },
    }),
  },

  {
    test: /\bissue\b|\bgive\b.*\bto\b|\blend\b/,
    build: (text) => ({
      tool: 'issue_book',
      args: {
        title: subjectOf(text, { after: ['issue', 'give', 'lend'], before: ['to'] }),
        member: subjectOf(text, { after: ['to'], before: ['for'] }),
      },
    }),
  },
  {
    test: /\breturn\b|\btake back\b|\bgive back\b/,
    build: (text) => {
      const condition = /heavily damaged/.test(text)
        ? 'Heavily Damaged'
        : /damag/.test(text)
          ? 'Damaged'
          : 'Good'
      return {
        tool: 'return_book',
        args: {
          title: subjectOf(text, { after: ['return', 'back'], before: ['for', 'from'] }),
          member: subjectOf(text, { after: ['for', 'from'], before: [','] }),
          condition,
        },
      }
    },
  },

  {
    test: /\bwho (?:has|is holding|has got)\b/,
    build: (text) => ({ tool: 'who_has_book', args: { title: subjectOf(text, { after: ['has', 'holding'] }) } }),
  },
  {
    test: /\bwho(?:'s| is)? (?:waiting|queued|in the queue)\b|\bqueue for\b/,
    build: (text) => ({
      tool: 'reservation_queue',
      args: { title: subjectOf(text, { after: ['for'] }) },
    }),
  },
  {
    test: /\bcan\b.*\bborrow\b|\ballowed to (?:take|borrow)\b|\beligible\b/,
    build: (text) => ({
      tool: 'can_borrow',
      args: {
        member: subjectOf(text, { after: ['can', 'is'], before: ['borrow', 'take', 'allowed'] }),

        title: (() => {
          const after = text.match(/\b(?:take|borrow)\s+(.+)/)?.[1]?.replace(/[?.!]+$/, '')
          if (!after || /^(?:another|a|an|any|more|one)\b/.test(after)) return undefined
          return after
        })(),
      },
    }),
  },
  {
    test: /\b(?:show|find|get|what(?:'s| is)?)\b.*\b(\w+)'s\b.*\b(book|borrowing|borrow)\b|\bfind\b.*\b(book|borrowing)s? (?:of|for)\b/,
    build: (text) => ({
      tool: 'member_borrowings',
      args: { member: (text.match(/(\w+)'s/) ?? [])[1] ?? subjectOf(text, { after: ['for', 'of'] }) },
    }),
  },
  {
    test: /\b(\w+)'s\b.*\b(fine|owe|charge)\b|\bwhat does\b.*\bowe\b/,
    build: (text) => ({
      tool: 'member_fines',
      args: {
        member:
          (text.match(/(\w+)'s/) ?? [])[1] ??
          subjectOf(text, { after: ['does'], before: ['owe'] }),
      },
    }),
  },
  {
    test: /\b(?:show|find|look up|get)\b.*\b(?:member|account|borrower)\b|\bmember\b.*\baccount\b/,
    build: (text) => ({
      tool: 'find_member',
      args: { member: subjectOf(text, { after: ['member', 'account', 'borrower', 'up'] }) },
    }),
  },

  {
    test: /\boverdue\b/,
    exclude: /\bmy\b|\bfine (?:collect|summar)/,
    build: (text) => ({
      tool: 'overdue_books',
      args: {
        minDays: /more than|over|longer than/.test(text) ? numberIn(text) : undefined,
        limit: 25,
      },
    }),
  },
  {
    test: /\bdue (?:today|this week|soon|tomorrow)\b|\bwhat(?:'s| is) due\b/,
    build: (text) => ({
      tool: 'due_today',
      args: { days: /week/.test(text) ? 7 : /tomorrow/.test(text) ? 1 : 0 },
    }),
  },

  {
    test: /\bfines?\b|\bowes?\b|\bcharges?\b/,
    exclude: /\bmy\b|\bdo i\b|\bfine rate\b|\b(?:change|set|update)\b/,
    build: (text) => {
      const named = text.match(/(\w+)'s/)?.[1]
      if (named) return { tool: 'member_fines', args: { member: named } }

      if (/\b(?:collect|generat|outstanding|pending|summar|revenue|how much|total)\b/.test(text)) {
        return { tool: 'fine_summary', args: { period: periodIn(text) ?? 'month' } }
      }
      return {
        tool: 'member_fines',
        args: { member: subjectOf(text, { after: ['for', 'of'], before: ['fine', 'owe'] }) },
      }
    },
  },

  {
    test: /\bmark\b.*\bdamag\w*|\bis damaged\b|\bhas torn\b|\breport damage\b|\bneeds? repair\b/,
    build: (text) => ({
      tool: 'report_damage',
      args: {
        title: subjectOf(text, { after: ['mark', 'this copy of'], before: ['as', 'is', 'has', 'needs'] }),
        severity: /heavily|badly|beyond/.test(text) ? 'Major' : 'Moderate',
        note: text,
      },
    }),
  },
  {
    test: /\brepair\b/,
    build: (text) => ({
      tool: 'repair_summary',
      args: { minDays: /more than|over|longer than/.test(text) ? numberIn(text) : undefined },
    }),
  },

  {
    test: /\b(?:summary|performing|performance|how is the library|overview)\b/,
    build: (text) => ({ tool: 'library_summary', args: { period: periodIn(text) ?? 'month' } }),
  },
  {
    test: /\b(?:popular|most borrowed|top \d+|best|buy more|more copies)\b/,
    build: (text) => ({
      tool: 'popular_books',
      args: { period: periodIn(text) ?? 'month', limit: numberIn(text, 10) },
    }),
  },
  {
    test: /\bstaff activity\b|\bwhat did\b.*\bdo\b|\bwho did\b/,
    build: (text) => ({ tool: 'staff_activity', args: { period: periodIn(text) ?? 'week' } }),
  },
  {
    test: /\bhow many\b.*\b(?:available|copies|books)\b|\binventory\b|\bcollection\b|\bstock\b/,
    build: (text) => ({
      tool: 'inventory_summary',
      args: {
        category: subjectOf(text, { after: ['many'], before: ['books', 'copies', 'are'] }) || undefined,
      },
    }),
  },

  {
    test: /\b(?:change|set|update)\b.*\bfine (?:rate|per day|to)\b/,
    build: (text) => ({ tool: 'update_fine_rate', args: { amount: numberIn(text) } }),
  },

  {
    test: /\bis\b.*\bavailable\b|\bhow many copies\b|\bdo we have\b|\bavailability\b/,
    build: (text) => ({
      tool: 'book_availability',
      args: {
        title: subjectOf(text, {
          after: ['have', 'is', 'of'],
          before: ['available', 'in stock'],
        }),
      },
    }),
  },
  {
    test: /\b(?:find|search|show|look for|books? (?:about|on)|recommend|suggest)\b/,
    build: (text) => ({
      tool: 'search_books',
      args: {
        query: subjectOf(text, {
          after: ['find', 'search', 'show', 'look for', 'recommend', 'suggest'],
        })
          .replace(/\b(?:available|in stock|right now|please|me|us|some|any)\b/g, ' ')
          .replace(/\bbooks?\b/g, ' ')
          .replace(/^\s*(?:for|about|on|with)\b/, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
        availableOnly: /\bavailable\b|\bin stock\b|\bright now\b/.test(text),
        limit: numberIn(text, 8),
      },
    }),
  },
]

// Works out which tool a sentence is asking for, without a language model.
export function resolve(text, { role = 'librarian' } = {}) {
  const lower = clean(text)
  if (!lower) return { unresolved: true, reason: 'empty' }

  for (const intent of INTENTS) {
    if (!intent.test.test(lower)) continue
    if (intent.exclude?.test(lower)) continue
    if (intent.role && intent.role !== role) continue

    const call = intent.build(lower, { role })
    if (!call?.tool || !TOOLS[call.tool]) continue

    const args = Object.fromEntries(
      Object.entries(call.args ?? {}).filter(
        ([, value]) => value !== undefined && value !== null && value !== '',
      ),
    )
    return { tool: call.tool, args, source: 'local' }
  }

  return { unresolved: true, reason: 'no-intent', text }
}
