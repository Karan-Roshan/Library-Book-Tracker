// Stands in for a screen that has not been built yet.

import { Link, useLocation } from 'react-router-dom'
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx'

export default function PlaceholderPage({ title, description }) {
  const { pathname } = useLocation()

  return (
    <div>
      <Breadcrumbs />
      <div className="mt-6 rounded-xl border border-dashed border-ink-200 bg-white p-10 text-center dark:border-ink-700 dark:bg-ink-900">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brass-50 text-brass-600 dark:bg-brass-500/10 dark:text-brass-300">
          <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none" aria-hidden="true">
            <path
              d="M10 6v5m0 3h.01M10 2.5l7.5 13H2.5z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="mt-4 font-display text-2xl text-ink-900 dark:text-white">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-500 dark:text-ink-400">
          {description ??
            'This module has not been built yet. The route exists so the navigation is complete and honest about what works.'}
        </p>
        <p className="mt-4 font-mono text-xs text-ink-400">{pathname}</p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-800 dark:bg-brass-600 dark:hover:bg-brass-500"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
