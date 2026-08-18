// Carries out an assistant action, under the same permissions as the screens.

import { library } from '../../data/demoLibrary.js'
import { composeBooks } from '../../lib/books.js'
import { composeCopies } from '../../lib/copies.js'
import { composeMembers } from '../../lib/members.js'
import { buildFineRecords } from '../../lib/fines.js'
import {
  composeBorrowings,
  composeLostReports,
  composeReservations,
  daysBetween,
  issueEligibility,
  maxBooksFor,
  openBorrowings,
} from '../../lib/circulation.js'
import { composeRepairs, summarizeRepairs, isOpen } from '../../lib/repairs.js'
import {
  circulationReport,
  fineReport,
  inventoryReport,
  popularBooksReport,
  previousRange,
  change,
  resolveRange,
  staffReport,
} from '../../lib/reports.js'
import { matchBook, matchMember } from '../../lib/agent/resolve.js'
import * as circulation from '../../services/circulation.js'
import * as repairsService from '../../services/repairs.js'
import * as booksService from '../../services/books.js'
import * as membersService from '../../services/members.js'
import * as fines from '../../services/fines.js'
import { listActivity } from '../../services/activity.js'
import { getSettings, saveSection } from '../../services/settings.js'
import { circulationRules } from '../../lib/settings.js'

export class AgentError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'AgentError'
    this.alternatives = options.alternatives ?? null
    this.field = options.field ?? null
  }
}

// One reading of the whole library, so a two-part answer cannot see two versions of it.
export async function snapshot() {
  const [
    settings,
    issued,
    overrides,
    reservationRows,
    lostRows,
    repairRows,
    addedBooks,
    addedMembers,
    memberOverrides,
    manualFines,
    payments,
    activity,
  ] = await Promise.all([
    getSettings(),
    circulation.listIssuedBorrowings(),
    circulation.listBorrowingOverrides(),
    circulation.listReservations(),
    circulation.listLostReports(),
    repairsService.listRepairs(),
    booksService.listAddedBooks(),
    membersService.listAddedMembers(),
    membersService.listOverrides(),
    fines.listManualFines(),
    fines.listPayments(),
    listActivity(),
  ])

  const now = new Date()
  const rules = circulationRules(settings)

  const books = composeBooks({
    library,
    added: addedBooks,
    issued,
    lostReports: lostRows,
    repairs: repairRows,
    reservations: reservationRows,
    now,
  })
  const members = composeMembers({
    library,
    added: addedMembers,
    overrides: memberOverrides,
    issued,
    reservations: reservationRows,
    rules,
    now,
  })
  const borrowings = composeBorrowings({
    library,
    issued,
    overrides,
    lostReports: lostRows,
    books,
    members,
    rules,
    now,
  })
  const reservations = composeReservations({ library, placed: reservationRows, books, members, rules, now })
  const repairs = composeRepairs({ repairs: repairRows, books, members })
  const lost = composeLostReports({ reports: lostRows, library, books, members, borrowings })
  const fineRecords = buildFineRecords({
    library: { ...library, borrowings: [...library.borrowings, ...issued] },
    books,
    members,
    manualFines,
    payments,
    now,
    rate: settings.finance.finePerDay,
    cap: settings.finance.maxFine,
    grace: settings.finance.graceDays,
  })

  const copies = composeCopies({
    copies: library.copies ?? [],
    borrowings,
    repairs: repairRows,
    lostReports: lostRows,
    reservations,
    books,
    locations: library.locations ?? [],
    now,
  })

  return {
    settings,
    rules,
    books,
    copies,
    members,
    borrowings,
    reservations,
    repairs,
    repairRows,
    lost,
    fineRecords,
    activity,
    now,
  }
}

function needBook(phrase, world) {
  if (!phrase) throw new AgentError('Which book did you mean?', { field: 'title' })
  const { match, confident, alternatives } = matchBook(phrase, world.books)

  if (!match) {
    throw new AgentError(`I could not find a book matching “${phrase}”.`)
  }
  if (!confident && alternatives.length > 1) {
    throw new AgentError(`“${phrase}” could be more than one book — which did you mean?`, {
      alternatives: alternatives.map((book) => `${book.title} (${book.code})`),
    })
  }
  return match
}

function needMember(phrase, world) {
  if (!phrase) throw new AgentError('Which member did you mean?', { field: 'member' })
  const { match, confident, alternatives } = matchMember(phrase, world.members)

  if (!match) throw new AgentError(`I could not find a member matching “${phrase}”.`)
  if (!confident && alternatives.length > 1) {
    throw new AgentError(`“${phrase}” matches more than one member — which did you mean?`, {
      alternatives: alternatives.map((row) => `${row.name} (${row.membershipNumber})`),
    })
  }
  return match
}

const owedBy = (world, member) =>
  world.fineRecords
    .filter((row) => !row.settled && row.memberId === member.membershipNumber)
    .reduce((sum, row) => sum + row.amount, 0)

// Resolves the book or member a request names before anything is done.
export function pin(call, world) {
  const args = { ...call.args }

  if (args.title !== undefined) args.title = needBook(args.title, world).code
  if (args.member !== undefined) args.member = needMember(args.member, world).membershipNumber

  return { ...call, args }
}

// What each assistant tool actually does.
export const EXECUTORS = {
  async search_books({ query, category, availableOnly, limit = 8 }, { world }) {
    const term = String(query ?? '').trim().toLowerCase()
    const rows = world.books
      .filter((book) => !category || book.category.toLowerCase() === category.toLowerCase())
      .filter((book) => !availableOnly || book.available > 0)
      .filter((book) =>
        term
          ? [book.title, book.author, book.category, book.isbn, book.code]
              .filter(Boolean)
              .some((field) => String(field).toLowerCase().includes(term))
          : true,
      )
      .sort((a, b) => b.available - a.available || a.title.localeCompare(b.title))
      .slice(0, limit)

    return {
      kind: 'books',
      query,
      availableOnly: Boolean(availableOnly),
      total: rows.length,
      rows: rows.map((book) => ({
        title: book.title,
        author: book.author,
        code: book.code,
        category: book.category,
        shelf: book.shelf,
        available: book.available,
        copies: book.copies,
      })),
    }
  },

  async book_availability({ title }, { world }) {
    const book = needBook(title, world)
    const out = world.borrowings.filter((borrowing) => borrowing.bookId === book.id && !borrowing.returnedAt).length
    const waiting = world.reservations.filter(
      (row) => row.bookId === book.id && ['Waiting', 'Ready for Pickup'].includes(row.status),
    ).length
    const repairing = world.repairs.filter((row) => row.bookId === book.id && isOpen(row)).length

    return {
      kind: 'availability',
      title: book.title,
      author: book.author,
      code: book.code,
      shelf: book.shelf,
      category: book.category,
      copies: book.copies,
      available: book.available,
      issued: out,
      repairing,
      lost: book.lost ?? 0,
      waiting,
    }
  },

  async who_has_book({ title }, { world }) {
    const book = needBook(title, world)
    const holders = world.borrowings
      .filter((borrowing) => borrowing.bookId === book.id && !borrowing.returnedAt)
      .map((borrowing) => ({
        member: borrowing.memberName,
        memberId: borrowing.memberNumber,
        due: borrowing.dueAt,
        status: borrowing.status,
        daysOverdue: borrowing.daysOverdue,
      }))

    const queue = world.reservations
      .filter((row) => row.bookId === book.id && ['Waiting', 'Ready for Pickup'].includes(row.status))
      .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
      .map((row) => ({ member: row.memberName, position: row.position, status: row.status }))

    return {
      kind: 'holders',
      title: book.title,
      copies: book.copies,
      available: book.available,
      repairing: world.repairs.filter((row) => row.bookId === book.id && isOpen(row)).length,
      holders,
      queue,
    }
  },

  async find_member({ member }, { world }) {
    const found = needMember(member, world)
    const out = openBorrowings(world.borrowings).filter((borrowing) => borrowing.memberId === found.id)

    return {
      kind: 'member',
      name: found.name,
      memberId: found.membershipNumber,
      type: found.type,
      status: found.status,
      email: found.email,
      phone: found.phone,
      joined: found.joinedAt,
      expires: found.expiresAt,
      expired: found.expiresAt ? new Date(found.expiresAt) < world.now : false,
      out: out.length,
      limit: maxBooksFor(found, world.rules),
      overdue: out.filter((borrowing) => borrowing.status === 'Overdue').length,
      owed: owedBy(world, found),
    }
  },

  async member_borrowings({ member }, { world }) {
    const found = needMember(member, world)
    const out = openBorrowings(world.borrowings).filter((borrowing) => borrowing.memberId === found.id)

    return {
      kind: 'borrowings',
      subject: found.name,
      memberId: found.membershipNumber,
      limit: maxBooksFor(found, world.rules),
      rows: out.map((borrowing) => ({
        title: borrowing.bookTitle,
        code: borrowing.book?.code,
        issued: borrowing.issuedAt,
        due: borrowing.dueAt,
        status: borrowing.status,
        daysRemaining: daysBetween(world.now, borrowing.dueAt),
        daysOverdue: borrowing.daysOverdue,
        fine: borrowing.fine,
        renewals: borrowing.renewalCount,
      })),
    }
  },

  async can_borrow({ member, title }, { world }) {
    const found = needMember(member, world)
    const book = title ? needBook(title, world) : null

    const verdict = issueEligibility({
      member: found,
      book,
      borrowings: world.borrowings,
      owed: owedBy(world, found),
      reservations: world.reservations,
      rules: world.rules,
      now: world.now,
    })

    const out = openBorrowings(world.borrowings).filter((borrowing) => borrowing.memberId === found.id)

    return {
      kind: 'eligibility',
      subject: found.name,
      memberId: found.membershipNumber,
      book: book?.title ?? null,
      allowed: verdict.ok,
      blocks: verdict.blocks,
      warnings: verdict.warnings,
      out: out.length,
      limit: maxBooksFor(found, world.rules),
      owed: owedBy(world, found),
    }
  },

  async my_borrowings(_args, { world, subject }) {
    return EXECUTORS.member_borrowings({ member: subject.membershipNumber }, { world })
  },

  async my_fines(_args, { world, subject }) {
    return EXECUTORS.member_fines({ member: subject.membershipNumber }, { world })
  },

  async my_reservations(_args, { world, subject }) {
    const rows = world.reservations.filter((row) => row.memberId === subject.id)
    return {
      kind: 'reservations',
      subject: subject.name,
      rows: rows.map((row) => ({
        title: row.bookTitle,
        status: row.status,
        position: row.position,
        reserved: row.reservedAt,
        collectBy: row.expiresAt,
      })),
    }
  },

  async my_history({ limit = 25 }, { world, subject }) {
    const rows = world.borrowings
      .filter((borrowing) => borrowing.memberId === subject.id)
      .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))
      .slice(0, limit)

    return {
      kind: 'history',
      subject: subject.name,
      total: world.borrowings.filter((borrowing) => borrowing.memberId === subject.id).length,
      rows: rows.map((borrowing) => ({
        title: borrowing.bookTitle,
        issued: borrowing.issuedAt,
        returned: borrowing.returnedAt,
        status: borrowing.status,
        renewals: borrowing.renewalCount,
      })),
    }
  },

  async overdue_books({ minDays, limit = 25 }, { world }) {
    const rows = world.borrowings
      .filter((borrowing) => borrowing.status === 'Overdue')
      .filter((borrowing) => !minDays || borrowing.daysOverdue > minDays)
      .sort((a, b) => b.daysOverdue - a.daysOverdue)

    return {
      kind: 'overdue',
      minDays: minDays ?? null,
      total: rows.length,
      fines: rows.reduce((sum, borrowing) => sum + borrowing.fine, 0),
      members: new Set(rows.map((borrowing) => borrowing.memberId)).size,
      rows: rows.slice(0, limit).map((borrowing) => ({
        title: borrowing.bookTitle,
        member: borrowing.memberName,
        memberId: borrowing.memberNumber,
        due: borrowing.dueAt,
        daysOverdue: borrowing.daysOverdue,
        fine: borrowing.fine,
        reminded: Boolean(borrowing.remindedAt),
      })),
    }
  },

  async due_today({ days = 0 }, { world }) {
    const rows = world.borrowings
      .filter((borrowing) => borrowing.status === 'Issued')
      .map((borrowing) => ({ borrowing, inDays: daysBetween(world.now, borrowing.dueAt) }))
      .filter((row) => row.inDays >= 0 && row.inDays <= days)
      .sort((a, b) => a.inDays - b.inDays)

    return {
      kind: 'due',
      days,
      total: rows.length,
      rows: rows.slice(0, 25).map(({ borrowing, inDays }) => ({
        title: borrowing.bookTitle,
        member: borrowing.memberName,
        memberId: borrowing.memberNumber,
        due: borrowing.dueAt,
        inDays,
      })),
    }
  },

  async issue_book({ title, member }, { world, actor }) {
    const book = needBook(title, world)
    const found = needMember(member, world)

    const verdict = issueEligibility({
      member: found,
      book,
      borrowings: world.borrowings,
      owed: owedBy(world, found),
      reservations: world.reservations,
      rules: world.rules,
      now: world.now,
    })
    if (!verdict.ok) {
      return {
        kind: 'refused',
        action: 'issue',
        title: book.title,
        subject: found.name,
        blocks: verdict.blocks,
      }
    }

    const borrowing = await circulation.issueBook({
      book,
      member: found,
      rules: world.rules,
      staff: actor.label,
      reservations: world.reservations,
      copies: world.copies,
    })

    return {
      kind: 'issued',
      title: book.title,
      code: book.code,
      subject: found.name,
      memberId: found.membershipNumber,
      due: borrowing.dueAt,
      warnings: verdict.warnings,
    }
  },

  async return_book({ title, member, condition = 'Good' }, { world, actor }) {
    const book = needBook(title, world)
    const found = needMember(member, world)

    const borrowing = world.borrowings.find(
      (row) => row.bookId === book.id && row.memberId === found.id && !row.returnedAt,
    )
    if (!borrowing) {
      throw new AgentError(`${found.name} does not have ${book.title} out.`)
    }

    const result = await circulation.returnBook(borrowing, {
      condition,
      notes: '',
      staff: actor.label,
      reservations: world.reservations,
      openRepairs: world.repairRows.filter((row) => row.status !== 'Available'),
    })

    return {
      kind: 'returned',
      title: book.title,
      subject: found.name,
      daysOverdue: borrowing.daysOverdue,
      fine: borrowing.daysOverdue > 0 ? borrowing.fine : 0,
      condition,
      repairRaised: result.repairRaised,
      calledNext: result.calledNext?.memberName ?? null,
    }
  },

  async reserve_book({ title }, { world, subject, actor }) {
    const book = needBook(title, world)

    const already = world.reservations.find(
      (row) =>
        row.bookId === book.id &&
        row.memberId === subject.id &&
        ['Waiting', 'Ready for Pickup'].includes(row.status),
    )
    if (already) {
      return {
        kind: 'refused',
        action: 'reserve',
        title: book.title,
        blocks: [`You already have a reservation for this — you are #${already.position}.`],
      }
    }

    await circulation.placeReservation({ book, member: subject, staff: actor.label })
    const ahead = world.reservations.filter(
      (row) => row.bookId === book.id && ['Waiting', 'Ready for Pickup'].includes(row.status),
    ).length

    return {
      kind: 'reserved',
      title: book.title,
      available: book.available,
      position: ahead + 1,
    }
  },

  async reservation_queue({ title }, { world }) {
    const book = needBook(title, world)
    const rows = world.reservations
      .filter((row) => row.bookId === book.id && ['Waiting', 'Ready for Pickup'].includes(row.status))
      .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))

    return {
      kind: 'queue',
      title: book.title,
      available: book.available,
      rows: rows.map((row) => ({
        member: row.memberName,
        position: row.position,
        status: row.status,
        reserved: row.reservedAt,
      })),
    }
  },

  async member_fines({ member }, { world }) {
    const found = needMember(member, world)
    const rows = world.fineRecords.filter((row) => row.memberId === found.membershipNumber)
    const pending = rows.filter((row) => !row.settled)

    return {
      kind: 'fines',
      subject: found.name,
      memberId: found.membershipNumber,
      owed: pending.reduce((sum, row) => sum + row.amount, 0),
      paid: rows.filter((row) => row.settled).reduce((sum, row) => sum + row.amount, 0),
      rows: pending.slice(0, 20).map((row) => ({
        book: row.bookName,
        reason: row.reason,
        daysOverdue: row.daysOverdue,
        amount: row.amount,
      })),
    }
  },

  async fine_summary({ period = 'month' }, { world }) {
    const range = resolveRange(period, world.now)
    const current = fineReport({
      fineRecords: world.fineRecords,
      lost: world.lost,
      repairs: world.repairs,
      range,
    })
    const before = fineReport({
      fineRecords: world.fineRecords,
      lost: world.lost,
      repairs: world.repairs,
      range: previousRange(range),
    })

    return {
      kind: 'fineSummary',
      period: range.label,
      generated: current.generated,
      collected: current.collected,
      pending: current.pending,
      rate: current.collectionRate,
      change: change(current.collected, before.collected),
    }
  },

  async report_damage({ title, damageType = 'Torn pages', severity = 'Moderate', note }, { world, actor }) {
    const book = needBook(title, world)

    const taken = new Set(
      world.repairs.filter((row) => row.bookId === book.id && isOpen(row)).map((row) => row.copyNumber),
    )
    let copyNumber = 1
    while (taken.has(copyNumber) && copyNumber <= book.copies) copyNumber += 1
    if (copyNumber > book.copies) {
      throw new AgentError(`Every copy of ${book.title} is already on the repair bench.`)
    }

    await repairsService.raiseRepair({
      bookId: book.id,
      bookCode: book.code,
      bookName: book.title,
      copyNumber,
      damageType,
      description: note ?? '',
      severity,
      reportedBy: actor.label,
      source: 'Assistant',
    })

    return {
      kind: 'repairRaised',
      title: book.title,
      copy: `${book.code}-${String(copyNumber).padStart(2, '0')}`,
      damageType,
      severity,
      remaining: book.available - 1,
    }
  },

  async repair_summary({ minDays }, { world }) {
    const stats = summarizeRepairs(world.repairs)
    const lingering = world.repairs
      .filter((row) => isOpen(row))
      .filter((row) => !minDays || daysBetween(row.reportedAt, world.now) > minDays)
      .sort((a, b) => new Date(a.reportedAt) - new Date(b.reportedAt))

    return {
      kind: 'repairs',
      minDays: minDays ?? null,
      total: stats.total,
      open: stats.open,
      completed: stats.completed,
      spend: stats.spend,
      turnaround: stats.turnaround,
      rows: lingering.slice(0, 15).map((row) => ({
        title: row.bookName,
        copy: row.copyCode,
        damage: row.damageType,
        status: row.status,
        days: daysBetween(row.reportedAt, world.now),
        assigned: row.assignedTo,
      })),
    }
  },

  async library_summary({ period = 'month' }, { world }) {
    const range = resolveRange(period, world.now)
    const circ = circulationReport({ borrowings: world.borrowings, reservations: world.reservations, range })
    const prior = circulationReport({
      borrowings: world.borrowings,
      reservations: world.reservations,
      range: previousRange(range),
    })
    const money = fineReport({
      fineRecords: world.fineRecords,
      lost: world.lost,
      repairs: world.repairs,
      range,
    })
    const inventory = inventoryReport({
      books: world.books,
      borrowings: world.borrowings,
      reservations: world.reservations,
      repairs: world.repairs,
      lost: world.lost,
    })

    const borrowed = new Set(
      world.borrowings
        .filter((borrowing) => new Date(borrowing.issuedAt) >= range.from && new Date(borrowing.issuedAt) <= range.to)
        .map((borrowing) => borrowing.memberId),
    )

    return {
      kind: 'summary',
      period: range.label,
      issued: circ.issued,
      returned: circ.returned,
      activeMembers: borrowed.size,
      overdue: world.borrowings.filter((borrowing) => borrowing.status === 'Overdue').length,
      collected: money.collected,
      pending: money.pending,
      repairs: world.repairs.filter(isOpen).length,
      lost: world.lost.filter((row) => !row.recoveredAt).length,
      available: inventory.available,
      copies: inventory.copies,
      change: change(circ.issued, prior.issued),
    }
  },

  async popular_books({ period = 'month', limit = 10 }, { world }) {
    const range = resolveRange(period, world.now)
    const rows = popularBooksReport({
      borrowings: world.borrowings,
      reservations: world.reservations,
      range,
      limit,
    })

    return {
      kind: 'popular',
      period: range.label,
      rows: rows.map((row) => ({
        title: row.title,
        issues: row.issues,
        reservations: row.reservations,
        members: row.uniqueMembers,
        copies: row.copies,
        pressure: row.pressure,
      })),
    }
  },

  async inventory_summary({ category }, { world }) {
    const report = inventoryReport({
      books: world.books,
      borrowings: world.borrowings,
      reservations: world.reservations,
      repairs: world.repairs,
      lost: world.lost,
    })

    if (category) {
      const wanted = report.byCategory.find(
        (row) => row.label.toLowerCase().includes(String(category).toLowerCase()),
      )
      if (!wanted) {
        throw new AgentError(`There is no category matching “${category}”.`, {
          alternatives: report.byCategory.map((row) => row.label),
        })
      }
      return { kind: 'inventory', scope: wanted.label, ...wanted }
    }

    return {
      kind: 'inventory',
      scope: 'the whole collection',
      titles: report.titles,
      copies: report.copies,
      available: report.available,
      outNow: report.issued,
      repairing: report.underRepair,
      categories: report.byCategory,
    }
  },

  async staff_activity({ period = 'week', staff }, { world }) {
    const range = resolveRange(period, world.now)
    const report = staffReport({ activity: world.activity, range })
    const rows = staff
      ? report.staff.filter((row) => row.name.toLowerCase().includes(staff.toLowerCase()))
      : report.staff

    return {
      kind: 'staffActivity',
      period: range.label,
      entries: report.entries,
      rows: rows.slice(0, 12).map((row) => ({
        name: row.name,
        role: row.role,
        total: row.total,
        issued: row.issued,
        returned: row.returned,
        fines: row.finesCollected,
        repairs: row.repairsRaised + row.repairsManaged,
      })),
    }
  },

  async update_fine_rate({ amount }, { world, actor }) {
    const next = Number(amount)
    if (!Number.isFinite(next) || next < 0) {
      throw new AgentError('What should the fine per day be?', { field: 'amount' })
    }

    const before = world.settings.finance.finePerDay
    await saveSection(
      'finance',
      { finePerDay: next },
      { reason: 'Changed through the assistant', actor: actor.user },
    )

    return { kind: 'settingChanged', setting: 'Fine per day', from: before, to: next }
  },
}
