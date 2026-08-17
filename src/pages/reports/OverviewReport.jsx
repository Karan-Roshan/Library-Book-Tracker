// The whole library in one page of figures.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatCurrency, formatMonth, formatNumber } from '../../lib/format.js'
import {
  change,
  circulationBy,
  circulationReport,
  fineReport,
  inventoryReport,
  memberActivity,
  overdueReport,
  periodicStats,
  previousRange,
  repairReport,
} from '../../lib/reports.js'
import {
  ChartCard,
  Delta,
  ExportBar,
  Figure,
  RangePicker,
  RankChart,
  TrendChart,
} from '../../components/reports/ReportKit.jsx'
import { useReports } from './ReportsLayout.jsx'

export default function OverviewReport() {
  const { data, state } = useReports()
  const { locale } = usePreferences()
  const { range, granularity } = state

  const report = useMemo(() => {
    const before = previousRange(range)

    const circulation = circulationReport({ borrowings: data.borrowings, reservations: data.reservations, range })
    const priorCirculation = circulationReport({
      borrowings: data.borrowings,
      reservations: data.reservations,
      range: before,
    })
    const money = fineReport({
      fineRecords: data.fineRecords,
      lost: data.lost,
      repairs: data.repairs,
      range,
    })
    const priorMoney = fineReport({
      fineRecords: data.fineRecords,
      lost: data.lost,
      repairs: data.repairs,
      range: before,
    })

    return {
      circulation,
      money,
      issuedChange: change(circulation.issued, priorCirculation.issued),
      collectedChange: change(money.collected, priorMoney.collected),
      overdue: overdueReport({ borrowings: data.borrowings }),
      inventory: inventoryReport({
        books: data.books,
        borrowings: data.borrowings,
        reservations: data.reservations,
        repairs: data.repairs,
        lost: data.lost,
      }),
      members: memberActivity({ borrowings: data.borrowings, members: data.members, range }),
      repairs: repairReport({ repairs: data.repairs, range }),
      categories: circulationBy(data.borrowings, range, 'category'),
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
            title="Library overview"
            filename={`library-overview-${range.from.toISOString().slice(0, 10)}`}
            columns={[
              ['Period', (row) => label(row)],
              ['Issued', (row) => row.issued],
              ['Returned', (row) => row.returned],
              ['Renewals', (row) => row.renewals],
              ['Reservations', (row) => row.reservations],
              ['New members', (row) => row.newMembers],
              ['New books', (row) => row.newBooks],
              ['Fines generated', (row) => row.finesGenerated],
              ['Fines collected', (row) => row.finesCollected],
              ['Repairs', (row) => row.repairs],
              ['Lost', (row) => row.lost],
            ]}
            rows={report.series}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Figure label="Total books" value={formatNumber(report.inventory.copies, locale)} hint={`${report.inventory.titles} titles`} />
        <Figure label="Active members" value={formatNumber(report.members.active, locale)} hint={`of ${report.members.total} registered`} />
        <Figure
          label="Books issued"
          value={formatNumber(report.circulation.issued, locale)}
          hint={<Delta change={report.issuedChange} />}
        />
        <Figure
          label="Overdue"
          value={formatNumber(report.overdue.count, locale)}
          tone={report.overdue.count > 0 ? 'bad' : undefined}
          hint={`${report.overdue.members} members`}
        />
        <Figure label="Pending fines" value={formatCurrency(report.money.pending, locale)} hint={`${report.money.pendingCount} unpaid`} />
        <Figure label="Repairs" value={formatNumber(report.repairs.active, locale)} hint="on the bench now" />
        <Figure label="Lost books" value={formatNumber(report.inventory.lostReports, locale)} hint="unrecovered" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Circulation trend"
          subtitle="Issues against returns — whether use is growing or falling."
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
              ]}
            />
          )}
        </ChartCard>

        <ChartCard title="Popular categories" subtitle="Where the borrowing actually goes.">
          {(view) => (
            <RankChart
              data={report.categories}
              view={view}
              locale={locale}
              caption="Times borrowed by category"
              valueLabel="Borrowings"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Fine collection"
          subtitle="Raised against taken. A widening gap is a collection problem."
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

        <ChartCard title="Repair statistics" subtitle="What breaks, and how often.">
          {(view) => (
            <RankChart
              data={report.repairs.damage}
              view={view}
              locale={locale}
              caption="Repairs by damage type"
              valueLabel="Repairs"
            />
          )}
        </ChartCard>

        <ChartCard
          title="New members and new books"
          subtitle="What the library gained over the period."
        >
          {(view) => (
            <TrendChart
              data={report.series}
              view={view}
              locale={locale}
              labelOf={label}
              caption="New members and accessions"
              series={[
                { key: 'newMembers', label: 'New members' },
                { key: 'newBooks', label: 'New books' },
              ]}
            />
          )}
        </ChartCard>
      </div>

      <nav className="no-print grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Circulation', '/reports/circulation', `${report.circulation.issued} issues this period`],
          ['Fines', '/reports/fines', `${formatCurrency(report.money.collected, locale)} collected`],
          ['Repairs', '/reports/repairs', `${report.repairs.active} on the bench`],
          ['Lost & damaged', '/reports/loss', `${report.inventory.lostReports} unrecovered`],
        ].map(([label, to, hint]) => (
          <Link
            key={to}
            to={to}
            className="rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md dark:border-ink-800 dark:bg-ink-900"
          >
            <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{label} report →</p>
            <p className="mt-0.5 text-xs text-ink-400">{hint}</p>
          </Link>
        ))}
      </nav>
    </div>
  )
}
