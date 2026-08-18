// One member's full record, as staff see it.

import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx'
import Card from '../components/dashboard/Card.jsx'
import StatCard from '../components/dashboard/StatCard.jsx'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { useCirculation } from '../hooks/useCirculation.js'
import { library } from '../data/demoLibrary.js'
import { formatCurrency, formatDate } from '../lib/format.js'
import { borrowingHistory } from '../lib/members.js'

const STATUS_BADGE = {
  Borrowed: 'border-ink-200 bg-ink-50 text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200',
  Returned:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
  Overdue: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300',
}

const initials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="text-sm text-ink-400">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink-800 dark:text-ink-100">
        {value || '—'}
      </dd>
    </div>
  )
}

export default function MemberProfilePage() {
  const { id } = useParams()
  const { locale } = usePreferences()

  // The desk's reading of the register, so this page shows the same loans and
  // holds as the circulation screens rather than the seeded catalogue alone.
  const desk = useCirculation()
  const { now } = desk

  const member = useMemo(
    () => desk.members.find((row) => row.id === id),
    [desk.members, id],
  )

  const history = useMemo(
    () => (member ? borrowingHistory(member, library, desk.books, now) : []),
    [member, desk.books, now],
  )

  if (!member) {
    return (
      <div className="space-y-4">
        <Breadcrumbs />
        <Card title="Member not found">
          <p className="text-sm text-ink-500 dark:text-ink-400">
            No member with that ID.{' '}
            <Link to="/members" className="font-semibold text-brass-700 hover:underline">
              Back to All Members
            </Link>
          </p>
        </Card>
      </div>
    )
  }

  const current = history.filter((row) => row.status !== 'Returned')

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs />
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {member.avatar ? (
            <img
              src={member.avatar}
              alt=""
              className="h-16 w-16 rounded-full object-cover ring-4 ring-ink-100 dark:ring-ink-800"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink-900 font-display text-xl text-brass-200 ring-4 ring-ink-100 dark:bg-brass-600 dark:text-white dark:ring-ink-800">
              {initials(member.name)}
            </span>
          )}
          <div>
            <h1 className="font-display text-2xl text-ink-900 dark:text-white">{member.name}</h1>
            <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
              {member.membershipNumber} · {member.status}
            </p>
          </div>
        </div>
      </div>

      <section aria-label="Borrowing summary" className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard align="center" label="Total Borrowed" value={member.totalBorrowed} />
        <StatCard align="center" label="Currently Borrowed" value={member.currentlyBorrowed} tone="brass" />
        <StatCard align="center" label="Returned" value={member.returnedCount} tone="good" />
        <StatCard align="center" label="Overdue" value={member.overdueCount} tone="alert" />
        <StatCard align="center" label="Reservations" value={member.reservations} />
        <StatCard
          align="center"
          label="Pending Fine"
          value={formatCurrency(member.pendingFine, locale)}
          tone="alert"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Personal Information">
          <dl className="divide-y divide-ink-50 dark:divide-ink-800">
            <Row label="Member ID" value={member.membershipNumber} />
            <Row label="Full name" value={member.name} />
            <Row label="Email" value={member.email} />
            <Row label="Phone" value={member.phone ? `+91 ${member.phone}` : ''} />
            <Row label="Address" value={member.address} />
            <Row label="Date of birth" value={member.dob ? formatDate(member.dob, locale) : ''} />
          </dl>
        </Card>

        <Card title="Membership Information">
          <dl className="divide-y divide-ink-50 dark:divide-ink-800">
            <Row label="Status" value={member.status} />
            <Row label="Joined" value={formatDate(member.joinedAt, locale)} />
            <Row
              label="Expires"
              value={member.expiresAt ? formatDate(member.expiresAt, locale) : ''}
            />
          </dl>
        </Card>

        <Card title="Fine Summary">
          <dl className="divide-y divide-ink-50 dark:divide-ink-800">
            <Row label="Pending fine" value={formatCurrency(member.pendingFine, locale)} />
            <Row label="Total fine paid" value={formatCurrency(member.paidFine, locale)} />
          </dl>
        </Card>
      </div>

      <Card title="Currently Borrowed Books" subtitle={`${current.length} currently borrowed`} padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-900 text-left dark:bg-ink-950">
                {['Book', 'Issue Date', 'Due Date', 'Days Left', 'Status'].map((column) => (
                  <th
                    key={column}
                    className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-brass-200"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {current.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-400">
                    Nothing currently borrowed.
                  </td>
                </tr>
              )}
              {current.map((row, index) => (
                <tr
                  key={row.id}
                  className={index % 2 === 0 ? 'bg-white dark:bg-ink-900' : 'bg-ink-50 dark:bg-ink-800'}
                >
                  <td className="px-4 py-3 text-ink-900 dark:text-white">
                    {row.title}
                    <span className="block text-xs text-ink-400">{row.author}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                    {formatDate(row.issuedAt, locale)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                    {formatDate(row.dueAt, locale)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 font-semibold ${
                      row.daysLeft < 0 ? 'text-red-600' : 'text-ink-700 dark:text-ink-200'
                    }`}
                  >
                    {row.daysLeft < 0 ? `${Math.abs(row.daysLeft)} overdue` : `${row.daysLeft} days`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Borrowing History"
        subtitle={`${history.length} borrowings, newest first`}
        padded={false}
      >
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-ink-900 text-left dark:bg-ink-950">
                {['Book', 'Issue Date', 'Due Date', 'Return Date', 'Status'].map((column) => (
                  <th
                    key={column}
                    className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-brass-200"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-400">
                    This member has not borrowed anything yet.
                  </td>
                </tr>
              )}
              {history.map((row, index) => (
                <tr
                  key={row.id}
                  className={index % 2 === 0 ? 'bg-white dark:bg-ink-900' : 'bg-ink-50 dark:bg-ink-800'}
                >
                  <td className="px-4 py-3 text-ink-900 dark:text-white">{row.title}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                    {formatDate(row.issuedAt, locale)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                    {formatDate(row.dueAt, locale)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                    {row.returnedAt ? formatDate(row.returnedAt, locale) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
