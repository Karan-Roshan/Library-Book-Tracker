// Dates, times, money and numbers, shown the way the settings ask for.

export const formatNumber = (value, locale = 'en-IN') =>
  new Intl.NumberFormat(locale).format(value)

// A number shortened, as 1.2k.
export const formatCompact = (value, locale = 'en-IN') =>
  value < 10_000
    ? new Intl.NumberFormat(locale).format(value)
    : new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
        value,
      )

// Money, in the currency the settings name.
export const formatCurrency = (value, locale = 'en-IN', system) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: system?.currency ?? 'INR',
    maximumFractionDigits: 0,
  }).format(value)

// A time, in the 12- or 24-hour form the settings ask for.
export const formatTime = (date, locale = 'en-IN', system) =>
  new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: system?.timeFormat ? system.timeFormat === '12' : undefined,
    timeZone: system?.timezone,
  })
    .formatToParts(new Date(date))
    .map((part) => (part.type === 'dayPeriod' ? part.value.toUpperCase() : part.value))
    .join('')

const DATE_STYLES = {
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  dmy: { day: '2-digit', month: '2-digit', year: 'numeric' },
  mdy: { month: '2-digit', day: '2-digit', year: 'numeric' },
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
}

// A date, in the format the settings ask for.
export const formatDate = (date, locale = 'en-IN', system) => {
  if (system?.dateFormat === 'iso') return new Date(date).toISOString().slice(0, 10)

  const style = DATE_STYLES[system?.dateFormat ?? 'medium'] ?? DATE_STYLES.medium
  return new Intl.DateTimeFormat(locale, { ...style, timeZone: system?.timezone }).format(
    new Date(date),
  )
}

// A date written out in full.
export const formatLongDate = (date, locale = 'en-IN') =>
  new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))

// Just the month and year.
export const formatMonth = (date, locale = 'en-IN') =>
  new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(date))

// Just the day of the week.
export const formatWeekday = (date, locale = 'en-IN') =>
  new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(date))

// Good morning, afternoon or evening, by the clock.
export function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// Whole days from today, negative for the past.
export function dayDelta(target, from = new Date()) {
  const startOf = (date) => {
    const copy = new Date(date)
    copy.setHours(0, 0, 0, 0)
    return copy.getTime()
  }
  return Math.round((startOf(target) - startOf(from)) / 86_400_000)
}
