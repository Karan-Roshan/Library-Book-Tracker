// The month at a glance, with what is due on each day.

import { formatDate } from '../../lib/format.js'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const MARK_STYLES = {
  due: 'bg-[var(--viz-series-2)]',
  reservation: 'bg-[var(--viz-series-1)]',
  event: 'bg-[var(--viz-series-3)]',
  holiday: 'bg-red-500',
}

const LEGEND = [
  { kind: 'due', label: 'Due dates' },
  { kind: 'reservation', label: 'Reservations' },
  { kind: 'event', label: 'Events' },
  { kind: 'holiday', label: 'Holidays' },
]

export default function CalendarWidget({ calendar, locale, now }) {
  const todayDate = now.getDate()

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day, index) => (
          <span key={index} className="pb-1 text-[0.65rem] font-semibold uppercase text-ink-400">
            {day}
          </span>
        ))}

        {Array.from({ length: calendar.leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}

        {Array.from({ length: calendar.daysInMonth }, (_, index) => {
          const day = index + 1
          const marks = [...(calendar.marks.get(day) ?? [])]
          const isToday = day === todayDate

          return (
            <div
              key={day}
              className={`flex h-9 flex-col items-center justify-center rounded-lg text-xs tabular-nums ${
                isToday
                  ? 'bg-ink-900 font-semibold text-white dark:bg-brass-600'
                  : 'text-ink-600 dark:text-ink-300'
              }`}
            >
              <span>{day}</span>
              <span className="mt-0.5 flex h-1 gap-0.5">
                {marks.slice(0, 3).map((kind) => (
                  <span
                    key={kind}
                    className={`h-1 w-1 rounded-full ${MARK_STYLES[kind] ?? 'bg-ink-300'}`}
                    title={kind}
                  />
                ))}
              </span>
            </div>
          )
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-ink-50 pt-3 dark:border-ink-800">
        {LEGEND.map((item) => (
          <li key={item.kind} className="flex items-center gap-1.5 text-[0.7rem] text-ink-400">
            <span className={`h-1.5 w-1.5 rounded-full ${MARK_STYLES[item.kind]}`} />
            {item.label}
          </li>
        ))}
      </ul>

      {calendar.events.length > 0 && (
        <ul className="mt-3 space-y-2">
          {calendar.events.map((event) => (
            <li key={event.label} className="flex items-start gap-2 text-xs">
              <span
                className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${MARK_STYLES[event.kind]}`}
              />
              <span className="text-ink-600 dark:text-ink-300">{event.label}</span>
              <span className="ml-auto shrink-0 whitespace-nowrap text-ink-400">
                {formatDate(event.date, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
