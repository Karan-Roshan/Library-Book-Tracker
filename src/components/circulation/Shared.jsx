// The shared pieces of the desk screens: inputs, lookups, badges, paging.

import { useMemo, useState } from 'react'
import { useDismiss } from '../../hooks/useDismiss.js'

export const LABEL =
  'mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400'

export const INPUT =
  'w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-white'

export const READONLY =
  'w-full cursor-not-allowed rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-2.5 text-[0.95rem] text-ink-600 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-300'

export const SELECT = `${INPUT} appearance-none bg-[length:1.1rem] bg-[position:right_1.2rem_center] bg-no-repeat pr-14`

export const SELECT_ARROW = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M6 8l4 4 4-4' stroke='%236b7280' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
}

export const HEAD =
  'bg-ink-900 text-left text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-white dark:bg-ink-950'

export const CELL = 'whitespace-nowrap px-4 py-3 text-ink-600 dark:text-ink-300'

export const stripeFor = (index) =>
  index % 2 === 0 ? 'bg-white dark:bg-ink-900' : 'bg-ink-50 dark:bg-ink-800'

export const ROW_HOVER = 'hover:bg-brass-50 dark:hover:bg-ink-800'

export function Pill({ tone, children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {children}
    </span>
  )
}

export function Action({ children, tone = 'brass', ...props }) {
  const tones = {
    brass: 'bg-brass-600 text-white hover:bg-brass-500 disabled:bg-brass-200',

    gold: 'bg-brass-500 text-white hover:bg-brass-400 disabled:bg-brass-200',
    red: 'bg-red-600 text-white hover:bg-red-500 disabled:bg-red-200',
    ink: 'border border-ink-200 text-ink-700 hover:bg-ink-50 disabled:text-ink-300 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800',
  }
  return (
    <button
      type="button"
      {...props}
      className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${tones[tone]}`}
    >
      {children}
    </button>
  )
}

export function Verdict({ result }) {
  if (!result) return null
  const { blocks = [], warnings = [] } = result

  if (!blocks.length && !warnings.length) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        All checks passed.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {blocks.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
        >
          <p className="font-semibold">Cannot go ahead</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {blocks.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="font-semibold">Worth knowing</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {warnings.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function Facts({ legend, rows }) {
  return (
    <fieldset className="rounded-lg border border-ink-100 p-4 dark:border-ink-800">
      <legend className="px-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
        {legend}
      </legend>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows
          .filter(([, value]) => value !== undefined)
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-ink-400">{label}</dt>
              <dd className="text-sm font-medium text-ink-800 dark:text-ink-100">{value ?? '—'}</dd>
            </div>
          ))}
      </dl>
    </fieldset>
  )
}

export function Lookup({ label, placeholder, items, value, onSelect, describe, search, autoFocus, required }) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase()
    if (!needle) return []
    return items
      .filter((item) => search(item).some((field) => String(field ?? '').toLowerCase().includes(needle)))
      .slice(0, 8)
  }, [term, items, search])

  return (
    <div className="relative" ref={ref}>
      <label className={LABEL}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-brass-300 bg-brass-50/60 px-3.5 py-2.5 dark:border-brass-500/40 dark:bg-brass-500/10">
          <span className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">
            {describe(value)}
          </span>
          <button
            type="button"
            onClick={() => {
              onSelect(null)
              setTerm('')
            }}
            className="shrink-0 text-xs font-semibold text-brass-700 hover:underline dark:text-brass-300"
          >
            Change
          </button>
        </div>
      ) : (
        <input
          type="search"
          value={term}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(event) => {
            setTerm(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          className={INPUT}
        />
      )}

      {open && !value && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lg dark:border-ink-700 dark:bg-ink-800">
          {matches.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(item)
                  setOpen(false)
                  setTerm('')
                }}
                className="block w-full px-3.5 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-brass-50 dark:text-ink-200 dark:hover:bg-ink-700"
              >
                {describe(item)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !value && term.trim() && matches.length === 0 && (
        <p className="absolute z-30 mt-1 w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-400 shadow-lg dark:border-ink-700 dark:bg-ink-800">
          Nothing matched “{term.trim()}”.
        </p>
      )}
    </div>
  )
}

export function Pager({ page, totalPages, total, first, last, pageSize, sizes, onPage, onSize }) {
  if (total === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ink-100 px-4 py-3 dark:border-ink-800">

      <div className="flex flex-wrap items-center gap-4">
        <p className="text-sm text-ink-400">
          Showing {first}–{last} of {total}
        </p>

        <label className="flex items-center gap-2 text-sm text-ink-400">
          Rows
          <select
            value={pageSize}
            onChange={(event) => onSize(Number(event.target.value))}
            style={SELECT_ARROW}
            className="appearance-none rounded-lg border border-ink-200 bg-white bg-[length:0.9rem] bg-[position:right_0.75rem_center] bg-no-repeat py-1.5 pl-3 pr-9 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
          >
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-lg bg-ink-900 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-200 dark:disabled:bg-ink-800 dark:disabled:text-ink-600"
          >
            ‹
          </button>
          <span className="px-1 text-sm text-ink-500 dark:text-ink-300">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-lg bg-ink-900 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-200 dark:disabled:bg-ink-800 dark:disabled:text-ink-600"
          >
            ›
          </button>
      </div>
    </div>
  )
}

export function Empty({ children }) {
  return <p className="px-4 py-10 text-center text-sm text-ink-400">{children}</p>
}
