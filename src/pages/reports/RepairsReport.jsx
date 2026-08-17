// What broke, what was mended, and how long it took.

import { useMemo } from 'react'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatCurrency, formatDate, formatMonth, formatNumber } from '../../lib/format.js'
import { change, periodicStats, previousRange, repairReport } from '../../lib/reports.js'
import { STATUS_BADGE, SEVERITY_BADGE } from '../../lib/repairs.js'
import Card from '../../components/dashboard/Card.jsx'
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
import { Pill } from '../../components/circulation/Shared.jsx'
import { useReports } from './ReportsLayout.jsx'

export default function RepairsReport() {
  const { data, state } = useReports()
  const { locale } = usePreferences()
  const { range, granularity } = state

  const report = useMemo(() => {
    const current = repairReport({ repairs: data.repairs, range })
    const before = repairReport({ repairs: data.repairs, range: previousRange(range) })
    return {
      current,
      raised: change(current.total, before.total),
      cost: change(current.cost, before.cost),
      series: periodicStats({ ...data, range, granularity }),
    }
  }, [data, range, granularity])

  const label = (row) =>
    granularity === 'year'
      ? String(new Date(row.date).getFullYear())
      : granularity === 'day' || granularity === 'week'
        ? new Date(row.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
        : formatMonth(row.date, locale)

  return (
    <div className="space-y-6">
      <RangePicker
        state={state}
        showGranularity
        extra={
          <ExportBar
            title="Repair report"
            filename={`repairs-${range.from.toISOString().slice(0, 10)}`}
            columns={[
              ['Repair Ref', (row) => row.ref],
              ['Book', (row) => row.bookName],
              ['Copy ID', (row) => row.copyCode],
              ['Damage Type', (row) => row.damageType],
              ['Severity', (row) => row.severity],
              ['Reported On', (row) => row.reportedAt?.slice(0, 10) ?? ''],
              ['Assigned To', (row) => row.assignedTo ?? ''],
              ['Estimated Cost', (row) => row.estimatedCost ?? ''],
              ['Actual Cost', (row) => row.actualCost ?? ''],
              ['Turnaround Days', (row) => row.turnaround ?? ''],
              ['Charged To Member', (row) => row.chargeAmount ?? ''],
              ['Status', (row) => row.status],
            ]}
            rows={report.current.rows}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Figure
          label="Repairs raised"
          value={formatNumber(report.current.total, locale)}
          hint={<Delta change={report.raised} />}
        />
        <Figure label="Active now" value={formatNumber(report.current.active, locale)} hint="on the bench" />
        <Figure label="Completed" value={formatNumber(report.current.completed, locale)} tone="good" />
        <Figure
          label="Repair cost"
          value={formatCurrency(report.current.cost, locale)}
          hint={<Delta change={report.cost} />}
        />
        <Figure
          label="Average turnaround"
          value={report.current.averageDays === null ? '—' : `${report.current.averageDays} days`}
          hint={report.current.overdue > 0 ? `${report.current.overdue} past due` : 'report to completion'}
          tone={report.current.overdue > 0 ? 'bad' : undefined}
        />
        <Figure
          label="Recovered from members"
          value={formatCurrency(report.current.recovered, locale)}
          hint={`${formatCurrency(report.current.committed, locale)} committed on open jobs`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Repair cost over time" subtitle="Rising maintenance spend, if there is any.">
          {(view) => (
            <TrendChart
              data={report.series}
              view={view}
              locale={locale}
              labelOf={label}
              caption="Repair cost by period"
              format={(value, loc) => formatCurrency(value, loc)}
              series={[{ key: 'repairCost', label: 'Repair cost' }]}
            />
          )}
        </ChartCard>

        <ChartCard title="What breaks" subtitle="Damage types, most frequent first.">
          {(view) => (
            <RankChart
              data={report.current.damage}
              view={view}
              locale={locale}
              caption="Repairs by damage type"
              valueLabel="Repairs"
            />
          )}
        </ChartCard>

        {report.current.byStaff.length > 0 && (
          <ChartCard title="Repairs by staff member" subtitle="Who carried the bench work.">
            {(view) => (
              <RankChart
                data={report.current.byStaff}
                view={view}
                locale={locale}
                caption="Repairs by staff member"
                valueLabel="Repairs"
              />
            )}
          </ChartCard>
        )}

        {report.current.byBook.length > 0 && (
          <Card
            title="Books repaired more than once"
            subtitle="Candidates for replacement rather than another repair."
            padded={false}
          >
            <ReportTable
              columns={[
                { label: 'Book', render: (row) => row.title },
                { label: 'Book ID', render: (row) => row.code },
                { label: 'Repairs', align: 'right', render: (row) => row.count },
                { label: 'Spent', align: 'right', render: (row) => formatCurrency(row.cost, locale) },
              ]}
              rows={report.current.byBook.map((row) => ({ ...row, key: row.code }))}
            />
          </Card>
        )}
      </div>

      <Card
        title="Repairs raised in this period"
        subtitle={`${report.current.total} jobs`}
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
            { label: 'Assigned', render: (row) => row.assignedTo ?? '—' },
            { label: 'Reported', render: (row) => formatDate(row.reportedAt, locale) },
            {
              label: 'Cost',
              align: 'right',
              render: (row) =>
                row.actualCost === null ? '—' : formatCurrency(row.actualCost, locale),
            },
            {
              label: 'Turnaround',
              align: 'right',
              render: (row) => (row.turnaround === null ? '—' : `${row.turnaround}d`),
            },
            { label: 'Status', render: (row) => <Pill tone={STATUS_BADGE[row.status]}>{row.status}</Pill> },
          ]}
          rows={report.current.rows.map((row) => ({ ...row, key: row.id }))}
          empty="No repairs were raised in this period."
        />
      </Card>
    </div>
  )
}
