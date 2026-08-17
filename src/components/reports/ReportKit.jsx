// The pieces every report shares: tables, tiles, period bars.

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSettings } from '../../context/SettingsContext.jsx'
import {
  AXIS,
  ChartLegend,
  ChartTable,
  ChartTooltip,
  GRID,
  SERIES,
  SURFACE,
  niceTicks,
  useChartSize,
} from '../charts/chartKit.jsx'
import Card from '../dashboard/Card.jsx'
import { formatNumber } from '../../lib/format.js'
import { GRANULARITIES, RANGES, resolveRange } from '../../lib/reports.js'
import { downloadFile, toCSV } from '../../lib/csv.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { CAPABILITIES, can } from '../../lib/permissions.js'
import { SELECT, SELECT_ARROW, INPUT } from '../circulation/Shared.jsx'

export function useReportRange(now) {
  const [params, setParams] = useSearchParams()
  const { settings } = useSettings()

  const key = params.get('range') ?? settings.system.reportPeriod ?? 'quarter'
  const from = params.get('from')
  const to = params.get('to')
  const granularity = params.get('by') ?? 'month'

  const range = resolveRange(key, now, {
    from: from ? new Date(from) : null,
    to: to ? new Date(to) : null,
  })

  const set = (patch) => {
    const next = new URLSearchParams(params)
    for (const [name, value] of Object.entries(patch)) {
      if (value === null || value === undefined || value === '') next.delete(name)
      else next.set(name, value)
    }
    setParams(next, { replace: true })
  }

  return { key, range, granularity, from, to, set }
}

const dateValue = (date) => new Date(date).toISOString().slice(0, 10)

export function RangePicker({ state, showGranularity = false, extra = null }) {
  const { key, range, granularity, from, to, set } = state

  return (
    <div className="no-print flex w-full flex-wrap items-end gap-4 rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-sm dark:border-ink-800 dark:bg-ink-900">
      <div>
        <label htmlFor="report-range" className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
          Period
        </label>
        <select
          id="report-range"
          value={key}
          onChange={(event) => set({ range: event.target.value })}
          style={SELECT_ARROW}
          className={`${SELECT} w-48`}
        >
          {RANGES.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {key === 'custom' && (
        <>
          <div>
            <label htmlFor="report-from" className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
              From
            </label>
            <input
              id="report-from"
              type="date"
              value={from ?? dateValue(range.from)}
              onChange={(event) => set({ from: event.target.value })}
              className={`${INPUT} w-44`}
            />
          </div>
          <div>
            <label htmlFor="report-to" className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
              To
            </label>
            <input
              id="report-to"
              type="date"
              value={to ?? dateValue(range.to)}
              onChange={(event) => set({ to: event.target.value })}
              className={`${INPUT} w-44`}
            />
          </div>
        </>
      )}

      {showGranularity && (
        <div>
          <label htmlFor="report-by" className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
            Grouped by
          </label>
          <select
            id="report-by"
            value={granularity}
            onChange={(event) => set({ by: event.target.value })}
            style={SELECT_ARROW}
            className={`${SELECT} w-40`}
          >
            {GRANULARITIES.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {extra && <div className="ml-auto self-center">{extra}</div>}
    </div>
  )
}

export function ExportBar({ filename, columns, rows, title }) {
  const { user } = useAuth()

  return (
    <div className="no-print flex gap-2">
      {can(user, CAPABILITIES.EXPORT) && (
      <button
        type="button"
        onClick={() => downloadFile(`${filename}.csv`, toCSV(rows, columns))}
        disabled={rows.length === 0}
        className="rounded-lg border border-ink-200 px-3.5 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:cursor-not-allowed disabled:text-ink-300 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
      >
        Export CSV
      </button>
      )}
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-ink-900 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-800 dark:bg-ink-700 dark:hover:bg-ink-600"
        title={`Print or save ${title} as PDF`}
      >
        Print / PDF
      </button>
    </div>
  )
}

export function Figure({ label, value, hint, tone }) {
  const tones = {
    good: 'text-emerald-700 dark:text-emerald-400',
    bad: 'text-red-600 dark:text-red-400',
  }
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-sm dark:border-ink-800 dark:bg-ink-900">
      <p className="text-sm font-bold leading-snug text-ink-600 dark:text-ink-300">{label}</p>
      <p className={`mt-2 text-2xl font-semibold leading-none ${tones[tone] ?? 'text-ink-900 dark:text-white'}`}>
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-ink-400">{hint}</p>}
    </div>
  )
}

export function Delta({ change: delta, suffix = 'vs previous period' }) {
  if (!delta || delta.percent === null) return null
  const tone =
    delta.direction === 'up'
      ? 'text-emerald-700 dark:text-emerald-400'
      : delta.direction === 'down'
        ? 'text-red-600 dark:text-red-400'
        : 'text-ink-400'
  const arrow = delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '—'
  return (
    <span className={tone}>
      {arrow} {Math.abs(delta.percent)}% {suffix}
    </span>
  )
}

export function ChartCard({ title, subtitle, children, className = '' }) {
  const [view, setView] = useState('chart')

  return (
    <Card
      title={title}
      subtitle={subtitle}
      className={className}
      action={
        <div
          role="group"
          aria-label="Chart view"
          className="no-print flex shrink-0 rounded-lg border border-ink-100 p-0.5 dark:border-ink-700"
        >
          {['chart', 'table'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              aria-pressed={view === option}
              className={`rounded-[0.4rem] px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                view === option
                  ? 'bg-ink-900 text-white dark:bg-brass-600'
                  : 'text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      }
    >
      {children(view)}
    </Card>
  )
}

const HEIGHT = 250
const MARGIN = { top: 14, right: 16, bottom: 30, left: 48 }

export function TrendChart({ data, series, view, locale, labelOf, caption, format = formatNumber }) {
  const { ref, width } = useChartSize(HEIGHT)
  const [hovered, setHovered] = useState(null)

  if (view === 'table') {
    return (
      <ChartTable
        caption={caption}
        columns={['Period', ...series.map((entry) => entry.label)]}
        rows={data.map((row) => [
          labelOf(row),
          ...series.map((entry) => format(row[entry.key], locale)),
        ])}
      />
    )
  }

  const height = HEIGHT
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotHeight = height - MARGIN.top - MARGIN.bottom
  const max = Math.max(1, ...data.flatMap((row) => series.map((entry) => row[entry.key] ?? 0)))
  const ticks = niceTicks(max)
  const ceiling = ticks[ticks.length - 1] || 1

  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0
  const pointAt = (index, value) => ({
    x: MARGIN.left + (data.length > 1 ? index * stepX : plotWidth / 2),
    y: MARGIN.top + plotHeight - ((value ?? 0) / ceiling) * plotHeight,
  })

  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotWidth / 64))))

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${caption}. ${series
            .map((entry) => `${entry.label}: ${data.map((row) => row[entry.key]).join(', ')}`)
            .join('. ')}`}
        >
          {ticks.map((tick) => {
            const y = MARGIN.top + plotHeight - (tick / ceiling) * plotHeight
            return (
              <g key={tick}>
                <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y} y2={y} stroke={GRID} strokeWidth="1" />
                <text x={MARGIN.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill={AXIS}>
                  {format(tick, locale)}
                </text>
              </g>
            )
          })}

          {series.map((entry, order) => {
            const colour = entry.color ?? SERIES[order % SERIES.length]
            const points = data.map((row, index) => pointAt(index, row[entry.key]))

            return (
              <g key={entry.key}>
                {points.length > 1 && (
                  <polyline
                    points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                    fill="none"
                    stroke={colour}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {points.map((point, index) => (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r={points.length > 40 ? 0 : 3}
                    fill={SURFACE}
                    stroke={colour}
                    strokeWidth="2"
                  />
                ))}
              </g>
            )
          })}

          {data.map((row, index) => {
            const point = pointAt(index, 0)
            return (
              <g key={row.key}>
                {index % labelEvery === 0 && (
                  <text
                    x={point.x}
                    y={height - 10}
                    textAnchor="middle"
                    fontSize="11"
                    fill={AXIS}
                  >
                    {labelOf(row)}
                  </text>
                )}

                <rect
                  x={point.x - (stepX || plotWidth) / 2}
                  y={MARGIN.top}
                  width={stepX || plotWidth}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() =>
                    setHovered({
                      x: point.x,
                      y: MARGIN.top + plotHeight / 2,
                      flip: point.x > width * 0.6,
                      title: labelOf(row),
                      rows: series.map((entry, order) => ({
                        label: entry.label,
                        value: format(row[entry.key] ?? 0, locale),
                        color: entry.color ?? SERIES[order % SERIES.length],
                      })),
                    })
                  }
                  onMouseLeave={() => setHovered(null)}
                />
              </g>
            )
          })}
        </svg>
      )}

      <ChartTooltip point={hovered} />
      <div className="mt-3">
        <ChartLegend
          items={series.map((entry, order) => ({
            label: entry.label,
            color: entry.color ?? SERIES[order % SERIES.length],
          }))}
        />
      </div>
    </div>
  )
}

const ROW = 34
const LABEL_WIDTH = 150
const VALUE_WIDTH = 64

export function RankChart({ data, view, locale, caption, valueLabel = 'Count', format = formatNumber }) {
  const rows = data.slice(0, 10)
  const { ref, width } = useChartSize(rows.length * ROW)

  if (view === 'table') {
    return (
      <ChartTable
        caption={caption}
        columns={[caption.split(' by')[0] || 'Item', valueLabel]}
        rows={data.map((row) => [row.label, format(row.count, locale)])}
      />
    )
  }

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-400">Nothing to show for this period.</p>
  }

  const height = rows.length * ROW
  const track = Math.max(0, width - LABEL_WIDTH - VALUE_WIDTH)
  const max = Math.max(1, ...rows.map((row) => row.count))

  return (
    <div ref={ref}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${caption}: ${rows.map((row) => `${row.label} ${row.count}`).join(', ')}`}
        >
          {rows.map((row, index) => {
            const y = index * ROW
            const barWidth = Math.max(2, (row.count / max) * track)
            return (
              <g key={row.label}>
                <text x={0} y={y + ROW / 2 + 4} fontSize="12" fill={AXIS}>
                  {row.label.length > 22 ? `${row.label.slice(0, 21)}…` : row.label}
                </text>
                <rect
                  x={LABEL_WIDTH}
                  y={y + 7}
                  width={barWidth}
                  height={ROW - 16}
                  rx="3"
                  fill={SERIES[index % SERIES.length]}
                />
                <text
                  x={LABEL_WIDTH + barWidth + 8}
                  y={y + ROW / 2 + 4}
                  fontSize="12"
                  fill={AXIS}
                  className="tabular-nums"
                >
                  {format(row.count, locale)}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

export function ReportTable({ columns, rows, empty = 'Nothing to report for this period.' }) {
  if (rows.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-ink-400">{empty}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-ink-900 text-left text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-white dark:bg-ink-950">
            {columns.map((column) => (
              <th
                key={column.label}
                className={`whitespace-nowrap px-4 py-3 ${column.align === 'right' ? 'text-right' : ''}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.key ?? index}
              className={`border-b border-ink-100 dark:border-ink-800 ${
                index % 2 === 0 ? 'bg-white dark:bg-ink-900' : 'bg-ink-50 dark:bg-ink-800'
              }`}
            >
              {columns.map((column) => (
                <td
                  key={column.label}

                  className={`whitespace-nowrap px-4 py-3 ${
                    column.align === 'right'
                      ? 'text-right tabular-nums text-ink-800 dark:text-ink-100'
                      : 'text-ink-600 dark:text-ink-300'
                  }`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
