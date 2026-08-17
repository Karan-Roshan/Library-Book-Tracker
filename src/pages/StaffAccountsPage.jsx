// Desk accounts, their passwords and their shifts.

import { useCallback, useEffect, useState } from 'react'
import Breadcrumbs from '../components/layout/Breadcrumbs.jsx'
import Card from '../components/dashboard/Card.jsx'
import Alert from '../components/Alert.jsx'
import RowMenu, { ACTION_CELL, ACTION_HEAD } from '../components/dashboard/RowMenu.jsx'
import PersonnelDialog from '../components/dashboard/PersonnelDialog.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLE_LABELS } from '../lib/permissions.js'
import * as auth from '../services/auth.js'

const DESK_ROLE = 'librarian'

const COLUMNS = ['Personnel', 'Phone Number', 'Email', 'Password', 'Personnel ID', 'Shift']

function PasswordCell({ hasLogin, password, shown, onToggle }) {
  if (!hasLogin) return <span className="block w-40 text-ink-400">No login</span>

  const value = shown ? (password ?? 'Not recorded — set a new one') : '••••••••'

  return (
    <span className="inline-flex items-center gap-2">

      <span className="block w-40 truncate text-ink-700 dark:text-ink-200" title={value}>
        {value}
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        title={shown ? 'Hide password' : 'Show password'}
        className="rounded p-1 text-ink-400 transition-colors hover:text-ink-700 dark:hover:text-ink-200"
      >
        {shown ? (
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M3.28 2.22a.75.75 0 10-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-2.3-2.3A9.9 9.9 0 0019 10c-1.6-3.6-5-6-9-6a9.3 9.3 0 00-3.6.72L3.28 2.22zM10 6.5c1.93 0 3.5 1.57 3.5 3.5 0 .5-.1.96-.29 1.39l-4.6-4.6c.43-.19.9-.29 1.39-.29z" />
            <path d="M1 10c.9-2.02 2.5-3.7 4.5-4.7l1.62 1.62A3.5 3.5 0 0011.9 12.6l2.03 2.03A9.4 9.4 0 0110 16c-4 0-7.4-2.4-9-6z" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M10 4c-4 0-7.4 2.4-9 6 1.6 3.6 5 6 9 6s7.4-2.4 9-6c-1.6-3.6-5-6-9-6zm0 10a4 4 0 110-8 4 4 0 010 8zm0-1.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
          </svg>
        )}
      </button>
    </span>
  )
}

const initials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

export default function StaffAccountsPage() {
  const { user } = useAuth()

  const [assistants, setAssistants] = useState([])
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState(null)

  const [revealed, setRevealed] = useState(null)

  const refresh = useCallback(() => {
    auth.listAccounts().then((all) => {
      setAssistants(
        all
          .filter((person) => person.role === DESK_ROLE)

          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
      )
    })
  }, [])

  useEffect(refresh, [refresh])

  useEffect(() => {
    if (!revealed) return undefined
    const timer = setTimeout(() => setRevealed(null), 5_000)
    return () => clearTimeout(timer)
  }, [revealed])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="mt-2 font-display text-2xl text-ink-900 dark:text-white">
            Library Assistants
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            The people who run the circulation desk.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError(null)
            setEditing('new')
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-brass-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brass-500"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Add Assistant
        </button>
      </div>

      <PersonnelDialog
        desk
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
            aria-labelledby="delete-assistant-title"
            className="animate-rise w-full max-w-md rounded-xl border border-ink-100 bg-white p-5 shadow-xl dark:border-ink-800 dark:bg-ink-900"
          >
            <h2
              id="delete-assistant-title"
              className="font-display text-lg text-ink-900 dark:text-white"
            >
              Remove {deleting.name}?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
              They will be removed from the personnel register permanently. This action cannot be
              undone.
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

      <Card
        title={ROLE_LABELS[DESK_ROLE]}
        subtitle={`${assistants.length} on the desk`}
        padded={false}
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
              {assistants.length === 0 && (
                <tr>
                  <td
                    colSpan={COLUMNS.length + 1}
                    className="px-5 py-8 text-center text-sm text-ink-400"
                  >
                    No Library Assistants yet. Add one from All Personnel.
                  </td>
                </tr>
              )}
              {assistants.map((person) => (
                <tr
                  key={person.id}
                  className="group border-b border-ink-50 transition-colors last:border-0 hover:bg-ink-50/60 dark:border-ink-800/60 dark:hover:bg-ink-800/40"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {person.avatar ? (
                        <img
                          src={person.avatar}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-brass-200 dark:bg-brass-600 dark:text-white">
                          {initials(person.name)}
                        </span>
                      )}
                      <span className="font-medium text-ink-900 dark:text-white">
                        {person.name}
                        {person.id === user.id && (
                          <span className="ml-2 text-xs font-normal text-ink-400">(You)</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-ink-500 dark:text-ink-400">
                    {person.phone ? `+91 ${person.phone}` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-ink-500 dark:text-ink-400">
                    {person.email || '—'}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <PasswordCell
                      hasLogin={person.hasLogin}
                      password={person.passwordPlain}
                      shown={revealed === person.id}
                      onToggle={() =>
                        setRevealed((current) => (current === person.id ? null : person.id))
                      }
                    />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-ink-500 dark:text-ink-400">
                    {person.membershipNumber}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-ink-700 dark:text-ink-200">
                    {person.shift ?? '—'}
                  </td>
                  <td className={ACTION_CELL}>
                    <RowMenu
                      label={`Actions for ${person.name}`}
                      items={[
                        {
                          label: 'Edit assistant',
                          onSelect: () => {
                            setError(null)
                            setEditing(person)
                          },
                        },
                        ...(person.id !== user.id
                          ? [
                              {
                                label: 'Remove assistant',
                                tone: 'danger',
                                onSelect: () => {
                                  setError(null)
                                  setDeleting(person)
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
