// Books lost or damaged, and what they cost.

import { useMemo } from 'react'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatCurrency, formatDate, formatNumber } from '../../lib/format.js'
import { lossReport } from '../../lib/reports.js'
import { LOST_BADGE } from '../../lib/circulation.js'
import { SEVERITY_BADGE } from '../../lib/repairs.js'
import Card from '../../components/dashboard/Card.jsx'
import {
  ChartCard,
  ExportBar,
  Figure,
  RangePicker,
  RankChart,
  ReportTable,
} from '../../components/reports/ReportKit.jsx'
import { Pill } from '../../components/circulation/Shared.jsx'
import { useReports } from './ReportsLayout.jsx'

export default function LossReport() {
  const { data, state } = useReports()
  const { locale } = usePreferences()
  const { range } = state

  const report = useMemo(
    () => lossReport({ lost: data.lost, repairs: data.repairs, books: data.books, range }),
    [data, range],
  )

  const net = report.lost.cost - report.lost.recoveredAmount

  return (
    <div className="space-y-6">
      <RangePicker
        state={state}
        extra={
          <ExportBar
            title="Lost and damaged report"
            filename={`lost-damaged-${range.from.toISOString().slice(0, 10)}`}
            columns={[
              ['Report ID', (row) => row.code],
              ['Book', (row) => row.bookTitle],
              ['Book ID', (row) => row.bookCode],
              ['Member', (row) => row.memberName],
              ['Reported On', (row) => row.reportedAt?.slice(0, 10) ?? ''],
              ['Reason', (row) => row.reason],
              ['Replacement Cost', (row) => row.replacementCost],
              ['Total Charge', (row) => row.total],
              ['Payment Status', (row) => row.paymentStatus],
              ['Resolution', (row) => row.status],
              ['Recovered On', (row) => row.recoveredAt?.slice(0, 10) ?? ''],
            ]}
            rows={report.lost.rows}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Figure
          label="Books lost"
          value={formatNumber(report.lost.total, locale)}
          tone={report.lost.total > 0 ? 'bad' : undefined}
          hint={`${report.lost.byMember} by members · ${report.lost.inInventory} off shelf`}
        />
        <Figure label="Unresolved" value={formatNumber(report.lost.unresolved, locale)} hint="still open" />
        <Figure label="Recovered" value={formatNumber(report.lost.recovered, locale)} tone="good" hint="turned up again" />
        <Figure
          label="Books damaged"
          value={formatNumber(report.damaged.total, locale)}
          hint={`${report.damaged.beyondRepair} beyond repair`}
        />
        <Figure
          label="Replacement cost"
          value={formatCurrency(report.lost.cost, locale)}
          hint={`${formatCurrency(report.damaged.cost, locale)} spent repairing`}
        />
        <Figure
          label="Recovered from members"
          value={formatCurrency(report.lost.recoveredAmount, locale)}
          tone={net > 0 ? 'bad' : 'good'}
          hint={`${formatCurrency(Math.max(0, net), locale)} borne by the library`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Damage by severity" subtitle="How serious the damage reported was.">
          {(view) => (
            <RankChart
              data={report.damaged.bySeverity.filter((row) => row.count > 0)}
              view={view}
              locale={locale}
              caption="Damage by severity"
              valueLabel="Books"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Where losses concentrate"
          subtitle="Whether a section loses unusually many books."
        >
          {(view) => (
            <RankChart
              data={report.byCategory.map((row) => ({
                label: row.label,
                count: row.lost + row.damaged,
              }))}
              view={view}
              locale={locale}
              caption="Lost and damaged by category"
              valueLabel="Books"
            />
          )}
        </ChartCard>
      </div>

      <Card
        title="Lost books"
        subtitle={`${report.lost.total} reported in this period`}
        padded={false}
      >
        <ReportTable
          columns={[
            { label: 'Report', render: (row) => row.code },
            { label: 'Book', render: (row) => row.bookTitle },
            { label: 'Copy', render: (row) => row.bookCode },
            { label: 'Member', render: (row) => row.memberName },
            { label: 'Reported', render: (row) => formatDate(row.reportedAt, locale) },
            { label: 'Reason', render: (row) => row.reason },
            { label: 'Charge', align: 'right', render: (row) => formatCurrency(row.total ?? 0, locale) },
            { label: 'Payment', render: (row) => row.paymentStatus },
            { label: 'Status', render: (row) => <Pill tone={LOST_BADGE[row.status]}>{row.status}</Pill> },
          ]}
          rows={report.lost.rows.map((row) => ({ ...row, key: row.id }))}
          empty="Nothing was reported lost in this period."
        />
      </Card>

      <Card
        title="Damaged books"
        subtitle={`${report.damaged.total} reported in this period`}
        padded={false}
      >
        <ReportTable
          columns={[
            { label: 'Ref', render: (row) => row.ref },
            { label: 'Book', render: (row) => row.bookName },
            { label: 'Copy', render: (row) => row.copyCode },
            { label: 'Damage', render: (row) => row.damageType },
            {
              label: 'Severity',
              render: (row) => <Pill tone={SEVERITY_BADGE[row.severity]}>{row.severity}</Pill>,
            },
            { label: 'Reported', render: (row) => formatDate(row.reportedAt, locale) },
            {
              label: 'Cost',
              align: 'right',
              render: (row) => (row.actualCost === null ? '—' : formatCurrency(row.actualCost, locale)),
            },
            { label: 'Status', render: (row) => row.status },
          ]}
          rows={report.damaged.rows.map((row) => ({ ...row, key: row.id }))}
          empty="Nothing was reported damaged in this period."
        />
      </Card>
    </div>
  )
}
