// Every filter on a page, folded behind one button with a count.

import { useCallback, useState } from 'react'
import { useDismiss } from '../hooks/useDismiss.js'
import { INPUT, SELECT, SELECT_ARROW } from './circulation/Shared.jsx'

const FUNNEL = (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
    <path
      d="M3.5 4.5h13l-5 5.5v5l-3 1.5v-6.5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
)

export default function FilterMenu({ fields, values, onChange, cleared, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)

  const active = fields.filter((field) => values[field.key] !== cleared[field.key])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${
          active.length
            ? 'border-brass-300 bg-brass-50 text-brass-800 dark:border-brass-500/40 dark:bg-brass-500/10 dark:text-brass-300'
            : 'border-ink-200 text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800'
        }`}
      >
        {FUNNEL}
        Filters
        {active.length > 0 && (
          <span className="rounded-full bg-brass-600 px-1.5 text-[0.7rem] font-bold text-white">
            {active.length}
          </span>
        )}
        <svg
          viewBox="0 0 20 20"
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          className={`animate-rise absolute z-30 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-xl border border-ink-100 bg-white p-4 shadow-xl dark:border-ink-800 dark:bg-ink-900 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >

          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {fields.map((field) => (
              <div key={field.key}>
                <label
                  htmlFor={`filter-${field.key}`}
                  className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400"
                >
                  {field.label}
                </label>

                {field.type === 'date' ? (

                  <input
                    id={`filter-${field.key}`}
                    type="date"
                    value={values[field.key]}
                    onChange={(event) => onChange(field.key, event.target.value)}
                    className={INPUT}
                  />
                ) : (
                  <select
                    id={`filter-${field.key}`}
                    value={values[field.key]}
                    onChange={(event) => onChange(field.key, event.target.value)}
                    style={SELECT_ARROW}
                    className={SELECT}
                  >
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink-100 pt-3 dark:border-ink-800">
            <span className="text-xs text-ink-400">
              {active.length ? `${active.length} applied` : 'None applied'}
            </span>
            <button
              type="button"
              onClick={() => fields.forEach((field) => onChange(field.key, cleared[field.key]))}
              disabled={!active.length}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-50 disabled:opacity-40 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
