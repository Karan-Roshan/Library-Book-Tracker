// Gathers the figures every report is built from.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { library } from '../data/demoLibrary.js'
import { composeBooks } from '../lib/books.js'
import { composeCopies } from '../lib/copies.js'
import { composeMembers } from '../lib/members.js'
import { buildFineRecords } from '../lib/fines.js'
import { composeBorrowings, composeLostReports, composeReservations } from '../lib/circulation.js'
import { composeRepairs } from '../lib/repairs.js'
import * as circulation from '../services/circulation.js'
import * as booksService from '../services/books.js'
import * as membersService from '../services/members.js'
import * as repairsService from '../services/repairs.js'
import * as fines from '../services/fines.js'
import { listActivity } from '../services/activity.js'

const EMPTY = {
  rules: null,
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
  activity: [],
}

// Every record the reports are built from, loaded once.
export function useReportData() {
  const [raw, setRaw] = useState(EMPTY)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(
    () =>
      Promise.all([
        circulation.getRules(),
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
      ]).then((values) => {
        const [
          rules,
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
          activity,
        ] = values
        setRaw({
          rules,
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
          activity,
        })
        setLoading(false)
      }),
    [],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  const now = useMemo(() => new Date(), [raw])

  const data = useMemo(() => {
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

    const borrowings = composeBorrowings({
      library,
      issued: raw.issued,
      overrides: raw.overrides,
      lostReports: raw.lostReports,
      books,
      rules,
      now,
    })

    const reservations = composeReservations({
      library,
      placed: raw.reservations,
      books,
      rules,
      now,
    })

    return {
      books,
      members,
      borrowings,
      reservations,
      repairs: composeRepairs({ repairs: raw.repairs, books, members }),
      lost: composeLostReports({ reports: raw.lostReports, library, books, borrowings }),
      fineRecords: buildFineRecords({
        library: { ...library, borrowings: [...library.borrowings, ...raw.issued] },
        manualFines: raw.manualFines,
        payments: raw.payments,
        now,
        rate: rules?.finePerDay,
        cap: rules?.maxFine,
        grace: rules?.graceDays,
      }),
      activity: raw.activity,
      rules,
      now,
    }
  }, [raw, now])

  return { ...data, loading, refresh }
}
