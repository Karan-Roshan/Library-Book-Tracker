// Picks a time by scrolling hours, minutes and am/pm.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDismiss } from '../hooks/useDismiss.js'

const ROW = 36
const HOURS = Array.from({ length: 12 }, (_, index) => index + 1)
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5)
const MERIDIEMS = ['AM', 'PM']

const pad = (value) => String(value).padStart(2, '0')

function parse(value) {
  const [rawHour, rawMinute] = String(value ?? '').split(':').map(Number)
  const hour24 = Number.isFinite(rawHour) ? Math.min(23, Math.max(0, rawHour)) : 9

  return {
    hour24,

    hour: hour24 % 12 === 0 ? 12 : hour24 % 12,
    minute: Number.isFinite(rawMinute) ? Math.min(59, Math.max(0, rawMinute)) : 0,
    meridiem: hour24 < 12 ? 'AM' : 'PM',
  }
}

const to24 = (hour, meridiem) =>
  meridiem === 'AM' ? (hour === 12 ? 0 : hour) : hour === 12 ? 12 : hour + 12

function spoken(value) {
  const { hour, minute, meridiem } = parse(value)
  return `${hour}:${pad(minute)} ${meridiem}`
}

const CLOCK = (
  <svg viewBox="0 0 20 20" className="h-[1.05rem] w-[1.05rem]" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 6v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

function Wheel({ label, values, value, onChange, format = pad }) {
  const ref = useRef(null)
  const settling = useRef(null)

  const scrollTo = useCallback(
    (next, behavior = 'smooth') => {
      const index = values.indexOf(next)
      if (index >= 0) ref.current?.scrollTo({ top: index * ROW, behavior })
    },
    [values],
  )

  useEffect(() => {
    scrollTo(value, 'instant')
  }, [])

  function handleScroll() {
    clearTimeout(settling.current)
    settling.current = setTimeout(() => {
      const index = Math.round((ref.current?.scrollTop ?? 0) / ROW)
      const next = values[Math.min(values.length - 1, Math.max(0, index))]
      if (next !== undefined && next !== value) onChange(next)
    }, 90)
  }

  return (
    <div className="flex-1">
      <p className="mb-1 text-center text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-ink-400">
        {label}
      </p>
      <div
        ref={ref}
        onScroll={handleScroll}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        className="scrollbar-none h-[108px] snap-y snap-mandatory overflow-y-auto scroll-smooth"
        style={{
          paddingBlock: ROW,
          scrollbarWidth: 'none',
        }}
      >
        {values.map((option) => {
          const selected = option === value
          return (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => scrollTo(option)}
              style={{ height: ROW }}
              className={`flex w-full snap-center items-center justify-center text-[0.95rem] tabular-nums transition-[color,transform] duration-200 ${
                selected
                  ? 'scale-110 font-semibold text-ink-900 dark:text-white'
                  : 'text-ink-400 hover:text-ink-600 dark:hover:text-ink-200'
              }`}
            >
              {format(option)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function TimeField({ label, value, onChange, hint }) {
  const [open, setOpen] = useState(false)
  const { hour, minute, meridiem } = parse(value)

  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)

  const set = (next) =>
    onChange(`${pad(to24(next.hour ?? hour, next.meridiem ?? meridiem))}:${pad(next.minute ?? minute)}`)

  return (
    <div className="relative" ref={ref}>
      <p className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
        {label}
      </p>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex w-full items-center justify-between rounded-lg border bg-white px-3.5 py-2.5 text-left text-[0.95rem] text-ink-900 shadow-sm transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:bg-ink-800 dark:text-white ${
          open
            ? 'border-brass-500'
            : 'border-ink-200 hover:border-ink-300 dark:border-ink-700'
        }`}
      >
        {spoken(value)}
        <span className={`text-ink-400 transition-transform duration-300 ${open ? 'rotate-[30deg] text-brass-600' : ''}`}>
          {CLOCK}
        </span>
      </button>

      {hint && <p className="mt-1.5 text-xs text-ink-400">{hint}</p>}

      {open && (
        <div className="animate-rise absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-ink-100 bg-white p-3 shadow-xl dark:border-ink-800 dark:bg-ink-900">
          <div className="relative flex gap-1">

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 rounded-lg bg-brass-500/10 ring-1 ring-brass-500/25"
              style={{ height: ROW, marginTop: 9 }}
            />

            <Wheel label="Hour" values={HOURS} value={hour} onChange={(h) => set({ hour: h })} format={String} />
            <Wheel
              label="Minute"
              values={MINUTES}
              value={MINUTES.includes(minute) ? minute : 0}
              onChange={(m) => set({ minute: m })}
            />
            <Wheel
              label="AM / PM"
              values={MERIDIEMS}
              value={meridiem}
              onChange={(m) => set({ meridiem: m })}
              format={String}
            />
          </div>

          <button
            type="button"
            onClick={close}
            className="mt-2 w-full rounded-lg bg-ink-900 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-800 dark:bg-brass-600 dark:hover:bg-brass-500"
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}
