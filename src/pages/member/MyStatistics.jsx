// The member's own reading figures.

import { useMemo } from 'react'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatMonth, formatNumber } from '../../lib/format.js'
import { daysBetween } from '../../lib/circulation.js'
import { bucketSeries, resolveRange } from '../../lib/reports.js'
import { useMyLibrary } from '../../hooks/useMyLibrary.js'
import { ChartCard, RankChart, TrendChart } from '../../components/reports/ReportKit.jsx'
import { Card, Empty, PageHead, Tile } from './MemberKit.jsx'

export default function MyStatistics() {
  const { locale, system } = usePreferences()
  const my = useMyLibrary()

  const stats = useMemo(() => {
    const year = resolveRange('year', my.now)
    const returned = my.history.filter((borrowing) => borrowing.returnedAt)

    const durations = returned.map((borrowing) => daysBetween(borrowing.issuedAt, borrowing.returnedAt))
    const average = durations.length
      ? Math.round(durations.reduce((sum, days) => sum + days, 0) / durations.length)
      : null

    const byCategory = new Map()
    for (const borrowing of my.history) {
      const key = borrowing.bookCategory ?? '—'
      byCategory.set(key, (byCategory.get(key) ?? 0) + 1)
    }

    const byAuthor = new Map()
    for (const borrowing of my.history) {
      const key = borrowing.book?.author
      if (key) byAuthor.set(key, (byAuthor.get(key) ?? 0) + 1)
    }

    return {
      thisYear: my.history.filter(
        (borrowing) => new Date(borrowing.issuedAt) >= year.from && new Date(borrowing.issuedAt) <= year.to,
      ).length,
      total: my.history.length,
      returned: returned.length,
      renewals: my.history.reduce((sum, borrowing) => sum + borrowing.renewalCount, 0),
      reservations: my.reservations.length,
      onTime: returned.length
        ? Math.round(((returned.length - returned.filter((l) => l.daysOverdue > 0).length) / returned.length) * 100)
        : null,
      average,
      categories: [...byCategory.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      authors: [...byAuthor.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      series: bucketSeries({
        range: resolveRange('year', my.now),
        granularity: 'month',
        series: [
          { key: 'borrowed', rows: my.history, dateOf: (row) => row.issuedAt },
          { key: 'returned', rows: my.history, dateOf: (row) => row.returnedAt },
        ],
      }),
    }
  }, [my.history, my.reservations, my.now])

  if (my.loading) return <p className="py-20 text-center text-sm text-ink-400">Reading your account…</p>

  if (my.history.length === 0) {
    return (
      <div className="space-y-6">
        <PageHead title="My statistics" />
        <Empty title="Nothing to show yet">
          Once you have borrowed a few books, your reading habits will appear here.
        </Empty>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHead title="My statistics" subtitle="What your borrowing looks like over time." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Tile label="Books this year" value={formatNumber(stats.thisYear, locale)} />
        <Tile label="Books all time" value={formatNumber(stats.total, locale)} />
        <Tile label="Currently out" value={my.out.length} />
        <Tile label="Total renewals" value={stats.renewals} />
        <Tile label="Reservations" value={stats.reservations} />
        <Tile
          label="Returned on time"
          value={stats.onTime === null ? '—' : `${stats.onTime}%`}
          tone={stats.onTime !== null && stats.onTime >= 80 ? 'good' : 'warn'}
          hint={stats.average !== null ? `${stats.average} days average` : undefined}
        />
      </div>

      <ChartCard title="Books borrowed by month" subtitle="This year.">
        {(view) => (
          <TrendChart
            data={stats.series}
            view={view}
            locale={locale}
            labelOf={(row) => formatMonth(row.date, locale)}
            caption="Books borrowed and returned by month"
            series={[
              { key: 'borrowed', label: 'Borrowed' },
              { key: 'returned', label: 'Returned' },
            ]}
          />
        )}
      </ChartCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="My most borrowed categories" subtitle="Where your reading goes.">
          {(view) => (
            <RankChart
              data={stats.categories}
              view={view}
              locale={locale}
              caption="What I borrow, by category"
              valueLabel="Books"
            />
          )}
        </ChartCard>

        <ChartCard title="Authors you return to" subtitle="Most borrowed first.">
          {(view) => (
            <RankChart
              data={stats.authors}
              view={view}
              locale={locale}
              caption="What I borrow, by author"
              valueLabel="Books"
            />
          )}
        </ChartCard>
      </div>
    </div>
  )
}
