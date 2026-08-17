// How much was borrowed, returned and renewed over a period.

import { useMemo, useState } from 'react'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatDate, formatMonth, formatNumber } from '../../lib/format.js'
import {
  change,
  circulationBy,
  circulationReport,
  overdueReport,
  periodicStats,
  previousRange,
} from '../../lib/reports.js'
import { BORROWING_BADGE } from '../../lib/circulation.js'
import {
  ChartCard,
  Delta,
  ExportBar,
  Figure,
  RangePicker,
  RankChart,
  ReportTable,
  TrendChart,
} from '../../components/reports/ReportKit.jsx'
import { Pill, SELECT, SELECT_ARROW } from '../../components/circulation/Shared.jsx'
import Card from '../../components/dashboard/Card.jsx'
import { useReports } from './ReportsLayout.jsx'

const DIMENSIONS = [
  { key: 'category', label: 'By category' },
  { key: 'book', label: 'By book' },
  { key: 'staff', label: 'By staff member' },
]

export default function CirculationReport() {
  const { data, state } = useReports()
  const { locale } = usePreferences()
  const { range, granularity } = state
  const [dimension, setDimension] = useState('category')

  const report = useMemo(() => {
    const current = circulationReport({ borrowings: data.borrowings, reservations: data.reservations, range })
    const before = circulationReport({
      borrowings: data.borrowings,
      reservations: data.reservations,
      range: previousRange(range),
    })
    return {
      current,
      issued: change(current.issued, before.issued),
      returned: change(current.returned, before.returned),
      renewals: change(current.renewals, before.renewals),
      breakdown: circulationBy(data.borrowings, range, dimension),
      series: periodicStats({ ...data, range, granularity }),
      overdue: overdueReport({ borrowings: data.borrowings }),
    }
  }, [data, range, granularity, dimension])

  const label = (row) =>
    granularity === 'year'
      ? String(new Date(row.date).getFullYear())
      : granularity === 'day' || granularity === 'week'
        ? new Date(row.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
        : formatMonth(row.date, locale)

  const recent = report.current.rows.issued
    .slice()
    .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))
    .slice(0, 50)

  return (
    <div className="space-y-6">
      <RangePicker
        state={state}
        showGranularity
        extra={
          <ExportBar
            title="Circulation report"
            filename={`circulation-report-${range.from.toISOString().slice(0, 10)}`}
            columns={[
              ['Transaction', (row) => row.transaction],
              ['Book ID', (row) => row.book?.code ?? ''],
              ['Book Title', (row) => row.bookTitle],
              ['Category', (row) => row.bookCategory],
              ['Member', (row) => row.memberName],
              ['Member ID', (row) => row.memberNumber],
              ['Issued By', (row) => row.issuedBy ?? ''],
              ['Issue Date', (row) => row.issuedAt?.slice(0, 10) ?? ''],
              ['Due Date', (row) => row.dueAt?.slice(0, 10) ?? ''],
              ['Return Date', (row) => row.returnedAt?.slice(0, 10) ?? ''],
              ['Renewals', (row) => row.renewalCount],
              ['Days Overdue', (row) => row.daysOverdue],
              ['Status', (row) => row.status],
            ]}
            rows={report.current.rows.issued}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Figure
          label="Books issued"
          value={formatNumber(report.current.issued, locale)}
          hint={<Delta change={report.issued} />}
        />
        <Figure
          label="Books returned"
          value={formatNumber(report.current.returned, locale)}
          hint={<Delta change={report.returned} />}
        />
        <Figure
          label="Renewals"
          value={formatNumber(report.current.renewals, locale)}
          hint={<Delta change={report.renewals} />}
        />
        <Figure label="Reservations" value={formatNumber(report.current.reservations, locale)} />
        <Figure label="Currently issued" value={formatNumber(report.current.currentlyIssued, locale)} hint="right now, not this period" />
        <Figure
          label="Returned on time"
          value={report.current.onTimeRate === null ? '—' : `${report.current.onTimeRate}%`}
          tone={report.current.onTimeRate !== null && report.current.onTimeRate < 80 ? 'bad' : 'good'}
          hint={`${report.current.lateReturns} late`}
        />
      </div>

      <ChartCard
        title="Issues against returns"
        subtitle="The shape of library use over the period."
      >
        {(view) => (
          <TrendChart
            data={report.series}
            view={view}
            locale={locale}
            labelOf={label}
            caption="Books issued and returned"
            series={[
              { key: 'issued', label: 'Issued' },
              { key: 'returned', label: 'Returned' },
              { key: 'renewals', label: 'Renewals' },
              { key: 'reservations', label: 'Reservations' },
            ]}
          />
        )}
      </ChartCard>

      <ChartCard
        title="Breakdown"
        subtitle="The same issues, cut whichever way answers the question."
      >
        {(view) => (
          <div className="space-y-4">
            <select
              value={dimension}
              onChange={(event) => setDimension(event.target.value)}
              style={SELECT_ARROW}
              className={`${SELECT} no-print w-56`}
              aria-label="Break circulation down by"
            >
              {DIMENSIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <RankChart
              data={report.breakdown}
              view={view}
              locale={locale}
              caption={`Issues ${DIMENSIONS.find((d) => d.key === dimension).label.toLowerCase()}`}
              valueLabel="Issues"
            />
          </div>
        )}
      </ChartCard>

      <Card
        title="Issues in this period"
        subtitle={`${report.current.issued} transactions — the 50 most recent shown`}
        padded={false}
      >
        <ReportTable
          columns={[
            { label: 'Transaction', render: (row) => row.transaction },
            { label: 'Book', render: (row) => row.bookTitle },
            { label: 'Category', render: (row) => row.bookCategory },
            { label: 'Member', render: (row) => row.memberName },
            { label: 'Issued', render: (row) => formatDate(row.issuedAt, locale) },
            { label: 'Due', render: (row) => formatDate(row.dueAt, locale) },
            {
              label: 'Returned',
              render: (row) => (row.returnedAt ? formatDate(row.returnedAt, locale) : '—'),
            },
            {
              label: 'Status',
              render: (row) => <Pill tone={BORROWING_BADGE[row.status]}>{row.status}</Pill>,
            },
          ]}
          rows={recent.map((row) => ({ ...row, key: row.id }))}
          empty="Nothing was issued in this period."
        />
      </Card>
    </div>
  )
}
