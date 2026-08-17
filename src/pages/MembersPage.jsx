// The membership register.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLive } from '../hooks/useLive.js'
import { useNavigate } from 'react-router-dom'
import { useDismiss } from '../hooks/useDismiss.js'
import RowMenu, { ACTION_CELL, ACTION_HEAD } from '../components/dashboard/RowMenu.jsx'
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx'
import Card from '../components/dashboard/Card.jsx'
import StatCard from '../components/dashboard/StatCard.jsx'
import MemberDialog from '../components/dashboard/MemberDialog.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { usePageSize } from '../hooks/useTablePrefs.js'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { library } from '../data/demoLibrary.js'
import { formatDate } from '../lib/format.js'
import { downloadFile, toCSV } from '../lib/csv.js'
import { CAPABILITIES, can } from '../lib/permissions.js'
import {
  FILTER_GROUPS,
  composeMembers,
  countFilters,
  filterMembers,
  renewalExpiry,
  summarizeMembers,
} from '../lib/members.js'
import * as membersService from '../services/members.js'
import * as memberAccess from '../services/memberAccess.js'

const COLUMNS = [
  'Profile',
  'Full Name',
  'Member ID',
  'Email',
  'Phone',
  'Age',
  'Gender',
  'Joined Date',
  'ID Issue Date',
  'Renewal Date',
  'Account Expiry',
  'Status',
  'Address',
]

const CSV_COLUMNS = [
  ['Member ID', (row) => row.membershipNumber],
  ['Full Name', (row) => row.name],
  ['Email', (row) => row.email],
  ['Phone', (row) => row.phone],
  ['Age', (row) => row.age ?? ''],
  ['Gender', (row) => row.gender ?? ''],
  ['Joined Date', (row) => row.joinedAt?.slice(0, 10) ?? ''],
  ['ID Issue Date', (row) => row.idIssuedAt?.slice(0, 10) ?? ''],
  ['Renewal Date', (row) => row.renewedAt?.slice(0, 10) ?? ''],
  ['Account Expiry', (row) => row.expiresAt?.slice(0, 10) ?? ''],
  ['Status', (row) => row.status],
  ['Address', (row) => row.address ?? ''],
]

const PAGE_SIZES = [10, 25, 50, 100]

const STICKY = {
  Profile: 'sticky left-0 w-20 min-w-20',
  'Full Name': 'sticky left-20 w-52 min-w-52 border-r border-ink-100 dark:border-ink-800',
}

const isExpired = (member, now) => Boolean(member.expiresAt) && new Date(member.expiresAt) < now

const stripeFor = (index) =>
  index % 2 === 0 ? 'bg-white dark:bg-ink-900' : 'bg-ink-50 dark:bg-ink-800'

const STICKY_HOVER = 'group-hover:bg-brass-50 dark:group-hover:bg-ink-800'

const STATUS_BADGE = {
  Active: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300',
  Inactive: 'border-ink-200 bg-ink-50 text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300',
  Suspended: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300',
}

const initials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

export default function MembersPage({ autoAdd = false }) {
  const { user } = useAuth()
  const { locale } = usePreferences()

  const [added, setAdded] = useState([])

  const [logins, setLogins] = useState([])
  const [access, setAccess] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePageSize(PAGE_SIZES)
  const [editing, setEditing] = useState(autoAdd ? 'new' : null)
  const [confirm, setConfirm] = useState(null)
  const [notice, setNotice] = useState(null)

  const now = useMemo(() => new Date(), [])
  const navigate = useNavigate()
  const mayRemove = can(user, CAPABILITIES.MEMBERS_REMOVE)

  const refresh = useCallback(() => {
    Promise.all([
      membersService.listAddedMembers(),
      membersService.listOverrides(),
      memberAccess.listLogins(),
    ]).then(([rows, patches, issued]) => {
      setAdded(rows)
      setOverrides(patches)
      setLogins(issued)
    })
  }, [])

  useEffect(refresh, [refresh])

  useLive(['addedMembers', 'memberLogins', 'values/memberOverrides'], refresh)

  const members = useMemo(
    () => composeMembers({ library, added, overrides, now }),
    [added, overrides, now],
  )

  const stats = useMemo(() => summarizeMembers(members, now), [members, now])
  const visible = useMemo(
    () => filterMembers(members, { filters, query, now }),
    [members, filters, query, now],
  )
  const activeFilters = countFilters(filters)

  const closeFilters = useCallback(() => setFiltersOpen(false), [])
  const filtersRef = useDismiss(filtersOpen, closeFilters)

  const toggleFilter = (group, value) => {
    setFilters((current) => {
      const values = current[group] ?? []
      const next = values.includes(value)
        ? values.filter((entry) => entry !== value)
        : [...values, value]
      return { ...current, [group]: next }
    })
  }

  useEffect(() => setPage(1), [filters, query, pageSize])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = visible.slice((safePage - 1) * pageSize, safePage * pageSize)

  async function handleSubmit(details) {
    if (editing === 'new') await membersService.addMember(details)
    else await membersService.patchMember(editing.id, details, {
      name: details.name,
      memberId: editing.membershipNumber,
    })
    setNotice(editing === 'new' ? `${details.name} registered.` : `${details.name} updated.`)
    refresh()
  }

  async function renew(member) {
    const renewedAt = new Date()
    const expires = renewalExpiry(renewedAt)

    await membersService.patchMember(
      member.id,
      {
        renewedAt: renewedAt.toISOString(),
        idIssuedAt: renewedAt.toISOString(),
        expiresAt: expires.toISOString(),
      },
      { name: member.name, memberId: member.membershipNumber },
    )
    setNotice(
      `${member.name} renewed on ${formatDate(renewedAt, locale)}, valid until ${formatDate(expires, locale)}.`,
    )
    refresh()
  }

  async function applyConfirm() {
    const { member } = confirm
    await membersService.deleteMember(member.id, member.isAdded, {
      name: member.name,
      memberId: member.membershipNumber,
    })
    setNotice(`${member.name} removed from the register.`)
    setConfirm(null)
    refresh()
  }

  const cell = 'whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="mt-2 font-display text-2xl text-ink-900 dark:text-white">Members</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Members Details</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setNotice(null)
              setEditing('new')
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brass-500"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
              <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Add Member
          </button>
          {can(user, CAPABILITIES.EXPORT) && (
          <button
              type="button"
              onClick={() =>
                downloadFile(
                  `members-${new Date().toISOString().slice(0, 10)}.csv`,
                  toCSV(visible, CSV_COLUMNS),
                )
              }
              disabled={visible.length === 0}
              className="rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300 dark:bg-ink-700 dark:hover:bg-ink-600"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          role="status"

          className="animate-rise fixed left-1/2 top-20 z-50 w-[min(28rem,90vw)] -translate-x-1/2 lg:left-[calc(50%+8rem)]"
        >
          <div className="rounded-lg border border-brass-200 bg-brass-50 px-4 py-3 text-sm text-brass-900 shadow-lg dark:border-brass-500/30 dark:bg-ink-800 dark:text-brass-200">
            {notice}
          </div>
        </div>
      )}

      {access && (
        <AccessDialog
          member={access.member}
          actor={user}
          onClose={() => setAccess(null)}
          onDone={(message) => {
            setAccess(null)
            refresh()
            setNotice(message)
          }}
        />
      )}

      <MemberDialog
        open={editing !== null}
        member={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSubmit={handleSubmit}
      />

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            className="animate-rise w-full max-w-md rounded-xl border border-ink-100 bg-white p-5 shadow-xl dark:border-ink-800 dark:bg-ink-900"
          >
            <h2 className="font-display text-lg text-ink-900 dark:text-white">
              Remove {confirm.member.name}?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
              They leave the membership register permanently. Their borrowing history stays on
              the borrowings, but the member record does not. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyConfirm}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <section aria-label="Member statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard align="center" label="Total Members" value={stats.total} />
        <StatCard align="center" label="Active Members" value={stats.active} tone="good" />
        <StatCard align="center" label="Inactive Members" value={stats.inactive} />
        <StatCard align="center" label="New This Month" value={stats.newThisMonth} tone="brass" />
      </section>

      <Card
        title="Members"
        subtitle={`${visible.length} of ${members.length} shown`}
        padded={false}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ID, name, email, phone..."
              aria-label="Search members"
              className="h-9 w-60 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-white"
            />
            <div ref={filtersRef} className="relative">
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                  activeFilters > 0
                    ? 'border-brass-400 bg-brass-50 text-brass-800 dark:bg-brass-500/10 dark:text-brass-200'
                    : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200'
                }`}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                  <path
                    d="M3.5 5h13M6 10h8M8.5 15h3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                Filters
                {activeFilters > 0 && (
                  <span className="rounded-full bg-brass-600 px-1.5 text-xs font-bold text-white">
                    {activeFilters}
                  </span>
                )}
              </button>

              {filtersOpen && (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-64 rounded-xl border border-ink-100 bg-white p-4 shadow-xl dark:border-ink-700 dark:bg-ink-800">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-300">
                      Filter by
                    </p>
                    {activeFilters > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilters({})}
                        className="text-xs font-semibold text-brass-700 hover:underline dark:text-brass-300"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 space-y-4 overflow-y-auto">
                    {FILTER_GROUPS.map((group) => (
                      <fieldset key={group.key}>
                        <legend className="mb-1.5 text-xs font-semibold text-ink-400">
                          {group.label}
                        </legend>
                        <div className="space-y-1">
                          {group.options.map((option) => (
                            <label
                              key={option}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700"
                            >
                              <input
                                type="checkbox"
                                checked={(filters[group.key] ?? []).includes(option)}
                                onChange={() => toggleFilter(group.key, option)}
                                className="h-4 w-4 rounded border-ink-300 accent-brass-600"
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-900 text-left dark:bg-ink-950">
                {COLUMNS.map((column) => (
                  <th
                    key={column}
                    className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-brass-200 ${
                      STICKY[column] ? `${STICKY[column]} z-20 bg-ink-900 dark:bg-ink-950` : ''
                    }`}
                  >
                    {column}
                  </th>
                ))}

                <th className={ACTION_HEAD} />
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-sm text-ink-400">
                    No members match that view.
                  </td>
                </tr>
              )}
              {paged.map((member, index) => {
                const stripe = stripeFor(index)
                return (
                <tr
                  key={member.id}
                  className={`group border-b border-ink-100/70 transition-colors last:border-0 dark:border-ink-800/60 ${stripe} hover:bg-brass-50 dark:hover:bg-ink-800`}
                >
                  <td className={`px-4 py-3 z-10 ${STICKY.Profile} ${stripe} ${STICKY_HOVER}`}>
                    <div className="relative h-9 w-9">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-brass-200 dark:bg-brass-600 dark:text-white">
                          {initials(member.name)}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => navigate(`/members/${member.id}`)}
                        title={`View ${member.name}`}
                        aria-label={`View ${member.name}`}
                        className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink-900 text-white shadow-md ring-2 ring-white transition-colors hover:bg-brass-600 dark:ring-ink-900"
                      >
                        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                          <path d="M10 4c-4 0-7.4 2.4-9 6 1.6 3.6 5 6 9 6s7.4-2.4 9-6c-1.6-3.6-5-6-9-6zm0 10a4 4 0 110-8 4 4 0 010 8zm0-1.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 font-medium text-ink-900 dark:text-white z-10 ${STICKY['Full Name']} ${stripe} ${STICKY_HOVER}`}
                  >
                    {member.name}
                  </td>
                  <td className={cell}>{member.membershipNumber}</td>
                  <td className={cell}>{member.email || '—'}</td>
                  <td className={cell}>{member.phone ? `+91 ${member.phone}` : '—'}</td>
                  <td className={cell}>{member.age ?? '—'}</td>
                  <td className={cell}>{member.gender ?? '—'}</td>
                  <td className={cell}>{formatDate(member.joinedAt, locale)}</td>
                  <td className={cell}>
                    {member.idIssuedAt ? formatDate(member.idIssuedAt, locale) : '—'}
                  </td>
                  <td className={cell}>
                    {member.renewedAt ? formatDate(member.renewedAt, locale) : '—'}
                  </td>

                  <td
                    className={`whitespace-nowrap px-4 py-3 ${
                      isExpired(member, now)
                        ? 'font-semibold text-red-600'
                        : 'text-ink-500 dark:text-ink-400'
                    }`}
                  >
                    {member.expiresAt
                      ? `${isExpired(member, now) ? 'Expired ' : ''}${formatDate(member.expiresAt, locale)}`
                      : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_BADGE[member.status] ?? STATUS_BADGE.Inactive
                      }`}
                    >
                      {member.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500 dark:text-ink-400">
                    {member.address || '—'}
                  </td>
                  <td className={`${ACTION_CELL} ${stripe} ${STICKY_HOVER}`}>
                    <RowMenu
                      label={`Actions for ${member.name}`}
                      items={[
                          {
                            label: 'Edit member',
                            onSelect: () => setEditing(member),
                          },
                          {
                            label: 'View profile',
                            onSelect: () => navigate(`/members/${member.id}`),
                          },
                          ...(isExpired(member, now)
                            ? [{ label: 'Renew membership', onSelect: () => renew(member) }]
                            : []),
                          ...(mayRemove
                            ? [
                                {
                                  label: logins.some((row) => row.memberId === member.id)
                                    ? 'Reset library access'
                                    : 'Issue library access',
                                  onSelect: () => setAccess({ member, password: '' }),
                                },
                              ]
                            : []),
                          ...(mayRemove && logins.some((row) => row.memberId === member.id)
                            ? [
                                {
                                  label: 'Revoke library access',
                                  tone: 'danger',
                                  onSelect: () =>
                                    memberAccess
                                      .revokeAccess(member, { actor: user })
                                      .then(refresh)
                                      .then(() => setNotice(`${member.name} can no longer sign in.`)),
                                },
                              ]
                            : []),
                          ...(mayRemove
                            ? [
                                {
                                  label: 'Delete member',
                                  tone: 'danger',
                                  onSelect: () => setConfirm({ member, action: 'delete' }),
                                },
                              ]
                            : []),
                      ]}
                    />
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {visible.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 dark:border-ink-800">
            <div className="flex items-center gap-3">
              <p className="text-xs text-ink-400">
                Showing {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, visible.length)} of {visible.length}
              </p>
              <label className="flex items-center gap-1.5 text-xs text-ink-400">
                Rows
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-xs font-semibold text-ink-700 focus:border-brass-500 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                  disabled={safePage <= 1}
                  aria-label="Previous page"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-white transition-colors hover:bg-ink-800 disabled:bg-ink-200 disabled:text-ink-400 dark:bg-ink-700"
                >
                  ‹
                </button>
                <span className="text-xs text-ink-400">
                  {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage >= totalPages}
                  aria-label="Next page"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-white transition-colors hover:bg-ink-800 disabled:bg-ink-200 disabled:text-ink-400 dark:bg-ink-700"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

function AccessDialog({ member, actor, onClose, onDone }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await memberAccess.issueAccess(member, password, { actor })
      onDone(
        `${member.name} can now sign in with ${member.email}. Give them the password — it is not stored and cannot be looked up again.`,
      )
    } catch (problem) {
      setError(problem.message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 py-10 backdrop-blur-sm">
      <form
        onSubmit={submit}
        noValidate
        className="animate-rise w-full max-w-lg rounded-xl border border-ink-100 bg-white shadow-xl dark:border-ink-800 dark:bg-ink-900"
      >
        <header className="border-b border-ink-100 px-5 py-4 dark:border-ink-800">
          <h2 className="font-display text-lg text-ink-900 dark:text-white">Library access</h2>
          <p className="mt-0.5 text-xs text-ink-400">
            {member.name} · {member.membershipNumber}
          </p>
        </header>

        <div className="space-y-4 px-5 py-5">
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}

          <p className="text-sm text-ink-600 dark:text-ink-300">
            They will sign in as a Member with <strong>{member.email}</strong> and the password you
            set here, and will be asked to change it.
          </p>

          <div>
            <label htmlFor="member-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400">
              Password
            </label>
            <input
              id="member-password"
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="off"
              autoFocus
              className="w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-[0.95rem] text-ink-900 shadow-sm focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-white"
              required
            />
            <p className="mt-1.5 text-xs text-ink-400">
              Shown as you type so it can be read out. It is hashed on save and never displayed
              again.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-ink-100 px-5 py-4 dark:border-ink-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || password.length < 8}
            className="rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brass-500 disabled:cursor-not-allowed disabled:bg-brass-200"
          >
            {busy ? 'Saving…' : 'Give access'}
          </button>
        </div>
      </form>
    </div>
  )
}
