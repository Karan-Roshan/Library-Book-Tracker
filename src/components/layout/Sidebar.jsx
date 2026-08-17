// The main menu, filtered to what your role may reach.

import { useCallback, useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Wordmark } from '../Logo.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { CAPABILITIES, ROLE_LABELS, allowed } from '../../lib/permissions.js'

const icon = (path) => (
  <svg viewBox="0 0 20 20" className="h-[1.05rem] w-[1.05rem] shrink-0" fill="none" aria-hidden="true">
    <path d={path} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ICONS = {
  dashboard: 'M3.5 3.5h5.5v5.5H3.5zM11 3.5h5.5v3.5H11zM11 9h5.5v7.5H11zM3.5 11h5.5v5.5H3.5z',
  books: 'M4 4.5h5a2 2 0 012 2v9a1.6 1.6 0 00-1.6-1.6H4zM16 4.5h-5a2 2 0 00-2 2v9a1.6 1.6 0 011.6-1.6H16z',
  members: 'M13 16.5v-1.2a3 3 0 00-3-3H6a3 3 0 00-3 3v1.2M8 9.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17 16.5v-1.2a3 3 0 00-2.2-2.9M12.5 4.7a3 3 0 010 5.8',
  fines: 'M10 3.5v13M13 6.5H8.5a2 2 0 000 4h3a2 2 0 010 4H6.5',
  notifications: 'M10 3.5a4 4 0 00-4 4v3l-1.2 2.2h10.4L14 10.5v-3a4 4 0 00-4-4zM8.3 15a1.8 1.8 0 003.4 0',
  profile: 'M10 10a3 3 0 100-6 3 3 0 000 6zM4 16.5c0-2.5 2.7-4 6-4s6 1.5 6 4',
  logout: 'M12 6.5V4.5h-8v11h8v-2M9 10h8m0 0l-2.5-2.5M17 10l-2.5 2.5',
  activity: 'M3 10h3l2-5 3 10 2.5-5H17',
  search: 'M9 15a6 6 0 100-12 6 6 0 000 12zM13.5 13.5L17 17',
  reserve: 'M6 3.5h8v13l-4-3-4 3z',
  complaints:
    'M4 5.5h12a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3H4A1.5 1.5 0 0 1 2.5 13V7A1.5 1.5 0 0 1 4 5.5ZM10 8v2.5M10 12.2v.1',
  circulation: 'M4 7.5h9m0 0L10.5 5M13 7.5L10.5 10M16 12.5H7m0 0L9.5 10M7 12.5L9.5 15',
  reports: 'M3.5 16.5h13M6 14V8.5M10 14V4.5M14 14v-6',
  settings: 'M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM16 10a6 6 0 00-.1-1l1.4-1.1-1.5-2.6-1.7.6a6 6 0 00-1.7-1L12.1 3H9.1l-.3 1.9a6 6 0 00-1.7 1l-1.7-.6L3.9 7.9 5.3 9a6 6 0 000 2l-1.4 1.1 1.5 2.6 1.7-.6a6 6 0 001.7 1l.3 1.9h3l.3-1.9a6 6 0 001.7-1l1.7.6 1.5-2.6L15.9 11a6 6 0 00.1-1z',
  staff: 'M7 9.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM2.5 16v-1a3 3 0 013-3h3a3 3 0 013 3v1M14 7.5v5M16.5 10h-5',
}

const MEMBER_NAV = [
  { label: 'Dashboard', to: '/my', icon: ICONS.dashboard },
  {
    label: 'My Library',
    icon: ICONS.books,
    children: [
      { label: 'Currently Issued', to: '/my/books' },
      { label: 'Due & Overdue', to: '/my/due' },
      { label: 'Borrowing History', to: '/my/history' },
    ],
  },
  {
    label: 'Explore',
    icon: ICONS.search,
    children: [
      { label: 'Browse Books', to: '/my/browse' },
      { label: 'Categories', to: '/my/categories' },
    ],
  },
  { label: 'My Reservations', to: '/my/reservations', icon: ICONS.reserve },
  { label: 'My Fines', to: '/my/fines', icon: ICONS.fines },
  { label: 'My Complaints', to: '/my/complaints', icon: ICONS.complaints },
  { label: 'Notifications', to: '/my/notifications', icon: ICONS.notifications },
  { label: 'My Statistics', to: '/my/statistics', icon: ICONS.reports },
  {
    label: 'My Account',
    icon: ICONS.profile,
    children: [
      { label: 'Profile & Membership', to: '/my/profile' },
      { label: 'Account Settings', to: '/my/settings' },
    ],
  },
]

const NAV = [
  { label: 'Dashboard', to: '/dashboard', icon: ICONS.dashboard },

  {
    label: 'Personnel',
    icon: ICONS.staff,
    capability: CAPABILITIES.ACCOUNTS,
    children: [
      { label: 'All Personnel', to: '/staff' },
      { label: 'Library Assistants', to: '/staff/assistants' },
    ],
  },

  { label: 'Members', to: '/members', icon: ICONS.members },

  {
    label: 'Circulation',
    icon: ICONS.circulation,
    children: [

      {
        label: 'Issue / Return',
        to: '/circulation/issue',
        matches: ['/circulation/issue', '/circulation/return'],
      },
      { label: 'Reservations', to: '/circulation/reservations' },
      { label: 'Overdue Books', to: '/circulation/overdue' },
    ],
  },
  {
    label: 'Books',
    icon: ICONS.books,
    children: [
      { label: 'All Books', to: '/books' },
      { label: 'Add Book', to: '/books/add' },
      { label: 'Book Repairs', to: '/books/repairs' },
    ],
  },
  {
    label: 'Fine Management',
    to: '/fines',
    icon: ICONS.fines,
    capability: CAPABILITIES.FINES,
  },
  {
    label: 'Complaints',
    to: '/complaints',
    icon: ICONS.complaints,
    capability: CAPABILITIES.COMPLAINTS,
  },

  {
    label: 'Reports & Analytics',
    to: '/reports',
    icon: ICONS.reports,
    capability: CAPABILITIES.REPORTS,
    matchChildren: true,
  },
  {
    label: 'Activity Log',
    to: '/activity',
    icon: ICONS.activity,
    capability: CAPABILITIES.ACTIVITY,
  },
  { label: 'Notifications', to: '/notifications', icon: ICONS.notifications },

  {
    label: 'Settings',
    to: '/settings',
    icon: ICONS.settings,
    capability: CAPABILITIES.SETTINGS,
    matchChildren: true,
  },
  { label: 'Profile', to: '/profile', icon: ICONS.profile },
]

const pathsOf = (child) => child.matches ?? [child.to]

const leafClass = ({ isActive }) =>
  [
    'block rounded-lg py-2 pl-11 pr-3 text-sm transition-colors',
    isActive
      ? 'bg-brass-500/12 font-semibold text-brass-200'
      : 'text-ink-300 hover:bg-white/5 hover:text-white',
  ].join(' ')

const topClass = ({ isActive }) =>
  [
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-brass-500/12 font-semibold text-brass-200'
      : 'text-ink-300 hover:bg-white/5 hover:text-white',
  ].join(' ')

export default function Sidebar({ onNavigate }) {
  const location = useLocation()
  const { user, signOut } = useAuth()

  const nav = allowed(user, user?.role === 'member' ? MEMBER_NAV : NAV)

  const groupFor = useCallback(
    (pathname) =>
      (user?.role === 'member' ? MEMBER_NAV : NAV).find((item) =>
        item.children?.some((child) => pathsOf(child).some((path) => pathname.startsWith(path))),
      )?.label ?? null,
    [user?.role],
  )

  const [open, setOpen] = useState(() => groupFor(location.pathname))

  useEffect(() => {
    setOpen(groupFor(location.pathname))
  }, [location.pathname, groupFor])

  return (
    <div className="flex h-full flex-col bg-ink-950">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Wordmark tone="light" />
      </div>

      <p className="mb-2 px-5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-brass-400/80">
        {user?.role === 'member' ? 'My Library' : (ROLE_LABELS[user?.role] ?? 'Member')}
      </p>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {nav.map((item) =>
          item.children ? (
            <div key={item.label}>
              <button
                type="button"
                onClick={() => setOpen((current) => (current === item.label ? null : item.label))}
                aria-expanded={open === item.label}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                {icon(item.icon)}
                {item.label}
                <svg
                  viewBox="0 0 20 20"
                  className={`ml-auto h-4 w-4 transition-transform duration-200 ${
                    open === item.label ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M8 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              {open === item.label && (
                <div className="mt-1 space-y-1">
                  {allowed(user, item.children).map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      onClick={onNavigate}
                      end

                      className={
                        child.matches
                          ? leafClass({
                              isActive: child.matches.some((path) =>
                                location.pathname.startsWith(path),
                              ),
                            })
                          : leafClass
                      }
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              className={topClass}
              onClick={onNavigate}

              end={!item.matchChildren}
            >
              {icon(item.icon)}
              {item.label}
            </NavLink>
          ),
        )}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">

        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/15 hover:text-red-300"
        >
          {icon(ICONS.logout)}
          Logout
        </button>
      </div>
    </div>
  )
}
