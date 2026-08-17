// Today's issues, returns and fines in one line.

import { formatCurrency, formatNumber } from '../../lib/format.js'

export default function TodaySummary({ summary, locale, showFines = true }) {
  const rows = [
    { label: 'Books issued today', value: formatNumber(summary.issued, locale) },
    { label: 'Books returned', value: formatNumber(summary.returned, locale) },
    { label: 'New members', value: formatNumber(summary.newMembers, locale) },

    showFines && {
      label: 'Fine collected',
      value: formatCurrency(summary.fineCollected, locale),
    },
  ].filter(Boolean)

  return (
    <dl className="grid grid-cols-2 gap-3">
      {rows.map((row) => (
        <div key={row.label} className="rounded-lg bg-ink-50 px-3 py-3 dark:bg-ink-800">
          <dt className="text-xs leading-snug text-ink-500 dark:text-ink-400">{row.label}</dt>
          <dd className="mt-1.5 text-lg font-semibold text-ink-900 dark:text-white">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
