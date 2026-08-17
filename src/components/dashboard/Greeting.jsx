// The greeting, the date and a ticking clock.

import { useEffect, useState } from 'react'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatLongDate, formatTime, greeting } from '../../lib/format.js'

export default function Greeting({ name, subtitle }) {
  const { locale, system } = usePreferences()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const [weekday, ...rest] = formatLongDate(now, locale, system).split(', ')

  return (
    <section className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-sm dark:border-ink-800 dark:bg-ink-900">

      <div aria-hidden="true" className="h-1 bg-gradient-to-r from-brass-600 via-brass-400 to-brass-600" />

      <div className="flex flex-wrap items-center justify-between gap-6 px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-tight text-ink-900 dark:text-white">
            {greeting(now)}
            {name ? (
              <>
                , <span className="text-brass-700 dark:text-brass-300">{name.split(' ')[0]}</span>
              </>
            ) : null}
          </p>
          {subtitle && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
        </div>

        <div className="text-right">

          <p className="font-display text-3xl leading-none tabular-nums text-ink-900 dark:text-white">
            {formatTime(now, locale, system)}
          </p>
          <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">
            <span className="font-semibold text-ink-700 dark:text-ink-200">{weekday}</span>
            {rest.length > 0 && <span> · {rest.join(', ')}</span>}
          </p>
        </div>
      </div>
    </section>
  )
}
