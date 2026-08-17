// Who is borrowing the most at the moment.

import { formatNumber } from '../../lib/format.js'

export default function ActiveMembers({ members, locale }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-ink-100 text-left dark:border-ink-800">
          <th scope="col" className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-400">
            Member
          </th>
          <th
            scope="col"
            className="pb-2 text-right text-xs font-semibold uppercase tracking-[0.06em] text-ink-400"
          >
            Borrowed
          </th>
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
          <tr key={member.id} className="border-b border-ink-50 last:border-0 dark:border-ink-800/60">
            <td className="py-2.5">
              <p className="font-medium text-ink-900 dark:text-white">{member.name}</p>
              <p className="text-xs tabular-nums text-ink-400">{member.membershipNumber}</p>
            </td>
            <td className="py-2.5 text-right align-middle font-semibold tabular-nums text-ink-900 dark:text-white">
              {formatNumber(member.borrowed, locale)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
