// A short table of what happened lately.

import { useMemo, useState } from 'react'
import Card from '../dashboard/Card.jsx'
import FilterMenu from '../FilterMenu.jsx'
import { stripeFor } from './Shared.jsx'

const ROW_HEIGHT = 44
export const VISIBLE_ROWS = 10

export default function RecentTable({
  title,
  subtitle,
  rows,
  columns,
  empty,
  apply,
  cleared,
  fields,
  placeholder,
  noun = 'records',
}) {
  const [filters, setFilters] = useState(cleared ?? { query: '' })
  const set = (key, value) => setFilters((current) => ({ ...current, [key]: value }))

  const visible = useMemo(() => (apply ? apply(rows, filters) : rows), [rows, filters, apply])

  return (
    <Card
      title={title}
      subtitle={
        <>
          {subtitle}

          <span className="mt-0.5 block">
            {visible.length} {noun}
          </span>
        </>
      }
      padded={false}
      action={
        cleared && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              type="search"
              value={filters.query}
              onChange={(event) => set('query', event.target.value)}
              placeholder={placeholder}
              aria-label={`Search ${noun}`}
              className="h-9 w-44 min-w-0 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brass-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white sm:w-64"
            />
            <FilterMenu values={filters} onChange={set} cleared={cleared} fields={fields} />
          </div>
        )
      }
    >
      {visible.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-400">
          {rows.length === 0 ? empty : 'Nothing matches these filters.'}
        </p>
      ) : (
        <div
          className="overflow-auto"
          style={{ maxHeight: ROW_HEIGHT * VISIBLE_ROWS + ROW_HEIGHT }}
        >
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-ink-900 text-left text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-white dark:bg-ink-950">
                {columns.map((column) => (
                  <th
                    key={column.label}
                    className={`whitespace-nowrap px-4 py-3 ${
                      column.align === 'right' ? 'text-right' : ''
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => (
                <tr
                  key={row.key ?? row.id}
                  className={`border-b border-ink-100 transition-colors hover:bg-brass-50 dark:border-ink-800 dark:hover:bg-ink-800 ${stripeFor(index)}`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.label}
                      className={`whitespace-nowrap px-4 py-3 text-ink-600 dark:text-ink-300 ${
                        column.align === 'right' ? 'text-right' : ''
                      }`}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
