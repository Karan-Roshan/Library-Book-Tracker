// The trail showing where in the app you are.

import { Link, useLocation } from 'react-router-dom'

const LABELS = {
  dashboard: 'Dashboard',
  books: 'Books',
  add: 'Add Book',
  members: 'Members',
  repairs: 'Book Repairs',
  activity: 'Activity Log',
  circulation: 'Circulation',
  issue: 'Issue Book',
  return: 'Return Book',
  reservations: 'Reservations',
  overdue: 'Overdue Books',
  history: 'Borrowing History',
  lost: 'Lost Books',
  rules: 'Circulation Rules',
  reports: 'Reports & Analytics',
  settings: 'Settings',
  system: 'System Preferences',
  finance: 'Fines & Charges',
  notifications: 'Notifications',
  security: 'Security & Roles',
  data: 'Backup & Data',
  inventory: 'Books & Inventory',
  loss: 'Lost & Damaged',
  fines: 'Fine Management',
  complaints: 'Complaints',
  staff: 'Personnel',
  assistants: 'Library Assistants',
  profile: 'Profile',
}

const GROUP_LANDING = {
  '/staff': 'All Personnel',
  '/books': 'All Books',
}

const MENU_LABEL = {
  '/circulation/issue': 'Issue / Return',
  '/circulation/return': 'Issue / Return',
}

const titleCase = (segment) =>
  LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1)

export default function Breadcrumbs() {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  const landing = GROUP_LANDING[pathname] ?? null

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-ink-400">
        <li>
          <Link to="/dashboard" className="transition-colors hover:text-ink-700 dark:hover:text-ink-200">
            Home
          </Link>
        </li>
        {segments.map((segment, index) => {
          const to = `/${segments.slice(0, index + 1).join('/')}`
          const isLast = index === segments.length - 1 && !landing

          const isGroup = index === segments.length - 1 && Boolean(landing)
          return (
            <li key={to} className="flex items-center gap-1.5">
              <span aria-hidden="true">/</span>
              {isLast ? (
                <span className="font-medium text-ink-700 dark:text-ink-200" aria-current="page">
                  {MENU_LABEL[pathname] ?? titleCase(segment)}
                </span>
              ) : isGroup ? (
                <span>{titleCase(segment)}</span>
              ) : (
                <Link to={to} className="transition-colors hover:text-ink-700 dark:hover:text-ink-200">
                  {titleCase(segment)}
                </Link>
              )}
            </li>
          )
        })}

        {landing && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true">/</span>
            <span className="font-medium text-ink-700 dark:text-ink-200" aria-current="page">
              {landing}
            </span>
          </li>
        )}
      </ol>
    </nav>
  )
}
