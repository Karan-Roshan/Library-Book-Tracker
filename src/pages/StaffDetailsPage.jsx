// The personnel register: everyone who works here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx'
import Card from '../components/dashboard/Card.jsx'
import Alert from '../components/Alert.jsx'
import RowMenu, { ACTION_CELL, ACTION_HEAD } from '../components/dashboard/RowMenu.jsx'
import PersonnelDialog from '../components/dashboard/PersonnelDialog.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { usePreferences } from '../context/PreferencesContext.jsx'
import { formatDate } from '../lib/format.js'
import { downloadFile, parseCSV, toCSV } from '../lib/csv.js'
import { PERSONNEL_ROLES, ROLE_LABELS, badgeForRole } from '../lib/permissions.js'
import { validateEmail } from '../lib/validation.js'
import * as auth from '../services/auth.js'

const CSV_COLUMNS = [
  ['Name', (row) => row.name],
  ['Role', (row) => ROLE_LABELS[row.role] ?? row.role],
  ['Phone', (row) => row.phone],
  ['Email', (row) => row.email],
  ['Personnel ID', (row) => row.membershipNumber],
  ['Joined', (row) => row.createdAt?.slice(0, 10) ?? ''],
]

function resolveRole(value) {
  const text = value.trim().toLowerCase()
  if (!text) return null
  const byKey = PERSONNEL_ROLES.find((key) => key === text)
  if (byKey) return byKey
  return PERSONNEL_ROLES.find((key) => ROLE_LABELS[key].toLowerCase() === text) ?? null
}

const initials = (name) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

const COLUMNS = [
  'Personnel',
  'Contact',
  'Role',
  'Personnel ID',
  'Joined',
]

function byRoleThenId(a, b) {
  const rank = (row) => {
    const index = PERSONNEL_ROLES.indexOf(row.role)
    return index === -1 ? PERSONNEL_ROLES.length : index
  }
  return (
    rank(a) - rank(b) ||
    String(a.membershipNumber ?? '').localeCompare(String(b.membershipNumber ?? ''), undefined, {
      numeric: true,
    })
  )
}

export default function StaffDetailsPage() {
  const { user } = useAuth()
  const { locale } = usePreferences()
  const [accounts, setAccounts] = useState([])
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [importResult, setImportResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!importResult) return undefined
    const ms = importResult.skipped.length > 0 ? 10000 : 5000
    const timer = setTimeout(() => setImportResult(null), ms)
    return () => clearTimeout(timer)
  }, [importResult])

  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const importInput = useRef(null)

  const refresh = useCallback(() => {
    auth.listAccounts().then(setAccounts)
  }, [])

  useEffect(refresh, [refresh])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return accounts
      .filter((account) => {
        if (role !== 'all' && account.role !== role) return false
        if (!term) return true
        return [
          account.name,
          account.email,
          account.phone,
          account.membershipNumber,
          ROLE_LABELS[account.role] ?? account.role,
        ]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term))
      })
      .sort(byRoleThenId)
  }, [accounts, query, role])

  function handleExport() {
    downloadFile(
      `personnel-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(visible, CSV_COLUMNS),
    )
  }

  async function handleImport(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)
    setImportResult(null)

    try {
      const { records } = parseCSV(await file.text())
      if (records.length === 0) {
        setError('That file has no rows below the header.')
        return
      }

      const added = []
      const skipped = []

      for (const [index, record] of records.entries()) {
        const line = index + 2
        const name = record.name ?? ''
        const resolved = resolveRole(record.role ?? '')
        const email = record.email ?? ''

        if (!name.trim()) {
          skipped.push(`Row ${line}: no name`)
          continue
        }
        if (!resolved) {
          skipped.push(`Row ${line}: unknown role “${record.role ?? ''}”`)
          continue
        }
        if (email && validateEmail(email)) {
          skipped.push(`Row ${line}: invalid email`)
          continue
        }

        try {
          added.push(
            await auth.createPersonnel(
              {
                name,
                email,
                role: resolved,
                phone: record.phone ?? '',
              },
              user,
            ),
          )
        } catch (failure) {
          skipped.push(`Row ${line}: ${failure.message}`)
        }
      }

      refresh()
      setImportResult({ added: added.length, skipped })
    } catch {
      setError('That file could not be read as CSV.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="mt-2 font-display text-2xl text-ink-900 dark:text-white">All Personnel</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">All Personnel Details</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null)
              setImportResult(null)
              setEditing('new')
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brass-500"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
              <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Add Personnel
          </button>
          <button
            type="button"
            onClick={() => importInput.current?.click()}
            className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            Import CSV
          </button>
          <input
            ref={importInput}
            type="file"
            accept=".csv,text/csv"
            onChange={handleImport}
            className="sr-only"
          />
          <button
            type="button"
            onClick={handleExport}
            disabled={visible.length === 0}
            className="rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300 dark:bg-ink-700 dark:hover:bg-ink-600"
          >
            Export CSV
          </button>
        </div>
      </div>

      <PersonnelDialog
        open={editing !== null}
        personnel={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSubmit={async (details) => {
          if (editing === 'new') await auth.createPersonnel(details, user)
          else await auth.updatePersonnel(editing.id, details, user)
          refresh()
        }}
      />

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-personnel-title"
            className="animate-rise w-full max-w-md rounded-xl border border-ink-100 bg-white p-5 shadow-xl dark:border-ink-800 dark:bg-ink-900"
          >
            <h2
              id="delete-personnel-title"
              className="font-display text-lg text-ink-900 dark:text-white"
            >
              Remove {deleting.name}?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
              Their record leaves the register permanently, including their contact details.
              This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await auth.deletePersonnel(deleting.id, user)
                    setDeleting(null)
                    refresh()
                  } catch (failure) {
                    setError(failure.message)
                    setDeleting(null)
                  }
                }}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <Alert>{error}</Alert>}

      {importResult && importResult.skipped.length === 0 && (
        <div
          role="status"
          className="animate-rise fixed left-1/2 top-20 z-50 w-[min(28rem,90vw)] -translate-x-1/2 lg:left-[calc(50%+8rem)]"
        >
          <div className="rounded-lg border border-brass-200 bg-brass-50 px-4 py-3 text-sm font-semibold text-brass-900 shadow-lg dark:border-brass-500/30 dark:bg-ink-800 dark:text-brass-200">
            {importResult.added} personnel imported.
          </div>
        </div>
      )}

      {importResult && importResult.skipped.length > 0 && (
        <Alert tone="error" onDismiss={() => setImportResult(null)}>
          <span className="block font-semibold">
            {importResult.added} personnel imported, {importResult.skipped.length} skipped.
          </span>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs">
            {importResult.skipped.slice(0, 8).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
            {importResult.skipped.length > 8 && (
              <li>…and {importResult.skipped.length - 8} more</li>
            )}
          </ul>
        </Alert>
      )}

      <Card
        title="Personnel"
        subtitle={
          visible.length === accounts.length
            ? `${accounts.length} shown`
            : `${visible.length} of ${accounts.length} shown`
        }
        padded={false}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative">
              <label htmlFor="staff-search" className="sr-only">
                Search personnel
              </label>
              <svg
                viewBox="0 0 20 20"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3a6 6 0 104.24 10.24l3.26 3.26a.75.75 0 101.06-1.06l-3.26-3.26A6 6 0 009 3zM4.5 9a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                id="staff-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, role, ..."
                className="w-52 rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-white dark:placeholder:text-ink-500"
              />
            </div>

            <label htmlFor="staff-role" className="sr-only">
              Filter by role
            </label>

            <div className="relative">
              <select
                id="staff-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="appearance-none rounded-lg border border-ink-200 bg-white bg-[length:0.9rem] bg-[position:right_0.75rem_center] bg-no-repeat py-2 pl-3 pr-10 text-sm text-ink-700 focus:border-brass-500 focus:outline-none focus:ring-4 focus:ring-brass-500/15 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
              >
                <option value="all">All Roles</option>
                {PERSONNEL_ROLES.map((key) => (
                  <option key={key} value={key}>
                    {ROLE_LABELS[key]}
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 20 20"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                fill="none"
                aria-hidden="true"
              >
                <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
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
                    className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-brass-200"
                  >
                    {column}
                  </th>
                ))}
                <th className={ACTION_HEAD} />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-5 py-8 text-center text-sm text-ink-400">
                    No personnel match that search.
                  </td>
                </tr>
              )}
              {visible.map((account) => (
                <tr
                  key={account.id}
                  className="group border-b border-ink-50 transition-colors last:border-0 hover:bg-ink-50/60 dark:border-ink-800/60 dark:hover:bg-ink-800/40"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {account.avatar ? (
                        <img
                          src={account.avatar}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-brass-200 dark:bg-brass-600 dark:text-white">
                          {initials(account.name)}
                        </span>
                      )}
                      <span className="font-medium text-ink-900 dark:text-white">
                        {account.name}
                        {account.id === user.id && (
                          <span className="ml-2 text-xs font-normal text-ink-400">(You)</span>
                        )}
                      </span>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-5 py-3 text-ink-500 dark:text-ink-400">
                    <span className="block">{account.phone ? `+91 ${account.phone}` : '—'}</span>
                    <span className="block">{account.email || '—'}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeForRole(account.role)}`}
                    >
                      {ROLE_LABELS[account.role] ?? account.role}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-ink-500 dark:text-ink-400">
                    {account.membershipNumber}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-ink-500 dark:text-ink-400">
                    {formatDate(account.createdAt, locale)}
                  </td>
                  <td className={ACTION_CELL}>
                    <RowMenu
                      label={`Actions for ${account.name}`}
                      items={[
                        {
                          label: 'Edit personnel',
                          onSelect: () => {
                            setError(null)
                            setEditing(account)
                          },
                        },

                        ...(account.id !== user.id
                          ? [
                              {
                                label: 'Remove personnel',
                                tone: 'danger',
                                onSelect: () => {
                                  setError(null)
                                  setDeleting(account)
                                },
                              },
                            ]
                          : []),
                      ]}
                    />
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
