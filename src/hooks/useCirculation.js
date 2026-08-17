// Loads everything the circulation desk needs and keeps it in step.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLive } from './useLive.js'
import { library } from '../data/demoLibrary.js'
import { composeBooks } from '../lib/books.js'
import { composeCopies } from '../lib/copies.js'
import { buildFineRecords } from '../lib/fines.js'
import {
  composeLostReports,
  composeBorrowings,
  composeReservations,
  owedBy,
  summarizeCirculation,
} from '../lib/circulation.js'
import { composeMembers } from '../lib/members.js'
import * as circulation from '../services/circulation.js'
import * as booksService from '../services/books.js'
import * as membersService from '../services/members.js'
import * as fines from '../services/fines.js'
import * as repairsService from '../services/repairs.js'

const EMPTY = {
  rules: null,
  issued: [],
  overrides: {},
  reservations: [],
  lostReports: [],
  addedBooks: [],
  addedMembers: [],
  memberOverrides: {},
  manualFines: [],
  payments: {},
  repairs: [],
}

// Everything the desk needs, kept live and re-read when anyone changes it.
export function useCirculation() {
  const [raw, setRaw] = useState(EMPTY)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    return Promise.all([
      circulation.getRules(),
      circulation.listIssuedBorrowings(),
      circulation.listBorrowingOverrides(),
      circulation.listReservations(),
      circulation.listLostReports(),
      booksService.listAddedBooks(),
      membersService.listAddedMembers(),
      membersService.listOverrides(),
      fines.listManualFines(),
      fines.listPayments(),
      repairsService.listRepairs(),
    ]).then(
      ([
        rules,
        issued,
        overrides,
        reservations,
        lostReports,
        addedBooks,
        addedMembers,
        memberOverrides,
        manualFines,
        payments,
        repairs,
      ]) => {
        setRaw({
          rules,
          issued,
          overrides,
          reservations,
          lostReports,
          addedBooks,
          addedMembers,
          memberOverrides,
          manualFines,
          payments,
          repairs,
        })
        setLoading(false)
      },
    )
  }, [])

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
    const rules = raw.rules ?? undefined

    const books = composeBooks({
      library,
      added: raw.addedBooks,
      issued: raw.issued,
      lostReports: raw.lostReports,
      repairs: raw.repairs,
      reservations: raw.reservations,
      now,
    })

    const members = composeMembers({
      library,
      added: raw.addedMembers,
      overrides: raw.memberOverrides,
      now,
    })

    const reservations = composeReservations({
      library,
      placed: raw.reservations,
      books,
      rules: rules ?? undefined,
      now,
    })

    const borrowings = composeBorrowings({
      library,
      issued: raw.issued,
      overrides: raw.overrides,
      lostReports: raw.lostReports,
      books,
      rules: rules ?? undefined,
      now,
    })

    const lost = composeLostReports({ reports: raw.lostReports, library, books, borrowings })

    const fineRecords = buildFineRecords({
      library: { ...library, borrowings: [...library.borrowings, ...raw.issued] },
      manualFines: raw.manualFines,
      payments: raw.payments,
      now,
      rate: rules?.finePerDay,
      cap: rules?.maxFine,
      grace: rules?.graceDays,
    })

    const copies = composeCopies({
      copies: library.copies ?? [],
      borrowings,
      repairs: raw.repairs,
      lostReports: raw.lostReports,
      reservations,
      books: library.books,
      locations: library.locations ?? [],
      now,
    })

    return {
      rules,
      books,
      copies,
      locations: library.locations ?? [],
      members,
      borrowings,
      reservations,
      lost,
      fineRecords,
      repairs: raw.repairs,
      openRepairs: raw.repairs.filter((row) => row.status !== 'Available'),
      stats: summarizeCirculation(borrowings, now),
      owedBy: (memberNumber) => owedBy(fineRecords, memberNumber),
      now,
    }
  }, [raw, now])

  return { ...value, loading, refresh }
}
