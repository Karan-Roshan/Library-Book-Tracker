// A filled line chart, drawn as plain SVG.

import { useState } from 'react'
import {
  AXIS,
  GRID,
  SERIES,
  SURFACE,
  ChartLegend,
  ChartTable,
  ChartTooltip,
  niceTicks,
  useChartSize,
} from './chartKit.jsx'
import { formatNumber, formatWeekday } from '../../lib/format.js'

const HEIGHT = 230
const MARGIN = { top: 12, right: 52, bottom: 28, left: 40 }
const LABEL_MIN_GAP = 14

export default function AreaChart({ data, view = 'chart', locale }) {
  const { ref, width } = useChartSize(HEIGHT)
  const [hovered, setHovered] = useState(null)

  const series = [
    { key: 'issued', label: 'Books issued', color: SERIES[0] },
    { key: 'returned', label: 'Returns', color: SERIES[1] },
    { key: 'newMembers', label: 'New members', color: SERIES[2] },
  ]

  if (view === 'table') {
    return (
      <ChartTable
        caption="Activity over the last seven days"
        columns={['Day', 'Issued', 'Returns', 'New members']}
        rows={data.map((row) => [
          formatWeekday(row.date, locale),
          formatNumber(row.issued, locale),
          formatNumber(row.returned, locale),
          formatNumber(row.newMembers, locale),
        ])}
      />
    )
  }

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const max = Math.max(1, ...data.flatMap((row) => series.map((s) => row[s.key])))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const scaleX = (index) => (data.length === 1 ? 0 : (index / (data.length - 1)) * plotWidth)
  const scaleY = (value) => plotHeight - (value / top) * plotHeight

  const shapes = series.map((entry) => {
    const points = data.map((row, index) => [scaleX(index), scaleY(row[entry.key])])
    return {
      ...entry,
      points,
      line: points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' '),
      area: `M ${points[0][0]} ${plotHeight} ${points
        .map(([x, y]) => `L ${x} ${y}`)
        .join(' ')} L ${points[points.length - 1][0]} ${plotHeight} Z`,
      endValue: data[data.length - 1][entry.key],
    }
  })

  const endYs = shapes.map((shape) => shape.points[shape.points.length - 1][1]).sort((a, b) => a - b)
  const labelsFit = endYs.every(
    (y, index) => index === 0 || y - endYs[index - 1] >= LABEL_MIN_GAP,
  )

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
            aria-label="Books issued, returns, and new members over the last seven days"
            onMouseLeave={() => setHovered(null)}
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

              {shapes.map((shape) => (
                <path key={`area-${shape.key}`} d={shape.area} fill={shape.color} opacity={0.1} />
              ))}
              {shapes.map((shape) => (
                <path
                  key={`line-${shape.key}`}
                  d={shape.line}
                  fill="none"
                  stroke={shape.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {hovered !== null && (
                <line
                  x1={scaleX(hovered)}
                  x2={scaleX(hovered)}
                  y1={0}
                  y2={plotHeight}
                  stroke={AXIS}
                  strokeWidth={1}
                />
              )}

              {shapes.map((shape) => {
                const [x, y] = shape.points[shape.points.length - 1]
                return (
                  <g key={`end-${shape.key}`}>
                    {hovered !== null && (
                      <circle
                        cx={scaleX(hovered)}
                        cy={scaleY(data[hovered][shape.key])}
                        r={4.5}
                        fill={shape.color}
                        stroke={SURFACE}
                        strokeWidth={2}
                      />
                    )}
                    {labelsFit && (
                      <text
                        x={x + 10}
                        y={y}
                        dominantBaseline="middle"
                        className="fill-ink-500 text-[11px] font-semibold tabular-nums dark:fill-ink-200"
                      >
                        {formatNumber(shape.endValue, locale)}
                      </text>
                    )}
                  </g>
                )
              })}

              {data.map((row, index) => (
                <g key={row.date}>
                  <text
                    x={scaleX(index)}
                    y={plotHeight + 18}
                    textAnchor="middle"
                    className="fill-ink-400 text-[11px]"
                  >
                    {formatWeekday(row.date, locale)}
                  </text>
                  <rect
                    x={scaleX(index) - plotWidth / (data.length * 2)}
                    y={0}
                    width={plotWidth / data.length}
                    height={plotHeight}
                    fill="transparent"
                    onMouseEnter={() => setHovered(index)}
                  />
                </g>
              ))}
            </g>
          </svg>
        )}

        <ChartTooltip
          point={
            hovered !== null && {
              x: MARGIN.left + scaleX(hovered),
              y: MARGIN.top + plotHeight / 2,
              flip: scaleX(hovered) > plotWidth * 0.6,
              title: formatWeekday(data[hovered].date, locale),
              rows: series.map((entry) => ({
                label: entry.label,
                value: formatNumber(data[hovered][entry.key], locale),
                color: entry.color,
              })),
            }
          }
        />
      </div>
    </div>
  )
}
