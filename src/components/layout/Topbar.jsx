// Search, notifications and your account, across the top.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../Logo.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { usePreferences } from '../../context/PreferencesContext.jsx'
import { useDismiss } from '../../hooks/useDismiss.js'
import { inboxFor, isUnread } from '../../lib/messages.js'
import { useLive } from '../../hooks/useLive.js'
import { isMember } from '../../lib/permissions.js'
import * as messagesService from '../../services/messages.js'

const initials = (name) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const { user } = useAuth()
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)

  const load = useCallback(() => messagesService.listMessages().then(setMessages), [])

  useEffect(() => {
    load()
  }, [load, open])

  // Without this the badge only caught up when the panel was opened, so a notice
  // raised while the member sat on their dashboard went unseen.
  useLive(['messages'], load)

  const unread = useMemo(
    () => inboxFor(messages, user.id).filter((message) => isUnread(message, user.id)),
    [messages, user.id],
  )

  const urgent = unread.length

  // Members read theirs on their own page; the staff inbox is out of bounds.
  const inbox = isMember(user) ? '/my/notifications' : '/notifications'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        aria-expanded={open}
        aria-label={`Notifications, ${urgent} needing attention`}
        className="relative rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
          <path
            d="M10 3.2a4.2 4.2 0 00-4.2 4.2v3L4.4 12.8h11.2L14.2 10.4v-3A4.2 4.2 0 0010 3.2zM8.2 15.2a1.8 1.8 0 003.6 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {urgent > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.6rem] font-bold text-white">
            {urgent}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-80 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-800">
          <p className="border-b border-ink-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-400 dark:border-ink-700">
            Notifications
          </p>
          <ul className="max-h-80 overflow-y-auto">
            {unread.map((message) => (
              <li key={message.id}>
                <Link
                  to={inbox}
                  onClick={close}
                  className="flex items-start gap-3 border-b border-ink-50 px-4 py-3 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-700"
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brass-500" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink-900 dark:text-white">
                      {message.subject || '(no subject)'}
                    </span>
                    <span className="block truncate text-xs text-ink-400">
                      From {message.fromName}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
            {unread.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-ink-400">
                No new messages.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function ThemeToggle() {
  const { theme, toggleTheme } = usePreferences()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M10 3.5a.75.75 0 01.75.75v1a.75.75 0 01-1.5 0v-1A.75.75 0 0110 3.5zm0 10a.75.75 0 01.75.75v1a.75.75 0 01-1.5 0v-1a.75.75 0 01.75-.75zM16.5 10a.75.75 0 01-.75.75h-1a.75.75 0 010-1.5h1a.75.75 0 01.75.75zm-11 0a.75.75 0 01-.75.75h-1a.75.75 0 010-1.5h1A.75.75 0 015.5 10zm9.02-4.52a.75.75 0 010 1.06l-.7.71a.75.75 0 11-1.07-1.06l.71-.71a.75.75 0 011.06 0zm-7.07 7.07a.75.75 0 010 1.06l-.71.71a.75.75 0 11-1.06-1.06l.7-.71a.75.75 0 011.07 0zm7.07 1.77a.75.75 0 01-1.06 0l-.71-.71a.75.75 0 111.06-1.06l.71.7a.75.75 0 010 1.07zM7.45 6.54a.75.75 0 01-1.06 0l-.71-.7A.75.75 0 016.74 4.77l.71.71a.75.75 0 010 1.06zM10 6.75a3.25 3.25 0 100 6.5 3.25 3.25 0 000-6.5z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M16.5 11.8A6.9 6.9 0 018.2 3.5a7 7 0 108.3 8.3z" />
        </svg>
      )}
    </button>
  )
}

function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismiss(open, close)
  const { user, signOut } = useAuth()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-ink-100 dark:hover:bg-ink-800"
      >
        {user.avatar ? (
          <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-brass-200 dark:bg-brass-600 dark:text-white">
            {initials(user.name)}
          </span>
        )}
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold leading-tight text-ink-900 dark:text-white">
            {user.name}
          </span>
          <span className="block text-xs capitalize text-ink-400">{user.role}</span>
        </span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-ink-400" fill="none" aria-hidden="true">
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-56 overflow-hidden rounded-xl border border-ink-100 bg-white py-1 shadow-xl dark:border-ink-700 dark:bg-ink-800">
          <div className="border-b border-ink-100 px-4 py-3 dark:border-ink-700">
            <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
              {user.name}
            </p>
            <p className="truncate text-xs text-ink-400">{user.email}</p>
          </div>
          <Link
            to={isMember(user) ? '/my/profile' : '/profile'}
            onClick={close}
            className="block px-4 py-2.5 text-sm text-ink-700 transition-colors hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-700"
          >
            {isMember(user) ? 'Profile & Membership' : 'My profile'}
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="block w-full px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default function Topbar({ onOpenSidebar }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-100 bg-white px-4 sm:px-6 dark:border-ink-800 dark:bg-ink-900">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
        className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 lg:hidden dark:text-ink-300 dark:hover:bg-ink-800"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M3.5 6h13M3.5 10h13M3.5 14h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <Logo className="h-7 w-7 shrink-0 text-brass-600 lg:hidden dark:text-brass-300" />

      <div className="flex-1" />

      <div className="flex items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <NotificationsBell />
        <ProfileMenu />
      </div>
    </header>
  )
}
