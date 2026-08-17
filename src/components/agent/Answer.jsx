// Renders one assistant reply — a list, a figure, or a confirmation.

import { Link } from 'react-router-dom'
import { formatCurrency, formatDate } from '../../lib/format.js'

const Shell = ({ children, tone = 'plain' }) => {
  const tones = {
    plain: 'border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900',
    warn: 'border-amber-200 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10',
    bad: 'border-red-200 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10',
    good: 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10',
  }
  return (
    <div className={`max-w-full rounded-2xl rounded-bl-sm border px-4 py-3 shadow-sm ${tones[tone]}`}>
      {children}
    </div>
  )
}

const Row = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 py-0.5">
    <span className="shrink-0 text-xs text-ink-400">{label}</span>
    <span className="text-right text-sm font-medium text-ink-800 dark:text-ink-100">{value}</span>
  </div>
)

const More = ({ to, children }) => (
  <Link
    to={to}
    className="mt-2 inline-block text-xs font-semibold text-brass-700 hover:underline dark:text-brass-300"
  >
    {children} →
  </Link>
)

export default function Answer({ result, asked, locale, system, busy, onRun, onClose }) {
  const money = (value) => formatCurrency(value ?? 0, locale, system)
  const day = (value) => (value ? formatDate(value, locale, system) : '—')

  if (result.status === 'unresolved') {
    return (
      <Shell tone="warn">
        <p className="text-sm text-ink-800 dark:text-ink-100">
          I did not understand that one.
        </p>
        {result.suggestion && (
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">Try: “{result.suggestion}”</p>
        )}
        <p className="mt-2 text-xs text-ink-400">
          I can search the catalogue, look up accounts and borrowings, show what is overdue or due, and
          carry out desk operations you have permission for.
        </p>
      </Shell>
    )
  }

  if (result.status === 'refused') {
    return (
      <Shell tone="bad">
        <p className="text-sm font-semibold text-red-800 dark:text-red-300">Not permitted</p>
        <p className="mt-1 text-sm text-red-700 dark:text-red-300">{result.message}</p>
      </Shell>
    )
  }

  if (result.status === 'clarify') {
    return (
      <Shell tone="warn">
        <p className="text-sm text-ink-800 dark:text-ink-100">{result.message}</p>
        {result.alternatives?.length > 0 && (
          <ul className="mt-2 space-y-1">
            {result.alternatives.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRun(`${asked} — ${option}`)}
                  className="text-sm text-brass-700 hover:underline dark:text-brass-300"
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Shell>
    )
  }

  if (result.status === 'error') {
    return (
      <Shell tone="bad">
        <p className="text-sm text-red-700 dark:text-red-300">{result.message}</p>
      </Shell>
    )
  }

  if (result.status === 'confirm') {
    return (
      <Shell tone={result.preview.severe ? 'bad' : 'warn'}>
        <p className="text-sm font-semibold text-ink-900 dark:text-white">{result.preview.title}</p>
        <dl className="mt-2 space-y-0.5">
          {result.preview.lines.map(([label, value]) => (
            <Row key={label} label={label} value={value} />
          ))}
        </dl>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onRun(asked, result.pending)}
            className="rounded-lg bg-brass-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brass-500 disabled:bg-brass-200"
          >
            Yes, go ahead
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRun('cancelled')}
            className="rounded-lg border border-ink-200 px-3.5 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            No
          </button>
        </div>
      </Shell>
    )
  }

  const { data } = result

  switch (data.kind) {
    case 'books':
      return (
        <Shell>
          <p className="text-sm text-ink-800 dark:text-ink-100">
            {data.total === 0
              ? `Nothing matched${data.query ? ` “${data.query}”` : ''}.`
              : `${data.total} book${data.total === 1 ? '' : 's'}${data.availableOnly ? ' available' : ''}${data.query ? ` for “${data.query}”` : ''}`}
          </p>
          <ul className="mt-2 space-y-2">
            {data.rows.map((book) => (
              <li key={book.code} className="border-t border-ink-50 pt-2 first:border-0 first:pt-0 dark:border-ink-800">
                <p className="text-sm font-medium text-ink-900 dark:text-white">{book.title}</p>
                <p className="text-xs text-ink-400">
                  {book.author} · {book.category} · Shelf {book.shelf}
                </p>
                <p
                  className={`text-xs font-semibold ${
                    book.available > 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {book.available > 0
                    ? `${book.available} of ${book.copies} available`
                    : 'Currently unavailable'}
                </p>
              </li>
            ))}
          </ul>
          <More to="/my/browse">Browse the catalogue</More>
        </Shell>
      )

    case 'availability':
      return (
        <Shell tone={data.available > 0 ? 'good' : 'warn'}>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">{data.title}</p>
          <p className="text-xs text-ink-400">
            {data.author} · {data.code} · Shelf {data.shelf}
          </p>
          <dl className="mt-2 space-y-0.5">
            <Row label="On the shelf" value={`${data.available} of ${data.copies}`} />
            <Row label="Currently borrowed" value={data.issued} />
            {data.repairing > 0 && <Row label="Under repair" value={data.repairing} />}
            {data.lost > 0 && <Row label="Lost" value={data.lost} />}
            {data.waiting > 0 && <Row label="Waiting" value={`${data.waiting} member(s)`} />}
          </dl>
        </Shell>
      )

    case 'holders':
      return (
        <Shell>
          <p className="text-sm text-ink-800 dark:text-ink-100">
            {data.title} — {data.copies} copies: {data.available} available, {data.holders.length} out
            {data.repairing > 0 && `, ${data.repairing} under repair`}
          </p>
          {data.holders.length > 0 && (
            <ul className="mt-2 space-y-1">
              {data.holders.map((row, index) => (
                <li key={index} className="flex justify-between gap-3 text-sm">
                  <span className="text-ink-700 dark:text-ink-200">{row.member}</span>
                  <span
                    className={
                      row.status === 'Overdue'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-ink-400'
                    }
                  >
                    {row.status === 'Overdue' ? `${row.daysOverdue}d overdue` : `due ${day(row.due)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.queue.length > 0 && (
            <p className="mt-2 text-xs text-ink-400">
              Waiting: {data.queue.map((row) => `#${row.position} ${row.member}`).join(', ')}
            </p>
          )}
          <More to="/circulation/reservations">Reservations</More>
        </Shell>
      )

    case 'member':
      return (
        <Shell tone={data.expired ? 'warn' : 'plain'}>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">{data.name}</p>
          <p className="text-xs text-ink-400">
            {data.memberId} · {data.type} · {data.email}
          </p>
          <dl className="mt-2 space-y-0.5">
            <Row label="Status" value={data.expired ? 'Membership expired' : data.status} />
            <Row label="Books out" value={`${data.out} of ${data.limit}`} />
            {data.overdue > 0 && <Row label="Overdue" value={data.overdue} />}
            <Row label="Owes" value={data.owed > 0 ? money(data.owed) : 'Nothing'} />
            <Row label="Valid until" value={day(data.expires)} />
          </dl>
          <More to="/members">Members register</More>
        </Shell>
      )

    case 'borrowings':
      return (
        <Shell>
          <p className="text-sm text-ink-800 dark:text-ink-100">
            {data.rows.length === 0
              ? `${data.subject} has nothing out.`
              : `${data.subject} has ${data.rows.length} of ${data.limit} books out:`}
          </p>
          <ul className="mt-2 space-y-2">
            {data.rows.map((row, index) => (
              <li key={index} className="border-t border-ink-50 pt-2 first:border-0 first:pt-0 dark:border-ink-800">
                <p className="text-sm font-medium text-ink-900 dark:text-white">{row.title}</p>
                <p
                  className={`text-xs ${
                    row.status === 'Overdue'
                      ? 'font-semibold text-red-600 dark:text-red-400'
                      : row.daysRemaining <= 2
                        ? 'font-semibold text-amber-700 dark:text-amber-400'
                        : 'text-ink-400'
                  }`}
                >
                  {row.status === 'Overdue'
                    ? `${row.daysOverdue} days overdue · ${money(row.fine)}`
                    : `Due ${day(row.due)} · ${row.daysRemaining} days left`}
                </p>
              </li>
            ))}
          </ul>
          <More to="/my/books">My books</More>
        </Shell>
      )

    case 'eligibility':
      return (
        <Shell tone={data.allowed ? 'good' : 'bad'}>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">
            {data.allowed
              ? `Yes — ${data.subject} can borrow${data.book ? ` ${data.book}` : ''}.`
              : `No — ${data.subject} cannot borrow${data.book ? ` ${data.book}` : ''}.`}
          </p>
          {data.blocks.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-red-700 dark:text-red-300">
              {data.blocks.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {data.warnings.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-400">
              {data.warnings.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-ink-400">
            {data.out} of {data.limit} slots used · owes {money(data.owed)}
          </p>
        </Shell>
      )

    case 'overdue':
      return (
        <Shell tone={data.total > 0 ? 'bad' : 'good'}>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">
            {data.total === 0
              ? 'Nothing is overdue.'
              : `${data.total} overdue across ${data.members} members — ${money(data.fines)} accruing`}
            {data.minDays ? ` (more than ${data.minDays} days)` : ''}
          </p>
          <ul className="mt-2 space-y-1">
            {data.rows.slice(0, 8).map((row, index) => (
              <li key={index} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink-700 dark:text-ink-200">
                  {row.title} — {row.member}
                </span>
                <span className="shrink-0 text-red-600 dark:text-red-400">
                  {row.daysOverdue}d · {money(row.fine)}
                </span>
              </li>
            ))}
          </ul>
          {data.rows.length > 8 && (
            <p className="mt-1 text-xs text-ink-400">…and {data.total - 8} more</p>
          )}
          <More to="/circulation/overdue">Overdue books</More>
        </Shell>
      )

    case 'due':
      return (
        <Shell tone={data.total > 0 ? 'warn' : 'good'}>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">
            {data.total === 0
              ? data.days === 0
                ? 'Nothing is due today.'
                : `Nothing due in the next ${data.days} days.`
              : `${data.total} book${data.total === 1 ? '' : 's'} due ${data.days === 0 ? 'today' : `within ${data.days} days`}`}
          </p>
          <ul className="mt-2 space-y-1">
            {data.rows.slice(0, 10).map((row, index) => (
              <li key={index} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink-700 dark:text-ink-200">
                  {row.title} — {row.member}
                </span>
                <span className="shrink-0 text-ink-400">
                  {row.inDays === 0 ? 'today' : `${row.inDays}d`}
                </span>
              </li>
            ))}
          </ul>
        </Shell>
      )

    case 'fines':
      return (
        <Shell tone={data.owed > 0 ? 'warn' : 'good'}>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">
            {data.owed > 0
              ? `${data.subject} owes ${money(data.owed)}`
              : `${data.subject} owes nothing.`}
          </p>
          {data.rows.length > 0 && (
            <ul className="mt-2 space-y-1">
              {data.rows.map((row, index) => (
                <li key={index} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink-700 dark:text-ink-200">
                    {row.book} — {row.reason}
                  </span>
                  <span className="shrink-0 text-ink-500 dark:text-ink-400">{money(row.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          {data.paid > 0 && (
            <p className="mt-2 text-xs text-ink-400">{money(data.paid)} paid to date.</p>
          )}
          <More to="/my/fines">My fines</More>
        </Shell>
      )

    case 'fineSummary':
      return (
        <Shell>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">
            Fines — {data.period}
          </p>
          <dl className="mt-2 space-y-0.5">
            <Row label="Generated" value={money(data.generated)} />
            <Row label="Collected" value={money(data.collected)} />
            <Row label="Still pending" value={money(data.pending)} />
            <Row label="Collection rate" value={data.rate === null ? '—' : `${data.rate}%`} />
          </dl>
          {data.change?.percent !== null && (
            <p className="mt-2 text-xs text-ink-400">
              {data.change.direction === 'up' ? '▲' : data.change.direction === 'down' ? '▼' : '—'}{' '}
              {Math.abs(data.change.percent)}% against the previous period.
            </p>
          )}
          <More to="/reports/fines">Fine report</More>
        </Shell>
      )

    case 'summary':
      return (
        <Shell>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">
            Library summary — {data.period}
          </p>
          <dl className="mt-2 space-y-0.5">
            <Row label="Books issued" value={data.issued} />
            <Row label="Books returned" value={data.returned} />
            <Row label="Active members" value={data.activeMembers} />
            <Row label="Overdue now" value={data.overdue} />
            <Row label="Fines collected" value={money(data.collected)} />
            <Row label="Fines pending" value={money(data.pending)} />
            <Row label="On the repair bench" value={data.repairs} />
            <Row label="Lost, unrecovered" value={data.lost} />
            <Row label="On the shelf" value={`${data.available} of ${data.copies}`} />
          </dl>
          {data.change?.percent !== null && (
            <p className="mt-2 text-xs text-ink-400">
              Circulation is {Math.abs(data.change.percent)}%{' '}
              {data.change.direction === 'up' ? 'higher' : 'lower'} than the previous period.
            </p>
          )}
          <More to="/reports">Full reports</More>
        </Shell>
      )

    case 'popular':
      return (
        <Shell>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">
            Most borrowed — {data.period}
          </p>
          <ol className="mt-2 space-y-1">
            {data.rows.map((row, index) => (
              <li key={index} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink-700 dark:text-ink-200">
                  {index + 1}. {row.title}
                </span>
                <span className="shrink-0 text-ink-400">
                  {row.issues} issues
                  {row.pressure >= 8 && (
                    <span className="ml-1 font-semibold text-amber-700 dark:text-amber-400">
                      · buy more
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <More to="/reports/inventory">Inventory report</More>
        </Shell>
      )

    case 'inventory':
      return (
        <Shell>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">
            {data.scope === 'the whole collection' ? 'The collection' : data.scope}
          </p>
          <dl className="mt-2 space-y-0.5">
            <Row label="Titles" value={data.titles} />
            <Row label="Copies" value={data.copies} />
            <Row label="Available" value={data.available} />
            <Row label="Currently borrowed" value={data.outNow} />
            {data.repairing > 0 && <Row label="Under repair" value={data.repairing} />}
          </dl>
          <More to="/reports/inventory">Inventory report</More>
        </Shell>
      )

    case 'repairs':
      return (
        <Shell>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">Repairs</p>
          <dl className="mt-2 space-y-0.5">
            <Row label="On the bench" value={data.open} />
            <Row label="Completed" value={data.completed} />
            <Row label="Spent" value={money(data.spend)} />
            <Row
              label="Average turnaround"
              value={data.turnaround === null ? '—' : `${data.turnaround} days`}
            />
          </dl>
          {data.rows.length > 0 && (
            <>
              <p className="mt-2 text-xs text-ink-400">
                {data.minDays ? `Open more than ${data.minDays} days:` : 'Oldest open jobs:'}
              </p>
              <ul className="mt-1 space-y-1">
                {data.rows.slice(0, 8).map((row, index) => (
                  <li key={index} className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-ink-700 dark:text-ink-200">
                      {row.title} ({row.copy})
                    </span>
                    <span className="shrink-0 text-ink-400">
                      {row.days}d · {row.status}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <More to="/books/repairs">Book repairs</More>
        </Shell>
      )

    case 'staffActivity':
      return (
        <Shell>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">
            Staff activity — {data.period}
          </p>
          <ul className="mt-2 space-y-1">
            {data.rows.map((row, index) => (
              <li key={index} className="flex justify-between gap-3 text-sm">
                <span className="text-ink-700 dark:text-ink-200">{row.name}</span>
                <span className="shrink-0 text-ink-400">
                  {row.total} actions · {row.issued} issued
                </span>
              </li>
            ))}
          </ul>
          <More to="/reports/staff">Staff report</More>
        </Shell>
      )

    case 'reservations':
      return (
        <Shell>
          <p className="text-sm text-ink-800 dark:text-ink-100">
            {data.rows.length === 0
              ? 'You have no reservations.'
              : `You have ${data.rows.length} reservation${data.rows.length === 1 ? '' : 's'}:`}
          </p>
          <ul className="mt-2 space-y-1">
            {data.rows.map((row, index) => (
              <li key={index} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink-700 dark:text-ink-200">{row.title}</span>
                <span className="shrink-0 text-ink-400">
                  {row.status === 'Ready for Pickup'
                    ? `ready — collect by ${day(row.collectBy)}`
                    : row.position
                      ? `#${row.position} in the queue`
                      : row.status}
                </span>
              </li>
            ))}
          </ul>
          <More to="/my/reservations">My reservations</More>
        </Shell>
      )

    case 'queue':
      return (
        <Shell>
          <p className="text-sm text-ink-800 dark:text-ink-100">
            {data.rows.length === 0
              ? `Nobody is waiting for ${data.title}.`
              : `${data.rows.length} waiting for ${data.title}:`}
          </p>
          <ol className="mt-2 space-y-1">
            {data.rows.map((row, index) => (
              <li key={index} className="flex justify-between gap-3 text-sm">
                <span className="text-ink-700 dark:text-ink-200">
                  #{row.position} {row.member}
                </span>
                <span className="shrink-0 text-ink-400">{row.status}</span>
              </li>
            ))}
          </ol>
        </Shell>
      )

    case 'history':
      return (
        <Shell>
          <p className="text-sm text-ink-800 dark:text-ink-100">
            {data.total} books borrowed on your account. Most recent:
          </p>
          <ul className="mt-2 space-y-1">
            {data.rows.slice(0, 10).map((row, index) => (
              <li key={index} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink-700 dark:text-ink-200">{row.title}</span>
                <span className="shrink-0 text-ink-400">
                  {row.returned ? `returned ${day(row.returned)}` : row.status}
                </span>
              </li>
            ))}
          </ul>
          <More to="/my/history">My history</More>
        </Shell>
      )

    case 'issued':
      return (
        <Shell tone="good">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            Book issued.
          </p>
          <dl className="mt-2 space-y-0.5">
            <Row label="Book" value={`${data.title} (${data.code})`} />
            <Row label="Member" value={`${data.subject} · ${data.memberId}`} />
            <Row label="Due back" value={day(data.due)} />
          </dl>
          {data.warnings?.length > 0 && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              {data.warnings.join(' ')}
            </p>
          )}
        </Shell>
      )

    case 'returned':
      return (
        <Shell tone="good">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            {data.title} returned by {data.subject}.
          </p>
          {data.fine > 0 && (
            <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
              {data.daysOverdue} days overdue — {money(data.fine)} is now pending.
            </p>
          )}
          {data.repairRaised && (
            <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
              Recorded as {data.condition}; a repair has been raised and the copy held back.
            </p>
          )}
          {data.calledNext && (
            <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
              {data.calledNext} was next in the queue and has been notified.
            </p>
          )}
        </Shell>
      )

    case 'reserved':
      return (
        <Shell tone="good">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            {data.title} reserved.
          </p>
          <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
            You are #{data.position} in the queue.{' '}
            {data.available > 0
              ? 'A copy is on the shelf now — collect it at the desk.'
              : 'You will be notified when a copy comes back.'}
          </p>
          <More to="/my/reservations">My reservations</More>
        </Shell>
      )

    case 'repairRaised':
      return (
        <Shell tone="good">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            {data.copy} taken off the shelf.
          </p>
          <dl className="mt-2 space-y-0.5">
            <Row label="Book" value={data.title} />
            <Row label="Damage" value={`${data.damageType} · ${data.severity}`} />
            <Row label="Still available" value={data.remaining} />
          </dl>
          <More to="/books/repairs">Book repairs</More>
        </Shell>
      )

    case 'settingChanged':
      return (
        <Shell tone="good">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            {data.setting} changed.
          </p>
          <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
            {money(data.from)} → {money(data.to)} a day. Every module now works to the new figure,
            and the change is in the configuration history under your name.
          </p>
          <More to="/settings/history">Configuration history</More>
        </Shell>
      )

    case 'refused':
      return (
        <Shell tone="bad">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            The rules do not allow that.
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-red-700 dark:text-red-300">
            {data.blocks.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Shell>
      )

    default:
      return (
        <Shell>
          <pre className="overflow-x-auto text-xs text-ink-600 dark:text-ink-300">
            {JSON.stringify(data, null, 2)}
          </pre>
        </Shell>
      )
  }
}
