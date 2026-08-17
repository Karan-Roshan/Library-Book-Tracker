// A history table with its own search, filters, paging and export.

import { useEffect, useMemo, useState } from 'react'
import Card from '../dashboard/Card.jsx'
import FilterMenu from '../FilterMenu.jsx'
import { usePageSize } from '../../hooks/useTablePrefs.js'
import { downloadFile, toCSV } from '../../lib/csv.js'
import { Action, Empty, Pager, stripeFor } from './Shared.jsx'

const PAGE_SIZES = [25, 50, 100]

export default function History({
  title,
  subtitle,
  rows,
  columns,
  csv,
  filename,
  placeholder,
  fields,
  cleared,
  apply,
  mayExport = false,
  noun = 'records',
  empty = 'Nothing recorded yet.',
}) {
  const [filters, setFilters] = useState(cleared)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePageSize(PAGE_SIZES)

  const visible = useMemo(() => apply(rows, filters), [rows, filters, apply])

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const safePage = Math.min(page, totalPages)
  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  const paged = visible.slice((safePage - 1) * pageSize, safePage * pageSize)

  const set = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

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

          {mayExport && (
            <Action
              tone="ink"
              onClick={() => downloadFile(filename, toCSV(visible, csv))}
              disabled={visible.length === 0}
            >
              Export CSV
            </Action>
          )}
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-ink-900 text-left text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-white dark:bg-ink-950">
              {columns.map((column) => (
                <th key={column.label} className="whitespace-nowrap px-4 py-3">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, index) => (
              <tr
                key={row.key}
                className={`border-b border-ink-100 transition-colors hover:bg-brass-50 dark:border-ink-800 dark:hover:bg-ink-800 ${stripeFor(index)}`}
              >
                {columns.map((column) => (
                  <td
                    key={column.label}
                    className={`px-4 py-3 text-ink-600 dark:text-ink-300 ${
                      column.wrap ? '' : 'whitespace-nowrap'
                    }`}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {visible.length === 0 && <Empty>{empty}</Empty>}
      </div>

      <Pager
        page={safePage}
        totalPages={totalPages}
        total={visible.length}
        first={(safePage - 1) * pageSize + 1}
        last={Math.min(safePage * pageSize, visible.length)}
        pageSize={pageSize}
        sizes={PAGE_SIZES}
        onPage={setPage}
        onSize={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />
    </Card>
  )
}
