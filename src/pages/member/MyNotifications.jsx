// Messages the library has sent this member.

import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { formatDate, formatTime } from '../../lib/format.js'
import { isUnread } from '../../lib/messages.js'
import * as messagesService from '../../services/messages.js'
import { useMyLibrary } from '../../hooks/useMyLibrary.js'
import { Card, Empty, PageHead } from './MemberKit.jsx'

export default function MyNotifications() {
  const { user } = useAuth()
  const { locale, system } = usePreferences()
  const my = useMyLibrary()
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(null)

  const askFirst = my.settings.system.confirmDestructive

  const unread = my.messages.filter((message) => isUnread(message, user.id))
  const visible = filter === 'unread' ? unread : my.messages

  async function mark(message) {
    setBusy(true)
    try {
      await messagesService.markRead(message.id, user.id)
      await my.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function markAll() {
    setBusy(true)
    try {
      for (const message of unread) await messagesService.markRead(message.id, user.id)
      await my.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function destroy(message) {
    setBusy(true)
    try {
      await messagesService.deleteMessageFor(message.id, user.id)
      await my.refresh()
    } finally {
      setBusy(false)
    }
  }

  const remove = (message) => (askFirst ? setRemoving(message) : destroy(message))

  if (my.loading) return <p className="py-20 text-center text-sm text-ink-400">Reading your account…</p>

  return (
    <div className="space-y-6">
      <PageHead
        title="Notifications"
        subtitle={unread.length ? `${unread.length} unread` : 'Everything read'}
        action={
          unread.length > 0 && (
            <button
              type="button"
              onClick={markAll}
              disabled={busy}
              className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
            >
              Mark all read
            </button>
          )
        }
      />

      <div role="group" aria-label="Filter" className="flex w-fit rounded-lg border border-ink-100 p-0.5 dark:border-ink-700">
        {[
          ['all', `All (${my.messages.length})`],
          ['unread', `Unread (${unread.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`rounded-[0.4rem] px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              filter === key
                ? 'bg-ink-900 text-white dark:bg-brass-600'
                : 'text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Empty title={filter === 'unread' ? 'Nothing unread' : 'No notifications'}>
          Reminders about due dates, reserved books and fines will appear here.
        </Empty>
      ) : (
        <div className="space-y-3">
          {visible.map((message) => {
            const fresh = isUnread(message, user.id)
            return (
              <div
                key={message.id}
                className={`rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md ${
                  fresh
                    ? 'border-brass-200 bg-brass-50/50 dark:border-brass-500/30 dark:bg-brass-500/5'
                    : 'border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="flex items-center gap-2 font-display text-base text-ink-900 dark:text-white">
                    {fresh && (
                      <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-brass-500" />
                    )}
                    {message.subject}
                  </p>
                  <p className="shrink-0 text-xs text-ink-400">
                    {formatDate(message.sentAt, locale, system)} ·{' '}
                    {formatTime(message.sentAt, locale, system)}
                  </p>
                </div>

                <p className="mt-2 whitespace-pre-wrap text-sm text-ink-600 dark:text-ink-300">
                  {message.body}
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <p className="text-xs text-ink-400">From {message.fromName}</p>

                  <div className="flex items-center gap-4">
                    {fresh && (
                      <button
                        type="button"
                        onClick={() => mark(message)}
                        disabled={busy}
                        className="text-xs font-semibold text-ink-500 transition-colors hover:text-ink-900 disabled:opacity-50 dark:text-ink-400 dark:hover:text-white"
                      >
                        Mark as read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(message)}
                      disabled={busy}
                      aria-label={`Delete “${message.subject || '(no subject)'}”`}
                      title="Delete"
                      className="-m-1.5 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                        <path
                          fillRule="evenodd"
                          d="M8.75 1A2.75 2.75 0 006 3.75v.443a41 41 0 00-2.365.298.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41 41 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {removing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-notice-title"
            className="animate-rise w-full max-w-md rounded-xl border border-ink-100 bg-white p-5 shadow-xl dark:border-ink-800 dark:bg-ink-900"
          >
            <h2 id="delete-notice-title" className="font-display text-lg text-ink-900 dark:text-white">
              Delete “{removing.subject || '(no subject)'}”?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
              It goes from your notifications only — anyone else it was sent to keeps
              their copy. You cannot get it back.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRemoving(null)}
                className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const message = removing
                  setRemoving(null)
                  await destroy(message)
                }}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
