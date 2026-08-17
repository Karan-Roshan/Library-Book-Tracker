// The frame and tab row shared by every report.

import { NavLink, Outlet, useOutletContext } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { CAPABILITIES, allowed } from '../../lib/permissions.js'
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx'
import { useReportData } from '../../hooks/useReportData.js'
import { useReportRange } from '../../components/reports/ReportKit.jsx'

const TABS = [
  { label: 'Overview', to: '/reports' },
  { label: 'Circulation', to: '/reports/circulation' },
  { label: 'Members', to: '/reports/members' },
  { label: 'Books & Inventory', to: '/reports/inventory' },
  { label: 'Fines', to: '/reports/fines' },
  { label: 'Repairs', to: '/reports/repairs' },
  { label: 'Lost & Damaged', to: '/reports/loss' },
  { label: 'Staff Activity', to: '/reports/staff', capability: CAPABILITIES.REPORTS_STAFF },
]

const tabClass = ({ isActive }) =>
  [

    'flex-1 basis-0 whitespace-nowrap rounded-lg px-2 py-2.5 text-center text-sm font-semibold transition-colors',
    isActive
      ? 'bg-ink-900 text-white dark:bg-brass-600'
      : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100',
  ].join(' ')

export default function ReportsLayout() {
  const { user } = useAuth()
  const data = useReportData()
  const state = useReportRange(data.now)

  const tabs = allowed(user, TABS)

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs />
        <h1 className="mt-1 font-display text-2xl font-bold text-ink-900 dark:text-white">
          Reports &amp; Analytics
        </h1>
      </div>

      <nav
        aria-label="Reports"
        className="no-print flex w-full gap-1 overflow-x-auto rounded-xl border border-ink-100 bg-white p-1 shadow-sm dark:border-ink-800 dark:bg-ink-900"
      >
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={tabClass} end>
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {data.loading ? (
        <p className="py-20 text-center text-sm text-ink-400">Reading the register…</p>
      ) : (
        <Outlet context={{ data, state }} />
      )}
    </div>
  )
}

export const useReports = () => useOutletContext()
