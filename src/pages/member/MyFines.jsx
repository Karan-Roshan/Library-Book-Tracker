// What the member owes, and why.

import { useMemo } from 'react'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatCurrency, formatDate } from '../../lib/format.js'
import { useMyLibrary } from '../../hooks/useMyLibrary.js'
import { Card, Empty, PageHead, Tile } from './MemberKit.jsx'
import { ReportTable } from '../../components/reports/ReportKit.jsx'

export default function MyFines() {
  const { locale, system } = usePreferences()
  const my = useMyLibrary()

  const totals = useMemo(() => {
    const paid = my.fines.filter((row) => row.settled)
    return {
      paid: paid.reduce((sum, row) => sum + row.amount, 0),
      paidCount: paid.length,
      lost: my.lost.reduce((sum, row) => sum + (row.paymentStatus === 'Paid' ? 0 : row.total ?? 0), 0),
    }
  }, [my.fines, my.lost])

  if (my.loading) return <p className="py-20 text-center text-sm text-ink-400">Reading your account…</p>

  const pending = my.fines.filter((row) => !row.settled)

  return (
    <div className="space-y-6">
      <PageHead title="My fines" subtitle="Charges on your account, and what they are for." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile
          label="Outstanding"
          value={formatCurrency(my.owed, locale, system)}
          tone={my.owed > 0 ? 'bad' : 'good'}
          hint={`${pending.length} unpaid`}
        />
        <Tile
          label="Paid to date"
          value={formatCurrency(totals.paid, locale, system)}
          hint={`${totals.paidCount} payments`}
        />
        <Tile
          label="Replacement charges"
          value={formatCurrency(totals.lost, locale, system)}
          hint="for lost books"
          tone={totals.lost > 0 ? 'bad' : undefined}
        />
      </div>

      {my.owed > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="font-semibold">
            You owe {formatCurrency(my.owed, locale, system)}.
          </p>
          <p className="mt-1">
            Fines are settled at the library desk — no online payment is available. Overdue charges
            keep growing at {formatCurrency(my.settings.finance.finePerDay, locale, system)} a day
            until the book comes back
            {my.settings.circulation.blockAtFine > 0 && (
              <>
                , and borrowing is blocked at{' '}
                {formatCurrency(my.settings.circulation.blockAtFine, locale, system)}
              </>
            )}
            .
          </p>
        </div>
      )}

      {pending.length === 0 ? (
        <Empty title="Nothing outstanding">
          You have no unpaid charges. Returning books on time keeps it that way.
        </Empty>
      ) : (
        <Card title="Outstanding" subtitle={`${pending.length} charges`} padded={false}>
          <ReportTable
            columns={[
              { label: 'Book', render: (row) => row.bookName },
              { label: 'Reason', render: (row) => row.reason },
              {
                label: 'Due date',
                render: (row) => (row.dueDate ? formatDate(row.dueDate, locale, system) : '—'),
              },
              { label: 'Days overdue', align: 'right', render: (row) => row.daysOverdue || '—' },
              {
                label: 'Amount',
                align: 'right',
                render: (row) => formatCurrency(row.amount, locale, system),
              },
            ]}
            rows={pending.map((row) => ({ ...row, key: row.key }))}
          />
        </Card>
      )}

      {totals.paidCount > 0 && (
        <Card title="Payment history" subtitle={`${totals.paidCount} settled`} padded={false}>
          <ReportTable
            columns={[
              { label: 'Reference', render: (row) => row.fineId },
              { label: 'Book', render: (row) => row.bookName },
              { label: 'Reason', render: (row) => row.reason },
              {
                label: 'Amount',
                align: 'right',
                render: (row) => formatCurrency(row.amount, locale, system),
              },
              {
                label: 'Paid on',
                render: (row) => (row.settledAt ? formatDate(row.settledAt, locale, system) : '—'),
              },
              { label: 'Taken by', render: (row) => row.collectedBy ?? '—' },
            ]}
            rows={my.fines
              .filter((row) => row.settled)
              .map((row) => ({ ...row, key: row.key }))}
          />
        </Card>
      )}

      {my.lost.length > 0 && (
        <Card title="Lost book charges" padded={false}>
          <ReportTable
            columns={[
              { label: 'Book', render: (row) => row.bookTitle },
              { label: 'Reported', render: (row) => formatDate(row.reportedAt, locale, system) },
              { label: 'Reason', render: (row) => row.reason },
              {
                label: 'Charge',
                align: 'right',
                render: (row) => formatCurrency(row.total ?? 0, locale, system),
              },
              { label: 'Status', render: (row) => row.paymentStatus },
            ]}
            rows={my.lost.map((row) => ({ ...row, key: row.id }))}
          />
        </Card>
      )}
    </div>
  )
}
