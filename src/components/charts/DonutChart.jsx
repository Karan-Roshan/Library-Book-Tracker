// A ring chart for shares of a whole.

import { useState } from 'react'
import { SERIES, ChartTable, ChartTooltip } from './chartKit.jsx'
import { formatNumber } from '../../lib/format.js'

const SIZE = 200
const OUTER = 92
const INNER = 62
const GAP_PX = 2

const polar = (angle, radius) => ({
  x: SIZE / 2 + radius * Math.cos(angle - Math.PI / 2),
  y: SIZE / 2 + radius * Math.sin(angle - Math.PI / 2),
})

function segmentPath(startAngle, endAngle) {
  const large = endAngle - startAngle > Math.PI ? 1 : 0
  const outerStart = polar(startAngle, OUTER)
  const outerEnd = polar(endAngle, OUTER)
  const innerEnd = polar(endAngle, INNER)
  const innerStart = polar(startAngle, INNER)

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

export default function DonutChart({ data, view = 'chart', locale, totalLabel = 'copies' }) {
  const [hovered, setHovered] = useState(null)
  const total = data.reduce((sum, item) => sum + item.value, 0)

  if (view === 'table') {
    return (
      <ChartTable
        caption="Book status breakdown"
        columns={['Status', 'Copies', 'Share']}
        rows={data.map((item) => [
          item.label,
          formatNumber(item.value, locale),
          `${((item.value / total) * 100).toFixed(1)}%`,
        ])}
      />
    )
  }

  const padAngle = GAP_PX / ((OUTER + INNER) / 2)
  let cursor = 0
  const segments = data.map((item, index) => {
    const sweep = total > 0 ? (item.value / total) * Math.PI * 2 : 0
    const start = cursor
    cursor += sweep
    return {
      ...item,
      color: SERIES[index % SERIES.length],

      path: segmentPath(start + padAngle / 2, Math.max(start + padAngle, cursor - padAngle / 2)),
      share: total > 0 ? (item.value / total) * 100 : 0,
    }
  })

  return (
    <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative shrink-0">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-[200px] w-[200px]"
          role="img"
          aria-label={`Book status: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}
        >
          {segments.map((segment) => (
            <path
              key={segment.key}
              d={segment.path}
              fill={segment.color}
              opacity={hovered && hovered.key !== segment.key ? 0.35 : 1}
              className="transition-opacity duration-150"
              onMouseEnter={() => setHovered(segment)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[1.6rem] font-semibold leading-none text-ink-900 dark:text-white">
            {formatNumber(total, locale)}
          </span>
          <span className="mt-1 text-xs text-ink-400">{totalLabel}</span>
        </div>
      </div>

      <ul className="w-full space-y-2.5">
        {segments.map((segment) => (
          <li
            key={segment.key}
            className="flex items-center gap-3 text-sm"
            onMouseEnter={() => setHovered(segment)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: segment.color }}
            />
            <span className="text-ink-600 dark:text-ink-300">{segment.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-ink-900 dark:text-white">
              {formatNumber(segment.value, locale)}
            </span>
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-ink-400">
              {segment.share.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>

      <ChartTooltip
        point={
          hovered && {
            x: 100,
            y: 100,
            title: hovered.label,
            rows: [
              {
                label: 'Copies',
                value: formatNumber(hovered.value, locale),
                color: hovered.color,
              },
              { label: 'Share', value: `${hovered.share.toFixed(1)}%` },
            ],
          }
        }
      />
    </div>
  )
}
