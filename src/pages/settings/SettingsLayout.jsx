// The frame and section list shared by every settings screen.

import { NavLink, Outlet } from 'react-router-dom'
import Breadcrumbs from '../../components/layout/Breadcrumbs.jsx'

const GROUPS = [
  {
    title: 'General',
    items: [
      { label: 'Library Information', to: '/settings' },
      { label: 'System Preferences', to: '/settings/system' },
    ],
  },
  {
    title: 'Circulation',
    items: [{ label: 'Borrowing & Renewal Rules', to: '/settings/circulation' }],
  },
]

const linkClass = ({ isActive }) =>
  [
    'block rounded-lg px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-brass-500/12 font-semibold text-brass-800 dark:text-brass-300'
      : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white',
  ].join(' ')

export default function SettingsLayout() {
  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs />
        <h1 className="mt-1 font-display text-2xl font-bold text-ink-900 dark:text-white">
          Settings
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <nav aria-label="Settings sections" className="space-y-5">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink-400">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.to} to={item.to} className={linkClass} end>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
