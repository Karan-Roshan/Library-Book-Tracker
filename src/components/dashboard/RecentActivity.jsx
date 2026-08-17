// The last few things anybody did.

import { formatCurrency, formatTime } from '../../lib/format.js'

const KIND = {
  issue: { label: 'Issued', class: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' },
  return: {
    label: 'Returned',
    class: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  member: {
    label: 'Member',
    class: 'bg-brass-50 text-brass-800 dark:bg-brass-500/10 dark:text-brass-300',
  },
  fine: { label: 'Fine', class: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' },
}

export default function RecentActivity({ entries, locale }) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-400">No activity recorded today yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left dark:border-ink-800">
            <th scope="col" className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-400">
              Time
            </th>
            <th scope="col" className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-400">
              Activity
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr
              key={`${entry.at}-${index}`}
              className="border-b border-ink-50 last:border-0 dark:border-ink-800/60"
            >
              <td className="whitespace-nowrap py-2.5 pr-4 align-top tabular-nums text-ink-500 dark:text-ink-400">
                {formatTime(entry.at, locale)}
              </td>
              <td className="py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${KIND[entry.kind].class}`}
                  >
                    {KIND[entry.kind].label}
                  </span>
                  <span className="text-ink-700 dark:text-ink-200">{entry.text}</span>
                  {entry.amount != null && (
                    <span className="font-semibold tabular-nums text-ink-900 dark:text-white">
                      {formatCurrency(entry.amount, locale)}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
