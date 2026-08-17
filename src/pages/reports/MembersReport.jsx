// Who joined, who is active, and who has lapsed.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatDate, formatMonth, formatNumber } from '../../lib/format.js'
import {
  activeMembersReport,
  change,
  memberActivity,
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
  RankChart,
  ReportTable,
  TrendChart,
} from '../../components/reports/ReportKit.jsx'
import { useReports } from './ReportsLayout.jsx'

export default function MembersReport() {
  const { data, state } = useReports()
  const { locale } = usePreferences()
  const { range, granularity } = state

  const report = useMemo(() => {
    const activity = memberActivity({ borrowings: data.borrowings, members: data.members, range })
    const before = memberActivity({
      borrowings: data.borrowings,
      members: data.members,
      range: previousRange(range),
    })
    return {
      activity,
      activeChange: change(activity.active, before.active),
      joinedChange: change(activity.joined, before.joined),
      top: activeMembersReport({
        borrowings: data.borrowings,
        reservations: data.reservations,
        members: data.members,
        range,
        limit: 50,
      }),
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
            title="Most active members"
            filename={`active-members-${range.from.toISOString().slice(0, 10)}`}
            columns={[
              ['Member Name', (row) => row.name],
              ['Member ID', (row) => row.number],
              ['Status', (row) => row.status],
              ['Books Borrowed', (row) => row.borrowed],
              ['Books Returned', (row) => row.returned],
              ['Renewals', (row) => row.renewals],
              ['Reservations', (row) => row.reservations],
              ['Distinct Titles', (row) => row.distinctTitles],
              ['Currently Out', (row) => row.outstanding],
              ['Books Per Month', (row) => row.frequency],
            ]}
            rows={report.top}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Figure label="Registered members" value={formatNumber(report.activity.total, locale)} />
        <Figure
          label="Borrowed this period"
          value={formatNumber(report.activity.active, locale)}
          hint={<Delta change={report.activeChange} />}
        />
        <Figure
          label="Dormant"
          value={formatNumber(report.activity.dormant, locale)}
          hint="nothing borrowed in the period"
        />
        <Figure
          label="Joined"
          value={formatNumber(report.activity.joined, locale)}
          hint={<Delta change={report.joinedChange} />}
        />
        <Figure
          label="Lapsed memberships"
          value={formatNumber(report.activity.expired, locale)}
          tone={report.activity.expired > 0 ? 'bad' : undefined}
        />
        <Figure label="Suspended" value={formatNumber(report.activity.suspended, locale)} />
      </div>

      <div className="grid gap-6">
        <ChartCard title="New members over time" subtitle="Whether the membership is growing.">
          {(view) => (
            <TrendChart
              data={report.series}
              view={view}
              locale={locale}
              labelOf={label}
              caption="New members registered"
              series={[{ key: 'newMembers', label: 'New members' }]}
            />
          )}
        </ChartCard>
      </div>

      <Card
        title="Most active members"
        subtitle="Ranked on books borrowed — deliberately not on fines owed."
        padded={false}
      >
        <ReportTable
          columns={[
            {
              label: 'Member',
              render: (row) => (
                <Link
                  to={`/members/${row.memberId}`}
                  className="font-medium text-ink-800 hover:underline dark:text-ink-100"
                >
                  {row.name}
                </Link>
              ),
            },
            { label: 'Member ID', render: (row) => row.number },
            { label: 'Borrowed', align: 'right', render: (row) => row.borrowed },
            { label: 'Returned', align: 'right', render: (row) => row.returned },
            { label: 'Renewals', align: 'right', render: (row) => row.renewals },
            { label: 'Reservations', align: 'right', render: (row) => row.reservations },
            { label: 'Distinct titles', align: 'right', render: (row) => row.distinctTitles },
            { label: 'Out now', align: 'right', render: (row) => row.outstanding },
            { label: 'Books / month', align: 'right', render: (row) => row.frequency },
          ]}
          rows={report.top.map((row) => ({ ...row, key: row.memberId }))}
          empty="Nobody borrowed anything in this period."
        />
      </Card>
    </div>
  )
}
