// Everything about the signed-in member's own account.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLive } from './useLive.js'
import { library } from '../data/demoLibrary.js'
import { composeBooks } from '../lib/books.js'
import { composeMembers } from '../lib/members.js'
import { buildFineRecords } from '../lib/fines.js'
import {
  composeBorrowings,
  composeLostReports,
  composeReservations,
  daysBetween,
  maxBooksFor,
} from '../lib/circulation.js'
import { inboxFor } from '../lib/messages.js'
import * as circulation from '../services/circulation.js'
import * as booksService from '../services/books.js'
import * as membersService from '../services/members.js'
import * as repairsService from '../services/repairs.js'
import * as fines from '../services/fines.js'
import * as messagesService from '../services/messages.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'

const EMPTY = {
  issued: [],
  overrides: {},
  reservations: [],
  lostReports: [],
  repairs: [],
  addedBooks: [],
  addedMembers: [],
  memberOverrides: {},
  manualFines: [],
  payments: {},
  messages: [],
}

// The signed-in member's own books, fines, holds and messages.
export function useMyLibrary() {
  const { user } = useAuth()
  const { settings, rules } = useSettings()

  const [raw, setRaw] = useState(EMPTY)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(
    () =>
      Promise.all([
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
        messagesService.listMessages(),
      ]).then(
        ([
          issued,
          overrides,
          reservations,
          lostReports,
          repairs,
          addedBooks,
          addedMembers,
          memberOverrides,
          manualFines,
          payments,
          messages,
        ]) => {
          setRaw({
            issued,
            overrides,
            reservations,
            lostReports,
            repairs,
            addedBooks,
            addedMembers,
            memberOverrides,
            manualFines,
            payments,
            messages,
          })
          setLoading(false)
        },
      ),
    [],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  useLive(
    [
      'issuedBorrowings',
      'reservations',
      'lostReports',
      'repairs',
      'addedBooks',
      'addedMembers',
      'manualFines',
      'messages',
      'values/borrowingOverrides',
      'values/memberOverrides',
      'values/finePayments',
      'values/circulationRules',
    ],
    refresh,
  )

  const now = useMemo(() => new Date(), [raw])

  const value = useMemo(() => {
    const books = composeBooks({
      library,
      added: raw.addedBooks,
      issued: raw.issued,
      lostReports: raw.lostReports,
      repairs: raw.repairs,
      now,
    })

    const members = composeMembers({
      library,
      added: raw.addedMembers,
      overrides: raw.memberOverrides,
      now,
    })

    const me = members.find((row) => row.id === user?.memberId) ?? null

    const allBorrowings = composeBorrowings({
      library,
      issued: raw.issued,
      overrides: raw.overrides,
      lostReports: raw.lostReports,
      books,
      rules,
      now,
    })

    const allReservations = composeReservations({
      library,
      placed: raw.reservations,
      books,
      rules,
      now,
    })

    const myBorrowings = allBorrowings.filter((borrowing) => borrowing.memberId === user?.memberId)
    const myReservations = allReservations.filter((row) => row.memberId === user?.memberId)

    const fineRecords = buildFineRecords({
      library: { ...library, borrowings: [...library.borrowings, ...raw.issued] },
      manualFines: raw.manualFines,
      payments: raw.payments,
      now,
      rate: settings.finance.finePerDay,
      cap: settings.finance.maxFine,
      grace: settings.finance.graceDays,
    })
    const myFines = fineRecords.filter((row) => row.memberId === me?.membershipNumber)

    const myLost = composeLostReports({ reports: raw.lostReports, library, books, borrowings: allBorrowings }).filter(
      (row) => row.memberId === user?.memberId,
    )

    const out = myBorrowings.filter((borrowing) => !borrowing.returnedAt && borrowing.status !== 'Lost')
    const dueSoonDays = settings.notifications.dueSoonDays ?? 2

    const owed = myFines.filter((row) => !row.settled).reduce((sum, row) => sum + row.amount, 0)

    const withRenewal = out.map((borrowing) => ({
      ...borrowing,
      daysRemaining: daysBetween(now, borrowing.dueAt),
    }))

    const limit = me ? maxBooksFor(me, rules) : 0

    return {
      me,
      books,
      borrowings: myBorrowings,
      out: withRenewal,
      dueSoon: withRenewal.filter(
        (borrowing) => borrowing.status === 'Issued' && borrowing.daysRemaining <= dueSoonDays,
      ),
      overdue: withRenewal.filter((borrowing) => borrowing.status === 'Overdue'),
      history: [...myBorrowings].sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt)),
      reservations: myReservations,
      activeReservations: myReservations.filter((row) =>
        ['Waiting', 'Ready for Pickup'].includes(row.status),
      ),
      ready: myReservations.filter((row) => row.status === 'Ready for Pickup'),
      fines: myFines,
      owed,
      paid: myFines.filter((row) => row.settled),
      lost: myLost,

      messages: me ? inboxFor(raw.messages, user.memberId) : [],
      allReservations,
      limit,
      remaining: Math.max(0, limit - out.length),
      settings,
      rules,
      now,
    }
  }, [raw, now, user, settings, rules])

  return { ...value, loading, refresh }
}
