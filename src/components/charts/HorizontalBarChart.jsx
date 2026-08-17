// Bars running left to right, for ranked lists.

import { useState } from 'react'
import { SERIES, ChartTable, ChartTooltip, useChartSize } from './chartKit.jsx'
import { formatNumber } from '../../lib/format.js'

const ROW = 34
const BAR = 16
const LABEL_WIDTH = 88
const VALUE_WIDTH = 52

function barPath(x, y, width, height, radius = 4) {
  const r = Math.min(radius, width, height / 2)
  return [
    `M ${x} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${y + height - r}`,
    `Q ${x + width} ${y + height} ${x + width - r} ${y + height}`,
    `L ${x} ${y + height}`,
    'Z',
  ].join(' ')
}

export default function HorizontalBarChart({ data, view = 'chart', locale, unit = 'borrowings' }) {
  const { ref, width } = useChartSize(data.length * ROW)
  const [hovered, setHovered] = useState(null)

  if (view === 'table') {
    return (
      <ChartTable
        caption="Times borrowed by category"
        columns={['Category', 'Times borrowed']}
        rows={data.map((row) => [row.category, formatNumber(row.count, locale)])}
      />
    )
  }

  const height = data.length * ROW
  const trackWidth = Math.max(0, width - LABEL_WIDTH - VALUE_WIDTH)
  const max = Math.max(1, ...data.map((row) => row.count))

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Times borrowed by category: ${data
            .map((row) => `${row.category} ${row.count}`)
            .join(', ')}`}
        >
          {data.map((row, index) => {
            const y = index * ROW
            const barWidth = Math.max(2, (row.count / max) * trackWidth)
            return (
              <g
                key={row.category}
                onMouseEnter={() =>
                  setHovered({ ...row, x: LABEL_WIDTH + barWidth, y: y + ROW / 2 })
                }
                onMouseLeave={() => setHovered(null)}
              >
                <text
                  x={0}
                  y={y + ROW / 2}
                  dominantBaseline="middle"
                  className="fill-ink-600 text-[12px] dark:fill-ink-300"
                >
                  {row.category}
                </text>
                <path
                  d={barPath(LABEL_WIDTH, y + (ROW - BAR) / 2, barWidth, BAR)}
                  fill={SERIES[0]}
                  opacity={hovered && hovered.category !== row.category ? 0.45 : 1}
                  className="transition-opacity duration-150"
                />
                <text
                  x={LABEL_WIDTH + barWidth + 10}
                  y={y + ROW / 2}
                  dominantBaseline="middle"
                  className="fill-ink-500 text-[12px] font-semibold tabular-nums dark:fill-ink-200"
                >
                  {formatNumber(row.count, locale)}
                </text>
                <rect x={0} y={y} width={width} height={ROW} fill="transparent" />
              </g>
            )
          })}
        </svg>
      )}

      <ChartTooltip
        point={
          hovered && {
            x: hovered.x,
            y: hovered.y,
            flip: hovered.x > width * 0.6,
            title: hovered.category,
            rows: [
              {
                label: unit,
                value: formatNumber(hovered.count, locale),
                color: SERIES[0],
              },
            ],
          }
        }
      />
    </div>
  )
}
