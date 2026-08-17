// What was charged and what was collected.

import { useMemo, useState } from 'react'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatCurrency, formatDate, formatMonth } from '../../lib/format.js'
import {
  change,
  fineReport,
  overdueReport,
  periodicStats,
  previousRange,
} from '../../lib/reports.js'
import Card from '../../components/dashboard/Card.jsx'
import {
  ChartCard,
  Delta,
  ExportBar,
  Figure,
  RangePicker,
  ReportTable,
  TrendChart,
} from '../../components/reports/ReportKit.jsx'
import OverdueSection from './OverdueSection.jsx'
import { useReports } from './ReportsLayout.jsx'

export default function FinesReport() {
  const { data, state } = useReports()
  const { locale } = usePreferences()
  const { range, granularity } = state

  const [band, setBand] = useState('all')
  const [category, setCategory] = useState('all')

  const report = useMemo(() => {
    const current = fineReport({
      fineRecords: data.fineRecords,
      lost: data.lost,
      repairs: data.repairs,
      range,
    })
    const before = fineReport({
      fineRecords: data.fineRecords,
      lost: data.lost,
      repairs: data.repairs,
      range: previousRange(range),
    })
    return {
      current,
      collected: change(current.collected, before.collected),
      generated: change(current.generated, before.generated),
      series: periodicStats({ ...data, range, granularity }),
      overdue: overdueReport({ borrowings: data.borrowings, band, category }),
    }
  }, [data, range, granularity, band, category])

  const label = (row) =>
    granularity === 'year'
      ? String(new Date(row.date).getFullYear())
      : granularity === 'day' || granularity === 'week'
        ? new Date(row.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
        : formatMonth(row.date, locale)

  const categories = useMemo(
    () => [...new Set(data.books.map((book) => book.category))].sort(),
    [data.books],
  )
  return (
    <div className="space-y-6">
      <RangePicker
        state={state}
        showGranularity
        extra={
          <ExportBar
            title="Fine collection report"
            filename={`fine-collection-${range.from.toISOString().slice(0, 10)}`}
            columns={[
              ['Fine ID', (row) => row.fineId],
              ['Member Name', (row) => row.memberName],
              ['Member ID', (row) => row.memberId],
              ['Book', (row) => row.bookName],
              ['Reason', (row) => row.reason],
              ['Days Overdue', (row) => row.daysOverdue],
              ['Amount', (row) => row.amount],
              ['Status', (row) => row.status],
              ['Raised On', (row) => row.sortAt?.slice(0, 10) ?? ''],
              ['Paid On', (row) => row.settledAt?.slice(0, 10) ?? ''],
              ['Collected By', (row) => row.collectedBy ?? ''],
            ]}
            rows={report.current.rows.generated}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Figure
          label="Generated"
          value={formatCurrency(report.current.generated, locale)}
          hint={<Delta change={report.generated} />}
        />
        <Figure
          label="Collected"
          value={formatCurrency(report.current.collected, locale)}
          tone="good"
          hint={<Delta change={report.collected} />}
        />
        <Figure
          label="Pending"
          value={formatCurrency(report.current.pending, locale)}
          tone={report.current.pending > 0 ? 'bad' : undefined}
          hint={`${report.current.pendingCount} unpaid`}
        />
        <Figure label="Waived" value={formatCurrency(report.current.waived, locale)} hint="written off" />
        <Figure
          label="Damage & loss charges"
          value={formatCurrency(report.current.damageCharges + report.current.lostCharges, locale)}
          hint="repairs and replacements"
        />
        <Figure
          label="Collection rate"
          value={report.current.collectionRate === null ? '—' : `${report.current.collectionRate}%`}
          tone={
            report.current.collectionRate === null
              ? undefined
              : report.current.collectionRate >= 80
                ? 'good'
                : 'bad'
          }
          hint="collected ÷ generated"
        />
      </div>

      <ChartCard
        title="Generated against collected"
        subtitle="A widening gap is a collection problem, not a fines problem."
      >
        {(view) => (
          <TrendChart
            data={report.series}
            view={view}
            locale={locale}
            labelOf={label}
            caption="Fines generated and collected"
            format={(value, loc) => formatCurrency(value, loc)}
            series={[
              { key: 'finesGenerated', label: 'Generated' },
              { key: 'finesCollected', label: 'Collected' },
            ]}
          />
        )}
      </ChartCard>

      <OverdueSection
        report={report.overdue}
        band={band}
        onBand={setBand}
        category={category}
        onCategory={setCategory}
        categories={categories}
      />

      <Card
        title="Collected in this period"
        subtitle={`${report.current.collectedCount} payments taken`}
        padded={false}
      >
        <ReportTable
          columns={[
            { label: 'Fine ID', render: (row) => row.fineId },
            { label: 'Member', render: (row) => `${row.memberName} · ${row.memberId}` },
            { label: 'Book', render: (row) => row.bookName },
            { label: 'Reason', render: (row) => row.reason },
            { label: 'Amount', align: 'right', render: (row) => formatCurrency(row.amount, locale) },
            { label: 'Paid', render: (row) => formatDate(row.settledAt, locale) },
            { label: 'Collected by', render: (row) => row.collectedBy ?? '—' },
          ]}
          rows={report.current.rows.collected.slice(0, 100).map((row) => ({ ...row, key: row.key }))}
          empty="No fines were collected in this period."
        />
      </Card>
    </div>
  )
}
