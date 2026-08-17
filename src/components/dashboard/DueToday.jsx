// The books expected back today.

import { useState } from 'react'
import { formatDate } from '../../lib/format.js'

export default function DueToday({ borrowings, locale }) {
  const [state, setState] = useState({})

  if (borrowings.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-400">Nothing falls due today.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left dark:border-ink-800">
            <th scope="col" className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-400">
              Member
            </th>
            <th scope="col" className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-400">
              Book
            </th>
            <th scope="col" className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-400">
              Due
            </th>
            <th scope="col" className="pb-2 text-right text-xs font-semibold uppercase tracking-[0.06em] text-ink-400">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {borrowings.map((borrowing) => (
            <tr key={borrowing.id} className="border-b border-ink-50 last:border-0 dark:border-ink-800/60">
              <td className="py-2.5 pr-3 font-medium text-ink-900 dark:text-white">{borrowing.member}</td>
              <td className="max-w-[12rem] truncate py-2.5 pr-3 text-ink-600 dark:text-ink-300" title={borrowing.book}>
                {borrowing.book}
              </td>
              <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums text-ink-500 dark:text-ink-400">
                {formatDate(borrowing.dueAt, locale)}
              </td>
              <td className="py-2.5 text-right">
                {state[borrowing.id] ? (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {state[borrowing.id]}
                  </span>
                ) : (
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setState((s) => ({ ...s, [borrowing.id]: 'Reminder queued' }))}
                      className="rounded-md border border-ink-200 px-2 py-1 text-xs font-medium text-ink-600 transition-colors hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                    >
                      Send reminder
                    </button>
                    <button
                      type="button"
                      onClick={() => setState((s) => ({ ...s, [borrowing.id]: 'Extension noted' }))}
                      className="rounded-md border border-ink-200 px-2 py-1 text-xs font-medium text-ink-600 transition-colors hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                    >
                      Extend
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-xs text-ink-400">
        Reminders and extensions are recorded on screen only until the circulation service exists.
      </p>
    </div>
  )
}
