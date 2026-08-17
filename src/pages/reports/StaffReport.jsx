// What each member of staff did — the administrator's view only.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatDate, formatNumber } from '../../lib/format.js'
import { ROLE_LABELS } from '../../lib/permissions.js'
import { staffReport } from '../../lib/reports.js'
import Card from '../../components/dashboard/Card.jsx'
import {
  ChartCard,
  ExportBar,
  Figure,
  RangePicker,
  RankChart,
  ReportTable,
} from '../../components/reports/ReportKit.jsx'
import { useReports } from './ReportsLayout.jsx'

export default function StaffReport() {
  const { data, state } = useReports()
  const { locale } = usePreferences()
  const { range } = state

  const report = useMemo(
    () => staffReport({ activity: data.activity, range }),
    [data.activity, range],
  )

  return (
    <div className="space-y-6">
      <RangePicker
        state={state}
        extra={
          <ExportBar
            title="Staff activity report"
            filename={`staff-activity-${range.from.toISOString().slice(0, 10)}`}
            columns={[
              ['Staff Name', (row) => row.name],
              ['Staff ID', (row) => row.staffNumber ?? ''],
              ['Role', (row) => ROLE_LABELS[row.role] ?? row.role ?? ''],
              ['Total Actions', (row) => row.total],
              ['Logins', (row) => row.logins],
              ['Books Issued', (row) => row.issued],
              ['Books Returned', (row) => row.returned],
              ['Renewals', (row) => row.renewals],
              ['Reservations', (row) => row.reservations],
              ['Members Added', (row) => row.membersAdded],
              ['Fines Raised', (row) => row.finesRaised],
              ['Fines Collected', (row) => row.finesCollected],
              ['Repairs Raised', (row) => row.repairsRaised],
              ['Repairs Managed', (row) => row.repairsManaged],
              ['Notifications Sent', (row) => row.notifications],
              ['Reminders Sent', (row) => row.reminders],
              ['Failed Actions', (row) => row.failed],
              ['Last Seen', (row) => row.lastSeen?.slice(0, 10) ?? ''],
            ]}
            rows={report.staff}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Actions recorded" value={formatNumber(report.entries, locale)} />
        <Figure label="Staff active" value={formatNumber(report.staff.length, locale)} />
        <Figure
          label="Failed actions"
          value={formatNumber(report.failed, locale)}
          tone={report.failed > 0 ? 'bad' : 'good'}
          hint="mostly failed sign-ins"
        />
        <Figure
          label="Busiest module"
          value={report.byModule[0]?.label ?? '—'}
          hint={report.byModule[0] ? `${report.byModule[0].count} actions` : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Work by staff member" subtitle="Total recorded actions in the period.">
          {(view) => (
            <RankChart
              data={report.staff.map((row) => ({ label: row.name, count: row.total }))}
              view={view}
              locale={locale}
              caption="Actions by staff member"
              valueLabel="Actions"
            />
          )}
        </ChartCard>

        <ChartCard title="Where the work happens" subtitle="Actions by module.">
          {(view) => (
            <RankChart
              data={report.byModule}
              view={view}
              locale={locale}
              caption="Actions by module"
              valueLabel="Actions"
            />
          )}
        </ChartCard>
      </div>

      <Card
        title="Staff summary"
        subtitle="What each person did, rather than every line they wrote."
        padded={false}
      >
        <ReportTable
          columns={[
            { label: 'Staff', render: (row) => row.name },
            { label: 'Role', render: (row) => ROLE_LABELS[row.role] ?? row.role ?? '—' },
            { label: 'Issued', align: 'right', render: (row) => row.issued },
            { label: 'Returned', align: 'right', render: (row) => row.returned },
            { label: 'Renewals', align: 'right', render: (row) => row.renewals },
            { label: 'Members added', align: 'right', render: (row) => row.membersAdded },
            { label: 'Fines collected', align: 'right', render: (row) => row.finesCollected },
            { label: 'Repairs managed', align: 'right', render: (row) => row.repairsRaised + row.repairsManaged },
            { label: 'Notices sent', align: 'right', render: (row) => row.notifications + row.reminders },
            { label: 'Total actions', align: 'right', render: (row) => row.total },
            { label: 'Last seen', render: (row) => formatDate(row.lastSeen, locale) },
          ]}
          rows={report.staff.map((row) => ({ ...row, key: row.name }))}
          empty="No staff activity was recorded in this period."
        />
      </Card>

      <p className="no-print text-sm text-ink-400">
        This is a roll-up. The line-by-line record — including previous and new values — lives in the{' '}
        <Link to="/activity" className="font-semibold text-brass-700 hover:underline dark:text-brass-300">
          Activity Log
        </Link>
        , which is append-only and cannot be edited.
      </p>
    </div>
  )
}
