// What the library holds, and how much of it is out.

import { useMemo, useState } from 'react'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatNumber } from '../../lib/format.js'
import { inventoryReport, popularBooksReport } from '../../lib/reports.js'
import Card from '../../components/dashboard/Card.jsx'
import DonutChart from '../../components/charts/DonutChart.jsx'
import {
  ChartCard,
  ExportBar,
  Figure,
  RangePicker,
  RankChart,
  ReportTable,
} from '../../components/reports/ReportKit.jsx'
import { INPUT } from '../../components/circulation/Shared.jsx'
import { useReports } from './ReportsLayout.jsx'

export default function InventoryReport() {
  const { data, state } = useReports()
  const { locale } = usePreferences()
  const { range } = state
  const [query, setQuery] = useState('')

  const report = useMemo(
    () => ({
      inventory: inventoryReport({
        books: data.books,
        borrowings: data.borrowings,
        reservations: data.reservations,
        repairs: data.repairs,
        lost: data.lost,
      }),
      popular: popularBooksReport({
        borrowings: data.borrowings,
        reservations: data.reservations,
        range,
        limit: 50,
      }),
    }),
    [data, range],
  )

  const categories = useMemo(() => {
    const term = query.trim().toLowerCase()
    return report.inventory.byCategory.filter(
      (row) => !term || row.label.toLowerCase().includes(term),
    )
  }, [report.inventory.byCategory, query])

  const status = [
    { label: 'Available', value: report.inventory.available },
    { label: 'Borrowed', value: report.inventory.issued },
    { label: 'Under repair', value: report.inventory.underRepair },
    { label: 'Lost', value: report.inventory.lost + report.inventory.lostReports },
    { label: 'Withdrawn', value: report.inventory.withdrawn },
  ].filter((row) => row.value > 0)

  return (
    <div className="space-y-6">
      <RangePicker
        state={state}
        extra={
          <ExportBar
            title="Inventory report"
            filename={`inventory-${range.to.toISOString().slice(0, 10)}`}
            columns={[
              ['Category', (row) => row.label],
              ['Titles', (row) => row.titles],
              ['Copies', (row) => row.copies],
              ['Available', (row) => row.available],
              ['Issued', (row) => row.outNow],
              ['Under Repair', (row) => row.repairing],
            ]}
            rows={report.inventory.byCategory}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <Figure label="Titles" value={formatNumber(report.inventory.titles, locale)} />
        <Figure label="Total copies" value={formatNumber(report.inventory.copies, locale)} />
        <Figure label="Available" value={formatNumber(report.inventory.available, locale)} tone="good" />
        <Figure label="Borrowed" value={formatNumber(report.inventory.issued, locale)} />
        <Figure label="Reserved" value={formatNumber(report.inventory.reserved, locale)} hint="held for collection" />
        <Figure label="Under repair" value={formatNumber(report.inventory.underRepair, locale)} />
        <Figure
          label="Lost"
          value={formatNumber(report.inventory.lost + report.inventory.lostReports, locale)}
          tone="bad"
        />
        <Figure label="Withdrawn" value={formatNumber(report.inventory.withdrawn, locale)} hint="beyond repair" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Where every copy is" subtitle="The collection, accounted for.">
          {(view) => <DonutChart data={status} view={view} locale={locale} totalLabel="copies" />}
        </ChartCard>

        <ChartCard title="Collection by category" subtitle="Copies held, largest section first.">
          {(view) => (
            <RankChart
              data={[...report.inventory.byCategory]
                .map((row) => ({ label: row.label, count: row.copies }))
                .sort((a, b) => b.count - a.count)}
              view={view}
              locale={locale}
              caption="Copies by category"
              valueLabel="Copies"
            />
          )}
        </ChartCard>
      </div>

      <Card title="Category breakdown" subtitle="Every section, and how much of it is on the shelf." padded={false}>
        <div className="no-print px-4 py-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter categories…"
            className={`${INPUT} max-w-xs`}
            aria-label="Filter categories"
          />
        </div>
        <ReportTable
          columns={[
            { label: 'Category', render: (row) => row.label },
            { label: 'Titles', align: 'right', render: (row) => formatNumber(row.titles, locale) },
            { label: 'Copies', align: 'right', render: (row) => formatNumber(row.copies, locale) },
            { label: 'Available', align: 'right', render: (row) => formatNumber(row.available, locale) },
            { label: 'Borrowed', align: 'right', render: (row) => formatNumber(row.outNow, locale) },
            { label: 'Under repair', align: 'right', render: (row) => formatNumber(row.repairing, locale) },
            {
              label: 'On shelf',
              align: 'right',
              render: (row) => `${Math.round((row.available / Math.max(1, row.copies)) * 100)}%`,
            },
          ]}
          rows={categories.map((row) => ({ ...row, key: row.label }))}
        />
      </Card>

      <Card
        title="Popular books"
        subtitle="Demand per copy is the figure that says whether to buy another."
        padded={false}
      >
        <ReportTable
          columns={[
            { label: '#', render: (row) => row.rank },
            { label: 'Book', render: (row) => row.title },
            { label: 'Book ID', render: (row) => row.code },
            { label: 'Category', render: (row) => row.category },
            { label: 'Issues', align: 'right', render: (row) => row.issues },
            { label: 'Renewals', align: 'right', render: (row) => row.renewals },
            { label: 'Reservations', align: 'right', render: (row) => row.reservations },
            { label: 'Unique members', align: 'right', render: (row) => row.uniqueMembers },
            { label: 'Days out', align: 'right', render: (row) => row.days },
            { label: 'Copies', align: 'right', render: (row) => row.copies },
            {
              label: 'Demand / copy',
              align: 'right',
              render: (row) => (
                <span className={row.pressure >= 8 ? 'font-semibold text-red-600 dark:text-red-400' : ''}>
                  {row.pressure}
                </span>
              ),
            },
          ]}
          rows={report.popular.map((row, index) => ({ ...row, rank: index + 1, key: row.bookId }))}
          empty="Nothing was borrowed in this period."
        />
      </Card>
    </div>
  )
}
