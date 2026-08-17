// The pieces every chart shares: axes, scales, colours, sizing.

import { useEffect, useState } from 'react'

export const SERIES = [
  'var(--viz-series-1)',
  'var(--viz-series-2)',
  'var(--viz-series-3)',
  'var(--viz-series-4)',
  'var(--viz-series-5)',
]

export const SURFACE = 'var(--viz-surface)'
export const GRID = 'var(--viz-grid)'
export const AXIS = 'var(--viz-axis)'

export function useChartSize(height) {
  const [node, setNode] = useState(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!node) return undefined

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(node)
    setWidth(Math.round(node.getBoundingClientRect().width))
    return () => observer.disconnect()
  }, [node])

  return { ref: setNode, width, height }
}

export function niceTicks(max, count = 4) {
  if (max <= 0) return [0]
  const rawStep = max / count
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? magnitude
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}

export function ChartLegend({ items }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-xs text-ink-500 dark:text-ink-300">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export function ChartTooltip({ point }) {
  if (!point) return null
  const flip = point.flip ?? false

  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-[8.5rem] -translate-y-1/2 rounded-lg border border-ink-100 bg-white px-3 py-2 text-xs shadow-lg dark:border-ink-700 dark:bg-ink-800"
      style={{
        left: point.x,
        top: point.y,
        transform: `translate(${flip ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
      }}
    >
      <p className="font-semibold text-ink-900 dark:text-white">{point.title}</p>
      <ul className="mt-1 space-y-0.5">
        {point.rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2 whitespace-nowrap">
            {row.color && (
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: row.color }}
              />
            )}
            <span className="text-ink-500 dark:text-ink-300">{row.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-ink-900 dark:text-white">
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ChartTable({ caption, columns, rows }) {
  return (
    <div className="max-h-64 overflow-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-white dark:bg-ink-900">
          <tr className="border-b border-ink-100 dark:border-ink-700">
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={`py-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-400 ${
                  index === 0 ? 'text-left' : 'text-right'
                }`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-b border-ink-50 last:border-0 dark:border-ink-800">
              {row.map((cell, index) => (
                <td
                  key={index}
                  className={`py-2 ${
                    index === 0
                      ? 'text-left text-ink-700 dark:text-ink-200'
                      : 'text-right tabular-nums text-ink-900 dark:text-white'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
