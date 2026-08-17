// The two-panel frame the sign-in and setup screens sit in.

import BrandPanel from './BrandPanel.jsx'
import { Wordmark } from './Logo.jsx'

export default function AuthLayout({ eyebrow, title, subtitle, children, footer, tabs = null }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] xl:grid-cols-2">
      <BrandPanel />

      <main className="flex min-h-dvh flex-col lg:min-h-0">

        <div className="flex items-center justify-between border-b border-ink-100 bg-white px-6 py-4 lg:hidden dark:border-ink-800 dark:bg-ink-900">
          <Wordmark />
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
            Library System
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:py-12">
          <div className="animate-rise w-full max-w-[28rem]">
            <header className={tabs ? 'mb-6 text-center' : 'mb-8'}>
              {eyebrow && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brass-600">
                  {eyebrow}
                </p>
              )}
              <h2 className="font-display text-[2rem] leading-tight text-ink-900 dark:text-white">
                {title}
              </h2>

              {subtitle && (
                <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-500 dark:text-ink-400">
                  {subtitle}
                </p>
              )}
            </header>

            {tabs ? (
              <div className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-lg dark:border-ink-800 dark:bg-ink-900">
                {tabs}
                <div className="px-6 py-6 sm:px-7">{children}</div>
              </div>
            ) : (
              children
            )}

            {footer && (
              <div className="mt-8 border-t border-ink-100 pt-6 dark:border-ink-800">{footer}</div>
            )}
          </div>
        </div>

        <footer className="px-6 pb-8 text-center text-xs text-ink-400 sm:px-10">
          © {new Date().getFullYear()} Athenaeum Library Management System
        </footer>
      </main>
    </div>
  )
}
