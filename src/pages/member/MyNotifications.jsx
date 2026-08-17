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
              <button
                key={message.id}
                type="button"
                onClick={() => fresh && mark(message)}
                disabled={busy}
                className={`block w-full rounded-xl border p-5 text-left shadow-sm transition-shadow hover:shadow-md ${
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

                <p className="mt-3 text-xs text-ink-400">
                  From {message.fromName}
                  {fresh && ' · click to mark as read'}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
