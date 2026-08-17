// Bars side by side, for comparing two series.

import { useState } from 'react'
import {
  AXIS,
  GRID,
  SERIES,
  ChartLegend,
  ChartTable,
  ChartTooltip,
  niceTicks,
  useChartSize,
} from './chartKit.jsx'
import { formatMonth, formatNumber } from '../../lib/format.js'

const HEIGHT = 260
const MARGIN = { top: 12, right: 8, bottom: 30, left: 44 }
const MAX_BAR = 24
const BAR_GAP = 2

function columnPath(x, y, width, height, radius = 4) {
  const r = Math.min(radius, width / 2, height)
  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${y + height}`,
    'Z',
  ].join(' ')
}

export default function GroupedBarChart({ data, view = 'chart', locale }) {
  const { ref, width } = useChartSize(HEIGHT)
  const [hovered, setHovered] = useState(null)

  const series = [
    { key: 'issued', label: 'Books issued', color: SERIES[0] },
    { key: 'returned', label: 'Books returned', color: SERIES[1] },
  ]

  if (view === 'table') {
    return (
      <ChartTable
        caption="Monthly issues and returns"
        columns={['Month', 'Issued', 'Returned']}
        rows={data.map((row) => [
          formatMonth(row.date, locale),
          formatNumber(row.issued, locale),
          formatNumber(row.returned, locale),
        ])}
      />
    )
  }

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const max = Math.max(1, ...data.flatMap((row) => [row.issued, row.returned]))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const scaleY = (value) => plotHeight - (value / top) * plotHeight
  const band = plotWidth / data.length
  const barWidth = Math.max(3, Math.min(MAX_BAR, (band - 16 - BAR_GAP) / 2))

  return (
    <div>
      <div className="mb-4">
        <ChartLegend items={series} />
      </div>

      <div ref={ref} className="relative">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label="Books issued and returned by month over the last twelve months"
          >
            <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={0}
                    x2={plotWidth}
                    y1={scaleY(tick)}
                    y2={scaleY(tick)}
                    stroke={tick === 0 ? AXIS : GRID}
                    strokeWidth={1}
                  />
                  <text
                    x={-10}
                    y={scaleY(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-ink-400 text-[11px] tabular-nums"
                  >
                    {formatNumber(tick, locale)}
                  </text>
                </g>
              ))}

              {data.map((row, index) => {
                const bandX = index * band
                const groupWidth = barWidth * 2 + BAR_GAP
                const startX = bandX + (band - groupWidth) / 2
                const active = hovered?.index === index

                return (
                  <g key={row.date}>
                    {series.map((entry, seriesIndex) => {
                      const value = row[entry.key]
                      const barHeight = Math.max(0, plotHeight - scaleY(value))
                      return (
                        <path
                          key={entry.key}
                          d={columnPath(
                            startX + seriesIndex * (barWidth + BAR_GAP),
                            scaleY(value),
                            barWidth,
                            barHeight,
                          )}
                          fill={entry.color}
                          opacity={hovered && !active ? 0.4 : 1}
                          className="transition-opacity duration-150"
                        />
                      )
                    })}

                    <text
                      x={bandX + band / 2}
                      y={plotHeight + 20}
                      textAnchor="middle"
                      className="fill-ink-400 text-[11px]"
                    >
                      {formatMonth(row.date, locale)}
                    </text>

                    <rect
                      x={bandX}
                      y={0}
                      width={band}
                      height={plotHeight}
                      fill="transparent"
                      onMouseEnter={() =>
                        setHovered({
                          index,
                          x: MARGIN.left + bandX + band / 2,
                          y: MARGIN.top + plotHeight / 2,
                          row,
                        })
                      }
                      onMouseLeave={() => setHovered(null)}
                    />
                  </g>
                )
              })}
            </g>
          </svg>
        )}

        <ChartTooltip
          point={
            hovered && {
              x: hovered.x,
              y: hovered.y,
              flip: hovered.x > width * 0.7,
              title: formatMonth(hovered.row.date, locale),
              rows: series.map((entry) => ({
                label: entry.label,
                value: formatNumber(hovered.row[entry.key], locale),
                color: entry.color,
              })),
            }
          }
        />
      </div>
    </div>
  )
}
